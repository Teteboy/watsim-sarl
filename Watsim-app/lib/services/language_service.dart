import 'package:flutter/material.dart';

// ─── Language Service (InheritedWidget + ChangeNotifier) ──────────────────
class LanguageService extends ChangeNotifier {
  static final LanguageService _instance = LanguageService._internal();
  factory LanguageService() => _instance;
  LanguageService._internal();

  bool _isFrench = true;
  bool get isFrench => _isFrench;

  void toggle() {
    _isFrench = !_isFrench;
    notifyListeners();
  }

  String get languageLabel => _isFrench ? 'Français' : 'English';

  // ── Profile screen strings ──────────────────────────────────────────────
  String get creditScore => _isFrench ? 'Score de crédit' : 'Credit Score';
  String get excellent => _isFrench ? 'Excellent' : 'Excellent';
  String get bnplLimit => _isFrench ? 'Limite BNPL' : 'BNPL Limit';
  String get bnplUsed => _isFrench
      ? '75 000 FCFA utilisés sur 150 000 FCFA'
      : '75,000 FCFA used of 150,000 FCFA';
  String get accountBenefits =>
      _isFrench ? 'Compte & Avantages' : 'Account & Benefits';
  String get myReferrals => _isFrench ? 'Mes Parrainages' : 'My Referrals';
  String get referralCode =>
      _isFrench ? 'Code : WATSIM-789' : 'Code: WATSIM-789';
  String get rewardsCashback =>
      _isFrench ? 'Récompenses & Cashback' : 'Rewards & Cashback';
  String get rewardsAvailable =>
      _isFrench ? '3 200 FCFA disponibles' : '3,200 FCFA available';
  String get settings => _isFrench ? 'Paramètres' : 'Settings';
  String get myAccount => _isFrench ? 'Mon Compte' : 'My Account';
  String get notifications => _isFrench ? 'Notifications' : 'Notifications';
  String get language => _isFrench ? 'Langue' : 'Language';
  String get security => _isFrench ? 'Sécurité' : 'Security';
  String get securitySubtitle =>
      _isFrench ? 'PIN, Biométrie, 2FA' : 'PIN, Biometrics, 2FA';
  String get support => _isFrench ? 'Assistance' : 'Support';
  String get helpSupport => _isFrench ? 'Aide & Assistance' : 'Help & Support';
  String get about => _isFrench ? 'À propos' : 'About';
  String get version => _isFrench ? 'Version 1.0.0' : 'Version 1.0.0';
  String get signOut => _isFrench ? 'Se déconnecter' : 'Sign Out';
  String get identityVerified =>
      _isFrench ? 'Identité vérifiée' : 'Identity Verified';
  String get signOutConfirmTitle => _isFrench ? 'Se déconnecter' : 'Sign Out';
  String get signOutConfirmBody => _isFrench
      ? 'Êtes-vous sûr de vouloir vous déconnecter ?'
      : 'Are you sure you want to sign out?';
  String get cancel => _isFrench ? 'Annuler' : 'Cancel';

  // BNPL credit strings
  String get bnplCredit => _isFrench ? 'Crédit BNPL' : 'BNPL Credit';
  String get active => _isFrench ? 'ACTIF' : 'ACTIVE';
  String get overLimit => _isFrench ? 'DÉPASSÉ' : 'OVER LIMIT';
  String get availableCredit =>
      _isFrench ? 'Votre crédit disponible est' : 'Your available credit is';
  String get shopInstallments => _isFrench
      ? 'Achetez maintenant et payez en plusieurs fois'
      : 'Shop now and pay in instalments';
  String get aboveLimit => _isFrench
      ? 'Vous dépassez votre limite de crédit disponible'
      : 'This is above your available credit limit';
  String get usedPercent => _isFrench ? '% Utilisé' : '% Used';
  String get fcfaRemaining => _isFrench ? 'FCFA restants' : 'FCFA remaining';
  String get repayCredit => _isFrench
      ? 'Remboursez pour restaurer votre crédit'
      : 'Repay to restore your credit';
  String get tapShopBnpl =>
      _isFrench ? 'Appuyez pour acheter avec BNPL' : 'Tap to shop on BNPL';

  // ── Account edit strings ────────────────────────────────────────────────
  String get myAccountTitle => _isFrench ? 'Mon Compte' : 'My Account';
  String get firstName => _isFrench ? 'Prénom' : 'First Name';
  String get lastName => _isFrench ? 'Nom de famille' : 'Last Name';
  String get phoneNumber => _isFrench ? 'Numéro de téléphone' : 'Phone Number';
  String get email => _isFrench ? 'E-mail' : 'Email';
  String get city => _isFrench ? 'Ville' : 'City';
  String get saveChanges => _isFrench ? 'Enregistrer' : 'Save Changes';
  String get profileUpdated =>
      _isFrench ? 'Profil mis à jour' : 'Profile updated';

  // ── Referral screen strings ─────────────────────────────────────────────
  String get referrals => _isFrench ? 'Parrainages' : 'Referrals';
  String get referFriends =>
      _isFrench ? 'Parrainez vos amis' : 'Refer your friends';
  String get referSubtitle => _isFrench
      ? 'Gagnez 2 000 FCFA par parrainage actif'
      : 'Earn 2,000 FCFA for every active referral';
  String get yourReferralCode =>
      _isFrench ? 'VOTRE CODE DE PARRAINAGE' : 'YOUR REFERRAL CODE';
  String get copy => _isFrench ? 'Copier' : 'Copy';
  String get share => _isFrench ? 'Partager' : 'Share';
  String get codeCopied => _isFrench ? 'Code copié !' : 'Code copied!';
  String get invitedReferrals =>
      _isFrench ? 'Parrainages\ninvités' : 'Invited\nreferrals';
  String get activeReferrals =>
      _isFrench ? 'Parrainages\nactifs' : 'Active\nreferrals';
  String get totalEarned =>
      _isFrench ? 'Total\ngagné (F)' : 'Total\nearned (F)';
  String get recentReferrals =>
      _isFrench ? 'Parrainages récents' : 'Recent Referrals';
  String get viewAll => _isFrench ? 'Voir tout' : 'View all';
  String get showLess => _isFrench ? 'Voir moins' : 'Show less';
  String get noReferralsYet =>
      _isFrench ? 'Aucun parrainage pour l\'instant' : 'No referrals yet';
  String get noReferralsBody => _isFrench
      ? 'Partagez votre code et gagnez 2 000 FCFA\npour chaque ami qui s\'inscrit !'
      : 'Share your code and earn 2,000 FCFA\nfor every friend who joins!';
  String get referAndEarn =>
      _isFrench ? 'Parrainer & Gagner' : 'Refer & Earn Bonus';
  String get howItWorks => _isFrench ? 'Comment ça marche' : 'How it works';
  String get step1 => _isFrench
      ? 'Partagez votre code avec vos amis'
      : 'Share your code with friends';
  String get step2 => _isFrench
      ? 'Ils s\'inscrivent avec votre code'
      : 'They sign up using your code';
  String get step3 => _isFrench
      ? 'Ils effectuent leur premier achat BNPL'
      : 'They complete their first BNPL purchase';
  String get step4 => _isFrench
      ? 'Vous gagnez instantanément 2 000 FCFA !'
      : 'You instantly earn 2,000 FCFA!';

  // ── Rewards screen strings ──────────────────────────────────────────────
  String get rewardsCashbackTitle =>
      _isFrench ? 'Récompenses & Cashback' : 'Rewards & Cashback';
  String get availableCashback =>
      _isFrench ? 'Cashback disponible' : 'Available Cashback';
  String get cashbackBreakdown => _isFrench
      ? '+2 000 FCFA bonus parrainage\n+1 200 FCFA récompenses achats'
      : '+2,000 FCFA referral bonus\n+1,200 FCFA purchase rewards';
  String get convertBalance =>
      _isFrench ? 'Convertir en solde Watsim' : 'Convert to Watsim Balance';
  String get cashbackHistory =>
      _isFrench ? 'Historique Cashback' : 'Cashback History';
  String get myBadges => _isFrench ? 'Mes Badges' : 'My Badges';
  String get noRewardsYet =>
      _isFrench ? 'Aucune récompense pour l\'instant' : 'No rewards yet';
  String get noRewardsBody => _isFrench
      ? 'Effectuez des achats et parrainez des amis\npour gagner du cashback !'
      : 'Make purchases and refer friends\nto start earning cashback!';
  String get startShopping =>
      _isFrench ? 'Commencer à acheter' : 'Start Shopping';

  // Cashback converted strings
  String get cashbackConverted => _isFrench
      ? 'Cashback converti avec succès !'
      : 'Cashback converted successfully!';
  String get addedToWallet => _isFrench
      ? 'ajouté à votre portefeuille Watsim'
      : 'added to your Watsim wallet';
  String get noCashbackToConvert =>
      _isFrench ? 'Aucun cashback à convertir' : 'No cashback to convert';

  // ── Withdrawal strings ──────────────────────────────────────────────────
  String get withdrawRewards =>
      _isFrench ? 'Retirer les récompenses' : 'Withdraw Rewards';
  String get withdrawTitle =>
      _isFrench ? 'Retrait des récompenses' : 'Withdraw Rewards';
  String get withdrawSubtitle => _isFrench
      ? 'Retirez vos récompenses et cashback vers votre mobile money'
      : 'Withdraw your rewards & cashback to mobile money';
  String get withdrawMethod =>
      _isFrench ? 'Méthode de retrait' : 'Withdrawal Method';
  String get mobileNumber =>
      _isFrench ? 'Numéro Mobile Money' : 'Mobile Money Number';
  String get withdrawAmount =>
      _isFrench ? 'Montant à retirer (FCFA)' : 'Amount to Withdraw (FCFA)';
  String get withdrawAll => _isFrench ? 'Retirer tout' : 'Withdraw All';
  String get confirmWithdraw =>
      _isFrench ? 'Confirmer le retrait' : 'Confirm Withdrawal';
  String get withdrawSuccess => _isFrench
      ? 'Retrait initié avec succès !'
      : 'Withdrawal initiated successfully!';
  String get withdrawProcessing => _isFrench
      ? 'Votre retrait est en cours de traitement. Fonds disponibles sous 24h.'
      : 'Your withdrawal is being processed. Funds available within 24h.';
  String get invalidAmount => _isFrench ? 'Montant invalide' : 'Invalid amount';
  String get amountExceedsBalance => _isFrench
      ? 'Le montant dépasse votre solde disponible'
      : 'Amount exceeds your available balance';
  String get minWithdrawAmount => _isFrench
      ? 'Le montant minimum est 500 FCFA'
      : 'Minimum withdrawal is 500 FCFA';
  String get rewardsOnlyNote => _isFrench
      ? 'Seuls les récompenses et cashback peuvent être retirés. Les dépôts pour achats ne sont pas éligibles.'
      : 'Only rewards & cashback can be withdrawn. Deposits for purchases are not eligible.';
  String get selectMethod =>
      _isFrench ? 'Sélectionner une méthode' : 'Select a method';
  String get enterPhoneNumber =>
      _isFrench ? 'Ex: 670 123 456' : 'e.g. 670 123 456';
  String get processingFee =>
      _isFrench ? 'Frais de traitement' : 'Processing fee';
  String get free => _isFrench ? 'Gratuit' : 'Free';
  String get youWillReceive => _isFrench ? 'Vous recevrez' : 'You will receive';

  // Badge labels
  String get badgeFirstPurchase =>
      _isFrench ? 'Premier achat' : 'First Purchase';
  String get badgeActiveReferrer =>
      _isFrench ? 'Parrain actif' : 'Active Referrer';
  String get badgeKYC => _isFrench ? 'KYC vérifié' : 'KYC Verified';
  String get badgeTopSpender => _isFrench ? 'Gros dépensier' : 'Top Spender';
  String get badgeSuperActive => _isFrench ? 'Super actif' : 'Super Active';
  String get badgeVIP => 'VIP';

  // Security screen strings
  String get securityTitle => _isFrench ? 'Sécurité' : 'Security';
  String get accountSecured =>
      _isFrench ? 'Compte Sécurisé' : 'Account Secured';
  String get allSecurityActive => _isFrench
      ? 'Toutes les mesures de sécurité sont actives.'
      : 'All security measures are active.';
  String get authentication =>
      _isFrench ? 'AUTHENTIFICATION' : 'AUTHENTICATION';
  String get changePIN => _isFrench ? 'Changer le PIN' : 'Change PIN';
  String get changePINSubtitle => _isFrench
      ? 'Mettre à jour votre PIN de connexion'
      : 'Update your login PIN';
  String get biometrics => _isFrench ? 'Biométrie' : 'Biometrics';
  String get recentLabel => _isFrench ? 'RÉCENT' : 'RECENT';
  String get totalBalance => _isFrench ? 'SOLDE TOTAL' : 'TOTAL BALANCE';
  String get biometricsSubtitle =>
      _isFrench ? 'Empreinte digitale / Face ID' : 'Fingerprint / Face ID';
  String get twoFA =>
      _isFrench ? 'Authentification 2FA' : '2-Factor Authentication';
  String get twoFASubtitle =>
      _isFrench ? 'Code OTP par SMS' : 'OTP code via SMS';
  String get privacySection => _isFrench ? 'CONFIDENTIALITÉ' : 'PRIVACY';
  String get loginAlerts => _isFrench ? 'Alertes de connexion' : 'Login Alerts';
  String get loginAlertsSubtitle => _isFrench
      ? 'Recevoir des alertes pour les nouvelles connexions'
      : 'Get notified on new logins';
  String get transactionAlerts =>
      _isFrench ? 'Alertes de transaction' : 'Transaction Alerts';
  String get transactionAlertsSubtitle => _isFrench
      ? 'Notifications pour chaque transaction'
      : 'Notifications for every transaction';
  String get dangerZone => _isFrench ? 'ZONE DANGEREUSE' : 'DANGER ZONE';
  String get freezeAccount => _isFrench ? 'Geler le compte' : 'Freeze Account';
  String get freezeAccountSubtitle => _isFrench
      ? 'Suspendre temporairement toutes les transactions'
      : 'Temporarily suspend all transactions';
  String get frKey => 'FR';
  String get enKey => 'EN';

  // ── Splash screen strings ───────────────────────────────────────────────
  String get loadingUniverse => _isFrench
      ? 'Chargement de votre univers financier...'
      : 'Loading your financial universe...';
  String get trustedByPartners =>
      _isFrench ? 'APPROUVÉ PAR NOS PARTENAIRES' : 'TRUSTED BY OUR PARTNERS';
  String get simpleSmart =>
      _isFrench ? 'Simple. Sécurisé. Intelligent.' : 'Simple. Secure. Smart.';
  String get cameroun => _isFrench ? 'CAMEROUN' : 'CAMEROON';

  // ── Onboarding strings ──────────────────────────────────────────────────
  String get onboard1Title => _isFrench
      ? 'Paiements flexibles,\nVie plus intelligente'
      : 'Flexible Payments,\nSmarter living';
  String get onboard1Subtitle => _isFrench
      ? 'Accédez à des milliers de produits et payez en 2, 3 ou 6 fois sans frais cachés.'
      : 'Access thousands of products and pay in 2, 3 or 6 installments with no hidden fees.';
  String get onboard2Title => _isFrench
      ? 'Transférez & payez\nen quelques secondes'
      : 'Transfer & pay\nin seconds';
  String get onboard2Subtitle => _isFrench
      ? 'Envoyez de l\'argent instantanément à tout utilisateur Watsim ou compte bancaire au Cameroun.'
      : 'Send money instantly to any Watsim user or bank account across Cameroon.';
  String get onboard3Title => _isFrench
      ? 'Gagnez des récompenses\npour chaque action'
      : 'Earn rewards\nfor every action';
  String get onboard3Subtitle => _isFrench
      ? 'Invitez des amis, effectuez des paiements et débloquez des récompenses cashback exclusives.'
      : 'Invite friends, make payments and unlock exclusive cashback rewards.';
  String get next => _isFrench ? 'Suivant' : 'Next';
  String get createMyAccount =>
      _isFrench ? 'Créer mon compte' : 'Create my account';
  String get iAlreadyHaveAccount =>
      _isFrench ? 'J\'ai déjà un compte' : 'I already have an account';

  // ── Register screen strings ─────────────────────────────────────────────
  String get createMyAccountTitle =>
      _isFrench ? 'Créer mon compte' : 'Create my account';
  String get fillInYourInfo =>
      _isFrench ? 'Renseignez vos informations' : 'Fill in your information';
  String get firstNameLabel => _isFrench ? 'PRÉNOM' : 'FIRST NAME';
  String get lastNameLabel => _isFrench ? 'NOM DE FAMILLE' : 'LAST NAME';
  String get phoneNumberLabel =>
      _isFrench ? 'NUMÉRO DE TÉLÉPHONE' : 'PHONE NUMBER';
  String get emailLabel => _isFrench ? 'EMAIL' : 'EMAIL';
  String get optional => _isFrench ? 'Optionnel' : 'Optional';
  String get firstNameHint => _isFrench ? 'Ex : Jean' : 'Ex: Jean';
  String get lastNameHint => _isFrench ? 'Ex : Bakari' : 'Ex: Bakari';
  String get acceptTerms => _isFrench ? 'J\'accepte les ' : 'I accept the ';
  String get generalTerms => _isFrench
      ? 'Conditions Générales d\'Utilisation'
      : 'General Terms of Use';
  String get continueLabel => _isFrench ? 'Continuer' : 'Continue';
  String get alreadyHaveAccount =>
      _isFrench ? 'Vous avez déjà un compte ?  ' : 'Already have an account?  ';
  String get signIn => _isFrench ? 'Se connecter' : 'Sign in';

  // ── Login screen strings ────────────────────────────────────────────────
  String get welcomeBack => _isFrench ? 'Bienvenue' : 'Welcome back';
  String get signInToAccount =>
      _isFrench ? 'Connectez-vous à votre compte' : 'Sign in to your account';
  String get phoneNumberField =>
      _isFrench ? 'NUMÉRO DE TÉLÉPHONE' : 'PHONE NUMBER';
  String get pinCode => _isFrench ? 'CODE PIN' : 'PIN CODE';
  String get forgotPin => _isFrench ? 'PIN oublié ?' : 'Forgot PIN?';
  String get signInButton => _isFrench ? 'Se connecter' : 'Sign in';
  String get useBiometrics =>
      _isFrench ? 'Utiliser la biométrie' : 'Use Biometrics';
  String get noAccountYet =>
      _isFrench ? 'Pas encore de compte ?  ' : 'No account yet?  ';
  String get register => _isFrench ? 'S\'inscrire' : 'Register';
  String get securedByWatsim =>
      _isFrench ? 'SÉCURISÉ PAR WATSIM PAY' : 'SECURED BY WATSIM PAY';

  // ── Fingerprint scan sheet ──────────────────────────────────────────────
  String get scanVerified => _isFrench ? 'Vérifié !' : 'Verified!';
  String get scanNotRecognised => _isFrench ? 'Non reconnu' : 'Not recognised';
  String get scanScanning => _isFrench ? 'Analyse en cours...' : 'Scanning...';
  String get scanTouchToVerify =>
      _isFrench ? 'Touchez pour vérifier' : 'Touch to verify';
  String get scanTryAgain => _isFrench ? 'Réessayer' : 'Try again';
  String get scanPlaceFinger => _isFrench
      ? 'Placez votre doigt sur le capteur'
      : 'Place your finger on the sensor';
  String get cancelLabel => _isFrench ? 'Annuler' : 'Cancel';

  // ── Home screen strings ─────────────────────────────────────────────────
  String get availableBalance =>
      _isFrench ? 'Solde disponible' : 'Available Balance';
  String get verified => _isFrench ? 'VÉRIFIÉ' : 'VERIFIED';
  String get deposit => _isFrench ? 'Dépôt' : 'Deposit';
  String get transfer => _isFrench ? 'Transfert' : 'Transfer';
  String get checkBalance => _isFrench ? 'Vérifier solde' : 'Check Balance';
  String get bnplCreditHome => _isFrench
      ? 'Montant Maximum de cotisation'
      : 'Maximum Contribution Amount';
  String get tapToShopBnpl =>
      _isFrench ? 'Appuyez pour acheter avec BNPL' : 'Tap to shop on BNPL';
  String get upcomingPayments =>
      _isFrench ? 'Paiements à venir' : 'Upcoming Payments';
  String get seeAll => _isFrench ? 'Tout voir' : 'See all';
  String get seeLess => _isFrench ? 'Voir moins' : 'See less';
  String get noUpcomingPayments =>
      _isFrench ? 'Aucun paiement à venir' : 'No Upcoming Payments';
  String get ordersWillAppear => _isFrench
      ? 'Les commandes que vous passez apparaîtront ici'
      : 'Orders you place will appear here';
  String get browseCatalogue =>
      _isFrench ? 'Parcourir le catalogue' : 'Browse Catalogue';
  String get exclusiveOffers =>
      _isFrench ? 'Offres exclusives' : 'Exclusive Offers';
  String get paid => _isFrench ? 'PAYÉ ✓' : 'PAID ✓';
  String get perMonth => _isFrench ? 'FCFA/mois' : 'FCFA/mo';

  // ── Bottom nav strings ──────────────────────────────────────────────────
  String get navHome => _isFrench ? 'Accueil' : 'Home';
  String get navShop => _isFrench ? 'Boutique' : 'Shop';
  String get navMessages => _isFrench ? 'Messages' : 'Messages';
  String get navHistory => _isFrench ? 'Historique' : 'History';
  String get navProfile => _isFrench ? 'Profil' : 'Profile';
  String get navReferrals => _isFrench ? 'Parrainages' : 'Referrals';

  // ── History screen strings ──────────────────────────────────────────────
  String get history => _isFrench ? 'Historique' : 'History';
  String get filterAll => _isFrench ? 'Tout' : 'All';
  String get filterDeposits => _isFrench ? 'Dépôts' : 'Deposits';
  String get filterWithdrawals => _isFrench ? 'Retraits' : 'Withdrawals';
  String get filterTransfers => _isFrench ? 'Transferts' : 'Transfers';
  String get filterBNPL => 'BNPL';
  String get noOrdersYet =>
      _isFrench ? 'Aucune commande passée' : 'No orders placed yet';
  String get makeDeposit => _isFrench ? 'Faire un dépôt' : 'Make a Deposit';
  String get filterByPeriod =>
      _isFrench ? 'Filtrer par période' : 'Filter by Period';
  String get noDataYet => _isFrench ? 'Aucune donnée' : 'No data yet';
  String get spendingByMonth => _isFrench
      ? 'Dépenses par mois (milliers FCFA)'
      : 'Spending by Month (thousands FCFA)';
  String get breakdownByCategory =>
      _isFrench ? 'Répartition par catégorie' : 'Breakdown by Category';
  String get deliveryDetails =>
      _isFrench ? 'Détails de livraison' : 'Delivery Details';
  String get confirmIdentityDelivery => _isFrench
      ? 'Confirmez votre identité et les infos de livraison'
      : 'Confirm your identity and delivery info';
  String get numberOfItems =>
      _isFrench ? 'Nombre d\'articles' : 'Number of items';
  String get continueToPIN => _isFrench
      ? 'Continuer vers la confirmation PIN'
      : 'Continue to PIN Confirmation';
  String get refundReturnedToWallet => _isFrench
      ? 'Remboursement retourné au portefeuille'
      : 'Refund Returned to Wallet';
  String get done => _isFrench ? 'Terminé' : 'Done';
  String get confirmTransfer =>
      _isFrench ? 'Confirmer le transfert' : 'Confirm Transfer';
  String get from => _isFrench ? 'De' : 'From';
  String get to => _isFrench ? 'À' : 'To';
  String get amount => _isFrench ? 'Montant' : 'Amount';
  String get back => _isFrench ? 'Retour' : 'Back';
  String get transferAccumulatedFunds => _isFrench
      ? 'Transférer les fonds accumulés'
      : 'Transfer Accumulated Funds';
  String get transferSubtitle => _isFrench
      ? 'Transférez les paiements déjà effectués vers une autre commande active.'
      : 'Move payments already made on this order to another active order.';
  String get noPaymentsMadeYet => _isFrench
      ? 'Aucun paiement effectué. Payez au moins un versement avant de transférer.'
      : 'No payments made yet. Make at least one instalment before transferring.';
  String get noOtherActiveOrders => _isFrench
      ? 'Aucune autre commande active vers laquelle transférer.'
      : 'No other active orders to transfer to.';
  String get selectDestinationOrder => _isFrench
      ? 'SÉLECTIONNER LA COMMANDE DE DESTINATION'
      : 'SELECT DESTINATION ORDER';
  String get withdrawPayment =>
      _isFrench ? 'Retirer le paiement ?' : 'Withdraw Payment?';
  String get confirmWithdrawal =>
      _isFrench ? 'Confirmer le retrait' : 'Confirm Withdrawal';
  String get exchangeProduct =>
      _isFrench ? 'Échanger le produit' : 'Exchange Product';
  String get submitExchangeRequest =>
      _isFrench ? 'Soumettre la demande d\'échange' : 'Submit Exchange Request';
  String get instalmentsCount =>
      _isFrench ? 'Versements payés' : 'Instalments paid';
  String get allInstalmentsComplete => _isFrench
      ? 'Tous les versements payés — Commande terminée'
      : 'All instalments paid — Order complete';
  String get confirmDelivery =>
      _isFrench ? 'Confirmer la livraison' : 'Confirm Delivery';
  String get enterPINToConfirm => _isFrench
      ? 'Entrez votre PIN pour confirmer'
      : 'Enter your PIN to confirm';
  String get confirmIdentityProceed => _isFrench
      ? 'Confirmez votre identité pour continuer'
      : 'Confirm your identity to proceed';
  String get confirmContribution =>
      _isFrench ? 'Confirmer la cotisation' : 'Confirm Contribution';
  String get authoriseDelivery =>
      _isFrench ? 'Autoriser cette livraison' : 'Authorise this delivery';
  String get incorrectPIN =>
      _isFrench ? 'PIN incorrect. Réessayez.' : 'Incorrect PIN. Try again.';
  String get demoPIN => _isFrench
      ? 'Entrez votre PIN pour confirmer'
      : 'Enter your PIN to confirm';
  String get myBnplOrders =>
      _isFrench ? 'Mes commandes BNPL' : 'My BNPL Orders';
  String get instalment => _isFrench ? 'Versement' : 'Instalment';
  String get of => _isFrench ? 'sur' : 'of';
  String get accumulated => _isFrench ? 'Accumulé' : 'Accumulated';

  // ── Notifications screen strings ────────────────────────────────────────
  String get notificationsTitle =>
      _isFrench ? 'Notifications' : 'Notifications';
  String get markAllRead =>
      _isFrench ? 'Tout marquer comme lu' : 'Mark all read';
  String get unread => _isFrench ? 'non lu(s)' : 'unread';
  String get tabAll => _isFrench ? 'Tout' : 'All';
  String get tabTransactions => _isFrench ? 'Transactions' : 'Transactions';
  String get tabPromos => _isFrench ? 'Promos' : 'Promos';
  String get noNotificationsHere =>
      _isFrench ? 'Aucune notification ici' : 'No notifications here';
  String get justNow => _isFrench ? 'À l\'instant' : 'Just now';
  String get minutesAgo => _isFrench ? 'min' : 'm';
  String get hoursAgo => _isFrench ? 'h' : 'h';
  String get daysAgo => _isFrench ? 'j' : 'd';
  String get yesterday => _isFrench ? 'Hier' : 'Yesterday';

  // ── Wallet screen strings ───────────────────────────────────────────────
  String get growthThisMonth =>
      _isFrench ? '+2,4% ce mois-ci' : '+2.4% this month';
  String get addMoney => _isFrench ? 'Ajouter de l\'argent' : 'Add Money';
  String get topUpWalletInstantly => _isFrench
      ? 'Rechargez votre portefeuille instantanément'
      : 'Top up your wallet instantly';
  String get buyNow => _isFrench ? 'Acheter maintenant.' : 'Buy now.';
  String get explore => _isFrench ? 'EXPLORER' : 'EXPLORE';
  String get transactions => _isFrench ? 'Transactions' : 'Transactions';
  String get noTransactionsYet =>
      _isFrench ? 'Aucune transaction pour l\'instant' : 'No transactions yet';
  String get today => _isFrench ? 'Aujourd\'hui' : 'Today';

  // ── Messaging screen (chat settings / dialogs) ───────────────────────────
  String get allMarkedAsRead => _isFrench
      ? 'Toutes les conversations marquées comme lues'
      : 'All conversations marked as read';
  String get markAllAsRead =>
      _isFrench ? 'Tout marquer comme lu' : 'Mark all as read';
  String get settingsMenu => _isFrench ? 'Paramètres' : 'Settings';
  String get newConversation =>
      _isFrench ? 'Nouvelle conversation' : 'New Conversation';
  String get newConversationSub => _isFrench
      ? 'Démarrez un chat avec un autre utilisateur Watsim.'
      : 'Start a chat with another Watsim user.';
  String get phoneOrId =>
      _isFrench ? 'Numéro de téléphone ou ID' : 'Phone number or ID';
  String get nameOptional => _isFrench ? 'Nom (optionnel)' : 'Name (optional)';
  String get startChat => _isFrench ? 'Démarrer le chat' : 'Start Chat';
  String get videoCallSoon =>
      _isFrench ? 'Appel vidéo bientôt disponible' : 'Video call coming soon';
  String callingName(String name) =>
      _isFrench ? 'Appel de $name…' : 'Calling $name…';
  String viewProfile(String name) =>
      _isFrench ? 'Profil de $name' : '$name\'s profile';
  String blockedUser(String name) =>
      _isFrench ? '$name bloqué' : '$name blocked';
  String get notificationsMuted =>
      _isFrench ? 'Notifications désactivées' : 'Notifications muted';
  String get clearChat => _isFrench ? 'Effacer le chat' : 'Clear chat';
  String get clearChatContent => _isFrench
      ? 'Tous les messages de ce chat seront supprimés.'
      : 'All messages in this chat will be deleted.';
  String get chatCleared => _isFrench ? 'Chat effacé' : 'Chat cleared';
  String get clearLabel => _isFrench ? 'Effacer' : 'Clear';
  String get blockLabel => _isFrench ? 'Bloquer' : 'Block';
  String get viewContact => _isFrench ? 'Voir le contact' : 'View contact';
  String get muteNotifications =>
      _isFrench ? 'Désactiver les notifications' : 'Mute notifications';
  String get chatSettings => _isFrench ? 'Paramètres du chat' : 'Chat Settings';
  String get notificationsSection =>
      _isFrench ? 'Notifications' : 'Notifications';
  String get privacySection2 => _isFrench ? 'Confidentialité' : 'Privacy';
  String get appearanceSection => _isFrench ? 'Apparence' : 'Appearance';
  String get messageNotifications =>
      _isFrench ? 'Notifications de messages' : 'Message Notifications';
  String get messageNotificationsSub => _isFrench
      ? 'Afficher les alertes pour les nouveaux messages'
      : 'Show alerts for new messages';
  String get soundLabel => _isFrench ? 'Son' : 'Sound';
  String get soundSub => _isFrench
      ? 'Jouer un son pour les nouveaux messages'
      : 'Play sound for new messages';
  String get vibrationLabel => _isFrench ? 'Vibration' : 'Vibration';
  String get vibrationSub => _isFrench
      ? 'Vibrer pour les nouveaux messages'
      : 'Vibrate for new messages';
  String get readReceipts => _isFrench ? 'Accusés de lecture' : 'Read Receipts';
  String get readReceiptsSub => _isFrench
      ? 'Afficher quand les messages sont lus'
      : 'Show when messages are read';
  String get onlineStatusLabel =>
      _isFrench ? 'Statut en ligne' : 'Online Status';
  String get onlineStatusSub =>
      _isFrench ? 'Afficher quand vous êtes actif' : 'Show when you\'re active';
  String get fontSizeLabel => _isFrench ? 'Taille de police' : 'Font Size';
  String get chatWallpaper =>
      _isFrench ? 'Fond d\'écran du chat' : 'Chat Wallpaper';

  // ── Home screen – contribution limit prompt ──────────────────────────────
  String get activeOrderTitle =>
      _isFrench ? 'Cotisation en cours' : 'Active Contribution';
  String get activeOrderBody => _isFrench
      ? 'Vous avez déjà une cotisation active. Veuillez compléter cette cotisation avant d\'en commencer une nouvelle.'
      : 'You already have an active contribution in progress. Please complete it before starting a new one.';
  String get viewActiveOrder =>
      _isFrench ? 'Voir ma cotisation' : 'View My Contribution';
  String get gotIt => _isFrench ? 'Compris' : 'Got it';
  String get maxContribTitle =>
      _isFrench ? 'Montant trop élevé' : 'Amount Too High';
  String get maxContribBody => _isFrench
      ? 'Ce produit dépasse votre montant de cotisation maximum. Veuillez choisir un autre produit.'
      : 'This product exceeds your maximum contribution amount. Please choose another product.';
  String get chooseAnotherProduct =>
      _isFrench ? 'Choisir un autre produit' : 'Choose Another Product';
  String get messagesTitle => _isFrench ? 'Messages' : 'Messages';
  String get searchConversations =>
      _isFrench ? 'Rechercher des conversations...' : 'Search conversations...';
  String get noConversationsYet =>
      _isFrench ? 'Aucune conversation' : 'No conversations yet';
  String get online => _isFrench ? 'En ligne' : 'Online';
  String get writeAMessage =>
      _isFrench ? 'Écrire un message...' : 'Write a message...';

  // ── BNPL Simulator screen strings ───────────────────────────────────────
  String get simulateBnplTitle =>
      _isFrench ? 'Simuler une cotisation' : 'Simulate BNPL';
  String get simulateInstalments =>
      _isFrench ? 'Simuler vos versements' : 'Simulate your instalments';
  String get choosePlanBudget => _isFrench
      ? 'Choisissez le plan adapté à votre budget'
      : 'Choose the plan that fits your budget';
  String get financingDuration =>
      _isFrench ? 'DURÉE DE FINANCEMENT' : 'FINANCING DURATION';
  String get paymentFrequencyLabel =>
      _isFrench ? 'FRÉQUENCE DE PAIEMENT' : 'PAYMENT FREQUENCY';
  String get instalmentDetails =>
      _isFrench ? 'DÉTAILS DES VERSEMENTS' : 'INSTALMENT DETAILS';
  String get selectFrequencyFirst => _isFrench
      ? 'Sélectionnez une fréquence de paiement pour voir votre échéancier'
      : 'Select a payment frequency above to see your instalment schedule';
  String get productPrice => _isFrench ? 'Prix du produit' : 'Product Price';
  String get accountCreationFee =>
      _isFrench ? 'Frais de création de compte' : 'Account creation fee';
  String get deliveryFeeLabel =>
      _isFrench ? 'Frais de livraison' : 'Delivery fee';
  String get pickUpFee => _isFrench ? 'Frais de collecte' : 'Pick-up fee';
  String get stockingFee => _isFrench ? 'Frais de stockage' : 'Stocking fee';
  String get totalAmount => _isFrench ? 'Montant total' : 'Total Amount';
  String get durationLabel => _isFrench ? 'Durée' : 'Duration';
  String get firstPayment => _isFrench ? 'Premier paiement' : 'First payment';
  String get chosenByYou => _isFrench ? 'À votre choix' : 'Chosen by you';
  String get selectFrequencyFirst2 => _isFrench
      ? 'Sélectionnez d\'abord une fréquence de paiement'
      : 'Select a payment frequency first';
  String get confirmThisPlan =>
      _isFrench ? 'Confirmer ce plan' : 'Confirm this plan';
  String get confirmYourPlan =>
      _isFrench ? 'Confirmer votre plan' : 'Confirm Your Plan';
  String get reviewBeforeConfirm => _isFrench
      ? 'Vérifiez les détails avant de confirmer'
      : 'Review the details before confirming';
  String get freqDaily => _isFrench ? 'Quotidien' : 'Daily';
  String get freqWeekly => _isFrench ? 'Hebdomadaire' : 'Weekly';
  String get freqMonthly => _isFrench ? 'Mensuel' : 'Monthly';
  String get selectFrequency =>
      _isFrench ? 'Sélectionner une fréquence' : 'Select payment frequency';
  String get immediate => _isFrench ? 'Immédiat' : 'Immediate';
  String get dueOn => _isFrench ? 'Dû le' : 'Due on';
  String get dayLabel => _isFrench ? 'Jour' : 'Day';
  String get weekLabel => _isFrench ? 'Semaine' : 'Week';
  String get instalmentLabel => _isFrench ? 'Versement' : 'Instalment';
  String get perDay => _isFrench ? '/jour' : '/day';
  String get perWeek => _isFrench ? '/semaine' : '/week';
  String get perMonthLabel => _isFrench ? '/mois' : '/month';
  String get daysLabel => _isFrench ? 'jours' : 'days';
  String get weeksLabel => _isFrench ? 'semaines' : 'weeks';
  String get monthsLabel => _isFrench ? 'mois' : 'months';
  String get bnplPaymentTitle => _isFrench ? 'Paiement BNPL' : 'BNPL Payment';
  String get fullyPaid =>
      _isFrench ? 'Entièrement payé ! 🎉' : 'Fully Paid! 🎉';
  String get paymentSuccessful =>
      _isFrench ? 'Paiement réussi' : 'Payment Successful';
  String get completedAllPayments => _isFrench
      ? 'Vous avez complété tous vos paiements.'
      : 'You\'ve completed all your payments.';
  String get instalmentRecorded => _isFrench
      ? 'Votre versement a été enregistré.'
      : 'Your instalment has been recorded.';
  String get paymentSummary =>
      _isFrench ? 'RÉSUMÉ DU PAIEMENT' : 'PAYMENT SUMMARY';
  String get orderLabel => _isFrench ? 'Commande' : 'Order';
  String get productLabel => _isFrench ? 'Produit' : 'Product';
  String get contributionAdded =>
      _isFrench ? 'Cotisation ajoutée' : 'Contribution Added';
  String get accumulatedFunds =>
      _isFrench ? 'Fonds accumulés' : 'Accumulated Funds';
  String get remainingBalance =>
      _isFrench ? 'Solde restant' : 'Remaining Balance';
  String get repaymentProgress =>
      _isFrench ? 'Progression du remboursement' : 'Repayment Progress';
  String get paid2 => _isFrench ? 'Payé' : 'Paid';
  String get leftLabel => _isFrench ? 'Restant' : 'Left';
  String get nextPaymentDue =>
      _isFrench ? 'Prochain paiement dû' : 'Next Payment Due';
  String get overpaymentRefunded =>
      _isFrench ? 'Trop-perçu remboursé' : 'Overpayment Refunded';
  String get returnedToWallet => _isFrench
      ? 'retourné dans votre portefeuille'
      : 'returned to your wallet';
  String get backToHome => _isFrench ? 'Retour à l\'accueil' : 'Back to Home';
  String get viewMyOrders =>
      _isFrench ? 'Voir mes commandes' : 'View My Orders';
  String get frequencyLabel => _isFrench ? 'Fréquence' : 'Frequency';
  String get insufficientBalance =>
      _isFrench ? 'Solde insuffisant' : 'Insufficient Balance';
  String insufficientBalanceDesc(String available, String required) => _isFrench
      ? 'Votre solde est de $available, mais le premier versement nécessite $required.'
      : 'Your wallet balance is $available, but the first instalment requires $required.';
  String get amountNeededTopUp =>
      _isFrench ? 'Montant à recharger' : 'Amount needed to top up';
  String get topUpWallet =>
      _isFrench ? 'Recharger le portefeuille' : 'Top Up Wallet';
  String get maybeLater => _isFrench ? 'Plus tard' : 'Maybe later';
  String get walletBalance =>
      _isFrench ? 'Solde portefeuille' : 'Wallet balance';
  String get makePayment =>
      _isFrench ? 'Effectuer le paiement' : 'Make Payment';
  String get editPlan => _isFrench ? 'Modifier le plan' : 'Edit Plan';
  String get orderConfirmed =>
      _isFrench ? 'Commande confirmée !' : 'Order Confirmed!';
  String get orderConfirmedDesc => _isFrench
      ? 'Votre commande BNPL a été validée.\nVotre produit sera livré sous 48 heures.'
      : 'Your BNPL order has been validated.\nYour product will be delivered within 48 hours.';
  String get orderNumberLabel =>
      _isFrench ? 'Numéro de commande' : 'Order number';
  String get amountLabel => _isFrench ? 'montant' : 'amount';
  String get nextInstalment =>
      _isFrench ? 'Prochain versement' : 'Next instalment';
  String get repaymentTitle => _isFrench ? 'Remboursement' : 'Repayment';
  String get amountDueThisMonth =>
      _isFrench ? 'Montant dû ce mois' : 'Amount due this month';
  String get dueOnOctober25 =>
      _isFrench ? 'Dû le 25 octobre 2024' : 'Due on 25 October 2024';
  String get pendingInstalments =>
      _isFrench ? 'VERSEMENTS EN ATTENTE' : 'PENDING INSTALMENTS';
  String get payAllInstalments => _isFrench
      ? 'Payer tous les versements — 57 500 FCFA'
      : 'Pay all instalments — 57,500 FCFA';
  String get partialPayment =>
      _isFrench ? 'Paiement partiel' : 'Partial payment';

  // ── Catalogue screen strings ────────────────────────────────────────────
  String get saveNow => _isFrench ? 'Cotiser maintenant' : 'Save Now';
  String get simulateBnpl =>
      _isFrench ? 'Simuler une cotisation' : 'Simulate BNPL';
  String get freeDelivery =>
      _isFrench ? 'Livraison gratuite incluse' : 'Free delivery included';
  String get warranty12 => _isFrench ? 'Garantie 12 mois' : '12-month warranty';
  String get resultsFor => _isFrench ? 'résultat(s) pour' : 'result(s) for';
  String get productsCount => _isFrench ? 'produit(s)' : 'product(s)';
  String get tabActive => _isFrench ? 'Actif' : 'Active';
  String get tabCompleted => _isFrench ? 'Terminé' : 'Completed';
  String get tabCancelled => _isFrench ? 'Annulé' : 'Cancelled';
  String get noCancelledOrders =>
      _isFrench ? 'Aucune commande annulée' : 'No cancelled orders';
  String get paymentsMade =>
      _isFrench ? 'paiements effectués' : 'payments made';
  String get enjoyProduct => _isFrench ? 'Profitez de' : 'Enjoy';
  String get bnplPaymentDesc => _isFrench
      ? 'avec le paiement BNPL Watsim. Étalez votre achat sur 2, 3 ou 6 versements sans intérêts. Livraison rapide et service client dédié.'
      : 'with Watsim BNPL payment. Spread your purchase over 2, 3 or 6 interest-free instalments. Fast delivery and dedicated customer service.';
  String get searchForProduct =>
      _isFrench ? 'Rechercher un produit...' : 'Search for a product...';
  String get noResultsFor =>
      _isFrench ? 'Aucun résultat pour' : 'No results for';
  String get tryDifferentKeyword =>
      _isFrench ? 'Essayez un autre mot-clé' : 'Try a different keyword';
  String get description => _isFrench ? 'Description' : 'Description';
  String get catAll => _isFrench ? 'Tout' : 'All';
  String get catElectronics => _isFrench ? 'Électronique' : 'Electronics';
  String get catAccessories => _isFrench ? 'Accessoires' : 'Accessories';
  String get catKitchen => _isFrench ? 'Cuisine' : 'Kitchen';
  String get catSports => _isFrench ? 'Sports' : 'Sports';

  // ── Order detail screen strings ─────────────────────────────────────────
  String get instalmentSchedule =>
      _isFrench ? 'CALENDRIER DES VERSEMENTS' : 'INSTALMENT SCHEDULE';
  String get productActions =>
      _isFrench ? 'ACTIONS PRODUIT' : 'PRODUCT ACTIONS';
  String get exchangeConfirmed =>
      _isFrench ? 'Échange confirmé !' : 'Exchange Confirmed!';
  String get confirmWithPIN =>
      _isFrench ? 'Confirmer avec PIN' : 'Confirm with PIN';
  String get current => _isFrench ? 'Actuel' : 'Current';
  String get newLabel => _isFrench ? 'Nouveau' : 'New';
  String get confirm => _isFrench ? 'Confirmer' : 'Confirm';
  String get selectSamePriceProduct => _isFrench
      ? 'Sélectionnez un produit du même prix pour l\'échanger.'
      : 'Select a product of the same price to exchange with.';
  String get deliveryInformation =>
      _isFrench ? 'Informations de livraison' : 'Delivery Information';
  String get confirmDeliveryTitle =>
      _isFrench ? 'Confirmer la livraison' : 'Confirm Delivery';
  String get confirmDeliveryPINDesc => _isFrench
      ? 'Entrez votre code PIN à 4 chiffres pour confirmer la demande de livraison.'
      : 'Enter your 4-digit PIN to confirm the delivery request.';
  String get confirmDeliveryBtn =>
      _isFrench ? 'Confirmer la livraison' : 'Confirm Delivery';
  String get deliveryReceipt =>
      _isFrench ? 'Reçu de livraison' : 'Delivery Receipt';
  String get totalOrderValue =>
      _isFrench ? 'VALEUR TOTALE DE LA COMMANDE' : 'TOTAL ORDER VALUE';
  String get downloadReceipt =>
      _isFrench ? 'Télécharger le reçu' : 'Download Receipt';
  String get close => _isFrench ? 'Fermer' : 'Close';
  String get amountToTransfer =>
      _isFrench ? 'Montant à transférer' : 'Amount to Transfer';
  String get withdrawalSuccessful =>
      _isFrench ? 'Retrait réussi !' : 'Withdrawal Successful!';
  String get withdrawFunds =>
      _isFrench ? 'Retirer les fonds' : 'Withdraw Funds';
  String get makeAContribution =>
      _isFrench ? 'Faire une cotisation' : 'Make a Contribution';
  String get enterYourContribution =>
      _isFrench ? 'Entrez votre cotisation' : 'Enter your contribution';
  String get youAreContributing =>
      _isFrench ? 'Vous cotisez' : 'You are contributing';
  String get tapToChange =>
      _isFrench ? 'Appuyer pour changer' : 'Tap to change';
  String get tapToUpload => _isFrench
      ? 'Appuyer pour télécharger ou prendre une photo'
      : 'Tap to upload or take a photo';
  String get jpgPngMax5MB =>
      _isFrench ? 'JPG, PNG — max 5 Mo' : 'JPG, PNG — max 5 MB';
  String get skipForNow =>
      _isFrench ? 'Ignorer pour l\'instant' : 'Skip for now';
  String get verificationSubmitted =>
      _isFrench ? 'Vérification soumise !' : 'Verification Submitted!';
  String get verificationReviewDesc => _isFrench
      ? 'Vos documents sont en cours de révision. Vous recevrez une notification dans les 24 heures.'
      : 'Your documents are under review. You will receive a notification within 24 hours.';
  String get goToDashboard =>
      _isFrench ? 'Aller au tableau de bord' : 'Go to Dashboard';

  // ── Deposit screen strings ──────────────────────────────────────────────
  String get fundAccountInstantly => _isFrench
      ? 'Alimentez votre compte Watsim instantanément.'
      : 'Fund your Watsim account instantly.';
  String get chooseOperator =>
      _isFrench ? 'CHOISIR UN OPÉRATEUR' : 'CHOOSE AN OPERATOR';
  String get depositAmount => _isFrench ? 'MONTANT DU DÉPÔT' : 'DEPOSIT AMOUNT';
  String get summaryLabel => _isFrench ? 'Résumé' : 'Summary';
  String get depositBtn => _isFrench ? 'Déposer' : 'Deposit';
  String get withdrawToMobileMoney => _isFrench
      ? 'Transférez vers votre compte mobile money.'
      : 'Transfer to your mobile money account.';
  String get withdrawalMethod =>
      _isFrench ? 'MÉTHODE DE RETRAIT' : 'WITHDRAWAL METHOD';
  String get amountLabel2 => _isFrench ? 'MONTANT' : 'AMOUNT';
  String get withdrawBtn => _isFrench ? 'Retirer' : 'Withdraw';
  String get transferMoney =>
      _isFrench ? "Transférer de l'argent" : 'Transfer Money';
  String get sendToAnotherWatsim => _isFrench
      ? 'Envoyer vers un autre compte Watsim.'
      : 'Send to another Watsim account.';
  String get recipient => _isFrench ? 'DESTINATAIRE' : 'RECIPIENT';
  String get transferAmountLabel =>
      _isFrench ? 'MONTANT DU TRANSFERT' : 'TRANSFER AMOUNT';
  String get transferBtn => _isFrench ? 'Transférer' : 'Transfer';

  // ── BNPL simulator payment step strings ──────────────────────────────────
  String get toPay => _isFrench ? 'À PAYER' : 'TO PAY';
  String get enterFirstContribution => _isFrench
      ? 'Entrez votre première cotisation'
      : 'Enter your first contribution';
  String get continueToPINBtn =>
      _isFrench ? 'Continuer vers PIN' : 'Continue to PIN';
  String get incorrectPINTryAgain =>
      _isFrench ? 'PIN incorrect. Réessayez.' : 'Incorrect PIN. Try again.';

  // ── Security screen ───────────────────────────────────────────────────────

  // ── Help & Support screen ─────────────────────────────────────────────────
  String get contactUs => _isFrench ? 'Nous contacter' : 'Contact Us';
  String get liveChat => _isFrench ? 'Chat en direct' : 'Live Chat';
  String get liveChatSub => _isFrench ? 'Disponible 24h/24' : 'Available 24/7';
  String get callUs => _isFrench ? 'Appelez-nous' : 'Call Us';
  String get callUsSub => _isFrench ? '+237 650 000 000' : '+237 650 000 000';
  String get emailUs => _isFrench ? 'Écrivez-nous' : 'Email Us';
  String get emailUsSub => 'support@watsim.cm';
  String get submitTicket => _isFrench ? 'Ticket' : 'Submit Ticket';
  String get submitTicketSub => _isFrench ? 'Réponse sous 24h' : 'Reply in 24h';
  String get faqTitle => _isFrench ? 'Questions fréquentes' : 'FAQ';
  String get faqQ1 => _isFrench
      ? 'Comment fonctionne le paiement BNPL ?'
      : 'How does BNPL payment work?';
  String get faqA1 => _isFrench
      ? 'Le BNPL (Buy Now Pay Later) vous permet d\'acheter un produit et de répartir le paiement en 2, 3 ou 6 versements sans intérêts. Votre première mensualité est due immédiatement.'
      : 'BNPL (Buy Now Pay Later) lets you buy a product and split the cost into 2, 3, or 6 interest-free instalments. Your first instalment is due immediately at checkout.';
  String get faqQ2 => _isFrench
      ? 'Comment puis-je recharger mon portefeuille ?'
      : 'How do I top up my wallet?';
  String get faqA2 => _isFrench
      ? 'Vous pouvez recharger votre portefeuille via MTN Mobile Money ou Orange Money depuis l\'onglet Portefeuille. Le crédit est ajouté instantanément.'
      : 'You can top up your wallet using MTN Mobile Money or Orange Money from the Wallet tab. Credit is added instantly.';
  String get faqQ3 => _isFrench
      ? 'Que se passe-t-il si je manque un versement ?'
      : 'What happens if I miss an instalment?';
  String get faqA3 => _isFrench
      ? 'En cas de retard de paiement, des pénalités peuvent s\'appliquer et votre score de crédit peut être affecté. Contactez notre support avant l\'échéance si vous rencontrez des difficultés.'
      : 'Late payments may incur penalties and can affect your credit score. Contact our support before the due date if you are experiencing difficulties.';
  String get faqQ4 => _isFrench
      ? 'Comment modifier mes informations personnelles ?'
      : 'How do I update my personal information?';
  String get faqA4 => _isFrench
      ? 'Accédez à Profil → Mon Compte et appuyez sur l\'icône de modification. Certaines modifications peuvent nécessiter une vérification d\'identité.'
      : 'Go to Profile → My Account and tap the edit icon. Some changes may require identity verification.';
  String get faqQ5 =>
      _isFrench ? 'Comment parrainer un ami ?' : 'How do I refer a friend?';
  String get faqA5 => _isFrench
      ? 'Partagez votre code de parrainage depuis Profil → Mes Parrainages. Vous gagnez 2 000 FCFA pour chaque ami qui complète son premier achat BNPL.'
      : 'Share your referral code from Profile → My Referrals. You earn 2,000 FCFA for every friend who completes their first BNPL purchase.';
  String get myTickets => _isFrench ? 'Mes tickets' : 'My Tickets';
  String get noTickets =>
      _isFrench ? 'Aucun ticket pour l\'instant' : 'No tickets yet';
  String get ticketCreated => _isFrench ? 'Ticket créé' : 'Ticket created';
  String get statusLabel => _isFrench ? 'Statut' : 'Status';
  String get priorityLabel => _isFrench ? 'Priorité' : 'Priority';
  String get operatingHours =>
      _isFrench ? 'Heures d\'ouverture' : 'Operating Hours';
  String get monFri => _isFrench ? 'Lun – Ven' : 'Mon – Fri';
  String get saturday => _isFrench ? 'Samedi' : 'Saturday';
  String get sunday => _isFrench ? 'Dimanche' : 'Sunday';
  String get closed => _isFrench ? 'Fermé' : 'Closed';
  String get comingSoon => _isFrench ? 'Bientôt disponible' : 'Coming soon';

  // ── About screen ──────────────────────────────────────────────────────────
  String get latestVersion => _isFrench ? 'Version à jour' : 'Up to date';
  String get ourMission => _isFrench ? 'Notre mission' : 'Our Mission';
  String get missionBody => _isFrench
      ? 'Watsim démocratise l\'accès aux biens et services au Cameroun grâce au paiement différé sans intérêts. Nous aidons chaque Camerounais à réaliser ses projets aujourd\'hui, en payant à son rythme.'
      : 'Watsim democratises access to goods and services in Cameroon through interest-free deferred payment. We help every Cameroonian achieve their goals today, paying at their own pace.';
  String get keyFeatures => _isFrench ? 'Fonctionnalités clés' : 'Key Features';
  String get featureBnpl => _isFrench ? 'Achat BNPL' : 'BNPL Purchase';
  String get featureBnplSub => _isFrench
      ? 'Étalez vos achats en 2, 3 ou 6 fois'
      : 'Split purchases into 2, 3 or 6 instalments';
  String get featureWallet =>
      _isFrench ? 'Portefeuille digital' : 'Digital Wallet';
  String get featureWalletSub => _isFrench
      ? 'Dépôts, retraits et transferts instantanés'
      : 'Instant deposits, withdrawals & transfers';
  String get featureSavings =>
      _isFrench ? 'Épargne & Cotisation' : 'Savings & Contributions';
  String get featureSavingsSub => _isFrench
      ? 'Cotisez régulièrement pour atteindre vos objectifs'
      : 'Save regularly to reach your financial goals';
  String get featureRewards => _isFrench ? 'Récompenses' : 'Rewards & Cashback';
  String get featureRewardsSub => _isFrench
      ? 'Gagnez des points à chaque achat'
      : 'Earn points and cashback on every purchase';
  String get legal => _isFrench ? 'Mentions légales' : 'Legal';
  String get privacyPolicy =>
      _isFrench ? 'Politique de confidentialité' : 'Privacy Policy';
  String get termsOfService =>
      _isFrench ? 'Conditions d\'utilisation' : 'Terms of Service';
  String get cookiePolicy =>
      _isFrench ? 'Politique des cookies' : 'Cookie Policy';
  String get buildNumber => _isFrench ? 'Numéro de build' : 'Build Number';
  String get releaseDate => _isFrench ? 'Date de sortie' : 'Release Date';
  String get platform => _isFrench ? 'Plateforme' : 'Platform';
  String get developedBy => _isFrench ? 'Développé par' : 'Developed by';
  String get copyright => _isFrench
      ? '© 2025 Watsim Technologies. Tous droits réservés.'
      : '© 2025 Watsim Technologies. All rights reserved.';

  // ── Order detail / history shared action labels ───────────────────────────
  String get manageContribution =>
      _isFrench ? 'GÉRER LA COTISATION' : 'MANAGE CONTRIBUTION';
  String get transferLabel => _isFrench ? 'Transférer' : 'Transfer';
  String get transferSubLabel =>
      _isFrench ? 'Déplacer vers un autre plan' : 'Move to another plan';
  String get withdrawLabel => _isFrench ? 'Retirer' : 'Withdraw';
  String get withdrawSubLabel =>
      _isFrench ? 'Frais de 30% applicables' : '30% charge applies';
  String get exchangeLabel => _isFrench ? 'Échanger' : 'Exchange';
  String get exchangeSubLabel =>
      _isFrench ? 'Remplacer au même prix' : 'Swap for same price';
  String get deliverLabel => _isFrench ? 'Livrer' : 'Deliver';
  String get deliverSubLabel =>
      _isFrench ? 'Demander la livraison' : 'Request delivery';
  String get accumulatedFundsLabel =>
      _isFrench ? 'Fonds accumulés' : 'Accumulated funds';
  String get serviceFee20 =>
      _isFrench ? 'Frais de service (20%)' : 'Service fee (20%)';
  String get recipientReceives =>
      _isFrench ? 'Le destinataire reçoit' : 'Recipient receives';
  String get transferToWatsim => _isFrench
      ? 'Transférer vers un portefeuille WatSim'
      : 'Transfer to WatSim Wallet';
  String get sendAccumulatedFunds => _isFrench
      ? 'Envoyer les fonds accumulés à un autre utilisateur'
      : 'Send accumulated funds to another user';
  String get noWatsimAccount =>
      _isFrench ? 'Aucun compte WatSim trouvé' : 'No WatSim Account Found';
  String get fromLabel => _isFrench ? 'De' : 'From';
  String get toWatsim => _isFrench ? 'À (WatSim)' : 'To (WatSim)';
  String get grossAmount => _isFrench ? 'Montant brut' : 'Gross amount';
  String get transferSuccessful =>
      _isFrench ? 'Transfert réussi !' : 'Transfer Successful!';
  String get continueLabel2 => _isFrench ? 'Continuer' : 'Continue';
  String get deliveryDetailsReceived =>
      _isFrench ? 'Détails de livraison reçus !' : 'Delivery details received!';
  String get deliveryDetailsBody => _isFrench
      ? 'Vos informations ont été reçues. Vous recevrez votre produit prochainement.'
      : 'Your details have been received. You will receive your product shortly.';
  String get productDelivered =>
      _isFrench ? 'Produit livré ✓' : 'Product Delivered ✓';
  String get deliveryRequested2 => _isFrench
      ? 'Livraison demandée — en route !'
      : 'Delivery Requested — on the way!';
  String get markAsReceived =>
      _isFrench ? 'Marquer comme reçu' : 'Mark as Received';
  String get allInstalmentsPaid =>
      _isFrench ? 'Tous les versements payés !' : 'All instalments paid!';
  String get orderFullySettled => _isFrench
      ? 'Cette commande est entièrement réglée. Plus rien à payer.'
      : 'This order is fully settled. Nothing more due.';
  String get pleaseSelectDeliveryTime => _isFrench
      ? 'Veuillez sélectionner un horaire de livraison'
      : 'Please select a delivery time';
  String get confirmIdentityDeliveryDetails => _isFrench
      ? 'Confirmez votre identité et les détails de livraison.'
      : 'Confirm your identity and delivery details.';
  String get receiptDownloaded => _isFrench
      ? 'Reçu téléchargé avec succès !'
      : 'Receipt downloaded successfully!';
  String get contributionAddedFunds => _isFrench
      ? 'Cotisation ajoutée à vos fonds accumulés.'
      : 'Contribution added to your accumulated funds.';
  String get thisWillCompleteOrder => _isFrench
      ? 'Cela va finaliser votre commande !'
      : 'This will complete your order!';
  String exchangedFor(String name) => _isFrench
      ? 'Votre produit a été échangé contre $name.'
      : 'Your product has been exchanged for $name.';
  String exchangePINDesc(String from, String to) => _isFrench
      ? 'Entrez votre PIN à 4 chiffres pour confirmer l\'échange de $from contre $to.'
      : 'Enter your 4-digit PIN to confirm the exchange of $from for $to.';
  String get noOtherProductsSamePrice => _isFrench
      ? 'Aucun autre produit disponible au même prix.'
      : 'No other products available at the same price.';
  String get deliveryRequestedTitle =>
      _isFrench ? 'Livraison demandée' : 'Delivery Requested';
  String get deliveryOnTheWay => _isFrench
      ? 'Votre livraison est en route. Vous recevrez votre produit prochainement.'
      : 'Your delivery is on the way. You will receive your product shortly.';
  String get productDeliveredCelebration =>
      _isFrench ? 'Produit livré ! 🎉' : 'Product Delivered! 🎉';
  String instalmentCount(int index, int total) =>
      _isFrench ? 'Versement $index/$total' : 'Instalment $index/$total';
  String refundedToWallet(String amount) => _isFrench
      ? '$amount remboursé dans votre portefeuille.'
      : '$amount refunded to your wallet.';
  String get officeConfirmation =>
      _isFrench ? 'Confirmation bureau' : 'Office Confirmation';
  String get watsimOfficialInternal =>
      _isFrench ? 'Watsim Officiel — Interne' : 'Watsim Official — Internal';
  String get confirmReceipt2 =>
      _isFrench ? 'Confirmer la réception' : 'Confirm Receipt';
  String get demoSimulateOffice => _isFrench
      ? 'Démo : Simuler action bureau'
      : 'Demo: Simulate Office Action';
  String get officeConfirmsReceipt =>
      _isFrench ? 'Le bureau confirme la réception' : 'Office Confirms Receipt';
  String get howPayCashWorks => _isFrench
      ? 'Comment fonctionne le paiement en espèces'
      : 'How Pay in Cash works';
  String get insufficientFunds =>
      _isFrench ? 'Fonds insuffisants' : 'Insufficient funds';
  String get helloUser => _isFrench ? 'Bonjour' : 'Hello';
  String get newBalanceLabel => _isFrench ? 'Nouveau solde' : 'New balance';
}

// ─── InheritedNotifier wrapper ─────────────────────────────────────────────
class LanguageProvider extends InheritedNotifier<LanguageService> {
  const LanguageProvider({
    super.key,
    required LanguageService service,
    required super.child,
  }) : super(notifier: service);

  static LanguageService of(BuildContext context) {
    final provider =
        context.dependOnInheritedWidgetOfExactType<LanguageProvider>();
    assert(provider != null, 'No LanguageProvider found in tree');
    return provider!.notifier!;
  }
}
