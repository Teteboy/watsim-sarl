// Minimal stubs to maintain import compatibility — all real data comes from backend API.

export interface BnplCategoryConfig { id: string; name: string; enabled: boolean; maxCredit: number; minScore: number; merchantCommission: number }

export const bnplCategorySettings: BnplCategoryConfig[] = [];

export const merchantProfile = {} as any;
export const merchantStats = {} as any;
export const merchantRevenueChart: any[] = [];
export const merchantProducts: any[] = [];
export const merchantOrders: any[] = [];
export const merchantBnplPayments: any[] = [];
export const merchantPayouts: any[] = [];

export const bnplCredits: any[] = [];
export const bnplStats: any = {};

export const adminTransactions: any[] = [];
export const transactionTypes: any[] = [];

export const adminMerchants: any[] = [];
export const adminUsers: any[] = [];
export const adminProducts: any[] = [];
export const adminPublicities: any[] = [];
export const adminNotifications: any[] = [];
export const adminDisputes: any[] = [];
export const fraudAlerts: any[] = [];
export const platformCategories: any[] = [];
export type PlatformCategory = any;

export const transactionChartData: any[] = [];
export const categoryData: any[] = [];
export const recentAlerts: any[] = [];
