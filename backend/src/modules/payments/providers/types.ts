export type Provider = 'ORANGE_MONEY' | 'MTN_MOMO' | 'WALLET' | 'REFERRAL';

export interface InitiateParams {
  amount: number;
  currency: 'XAF';
  phone: string;
  reference: string;
  callbackUrl: string;
}

export interface InitiateResult {
  providerRef: string;
  redirectUrl?: string;
  ussdCode?: string;
}

export interface VerifyResult {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount?: number;
}

export interface PaymentAdapter {
  name: Provider;
  initiatePayment(params: InitiateParams): Promise<InitiateResult>;
  verifyPayment(providerRef: string): Promise<VerifyResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
