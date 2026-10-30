import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../wallet_state.dart';
import '../notification_state.dart';

// ─── Deposit Screen ───────────────────────────────────────────────────────
class DepositScreen extends StatefulWidget {
  const DepositScreen({super.key});

  @override
  State<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends State<DepositScreen> {
  int _operator = 0;
  int _amount = 25000;
  final _amountCtrl = TextEditingController(text: '25000');

  // Cash deposit state
  bool _cashPending = false;
  int _cashRequestedAmount = 0;

  // Payment loading state
  bool _paying = false;
  String? _payError;

  // Phone number for mobile money
  final _phoneCtrl = TextEditingController();

  final _operators = [
    {
      'name': 'Orange Money',
      'sub': LanguageService().isFrench
          ? 'Frais : 0% • Instantané'
          : 'Fee: 0% • Instant',
      'color': 0xFFFF6600,
      'logo': 'assets/images/orange-money.png'
    },
    {
      'name': 'MTN MoMo',
      'sub': LanguageService().isFrench
          ? 'Frais : 0% • Instantané'
          : 'Fee: 0% • Instant',
      'color': 0xFFFFCC00,
      'logo': 'assets/images/momo.png'
    },
    {
      'name': 'Payer en espèces',
      'sub': LanguageService().isFrench
          ? 'Frais : 0% • Collecté par un agent Watsim'
          : 'Fee: 0% • Collected by a Watsim agent',
      'color': 0xFF4CAF50,
      'logo': null
    },
  ];

  bool get _isCashSelected => _operator == 2;

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(() {
      final parsed = int.tryParse(
              _amountCtrl.text.replaceAll(' ', '').replaceAll(',', '')) ??
          0;
      if (parsed != _amount) {
        setState(() => _amount = parsed);
      }
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _processMoMoDeposit() async {
    if (_amount < 1) return;
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _payError = LanguageProvider.of(context).isFrench
          ? 'Veuillez entrer votre numéro mobile money.'
          : 'Please enter your mobile money phone number.');
      return;
    }
    final providerKey = _operator == 0 ? 'ORANGE_MONEY' : 'MTN_MOMO';
    final opName = _operators[_operator]['name'] as String;
    setState(() {
      _paying = true;
      _payError = null;
    });
    try {
      apiLog('DEPOSIT: Creating transaction...');
      final result = await ApiService.initiateDeposit(
        amount: _amount,
        provider: providerKey,
        phone: phone,
      );
      NotificationState.instance.onDepositCompleted(_amount, opName);
      if (!mounted) return;
      setState(() => _paying = false);
      final txId = result['transactionId'] as String?;
      if (mounted) {
        _showSuccess(
            context,
            LanguageProvider.of(context).isFrench
                ? 'Demande de dépôt envoyée !\nVeuillez approuver sur votre téléphone.'
                : 'Deposit request sent!\nPlease approve on your phone.',
            ussdCode: result['ussdCode'] as String?);
        // Start polling for payment status
        if (txId != null) {
          _pollPaymentStatus(
              context, txId, LanguageProvider.of(context).depositLabel);
        }
      } else {
        apiLog('DEPOSIT: Widget not mounted, skipping dialog');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (kDebugMode) debugPrint('DEPOSIT: ApiException = ${e.message}');
      setState(() {
        _paying = false;
        _payError = LanguageProvider.of(context).apiError(e);
      });
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) debugPrint('DEPOSIT: ERROR = $e');
      setState(() {
        _paying = false;
        _payError = LanguageProvider.of(context).isFrench
            ? 'Le dépôt a échoué. Vérifiez votre connexion.'
            : 'Deposit failed. Check your connection.';
      });
    }
  }

  String _formatAmount(int v) {
    if (v <= 0) return '0';
    final s = v.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  // ── Cash deposit flow ─────────────────────────────────────────────────

  Future<void> _submitCashDeposit() async {
    setState(() {
      _cashPending = true;
      _cashRequestedAmount = _amount;
    });
    try {
      final result = await ApiService.requestCashDeposit(amount: _cashRequestedAmount);
      final transactionId = result['transactionId'] as String?;
      if (transactionId == null) {
        throw ApiException(
            500, LanguageService().invalidDepositResponse);
      }
      WalletState.instance.cashDepositPending(_cashRequestedAmount, transactionId: transactionId);
      NotificationState.instance.onCashDepositPending(_amount);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _cashPending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(LanguageProvider.of(context).apiError(e)),
            backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    // ── Cash Pending View ────────────────────────────────────────────────
    if (_cashPending) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(
            title: lang.isFrench ? 'Dépôt' : 'Deposit', showBack: true),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 24),
              // Status illustration
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: const Color(0xFFFFC107).withValues(alpha: 0.4),
                      width: 2),
                ),
                child: const Icon(Icons.hourglass_top_rounded,
                    size: 48, color: Color(0xFFFFC107)),
              ),
              const SizedBox(height: 24),
              Text(
                lang.isFrench ? 'Dépôt en attente' : 'Deposit Pending',
                style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                lang.isFrench
                    ? 'Votre demande a été reçue. Un agent Watsim est en route pour collecter votre argent.'
                    : 'Your request has been received. A Watsim agent is on the way to collect your money.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 14, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 28),
              AppCard(
                child: Column(
                  children: [
                    _pendingRow(
                        Icons.currency_franc_rounded,
                        lang.isFrench ? 'Montant demandé' : 'Requested Amount',
                        '${_formatAmount(_cashRequestedAmount)} FCFA',
                        const Color(0xFF00A86B)),
                    const Divider(height: 24),
                    _pendingRow(
                        Icons.person_pin_circle_rounded,
                        lang.isFrench
                            ? 'Méthode de collecte'
                            : 'Collection Method',
                        lang.isFrench
                            ? 'Visite d\'un agent Watsim'
                            : 'Watsim agent visit',
                        AppColors.primaryGreen),
                    const Divider(height: 24),
                    _pendingRow(
                        Icons.schedule_rounded,
                        lang.isFrench ? 'Statut' : 'Status',
                        lang.isFrench
                            ? 'En attente — collecte en cours'
                            : 'Pending — collection in progress',
                        const Color(0xFFFFC107)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: AppColors.primaryGreen.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        color: AppColors.primaryGreen, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        lang.isFrench
                            ? 'Une fois que l\'agent Watsim aura remis votre argent au bureau, votre portefeuille sera crédité automatiquement et vous serez notifié.'
                            : 'Once the Watsim agent delivers your money to the office, your wallet will be credited automatically and you will be notified.',
                        style: TextStyle(
                            fontSize: 13,
                            color: AppColors.primaryGreen,
                            height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    // ── Normal Deposit View ──────────────────────────────────────────────
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      resizeToAvoidBottomInset: true,
      appBar: WatsimAppBar(
          title: lang.isFrench ? 'Dépôt' : 'Deposit', showBack: true),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(lang.isFrench ? "Ajouter de l'argent" : "Add Money",
                style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.fundAccountInstantly,
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 28),

            Text(lang.chooseOperator,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 10),
            ...List.generate(_operators.length, (i) {
              final opSubs = lang.isFrench
                  ? [
                      'Frais : 0% • Instantané',
                      'Frais : 0% • Instantané',
                      'Frais : 0% • Collecté par un agent Watsim'
                    ]
                  : [
                      'Fee: 0% • Instant',
                      'Fee: 0% • Instant',
                      'Fee: 0% • Collected by a Watsim agent'
                    ];
              final opNames = lang.isFrench
                  ? ['Orange Money', 'MTN MoMo', 'Payer en espèces']
                  : ['Orange Money', 'MTN MoMo', 'Pay in Cash'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: OperatorCard(
                  name: opNames[i],
                  subtitle: opSubs[i],
                  color: Color(_operators[i]['color'] as int),
                  selected: _operator == i,
                  onTap: () => setState(() => _operator = i),
                  logoAsset: _operators[i]['logo'] as String?,
                ),
              );
            }),

            // Cash deposit info banner
            if (_isCashSelected) ...[
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF4CAF50).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: const Color(0xFF4CAF50).withValues(alpha: 0.25)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Icon(Icons.handshake_rounded,
                          color: Color(0xFF4CAF50), size: 18),
                      const SizedBox(width: 8),
                      Text(lang.howPayCashWorks,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2E7D32))),
                    ]),
                    const SizedBox(height: 10),
                    _cashStep(
                        '1',
                        lang.isFrench
                            ? 'Soumettez votre demande de dépôt ci-dessous'
                            : 'Submit your deposit request below'),
                    _cashStep(
                        '2',
                        lang.isFrench
                            ? 'Un agent Watsim vient collecter votre argent'
                            : 'A Watsim agent comes to collect your money'),
                    _cashStep(
                        '3',
                        lang.isFrench
                            ? 'L\'argent est déposé à notre bureau'
                            : 'The money is deposited at our office'),
                    _cashStep(
                        '4',
                        lang.isFrench
                            ? 'Une fois collecté, le bureau confirme la réception et votre portefeuille est crédité.'
                            : 'Once collected, the office confirms receipt and your wallet is credited.'),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],

            const SizedBox(height: 20),
            Text(lang.depositAmount,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 10),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: lang.isFrench ? 'Entrez le montant' : 'Enter amount',
                suffixText: 'FCFA',
                suffixStyle: const TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500),
                prefixIcon: const Icon(Icons.currency_franc_rounded,
                    color: AppColors.primaryGreen),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.divider),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.primaryGreen, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Summary
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.summaryLabel,
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryGreen)),
                  const SizedBox(height: 12),
                  _summaryRow(lang.isFrench ? 'Montant' : 'Amount',
                      '${_formatAmount(_amount)} FCFA'),
                  const SizedBox(height: 8),
                  _summaryRow(lang.isFrench ? 'Frais de dépôt' : 'Deposit Fee',
                      lang.isFrench ? 'Gratuit (0 FCFA)' : 'Free (0 FCFA)',
                      highlight: true),
                  if (_isCashSelected) ...[
                    const SizedBox(height: 8),
                    _summaryRow(
                        lang.isFrench ? 'Collecte' : 'Collection',
                        lang.isFrench
                            ? 'Par un agent Watsim'
                            : 'By a Watsim agent'),
                    const SizedBox(height: 8),
                    _summaryRow(
                        lang.isFrench ? 'Crédit' : 'Credit',
                        lang.isFrench
                            ? 'Après réception au bureau'
                            : 'After receipt at office'),
                  ],
                  const Divider(height: 20),
                  _summaryRow(lang.isFrench ? 'Total à payer' : 'Total to Pay',
                      '${_formatAmount(_amount)} FCFA',
                      bold: true),
                ],
              ),
            ),
            const SizedBox(height: 24),

            if (!_isCashSelected) ...[
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: lang.isFrench
                      ? 'Votre numéro de mobile money'
                      : 'Your mobile money number',
                  hintText: lang.isFrench ? 'ex. 6XXXXXXXX' : 'e.g. 6XXXXXXXX',
                  prefixIcon: const Icon(Icons.phone_android_rounded,
                      color: AppColors.primaryGreen),
                  errorText: _payError,
                ),
                onChanged: (_) {
                  if (_payError != null) setState(() => _payError = null);
                },
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton(
              onPressed: _paying
                  ? null
                  : () {
                      if (_isCashSelected) {
                        _submitCashDeposit();
                      } else {
                        _processMoMoDeposit();
                      }
                    },
              child: _paying
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white))
                  : Text(_isCashSelected
                      ? (lang.isFrench
                          ? 'Demander la collecte en espèces'
                          : 'Request Cash Collection')
                      : lang.depositBtn),
            ),
            const SizedBox(height: 12),
            Text(
              lang.isFrench
                  ? "En appuyant sur Déposer, vous acceptez nos conditions de services financiers."
                  : "By tapping Deposit, you agree to our financial services terms.",
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _cashStep(String num, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              color: Color(0xFF4CAF50),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(num,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _pendingRow(IconData icon, String label, String value, Color color) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
              const SizedBox(height: 2),
              Text(value,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value,
      {bool bold = false, bool highlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 14,
                color: bold ? AppColors.textPrimary : AppColors.textSecondary,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
        Text(value,
            style: TextStyle(
                fontSize: 14,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                color: highlight
                    ? AppColors.primaryGreen
                    : AppColors.textPrimary)),
      ],
    );
  }
}

// ─── Shared success dialog helper ────────────────────────────────────────
void _showSuccess(BuildContext context, String msg, {String? ussdCode}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.check_circle_rounded,
          color: AppColors.primaryGreen, size: 48),
      title: Text(
          LanguageService().isFrench ? 'Paiement initié' : 'Payment Initiated',
          textAlign: TextAlign.center),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(msg, textAlign: TextAlign.center),
            if (ussdCode != null && ussdCode.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primaryGreen),
                ),
                child: Column(
                  children: [
                    Text(
                        LanguageService().isFrench
                            ? 'Composez ce code USSD pour finaliser le paiement :'
                            : 'Dial this USSD code to complete payment:',
                        textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    Text(ussdCode,
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen),
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(dialogContext);
            Navigator.pop(context);
          },
          child: Text(LanguageService().okLabel),
        ),
      ],
    ),
  ).then((_) {}).catchError((e) {
    if (kDebugMode) debugPrint('_showSuccess dialog ERROR: $e');
  });
}

// ─── Poll payment status after dialog closes ─────────────────────────────
Future<void> _pollPaymentStatus(
    BuildContext context, String transactionId, String type,
    {bool useTransactionEndpoint = false}) async {
  const maxAttempts = 30; // 30 x 5 seconds = 2.5 minutes
  String? finalStatus;
  for (int i = 0; i < maxAttempts; i++) {
    await Future.delayed(const Duration(seconds: 5));
    try {
      final status = useTransactionEndpoint
          ? await ApiService.getTransactionStatus(transactionId)
          : await ApiService.getPaymentStatus(transactionId);
      if (kDebugMode) debugPrint('POLL: attempt=$i status=$status');
      if (status['status'] == 'COMPLETED') {
        finalStatus = 'COMPLETED';
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LanguageService().isFrench
                  ? '$type terminé ! Votre portefeuille a été mis à jour.'
                  : '$type completed! Your wallet has been updated.'),
              backgroundColor: AppColors.primaryGreen,
              duration: const Duration(seconds: 4),
            ),
          );
        }
        break;
      } else if (status['status'] == 'FAILED') {
        finalStatus = 'FAILED';
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LanguageService().isFrench
                  ? '$type échoué. Veuillez réessayer.'
                  : '$type failed. Please try again.'),
              backgroundColor: Colors.red.shade600,
            ),
          );
        }
        break;
      }
    } catch (e) {
      if (kDebugMode) debugPrint('POLL: error=$e');
    }
  }
  // Always sync wallet from backend so local state reflects reality
  await WalletState.instance.syncWithBackend();
  if (finalStatus == null && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(LanguageService().isFrench
            ? 'Statut du paiement inconnu. Portefeuille synchronisé.'
            : 'Payment status unknown. Wallet synced.'),
        backgroundColor: AppColors.warning,
      ),
    );
  }
}

// Removed unused WithdrawalScreen, TransferScreen, and BalanceCheckScreen
// classes (dead stubs — none were instantiated anywhere in the app).
