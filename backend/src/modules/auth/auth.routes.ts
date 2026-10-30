import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema, refreshSchema, logoutSchema, pinLoginSchema, setPinSchema, registerWithPinSchema } from './auth.schema';
import { AuthError, issueTokens, registerCustomer, revokeRefreshToken, revokeAllUserTokens, rotateRefreshToken, verifyCredentials, recordAudit, setPinForUser, verifyPinCredentials, verifyPin } from './auth.service';
import { authenticate } from '../../middleware/authenticate';
import { uploadKycDocument, resolveImageUrl, getKycFileBuffer, getFileBuffer, getBackendBaseUrl } from '../../services/storage-local.service';
import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { enqueueKycVerification } from '../../jobs/queue';
import { mapResultCode, verifyCallbackSignature } from '../kyc/smile-id.service';
import { recomputeScore } from '../../services/credit-scoring.service';
import { notifyUser, sendLoginAlert } from '../../services/notification.service';
import { processReferralRegistration } from '../../services/referral.service';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Registration: single step, no OTP.
  // Mobile: { phone, pin, fullName?, referralCode? }
  // Web:    { phone, email, password, fullName? }
  app.post('/register', { schema: registerWithPinSchema, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = req.body as { phone: string; pin?: string; email?: string; password?: string; fullName?: string; referralCode?: string };
    try {
      if (!body.pin && !body.password) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Provide either a PIN (mobile) or an email + password (web)' });
      }
      if (body.password && !body.email) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Email is required for password registration' });
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ phone: body.phone }, ...(body.email ? [{ email: body.email }] : [])] },
      });
      if (existingUser) {
        return reply.code(409).send({ error: 'AuthError', message: 'Phone number or email already registered' });
      }

      const user = await registerCustomer({
        email: body.email ?? `${body.phone}@temp.watsim.cm`,
        phone: body.phone,
        password: body.password ?? crypto.randomBytes(16).toString('hex'),
        fullName: body.fullName || '',
        initialPin: body.pin,
      });

      if (body.referralCode) {
        await processReferralRegistration(user.id, body.referralCode);
      }

      await recordAudit(user.id, 'USER_REGISTERED', { phone: user.phone, pinSet: true, referralCode: body.referralCode }, req.ip);

      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      const requestBaseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${req.headers['host'] || `localhost:${process.env.PORT || 3001}`}`;
      return reply.code(201).send({
        user: { id: user.id, email: user.email, phone: user.phone, fullName: user.fullName, role: user.role, kycStatus: user.kycStatus, creditScore: user.creditScore, creditLimit: user.creditLimit, imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl), pinSet: !!body.pin },
        ...tokens,
      });
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  app.post('/login', { schema: loginSchema, config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = req.body as { email: string; password: string };
    try {
      const user = await verifyCredentials(body.email, body.password);
      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      await recordAudit(user.id, 'USER_LOGIN', undefined, req.ip);
      const requestBaseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${req.headers['host'] || `localhost:${process.env.PORT || 3001}`}`;
      return {
        user: { id: user.id, email: user.email, phone: user.phone, fullName: user.fullName, role: user.role, adminRole: user.adminRole, kycStatus: user.kycStatus, creditScore: user.creditScore, creditLimit: user.creditLimit, imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl) },
        ...tokens,
      };
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  app.post('/refresh', { schema: refreshSchema }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string };
    try {
      const tokens = await rotateRefreshToken(app, refreshToken);
      return tokens;
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  app.post('/logout', { schema: logoutSchema }, async (req) => {
    const { refreshToken } = req.body as { refreshToken: string };
    await revokeRefreshToken(refreshToken);
    return { success: true };
  });

  // KYC upload: accepts id (front), back, OR legacy selfie field.
  // All combinations are handled gracefully.
  app.post('/kyc/upload', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parts = req.parts();
    let frontBuffer: Buffer | null = null;
    let frontName = 'id_front.jpg';
    let frontMime = 'image/jpeg';
    let backBuffer: Buffer | null = null;
    let backName = 'id_back.jpg';
    let backMime = 'image/jpeg';
    let docType = 'NATIONAL_ID';
    for await (const part of parts) {
      if (part.type === 'file') {
        const buf = await part.toBuffer();
        // Accept field names: 'id' or 'front' for front side; 'back' or 'selfie' for back/other side
        if (part.fieldname === 'id' || part.fieldname === 'front') {
          frontBuffer = buf;
          frontName = part.filename || frontName;
          frontMime = part.mimetype || frontMime;
        } else if (part.fieldname === 'back' || part.fieldname === 'selfie') {
          backBuffer = buf;
          backName = part.filename || backName;
          backMime = part.mimetype || backMime;
        }
      } else if (part.fieldname === 'type' && typeof part.value === 'string') {
        docType = part.value;
      }
    }
    if (!frontBuffer) return reply.code(400).send({ error: 'BadRequest', message: 'ID document front photo required (field: id or front)' });
    const frontFilename = await uploadKycDocument(req.authUser!.id, frontName, frontBuffer, frontMime);
    const backFilename = backBuffer
      ? await uploadKycDocument(req.authUser!.id, backName, backBuffer, backMime)
      : null;
    // KYC files live in private storage; expose them only through the
    // authenticated download route below (owner or admin).
    const kycFileUrl = (name: string) => `${getBackendBaseUrl()}${env.API_PREFIX}/auth/kyc/file/${name}`;
    const fileUrl = kycFileUrl(frontFilename);
    const selfieUrl = backFilename ? kycFileUrl(backFilename) : null;
    const doc = await prisma.kycDocument.create({
      data: { userId: req.authUser!.id, type: docType, fileUrl, selfieUrl, status: 'PENDING' },
    });
    await prisma.user.update({ where: { id: req.authUser!.id }, data: { kycStatus: 'PENDING' } });
    await enqueueKycVerification(doc.id);
    await recordAudit(req.authUser!.id, 'KYC_UPLOADED', { docId: doc.id, type: docType }, req.ip);
    return reply.code(201).send({ document: { id: doc.id, type: doc.type, status: doc.status, fileUrl, selfieUrl } });
  });

  // Authenticated KYC document download — owner or admin only.
  // KYC files are stored outside the public /uploads dir.
  app.get('/kyc/file/:filename', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { filename } = req.params as { filename: string };
    if (!/^kyc_[A-Za-z0-9_.-]+$/.test(filename)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Invalid filename' });
    }
    const me = req.authUser!;
    if (me.role !== 'ADMIN') {
      const doc = await prisma.kycDocument.findFirst({
        where: { userId: me.id, OR: [{ fileUrl: { endsWith: filename } }, { selfieUrl: { endsWith: filename } }] },
        select: { id: true },
      });
      if (!doc) return reply.code(403).send({ error: 'Forbidden', message: 'Not your document' });
    }
    let buf: Buffer;
    try {
      buf = await getKycFileBuffer(filename);
    } catch {
      // Fallback for legacy files written to the public uploads dir before
      // the private-storage migration.
      try {
        buf = await getFileBuffer(filename);
      } catch {
        return reply.code(404).send({ error: 'NotFound', message: 'File not found' });
      }
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return reply.type(mime).send(buf);
  });

  // Smile ID asynchronous callback. Signature is HMAC-SHA256 over timestamp+partner_id+'sid_request'.
  app.post('/kyc/webhook/smile-id', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const payload = req.body as {
      signature?: string;
      timestamp?: string;
      PartnerParams?: { job_id?: string; user_id?: string };
      ResultCode?: string;
      ResultText?: string;
      SmileJobID?: string;
    };
    if (!payload?.signature || !payload?.timestamp) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Missing signature' });
    }
    if (!verifyCallbackSignature(JSON.stringify(payload), payload.timestamp, payload.signature)) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid signature' });
    }
    const jobId = payload.PartnerParams?.job_id;
    if (!jobId) return reply.code(400).send({ error: 'BadRequest', message: 'Missing job_id' });
    const doc = await prisma.kycDocument.findUnique({ where: { id: jobId } });
    if (!doc) return reply.code(404).send({ error: 'NotFound', message: 'Unknown job' });
    const outcome = mapResultCode(payload.ResultCode);
    await prisma.kycDocument.update({
      where: { id: doc.id },
      data: {
        providerResult: payload as never,
        resultCode: payload.ResultCode,
        providerJobId: payload.SmileJobID ?? doc.providerJobId,
      },
    });
    if (outcome === 'VERIFIED' || outcome === 'REJECTED') {
      await prisma.$transaction(async (tx: any) => {
        await tx.kycDocument.update({
          where: { id: doc.id },
          data: { status: outcome, reviewedAt: new Date(), reviewNote: `Smile ID ${payload.ResultCode}` },
        });
        await tx.user.update({ where: { id: doc.userId }, data: { kycStatus: outcome } });
        await tx.auditLog.create({
          data: { userId: doc.userId, action: `KYC_${outcome}`, entityType: 'KycDocument', entityId: doc.id },
        });
      });
      if (outcome === 'VERIFIED') {
        await recomputeScore(doc.userId);
        await notifyUser(doc.userId, 'kyc.verified');
      } else {
        await notifyUser(doc.userId, 'kyc.rejected');
      }
    }
    return { received: true };
  });

  // ─── PIN-based login for mobile (phone + 4-6 digit PIN) ─────────────────
  app.post('/login-pin', { schema: pinLoginSchema, config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = req.body as { phone: string; pin: string };
    try {
      const user = await verifyPinCredentials(body.phone, body.pin);

      // Login successful - issue tokens
      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      await recordAudit(user.id, 'USER_LOGIN_PIN', undefined, req.ip);

      // Send login alert (non-blocking)
      const deviceInfo = req.headers['user-agent']?.toString().split(' ')[0];
      sendLoginAlert(user.id, req.ip, deviceInfo).catch(() => {});

      const requestBaseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${req.headers['host'] || `localhost:${process.env.PORT || 3001}`}`;
      return {
        user: { id: user.id, email: user.email, phone: user.phone, fullName: user.fullName, role: user.role, kycStatus: user.kycStatus, creditScore: user.creditScore, creditLimit: user.creditLimit, imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl), pinSet: true },
        ...tokens,
      };
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  // Set or change PIN (customer must be authenticated; can be called after login or registration)
  // Step-up auth: if a PIN is already set, the caller must prove identity with
  // the current PIN or the account password before the PIN can be changed.
  app.post('/set-pin', { schema: setPinSchema, preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { pin, currentPin, password } = req.body as { pin: string; currentPin?: string; password?: string };
    if (!/^\d{4,6}$/.test(pin)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'PIN must be 4-6 digits' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) return reply.code(404).send({ error: 'NotFound', message: 'User not found' });
    if (user.pinHash) {
      // Existing PIN => this is a PIN change, require a fresh credential.
      let verified = false;
      if (currentPin) verified = await verifyPin(currentPin, user.pinHash);
      if (!verified && password && user.passwordHash) {
        verified = await bcrypt.compare(password, user.passwordHash);
      }
      if (!verified) {
        return reply.code(401).send({ error: 'AuthError', message: 'Current PIN or password required to change PIN' });
      }
    }
    await setPinForUser(req.authUser!.id, pin);
    // Revoke sessions so a stolen session cannot persist after PIN change.
    await revokeAllUserTokens(req.authUser!.id);
    await recordAudit(req.authUser!.id, 'PIN_SET', undefined, req.ip);
    return { success: true, message: 'PIN set successfully' };
  });

  // Change PIN with current PIN verification
  app.post('/change-pin', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { currentPin, newPin } = req.body as { currentPin: string; newPin: string };
    if (!/^\d{4,6}$/.test(newPin)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'New PIN must be 4-6 digits' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user || !user.pinHash) {
      return reply.code(400).send({ error: 'BadRequest', message: 'No PIN set for this account' });
    }
    const ok = await verifyPin(currentPin, user.pinHash);
    if (!ok) {
      return reply.code(401).send({ error: 'AuthError', message: 'Current PIN is incorrect' });
    }
    await setPinForUser(req.authUser!.id, newPin);
    await revokeAllUserTokens(req.authUser!.id);
    await recordAudit(req.authUser!.id, 'PIN_CHANGED', undefined, req.ip);
    return { success: true, message: 'PIN changed successfully' };
  });

}
