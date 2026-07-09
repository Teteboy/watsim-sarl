import 'package:flutter/material.dart';
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
    {'name': 'Orange Money', 'sub': 'Fee: 0% • Instant', 'color': 0xFFFF6600, 'logo': 'assets/images/orange-money.png'},
    {'name': 'MTN MoMo', 'sub': 'Fee: 0% • Instant', 'color': 0xFFFFCC00, 'logo': 'assets/images/momo.png'},
    {'name': 'Pay in Cash', 'sub': 'Fee: 0% • Collected by Watsim Official', 'color': 0xFF4CAF50, 'logo': 'assets/images/cash.png'},
  ];

  // Sandbox presets include small amounts for Campay demo (max 25 XAF)
  final _presets = [10, 20, 5000, 10000, 25000, 50000];

  bool get _isCashSelected => _operator == 2;

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(() {
      final parsed = int.tryParse(_amountCtrl.text.replaceAll(' ', '').replaceAll(',', '')) ?? 0;
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
      setState(() => _payError = 'Please enter your mobile money phone number.');
      return;
    }
    final providerKey = _operator == 0 ? 'ORANGE_MONEY' : 'MTN_MOMO';
    final opName = _operators[_operator]['name'] as String;
    setState(() { _paying = true; _payError = null; });
    try {
      debugPrint('DEPOSIT: Creating transaction...');
      final result = await ApiService.initiateDeposit(
        amount: _amount,
        provider: providerKey,
        phone: phone,
      );
      debugPrint('DEPOSIT: API result = $result');
      NotificationState.instance.onDepositCompleted(_amount, opName);
      setState(() => _paying = false);
      final txId = result['transactionId'] as String?;
      if (mounted) {
        debugPrint('DEPOSIT: Showing success dialog, ussdCode=${result['ussdCode']} txId=$txId');
        _showSuccess(context, 'Deposit request sent!\nPlease approve on your phone.', ussdCode: result['ussdCode'] as String?);
        // Start polling for payment status
        if (txId != null) {
          _pollPaymentStatus(context, txId, 'Deposit');
        }
      } else {
        debugPrint('DEPOSIT: Widget not mounted, skipping dialog');
      }
    } on ApiException catch (e) {
      debugPrint('DEPOSIT: ApiException = ${e.message}');
      setState(() { _paying = false; _payError = e.message; });
    } catch (e, st) {
      debugPrint('DEPOSIT: ERROR = $e');
      debugPrint('DEPOSIT: Stack = $st');
      setState(() { _paying = false; _payError = 'Deposit failed. Check your connection.'; });
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

  void _submitCashDeposit() {
    setState(() {
      _cashPending = true;
      _cashRequestedAmount = _amount;
    });
    WalletState.instance.cashDepositPending(_amount);
    NotificationState.instance.onCashDepositPending(_amount);
  }

  /// Simulates the office confirming receipt — in production this is triggered
  /// by the admin panel after the Watsim official hands in the cash.
  void _simulateOfficeConfirm({required int collectedAmount}) {
    WalletState.instance.cashDepositConfirm(
      requestedAmount: _cashRequestedAmount,
      collectedAmount: collectedAmount,
    );

    if (collectedAmount != _cashRequestedAmount) {
      NotificationState.instance.onCashDepositAmountMismatch(
        requestedAmount: _cashRequestedAmount,
        collectedAmount: collectedAmount,
      );
    } else {
      NotificationState.instance.onCashDepositCompleted(
        _cashRequestedAmount,
        collectedAmount,
      );
    }

    setState(() {
      _cashPending = false;
      _cashRequestedAmount = 0;
    });

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.check_circle_rounded, color: Colors.white),
        const SizedBox(width: 10),
        Text(collectedAmount != _cashRequestedAmount
            ? 'Deposit completed — amount updated. Check your messages.'
            : 'Cash deposit confirmed! Wallet credited.'),
      ]),
      backgroundColor: AppColors.primaryGreen,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  /// Shows the "office confirm" simulation sheet — in production this would
  /// be an admin action, not a user-facing button.
  void _showOfficeConfirmSheet() {
    final lang = LanguageProvider.of(context);
    final ctrlAmount = TextEditingController(text: _cashRequestedAmount.toString());
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.admin_panel_settings_rounded,
                      color: AppColors.primaryGreen, size: 22),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lang.officeConfirmation,
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary)),
                    Text(lang.watsimOfficialInternal,
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ]),
              const SizedBox(height: 20),
              Text(
                'Enter the actual cash amount handed in at the office:',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: ctrlAmount,
                keyboardType: TextInputType.number,
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  suffixText: 'FCFA',
                  prefixIcon: Icon(Icons.payments_rounded,
                      color: AppColors.primaryGreen),
                ),
              ),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.cancel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      final collected = int.tryParse(
                              ctrlAmount.text.replaceAll(',', '').replaceAll(' ', '')) ??
                          _cashRequestedAmount;
                      Navigator.pop(context);
                      _simulateOfficeConfirm(collectedAmount: collected);
                    },
                    child: Text(lang.confirmReceipt2),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    // ── Cash Pending View ────────────────────────────────────────────────
    if (_cashPending) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: const WatsimAppBar(title: 'Deposit', showBack: true),
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
                      color: const Color(0xFFFFC107).withOpacity(0.4), width: 2),
                ),
                child: const Icon(Icons.hourglass_top_rounded,
                    size: 48, color: Color(0xFFFFC107)),
              ),
              const SizedBox(height: 24),
              const Text(
                'Deposit Pending',
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Your request has been received. A Watsim official is on their way to collect your cash.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 28),
              AppCard(
                child: Column(
                  children: [
                    _pendingRow(
                        Icons.currency_franc_rounded,
                        'Requested Amount',
                        '${_formatAmount(_cashRequestedAmount)} FCFA',
                        const Color(0xFF00A86B)),
                    const Divider(height: 24),
                    _pendingRow(
                        Icons.person_pin_circle_rounded,
                        'Collection Method',
                        'Watsim Official Visit',
                        AppColors.primaryGreen),
                    const Divider(height: 24),
                    _pendingRow(
                        Icons.schedule_rounded,
                        'Status',
                        'Pending — Awaiting Collection',
                        const Color(0xFFFFC107)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: AppColors.primaryGreen.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        color: AppColors.primaryGreen, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Once the Watsim official delivers your cash to the office, your wallet will be credited automatically and you will be notified.',
                        style: TextStyle(
                            fontSize: 13,
                            color: AppColors.primaryGreen,
                            height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              // ── ADMIN / SIMULATION BUTTON ──────────────────────────────
              // In production this section is only visible to Watsim staff
              // on the admin panel. Shown here for demo purposes only.
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  children: [
                    Row(children: [
                      Icon(Icons.construction_rounded,
                          size: 16, color: Colors.grey.shade600),
                      const SizedBox(width: 8),
                      Text(lang.demoSimulateOffice,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade600)),
                    ]),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _showOfficeConfirmSheet,
                        icon: const Icon(Icons.admin_panel_settings_rounded,
                            size: 18),
                        label: Text(lang.officeConfirmsReceipt),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primaryGreen,
                          side: const BorderSide(color: AppColors.primaryGreen),
                        ),
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
      appBar: const WatsimAppBar(title: 'Deposit', showBack: true),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Add Money",
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.fundAccountInstantly,
                style: TextStyle(
                    fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 28),

            Text(lang.chooseOperator,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 10),
            ...List.generate(_operators.length, (i) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: OperatorCard(
                  name: _operators[i]['name'] as String,
                  subtitle: _operators[i]['sub'] as String,
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
                  color: const Color(0xFF4CAF50).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: const Color(0xFF4CAF50).withOpacity(0.25)),
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
                    _cashStep('1', 'Submit your deposit request below'),
                    _cashStep('2', 'A Watsim official visits you to collect the cash'),
                    _cashStep('3', 'Cash is handed in at our office'),
                    _cashStep('4', 'Your wallet is credited instantly — we notify you'),
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
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary),
              decoration: const InputDecoration(
                hintText: 'Enter amount',
                suffixText: 'FCFA',
                suffixStyle: TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500),
                prefixIcon: Icon(Icons.currency_franc_rounded,
                    color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: _presets
                  .map((v) => Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: AmountChip(
                            label: '${v ~/ 1000} 000',
                            selected: _amount == v,
                            onTap: () {
                              setState(() => _amount = v);
                              _amountCtrl.text = v.toString();
                              _amountCtrl.selection =
                                  TextSelection.fromPosition(TextPosition(
                                      offset: _amountCtrl.text.length));
                            },
                          ),
                        ),
                      ))
                  .toList(),
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
                  _summaryRow('Amount', '${_formatAmount(_amount)} FCFA'),
                  const SizedBox(height: 8),
                  _summaryRow('Deposit Fee', 'Free (0 FCFA)',
                      highlight: true),
                  if (_isCashSelected) ...[
                    const SizedBox(height: 8),
                    _summaryRow('Collection', 'By Watsim Official'),
                    const SizedBox(height: 8),
                    _summaryRow('Crediting', 'After office receipt'),
                  ],
                  const Divider(height: 20),
                  _summaryRow(
                      'Total to Pay', '${_formatAmount(_amount)} FCFA',
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
                  labelText: 'Your mobile money number',
                  hintText: 'e.g. 6XXXXXXXX',
                  prefixIcon: const Icon(Icons.phone_android_rounded,
                      color: AppColors.primaryGreen),
                  errorText: _payError,
                ),
                onChanged: (_) { if (_payError != null) setState(() => _payError = null); },
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton(
              onPressed: _paying ? null : () {
                if (_isCashSelected) {
                  _submitCashDeposit();
                } else {
                  _processMoMoDeposit();
                }
              },
              child: _paying
                  ? const SizedBox(
                      height: 22, width: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white))
                  : Text(_isCashSelected
                      ? 'Request Cash Collection'
                      : lang.depositBtn),
            ),
            const SizedBox(height: 12),
            const Text(
              "By tapping Deposit, you agree to our financial services terms and conditions.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
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
            color: color.withOpacity(0.1),
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
  debugPrint('_showSuccess called with ussdCode=$ussdCode');
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.check_circle_rounded, color: AppColors.primaryGreen, size: 48),
      title: const Text('Payment Initiated', textAlign: TextAlign.center),
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
                  color: AppColors.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primaryGreen),
                ),
                child: Column(
                  children: [
                    const Text('Dial this USSD code to complete payment:', textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    Text(ussdCode,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.primaryGreen),
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
          child: const Text('OK'),
        ),
      ],
    ),
  ).then((_) {
    debugPrint('_showSuccess dialog closed');
  }).catchError((e) {
    debugPrint('_showSuccess dialog ERROR: $e');
  });
}

// ─── Poll payment status after dialog closes ─────────────────────────────
Future<void> _pollPaymentStatus(BuildContext context, String transactionId, String type) async {
  const maxAttempts = 30; // 30 x 5 seconds = 2.5 minutes
  String? finalStatus;
  for (int i = 0; i < maxAttempts; i++) {
    await Future.delayed(const Duration(seconds: 5));
    try {
      final status = await ApiService.getPaymentStatus(transactionId);
      debugPrint('POLL: attempt=$i status=$status');
      if (status['status'] == 'COMPLETED') {
        finalStatus = 'COMPLETED';
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$type completed! Your wallet has been updated.'),
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
              content: Text('$type failed. Please try again.'),
              backgroundColor: Colors.red.shade600,
            ),
          );
        }
        break;
      }
    } catch (e) {
      debugPrint('POLL: error=$e');
    }
  }
  // Always sync wallet from backend so local state reflects reality
  await WalletState.instance.syncWithBackend();
  if (finalStatus == null && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment status unknown. Wallet synced.'),
        backgroundColor: AppColors.warning,
      ),
    );
  }
  debugPrint('POLL: finished after $maxAttempts attempts');
}

// ─── Withdrawal Screen ────────────────────────────────────────────────────
class WithdrawalScreen extends StatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen> {
  int _operator = 0;
  int _amount = 10000;
  final _amountCtrl = TextEditingController(text: '10000');
  
  // Phone number for mobile money
  final _phoneCtrl = TextEditingController();
  
  // Payment loading state
  bool _paying = false;
  String? _payError;

  final _operators = [
    {'name': 'Orange Money', 'sub': 'Fee: 1% • ~2 min', 'color': 0xFFFF6600, 'logo': 'assets/images/orange-money.png'},
    {'name': 'MTN MoMo', 'sub': 'Fee: 1% • ~2 min', 'color': 0xFFFFCC00, 'logo': 'assets/images/momo.png'},
    {'name': 'Counter Withdrawal', 'sub': 'Fee: 0% • In-agency', 'color': 0xFF014945},
  ];

  final _presets = [5000, 10000, 25000, 50000];

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(() {
      final parsed = int.tryParse(_amountCtrl.text.replaceAll(' ', '').replaceAll(',', '')) ?? 0;
      if (parsed != _amount) setState(() => _amount = parsed);
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _processMoMoWithdrawal() async {
    if (_amount < 1) return;
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _payError = 'Please enter your mobile money phone number.');
      return;
    }
    final providerKey = _operator == 0 ? 'ORANGE_MONEY' : 'MTN_MOMO';
    final opName = _operators[_operator]['name'] as String;
    setState(() { _paying = true; _payError = null; });
    try {
      final result = await ApiService.initiateWithdrawal(
        amount: _amount,
        provider: providerKey,
        phone: phone,
      );
      NotificationState.instance.onWithdrawalCompleted(_amount);
      setState(() => _paying = false);
      final txId = result['transactionId'] as String?;
      if (mounted) {
        _showSuccess(context, 'Withdrawal request sent!\nPlease approve on your phone.', ussdCode: result['ussdCode'] as String?);
        if (txId != null) _pollPaymentStatus(context, txId, 'Withdrawal');
      }
    } on ApiException catch (e) {
      setState(() { _paying = false; _payError = e.message; });
    } catch (e) {
      setState(() { _paying = false; _payError = 'Withdrawal failed. Check your connection.'; });
    }
  }

  String _fmt(int v) {
    if (v <= 0) return '0';
    final s = v.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      resizeToAvoidBottomInset: true,
      appBar: const WatsimAppBar(title: 'Withdraw', showBack: true),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Withdraw Money",
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.withdrawToMobileMoney,
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 28),
            Text(lang.withdrawalMethod,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            ...List.generate(_operators.length, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OperatorCard(
                name: _operators[i]['name'] as String,
                subtitle: _operators[i]['sub'] as String,
                color: Color(_operators[i]['color'] as int),
                selected: _operator == i,
                onTap: () => setState(() => _operator = i),
                logoAsset: _operators[i]['logo'] as String?,
              ),
            )),
            const SizedBox(height: 20),
            Text(lang.amountLabel2,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              decoration: const InputDecoration(
                hintText: 'Enter amount',
                suffixText: 'FCFA',
                suffixStyle: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                prefixIcon: Icon(Icons.currency_franc_rounded, color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: _presets.map((v) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: AmountChip(
                    label: '${v ~/ 1000} 000',
                    selected: _amount == v,
                    onTap: () {
                      setState(() => _amount = v);
                      _amountCtrl.text = v.toString();
                      _amountCtrl.selection = TextSelection.fromPosition(TextPosition(offset: _amountCtrl.text.length));
                    },
                  ),
                ),
              )).toList(),
            ),
            const SizedBox(height: 24),
            AppCard(
              child: Column(
                children: [
                  _row('Available Balance', WalletState.instance.balanceFormatted),
                  const SizedBox(height: 8),
                  _row('Withdrawal Amount', '${_fmt(_amount)} FCFA'),
                  const SizedBox(height: 8),
                  _row('Fee (1%)', '${_fmt(_amount ~/ 100)} FCFA'),
                  const Divider(height: 20),
                  _row('You will receive', '${_fmt(_amount - _amount ~/ 100)} FCFA', bold: true),
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Phone number input for mobile money
            if (_operator < 2) ...[
              Text('Phone Number',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
              const SizedBox(height: 10),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  hintText: '+237 6XX XXX XXX',
                  prefixIcon: Icon(Icons.phone, color: AppColors.primaryGreen),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.primaryGreen, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.primaryGreen, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            
            // Error display
            if (_payError != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade600, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_payError!, style: TextStyle(color: Colors.red.shade600, fontSize: 14)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            
            ElevatedButton(
              onPressed: _paying ? null : () {
                if (_operator < 2) {
                  _processMoMoWithdrawal();
                } else {
                  // Counter withdrawal - local processing
                  try {
                    WalletState.instance.deduct(_amount, reason: 'Counter Withdrawal', type: TxType.withdrawal, tag: 'PROCESSED');
                    NotificationState.instance.onWithdrawalCompleted(_amount);
                    _showSuccess(context, 'Withdrawal initiated!');
                  } catch (_) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(lang.insufficientFunds), backgroundColor: Colors.redAccent));
                  }
                }
              },
              child: _paying 
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      ),
                      const SizedBox(width: 8),
                      Text('Processing...'),
                    ],
                  )
                : Text(lang.withdrawBtn),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String l, String v, {bool bold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(l,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, color: bold ? AppColors.textPrimary : AppColors.textSecondary, fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
        ),
        const SizedBox(width: 8),
        Text(v,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 14, fontWeight: bold ? FontWeight.w700 : FontWeight.w600, color: AppColors.textPrimary)),
      ],
    );
  }
}

// ─── Transfer Screen ──────────────────────────────────────────────────────
class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  int _amount = 15000;
  int _operator = 0;
  final _presets = [5000, 10000, 15000, 25000];
  final _recents = [
    {'name': 'Marie Kamga', 'phone': '+237 699 123 456'},
    {'name': 'Jean-Marc T.', 'phone': '+237 677 234 567'},
    {'name': 'Fatou Diop', 'phone': '+237 655 345 678'},
  ];
  
  final _operators = [
    {'name': 'Orange Money', 'sub': 'Fee: 0% • Instant', 'color': 0xFFFF6600, 'logo': 'assets/images/orange-money.png'},
    {'name': 'MTN MoMo', 'sub': 'Fee: 0% • Instant', 'color': 0xFFFFCC00, 'logo': 'assets/images/momo.png'},
  ];
  
  // Form controllers
  final _recipientCtrl = TextEditingController();
  final _amountCtrl = TextEditingController(text: '15000');
  final _phoneCtrl = TextEditingController();
  
  // Payment loading state
  bool _paying = false;
  String? _payError;
  
  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(() {
      final parsed = int.tryParse(_amountCtrl.text.replaceAll(' ', '').replaceAll(',', '')) ?? 0;
      if (parsed != _amount) setState(() => _amount = parsed);
    });
  }
  
  @override
  void dispose() {
    _recipientCtrl.dispose();
    _amountCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }
  
  Future<void> _processTransfer() async {
    if (_amount < 1) return;
    final recipient = _recipientCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (recipient.isEmpty || phone.isEmpty) {
      setState(() => _payError = 'Please enter recipient name and phone number.');
      return;
    }
    final providerKey = _operator == 0 ? 'ORANGE_MONEY' : 'MTN_MOMO';
    setState(() { _paying = true; _payError = null; });
    try {
      final result = await ApiService.initiateTransfer(
        amount: _amount,
        provider: providerKey,
        phone: phone,
        recipientName: recipient,
      );
      NotificationState.instance.onTransferCompleted(_amount, recipient);
      setState(() => _paying = false);
      final txId = result['transactionId'] as String?;
      if (mounted) {
        _showSuccess(context, 'Transfer request sent!\nPlease approve on your phone.', ussdCode: result['ussdCode'] as String?);
        if (txId != null) _pollPaymentStatus(context, txId, 'Transfer');
      }
    } on ApiException catch (e) {
      setState(() { _paying = false; _payError = e.message; });
    } catch (e) {
      setState(() { _paying = false; _payError = 'Transfer failed. Check your connection.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      resizeToAvoidBottomInset: true,
      appBar: const WatsimAppBar(title: 'Transfer', showBack: true),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(lang.transferMoney,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.sendToAnotherWatsim,
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 28),
            Text('Recipient Name',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            TextField(
              controller: _recipientCtrl,
              decoration: InputDecoration(
                hintText: 'Enter recipient name',
                prefixIcon: Icon(Icons.person, color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 16),
            Text('Phone Number',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                hintText: '+237 6XX XXX XXX',
                prefixIcon: Icon(Icons.phone, color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 16),
            Text(lang.recentLabel,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            SizedBox(
              height: 80,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _recents.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) {
                  final r = _recents[i];
                  return Column(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: AppColors.primaryGreen.withOpacity(0.15),
                        child: Text((r['name'] as String).substring(0, 1),
                            style: const TextStyle(color: AppColors.secondaryGreen, fontWeight: FontWeight.w700, fontSize: 18)),
                      ),
                      const SizedBox(height: 4),
                      SizedBox(
                        width: 60,
                        child: Text((r['name'] as String).split(' ').first,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            Text('Payment Method',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            ...List.generate(_operators.length, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OperatorCard(
                name: _operators[i]['name'] as String,
                subtitle: _operators[i]['sub'] as String,
                color: Color(_operators[i]['color'] as int),
                selected: _operator == i,
                onTap: () => setState(() => _operator = i),
                logoAsset: _operators[i]['logo'] as String?,
              ),
            )),
            const SizedBox(height: 20),
            Text(lang.amountLabel2,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(height: 10),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: '0',
                suffixText: 'FCFA',
                prefixIcon: Icon(Icons.currency_franc_rounded, color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: _presets.map((v) => Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: AmountChip(
                    label: '${v ~/ 1000} K',
                    selected: _amount == v,
                    onTap: () {
                      setState(() => _amount = v);
                      _amountCtrl.text = v.toString();
                      _amountCtrl.selection = TextSelection.fromPosition(TextPosition(offset: _amountCtrl.text.length));
                    },
                  ),
                ),
              )).toList(),
            ),
            const SizedBox(height: 16),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Note / Reason (optional)',
                prefixIcon: Icon(Icons.note_outlined, color: AppColors.primaryGreen),
              ),
            ),
            const SizedBox(height: 28),
            
            // Error display
            if (_payError != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade600, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_payError!, style: TextStyle(color: Colors.red.shade600, fontSize: 14)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            
            ElevatedButton(
              onPressed: _paying ? null : _processTransfer,
              child: _paying 
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      ),
                      const SizedBox(width: 8),
                      Text('Processing...'),
                    ],
                  )
                : Text(lang.transferBtn),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Balance Check Screen ─────────────────────────────────────────────────
class BalanceCheckScreen extends StatelessWidget {
  const BalanceCheckScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: const WatsimAppBar(title: 'Balance', showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const SizedBox(height: 16),
            GradientCard(
              padding: const EdgeInsets.all(28),
              child: Column(
                children: [
                  Text(lang.totalBalance,
                      style: const TextStyle(color: Colors.white60, fontSize: 12, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  const Text('125,000 FCFA',
                      style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.trending_up_rounded, color: AppColors.primaryGreen, size: 16),
                      SizedBox(width: 4),
                      Text(lang.growthThisMonth,
                          style: TextStyle(color: AppColors.primaryGreen, fontSize: 13, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: _balanceCard('Wallet', '125,000', AppColors.primaryGreen)),
              const SizedBox(width: 12),
              Expanded(child: _balanceCard('BNPL Available', '75,000', AppColors.secondaryGreen)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _balanceCard('Spent (month)', '32,500', AppColors.warning)),
              const SizedBox(width: 12),
              Expanded(child: _balanceCard('Cashback', '3,200', AppColors.primaryGreen)),
            ]),
            const SizedBox(height: 24),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.creditScore,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('750',
                                style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.primaryGreen)),
                            Text(lang.excellent,
                                style: const TextStyle(color: AppColors.primaryGreen, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      SizedBox(
                        width: 80,
                        height: 80,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            CircularProgressIndicator(
                              value: 0.75,
                              strokeWidth: 8,
                              backgroundColor: AppColors.divider,
                              valueColor: const AlwaysStoppedAnimation(AppColors.primaryGreen),
                            ),
                            const Text('75%',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _balanceCard(String label, String amount, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: color.withOpacity(0.8))),
          const SizedBox(height: 6),
          Text('$amount FCFA', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}
