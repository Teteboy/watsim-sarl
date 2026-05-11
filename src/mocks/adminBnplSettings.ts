export interface BnplCategoryConfig {
  id: string;
  name: string;
  enabled: boolean;
  maxCredit: number;
  minScore: number;
  rates: {
    plan2m: number;
    plan3m: number;
    plan6m: number;
  };
  downPaymentPercent: number;
  gracePeriodDays: number;
  penaltyRate: number;
  merchantCommission: number;
}

export const bnplCategorySettings: BnplCategoryConfig[] = [
  {
    id: 'electronics',
    name: 'Électronique & Tech',
    enabled: true,
    maxCredit: 1500000,
    minScore: 60,
    rates: { plan2m: 3, plan3m: 5, plan6m: 8 },
    downPaymentPercent: 10,
    gracePeriodDays: 5,
    penaltyRate: 2,
    merchantCommission: 4,
  },
  {
    id: 'fashion',
    name: 'Mode & Textile',
    enabled: true,
    maxCredit: 500000,
    minScore: 45,
    rates: { plan2m: 4, plan3m: 6, plan6m: 10 },
    downPaymentPercent: 15,
    gracePeriodDays: 3,
    penaltyRate: 2.5,
    merchantCommission: 5,
  },
  {
    id: 'home',
    name: 'Maison & Décoration',
    enabled: true,
    maxCredit: 1200000,
    minScore: 55,
    rates: { plan2m: 3, plan3m: 5, plan6m: 8 },
    downPaymentPercent: 20,
    gracePeriodDays: 7,
    penaltyRate: 1.5,
    merchantCommission: 4.5,
  },
  {
    id: 'health',
    name: 'Santé & Bien-être',
    enabled: true,
    maxCredit: 800000,
    minScore: 50,
    rates: { plan2m: 2, plan3m: 4, plan6m: 7 },
    downPaymentPercent: 5,
    gracePeriodDays: 7,
    penaltyRate: 1,
    merchantCommission: 3,
  },
  {
    id: 'sports',
    name: 'Sport & Loisirs',
    enabled: false,
    maxCredit: 600000,
    minScore: 50,
    rates: { plan2m: 4, plan3m: 6, plan6m: 9 },
    downPaymentPercent: 15,
    gracePeriodDays: 5,
    penaltyRate: 2,
    merchantCommission: 5,
  },
  {
    id: 'furniture',
    name: 'Meubles & Électroménager',
    enabled: true,
    maxCredit: 2000000,
    minScore: 65,
    rates: { plan2m: 2.5, plan3m: 4.5, plan6m: 7.5 },
    downPaymentPercent: 25,
    gracePeriodDays: 10,
    penaltyRate: 1.5,
    merchantCommission: 4,
  },
  {
    id: 'beauty',
    name: 'Beauté & Cosmétiques',
    enabled: true,
    maxCredit: 300000,
    minScore: 40,
    rates: { plan2m: 5, plan3m: 7, plan6m: 12 },
    downPaymentPercent: 10,
    gracePeriodDays: 3,
    penaltyRate: 3,
    merchantCommission: 6,
  },
  {
    id: 'automotive',
    name: 'Auto & Accessoires',
    enabled: false,
    maxCredit: 3000000,
    minScore: 75,
    rates: { plan2m: 2, plan3m: 3.5, plan6m: 6 },
    downPaymentPercent: 30,
    gracePeriodDays: 10,
    penaltyRate: 1,
    merchantCommission: 3.5,
  },
];