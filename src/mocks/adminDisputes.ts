export const adminDisputes = [
  { id: 'DSP-001', type: 'fraud', user: 'Fouda Sylvie', userId: 'USR-004', description: 'Tentative de connexion depuis 3 pays différents en 2h', amount: 0, status: 'open', priority: 'high', createdAt: '2026-04-27 14:05', assignedTo: 'Agent Sécurité 1' },
  { id: 'DSP-002', type: 'dispute', user: 'Nkeng Boris', userId: 'USR-007', description: 'Produit reçu non conforme à la description — Ensemble tenue de soirée', amount: 95000, status: 'in_progress', priority: 'medium', createdAt: '2026-04-26 10:30', assignedTo: 'Agent Support 2' },
  { id: 'DSP-003', type: 'fraud', user: 'Ateba Christelle', userId: 'USR-012', description: 'Documents KYC falsifiés détectés par le système IA', amount: 0, status: 'resolved', priority: 'high', createdAt: '2026-04-25 16:20', assignedTo: 'Agent Sécurité 1' },
  { id: 'DSP-004', type: 'dispute', user: 'Mbassi Hortense', userId: 'USR-010', description: 'Remboursement BNPL prélevé deux fois le même jour', amount: 27300, status: 'open', priority: 'high', createdAt: '2026-04-25 09:15', assignedTo: null },
  { id: 'DSP-005', type: 'dispute', user: 'Talla Rodrigue', userId: 'USR-005', description: 'Livraison non effectuée mais commande marquée comme livrée', amount: 295000, status: 'in_progress', priority: 'medium', createdAt: '2026-04-24 14:45', assignedTo: 'Agent Support 3' },
  { id: 'DSP-006', type: 'fraud', user: 'Inconnu', userId: null, description: 'Pic de transactions suspectes depuis IP 197.234.x.x — Région Douala', amount: 450000, status: 'open', priority: 'high', createdAt: '2026-04-24 08:00', assignedTo: 'Agent Sécurité 2' },
  { id: 'DSP-007', type: 'dispute', user: 'Kouam Jean-Baptiste', userId: 'USR-001', description: 'Frais BNPL incorrectement calculés sur commande #BNP-4521', amount: 9250, status: 'resolved', priority: 'low', createdAt: '2026-04-23 11:30', assignedTo: 'Agent Support 1' },
];

export const fraudAlerts = [
  { id: 'FRD-001', severity: 'critical', message: 'Compte USR-089 — 12 tentatives de connexion échouées', time: '5 min', status: 'active' },
  { id: 'FRD-002', severity: 'high', message: 'Transaction TXN-78901 — Montant inhabituel pour profil USR-001', time: '32 min', status: 'active' },
  { id: 'FRD-003', severity: 'medium', message: 'Nouveau device détecté pour USR-003 — Vérification requise', time: '1h 15min', status: 'acknowledged' },
  { id: 'FRD-004', severity: 'high', message: 'Tentative de modification KYC suspecte — USR-012', time: '2h', status: 'resolved' },
  { id: 'FRD-005', severity: 'low', message: 'Score crédit USR-010 en baisse rapide — Surveillance activée', time: '3h', status: 'acknowledged' },
];
