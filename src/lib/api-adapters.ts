// Maps backend API responses to the shapes used by the existing UI/mocks.
// Backend returns enum strings in UPPER_CASE; UI uses lower-case keys.

export interface BackendUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: 'ADMIN' | 'MERCHANT' | 'CUSTOMER';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  creditScore: number;
  creditLimit: number;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string | null;
}

export interface UiAdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: 'verified' | 'pending' | 'rejected';
  creditScore: number;
  creditLimit: number;
  walletBalance: number;
  joinedAt: string;
  status: 'active' | 'suspended';
  transactions: number;
  totalSpent: number;
  image?: string;
}

export function mapUser(u: BackendUser): UiAdminUser {
  return {
    id: u.id,
    name: u.fullName,
    email: u.email,
    phone: u.phone,
    kycStatus: u.kycStatus.toLowerCase() as UiAdminUser['kycStatus'],
    creditScore: u.creditScore,
    creditLimit: u.creditLimit,
    walletBalance: 0,
    joinedAt: u.createdAt?.split('T')[0] ?? '',
    status: u.isActive ? 'active' : 'suspended',
    transactions: 0,
    totalSpent: 0,
    image: u.imageUrl ?? undefined,
  };
}

export interface BackendCategory {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  icon?: string | null;
}

export interface BackendMerchant {
  id: string;
  userId: string;
  businessName: string;
  category: string;
  city: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  commissionRate: string | number;
  createdAt: string;
  user?: { id: string; email: string; phone: string; fullName: string };
  categories?: { category: BackendCategory }[];
}

export interface UiAdminMerchant {
  id: string;
  userId?: string | null;
  name: string;
  owner: string;
  email: string;
  phone: string;
  category: string;
  categories: BackendCategory[];
  city: string;
  operatingMarket: string;
  status: 'active' | 'pending' | 'suspended';
  verified: boolean;
  products: number;
  orders: number;
  revenue: number;
  joinedAt: string;
  rating: number;
}

export function mapMerchant(m: BackendMerchant): UiAdminMerchant {
  return {
    id: m.id,
    userId: m.user?.id ?? null,
    name: m.businessName,
    owner: m.user?.fullName ?? '',
    email: m.user?.email ?? '',
    phone: m.user?.phone ?? '',
    category: m.category,
    categories: m.categories?.map(mc => mc.category) ?? [],
    city: m.city,
    operatingMarket: m.city,
    status: m.status.toLowerCase() as UiAdminMerchant['status'],
    verified: m.status === 'ACTIVE',
    products: 0,
    orders: 0,
    revenue: 0,
    joinedAt: m.createdAt?.split('T')[0] ?? '',
    rating: 0,
  };
}

export interface BackendTransaction {
  id: string;
  userId: string;
  purchaseId: string | null;
  type: 'PURCHASE' | 'REPAYMENT' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
  user?: { id: string; email: string; fullName: string };
}

const TYPE_MAP: Record<BackendTransaction['type'], string> = {
  PURCHASE: 'bnpl_purchase',
  REPAYMENT: 'repayment',
  DEPOSIT: 'wallet_deposit',
  WITHDRAWAL: 'wallet_withdrawal',
  REFUND: 'transfer',
};

export interface UiTransaction {
  id: string;
  user: string;
  userId: string;
  type: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  merchant: string;
  method: string;
  date: string;
  description: string;
}

export function mapTransaction(t: BackendTransaction): UiTransaction {
  const statusMap: Record<BackendTransaction['status'], UiTransaction['status']> = {
    COMPLETED: 'completed', PENDING: 'pending', FAILED: 'failed', REVERSED: 'failed',
  };
  return {
    id: t.id,
    user: t.user?.fullName ?? t.userId,
    userId: t.userId,
    type: TYPE_MAP[t.type] ?? 'transfer',
    amount: t.amount,
    status: statusMap[t.status],
    merchant: '',
    method: t.provider ?? 'Wallet',
    date: t.createdAt,
    description: `Transaction ${t.id}`,
  };
}

export interface BackendInstalment {
  id: string; sequence: number; amount: number; dueDate: string; status: 'PENDING' | 'PAID' | 'LATE' | 'WAIVED';
  paidAt?: string | null;
}
export interface BackendBnplPurchase {
  id: string; userId: string; merchantId: string; productId: string | null;
  totalAmount: number; instalmentCount: number; interestRate: string | number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
  createdAt: string;
  user?: { id: string; fullName: string; email: string };
  merchant?: { id: string; businessName: string };
  product?: { id: string; name: string };
  instalments?: BackendInstalment[];
}

export interface UiBnplCredit {
  id: string; user: string; userId: string; product: string; merchant: string;
  totalAmount: number; paidAmount: number; remainingAmount: number;
  installments: number; paidInstallments: number; nextDueDate: string | null;
  status: 'active' | 'completed' | 'pending' | 'overdue';
  interestRate: number; startDate: string; score: number;
}

export function mapBnpl(b: BackendBnplPurchase): UiBnplCredit {
  const inst = b.instalments ?? [];
  const paidInst = inst.filter((i) => i.status === 'PAID');
  const overdue = inst.some((i) => i.status === 'LATE');
  const nextDue = inst.filter((i) => i.status !== 'PAID').sort((a, b2) => a.dueDate.localeCompare(b2.dueDate))[0];
  const paidAmount = paidInst.reduce((s, i) => s + Number(i.amount), 0);
  const statusMap: Record<BackendBnplPurchase['status'], UiBnplCredit['status']> = {
    PENDING: 'pending', ACTIVE: overdue ? 'overdue' : 'active', COMPLETED: 'completed',
    DEFAULTED: 'overdue', CANCELLED: 'completed',
  };
  return {
    id: b.id,
    user: b.user?.fullName ?? b.userId,
    userId: b.userId,
    product: b.product?.name ?? '—',
    merchant: b.merchant?.businessName ?? '',
    totalAmount: Number(b.totalAmount),
    paidAmount,
    remainingAmount: Number(b.totalAmount) - paidAmount,
    installments: b.instalmentCount,
    paidInstallments: paidInst.length,
    nextDueDate: nextDue?.dueDate?.split('T')[0] ?? null,
    status: statusMap[b.status],
    interestRate: Number(b.interestRate),
    startDate: b.createdAt?.split('T')[0] ?? '',
    score: 0,
  };
}

export interface Paginated<T> { items: T[]; total: number; page: number; limit: number }
