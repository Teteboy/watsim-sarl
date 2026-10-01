# WATSIM - Buy Now Pay Later (BNPL) Platform

**WATSIM** est une plateforme fintech de type **Buy Now Pay Later (BNPL)** conçue pour le marché de l'Afrique centrale (Cameroun en priorité). Elle permet aux utilisateurs d'acheter immédiatement auprès de commerciaux partenaires et de rembourser en plusieurs échéances flexibles, tout en intégrant un portefeuille électronique sécurisé, un scoring de crédit et des fonctionnalités avancées de commerce digital.

## Fonctionnalités Principales

- **Achat Immédiat, Paiement Flexibles** : BNPL avec remboursements échelonnés
- **Portefeuille Électronique** : Gestion sécurisée des fonds
- **Scoring de Crédit** : Évaluation automatique des risques
- **Interfaces Multi-Rôles** :
  - Landing Page publique
  - Dashboard Administrateur
  - Espace Commercial pour les partenaires

## Technologies Utilisées

- **Frontend (web)** : React 19 + TypeScript + Tailwind CSS + Vite
- **Mobile app** : Flutter (`Watsim-app/`) — Android & iOS
- **Backend** : Fastify + Prisma + PostgreSQL + Redis (BullMQ) — `backend/`
- **Paiements** : MTN MoMo, Orange Money, Campay
- **Icons** : FontAwesome + Remix Icon
- **Charts** : Recharts

> Authentification : connexion par téléphone + PIN (mobile) ou email + mot de passe (web/admin). Aucune étape OTP — la réinitialisation du PIN passe par le support (reset via panneau admin).

## Installation et Démarrage

1. **Cloner le repository** :
   ```bash
   git clone https://github.com/Teteboy/watsim-sarl.git
   cd watsim-sarl
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Démarrer le serveur de développement** :
   ```bash
   npm run dev
   ```

4. **Accéder à l'application** :
   Ouvrez [http://localhost:5173](http://localhost:5173) dans votre navigateur.

## Structure du Projet

- `src/pages/home/` - Landing Page et composants publics
- `src/pages/admin/` - Interface administrateur
- `src/pages/merchant/` - Espace commercial
- `src/components/` - Composants réutilisables
- `src/mocks/` - Données de test

## Phases de Développement

### Phase 1 ✅ : Landing Page + Auth
- Design landing page complet
- Système d'authentification
- Navigation et routing

### Phase 2 ✅ : Interface Administrateur
- Dashboard avec KPIs
- Gestion utilisateurs et commerciaux
- Catalogue produits

### Phase 3 🔄 : Core BNPL
- Simulateur de crédit
- Processus d'achat BNPL
- Suivi des remboursements

### Phase 4 🔄 : Interface Commercial
- Dashboard commercial
- Gestion produits et commandes

## Contribution

Les contributions sont les bienvenues ! Veuillez suivre ces étapes :

1. Fork le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Contact

Pour plus d'informations, contactez l'équipe WATSIM.

---

*Détails complets du projet disponibles dans [`project_plan.md`](project_plan.md)*</content>
<parameter name="filePath">README.md