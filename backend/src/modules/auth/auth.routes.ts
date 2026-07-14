import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../config/logger';
import { registerSchema, loginSchema, refreshSchema, logoutSchema, pinLoginSchema, setPinSchema, registerWithPinSchema, sendOtpSchema, verifyOtpSchema } from './auth.schema';
import { AuthError, issueTokens, registerCustomer, revokeRefreshToken, rotateRefreshToken, verifyCredentials, recordAudit, setPinForUser, verifyPinCredentials, verifyPin } from './auth.service';
import { generateAndSendOtp, verifyOtp } from '../../services/otp.service';
import { authenticate } from '../../middleware/authenticate';
import { uploadKycDocument, resolveImageUrl } from '../../services/storage-local.service';
import { prisma } from '../../config/db';
import { enqueueKycVerification } from '../../jobs/queue';
import { mapResultCode, verifyCallbackSignature } from '../kyc/smile-id.service';
import { recomputeScore } from '../../services/credit-scoring.service';
import { notifyUser, sendLoginAlert, initiate2FALogin, verify2FALogin } from '../../services/notification.service';
import { getSecuritySettings } from '../../services/security.service';
import { processReferralRegistration } from '../../services/referral.service';
import crypto from 'crypto';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Mobile registration: Step 1 - Send OTP to phone
  app.post('/register', { schema: registerWithPinSchema, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = req.body as { phone: string; referralCode?: string };
    try {
      // Check if phone already exists
      const existingUser = await prisma.user.findUnique({ where: { phone: body.phone } });
      if (existingUser) {
        return reply.code(409).send({ error: 'AuthError', message: 'Phone number already registered' });
      }
      
      // Store registration data temporarily with OTP
      await generateAndSendOtp(body.phone);
      
      // Store pending registration in Redis (10 min expiry)
      const redis = (await import('../../config/redis')).getRedis();
      const regKey = `reg:${body.phone}`;
      await redis.set(regKey, JSON.stringify({ referralCode: body.referralCode }), 'EX', 600);
      
      await recordAudit(null, 'REGISTRATION_INITIATED', { phone: body.phone }, req.ip);
      
      return reply.code(200).send({ 
        message: 'OTP sent to phone',
        phone: body.phone,
      });
    } catch (e) {
      if (e instanceof AuthError) return reply.code(e.statusCode).send({ error: 'AuthError', message: e.message });
      throw e;
    }
  });

  // Step 2 - Verify OTP and return verification token
  app.post('/verify-otp', { schema: verifyOtpSchema }, async (req, reply) => {
    const { phone, code } = req.body as { phone: string; code: string };
    const isValid = await verifyOtp(phone, code);
    if (!isValid) {
      return reply.code(400).send({ error: 'AuthError', message: 'Invalid or expired OTP' });
    }
    
    // Generate temporary verification token for registration completion
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const redis = (await import('../../config/redis')).getRedis();
    await redis.set(`verify:${verificationToken}`, phone, 'EX', 600); // 10 min
    
    return reply.code(200).send({ 
      verified: true,
      verificationToken,
    });
  });

  // Step 3 - Complete registration with PIN
  app.post('/register-complete', { schema: { body: { type: 'object', required: ['verificationToken', 'pin'], properties: { verificationToken: { type: 'string' }, pin: { type: 'string', minLength: 4, maxLength: 4, pattern: '^[0-9]{4}$' }, fullName: { type: 'string' } } } } }, async (req, reply) => {
    const body = req.body as { verificationToken: string; pin: string; fullName?: string };
    try {
      // Verify token and get phone
      const redis = (await import('../../config/redis')).getRedis();
      const phone = await redis.get(`verify:${body.verificationToken}`);
      if (!phone) {
        return reply.code(400).send({ error: 'AuthError', message: 'Invalid or expired verification token' });
      }
      
      // Get pending registration data
      const regDataRaw = await redis.get(`reg:${phone}`);
      const regData = regDataRaw ? JSON.parse(regDataRaw) : {};
      
      // Create user
      const user = await registerCustomer({
        email: `${phone}@temp.watsim.cm`,
        phone,
        password: crypto.randomBytes(16).toString('hex'),
        fullName: body.fullName || '',
      });
      
      // Set PIN (4 digits)
      await setPinForUser(user.id, body.pin);
      
      // Process referral if code was provided
      if (regData.referralCode) {
        await processReferralRegistration(user.id, regData.referralCode);
      }
      
      // Clean up Redis
      await redis.del(`verify:${body.verificationToken}`);
      await redis.del(`reg:${phone}`);
      
      await recordAudit(user.id, 'USER_REGISTERED', { phone: user.phone, pinSet: true, referralCode: regData.referralCode }, req.ip);
      
      // Issue tokens
      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      const requestBaseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${req.headers['host'] || `localhost:${process.env.PORT || 3001}`}`;
      return reply.code(201).send({
        user: { id: user.id, phone: user.phone, role: user.role, kycStatus: user.kycStatus, imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl), pinSet: true },
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
        user: { id: user.id, email: user.email, phone: user.phone, fullName: user.fullName, role: user.role, kycStatus: user.kycStatus, creditScore: user.creditScore, creditLimit: user.creditLimit, imageUrl: resolveImageUrl(user.imageUrl, requestBaseUrl) },
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
    const fileUrl = resolveImageUrl(frontFilename) ?? frontFilename;
    const selfieUrl = backFilename ? (resolveImageUrl(backFilename) ?? backFilename) : null;
    const doc = await prisma.kycDocument.create({
      data: { userId: req.authUser!.id, type: docType, fileUrl, selfieUrl, status: 'PENDING' },
    });
    await prisma.user.update({ where: { id: req.authUser!.id }, data: { kycStatus: 'PENDING' } });
    await enqueueKycVerification(doc.id);
    await recordAudit(req.authUser!.id, 'KYC_UPLOADED', { docId: doc.id, type: docType }, req.ip);
    return reply.code(201).send({ document: { id: doc.id, type: doc.type, status: doc.status, fileUrl, selfieUrl } });
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
      await prisma.$transaction(async (tx) => {
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
        await notifyUser(doc.userId, 'Votre KYC a été vérifié. Vous pouvez utiliser le BNPL.');
      } else {
        await notifyUser(doc.userId, 'Votre KYC a été rejeté. Veuillez recommencer.');
      }
    }
    return { received: true };
  });

  // ─── PIN-based login for mobile (phone + 4-6 digit PIN) ─────────────────
  app.post('/login-pin', { schema: pinLoginSchema, config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = req.body as { phone: string; pin: string; otp2fa?: string };
    try {
      const user = await verifyPinCredentials(body.phone, body.pin);

      // Check if 2FA is enabled
      const securitySettings = await getSecuritySettings(user.id);

      // If 2FA is enabled and no OTP provided, send 2FA OTP
      if (securitySettings.twoFAEnabled && !body.otp2fa) {
        const otp = await initiate2FALogin(user.id);
        return {
          requires2FA: true,
          message: 'Please enter the 6-digit code sent to your phone',
        };
      }

      // If 2FA is enabled and OTP provided, verify it
      if (securitySettings.twoFAEnabled && body.otp2fa) {
        const verification = await verify2FALogin(body.otp2fa);
        if (!verification.valid || verification.userId !== user.id) {
          return reply.code(401).send({ error: 'AuthError', message: 'Invalid or expired verification code' });
        }
      }

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

  // Set or change PIN (customer must be authenticated; can be called after login or after register+OTP)
  app.post('/set-pin', { schema: setPinSchema, preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { pin } = req.body as { pin: string };
    if (!/^\d{4,6}$/.test(pin)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'PIN must be 4-6 digits' });
    }
    await setPinForUser(req.authUser!.id, pin);
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
    await recordAudit(req.authUser!.id, 'PIN_CHANGED', undefined, req.ip);
    return { success: true, message: 'PIN changed successfully' };
  });

  // === Real SMS OTP (Twilio) for phone verification ===
  app.post('/send-otp', { schema: sendOtpSchema, config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const { phone } = req.body as { phone: string };
    try {
      await generateAndSendOtp(phone);
      return { success: true, message: 'Verification code sent via SMS' };
    } catch (e) {
      logger.error({ err: e }, 'Failed to send OTP');
      return reply.code(500).send({ error: 'InternalError', message: 'Failed to send verification code' });
    }
  });

  // ─── Reset PIN via OTP verification token ───────────────────────────────
  app.post('/reset-pin', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { verificationToken, newPin } = req.body as { verificationToken: string; newPin: string };
    if (!verificationToken || !newPin) {
      return reply.code(400).send({ error: 'BadRequest', message: 'verificationToken and newPin are required' });
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'PIN must be 4–6 digits' });
    }
    let payload: any;
    try {
      payload = app.jwt.verify(verificationToken);
    } catch {
      return reply.code(401).send({ error: 'InvalidToken', message: 'Verification token is invalid or expired' });
    }
    if (payload?.purpose !== 'phone-verification' || !payload?.sub) {
      return reply.code(401).send({ error: 'InvalidToken', message: 'Token purpose mismatch' });
    }
    const phone = payload.sub as string;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return reply.code(404).send({ error: 'NotFound', message: 'No account found for this phone number' });
    }
    await setPinForUser(user.id, newPin);
    await recordAudit(user.id, 'PIN_RESET', { phone }, req.ip);
    return { success: true, message: 'PIN has been reset successfully' };
  });

  // ─── 2FA Verification for Login ───────────────────────────────────────────
  app.post('/verify-2fa', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const { phone, pin, otp } = req.body as { phone: string; pin: string; otp: string };
    try {
      const user = await verifyPinCredentials(phone, pin);

      // Verify 2FA OTP
      const verification = await verify2FALogin(otp);
      if (!verification.valid || verification.userId !== user.id) {
        return reply.code(401).send({ error: 'AuthError', message: 'Invalid or expired verification code' });
      }

      // 2FA successful - issue tokens
      const tokens = await issueTokens(app, { id: user.id, role: user.role, email: user.email });
      await recordAudit(user.id, 'USER_LOGIN_2FA', undefined, req.ip);

      // Send login alert
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
}
