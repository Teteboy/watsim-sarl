import type { AccountType } from '@prisma/client';

export interface ChartAccount {
  code: string;
  name: string;
  type: AccountType;
  parent?: string;
}

// Minimal OHADA (SYSCOHADA-Révisé) chart of accounts tailored to WATSIM BNPL flows.
// Codes follow the official Plan Comptable OHADA classification.
export const OHADA_CHART: ChartAccount[] = [
  // Class 1 — Equity
  { code: '101', name: 'Capital social', type: 'EQUITY' },
  { code: '120', name: 'Résultat de l’exercice (bénéfice)', type: 'EQUITY' },
  { code: '129', name: 'Résultat de l’exercice (perte)', type: 'EQUITY' },

  // Class 4 — Third-party accounts (receivables / payables)
  { code: '401', name: 'Fournisseurs — Marchands', type: 'LIABILITY' },
  { code: '411', name: 'Clients — Encours BNPL', type: 'ASSET' },
  { code: '416', name: 'Clients douteux ou litigieux', type: 'ASSET' },
  { code: '419', name: 'Clients — Avances reçues', type: 'LIABILITY' },
  { code: '445', name: 'État, TVA collectée', type: 'LIABILITY' },
  { code: '4452', name: 'État, TVA déductible', type: 'ASSET' },

  // Class 5 — Treasury
  { code: '512', name: 'Banque', type: 'ASSET' },
  { code: '521', name: 'Mobile Money — MTN MoMo', type: 'ASSET' },
  { code: '522', name: 'Mobile Money — Orange Money', type: 'ASSET' },
  { code: '523', name: 'Mobile Money — CamPay (collect)', type: 'ASSET' },
  { code: '571', name: 'Caisse', type: 'ASSET' },
  { code: '585', name: 'Virements internes', type: 'ASSET' },
  { code: '590', name: 'Wallet clients (compte de passage)', type: 'LIABILITY' },

  // Class 6 — Expenses
  { code: '627', name: 'Services bancaires & frais de transaction', type: 'EXPENSE' },
  { code: '651', name: 'Pertes sur créances irrécouvrables', type: 'EXPENSE' },
  { code: '658', name: 'Charges diverses d’exploitation', type: 'EXPENSE' },

  // Class 7 — Income
  { code: '706', name: 'Services vendus — Frais BNPL', type: 'INCOME' },
  { code: '707', name: 'Commissions marchands', type: 'INCOME' },
  { code: '758', name: 'Produits divers — Pénalités de retard', type: 'INCOME' },
];

export function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}
