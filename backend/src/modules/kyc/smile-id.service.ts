import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// Smile ID Job Types (https://docs.smileidentity.com)
// 1  — Biometric KYC (selfie + ID photo + liveness)
// 4  — Enhanced KYC (ID number lookup against issuer)
// 6  — Document Verification
// 11 — SmartSelfie™ (liveness only)
export type SmileJobType = 1 | 4 | 6 | 11;

// Smile ID country codes
export type SmileCountry = 'CM' | 'NG' | 'KE' | 'GH' | 'ZA' | 'CI' | 'SN' | 'UG' | 'TZ' | 'RW';

// Maps to Smile ID id_type strings for Cameroon
export const SMILE_ID_TYPE_MAP: Record<string, string> = {
  NATIONAL_ID: 'NATIONAL_ID',
  CNI: 'NATIONAL_ID',
  PASSPORT: 'PASSPORT',
  DRIVERS_LICENSE: 'DRIVERS_LICENSE',
};

// Result codes that mean "verified". See SmileID docs §Result Codes.
const VERIFIED_CODES = new Set(['0810', '0814', '1220']);
// Codes that mean "rejected/failed" (subset relevant to KYC jobs)
const REJECTED_CODES = new Set(['0811', '0812', '0813', '0911', '0912']);

export type SmileVerificationOutcome = 'VERIFIED' | 'REJECTED' | 'PENDING';

export interface SmileSubmitParams {
  userId: string;
  jobId: string;
  jobType: SmileJobType;
  country: SmileCountry;
  idType: string;
  idNumber?: string;
  images: { imageType: 'SELFIE' | 'ID_CARD_FRONT' | 'ID_CARD_BACK' | 'LIVENESS'; base64: string }[];
}

export interface SmileSubmitResult {
  smileJobId: string;
  status: 'SUBMITTED' | 'COMPLETED';
  outcome?: SmileVerificationOutcome;
  resultCode?: string;
  raw?: unknown;
}

function generateSignature(timestamp: string): { signature: string; timestamp: string } {
  if (!env.SMILE_ID_API_KEY || !env.SMILE_ID_PARTNER_ID) {
    throw new Error('SMILE_ID credentials missing');
  }
  const hmac = crypto.createHmac('sha256', env.SMILE_ID_API_KEY);
  hmac.update(timestamp + env.SMILE_ID_PARTNER_ID + 'sid_request');
  return { signature: hmac.digest('base64'), timestamp };
}

export function verifyCallbackSignature(payload: string, timestamp: string, signature: string): boolean {
  if (!env.SMILE_ID_API_KEY || !env.SMILE_ID_PARTNER_ID) return false;
  const hmac = crypto.createHmac('sha256', env.SMILE_ID_API_KEY);
  hmac.update(timestamp + env.SMILE_ID_PARTNER_ID + 'sid_request');
  const expected = hmac.digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function mapResultCode(resultCode?: string): SmileVerificationOutcome {
  if (!resultCode) return 'PENDING';
  if (VERIFIED_CODES.has(resultCode)) return 'VERIFIED';
  if (REJECTED_CODES.has(resultCode)) return 'REJECTED';
  return 'PENDING';
}

export async function submitJob(params: SmileSubmitParams): Promise<SmileSubmitResult> {
  if (!env.USE_SMILE_ID) {
    return { smileJobId: `mock_${params.jobId}`, status: 'COMPLETED', outcome: 'VERIFIED', resultCode: '0810' };
  }
  if (!env.SMILE_ID_BASE_URL) throw new Error('SMILE_ID_BASE_URL not set');
  const timestamp = new Date().toISOString();
  const { signature } = generateSignature(timestamp);
  const body = {
    partner_id: env.SMILE_ID_PARTNER_ID,
    signature,
    timestamp,
    source_sdk: 'rest_api',
    source_sdk_version: '1.0.0',
    callback_url: env.SMILE_ID_CALLBACK_URL,
    partner_params: { user_id: params.userId, job_id: params.jobId, job_type: params.jobType },
    images: params.images.map((i) => ({
      image_type_id: imageTypeId(i.imageType),
      image: i.base64,
    })),
    id_info: {
      country: params.country,
      id_type: SMILE_ID_TYPE_MAP[params.idType] ?? params.idType,
      id_number: params.idNumber,
      entered: 'true',
    },
  };
  const res = await fetch(`${env.SMILE_ID_BASE_URL}/v1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ status: res.status, body: text }, 'Smile ID upload failed');
    throw new Error(`Smile ID upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { job_id?: string; ResultCode?: string };
  return {
    smileJobId: data.job_id ?? params.jobId,
    status: 'SUBMITTED',
    outcome: mapResultCode(data.ResultCode),
    resultCode: data.ResultCode,
    raw: data,
  };
}

// Smile ID image_type_id enum: 0 = selfie (base64), 1 = ID card (base64),
// 2 = selfie (file path), 3 = ID card (file path), 4 = liveness (base64).
function imageTypeId(t: SmileSubmitParams['images'][0]['imageType']): number {
  switch (t) {
    case 'SELFIE': return 0;
    case 'ID_CARD_FRONT': return 1;
    case 'ID_CARD_BACK': return 1;
    case 'LIVENESS': return 4;
  }
}

export async function fetchJobStatus(jobId: string, userId: string): Promise<SmileSubmitResult> {
  if (!env.USE_SMILE_ID) return { smileJobId: jobId, status: 'COMPLETED', outcome: 'VERIFIED', resultCode: '0810' };
  if (!env.SMILE_ID_BASE_URL) throw new Error('SMILE_ID_BASE_URL not set');
  const timestamp = new Date().toISOString();
  const { signature } = generateSignature(timestamp);
  const res = await fetch(`${env.SMILE_ID_BASE_URL}/v1/job_status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_id: env.SMILE_ID_PARTNER_ID,
      signature,
      timestamp,
      user_id: userId,
      job_id: jobId,
      image_links: false,
      history: false,
    }),
  });
  if (!res.ok) return { smileJobId: jobId, status: 'SUBMITTED', outcome: 'PENDING' };
  const data = (await res.json()) as { result?: { ResultCode?: string }; job_complete?: boolean };
  const code = data.result?.ResultCode;
  return {
    smileJobId: jobId,
    status: data.job_complete ? 'COMPLETED' : 'SUBMITTED',
    outcome: mapResultCode(code),
    resultCode: code,
    raw: data,
  };
}
