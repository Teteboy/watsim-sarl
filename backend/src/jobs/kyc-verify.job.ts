import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { notifyUser } from '../services/notification.service';
import { recomputeScore } from '../services/credit-scoring.service';
import { getFileBuffer } from '../services/storage-local.service';
import { submitJob, type SmileJobType } from '../modules/kyc/smile-id.service';

async function applyOutcome(docId: string, userId: string, outcome: 'VERIFIED' | 'REJECTED', note: string) {
  await prisma.$transaction(async (tx) => {
    await tx.kycDocument.update({
      where: { id: docId },
      data: { status: outcome, reviewedAt: new Date(), reviewNote: note },
    });
    await tx.user.update({ where: { id: userId }, data: { kycStatus: outcome } });
    await tx.auditLog.create({ data: { userId, action: `KYC_${outcome}`, entityType: 'KycDocument', entityId: docId } });
  });
  if (outcome === 'VERIFIED') {
    await recomputeScore(userId);
    await notifyUser(userId, 'Votre KYC a été vérifié. Vous pouvez utiliser le BNPL.');
  } else {
    await notifyUser(userId, 'Votre KYC a été rejeté. Veuillez recommencer.');
  }
}

export async function processKycVerifyJob(data: { docId: string }): Promise<void> {
  const doc = await prisma.kycDocument.findUnique({ where: { id: data.docId } });
  if (!doc) return;

  if (env.USE_SMILE_ID) {
    try {
      const idBuffer = await getFileBuffer(doc.fileUrl);
      const selfieBuffer = doc.selfieUrl ? await getFileBuffer(doc.selfieUrl).catch(() => null) : null;
      const jobType: SmileJobType = selfieBuffer ? 1 : 4;
      const result = await submitJob({
        userId: doc.userId,
        jobId: doc.id,
        jobType,
        country: 'CM',
        idType: doc.type,
        images: [
          { imageType: 'ID_CARD_FRONT', base64: idBuffer.toString('base64') },
          ...(selfieBuffer ? [{ imageType: 'SELFIE' as const, base64: selfieBuffer.toString('base64') }] : []),
        ],
      });
      await prisma.kycDocument.update({
        where: { id: doc.id },
        data: {
          provider: 'SMILE_ID',
          providerJobId: result.smileJobId,
          providerResult: result.raw as never,
          resultCode: result.resultCode,
        },
      });
      if (result.outcome === 'VERIFIED' || result.outcome === 'REJECTED') {
        await applyOutcome(doc.id, doc.userId, result.outcome, `Smile ID ${result.resultCode}`);
      }
      return;
    } catch (err) {
      logger.error({ err, docId: doc.id }, 'Smile ID submission failed; leaving doc PENDING for manual review');
      return;
    }
  }

  if (env.NODE_ENV === 'production') {
    logger.warn({ docId: doc.id }, 'No KYC provider configured in production; document left PENDING for manual review');
    return;
  }

  await new Promise((r) => setTimeout(r, 5000));
  await applyOutcome(doc.id, doc.userId, 'VERIFIED', 'Auto-approved (dev)');
}
