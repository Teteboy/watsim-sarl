import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../cart_state.dart';
import '../order_state.dart';
import '../wallet_state.dart';
import '../notification_state.dart';
import '../main.dart';
import 'catalogue_screen.dart';
import 'wallet_screen.dart';
import 'deposit_screen.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../services/biometric_service.dart';

// ─── BNPL Simulator Screen ─────────────────────────────────────────────────
class BnplSimulatorScreen extends StatefulWidget {
  final Product? product;
  final List<Product>? cartProducts; // when coming from cart
  const BnplSimulatorScreen({super.key, this.product, this.cartProducts});

  @override
  State<BnplSimulatorScreen> createState() => _BnplSimulatorScreenState();
}

class _BnplSimulatorScreenState extends State<BnplSimulatorScreen> {
  int? _selectedMonths; // null = not yet entered
  String? _paymentFrequency; // 'Daily', 'Weekly', 'Monthly'
  final TextEditingController _monthsController = TextEditingController();
  final TextEditingController _downPaymentController = TextEditingController();
  final FocusNode _monthsFocusNode = FocusNode();
  bool _isCalculating = false;
  bool _isCollectionFeeEnabled = true; // Default to enabled

  // Backend simulation result
  Map<String, dynamic>? _simulationResult;

  // Down payment amount (user can pay upfront to reduce installments)
  int get _downPayment {
    final text = _downPaymentController.text.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(text) ?? 0;
  }

  @override
  void dispose() {
    _monthsController.dispose();
    _downPaymentController.dispose();
    _monthsFocusNode.dispose();
    super.dispose();
  }

  // Call backend simulation API
  Future<void> _simulateBnpl() async {
    if (_product.id == null || _selectedMonths == null) return;

    setState(() {
      _isCalculating = true;
    });

    try {
      final result = await ApiService.simulateBnpl(
        productId: _product.id!,
        instalmentCount: _selectedMonths!,
        frequency: _paymentFrequency?.toLowerCase() ?? 'monthly',
        downPayment: _downPayment > 0 ? _downPayment : null,
      );

      setState(() {
        _simulationResult = result;
        _isCalculating = false;
      });
    } catch (e) {
      debugPrint('BNPL simulation error: $e');
      setState(() {
        _isCalculating = false;
      });
    }
  }

  Product get _product {
    if (widget.cartProducts?.isNotEmpty == true) {
      return widget.cartProducts!.first;
    }
    if (widget.product != null) {
      return widget.product!;
    }
    throw StateError('No product or cart items provided for BNPL simulation');
  }

  int get _basePrice {
    // Parse the price string from the actual product (e.g. "249,000 FCFA" → 249000)
    final digits = _product.price.replaceAll(RegExp(r'[^0-9]'), '');
    final price = int.tryParse(digits);
    if (price == null) throw StateError('Product price is not available');
    return price;
  }

  // Amount being financed after down payment
  int get _financedAmount => (_basePrice - _downPayment).clamp(0, _basePrice);

  // Use backend simulation results for fees
  Map<String, dynamic> get _fees => _simulationResult?['fees'] ?? {};
  int get _stockingFee => _fees['stockingFee'] ?? 0;
  int get _accountCreationFee => _fees['accountCreationFee'] ?? 0;
  int get _deliveryFee => _fees['deliveryFee'] ?? 0;
  int get _collectionFee =>
      _isCollectionFeeEnabled ? (_fees['collectionFee'] ?? 0) : 0;
  // Recalculate total fees dynamically when collection fee toggle changes
  int get _totalFees {
    final baseTotal = _fees['totalFees'] ?? 0;
    final originalCollectionFee = _fees['collectionFee'] ?? 0;
    // Subtract collection fee from total if disabled
    return _isCollectionFeeEnabled
        ? baseTotal
        : baseTotal - originalCollectionFee;
  }

  bool get _isFirstPurchase => _simulationResult?['isFirstPurchase'] ?? false;

  int get _total =>
      _simulationResult?['total'] ??
      (_financedAmount + _totalFees + _downPayment);
  int get _months => _selectedMonths ?? 1;
  // Monthly installment = (financed amount + fees) / months (down payment is upfront)
  // Always recalculate locally to respect collection fee toggle state
  int get _monthly => ((_financedAmount + _totalFees) / _months).ceil();

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: SizedBox(
          width: 40,
          height: 40,
          child: Image(
            image: const AssetImage('assets/images/logo_green.png'),
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Text('W',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800)),
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined,
                color: AppColors.primaryGreen, size: 22),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(lang.simulateBnplTitle,
                style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.choosePlanBudget,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 20),

            // Product card
            AppCard(
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: _product.color,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(_product.icon,
                        color: Colors.white.withOpacity(0.6), size: 32),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_product.name,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 4),
                        Text(_product.price,
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryGreen)),
                      ],
                    ),
                  ),
                  const Icon(Icons.shopping_cart_outlined,
                      color: AppColors.textMuted, size: 22),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Duration input field
            Text(lang.financingDuration,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 6),
            Text(
              'How long will it take you to finish contributing for this product?',
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _monthsController,
              focusNode: _monthsFocusNode,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: '1-60 months',
                suffixText: 'months',
                suffixStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryGreen),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide:
                      const BorderSide(color: AppColors.primaryGreen, width: 2),
                ),
                filled: true,
                fillColor: AppColors.white,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
              onChanged: (val) {
                final parsed = int.tryParse(val.trim()) ?? 0;
                if (parsed > 60) {
                  // Show popup for >60 months
                  _monthsController.text = '60';
                  _monthsController.selection = TextSelection.fromPosition(
                      TextPosition(offset: _monthsController.text.length));
                  setState(() {
                    _selectedMonths = 60;
                  });
                  _simulateBnpl();
                  showDialog(
                    context: context,
                    builder: (_) => AlertDialog(
                      title: const Text('Maximum Duration'),
                      content: const Text(
                          'BNPL simulation is available for up to 60 months (5 years) maximum. The duration has been set to 60 months.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('OK'),
                        ),
                      ],
                    ),
                  );
                } else if (parsed >= 1 && parsed <= 60) {
                  setState(() {
                    _selectedMonths = parsed;
                    // Reset monthly freq if only 1 month
                    if (parsed == 1 && _paymentFrequency == 'Monthly') {
                      _paymentFrequency = null;
                    }
                  });
                  // Call backend simulation
                  _simulateBnpl();
                } else if (val.trim().isEmpty) {
                  setState(() {
                    _selectedMonths = null;
                    _simulationResult = null;
                    _isCalculating = false;
                  });
                }
              },
            ),
            const SizedBox(height: 16),

            // Down Payment input (optional)
            Text('DOWN PAYMENT (OPTIONAL)',
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 6),
            Text(
              'Pay upfront to reduce your installment amounts',
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _downPaymentController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'e.g. 50,000',
                suffixText: 'FCFA',
                suffixStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryGreen),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide:
                      const BorderSide(color: AppColors.primaryGreen, width: 2),
                ),
                filled: true,
                fillColor: AppColors.white,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
              onChanged: (val) {
                // Recalculate when down payment changes
                if (_selectedMonths != null) {
                  _simulateBnpl();
                }
              },
            ),
            const SizedBox(height: 16),

            // Payment amounts per frequency — only shown once months are entered
            if (_isCalculating) ...[
              AppCard(
                padding:
                    const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                child: Column(
                  children: [
                    const SizedBox(
                      width: 32,
                      height: 32,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: AppColors.primaryGreen,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Calculating your plan...',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ] else if (_selectedMonths != null) ...[
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Payment Amount Options',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Based on $_selectedMonths ${_selectedMonths == 1 ? 'month' : 'months'} contribution period',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 14),
                    // Daily option (always shown)
                    _frequencyAmountTile(
                      icon: Icons.today_rounded,
                      label: lang.freqDaily,
                      sublabel: '${_selectedMonths! * 30} payments',
                      amount: _monthly ~/ 30,
                      suffix: '/day',
                      frequency: 'Daily',
                    ),
                    const SizedBox(height: 10),
                    // Weekly option (always shown)
                    _frequencyAmountTile(
                      icon: Icons.date_range_rounded,
                      label: lang.freqWeekly,
                      sublabel: '${_selectedMonths! * 4} payments',
                      amount: _monthly ~/ 4,
                      suffix: '/week',
                      frequency: 'Weekly',
                    ),
                    // Monthly only if > 1 month
                    if (_selectedMonths! > 1) ...[
                      const SizedBox(height: 10),
                      _frequencyAmountTile(
                        icon: Icons.calendar_month_rounded,
                        label: lang.freqMonthly,
                        sublabel: '$_selectedMonths payments',
                        amount: _monthly,
                        suffix: '/month',
                        frequency: 'Monthly',
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Contribution details — only shown once months are entered
            if (_selectedMonths != null && !_isCalculating) ...[
              Text(lang.instalmentDetails,
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textMuted,
                      letterSpacing: 1)),
              const SizedBox(height: 8),
              // Total cost breakdown
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Total Cost Breakdown',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 12),
                    _row(lang.productPrice, _product.price),
                    if (_downPayment > 0) ...[
                      const SizedBox(height: 6),
                      _row(
                        'Down Payment (Paid Upfront)',
                        '- ${_downPayment ~/ 1000},${(_downPayment % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: true,
                      ),
                      const SizedBox(height: 6),
                      _row(
                        'Amount to Finance',
                        '${_financedAmount ~/ 1000},${(_financedAmount % 1000).toString().padLeft(3, '0')} FCFA',
                      ),
                    ],
                    // New fee breakdown from backend
                    if (_simulationResult != null) ...[
                      const SizedBox(height: 4),
                      _row(
                        'Stocking Fee',
                        '+ ${_stockingFee ~/ 1000},${(_stockingFee % 1000).toString().padLeft(3, '0')} FCFA',
                      ),
                      if (_accountCreationFee > 0) ...[
                        const SizedBox(height: 4),
                        _row(
                          "Account Creation Fee${_isFirstPurchase ? ' (First Purchase)' : ' (Waived)'}",
                          '+ ${_accountCreationFee ~/ 1000},${(_accountCreationFee % 1000).toString().padLeft(3, '0')} FCFA',
                          highlight: _isFirstPurchase,
                        ),
                      ],
                      const SizedBox(height: 4),
                      _row(
                        'Delivery Fee',
                        '+ ${_deliveryFee ~/ 1000},${(_deliveryFee % 1000).toString().padLeft(3, '0')} FCFA',
                      ),
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text('Collection Fee',
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: AppColors.textSecondary)),
                                const SizedBox(width: 8),
                                Transform.scale(
                                  scale: 0.7,
                                  child: Switch(
                                    value: _isCollectionFeeEnabled,
                                    onChanged: (value) {
                                      setState(() {
                                        _isCollectionFeeEnabled = value;
                                      });
                                    },
                                    activeColor: AppColors.primaryGreen,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${_isCollectionFeeEnabled ? '+' : ''} ${_collectionFee ~/ 1000},${(_collectionFee % 1000).toString().padLeft(3, '0')} FCFA',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _isCollectionFeeEnabled
                                    ? AppColors.textPrimary
                                    : AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      _row(
                        'Total Fees',
                        '+ ${_totalFees ~/ 1000},${(_totalFees % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: true,
                      ),
                    ] else ...[
                      // Fallback to local calculation if no backend result
                      const SizedBox(height: 4),
                      _row(
                        lang.accountCreationFee,
                        '+ ${_accountCreationFee ~/ 1000},${(_accountCreationFee % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: true,
                      ),
                      const SizedBox(height: 4),
                      _row(
                        lang.deliveryFeeLabel,
                        '+ ${_deliveryFee ~/ 1000},${(_deliveryFee % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: true,
                      ),
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text('Collection Fee',
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: AppColors.textSecondary)),
                                const SizedBox(width: 8),
                                Transform.scale(
                                  scale: 0.7,
                                  child: Switch(
                                    value: _isCollectionFeeEnabled,
                                    onChanged: (value) {
                                      setState(() {
                                        _isCollectionFeeEnabled = value;
                                      });
                                    },
                                    activeColor: AppColors.primaryGreen,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${_isCollectionFeeEnabled ? '+' : ''} ${_collectionFee ~/ 1000},${(_collectionFee % 1000).toString().padLeft(3, '0')} FCFA',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _isCollectionFeeEnabled
                                    ? AppColors.textPrimary
                                    : AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      _row(
                        lang.stockingFee,
                        '+ ${_stockingFee ~/ 1000},${(_stockingFee % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: true,
                      ),
                    ],
                    const Divider(height: 20),
                    _row(
                      lang.totalAmount,
                      '${_total ~/ 1000},${(_total % 1000).toString().padLeft(3, '0')} FCFA',
                    ),

                    // First purchase indicator
                    if (_simulationResult != null && _isFirstPurchase) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: AppColors.primaryGreen.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline,
                                size: 16, color: AppColors.primaryGreen),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'This is your first BNPL purchase - account creation fee applies.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.primaryGreen,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: () => _goToConfirmPlan(context),
                child: Text(lang.confirmThisPlan),
              ),
              const SizedBox(height: 24),
            ], // end if (_selectedMonths != null && !_isCalculating)
          ],
        ),
      ),
    );
  }

  Widget _frequencyAmountTile({
    required IconData icon,
    required String label,
    required String sublabel,
    required int amount,
    required String suffix,
    required String frequency,
  }) {
    final fmtAmount =
        '${amount ~/ 1000},${(amount % 1000).toString().padLeft(3, '0')} FCFA';
    final isSelected = _paymentFrequency == frequency;
    return GestureDetector(
      onTap: () {
        setState(() {
          _paymentFrequency = frequency;
        });
        _simulateBnpl();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primaryGreen.withOpacity(0.1)
              : AppColors.offWhite,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                isSelected ? AppColors.primaryGreen : const Color(0xFFD0E8E5),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: AppColors.primaryGreen),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary)),
                  Text(sublabel,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(fmtAmount,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryGreen)),
                Text(suffix,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String l, String v, {bool highlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(l,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary)),
        ),
        const SizedBox(width: 8),
        Text(v,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: highlight
                    ? AppColors.primaryGreen
                    : AppColors.textPrimary)),
      ],
    );
  }

  void _goToConfirmPlan(BuildContext context) {
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ConfirmPlanScreen(
                  product: _product,
                  months: _months,
                  monthly: _monthly,
                  paymentFrequency: _paymentFrequency ?? 'Monthly',
                  accountCreationFee: _accountCreationFee,
                  deliveryFee: _deliveryFee,
                  pickUpFee: 0, // Not used in new structure
                  stockingFee: _stockingFee,
                  collectionFee: _collectionFee, // New fee
                  basePrice: _basePrice,
                  downPayment: _downPayment,
                  totalFees: _totalFees,
                  totalAmount: _total,
                  isFirstPurchase: _isFirstPurchase,
                  isCollectionFeeEnabled: _isCollectionFeeEnabled,
                  simulationResult: _simulationResult,
                )));
  }
}

// ─── Confirm Plan Screen ───────────────────────────────────────────────────
class ConfirmPlanScreen extends StatefulWidget {
  final Product product;
  final int months;
  final int monthly;
  final String paymentFrequency;
  final int accountCreationFee;
  final int deliveryFee;
  final int pickUpFee;
  final int stockingFee;
  final int collectionFee; // New fee
  final int basePrice;
  final int downPayment;
  final int totalFees;
  final int totalAmount;
  final bool isFirstPurchase;
  final bool isCollectionFeeEnabled;
  final Map<String, dynamic>? simulationResult;

  const ConfirmPlanScreen({
    super.key,
    required this.product,
    required this.months,
    required this.monthly,
    required this.paymentFrequency,
    required this.accountCreationFee,
    required this.deliveryFee,
    required this.pickUpFee,
    required this.stockingFee,
    required this.collectionFee,
    required this.basePrice,
    this.downPayment = 0,
    required this.totalFees,
    required this.totalAmount,
    required this.isFirstPurchase,
    required this.isCollectionFeeEnabled,
    this.simulationResult,
  });

  @override
  State<ConfirmPlanScreen> createState() => _ConfirmPlanScreenState();
}

class _ConfirmPlanScreenState extends State<ConfirmPlanScreen> {
  Product get product => widget.product;
  int get months => widget.months;
  int get monthly => widget.monthly;
  String get paymentFrequency => widget.paymentFrequency;
  int get accountCreationFee => widget.accountCreationFee;
  int get deliveryFee => widget.deliveryFee;
  int get pickUpFee => widget.pickUpFee;
  int get stockingFee => widget.stockingFee;
  int get collectionFee =>
      widget.isCollectionFeeEnabled ? widget.collectionFee : 0;
  int get basePrice => widget.basePrice;
  int get totalFees => widget.totalFees; // Use backend calculation
  int get totalAmount => widget.totalAmount; // Use backend calculation
  bool get isFirstPurchase => widget.isFirstPurchase;

  void _handleMakePayment(BuildContext context) {
    // Ask how much the user wants to contribute
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _PaymentAmountSheet(
        totalAmount: totalAmount,
        onAmountConfirmed: (amount) async {
          Navigator.pop(context);
          // Cap amount at total to prevent backend over-deduction
          final actualAmount = amount > totalAmount ? totalAmount : amount;
          final wallet = WalletState.instance;
          final canProceed =
              actualAmount == 0 || wallet.hasSufficientFunds(actualAmount);
          if (!canProceed) {
            showModalBottomSheet(
              context: context,
              backgroundColor: Colors.transparent,
              isScrollControlled: true,
              builder: (_) => _InsufficientFundsSheet(
                required: actualAmount,
                available: wallet.balance,
              ),
            );
            return;
          }

          // Use referral funds when available, otherwise fall back to wallet.
          int referralBalance = 0;
          try {
            final rewards = await ApiService.fetchRewardsSummary();
            referralBalance =
                (rewards['availableBalance'] as num?)?.toInt() ?? 0;
          } catch (_) {}

          // Create BNPL purchase on backend with user's chosen amount as downPayment
          String? backendPurchaseId;
          try {
            final result = await ApiService.requestBnpl(
              productId: product.id!,
              instalmentCount: months,
              paymentProvider:
                  referralBalance >= actualAmount ? 'REFERRAL' : 'WALLET',
              phone: '',
              downPayment: actualAmount,
              frequency: paymentFrequency.toLowerCase(),
            );
            backendPurchaseId = result['purchase']?['id'] as String?;
            debugPrint('BNPL purchase created on backend: $backendPurchaseId');
            // Sync wallet and orders from backend so local state reflects reality
            await WalletState.instance.syncWithBackend();
            await OrderState.instance.syncWithBackend();
          } catch (e) {
            debugPrint('Backend BNPL creation failed: $e');
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Payment failed: $e'),
                  backgroundColor: Colors.red.shade600,
                ),
              );
            }
            return;
          }

          final orderNum = backendPurchaseId ??
              '#WTS-${DateTime.now().year}-${(DateTime.now().millisecondsSinceEpoch % 100000).toString().padLeft(5, '0')}';
          final order = ConfirmedOrder(
            id: backendPurchaseId,
            product: product,
            months: months,
            monthly: monthly,
            paymentFrequency: paymentFrequency,
            fee: totalFees,
            basePrice: basePrice,
            confirmedAt: DateTime.now(),
            orderNumber: orderNum,
            initialAccumulatedFunds: actualAmount,
            contributionAmounts: actualAmount > 0 ? [actualAmount] : [],
            downPayment: actualAmount,
            stockingFee: stockingFee,
            accountCreationFee: accountCreationFee,
            deliveryFee: deliveryFee,
            collectionFee: collectionFee,
            totalFees: totalFees,
            instalments: [],
          );
          int overpay = 0;
          if (actualAmount >= totalAmount) {
            order.markFullyPaid();
            overpay = actualAmount - totalAmount;
          } else if (actualAmount > 0) {
            order.paidInstallments.add(0);
          }
          // Do not add this local success-screen order to OrderState:
          // syncWithBackend() already populated the real backend purchase,
          // and adding a local copy would create a duplicate entry.
          CartState.instance.clear();
          NotificationState.instance.onBnplOrderConfirmed(
            product.name,
            monthly,
            months,
            paymentFrequency: paymentFrequency,
          );
          Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                  builder: (_) => BnplPaymentStatusScreen(
                        order: order,
                        amountPaid: actualAmount,
                        totalAmount: totalAmount,
                        overpayRefunded: overpay,
                      )));
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        // ── Centered large logo, NO "WATSIM" text ────────────────
        title: SizedBox(
          width: 52,
          height: 52,
          child: Image(
            image: const AssetImage('assets/images/logo_green.png'),
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Container(
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('W',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ),
        centerTitle: true,
        // ── Wallet icon replaces profile avatar, and is functional ─
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined,
                color: AppColors.primaryGreen, size: 24),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
            tooltip: lang.totalBalance,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          24,
          24,
          24 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(lang.confirmYourPlan,
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(lang.reviewBeforeConfirm,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 24),

            // Product summary
            AppCard(
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: product.color,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(product.icon,
                        color: Colors.white.withOpacity(0.6), size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(product.name,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 4),
                        Text(product.price,
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryGreen)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Plan details card
            AppCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  _planRow(lang.durationLabel, () {
                    if (paymentFrequency == 'Daily')
                      return '${months * 30} ${lang.daysLabel}';
                    if (paymentFrequency == 'Weekly')
                      return '${months * 4} ${lang.weeksLabel}';
                    return '$months ${lang.monthsLabel}';
                  }()),
                  const Divider(height: 20),
                  _planRow(
                      lang.paymentFrequencyLabel,
                      paymentFrequency == 'Daily'
                          ? lang.freqDaily
                          : paymentFrequency == 'Weekly'
                              ? lang.freqWeekly
                              : lang.freqMonthly),
                  const Divider(height: 20),
                  _planRow(lang.productPrice,
                      '${basePrice ~/ 1000},${(basePrice % 1000).toString().padLeft(3, '0')} FCFA'),
                  const Divider(height: 20),
                  // New fee structure
                  _planRow('Stocking Fee',
                      '+ ${stockingFee ~/ 1000},${(stockingFee % 1000).toString().padLeft(3, '0')} FCFA'),
                  const Divider(height: 20),
                  if (accountCreationFee > 0) ...[
                    _planRow(
                        "Account Creation Fee${isFirstPurchase ? ' (First Purchase)' : ' (Waived)'}",
                        '+ ${accountCreationFee ~/ 1000},${(accountCreationFee % 1000).toString().padLeft(3, '0')} FCFA',
                        highlight: isFirstPurchase),
                    const Divider(height: 20),
                  ],
                  _planRow('Delivery Fee',
                      '+ ${deliveryFee ~/ 1000},${(deliveryFee % 1000).toString().padLeft(3, '0')} FCFA'),
                  const Divider(height: 20),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Text('Collection Fee',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary)),
                            const SizedBox(width: 8),
                            Transform.scale(
                              scale: 0.7,
                              child: Switch(
                                value: widget.isCollectionFeeEnabled,
                                onChanged: (value) {
                                  // Note: This would need callback to parent screen
                                },
                                activeColor: AppColors.primaryGreen,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '${widget.isCollectionFeeEnabled ? '+' : ''} ${collectionFee ~/ 1000},${(collectionFee % 1000).toString().padLeft(3, '0')} FCFA',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: widget.isCollectionFeeEnabled
                                ? AppColors.textPrimary
                                : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 20),
                  _planRow('Total Fees',
                      '+ ${totalFees ~/ 1000},${(totalFees % 1000).toString().padLeft(3, '0')} FCFA',
                      highlight: true),
                  const Divider(height: 20),
                  _planRow(lang.totalAmount,
                      '${totalAmount ~/ 1000},${(totalAmount % 1000).toString().padLeft(3, '0')} FCFA'),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // ── Wallet balance preview ──────────────────────────────
            Builder(builder: (ctx) {
              final wallet = WalletState.instance;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.primaryGreen.withOpacity(0.25),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.account_balance_wallet_outlined,
                          size: 18,
                          color: AppColors.primaryGreen,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${lang.walletBalance}: ${wallet.balanceFormatted}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primaryGreen,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: () => _handleMakePayment(context),
                    child: Text(lang.makePayment),
                  ),
                ],
              );
            }),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                side: const BorderSide(color: AppColors.primaryGreen),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(lang.editPlan,
                  style: const TextStyle(color: AppColors.primaryGreen)),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _planRow(String label, String value, {bool highlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary)),
        ),
        const SizedBox(width: 8),
        Text(value,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: highlight
                    ? AppColors.primaryGreen
                    : AppColors.textPrimary)),
      ],
    );
  }
}

// ─── Order Success Screen ──────────────────────────────────────────────────
class OrderSuccessScreen extends StatelessWidget {
  final ConfirmedOrder order;
  const OrderSuccessScreen({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded,
                    size: 64, color: AppColors.primaryGreen),
              ),
              const SizedBox(height: 28),
              Text(lang.orderConfirmed,
                  style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 10),
              Text(
                lang.orderConfirmedDesc,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 15, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 40),
              AppCard(
                child: Column(
                  children: [
                    _detail(lang.orderNumberLabel, order.orderNumber),
                    const Divider(height: 16),
                    _detail('${order.paymentFrequency} ${lang.amountLabel}',
                        order.monthlyFormatted),
                    const Divider(height: 16),
                    _detail(lang.frequencyLabel, order.paymentFrequency),
                    const Divider(height: 16),
                    _detail(lang.durationLabel, order.planDurationLabel),
                    const Divider(height: 16),
                    _detail(lang.nextInstalment,
                        '${order.nextDue.day} ${_monthName(order.nextDue.month)} ${order.nextDue.year}'),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () => Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const MainShell()),
                    (route) => false),
                child: Text(lang.backToHome),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const MainShell(
                            initialIndex: 3, initialHistoryTab: 1)),
                    (route) => false,
                  );
                },
                child: Text(lang.viewMyOrders),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detail(String l, String v) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(l,
            style:
                const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        Text(v,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary)),
      ],
    );
  }

  String _monthName(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m - 1];
}

// ─── Repayment Screen ──────────────────────────────────────────────────────
class RepaymentScreen extends StatefulWidget {
  const RepaymentScreen({super.key});

  @override
  State<RepaymentScreen> createState() => _RepaymentScreenState();
}

class _RepaymentScreenState extends State<RepaymentScreen> {
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    OrderState.instance.addListener(_onOrdersChanged);
    OrderState.instance.syncWithBackend();
  }

  @override
  void dispose() {
    OrderState.instance.removeListener(_onOrdersChanged);
    super.dispose();
  }

  void _onOrdersChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  /// Active orders that still have unpaid instalments
  List<ConfirmedOrder> get _activeOrders {
    return OrderState.instance.orders
        .where((o) => !o.isDemo && !o.isFullyPaid)
        .toList();
  }

  /// Total amount due across all pending instalments
  int get _totalDue {
    int total = 0;
    for (final o in _activeOrders) {
      for (final inst in o.instalments) {
        if (inst['status'] != 'PAID') {
          total += (inst['amount'] as num?)?.toInt() ?? o.monthly;
        }
      }
    }
    return total;
  }

  String _fmt(int v) {
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  void _showPaySheet(ConfirmedOrder order, Map<String, dynamic> instalment) {
    final amount = (instalment['amount'] as num?)?.toInt() ?? order.monthly;
    final instalmentId = instalment['id'] as String? ?? '';
    if (instalmentId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Cannot pay: missing instalment ID'),
            backgroundColor: Colors.redAccent),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _RepayProviderSheet(
        amount: amount,
        productName: order.product.name,
        onPay: (provider, phone) => _payInstalment(
            order.orderNumber, instalmentId, provider, phone, amount),
      ),
    );
  }

  Future<void> _payInstalment(String purchaseId, String instalmentId,
      String provider, String phone, int amount) async {
    if (_paying) return;
    setState(() => _paying = true);
    try {
      final result = await ApiService.payInstalment(
        purchaseId: purchaseId,
        instalmentId: instalmentId,
        paymentProvider: provider,
        phone: phone,
      );
      final txId = result['transaction']?['id'] as String?;
      if (mounted) {
        _showSuccess(
            context, 'Payment initiated! Please approve on your phone.',
            ussdCode: result['payment']?['ussdCode'] as String?);
        if (txId != null) _pollPaymentStatus(context, txId, 'Repayment');
      }
      // Refresh orders after payment
      await OrderState.instance.syncWithBackend();
      await WalletState.instance.syncWithBackend();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Payment failed: ${e.message}'),
              backgroundColor: Colors.redAccent),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Payment error: $e'),
              backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final orders = _activeOrders;
    final totalDue = _totalDue;

    if (orders.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.repaymentTitle, showBack: true),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded,
                  size: 64, color: AppColors.primaryGreen),
              const SizedBox(height: 16),
              Text('All caught up!',
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              const Text('You have no pending instalments.',
                  style:
                      TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            ],
          ),
        ),
      );
    }

    // Find the nearest upcoming due date
    DateTime? nextDue;
    for (final o in orders) {
      for (final inst in o.instalments) {
        if (inst['status'] != 'PAID') {
          final d = DateTime.tryParse(inst['dueDate'] as String? ?? '');
          if (d != null && (nextDue == null || d.isBefore(nextDue))) {
            nextDue = d;
          }
        }
      }
    }

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.repaymentTitle, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GradientCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.amountDueThisMonth,
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 13)),
                  const SizedBox(height: 8),
                  Text(_fmt(totalDue),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  if (nextDue != null)
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded,
                            color: AppColors.primaryGreen, size: 14),
                        const SizedBox(width: 6),
                        Text(
                            'Due on ${nextDue.day} ${_monthName(nextDue.month)} ${nextDue.year}',
                            style: const TextStyle(
                                color: AppColors.primaryGreen,
                                fontSize: 13,
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text(lang.pendingInstalments,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 12),
            ...orders.expand((o) {
              final items = <Widget>[];
              for (int i = 0; i < o.instalments.length; i++) {
                final inst = o.instalments[i];
                if (inst['status'] == 'PAID') continue;
                final amount = (inst['amount'] as num?)?.toInt() ?? o.monthly;
                final due = DateTime.tryParse(inst['dueDate'] as String? ?? '');
                final dueText = due != null
                    ? 'Due ${due.day} ${_monthName(due.month)}'
                    : 'Upcoming';
                items.add(Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _repayItem(
                    o.product.name,
                    '${lang.instalmentLabel} ${i + 1}/${o.instalments.length} · $dueText',
                    _fmt(amount),
                    AppColors.warning,
                    lang,
                    onTap: _paying ? null : () => _showPaySheet(o, inst),
                  ),
                ));
              }
              return items;
            }).toList(),
            if (_paying) ...[
              const SizedBox(height: 16),
              const Center(
                  child:
                      CircularProgressIndicator(color: AppColors.primaryGreen)),
              const SizedBox(height: 8),
              const Center(
                  child: Text('Processing payment...',
                      style: TextStyle(color: AppColors.textSecondary))),
            ],
          ],
        ),
      ),
    );
  }

  Widget _repayItem(
      String name, String sub, String amount, Color color, LanguageService lang,
      {VoidCallback? onTap}) {
    return AppCard(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.receipt_long_rounded, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary)),
                  Text(sub,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(amount,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: color)),
                Text(lang.toPay,
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _monthName(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m - 1];
}

// ─── Repayment Provider Selection Sheet ──────────────────────────────────
class _RepayProviderSheet extends StatefulWidget {
  final int amount;
  final String productName;
  final void Function(String provider, String phone) onPay;

  const _RepayProviderSheet(
      {required this.amount, required this.productName, required this.onPay});

  @override
  State<_RepayProviderSheet> createState() => _RepayProviderSheetState();
}

class _RepayProviderSheetState extends State<_RepayProviderSheet> {
  int _operator = 0;
  final _phoneCtrl = TextEditingController();
  final _providers = [
    {'key': 'ORANGE_MONEY', 'name': 'Orange Money', 'color': 0xFFFF6600},
    {'key': 'MTN_MOMO', 'name': 'MTN MoMo', 'color': 0xFFFFCC00},
    {'key': 'WALLET', 'name': 'Watsim Wallet', 'color': 0xFF00A86B},
    {'key': 'REFERRAL', 'name': 'Referral Balance', 'color': 0xFF8E24AA},
  ];

  String _fmt(int v) {
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providerKey = _providers[_operator]['key'];
    final isWallet = providerKey == 'WALLET' || providerKey == 'REFERRAL';
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2)),
            ),
            Text('Pay Instalment',
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(widget.productName,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
              ),
              child: Column(
                children: [
                  const Text('Amount to pay',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text(_fmt(widget.amount),
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryGreen)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text('Payment Method',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(height: 10),
            Row(
              children: List.generate(_providers.length, (i) {
                final p = _providers[i];
                final sel = i == _operator;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _operator = i),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: sel
                            ? Color(p['color'] as int).withOpacity(0.12)
                            : AppColors.offWhite,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: sel
                                ? Color(p['color'] as int)
                                : const Color(0xFFD0E8E5)),
                      ),
                      child: Center(
                        child: Text(p['name'] as String,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: sel
                                    ? Color(p['color'] as int)
                                    : AppColors.textSecondary)),
                      ),
                    ),
                  ),
                );
              }),
            ),
            if (!isWallet) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  hintText: '6XX XXX XXX',
                  prefixIcon: Icon(Icons.phone_android_rounded,
                      color: AppColors.primaryGreen),
                ),
              ),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                final provider = _providers[_operator]['key'] as String;
                final phone = isWallet ? '' : _phoneCtrl.text.trim();
                if (!isWallet && phone.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Enter phone number'),
                        backgroundColor: Colors.redAccent),
                  );
                  return;
                }
                Navigator.pop(context);
                widget.onPay(provider, phone);
              },
              child: const Text('Confirm Payment',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
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
                    const Text('Dial this USSD code to complete payment:',
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
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('OK'),
        ),
      ],
    ),
  );
}

// ─── Poll payment status after dialog closes ─────────────────────────────
Future<void> _pollPaymentStatus(
    BuildContext context, String transactionId, String type) async {
  const maxAttempts = 30;
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
  await WalletState.instance.syncWithBackend();
  if (finalStatus == null && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment status unknown. Wallet synced.'),
        backgroundColor: AppColors.warning,
      ),
    );
  }
}

// ─── Payment Amount Entry Sheet ────────────────────────────────────────────
class _PaymentAmountSheet extends StatefulWidget {
  final int totalAmount;
  final void Function(int amount) onAmountConfirmed;

  const _PaymentAmountSheet({
    required this.totalAmount,
    required this.onAmountConfirmed,
  });

  @override
  State<_PaymentAmountSheet> createState() => _PaymentAmountSheetState();
}

class _PaymentAmountSheetState extends State<_PaymentAmountSheet> {
  final _controller = TextEditingController();
  String? _error;
  int _typedAmount = 0;

  String _fmt(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,$r FCFA';
  }

  void _confirm() {
    final raw = _controller.text.replaceAll(RegExp(r'[^0-9]'), '');
    final amount = int.tryParse(raw) ?? 0;
    if (amount < 0) {
      setState(() => _error = 'Please enter a valid amount.');
      return;
    }
    // Allow starting BNPL with 0 — user can pay installments later
    if (amount > 0) {
      final walletBalance = WalletState.instance.balance;
      if (amount > walletBalance) {
        setState(
            () => _error = 'Exceeds wallet balance: ${_fmt(walletBalance)}');
        return;
      }
    }
    // Cap at totalAmount to prevent backend over-deduction; excess is not processed.
    final capped = amount > widget.totalAmount ? widget.totalAmount : amount;
    widget.onAmountConfirmed(capped);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final int overpayPreview = _typedAmount > widget.totalAmount
        ? _typedAmount - widget.totalAmount
        : 0;
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.payments_outlined,
                  size: 28, color: AppColors.primaryGreen),
            ),
            const SizedBox(height: 14),
            Text(lang.enterFirstContribution,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            const Text(
              'Pay any amount you\'re comfortable with. It will accumulate towards your total.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            // Accumulated funds info banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.07),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: AppColors.primaryGreen.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.savings_outlined,
                      size: 16, color: AppColors.primaryGreen),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Every payment accumulates. Transfer your balance to a new product anytime.',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.primaryGreen),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Amount display if typed
            if (_typedAmount > 0)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: AppColors.primaryGreen.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    Text(lang.youAreContributing,
                        style: TextStyle(
                            fontSize: 11, color: AppColors.textSecondary)),
                    const SizedBox(height: 2),
                    Text(
                      _fmt(_typedAmount),
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryGreen),
                    ),
                  ],
                ),
              ),
            // Overpay refund notice — shown when entered amount exceeds the total
            if (overpayPreview > 0)
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.account_balance_wallet_outlined,
                        size: 16, color: Colors.amber.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${_fmt(overpayPreview)} above the total will be refunded to your wallet.',
                        style: TextStyle(
                            fontSize: 12,
                            color: Colors.amber.shade800,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            TextField(
              controller: _controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: InputDecoration(
                labelText: 'Amount (FCFA)',
                hintText: 'e.g. 5,000',
                errorText: _error,
                prefixIcon: const Icon(Icons.attach_money_rounded,
                    color: AppColors.primaryGreen),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.primaryGreen, width: 2),
                ),
              ),
              onChanged: (val) {
                final raw = val.replaceAll(RegExp(r'[^0-9]'), '');
                setState(() {
                  _error = null;
                  _typedAmount = int.tryParse(raw) ?? 0;
                });
              },
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _confirm,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(lang.makePayment,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── PIN Confirm Sheet ─────────────────────────────────────────────────────
class _PinConfirmSheet extends StatefulWidget {
  final VoidCallback onPinConfirmed;
  const _PinConfirmSheet({required this.onPinConfirmed});

  @override
  State<_PinConfirmSheet> createState() => _PinConfirmSheetState();
}

class _PinConfirmSheetState extends State<_PinConfirmSheet> {
  String _pin = '';
  bool _error = false;
  bool _loading = false;

  void _addDigit(String d) {
    if (_pin.length >= 4 || _loading) return;
    setState(() {
      _pin += d;
      _error = false;
    });
    if (_pin.length == 4) _verify();
  }

  void _deleteDigit() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _authenticateWithBiometric() async {
    // Check if biometrics are enabled and available
    final enabled = await BiometricService.isBiometricEnabled();
    final available = await BiometricService.canCheckBiometrics();

    if (!enabled || !available) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Biometric authentication not enabled or available'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final authenticated = await BiometricService.authenticate(
      localizedReason: 'Confirm purchase with biometric',
    );

    if (authenticated && mounted) {
      // Biometric auth successful - simulate PIN entry and verify
      setState(() {
        _pin = '****'; // Visual indicator that biometric was used
        _loading = true;
      });
      _verifyWithBiometric();
    }
  }

  void _verifyWithBiometric() async {
    // Biometric auth successful - just call the confirmation callback
    // The actual purchase flow will be handled by the parent
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    widget.onPinConfirmed();
  }

  void _verify() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
    // Accept any 4-digit PIN for demo
    setState(() => _loading = false);
    widget.onPinConfirmed();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(
        color: Color(0xFF0D1F1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.lock_outline_rounded,
                size: 28, color: AppColors.primaryGreen),
          ),
          const SizedBox(height: 14),
          Text(lang.enterPINToConfirm,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
          const SizedBox(height: 6),
          Text(lang.confirmIdentityProceed,
              style: TextStyle(
                  fontSize: 13, color: Colors.white.withOpacity(0.55))),
          const SizedBox(height: 24),
          // PIN dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
                4,
                (i) => Container(
                      margin: const EdgeInsets.symmetric(horizontal: 10),
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < _pin.length
                            ? AppColors.primaryGreen
                            : Colors.white.withOpacity(0.15),
                        border: Border.all(
                          color: _error ? Colors.redAccent : Colors.transparent,
                          width: _error ? 2 : 0,
                        ),
                      ),
                    )),
          ),
          if (_error) ...[
            const SizedBox(height: 10),
            Text(lang.incorrectPINTryAgain,
                style: TextStyle(color: Colors.redAccent, fontSize: 13)),
          ],
          if (_loading) ...[
            const SizedBox(height: 16),
            const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.primaryGreen)),
          ],
          const SizedBox(height: 24),
          // Numpad
          ...List.generate(
              3,
              (row) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(3, (col) {
                        final digit = '${row * 3 + col + 1}';
                        return _numKey(digit);
                      }),
                    ),
                  )),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _numKey('',
                  icon: Icons.fingerprint_rounded,
                  color: Colors.white70,
                  onTap: _authenticateWithBiometric),
              _numKey('0'),
              _numKey('',
                  icon: Icons.backspace_outlined,
                  onTap: _deleteDigit,
                  color: Colors.white60),
            ],
          ),
        ],
      ),
    );
  }

  Widget _numKey(String digit,
      {IconData? icon, VoidCallback? onTap, Color? color}) {
    return GestureDetector(
      onTap: onTap ?? (digit.isEmpty ? null : () => _addDigit(digit)),
      child: Container(
        width: 72,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white
              .withOpacity(digit.isEmpty && icon == null ? 0 : 0.07),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: color ?? Colors.white, size: 22)
              : Text(digit,
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: color ?? Colors.white)),
        ),
      ),
    );
  }
}

// ─── BNPL Payment Status Screen ────────────────────────────────────────────
class BnplPaymentStatusScreen extends StatelessWidget {
  final ConfirmedOrder order;
  final int amountPaid;
  final int totalAmount;
  final int overpayRefunded;

  const BnplPaymentStatusScreen({
    super.key,
    required this.order,
    required this.amountPaid,
    required this.totalAmount,
    this.overpayRefunded = 0,
  });

  String _fmt(int v) =>
      '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')} FCFA';

  String _monthName(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m - 1];

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    // Use order.isFullyPaid (based on basePrice funds) rather than totalAmount
    // so that paying the full product price marks the order as complete even
    // if the service fee hasn't been separately covered.
    final total = order.grandTotal;
    final isFullyPaid = order.accumulatedFunds >= total;
    final remaining =
        isFullyPaid ? 0 : (total - order.accumulatedFunds).clamp(0, total);
    final progress = (order.accumulatedFunds / total).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () => Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (_) => const MainShell()),
              (route) => false),
        ),
        title: Text(lang.bnplPaymentTitle,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Success banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isFullyPaid
                    ? AppColors.primaryGreen
                    : AppColors.primaryDark,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isFullyPaid
                          ? Icons.celebration_rounded
                          : Icons.check_circle_outline_rounded,
                      size: 36,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isFullyPaid ? lang.fullyPaid : lang.paymentSuccessful,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isFullyPaid
                        ? lang.completedAllPayments
                        : lang.instalmentRecorded,
                    style: TextStyle(
                        fontSize: 13, color: Colors.white.withOpacity(0.75)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Payment summary card
            AppCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.paymentSummary,
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textMuted,
                          letterSpacing: 1)),
                  const SizedBox(height: 14),
                  _row(lang.orderLabel, order.orderNumber),
                  const Divider(height: 20),
                  _row(lang.productLabel, order.product.name),
                  const Divider(height: 20),
                  _row(lang.contributionAdded, _fmt(amountPaid),
                      valueColor: AppColors.primaryGreen),
                  const Divider(height: 20),
                  _row(lang.accumulatedFunds, _fmt(order.accumulatedFunds),
                      valueColor: AppColors.primaryGreen),
                  const Divider(height: 20),
                  _row(lang.remainingBalance, _fmt(remaining),
                      valueColor: remaining == 0
                          ? AppColors.primaryGreen
                          : AppColors.warning),
                  const Divider(height: 20),
                  _row(lang.totalAmount, _fmt(totalAmount)),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Fee breakdown card
            AppCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Fee Breakdown',
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textMuted,
                          letterSpacing: 1)),
                  const SizedBox(height: 14),
                  _row('Base Price', _fmt(order.basePrice)),
                  if (order.accountCreationFee > 0)
                    _row('Account Creation Fee',
                        '+ ${_fmt(order.accountCreationFee)}'),
                  _row('Delivery Fee', '+ ${_fmt(order.deliveryFee)}'),
                  _row('Collection Fee', '+ ${_fmt(order.collectionFee)}'),
                  _row('Stocking Fee', '+ ${_fmt(order.stockingFee)}'),
                  const Divider(height: 20),
                  _row('Total Fees', _fmt(order.totalFees)),
                  const Divider(height: 20),
                  _row('Grand Total', _fmt(order.grandTotal)),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Progress bar card
            AppCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.repaymentProgress,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary)),
                      Text('${(progress * 100).round()}%',
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryGreen)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      minHeight: 10,
                      backgroundColor: const Color(0xFFD0E8E5),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          AppColors.primaryGreen),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${lang.paid2}: ${_fmt(amountPaid)}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textSecondary)),
                      Text('${lang.leftLabel}: ${_fmt(remaining)}',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: remaining == 0
                                  ? AppColors.primaryGreen
                                  : AppColors.warning)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            if (!isFullyPaid) ...[
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                          color: AppColors.warning.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.event_rounded,
                          color: AppColors.warning, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.nextPaymentDue,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary)),
                          const SizedBox(height: 2),
                          Text(
                            '${order.nextDue.day} ${_monthName(order.nextDue.month)} ${order.nextDue.year}',
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            if (overpayRefunded > 0) ...[
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.account_balance_wallet_outlined,
                          color: AppColors.primaryGreen, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.overpaymentRefunded,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary)),
                          const SizedBox(height: 2),
                          Text(
                            '${_fmt(overpayRefunded)} ${lang.returnedToWallet}',
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primaryGreen),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            ElevatedButton(
              onPressed: () => Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const MainShell()),
                  (route) => false),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(lang.backToHome,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const MainShell(
                          initialIndex: 3, initialHistoryTab: 1)),
                  (route) => false,
                );
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                side: const BorderSide(color: AppColors.primaryGreen),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(lang.viewMyOrders,
                  style: const TextStyle(color: AppColors.primaryGreen)),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _row(String l, String v, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(l,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary)),
        ),
        const SizedBox(width: 8),
        Text(v,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: valueColor ?? AppColors.textPrimary)),
      ],
    );
  }
}

// ─── Insufficient Funds Bottom Sheet ──────────────────────────────────────
class _InsufficientFundsSheet extends StatelessWidget {
  final int required;
  final int available;

  const _InsufficientFundsSheet({
    required this.required,
    required this.available,
  });

  String _fmt(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,$r FCFA';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final shortfall = required - available;

    return Container(
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Icon
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.account_balance_wallet_outlined,
                size: 32, color: Color(0xFFF57C00)),
          ),
          const SizedBox(height: 16),

          Text(lang.insufficientBalance,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Text(
            lang.insufficientBalanceDesc(_fmt(available), _fmt(required)),
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 14, color: AppColors.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 20),

          // Shortfall summary card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8F0),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFCC80)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(lang.amountNeededTopUp,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
                Text(_fmt(shortfall),
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFF57C00))),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Top Up button
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const DepositScreen()),
              );
            },
            icon: const Icon(Icons.add_rounded, size: 20),
            label: Text(lang.topUpWallet),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
          ),
          const SizedBox(height: 10),

          // Cancel
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(lang.maybeLater,
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
