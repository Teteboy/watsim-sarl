export interface BnplCategoryConfig {
  id: string;
  name: string;
  enabled: boolean;
  maxCredit: number;
  minScore: number;
  merchantCommission: number;
}

export const bnplCategorySettings: BnplCategoryConfig[] = [
  {
    id: 'electronics',
    name: 'Électronique & Tech',
    enabled: true,
    maxCredit: 1500000,
    minScore: 60,
    merchantCommission: 4,
  },
  {
    id: 'fashion',
    name: 'Mode & Textile',
    enabled: true,
    maxCredit: 500000,
    minScore: 45,
    merchantCommission: 5,
  },
  {
    id: 'home',
    name: 'Maison & Décoration',
    enabled: true,
    maxCredit: 1200000,
    minScore: 55,
    merchantCommission: 4.5,
  },
  {
    id: 'health',
    name: 'Santé & Bien-être',
    enabled: true,
    maxCredit: 800000,
    minScore: 50,
    merchantCommission: 3,
  },
  {
    id: 'sports',
    name: 'Sport & Loisirs',
    enabled: false,
    maxCredit: 600000,
    minScore: 50,
    merchantCommission: 5,
  },
  {
    id: 'furniture',
    name: 'Meubles & Électroménager',
    enabled: true,
    maxCredit: 2000000,
    minScore: 65,
    merchantCommission: 4,
  },
  {
    id: 'beauty',
    name: 'Beauté & Cosmétiques',
    enabled: true,
    maxCredit: 300000,
    minScore: 40,
    merchantCommission: 6,
  },
  {
    id: 'automotive',
    name: 'Auto & Accessoires',
    enabled: false,
    maxCredit: 3000000,
    minScore: 75,
    merchantCommission: 3.5,
  },
];