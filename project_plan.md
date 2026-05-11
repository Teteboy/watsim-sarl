**WATSIM** est une plateforme fintech de type **Buy Now Pay Later (BNPL)** conçue pour le marché de l'Afrique centrale (Cameroun en priorité). Elle permet aux utilisateurs d'acheter immédiatement auprès de commerciaux partenaires et de rembourser en plusieurs échéances flexibles, tout en intégrant un portefeuille électronique sécurisé, un scoring de crédit et des fonctionnalités avancées de commerce digital.

**Cible** : Consommateurs camerounais, commerciaux partenaires, équipes administratives WATSIM.

## 2. Architecture du Système

### Modules Principaux

#### Landing Page
- Section Héro avec CTA
- Features BNPL
- Stats / Social Proof
- Témoignages
- FAQ
- Section partenaires / commerciaux

#### Interface Administrateur
- Dashboard global avec KPIs
- `/admin/merchants` — Gestion des commerciaux
- `/admin/products` — Catalogue & gestion produits
- `/admin/reports` — Rapports & analyses
- `/admin/settings` — Paramètres système

#### Interface Commercial
- `/merchant` — Dashboard commercial (ventes, commandes, paiements)
- `/merchant/products` — Gestion des produits
- `/merchant/orders` — Suivi des commandes
- `/merchant/profile` — Profil et paramètres

#### Auth & Sécurité
- `/login` — Connexion administrateur / commercial
- Authentification sécurisée
- Rôles et permissions

## 3. Technologies
- **Frontend** : React + TypeScript + Tailwind CSS + Vite
- **Backend** : Supabase (Auth + Database + Edge Functions)
- **Icons** : FontAwesome + Remix Icon
- **Charts** : Recharts (dashboard)

## 4. Structure de Données

### Collections Supabase Principales

#### Users
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Identifiant unique |
| email | string | Email utilisateur |
| role | enum | `admin`, `merchant`, `user` |
| kyc_status | enum | `pending`, `verified`, `rejected` |
| credit_score | int | Score de crédit (0-100) |
| credit_limit | int | Plafond BNPL (FCFA) |
| wallet_balance | int | Solde portefeuille |

#### Merchants
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Identifiant |
| business_name | string | Nom de l'entreprise |
| owner_name | string | Nom du propriétaire |
| email | string | Email commercial |
| phone | string | Téléphone |
| category | string | Secteur d'activité |
| city | string | Ville |
| status | enum | `active`, `pending`, `suspended` |
| verified | boolean | KYC validé |
| products_count | int | Nombre de produits |
| revenue | int | Revenus totaux |

#### Products
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Identifiant |
| name | string | Nom du produit |
| merchant_id | string | Référence commercial |
| category | string | Catégorie |
| price | int | Prix (FCFA) |
| stock | int | Quantité en stock |
| status | enum | `active`, `out_of_stock`, `inactive` |
| bnpl_eligible | boolean | Éligible au BNPL |
| image_url | string | URL image |

#### Transactions
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Identifiant |
| user_id | uuid | Référence utilisateur |
| merchant_id | uuid | Référence commercial |
| type | enum | `purchase`, `repayment`, `deposit`, `withdrawal` |
| amount | int | Montant (FCFA) |
| status | enum | `pending`, `completed`, `failed` |
| payment_method | string | Moyen de paiement |

## 5. Plan de Développement

### Phase 1 : Landing Page + Auth
- [x] Design landing page (Hero, Features, Stats, Testimonials, FAQ)
- [x] Formulaire de partenariat commercial
- [x] Système d'authentification (admin + commercial)
- [x] Navigation et routing

### Phase 2 : Interface Administrateur
- [x] Dashboard admin avec KPIs
- [x] Gestion utilisateurs et KYC
- [x] Gestion commerciaux partenaires
- [x] Catalogue produits
- [ ] Rapports et analyses
- [ ] Gestion publicités & promotions

### Phase 3 : Core BNPL
- [ ] Simulateur de crédit
- [ ] Processus d'achat BNPL
- [ ] Suivi des remboursements
- [ ] Scoring de crédit
- [ ] Notifications push/email

### Phase 4 : Interface Commercial
- **Objectif** : Dashboard et gestion produits/commandes pour les commerciaux
- [ ] Dashboard commercial avec KPIs
- [ ] Gestion catalogue produits
- [ ] Suivi des commandes et paiements
- [ ] Profil et paramètres
- [ ] Rapports de ventes

## 6. Contraintes & Notes
- Support **mobile-first** pour les utilisateurs finaux
- **Orange Money** et **MTN MoMo** comme moyens de paiement principaux
- **Compliance OHADA** pour les aspects financiers
- **RGPD** pour la gestion des données personnelles
- **Français** comme langue principale (i18n futur pour l'anglais)
- Design system : couleurs sombres avec accents or (#D4AF37)

## 7. Next Steps
1. Finaliser l'interface admin (rapports, publicités)
2. Implémenter la logique métier BNPL
3. Développer l'espace commercial
4. Connecter APIs de paiement (Orange Money, MTN MoMo)
5. Tests et déploiement