export type InstalmentCount = number;
export type PaymentFrequency = 'daily' | 'weekly' | 'monthly';

function getRate(count: number): number {
  if (count === 1) return 0;
  if (count === 2) return 0.02;
  if (count === 3) return 0.04;
  if (count === 4) return 0.05;
  if (count === 5) return 0.07;
  if (count === 6) return 0.08;
  if (count <= 12) return 0.08 + (count - 6) * 0.01;   // 7mo=9% … 12mo=14%
  if (count <= 24) return 0.14 + (count - 12) * 0.005; // 13mo=14.5% … 24mo=20%
  return 0.20 + (count - 24) * 0.003;                   // 25mo=20.3% … 60mo=30.8%
}

const RATES: Record<number, number> = {};
for (let i = 1; i <= 60; i++) RATES[i] = getRate(i);

export interface BnplFees {
  stockingFee: number;
  accountCreationFee: number;
  deliveryFee: number;
  collectionFee: number;
}

export interface InstalmentPlan {
  total: number;
  monthly: number;
  rate: number;
  interest: number;
  frequency: PaymentFrequency;
  count: InstalmentCount;
  schedule: { index: number; dueDate: Date; amount: number }[];
  fees: {
    stockingFee: number;
    accountCreationFee: number;
    deliveryFee: number;
    collectionFee: number;
    totalFees: number;
  };
}

export function isValidCount(n: number): n is InstalmentCount {
  return Number.isInteger(n) && n >= 1 && n <= 60;
}

// Flexible signature: third arg may be frequency or startDate to support both tests and service callers
export function calculateInstalmentPlan(
  amount: number,
  count: InstalmentCount,
  a: PaymentFrequency | Date = 'monthly',
  b: Date | PaymentFrequency = new Date(),
  downPayment: number = 0,
  fees?: BnplFees,
  isFirstPurchase: boolean = false,
): InstalmentPlan {
  let frequency: PaymentFrequency = 'monthly';
  let startDate: Date = new Date();

  if (typeof a === 'string') {
    frequency = a as PaymentFrequency;
    startDate = b instanceof Date ? b : new Date();
  } else if (a instanceof Date) {
    startDate = a as Date;
    frequency = typeof b === 'string' ? (b as PaymentFrequency) : 'monthly';
  }

  // Default fees if not provided
  // Account creation fee: 500 FCFA (only for first BNPL product)
  const defaultFees: BnplFees = {
    stockingFee: 3000,
    accountCreationFee: 500,
    deliveryFee: 0,
    collectionFee: 1000,
  };
  
  const actualFees = fees || defaultFees;
  
  // Calculate fees
  const accountCreationFeeAmount = isFirstPurchase ? actualFees.accountCreationFee : 0;
  const collectionFeeAmount = actualFees.collectionFee; // One-time fee
  const deliveryFeeAmount = actualFees.deliveryFee;
  // Stocking fee is monthly, so for N months it is N * monthly fee
  const stockingFeeAmount = actualFees.stockingFee * count;
  
  const totalFees = accountCreationFeeAmount + collectionFeeAmount + deliveryFeeAmount + stockingFeeAmount;

  // Apply down payment to reduce principal
  const principal = Math.max(0, amount - downPayment);
  const rate = RATES[count];
  const financedTotal = Math.round(principal * (1 + rate));
  const total = financedTotal + downPayment + totalFees;
  const monthly = Math.ceil((financedTotal + totalFees) / count);
  const interest = financedTotal - principal;

  const daysPerInstalment = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;

  const schedule = Array.from({ length: count }, (_, i) => {
    const due = new Date(startDate);
    due.setDate(due.getDate() + daysPerInstalment * (i + 1));
    return { index: i, dueDate: due, amount: monthly };
  });

  return { 
    total, 
    monthly, 
    rate, 
    interest, 
    frequency, 
    count, 
    schedule,
    fees: {
      stockingFee: stockingFeeAmount,
      accountCreationFee: accountCreationFeeAmount,
      deliveryFee: deliveryFeeAmount,
      collectionFee: collectionFeeAmount,
      totalFees,
    }
  };
}

/**
 * Validates that the first installment payment meets minimum requirements
 * - Minimum 500 FCFA for first installment when using real Campay API
 * - For first BNPL purchase: minimum 1000 FCFA (500 account creation fee + 500 first installment)
 */
export function validateFirstInstalment(
  amount: number,
  isFirstPurchase: boolean = false
): { valid: boolean; message?: string } {
  const MIN_FIRST_INSTALMENT = 500;
  const ACCOUNT_CREATION_FEE = 500;
  const MIN_FIRST_PURCHASE_TOTAL = 1000; // 500 account creation + 500 first installment
  
  if (isFirstPurchase) {
    // For first purchase, need to cover account creation fee (500) + first installment (500 minimum)
    if (amount < MIN_FIRST_PURCHASE_TOTAL) {
      return {
        valid: false,
        message: `First purchase requires minimum ${MIN_FIRST_PURCHASE_TOTAL} FCFA (${ACCOUNT_CREATION_FEE} account creation fee + ${MIN_FIRST_INSTALMENT} first installment)`,
      };
    }
  } else {
    // For subsequent purchases, just need minimum first installment
    if (amount < MIN_FIRST_INSTALMENT) {
      return {
        valid: false,
        message: `First installment must be at least ${MIN_FIRST_INSTALMENT} FCFA`,
      };
    }
  }
  
  return { valid: true };
}
