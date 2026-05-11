export const adminTransactions = [
  { id: 'TXN-78901', user: 'Kouam Jean-Baptiste', userId: 'USR-001', type: 'bnpl_purchase', amount: 185000, status: 'completed', merchant: 'TechShop Yaoundé', date: '2026-04-27 14:32', method: 'BNPL', description: 'Samsung Galaxy A55' },
  { id: 'TXN-78900', user: 'Mbarga Alain', userId: 'USR-003', type: 'wallet_deposit', amount: 50000, status: 'completed', merchant: 'MTN MoMo', date: '2026-04-27 13:15', method: 'Mobile Money', description: 'Dépôt wallet' },
  { id: 'TXN-78899', user: 'Essomba Patricia', userId: 'USR-006', type: 'repayment', amount: 62500, status: 'completed', merchant: 'WATSIM', date: '2026-04-27 11:48', method: 'Wallet', description: 'Remboursement BNPL #BNP-4521' },
  { id: 'TXN-78898', user: 'Talla Rodrigue', userId: 'USR-005', type: 'transfer', amount: 25000, status: 'completed', merchant: 'Ngo Biyong Carine', date: '2026-04-27 10:22', method: 'Wallet', description: 'Transfert entre utilisateurs' },
  { id: 'TXN-78897', user: 'Nkeng Boris', userId: 'USR-007', type: 'bnpl_purchase', amount: 95000, status: 'pending', merchant: 'Fashion House Douala', date: '2026-04-27 09:55', method: 'BNPL', description: 'Ensemble tenue de soirée' },
  { id: 'TXN-78896', user: 'Bello Aminatou', userId: 'USR-008', type: 'wallet_withdrawal', amount: 30000, status: 'completed', merchant: 'Orange Money', date: '2026-04-27 09:10', method: 'Mobile Money', description: 'Retrait vers Orange Money' },
  { id: 'TXN-78895', user: 'Tchamba Eric', userId: 'USR-009', type: 'bnpl_purchase', amount: 420000, status: 'completed', merchant: 'TechShop Yaoundé', date: '2026-04-26 18:45', method: 'BNPL', description: 'MacBook Air M2' },
  { id: 'TXN-78894', user: 'Fouda Sylvie', userId: 'USR-004', type: 'wallet_deposit', amount: 15000, status: 'failed', merchant: 'MTN MoMo', date: '2026-04-26 17:30', method: 'Mobile Money', description: 'Dépôt échoué - solde insuffisant' },
  { id: 'TXN-78893', user: 'Ngono Paul', userId: 'USR-011', type: 'repayment', amount: 45000, status: 'completed', merchant: 'WATSIM', date: '2026-04-26 16:20', method: 'Wallet', description: 'Remboursement BNPL #BNP-4498' },
  { id: 'TXN-78892', user: 'Mbassi Hortense', userId: 'USR-010', type: 'bnpl_purchase', amount: 78000, status: 'completed', merchant: 'PharmaCare Santé', date: '2026-04-26 15:05', method: 'BNPL', description: 'Produits cosmétiques premium' },
  { id: 'TXN-78891', user: 'Kouam Jean-Baptiste', userId: 'USR-001', type: 'transfer', amount: 10000, status: 'completed', merchant: 'Talla Rodrigue', date: '2026-04-26 14:00', method: 'Wallet', description: 'Transfert personnel' },
  { id: 'TXN-78890', user: 'Ateba Christelle', userId: 'USR-012', type: 'wallet_deposit', amount: 5000, status: 'completed', merchant: 'Orange Money', date: '2026-04-26 12:30', method: 'Mobile Money', description: 'Dépôt wallet' },
];

export const transactionTypes = [
  { value: 'all', label: 'Tous les types' },
  { value: 'bnpl_purchase', label: 'Achat BNPL' },
  { value: 'wallet_deposit', label: 'Dépôt Wallet' },
  { value: 'wallet_withdrawal', label: 'Retrait Wallet' },
  { value: 'transfer', label: 'Transfert' },
  { value: 'repayment', label: 'Remboursement' },
];
