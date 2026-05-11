export const merchantProfile = {
  id: 'MCH-001',
  name: 'TechShop Yaoundé',
  owner: 'Mvondo Pierre',
  email: 'contact@techshop-yaounde.cm',
  phone: '+237 6 91 11 22 33',
  category: 'Électronique',
  city: 'Yaoundé',
  address: 'Avenue Kennedy, Quartier Bastos, Yaoundé',
  status: 'active',
  verified: true,
  joinedAt: '2024-06-15',
  rating: 4.8,
  totalReviews: 312,
  logo: 'https://readdy.ai/api/search-image?query=modern%20tech%20electronics%20store%20logo%20icon%20minimal%20clean%20design%20dark%20background%20gold%20accent%20professional%20branding&width=80&height=80&seq=mchlogo001&orientation=squarish',
  walletBalance: 4850000,
  pendingPayout: 1240000,
  totalRevenue: 45600000,
  totalOrders: 1240,
  totalProducts: 142,
  bnplRevenue: 18200000,
  conversionRate: 68,
  avgOrderValue: 36774,
};

export const merchantStats = {
  revenueThisMonth: 4850000,
  revenueLastMonth: 4120000,
  ordersThisMonth: 134,
  ordersLastMonth: 118,
  newCustomers: 47,
  returningCustomers: 87,
  bnplOrdersThisMonth: 62,
  bnplRevenueThisMonth: 2340000,
  pendingOrders: 18,
  completedOrders: 112,
  cancelledOrders: 4,
  avgRating: 4.8,
};

export const merchantRevenueChart = [
  { month: 'Jan', revenue: 2800000, orders: 78, bnpl: 980000 },
  { month: 'Fév', revenue: 3100000, orders: 89, bnpl: 1200000 },
  { month: 'Mar', revenue: 2950000, orders: 82, bnpl: 1050000 },
  { month: 'Avr', revenue: 3400000, orders: 95, bnpl: 1380000 },
  { month: 'Mai', revenue: 3750000, orders: 104, bnpl: 1520000 },
  { month: 'Jun', revenue: 4100000, orders: 112, bnpl: 1680000 },
  { month: 'Jul', revenue: 3900000, orders: 108, bnpl: 1590000 },
  { month: 'Aoû', revenue: 4300000, orders: 119, bnpl: 1750000 },
  { month: 'Sep', revenue: 4120000, orders: 115, bnpl: 1640000 },
  { month: 'Oct', revenue: 4580000, orders: 127, bnpl: 1890000 },
  { month: 'Nov', revenue: 4120000, orders: 118, bnpl: 1720000 },
  { month: 'Déc', revenue: 4850000, orders: 134, bnpl: 2340000 },
];

export const merchantProducts = [
  { id: 'PRD-001', name: 'Samsung Galaxy A55', category: 'Smartphones', price: 185000, stock: 24, sold: 312, status: 'active', bnplEligible: true, views: 1840, rating: 4.7, image: 'https://readdy.ai/api/search-image?query=Samsung%20Galaxy%20A55%20smartphone%20clean%20white%20background%20product%20photography%20professional%20studio%20lighting%20minimal&width=80&height=80&seq=mprd001&orientation=squarish' },
  { id: 'PRD-002', name: 'iPhone 15 Pro', category: 'Smartphones', price: 620000, stock: 8, sold: 89, status: 'active', bnplEligible: true, views: 3210, rating: 4.9, image: 'https://readdy.ai/api/search-image?query=iPhone%2015%20Pro%20titanium%20smartphone%20product%20photography%20white%20background%20studio%20minimal%20clean&width=80&height=80&seq=mprd002&orientation=squarish' },
  { id: 'PRD-003', name: 'MacBook Air M2', category: 'Ordinateurs', price: 420000, stock: 5, sold: 45, status: 'active', bnplEligible: true, views: 2100, rating: 4.8, image: 'https://readdy.ai/api/search-image?query=MacBook%20Air%20M2%20laptop%20silver%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd003&orientation=squarish' },
  { id: 'PRD-004', name: 'Réfrigérateur Samsung 350L', category: 'Électroménager', price: 350000, stock: 12, sold: 67, status: 'active', bnplEligible: true, views: 980, rating: 4.6, image: 'https://readdy.ai/api/search-image?query=Samsung%20refrigerator%20350L%20stainless%20steel%20product%20photography%20white%20background%20studio%20clean&width=80&height=80&seq=mprd004&orientation=squarish' },
  { id: 'PRD-005', name: 'Tablette iPad Air', category: 'Tablettes', price: 250000, stock: 0, sold: 156, status: 'out_of_stock', bnplEligible: true, views: 1560, rating: 4.7, image: 'https://readdy.ai/api/search-image?query=iPad%20Air%20tablet%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd005&orientation=squarish' },
  { id: 'PRD-006', name: 'Sony WH-1000XM5', category: 'Audio', price: 145000, stock: 18, sold: 203, status: 'active', bnplEligible: true, views: 2340, rating: 4.8, image: 'https://readdy.ai/api/search-image?query=Sony%20WH-1000XM5%20wireless%20headphones%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd006&orientation=squarish' },
  { id: 'PRD-007', name: 'Écran LG 27" 4K', category: 'Moniteurs', price: 195000, stock: 9, sold: 78, status: 'active', bnplEligible: true, views: 1120, rating: 4.5, image: 'https://readdy.ai/api/search-image?query=LG%2027%20inch%204K%20monitor%20display%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd007&orientation=squarish' },
  { id: 'PRD-008', name: 'Clavier Logitech MX Keys', category: 'Accessoires', price: 65000, stock: 35, sold: 289, status: 'active', bnplEligible: false, views: 890, rating: 4.6, image: 'https://readdy.ai/api/search-image?query=Logitech%20MX%20Keys%20wireless%20keyboard%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd008&orientation=squarish' },
  { id: 'PRD-009', name: 'DJI Mini 4 Pro', category: 'Drones', price: 480000, stock: 3, sold: 22, status: 'active', bnplEligible: true, views: 3450, rating: 4.9, image: 'https://readdy.ai/api/search-image?query=DJI%20Mini%204%20Pro%20drone%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd009&orientation=squarish' },
  { id: 'PRD-010', name: 'Imprimante HP LaserJet', category: 'Bureautique', price: 125000, stock: 7, sold: 54, status: 'active', bnplEligible: false, views: 670, rating: 4.3, image: 'https://readdy.ai/api/search-image?query=HP%20LaserJet%20printer%20product%20photography%20white%20background%20studio%20clean%20minimal&width=80&height=80&seq=mprd010&orientation=squarish' },
];

export const merchantOrders = [
  { id: 'ORD-7841', customer: 'Alima Bello', phone: '+237 6 70 11 22 33', product: 'iPhone 15 Pro', quantity: 1, amount: 620000, paymentMethod: 'BNPL', status: 'completed', date: '2024-12-27', deliveryDate: '2024-12-29', city: 'Yaoundé' },
  { id: 'ORD-7840', customer: 'Jean-Paul Mbarga', phone: '+237 6 82 33 44 55', product: 'MacBook Air M2', quantity: 1, amount: 420000, paymentMethod: 'BNPL', status: 'processing', date: '2024-12-27', deliveryDate: null, city: 'Douala' },
  { id: 'ORD-7839', customer: 'Fatima Oumarou', phone: '+237 6 91 55 66 77', product: 'Samsung Galaxy A55', quantity: 2, amount: 370000, paymentMethod: 'Wallet', status: 'completed', date: '2024-12-26', deliveryDate: '2024-12-28', city: 'Yaoundé' },
  { id: 'ORD-7838', customer: 'Rodrigue Nkeng', phone: '+237 6 74 77 88 99', product: 'Sony WH-1000XM5', quantity: 1, amount: 145000, paymentMethod: 'Wallet', status: 'shipped', date: '2024-12-26', deliveryDate: null, city: 'Bafoussam' },
  { id: 'ORD-7837', customer: 'Cécile Atangana', phone: '+237 6 55 99 00 11', product: 'DJI Mini 4 Pro', quantity: 1, amount: 480000, paymentMethod: 'BNPL', status: 'pending', date: '2024-12-25', deliveryDate: null, city: 'Yaoundé' },
  { id: 'ORD-7836', customer: 'Ibrahim Moussa', phone: '+237 6 61 22 33 44', product: 'Écran LG 27" 4K', quantity: 1, amount: 195000, paymentMethod: 'BNPL', status: 'completed', date: '2024-12-25', deliveryDate: '2024-12-27', city: 'Garoua' },
  { id: 'ORD-7835', customer: 'Nadège Fouda', phone: '+237 6 93 44 55 66', product: 'Clavier Logitech MX Keys', quantity: 3, amount: 195000, paymentMethod: 'Wallet', status: 'completed', date: '2024-12-24', deliveryDate: '2024-12-26', city: 'Douala' },
  { id: 'ORD-7834', customer: 'Serge Biyong', phone: '+237 6 77 66 55 44', product: 'Réfrigérateur Samsung 350L', quantity: 1, amount: 350000, paymentMethod: 'BNPL', status: 'cancelled', date: '2024-12-24', deliveryDate: null, city: 'Yaoundé' },
  { id: 'ORD-7833', customer: 'Marthe Essomba', phone: '+237 6 82 88 99 00', product: 'Imprimante HP LaserJet', quantity: 1, amount: 125000, paymentMethod: 'Wallet', status: 'shipped', date: '2024-12-23', deliveryDate: null, city: 'Ebolowa' },
  { id: 'ORD-7832', customer: 'Patrick Ndi', phone: '+237 6 70 00 11 22', product: 'Samsung Galaxy A55', quantity: 1, amount: 185000, paymentMethod: 'BNPL', status: 'completed', date: '2024-12-23', deliveryDate: '2024-12-25', city: 'Douala' },
  { id: 'ORD-7831', customer: 'Yvonne Mbassi', phone: '+237 6 91 33 44 55', product: 'MacBook Air M2', quantity: 1, amount: 420000, paymentMethod: 'BNPL', status: 'processing', date: '2024-12-22', deliveryDate: null, city: 'Yaoundé' },
  { id: 'ORD-7830', customer: 'Thierry Kamga', phone: '+237 6 74 55 66 77', product: 'iPhone 15 Pro', quantity: 1, amount: 620000, paymentMethod: 'BNPL', status: 'completed', date: '2024-12-22', deliveryDate: '2024-12-24', city: 'Bafoussam' },
];

export const merchantBnplPayments = [
  { id: 'BNPL-4421', customer: 'Alima Bello', product: 'iPhone 15 Pro', totalAmount: 620000, paidAmount: 413334, remainingAmount: 206666, installments: 3, paidInstallments: 2, nextDueDate: '2025-01-27', status: 'active', creditScore: 742, orderId: 'ORD-7841' },
  { id: 'BNPL-4420', customer: 'Jean-Paul Mbarga', product: 'MacBook Air M2', totalAmount: 420000, paidAmount: 140000, remainingAmount: 280000, installments: 3, paidInstallments: 1, nextDueDate: '2025-01-15', status: 'active', creditScore: 698, orderId: 'ORD-7840' },
  { id: 'BNPL-4419', customer: 'Cécile Atangana', product: 'DJI Mini 4 Pro', totalAmount: 480000, paidAmount: 0, remainingAmount: 480000, installments: 3, paidInstallments: 0, nextDueDate: '2025-01-25', status: 'pending', creditScore: 715, orderId: 'ORD-7837' },
  { id: 'BNPL-4418', customer: 'Ibrahim Moussa', product: 'Écran LG 27" 4K', totalAmount: 195000, paidAmount: 195000, remainingAmount: 0, installments: 2, paidInstallments: 2, nextDueDate: null, status: 'completed', creditScore: 780, orderId: 'ORD-7836' },
  { id: 'BNPL-4417', customer: 'Patrick Ndi', product: 'Samsung Galaxy A55', totalAmount: 185000, paidAmount: 92500, remainingAmount: 92500, installments: 2, paidInstallments: 1, nextDueDate: '2025-01-10', status: 'active', creditScore: 661, orderId: 'ORD-7832' },
  { id: 'BNPL-4416', customer: 'Yvonne Mbassi', product: 'MacBook Air M2', totalAmount: 420000, paidAmount: 140000, remainingAmount: 280000, installments: 3, paidInstallments: 1, nextDueDate: '2024-12-20', status: 'overdue', creditScore: 589, orderId: 'ORD-7831' },
  { id: 'BNPL-4415', customer: 'Thierry Kamga', product: 'iPhone 15 Pro', totalAmount: 620000, paidAmount: 620000, remainingAmount: 0, installments: 3, paidInstallments: 3, nextDueDate: null, status: 'completed', creditScore: 810, orderId: 'ORD-7830' },
  { id: 'BNPL-4414', customer: 'Rodrigue Nkeng', product: 'Sony WH-1000XM5', totalAmount: 145000, paidAmount: 48334, remainingAmount: 96666, installments: 3, paidInstallments: 1, nextDueDate: '2025-01-26', status: 'active', creditScore: 703, orderId: 'ORD-7838' },
];

export const merchantPayouts = [
  { id: 'PAY-2201', amount: 1850000, status: 'completed', date: '2024-12-15', method: 'MTN Mobile Money', reference: 'MTN-8821-XXXX' },
  { id: 'PAY-2200', amount: 2100000, status: 'completed', date: '2024-11-30', method: 'Orange Money', reference: 'OM-7712-XXXX' },
  { id: 'PAY-2199', amount: 1640000, status: 'completed', date: '2024-11-15', method: 'MTN Mobile Money', reference: 'MTN-6603-XXXX' },
  { id: 'PAY-2198', amount: 1240000, status: 'pending', date: '2024-12-31', method: 'MTN Mobile Money', reference: null },
];
