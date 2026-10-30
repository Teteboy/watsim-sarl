import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

// ─── Language Service (InheritedWidget + ChangeNotifier) ──────────────────
class LanguageService extends ChangeNotifier {
  static final LanguageService _instance = LanguageService._internal();
  factory LanguageService() => _instance;
  LanguageService._internal();

  static const _localeKey = 'watsim_locale';

  bool _isFrench = true;
  bool _loaded = false;
  bool get isFrench => _isFrench;

  /// Load the persisted locale once (idempotent).
  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    final prefs = await SharedPreferences.getInstance();
    _isFrench = prefs.getString(_localeKey) != 'en';
    notifyListeners();
  }

  void toggle() {
    _isFrench = !_isFrench;
    notifyListeners();
    SharedPreferences.getInstance().then(
        (prefs) => prefs.setString(_localeKey, _isFrench ? 'fr' : 'en'));
  }

  String get languageLabel => _isFrench ? 'Français' : 'English';

  // ── Profile screen strings ──────────────────────────────────────────────
  String get creditScore => _isFrench ? 'Score de crédit' : 'Credit Score';
  String get excellent => _isFrench ? 'Excellent' : 'Excellent';
  String get bnplLimit => _isFrench ? 'Limite BNPL' : 'BNPL Limit';
  String get accountBenefits =>
      _isFrench ? 'Compte & Avantages' : 'Account & Benefits';
  String get myReferrals => _isFrench ? 'Mes Parrainages' : 'My Referrals';
  String get rewardsCashback =>
      _isFrench ? 'Récompenses & Cashback' : 'Rewards & Cashback';
  String get settings => _isFrench ? 'Paramètres' : 'Settings';
  String get myAccount => _isFrench ? 'Mon Compte' : 'My Account';
  String get notifications => _isFrench ? 'Notifications' : 'Notifications';
  String get language => _isFrench ? 'Langue' : 'Language';
  String get security => _isFrench ? 'Sécurité' : 'Security';
  String get securitySubtitle =>
      _isFrench ? 'PIN, Biométrie, 2FA' : 'PIN, Biometrics, 2FA';
  String get creditScoreSubtitle => _isFrench
      ? 'Consultez votre score et nos conseils'
      : 'View your credit score and tips';
  String get statisticsSubtitle =>
      _isFrench ? 'Aperçu de votre activité' : 'Overview of your activity';
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
  String get fullNameLabel => _isFrench ? 'NOM COMPLET' : 'FULL NAME';
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
      _isFrench ? 'SÉCURISÉ PAR WATSIM' : 'SECURED BY WATSIM';

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

  // Home transfer sheet
  String get homeTransfer => _isFrench ? 'Transférer' : 'Transfer';
  String get homeTransferMoney =>
      _isFrench ? 'Transférer de l\'argent' : 'Transfer Money';
  String get homeTransferSubtitle => _isFrench
      ? 'Envoyez de l\'argent à un autre utilisateur Watsim'
      : 'Send money to another Watsim user';
  String get homeTransferRecipientLabel => _isFrench
      ? 'Téléphone ou Email du destinataire'
      : 'Recipient Phone or Email';
  String get homeTransferRecipientHint => _isFrench
      ? '+237... ou email@example.com'
      : '+237... or email@example.com';
  String get homeTransferAmountLabel =>
      _isFrench ? 'Montant (FCFA)' : 'Amount (FCFA)';
  String get homeTransferNoteLabel =>
      _isFrench ? 'Note (optionnel)' : 'Note (optional)';
  String get homeTransferNoteHint =>
      _isFrench ? 'Ex: Remboursement dîner' : 'Ex: Dinner reimbursement';
  String get homeTransferMinimum => _isFrench
      ? 'Minimum: 100 FCFA • Le destinataire recevra l\'argent instantanément'
      : 'Minimum: 100 FCFA • Recipient will receive money instantly';
  String get homeTransferButton => _isFrench ? 'TRANSFÉRER' : 'TRANSFER';
  String homeTransferSuccess(String amount, String recipient) => _isFrench
      ? 'Transfert de ${amount}FCFA à $recipient effectué avec succès'
      : 'Successfully transferred ${amount}FCFA to $recipient';
  String get errorEnterRecipient => _isFrench
      ? 'Veuillez entrer un numéro de téléphone ou email'
      : 'Please enter phone number or email';
  String get errorMinAmount => _isFrench
      ? 'Le montant minimum est de 100 FCFA'
      : 'Minimum amount is 100 FCFA';
  String get errorTransferFailed =>
      _isFrench ? 'Échec du transfert' : 'Transfer failed';
  String get errorGeneric => _isFrench ? 'Erreur' : 'Error';

  // ── Bottom nav strings ──────────────────────────────────────────────────
  String get navHome => _isFrench ? 'Accueil' : 'Home';
  String get navShop => _isFrench ? 'Boutique' : 'Shop';
  String get navMessages => _isFrench ? 'Messages' : 'Messages';
  String get navHistory => _isFrench ? 'Historique' : 'History';
  String get navProfile => _isFrench ? 'Profil' : 'Profile';
  String get navReferrals => _isFrench ? 'Parrainages' : 'Referrals';

  // ── Statistics screen strings ───────────────────────────────────────────
  String get statisticsTitle => _isFrench ? 'Statistiques' : 'Statistics';
  String get walletStatistics => _isFrench ? 'Portefeuille' : 'Wallet';
  String get currentBalance => _isFrench ? 'Solde actuel' : 'Current Balance';
  String get totalDeposited => _isFrench ? 'Total déposé' : 'Total Deposited';
  String get totalWithdrawn => _isFrench ? 'Total retiré' : 'Total Withdrawn';
  String get transferStatistics => _isFrench ? 'Transferts' : 'Transfers';
  String get totalTransferredIn =>
      _isFrench ? 'Transferts reçus' : 'Transfers Received';
  String get totalTransferredOut =>
      _isFrench ? 'Transferts envoyés' : 'Transfers Sent';
  String get orderStatistics => _isFrench ? 'Commandes' : 'Orders';
  String get totalOrders => _isFrench ? 'Commandes totales' : 'Total Orders';
  String get completedOrders =>
      _isFrench ? 'Commandes terminées' : 'Completed Orders';
  String get activeOrders => _isFrench ? 'Commandes actives' : 'Active Orders';
  String get totalOrderValue =>
      _isFrench ? 'Valeur totale' : 'Total Order Value';
  String get totalPaidOnOrders => _isFrench ? 'Total payé' : 'Total Paid';
  String get remainingOnOrders => _isFrench ? 'Restant à payer' : 'Remaining';
  String get retry => _isFrench ? 'Réessayer' : 'Retry';

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
  String get supportChat =>
      _isFrench ? 'Contacter le support Watsim' : 'Chat with Watsim Support';
  String get orStartWithPhone => _isFrench
      ? 'Ou démarrez avec un numéro de téléphone'
      : 'Or start with a phone number';
  String get loading => _isFrench ? 'Chargement...' : 'Loading...';
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
      ? 'Simuler action bureau'
      : 'Simulate Office Action';
  String get officeConfirmsReceipt =>
      _isFrench ? 'Le bureau confirme la réception' : 'Office Confirms Receipt';
  String get howPayCashWorks => _isFrench
      ? 'Comment fonctionne le paiement en espèces'
      : 'How Pay in Cash works';
  String get insufficientFunds =>
      _isFrench ? 'Fonds insuffisants' : 'Insufficient funds';
  String get helloUser => _isFrench ? 'Bonjour' : 'Hello';
  String get guest => _isFrench ? 'Invité' : 'Guest';
  String get newBalanceLabel => _isFrench ? 'Nouveau solde' : 'New balance';

  // ── Shared widgets ──────────────────────────────────────────────────────
  String helloComma(String name) =>
      _isFrench ? 'Bonjour, $name' : 'Hello, $name';
  String get welcomeBackLabel =>
      _isFrench ? 'Bon retour' : 'Welcome back';
  String get stockUnknown => _isFrench ? 'Stock : --' : 'Stock: --';
  String get outOfStock => _isFrench ? 'Rupture de stock' : 'Out of stock';
  String lowStock(int stock) =>
      _isFrench ? 'Stock faible : $stock' : 'Low stock: $stock';
  String inStock(int stock) =>
      _isFrench ? 'En stock : $stock' : 'In stock: $stock';

  // ── PIN confirm dialog ──────────────────────────────────────────────────
  String get pinDialogTitle =>
      _isFrench ? 'Confirmer avec PIN' : 'Confirm with PIN';
  String get pinDialogBody => _isFrench
      ? 'Entrez votre code PIN pour confirmer cette opération.'
      : 'Enter your PIN code to confirm this operation.';
  String get enterPinError => _isFrench
      ? 'Veuillez entrer votre PIN (4 chiffres)'
      : 'Please enter your PIN (4 digits)';
  String get verifyFailed => _isFrench
      ? 'Vérification impossible. Veuillez réessayer.'
      : 'Verification unavailable. Please try again.';
  String get incorrectPinFull => _isFrench
      ? 'PIN incorrect. Veuillez réessayer.'
      : 'Incorrect PIN. Please try again.';
  String get pin4Label =>
      _isFrench ? 'PIN à 4 chiffres' : '4-digit PIN';
  String get enterPinRequired => _isFrench
      ? 'Veuillez entrer votre PIN.'
      : 'Please enter your PIN.';
  String get loginPinRequired => _isFrench
      ? 'Votre PIN de connexion est requis.'
      : 'Your login PIN is required.';
  String get orderNotLinked => _isFrench
      ? 'Commande non liée à un achat enregistré.'
      : 'Order is not linked to a backend purchase.';
  String get transferFailedRetry => _isFrench
      ? 'Échec du transfert. Réessayez.'
      : 'Transfer failed. Please try again.';
  String get withdrawFailedRetry => _isFrench
      ? 'Échec du retrait. Réessayez.'
      : 'Withdrawal failed. Please try again.';

  // ── Order sheets (delivery / transfer / withdraw / exchange) ────────────
  String get notifExchangeRefundTitle => _isFrench
      ? 'Échange terminé — Remboursement'
      : 'Exchange Complete — Refund';
  String exchangeRefundBody(String amount, String fromName, String toName) =>
      _isFrench
          ? '$amount remboursé sur votre portefeuille après l\'échange de $fromName contre $toName.'
          : '$amount refunded to your wallet after exchanging $fromName for $toName.';
  String get notifExchangeCompleteTitle =>
      _isFrench ? 'Échange terminé' : 'Exchange Complete';
  String exchangeExactCoverBody(String name) => _isFrench
      ? 'Vos fonds accumulés ont couvert exactement $name. Commande marquée terminée.'
      : 'Your accumulated funds exactly covered $name. Order marked complete.';
  String get notifProductExchanged =>
      _isFrench ? 'Produit échangé' : 'Product Exchanged';
  String productExchangedBody(
          String name, String transferred, String remaining) =>
      _isFrench
          ? 'Passé à $name. $transferred transférés. $remaining encore nécessaires.'
          : 'Switched to $name. $transferred transferred. $remaining still needed.';
  String get notifWithdrawalProcessed =>
      _isFrench ? 'Retrait effectué' : 'Withdrawal Processed';
  String withdrawalProcessedBody(
          String net, String charge, String product) =>
      _isFrench
          ? '$net crédités sur votre portefeuille après des frais de 30% ($charge) sur $product.'
          : '$net credited to your wallet after 30% charge ($charge) on $product.';
  String get exchangeCompleteTitle =>
      _isFrench ? 'Échange terminé ! 🎉' : 'Exchange Complete! 🎉';
  String exchangedFullyPaid(String name, String refund) => _isFrench
      ? 'Échangé contre $name et entièrement payé.\n$refund remboursés sur votre portefeuille.'
      : 'Exchanged for $name and fully paid off.\n$refund refunded to your wallet.';
  String exchangedExactDone(String name) => _isFrench
      ? 'Vos fonds accumulés ont couvert exactement $name. La commande est terminée !'
      : 'Your accumulated funds exactly covered $name. Order is complete!';
  String exchangedPartial(
          String name, String transferred, String remaining, String freq) =>
      _isFrench
          ? 'Échangé contre $name.\n$transferred transférés. '
              'Continuez à cotiser $remaining avec vos paiements $freq.'
          : 'Exchanged for $name.\n$transferred transferred. '
              'Keep contributing $remaining more with your $freq payments.';
  String get pinConfirmExchangeDesc => _isFrench
      ? 'Entrez votre PIN à 4 chiffres pour confirmer l\'échange.'
      : 'Enter your 4-digit PIN to confirm the exchange.';
  String pinToSendAmount(String amount, String to) => _isFrench
      ? 'Entrez votre PIN à 4 chiffres pour envoyer $amount à $to.'
      : 'Enter your 4-digit PIN to send $amount to $to.';
  String sentToWallet(String amount, String phone) => _isFrench
      ? '$amount ont été envoyés au\nportefeuille WatSim de $phone.'
      : '$amount has been sent to\n$phone\'s WatSim wallet.';
  String feeDeducted20(String amount) => _isFrench
      ? 'Des frais de service de 20% ($amount) ont été déduits de vos fonds accumulés.'
      : '20% service fee of $amount was deducted from your accumulated funds.';
  String get noWatsimAccountBody => _isFrench
      ? 'Ce numéro n\'a pas de compte WatSim vérifié. Vérifiez le numéro ou demandez au destinataire de s\'inscrire sur WatSim.'
      : 'This number does not have a verified WatSim account. Check the number or ask the recipient to register on WatSim.';
  String get enterPhoneRequired => _isFrench
      ? 'Veuillez entrer un numéro de téléphone.'
      : 'Please enter a phone number.';
  String get enterValidPhone => _isFrench
      ? 'Entrez un numéro de téléphone valide.'
      : 'Enter a valid phone number.';
  String get recipientPhoneLabel => _isFrench
      ? 'Téléphone du destinataire'
      : 'Recipient phone number';
  String amountAddedToWallet(String amount) => _isFrench
      ? '$amount ont été ajoutés à votre portefeuille.'
      : '$amount has been added to your wallet.';
  String get withdrawProductBody => _isFrench
      ? 'Retirez l\'argent accumulé sur ce produit. Des frais de traitement de 30% s\'appliquent.'
      : 'Withdraw the money accumulated on this product. A 30% processing charge applies.';
  String get charge30Warning => _isFrench
      ? '30% des fonds accumulés seront déduits comme frais de traitement.'
      : '30% of accumulated funds will be deducted as a processing charge.';
  String get charge30Label =>
      _isFrench ? 'Frais de 30%' : '30% Charge';
  String get youReceive => _isFrench ? 'Vous recevez' : 'You Receive';
  String get accumulatedAmount =>
      _isFrench ? 'Montant accumulé' : 'Accumulated Amount';
  String get processingCharge30 =>
      _isFrench ? 'Frais de traitement (30%)' : '30% Processing Charge';
  String get amountYouReceive =>
      _isFrench ? 'Montant que vous recevez' : 'Amount You Receive';
  String get noPaymentsWithdraw => _isFrench
      ? 'Aucun paiement effectué. Payez au moins un versement pour pouvoir retirer.'
      : 'No payments have been made yet. Make at least one instalment to enable withdrawal.';
  String get detailsReceived => _isFrench
      ? 'Vos informations ont été reçues !'
      : 'Your details have been received!';
  String get deliveryConfirmedThanks => _isFrench
      ? 'Merci ! Votre demande de livraison est confirmée. Vous recevrez votre produit sous peu.'
      : 'Thank you! Your delivery request is confirmed. You will receive your product shortly.';
  String get customerDetails =>
      _isFrench ? 'INFORMATIONS CLIENT' : 'CUSTOMER DETAILS';
  String get photoCaptured =>
      _isFrench ? '✓ Photo capturée' : '✓ Photo captured';
  String get notProvided => _isFrench ? 'Non fourni' : 'Not provided';
  String get capturedLabel => _isFrench ? '✓ Capturé' : '✓ Captured';
  String get deliveryTimeLabel =>
      _isFrench ? 'Heure de livraison' : 'Delivery Time';
  String get orderDetailsCaps =>
      _isFrench ? 'DÉTAILS COMMANDE' : 'ORDER DETAILS';
  String get orderNumberShort => _isFrench ? 'Commande #' : 'Order #';
  String get categoryLabel => _isFrench ? 'Catégorie' : 'Category';
  String get requestDate => _isFrench ? 'Date de demande' : 'Request Date';
  String get pricingBreakdown =>
      _isFrench ? 'DÉTAIL DES PRIX' : 'PRICING BREAKDOWN';
  String get basePrice => _isFrench ? 'Prix de base' : 'Base Price';
  String get totalFees => _isFrench ? 'Frais totaux' : 'Total Fees';
  String get paymentPlan =>
      _isFrench ? 'Plan de paiement' : 'Payment Plan';
  String get contributionsMade =>
      _isFrench ? 'Contributions effectuées' : 'Contributions Made';
  String get remainingLabel => _isFrench ? 'Restant' : 'Remaining';
  String get idFrontLabel => _isFrench ? 'Photo CNI recto' : 'ID Front';
  String get idBackLabel => _isFrench ? 'Photo CNI verso' : 'ID Back';
  String get idPhotoFront => _isFrench ? 'Photo CNI recto' : 'ID Photo Front';
  String get idPhotoBack => _isFrench ? 'Photo CNI verso' : 'ID Photo Back';
  String get deliveryAtLabel =>
      _isFrench ? 'Livraison à' : 'Delivery at';
  String get selectDeliveryTime => _isFrench
      ? 'Sélectionner l\'heure de livraison'
      : 'Select delivery time';
  String monthAbbr(int m) {
    const fr = [
      'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
      'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'
    ];
    const en = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return (_isFrench ? fr : en)[m - 1];
  }

  // ── Delivery form fields ────────────────────────────────────────────────
  String get fullNameField => _isFrench ? 'Nom complet' : 'Full name';
  String get nameRequired =>
      _isFrench ? 'Le nom est requis' : 'Name is required';
  String get phoneField => _isFrench ? 'Téléphone' : 'Phone number';
  String get phoneRequired => _isFrench
      ? 'Le numéro de téléphone est requis'
      : 'Phone number is required';
  String get professionField =>
      _isFrench ? 'Votre profession' : 'Your profession';
  String get professionRequired => _isFrench
      ? 'La profession est requise'
      : 'Profession is required';
  String get idCardPhotos =>
      _isFrench ? 'PHOTOS CNI' : 'ID CARD PHOTOS';
  String get optionalTag => _isFrench ? 'OPTIONNEL' : 'OPTIONAL';
  String get idPhotoDesc => _isFrench
      ? 'Joignez une photo de votre carte nationale d\'identité (recto et verso). Cela nous aide à vérifier votre identité plus rapidement.'
      : 'Attach a photo of your national ID card (front and back). This helps us verify your identity faster.';
  String get frontCaptured =>
      _isFrench ? 'Recto capturé ✓' : 'Front captured ✓';
  String get backCaptured =>
      _isFrench ? 'Verso capturé ✓' : 'Back captured ✓';
  String get tapCaptureFront => _isFrench
      ? 'Capturer\nRECTO'
      : 'Tap to capture\nFRONT side';
  String get tapCaptureBack => _isFrench
      ? 'Capturer\nVERSO'
      : 'Tap to capture\nBACK side';
  String get neighbourhoodCaps =>
      _isFrench ? 'QUARTIER' : 'NEIGHBOURHOOD';
  String get neighbourhoodField =>
      _isFrench ? 'Quartier' : 'Neighbourhood';
  String get neighbourhoodRequired => _isFrench
      ? 'Le quartier est requis'
      : 'Neighbourhood is required';
  String get cityCaps => _isFrench ? 'VILLE' : 'CITY';
  String get cityRequired =>
      _isFrench ? 'La ville est requise' : 'City is required';
  String get deliveryTimeCaps =>
      _isFrench ? 'HEURE DE LIVRAISON' : 'DELIVERY TIME';
  String get lastNameField => _isFrench ? 'Nom' : 'Last name';
  String get lastNameRequired => _isFrench
      ? 'Le nom est requis'
      : 'Last name is required';
  String get firstNameField => _isFrench ? 'Prénom' : 'First name';
  String get firstNameRequired => _isFrench
      ? 'Le prénom est requis'
      : 'First name is required';
  String get telCaps => _isFrench ? 'TEL' : 'PHONE';
  String get residenceCaps =>
      _isFrench ? 'LIEU RÉSIDENCE' : 'RESIDENCE';
  String get residenceField =>
      _isFrench ? 'Lieu de résidence' : 'Place of residence';
  String get residenceRequired => _isFrench
      ? 'Le lieu de résidence est requis'
      : 'Place of residence is required';
  String get deliveryLocationCaps =>
      _isFrench ? 'LIEU LIVRAISON' : 'DELIVERY LOCATION';
  String get deliveryLocationField =>
      _isFrench ? 'Lieu de livraison' : 'Delivery location';
  String get deliveryLocationRequired => _isFrench
      ? 'Le lieu de livraison est requis'
      : 'Delivery location is required';
  String get colorCaps => _isFrench ? 'COULEUR' : 'COLOUR';
  String get colorField =>
      _isFrench ? 'Couleur souhaitée' : 'Preferred colour';
  String get shoeSizeCaps => _isFrench ? 'POINTURE' : 'SHOE SIZE';
  String get shoeSizeField => _isFrench ? 'Pointure' : 'Shoe size';
  String get cniField => _isFrench ? 'Numéro CNI' : 'ID number';
  String get cniRequired => _isFrench
      ? 'Le numéro CNI est requis'
      : 'ID number is required';
  String get recipientLabel =>
      _isFrench ? 'Destinataire' : 'Recipient';
  String get phoneLabel => _isFrench ? 'Téléphone' : 'Phone';
  String get neighbourhoodLabel =>
      _isFrench ? 'Quartier' : 'Neighbourhood';
  String get cityLabel => _isFrench ? 'Ville' : 'City';
  String get shoeSizeLabel => _isFrench ? 'Pointure' : 'Shoe Size';
  String get colorLabel => _isFrench ? 'Couleur' : 'Colour';
  String get residenceLabel =>
      _isFrench ? 'Lieu résidence' : 'Residence';
  String get deliveryLocationLabel =>
      _isFrench ? 'Lieu livraison' : 'Delivery Location';
  String get cniLabel => _isFrench ? 'CNI' : 'ID Number';

  String minutesAgoFmt(int m) =>
      _isFrench ? 'il y a ${m}min' : '${m}m ago';
  String daysAgoFmt(int d) =>
      _isFrench ? 'il y a ${d}j' : '${d}d ago';

  // ── Wallet / order state strings ────────────────────────────────────────
  String depositVia(String provider) =>
      _isFrench ? 'Dépôt via $provider' : 'Deposit via $provider';
  String withdrawalVia(String provider) =>
      _isFrench ? 'Retrait via $provider' : 'Withdrawal via $provider';
  String get withdrawalTx => _isFrench ? 'Retrait' : 'Withdrawal';
  String get bnplPurchaseTx =>
      _isFrench ? 'Achat BNPL' : 'BNPL Purchase';
  String get bnplRepaymentTx =>
      _isFrench ? 'Remboursement BNPL' : 'BNPL Repayment';
  String get refundTx => _isFrench ? 'Remboursement' : 'Refund';
  String get transactionTx => _isFrench ? 'Transaction' : 'Transaction';
  String refundFor(String name) =>
      _isFrench ? 'Remboursement — $name' : 'Refund — $name';
  String transferReceivedTx(String sender) => _isFrench
      ? 'Transfert reçu — $sender'
      : 'Transfer received — $sender';
  String get cashDepositTxTitle => _isFrench
      ? 'Dépôt en espèces via un agent Watsim'
      : 'Cash deposit via a Watsim agent';
  String get cashAdjustmentPlus => _isFrench
      ? 'Ajustement de dépôt en espèces (+)'
      : 'Cash deposit adjustment (+)';
  String get cashAdjustment => _isFrench
      ? 'Ajustement de dépôt en espèces'
      : 'Cash deposit adjustment';
  String get dayWord => _isFrench ? 'jour' : 'day';
  String get weekWord => _isFrench ? 'semaine' : 'week';
  String get monthWord => _isFrench ? 'mois' : 'month';
  String durationDays(int n) => _isFrench ? '$n jours' : '$n days';
  String durationWeeks(int n) =>
      _isFrench ? '$n semaines' : '$n weeks';
  String durationMonths(int n) =>
      _isFrench ? '$n mois' : '$n month${n > 1 ? 's' : ''}';
  String get allPaidCheck => _isFrench ? 'Tout payé ✓' : 'All paid ✓';
  String get nextPaymentToday => _isFrench
      ? 'Prochain paiement : aujourd\'hui'
      : 'Next payment: Today';
  String nextPaymentOn(String dayMonth) =>
      _isFrench ? 'Prochain paiement : $dayMonth' : 'Next payment: $dayMonth';
  String get completedCheck => _isFrench ? 'Terminé ✓' : 'Completed ✓';
  String endsOnDate(String date) =>
      _isFrench ? 'Se termine le $date' : 'Ends $date';
  String get unknownProduct =>
      _isFrench ? 'Produit inconnu' : 'Unknown Product';
  String get generalCategory => _isFrench ? 'Général' : 'General';
  String get instalmentWord => _isFrench ? 'Versement' : 'Instalment';

  // ── Misc screen strings ─────────────────────────────────────────────────
  String get okLabel => 'OK';
  String get pendingLabel => _isFrench ? 'En attente' : 'Pending';
  String get unverified => _isFrench ? 'Non vérifié' : 'Unverified';
  String get scoreGood => _isFrench ? 'BON' : 'GOOD';
  String get scoreFair => _isFrench ? 'CORRECT' : 'FAIR';
  String get scoreLow => _isFrench ? 'FAIBLE' : 'LOW';
  String get featuredAdsHere => _isFrench
      ? 'Les publicités en vedette apparaîtront ici'
      : 'Featured ads will appear here';
  String get adLabel => _isFrench ? 'PUBLICITÉ' : 'AD';
  String get viewOffer => _isFrench ? 'Voir l\'offre' : 'View offer';
  String get perLabel => _isFrench ? 'par' : 'per';
  String get noOffers => _isFrench
      ? 'Aucune offre exclusive disponible'
      : 'No exclusive offers available';
  String get checkBackDeals => _isFrench
      ? 'Revenez plus tard pour des offres spéciales'
      : 'Check back later for special deals';
  String get ongoing => _isFrench ? 'EN COURS' : 'ONGOING';
  String get paymentSentSynced => _isFrench
      ? 'Paiement envoyé. Solde synchronisé.'
      : 'Payment sent. Balance synchronised.';
  String get profilePicUpdated => _isFrench
      ? 'Photo de profil mise à jour'
      : 'Profile picture updated successfully';
  String uploadImageFailed(String e) => _isFrench
      ? 'Échec du téléchargement de l\'image : $e'
      : 'Failed to upload image: $e';
  String updateProfileFailed(String e) => _isFrench
      ? 'Échec de la mise à jour du profil : $e'
      : 'Failed to update profile: $e';
  String get updateSettingFailed => _isFrench
      ? 'Échec de la mise à jour du paramètre'
      : 'Failed to update setting';
  String get freezeAccountFailed => _isFrench
      ? 'Échec du gel du compte'
      : 'Failed to freeze account';
  String get pinChangedSuccess =>
      _isFrench ? 'PIN modifié avec succès' : 'PIN changed successfully';
  String get pinSetFailed => _isFrench
      ? 'Échec de la définition du PIN. Réessayez.'
      : 'Failed to set PIN. Try again.';
  String get openingCamera =>
      _isFrench ? 'Ouverture de la caméra...' : 'Opening camera...';
  String get retake => _isFrench ? 'Reprendre' : 'Retake';
  String get identityVerification =>
      _isFrench ? 'Vérification d\'identité' : 'Identity Verification';
  String stepOf(int step, int total) =>
      _isFrench ? 'Étape $step sur $total' : 'Step $step of $total';
  String get messageNotSent => _isFrench
      ? 'Le message n\'a pas pu être envoyé.'
      : 'The message could not be sent.';
  String get messageSentOnReconnect => _isFrench
      ? 'Le message sera envoyé à la reconnexion'
      : 'Message will be sent when reconnected';
  String get biometricUnavailable => _isFrench
      ? 'Biométrie non activée ou indisponible'
      : 'Biometric authentication not enabled or available';
  String get maximumDuration =>
      _isFrench ? 'Durée maximale' : 'Maximum Duration';
  String get feeBreakdown =>
      _isFrench ? 'Détail des frais' : 'Fee Breakdown';
  String get collectionFeeLabel =>
      _isFrench ? 'Frais de collecte' : 'Collection Fee';
  String get walletLabel => _isFrench ? 'Portefeuille' : 'Wallet';
  String get accumulatedLabel2 =>
      _isFrench ? 'Accumulé' : 'Accumulated';

  // ── History / statistics screen ─────────────────────────────────────────
  String get receivedLabel => _isFrench ? 'Reçu' : 'Received';
  String get spentLabel => _isFrench ? 'Dépensé' : 'Spent';
  String get netLabel => 'Net';
  String get browseOrdersBody => _isFrench
      ? 'Parcourez notre catalogue et passez votre première\ncommande BNPL pour la voir ici.'
      : 'Browse our catalogue and place your first\nBNPL order to see it here.';
  String get noTxMatchFilters => _isFrench
      ? 'Aucune transaction ne correspond à vos filtres'
      : 'No transactions match your filters';
  String get tryDifferentFilter => _isFrench
      ? 'Essayez un autre filtre pour voir votre historique.'
      : 'Try a different filter to see your history.';
  String get firstDepositBody => _isFrench
      ? 'Effectuez votre premier dépôt pour suivre\nvos transactions ici.'
      : 'Make your first deposit to start\ntracking your transactions here.';
  String get thisWeek => _isFrench ? 'Cette semaine' : 'This Week';
  String get thisMonth => _isFrench ? 'Ce mois-ci' : 'This Month';
  String get last3Months => _isFrench ? '3 derniers mois' : 'Last 3 Months';
  String get thisYear => _isFrench ? 'Cette année' : 'This Year';
  String get clearFilter =>
      _isFrench ? 'Effacer le filtre' : 'Clear Filter';
  String get periodWeek => _isFrench ? 'Semaine' : 'Week';
  String get periodMonth => _isFrench ? 'Mois' : 'Month';
  String get periodQuarter => _isFrench ? 'Trimestre' : 'Quarter';
  String get periodYear => _isFrench ? 'Année' : 'Year';
  String get incomeLabel => _isFrench ? 'Revenus' : 'Income';
  String get expensesLabel => _isFrench ? 'Dépenses' : 'Expenses';
  String get netBalance => _isFrench ? 'Solde net' : 'Net Balance';
  String get statsAppearBody => _isFrench
      ? 'Vos statistiques de dépenses apparaîtront\nici une fois vos transactions effectuées.'
      : 'Your spending statistics will appear\nhere once you make transactions.';
  String get chargebackNote => _isFrench
      ? 'Des frais de rétrofacturation de 30% s\'appliquent à tous les retraits.'
      : 'A 30% chargeback fee applies to all withdrawals.';
  String get chargeback30 =>
      _isFrench ? 'Rétrofacturation 30%' : '30% Chargeback';
  String get deliveredStatus => _isFrench ? 'Livré' : 'Delivered';
  String get inProgressStatus =>
      _isFrench ? 'En cours' : 'In Progress';
  String get orderedLabel => _isFrench ? 'Commandé' : 'Ordered';
  String get nextDueLabel =>
      _isFrench ? 'Prochaine échéance' : 'Next due';
  String get planLabel => _isFrench ? 'Plan' : 'Plan';
  String get withdrawnLabel => _isFrench ? 'Retiré' : 'Withdrawn';
  String get requestedLabel => _isFrench ? 'Demandé' : 'Requested';
  String get deliveryAction => _isFrench ? 'Livraison' : 'Delivery';

  // ── Order detail screen ─────────────────────────────────────────────────
  String get paymentImpossible => _isFrench
      ? 'Paiement impossible. Veuillez réessayer.'
      : 'Payment failed. Please try again.';
  String get endedLabel => _isFrench ? 'Terminé' : 'Ended';
  String get oneDayLeft => _isFrench ? '1 jour restant' : '1 day left';
  String daysLeftFmt(int n) =>
      _isFrench ? '$n jours restants' : '$n days left';
  String get orderNumber =>
      _isFrench ? 'N° de commande' : 'Order number';
  String get timeRemaining =>
      _isFrench ? 'Temps restant' : 'Time remaining';
  String get completedOn => _isFrench ? 'Terminé le' : 'Completed on';
  String get contributionEnds =>
      _isFrench ? 'Fin de la contribution' : 'Contribution ends';
  String get ongoingStatus => _isFrench ? 'En cours' : 'Ongoing';
  String get paymentProgress => _isFrench
      ? 'PROGRÈS DU PAIEMENT'
      : 'PAYMENT PROGRESS';
  String get deliveredThankYou => _isFrench
      ? 'Votre produit a été livré avec succès. Merci d\'utiliser WatSim !'
      : 'Your product was successfully delivered. Thank you for using WatSim!';
  String contributionsMadeOf(int paid, int total) => _isFrench
      ? '$paid versements sur $total effectués'
      : '$paid of $total contributions made';
  String accumulatedAmountLabel(String amt) =>
      _isFrench ? '$amt accumulé' : '$amt accumulated';
  String remainingCountFmt(int n) => _isFrench
      ? '$n restant${n > 1 ? 's' : ''}'
      : '$n remaining';
  String get allPaidLabel => _isFrench ? 'Tout payé' : 'All paid';
  String get upcomingLabel => _isFrench ? 'À venir' : 'Upcoming';
  String contributionsCount(int i, int total) =>
      _isFrench ? 'Versement $i/$total' : 'Contribution $i/$total';
  String leftAmount(String amt) =>
      _isFrench ? '$amt restant' : '$amt left';
  String get paidCheck => _isFrench ? 'Payé ✓' : 'Paid ✓';
  String get completeLabel => _isFrench ? 'Terminé' : 'Complete';
  String get inProgressLabel =>
      _isFrench ? 'En cours' : 'In Progress';

  // ── BNPL simulator extras ───────────────────────────────────────────────
  String get durationPrompt => _isFrench
      ? 'Combien de temps vous faudra-t-il pour finir de cotiser pour ce produit ?'
      : 'How long will it take you to finish contributing for this product?';
  String get monthsHint => _isFrench ? '1-60 mois' : '1-60 months';
  String get monthsSuffix => _isFrench ? 'mois' : 'months';
  String get maxDurationBody => _isFrench
      ? 'La simulation BNPL est disponible jusqu\'à 60 mois (5 ans) maximum. La durée a été définie à 60 mois.'
      : 'BNPL simulation is available for up to 60 months (5 years) maximum. The duration has been set to 60 months.';
  String get calculatingPlan => _isFrench
      ? 'Calcul de votre plan...'
      : 'Calculating your plan...';
  String get paymentAmountOptions => _isFrench
      ? 'Options de montant de paiement'
      : 'Payment Amount Options';
  String basedOnMonths(int n) => _isFrench
      ? 'Basé sur une période de contribution de $n mois'
      : 'Based on $n ${n == 1 ? 'month' : 'months'} contribution period';
  String paymentsCount(int n) =>
      _isFrench ? '$n versements' : '$n payments';
  String get totalCostBreakdown => _isFrench
      ? 'Détail du coût total'
      : 'Total Cost Breakdown';
  String get downPaymentUpfront => _isFrench
      ? 'Apport initial (payé d\'avance)'
      : 'Down Payment (Paid Upfront)';
  String get amountToFinance =>
      _isFrench ? 'Montant à financer' : 'Amount to Finance';
  String get firstPurchaseSuffix =>
      _isFrench ? '(Premier achat)' : '(First Purchase)';
  String get waivedSuffix => _isFrench ? '(Exonéré)' : '(Waived)';
  String get firstPurchaseNote => _isFrench
      ? 'C\'est votre premier achat BNPL - les frais de création de compte s\'appliquent.'
      : 'This is your first BNPL purchase - account creation fee applies.';
  String get biometricPurchaseReason => _isFrench
      ? 'Confirmez l\'achat par biométrie'
      : 'Confirm purchase with biometric';
  String get grandTotal => _isFrench ? 'Total général' : 'Grand Total';
  String get referralBalanceLabel =>
      _isFrench ? 'Solde de parrainage' : 'Referral Balance';
  String get repaymentLabel =>
      _isFrench ? 'Remboursement' : 'Repayment';

  String get chatFallback => _isFrench ? 'Discussion' : 'Chat';
  String get unknownTxLabel => _isFrench ? 'Inconnu' : 'Unknown';
  String get cashbackRewardsOp =>
      _isFrench ? 'Récompenses cashback' : 'Cashback Rewards';
  String get refStep1 => _isFrench
      ? 'Partagez votre code de parrainage avec vos amis'
      : 'Share your referral code with friends';
  String get refStep2 => _isFrench
      ? 'Votre ami s\'inscrit avec votre code'
      : 'Friend signs up using your code';
  String get refStep3 => _isFrench
      ? 'Vous gagnez tous les deux 1000 FCFA à son premier dépôt'
      : 'You both earn 1000 FCFA on their first deposit';
  String get refStep4 => _isFrench
      ? 'Vous gagnez 0.6% lorsqu\'il finalise un achat BNPL'
      : 'You earn 0.6% when they complete a BNPL purchase';
  String get firstReward =>
      _isFrench ? 'Première récompense' : 'First Reward';

  // ── Security screen ─────────────────────────────────────────────────────
  String get freezeConfirm => _isFrench
      ? 'Êtes-vous sûr de vouloir geler votre compte ?'
      : 'Are you sure you want to freeze your account?';
  String get freezeBody => _isFrench
      ? 'Une fois gelé, toutes les transactions et connexions seront bloquées. Vous pouvez dégeler à tout moment en contactant le support.'
      : 'While frozen, all transactions and logins will be blocked. You can unfreeze at any time by contacting support.';
  String get loadSecurityFailed => _isFrench
      ? 'Échec du chargement des paramètres de sécurité'
      : 'Failed to load security settings';
  String get retryLabel => _isFrench ? 'Réessayer' : 'Retry';
  String get notAvailableDevice => _isFrench
      ? 'Non disponible sur cet appareil'
      : 'Not available on this device';
  String methodsActive(int n) => _isFrench
      ? '$n méthode${n > 1 ? 's' : ''} active${n > 1 ? 's' : ''}'
      : '$n method${n > 1 ? 's' : ''} active';
  String get biometricTypes => _isFrench
      ? 'Empreinte / Face ID / Iris'
      : 'Fingerprint / Face ID / Iris';
  String get biometricNotEnrolled => _isFrench
      ? 'La biométrie n\'est pas disponible ou non configurée sur cet appareil. Vérifiez les paramètres de votre appareil.'
      : 'Biometric authentication is not available on this device or not enrolled. Please check your device settings.';
  String get fingerprintLabel =>
      _isFrench ? 'Empreinte digitale' : 'Fingerprint';
  String get faceIdLabel => 'Face ID';
  String get verifiedExcl => _isFrench ? 'Vérifié !' : 'Verified!';
  String get scanningLabel =>
      _isFrench ? 'Numérisation…' : 'Scanning…';
  String enabledSuffix(String label) =>
      _isFrench ? '$label activé' : '$label enabled';
  String placeOnSensor(String label) => _isFrench
      ? 'Placez votre $label sur le capteur'
      : 'Place your $label on the sensor';
  String get stepCurrentPin => _isFrench
      ? 'Entrez votre PIN actuel'
      : 'Enter your current PIN';
  String get stepNewPin => _isFrench
      ? 'Entrez votre nouveau PIN'
      : 'Enter your new PIN';
  String get stepConfirmPin => _isFrench
      ? 'Confirmez votre nouveau PIN'
      : 'Confirm your new PIN';
  String get pinsDontMatch => _isFrench
      ? 'Les PIN ne correspondent pas. Réessayez.'
      : 'PINs do not match. Try again.';
  String changePinFailed(String e) => _isFrench
      ? 'Échec de la modification du PIN : $e'
      : 'Failed to change PIN: $e';
  String get changePinTitle =>
      _isFrench ? 'Modifier le PIN' : 'Change PIN';
  String get accountFrozenDone =>
      _isFrench ? 'Compte gelé' : 'Account Frozen';
  String get freezingAccount =>
      _isFrench ? 'Gel du compte…' : 'Freezing Account…';
  String get frozenBody => _isFrench
      ? 'Votre compte a été gelé.\nContactez le support pour le dégeler.'
      : 'Your account has been frozen.\nContact support to unfreeze.';
  String get securingAccount => _isFrench
      ? 'Veuillez patienter pendant que nous sécurisons votre compte'
      : 'Please wait while we secure your account';
  String get biometricVerifyFailed => _isFrench
      ? 'Vérification biométrique échouée. Veuillez réessayer.'
      : 'Biometric verification failed. Please try again.';
  String biometricEnableReason(String label) => _isFrench
      ? 'Vérifiez votre $label pour activer la connexion biométrique'
      : 'Verify your $label to enable biometric login';

  String get kycPendingLabel =>
      _isFrench ? 'KYC en attente' : 'KYC Pending';
  String get exchangeBanner => _isFrench
      ? 'Sélectionnez un produit à échanger — votre montant payé est reporté'
      : 'Select a product to exchange — your paid amount carries over';
  String get selectCaps => _isFrench ? 'SÉLECTIONNER' : 'SELECT';
  String get activeStatus => _isFrench ? 'ACTIF' : 'ACTIVE';
  String get settledStatus => _isFrench ? 'SOLDÉ' : 'SETTLED';

  String get noSubject => _isFrench ? 'Sans objet' : 'No subject';
  String get adNameFallback =>
      _isFrench ? 'Publicité' : 'Advertisement';
  String ticketStatusLabel(String status) {
    switch (status) {
      case 'OPEN':
        return _isFrench ? 'OUVERT' : 'OPEN';
      case 'IN_PROGRESS':
        return _isFrench ? 'EN COURS' : 'IN PROGRESS';
      case 'RESOLVED':
        return _isFrench ? 'RÉSOLU' : 'RESOLVED';
      case 'CLOSED':
        return _isFrench ? 'FERMÉ' : 'CLOSED';
      default:
        return status;
    }
  }

  String ticketPriorityLabel(String priority) {
    switch (priority) {
      case 'LOW':
        return _isFrench ? 'BASSE' : 'LOW';
      case 'MEDIUM':
        return _isFrench ? 'MOYENNE' : 'MEDIUM';
      case 'HIGH':
        return _isFrench ? 'HAUTE' : 'HIGH';
      case 'URGENT':
        return _isFrench ? 'URGENTE' : 'URGENT';
      default:
        return priority;
    }
  }

  // ── PIN setup / KYC (otp_screen) ────────────────────────────────────────
  String get createPinTitle =>
      _isFrench ? 'Créez votre PIN' : 'Create your PIN';
  String get confirmPinTitle =>
      _isFrench ? 'Confirmez votre PIN' : 'Confirm your PIN';
  String get reenterPinHint => _isFrench
      ? 'Ressaisissez le même PIN pour confirmer'
      : 'Re-enter the same PIN to confirm';
  String get pinSecures => _isFrench
      ? 'Ce PIN sécurise vos transactions'
      : 'This PIN secures your transactions';
  String stepCaps(int a, int b) =>
      _isFrench ? 'ÉTAPE $a SUR $b' : 'STEP $a OF $b';
  String kycStepOf(int a, int b) =>
      _isFrench ? 'Étape $a sur $b' : 'Step $a of $b';
  String get pinWarning => _isFrench
      ? 'N\'utilisez pas de combinaisons simples\ncomme 1234 ou 0000.'
      : 'Don\'t use simple combinations\nlike 1234 or 0000.';
  String get docFrontTitle =>
      _isFrench ? 'Pièce d\'identité — Recto' : 'ID Card — Front';
  String get docBackTitle =>
      _isFrench ? 'Pièce d\'identité — Verso' : 'ID Card — Back';
  String get docFrontDesc => _isFrench
      ? 'Prenez une photo nette du RECTO de votre carte d\'identité nationale. Assurez-vous que tout le texte est lisible et que la carte est entièrement visible.'
      : 'Take a clear photo of the FRONT side of your national identity card. Make sure all text is legible and the card is fully visible.';
  String get docBackDesc => _isFrench
      ? 'Prenez une photo nette du VERSO de votre carte d\'identité nationale. Assurez-vous que tout le texte est lisible et que la carte est entièrement visible.'
      : 'Take a clear photo of the BACK side of your national identity card. Make sure all text is legible and the card is fully visible.';
  String get cameraError => _isFrench
      ? 'Impossible d\'ouvrir la caméra. Veuillez accorder la permission de la caméra.'
      : 'Could not open camera. Please grant camera permission.';
  String get uploadFailedConn => _isFrench
      ? 'Échec du téléversement. Vérifiez votre connexion internet.'
      : 'Upload failed. Check your internet connection.';
  String get fullLegalName =>
      _isFrench ? 'Nom légal complet' : 'Full Legal Name';
  String get dobLabel => _isFrench
      ? 'Date de naissance (JJ/MM/AAAA)'
      : 'Date of Birth (DD/MM/YYYY)';
  String get idTypeLabel => _isFrench ? 'Type de pièce' : 'ID Type';
  String get idNumberLabel =>
      _isFrench ? 'Numéro de pièce' : 'ID Number';
  String get residentialAddress =>
      _isFrench ? 'Adresse de résidence' : 'Residential Address';
  String get kycInfoBanner => _isFrench
      ? 'Ces informations doivent correspondre exactement à vos documents officiels.'
      : 'This information must match your official identity documents exactly.';
  String get tapPhoto => _isFrench
      ? 'Touchez pour prendre une photo'
      : 'Tap to take a photo';
  String get useCameraDoc => _isFrench
      ? 'Utilisez votre caméra pour capturer le document'
      : 'Use your camera to capture the document';
  String get kycPrivacyBanner => _isFrench
      ? 'Vos documents sont chiffrés et stockés en toute sécurité. Nous respectons toutes les réglementations sur la protection des données.'
      : 'Your documents are encrypted and stored securely. We comply with all data protection regulations.';
  String get stepPersonalInfo =>
      _isFrench ? 'Informations personnelles' : 'Personal Information';
  String get submitVerification => _isFrench
      ? 'Soumettre la vérification'
      : 'Submit Verification';
  String get retakeLabel => _isFrench ? 'Reprendre' : 'Retake';
  String get onBadge => _isFrench ? 'ACTIF' : 'ON';
  String idTypeDisplay(String t) {
    if (!_isFrench) return t;
    switch (t) {
      case 'National ID':
        return 'Carte d\'identité nationale';
      case 'Passport':
        return 'Passeport';
      case 'Driver\'s License':
        return 'Permis de conduire';
      case 'Residence Permit':
        return 'Titre de séjour';
      default:
        return t;
    }
  }

  // ── Input hint examples ─────────────────────────────────────────────────
  String get hintName =>
      _isFrench ? 'ex. Jean-Paul Mbarga' : 'e.g. Jean-Paul Mbarga';
  String get hintPhonePlus => _isFrench
      ? 'ex. +237 6XX XXX XXX'
      : 'e.g. +237 6XX XXX XXX';
  String get hintJob => _isFrench
      ? 'ex. Ingénieur, Enseignant, Commerçant…'
      : 'e.g. Engineer, Teacher, Trader…';
  String get hintQuarter =>
      _isFrench ? 'ex. Bastos, Nlongkak…' : 'e.g. Bastos, Nlongkak…';
  String get hintCity =>
      _isFrench ? 'ex. Yaoundé, Douala…' : 'e.g. Yaoundé, Douala…';
  String get hintSurname => _isFrench ? 'ex. Mbarga' : 'e.g. Mbarga';
  String get hintFirstName =>
      _isFrench ? 'ex. Jean-Paul' : 'e.g. Jean-Paul';
  String get hintQuarterCity =>
      _isFrench ? 'ex. Bastos, Yaoundé' : 'e.g. Bastos, Yaoundé';
  String get hintLandmark => _isFrench
      ? 'ex. Carrefour Nlongkak'
      : 'e.g. Carrefour Nlongkak';
  String get hintColor => _isFrench
      ? 'ex. Noir, Blanc, Rouge…'
      : 'e.g. Black, White, Red…';
  String get hintSize => _isFrench ? 'ex. 42, 38…' : 'e.g. 42, 38…';
  String get hintIdNum =>
      _isFrench ? 'ex. 123456789' : 'e.g. 123456789';
  String get hintPhoneNum =>
      _isFrench ? 'ex. 655000001' : 'e.g. 655000001';


  String get invalidDepositResponse => _isFrench
      ? 'Réponse de dépôt invalide.'
      : 'Invalid deposit response.';

  String get status => _isFrench ? 'Statut' : 'Status';
  String get paidChip => _isFrench ? 'Payé' : 'Paid';
  String get contributionWord =>
      _isFrench ? 'Cotisation' : 'Contribution';
  String paidOf(int paid, int total) =>
      _isFrench ? '$paid/$total payées' : '$paid/$total paid';

  String get biometricAuthReason => _isFrench
      ? 'Authentifiez-vous pour accéder à votre compte WATSIM'
      : 'Authenticate to access your WATSIM account';

  // ── API error translation ───────────────────────────────────────────────
  /// Translates a backend/API error message into the current locale.
  /// Falls back to the raw message when it is unknown.
  String translateApiMessage(String msg) {
    final lower = msg.toLowerCase();
    String pick(String fr, String en) => _isFrench ? fr : en;
    if (lower.contains('account is frozen')) {
      return pick(
          'Ce compte est gelé. Contactez le support pour le débloquer.',
          'This account is frozen. Contact support to unfreeze.');
    }
    if (lower.contains('suspended') || lower.contains('deactivated')) {
      return pick('Ce compte est suspendu ou désactivé.',
          'This account is suspended or deactivated');
    }
    if (lower.contains('insufficient')) {
      return pick('Solde insuffisant.', 'Insufficient balance');
    }
    if (lower.contains('incorrect pin') ||
        lower.contains('invalid pin') ||
        lower.contains('pin is incorrect')) {
      return pick('PIN incorrect.', 'Incorrect PIN');
    }
    if (lower.contains('pin not configured') || lower.contains('no pin set')) {
      return pick('PIN non configuré.', 'PIN not configured');
    }
    if (lower.contains('pin is required')) {
      return pick('Le PIN est requis.', 'PIN is required');
    }
    if (lower.contains('minimum withdrawal')) {
      return pick('Le montant de retrait minimum est de 1 000 FCFA.',
          'Minimum withdrawal is 1000 FCFA');
    }
    if (lower.contains('minimum transfer')) {
      return pick('Le montant minimum de transfert est de 100 FCFA.',
          'Minimum transfer amount is 100 FCFA');
    }
    if (lower.contains('valid phone') || lower.contains('invalid phone')) {
      return pick('Numéro de téléphone valide requis.',
          'Valid phone number required');
    }
    if (lower.contains('recipient not found')) {
      return pick(
          'Destinataire introuvable. Vérifiez le numéro ou l\'email.',
          'Recipient not found. Please check the phone number or email.');
    }
    if (lower.contains('cannot transfer to yourself')) {
      return pick('Vous ne pouvez pas vous transférer à vous-même.',
          'Cannot transfer to yourself');
    }
    if (lower.contains('sender not found')) {
      return pick('Expéditeur introuvable.', 'Sender not found');
    }
    if (lower.contains('transfer failed')) {
      return pick('Échec du transfert. Veuillez réessayer.',
          'Transfer failed. Please try again.');
    }
    if (lower.contains('invalid referral')) {
      return pick('Code de parrainage invalide.', 'Invalid referral code');
    }
    if (lower.contains('referral code is required')) {
      return pick('Le code de parrainage est requis.',
          'Referral code is required');
    }
    if (lower.contains('already registered') || lower.contains('already exists')) {
      return pick('Ce numéro ou email est déjà enregistré.',
          'Phone number or email already registered');
    }
    if (lower.contains('invalid credentials')) {
      return pick('Identifiants incorrects.', 'Invalid credentials');
    }
    if (lower.contains('rate limit') || lower.contains('too many requests')) {
      return pick('Trop de requêtes. Veuillez réessayer plus tard.',
          'Rate limit exceeded. Please retry later.');
    }
    if (lower.contains('session') && lower.contains('expired')) {
      return pick('Votre session a expiré. Veuillez vous reconnecter.',
          'Your session has expired. Please sign in again.');
    }
    if (lower.contains('invalid or missing') || lower.contains('unauthorized')) {
      return pick('Session invalide. Veuillez vous reconnecter.',
          'Invalid or expired session. Please sign in again.');
    }
    if (lower.contains('admin access')) {
      return pick('Accès administrateur requis.', 'Admin access required');
    }
    if (lower.contains('method must be') || lower.contains('invalid method')) {
      return pick('Méthode de retrait invalide.', 'Invalid withdrawal method');
    }
    if (lower.contains('provider must be')) {
      return pick('Opérateur invalide.', 'Invalid provider');
    }
    if (lower.contains('amount must be')) {
      return pick('Montant invalide.', 'Invalid amount');
    }
    if (lower.contains('transaction not found')) {
      return pick('Transaction introuvable.', 'Transaction not found');
    }
    if (lower.contains('notification not found')) {
      return pick('Notification introuvable.', 'Notification not found');
    }
    if (lower.contains('user not found') ||
        lower.contains('no user found')) {
      return pick('Utilisateur introuvable.', 'User not found');
    }
    if (lower.contains('not found') || lower.contains('introuvable')) {
      return pick('Élément introuvable.', 'Not found');
    }
    if (lower.contains('file too large') || lower.contains('image too large')) {
      return pick('Fichier trop volumineux (max 5 Mo).',
          'File too large (max 5MB)');
    }
    if (lower.contains('only image')) {
      return pick('Seuls les fichiers image sont acceptés.',
          'Only image files allowed');
    }
    if (lower.contains('upload')) {
      return pick('Échec du téléchargement de l\'image.',
          'Failed to upload image');
    }
    if (lower.contains('message too long')) {
      return pick('Message trop long.', 'Message too long');
    }
    if (lower.contains('not a participant')) {
      return pick('Vous n\'êtes pas participant de cette conversation.',
          'Not a participant in this conversation');
    }
    if (lower.contains('failed to send')) {
      return pick('Échec de l\'envoi du message.', 'Failed to send message');
    }
    if (lower.contains('withdrawal rejected')) {
      return pick('Retrait rejeté.', 'Withdrawal rejected');
    }
    if (lower.contains('awaiting admin')) {
      return pick('En attente de validation.', 'Awaiting admin approval');
    }
    if (lower.contains('message is required')) {
      return pick('Le message est requis.', 'Message is required');
    }
    return msg;
  }

  /// Returns a localized message for any error thrown by API calls.
  String apiError(Object error) {
    if (error is ApiException) return translateApiMessage(error.message);
    return translateApiMessage(error.toString());
  }

  String get depositLabel => _isFrench ? 'Dépôt' : 'Deposit';
  String get recipientMustHaveWatsim => _isFrench
      ? 'Le destinataire doit avoir un compte Watsim'
      : 'Recipient must have a Watsim account';
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
