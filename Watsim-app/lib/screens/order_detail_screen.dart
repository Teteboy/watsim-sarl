import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../widgets/order_sheets.dart';
import '../widgets/pin_confirm_dialog.dart';
import '../widgets/shared_widgets.dart';
import '../order_state.dart';
import '../wallet_state.dart';
import '../notification_state.dart';
import '../services/api_service.dart';
import 'deposit_screen.dart';
import 'catalogue_screen.dart';
import '../services/language_service.dart';

// ─── Companion changes required in other files ────────────────────────────────
//
// 1. lib/order_state.dart  →  ConfirmedOrder needs:
//      void exchangeProduct(Product newProduct, int newPrice) {
//        // Replace product & reset basePrice; keep accumulatedFunds intact
//        _product = newProduct;
//        _basePrice = newPrice;
//        notifyListeners();           // or equivalent state-notify pattern
//      }
//
// 2. lib/wallet_state.dart  →  WalletState needs:
//      // Tracks the user's remaining BNPL contribution allowance.
//      // Starts at your app's configured maximum (e.g. 500,000 FCFA).
//      int _maxContribution = 500000;
//      int get maxContribution => _maxContribution;
//      void deductMaxContribution(int amount) {
//        _maxContribution = (_maxContribution - amount).clamp(0, _maxContribution);
//        notifyListeners();
//      }
//
// 3. lib/screens/catalogue_screen.dart  →  CatalogueScreen needs optional params:
//      final bool exchangeMode;
//      final ConfirmedOrder? exchangeSourceOrder;
//      final void Function(Product)? onProductSelectedForExchange;
//    In exchange mode, each product card's primary button becomes "Select for Exchange"
//    which calls onProductSelectedForExchange!(product) instead of the normal order flow.
//
// ─────────────────────────────────────────────────────────────────────────────

int _parseProductPrice(String priceStr) {
  final digits = priceStr.replaceAll(RegExp(r'[^0-9]'), '');
  return int.tryParse(digits) ?? 0;
}

class OrderDetailScreen extends StatefulWidget {
  final ConfirmedOrder order;
  const OrderDetailScreen({super.key, required this.order});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  ConfirmedOrder get order {
    for (final current in OrderState.instance.orders) {
      if (widget.order.id != null && current.id == widget.order.id) return current;
    }
    return widget.order;
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

  @override
  void initState() {
    super.initState();
    OrderState.instance.addListener(_refresh);
    WalletState.instance.addListener(_refresh);
  }

  @override
  void dispose() {
    OrderState.instance.removeListener(_refresh);
    WalletState.instance.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  bool _paying = false;

  Map<String, dynamic>? get _nextInstalment {
    for (final inst in order.instalments) {
      if (inst['status'] != 'PAID' && (inst['id'] as String? ?? '').isNotEmpty) {
        return inst;
      }
    }
    return null;
  }

  Future<void> _handlePayNow() async {
    final inst = _nextInstalment;
    if (_paying || order.id == null || inst == null) return;
    setState(() => _paying = true);
    try {
      final confirmed = await showPinConfirmDialog(context);
      if (!mounted || !confirmed) return;
      // Repayment charges the server-defined instalment amount, not arbitrary
      // local contributions. WALLET is supported by the repayment schema.
      await ApiService.payInstalment(
        purchaseId: order.id!,
        instalmentId: inst['id'] as String,
        paymentProvider: 'WALLET',
        phone: '',
      );
      await Future.wait([
        WalletState.instance.syncWithBackend(),
        OrderState.instance.syncWithBackend(),
      ]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paiement envoyé. Solde synchronisé.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiException ? e.message : 'Paiement impossible. Veuillez réessayer.')),
      );
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _handleExchange() {
    // Navigate to the full catalogue so the user can browse all products.
    // No BNPL simulation — the existing payment frequency is preserved.
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CatalogueScreen(
          exchangeMode: true,
          exchangeSourceOrder: order,
          onProductSelectedForExchange: (Product newProduct) {
            Navigator.pop(context); // close catalogue
            final newPrice = _parseProductPrice(newProduct.price);
            final accumulated = order.accumulatedFunds;

            // Determine what happens to the accumulated funds vs the new price
            final int remaining = (newPrice - accumulated).clamp(0, newPrice);
            final int overpayPreview =
                accumulated > newPrice ? accumulated - newPrice : 0;
            final bool willComplete = accumulated >= newPrice;

            _showExchangeConfirmSheet(
              newProduct,
              newPrice: newPrice,
              accumulated: accumulated,
              remaining: remaining,
              overpayPreview: overpayPreview,
              willComplete: willComplete,
            );
          },
        ),
      ),
    );
  }

  void _showExchangeConfirmSheet(
    Product newProduct, {
    required int newPrice,
    required int accumulated,
    required int remaining,
    required int overpayPreview,
    required bool willComplete,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ExchangeConfirmSheet(
        currentOrder: order,
        newProduct: newProduct,
        newPrice: newPrice,
        accumulated: accumulated,
        remaining: remaining,
        overpayPreview: overpayPreview,
        willComplete: willComplete,
        onExchanged: () => setState(() {}),
      ),
    );
  }

  void _handleDeliver() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => DeliverySheet(
        order: order,
        onDeliveryConfirmed: () {
          // Mark delivery as requested — order stays visible in history
          order.markDeliveryRequested();
          // Fire notification
          NotificationState.instance.onDeliveryRequested(order.product.name);
          // Show snackbar on detail screen
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 5),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: const [
                  Icon(Icons.local_shipping_rounded,
                      color: Colors.white, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Delivery details received!',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              fontSize: 14),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Your details have been received. You will receive your product shortly.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _handleTransfer() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => WatSimTransferSheet(
        sourceOrder: order,
        onTransferred: () {
          Navigator.pop(context); // pop detail screen since order was removed
        },
      ),
    );
  }

  void _handleWithdraw() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => WithdrawSheet(
        order: order,
        onWithdrawn: () {
          setState(() {});
          Navigator.pop(context);
        },
      ),
    );
  }

  /// The date on which the contribution plan ends (last installment due date).
  DateTime get _planEndDate =>
      order.installmentDueDate(order.totalInstallments - 1);

  /// Countdown text: days remaining until the plan end date.
  String _countdownText() {
    final now = DateTime.now();
    final end = _planEndDate;
    final diff = end.difference(DateTime(now.year, now.month, now.day)).inDays;
    if (diff <= 0) return 'Ended';
    if (diff == 1) return '1 day left';
    return '$diff days left';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final p = order.product;
    final isFullyPaid = order.isFullyPaid;

    final endDate = _planEndDate;
    final endDateStr =
        '${endDate.day} ${_monthName(endDate.month)} ${endDate.year}';
    final countdown = _countdownText();

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: AppColors.primaryDark,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: Colors.white, size: 20),
              onPressed: () => Navigator.pop(context),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    p.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(color: p.color),
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Container(
                          color: p.color,
                          child: const Center(
                              child: CircularProgressIndicator(
                                  color: AppColors.primaryGreen,
                                  strokeWidth: 2)));
                    },
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withOpacity(0.25),
                          Colors.black.withOpacity(0.72)
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 20,
                    left: 20,
                    right: 20,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const BnplTag(),
                        const SizedBox(height: 8),
                        Text(p.name,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(p.price,
                            style: const TextStyle(
                                color: AppColors.primaryGreen,
                                fontSize: 15,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Order summary
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _row('Order number', order.orderNumber),
                        const Divider(height: 20),
                        _row('Status', isFullyPaid ? 'Completed' : 'Ongoing',
                            valueColor: isFullyPaid
                                ? AppColors.textMuted
                                : AppColors.primaryGreen),
                        const Divider(height: 20),
                        // Countdown to plan termination (replaces Plan)
                        if (!isFullyPaid) ...[
                          _rowWithBadge(
                            'Time remaining',
                            countdown,
                            badgeColor:
                                AppColors.primaryGreen.withOpacity(0.12),
                            badgeTextColor: AppColors.primaryGreen,
                          ),
                        ] else ...[
                          _row('Time remaining', 'Completed ✓',
                              valueColor: AppColors.primaryGreen),
                        ],
                        const Divider(height: 20),
                        // End date of the contribution (replaces Next due)
                        _row(
                          isFullyPaid ? 'Completed on' : 'Contribution ends',
                          isFullyPaid ? 'All paid \u2713' : endDateStr,
                          valueColor:
                              isFullyPaid ? AppColors.primaryGreen : null,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Payment progress bars ────────────────────────────────
                  _PaymentProgressCard(order: order),
                  const SizedBox(height: 24),

                  // Payment area
                  if (isFullyPaid)
                    const FullyPaidBanner()
                  else
                    _PayNowSection(order: order, onPay: _paying || order.id == null || _nextInstalment == null ? null : _handlePayNow),

                  // ── Transfer & Withdraw (ongoing) ──────────────────────────
                  if (!isFullyPaid) ...[
                    const SizedBox(height: 20),
                    Text(lang.manageContribution,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMuted,
                            letterSpacing: 1)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _ActionButton(
                            icon: Icons.swap_horiz_rounded,
                            label: lang.transferLabel,
                            subtitle: lang.transferSubLabel,
                            color: const Color(0xFF1565C0),
                            onTap: _handleTransfer,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _ActionButton(
                            icon: Icons.account_balance_wallet_outlined,
                            label: lang.withdrawLabel,
                            subtitle: lang.withdrawSubLabel,
                            color: const Color(0xFFF57C00),
                            onTap: _handleWithdraw,
                          ),
                        ),
                      ],
                    ),
                  ],

                  // ── Exchange, Withdraw & Deliver (fully paid) ──────────────
                  if (isFullyPaid) ...[
                    const SizedBox(height: 20),
                    Text(lang.productActions,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMuted,
                            letterSpacing: 1)),
                    const SizedBox(height: 12),
                    if (order.deliveryCompleted)
                      _DeliveryCompletedBanner(productName: order.product.name)
                    else if (order.deliveryRequested)
                      _DeliveryRequestedBanner()
                    else
                      Row(
                        children: [
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.swap_horiz_rounded,
                              label: 'Exchange',
                              subtitle: 'Swap for same price',
                              color: const Color(0xFF607D8B),
                              onTap: _handleExchange,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.account_balance_wallet_outlined,
                              label: 'Withdraw',
                              subtitle: '30% charge applies',
                              color: const Color(0xFFF57C00),
                              onTap: _handleWithdraw,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.local_shipping_rounded,
                              label: 'Deliver',
                              subtitle: 'Request delivery',
                              color: AppColors.primaryGreen,
                              onTap: _handleDeliver,
                            ),
                          ),
                        ],
                      ),
                  ],

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                color: valueColor ?? AppColors.textPrimary)),
      ],
    );
  }

  Widget _rowWithBadge(String label, String value,
      {required Color badgeColor, required Color badgeTextColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary)),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: badgeColor,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: badgeTextColor),
          ),
        ),
      ],
    );
  }
}

// ── Payment progress bars card ─────────────────────────────────────────────
class _PaymentProgressCard extends StatelessWidget {
  final ConfirmedOrder order;
  const _PaymentProgressCard({required this.order});

  static String _fmt(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,$r FCFA';
  }

  @override
  Widget build(BuildContext context) {
    final total = order.grandTotal;
    final paid = order.accumulatedFunds.clamp(0, total);
    final remaining = (total - paid).clamp(0, total);
    final paidPct = total > 0 ? (paid / total).clamp(0.0, 1.0) : 0.0;
    final remainPct = 1.0 - paidPct;
    final paidPctInt = (paidPct * 100).round();
    final remainPctInt = 100 - paidPctInt;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PAYMENT PROGRESS',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1),
          ),
          const SizedBox(height: 16),

          // ── Paid bar ───────────────────────────────────────────────────
          _BarRow(
            label: 'Paid',
            amount: _fmt(paid),
            percent: paidPctInt,
            fillRatio: paidPct,
            barColor: AppColors.primaryGreen,
            percentColor: AppColors.primaryGreen,
          ),
          const SizedBox(height: 14),

          // ── Remaining bar ──────────────────────────────────────────────
          _BarRow(
            label: 'Remaining',
            amount: _fmt(remaining),
            percent: remainPctInt,
            fillRatio: remainPct,
            barColor: const Color(0xFFF57C00),
            percentColor: const Color(0xFFF57C00),
          ),
        ],
      ),
    );
  }
}

class _BarRow extends StatelessWidget {
  final String label;
  final String amount;
  final int percent;
  final double fillRatio;
  final Color barColor;
  final Color percentColor;

  const _BarRow({
    required this.label,
    required this.amount,
    required this.percent,
    required this.fillRatio,
    required this.barColor,
    required this.percentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary)),
            Row(
              children: [
                Text(amount,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: barColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$percent%',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: percentColor),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Stack(
            children: [
              Container(
                height: 10,
                color: barColor.withOpacity(0.1),
              ),
              FractionallySizedBox(
                widthFactor: fillRatio,
                child: Container(
                  height: 10,
                  decoration: BoxDecoration(
                    color: barColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Action button tile ─────────────────────────────────────────────────────
class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton(
      {required this.icon,
      required this.label,
      required this.subtitle,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: color, borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(height: 12),
            Text(label,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(subtitle,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.7), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

// ── Exchange sheet ─────────────────────────────────────────────────────────
class _ExchangeSheet extends StatefulWidget {
  final ConfirmedOrder currentOrder;
  final List<Product> candidates;
  final VoidCallback onExchanged;

  const _ExchangeSheet(
      {required this.currentOrder,
      required this.candidates,
      required this.onExchanged});

  @override
  State<_ExchangeSheet> createState() => _ExchangeSheetState();
}

class _ExchangeSheetState extends State<_ExchangeSheet> {
  Product? _selected;
  bool _showPin = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;
  bool _done = false;

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  void _confirm() async {
    final pinValid =
        await ApiService.verifyTransactionPin(_pinCtrl.text.trim());
    if (!mounted) return;
    if (pinValid) {
      setState(() => _done = true);
      widget.onExchanged();
    } else {
      setState(() => _pinError = 'Incorrect PIN. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 32),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            if (_done) ...[
              Center(
                  child: Column(children: [
                Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.12),
                        shape: BoxShape.circle),
                    child: const Icon(Icons.swap_horiz_rounded,
                        size: 36, color: AppColors.primaryGreen)),
                const SizedBox(height: 16),
                Text(lang.exchangeConfirmed,
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary)),
                const SizedBox(height: 8),
                Text(lang.exchangedFor(_selected!.name),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5)),
                const SizedBox(height: 24),
                ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.done)),
              ])),
            ] else if (_showPin) ...[
              Text(lang.confirmWithPIN,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(
                  lang.exchangePINDesc(
                      widget.currentOrder.product.name, _selected!.name),
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.divider)),
                child: Row(children: [
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(lang.current,
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(widget.currentOrder.product.name,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                      ])),
                  const Icon(Icons.arrow_forward_rounded,
                      color: AppColors.primaryGreen, size: 20),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                        Text(lang.newLabel,
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(_selected!.name,
                            textAlign: TextAlign.end,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                      ])),
                ]),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                    labelText: '4-digit PIN',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    counterText: '',
                    errorText: _pinError),
                onChanged: (_) {
                  if (_pinError != null) setState(() => _pinError = null);
                },
              ),
              const SizedBox(height: 6),

              const SizedBox(height: 20),
              Row(children: [
                Expanded(
                    child: OutlinedButton(
                  onPressed: () => setState(() => _showPin = false),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50),
                      side: const BorderSide(color: AppColors.divider),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                  child: Text(lang.back,
                      style: TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: ElevatedButton(
                        onPressed: _confirm,
                        style: ElevatedButton.styleFrom(
                            minimumSize: const Size(0, 50)),
                        child: Text(lang.confirm))),
              ]),
            ] else ...[
              Text(lang.exchangeProduct,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(lang.selectSamePriceProduct,
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 16),
              if (widget.candidates.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                      color: AppColors.offWhite,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.divider)),
                  child: Center(
                      child: Text(lang.noOtherProductsSamePrice,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 14, color: AppColors.textMuted))),
                )
              else ...[
                ...widget.candidates.map((p) => GestureDetector(
                      onTap: () => setState(() => _selected = p),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: _selected?.name == p.name
                              ? AppColors.primaryGreen.withOpacity(0.06)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _selected?.name == p.name
                                ? AppColors.primaryGreen
                                : AppColors.divider,
                            width: _selected?.name == p.name ? 1.5 : 1,
                          ),
                        ),
                        child: Row(children: [
                          Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                  color: p.color,
                                  borderRadius: BorderRadius.circular(10)),
                              child:
                                  Icon(p.icon, color: Colors.white, size: 24)),
                          const SizedBox(width: 14),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(p.name,
                                    style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary)),
                                const SizedBox(height: 2),
                                Text(p.price,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.primaryGreen,
                                        fontWeight: FontWeight.w600)),
                                Text(p.category,
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textMuted)),
                              ])),
                          if (_selected?.name == p.name)
                            const Icon(Icons.check_circle_rounded,
                                color: AppColors.primaryGreen, size: 22),
                        ]),
                      ),
                    )),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _selected == null
                      ? null
                      : () => setState(() => _showPin = true),
                  child: Text(lang.continueToPIN),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// ── Delivery Requested banner ──────────────────────────────────────────────
class _DeliveryRequestedBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFE3F2FD),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1565C0).withOpacity(0.35)),
      ),
      child: Row(children: [
        Icon(Icons.local_shipping_rounded, color: Color(0xFF1565C0), size: 28),
        SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.deliveryRequestedTitle,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1565C0))),
          SizedBox(height: 2),
          Text(lang.deliveryOnTheWay,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
    );
  }
}

// ── Delivery Completed banner ──────────────────────────────────────────────
class _DeliveryCompletedBanner extends StatelessWidget {
  final String productName;
  const _DeliveryCompletedBanner({required this.productName});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.primaryGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primaryGreen.withOpacity(0.35)),
      ),
      child: Row(children: [
        Icon(Icons.verified_rounded, color: AppColors.primaryGreen, size: 28),
        SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.productDeliveredCelebration,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryGreen)),
          SizedBox(height: 2),
          Text(
              'Your product was successfully delivered. Thank you for using WatSim!',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
    );
  }
}

// ── This month already paid banner ────────────────────────────────────────
// ── Pay now section ────────────────────────────────────────────────────────
class _PayNowSection extends StatelessWidget {
  final ConfirmedOrder order;
  final VoidCallback? onPay;

  const _PayNowSection({required this.order, required this.onPay});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final wallet = WalletState.instance;
    final hasAnyFunds = wallet.balance > 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: hasAnyFunds
              ? AppColors.primaryGreen.withOpacity(0.08)
              : AppColors.warning.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: hasAnyFunds
                  ? AppColors.primaryGreen.withOpacity(0.25)
                  : AppColors.warning.withOpacity(0.35)),
        ),
        child: Row(children: [
          Icon(Icons.account_balance_wallet_outlined,
              size: 18,
              color: hasAnyFunds ? AppColors.primaryGreen : AppColors.warning),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('Wallet: ${wallet.balanceFormatted}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: hasAnyFunds
                            ? AppColors.primaryGreen
                            : AppColors.warning)),
                Text('Accumulated: ${_fmtAccumulated(order.accumulatedFunds)}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ])),
        ]),
      ),
      const SizedBox(height: 14),
      ElevatedButton.icon(
          onPressed: onPay,
          icon: const Icon(Icons.payments_outlined, size: 18),
          label: Text(lang.makeAContribution)),
    ]);
  }

  String _fmtAccumulated(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,$r FCFA';
  }
}

// ── Installment row ────────────────────────────────────────────────────────
// ── Contribution tracker ───────────────────────────────────────────────────
/// Shows every contribution slot as a card with a progress bar.
/// The bar fills proportionally based on how much has been paid toward that slot.
/// Slots completed by a prior contribution are shown as 100 % / green.
/// The active (partially-filled) slot shows real fill + percentage.
/// Future slots show 0 % with the required amount alongside.
class _ContributionTracker extends StatefulWidget {
  final ConfirmedOrder order;
  const _ContributionTracker({required this.order});

  @override
  State<_ContributionTracker> createState() => _ContributionTrackerState();
}

class _ContributionTrackerState extends State<_ContributionTracker> {
  // Which group is currently expanded (null = all collapsed)
  int? _expandedGroup;

  static String _fmt(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,$r FCFA';
  }

  // Build one _SlotProgressCard given the slot index i and derived values
  Widget _buildCard(
    int i, {
    required int perSlot,
    required int total,
    required int doneSlots,
    required int activeSlot,
    required int spillover,
  }) {
    final isComplete = i < doneSlots;
    final isActive = i == activeSlot;
    final isFuture = !isComplete && !isActive;

    final double fillRatio = isComplete
        ? 1.0
        : isActive && perSlot > 0
            ? (spillover / perSlot).clamp(0.0, 1.0)
            : 0.0;

    final int paidInSlot = isComplete
        ? perSlot
        : isActive
            ? spillover
            : 0;
    final int remaining = perSlot - paidInSlot;
    final int pct = (fillRatio * 100).round();

    return _SlotProgressCard(
      index: i + 1,
      total: total,
      perSlot: perSlot,
      paidInSlot: paidInSlot,
      remaining: remaining,
      fillRatio: fillRatio,
      percent: pct,
      isComplete: isComplete,
      isActive: isActive,
      isFuture: isFuture,
      fmt: _fmt,
    );
  }

  @override
  Widget build(BuildContext context) {
    final perSlot = widget.order.perInstallment;
    final total = widget.order.totalInstallments;
    final accumulated = widget.order.accumulatedFunds;

    final fullSlots = perSlot > 0 ? (accumulated ~/ perSlot) : 0;
    final spillover = perSlot > 0 ? (accumulated % perSlot) : 0;
    final doneSlots = fullSlots.clamp(0, total);
    final activeSlot = doneSlots < total ? doneSlots : -1;

    // ── Short plan: show all cards directly (≤ 12) ──────────────────────────
    if (total <= 12) {
      return Column(
        children: List.generate(
            total,
            (i) => _buildCard(
                  i,
                  perSlot: perSlot,
                  total: total,
                  doneSlots: doneSlots,
                  activeSlot: activeSlot,
                  spillover: spillover,
                )),
      );
    }

    // ── Long plan: group into buckets of 6, shown as accordion ──────────────
    const groupSize = 6;
    final groupCount = (total / groupSize).ceil();

    // Summary bar at the top
    final paidCount = doneSlots;
    final remainCount = total - paidCount;
    final overallPct = total > 0 ? (paidCount / total * 100).round() : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Overall progress summary card ────────────────────────────────────
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
            boxShadow: [
              BoxShadow(
                  color: AppColors.primaryGreen.withOpacity(0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$paidCount of $total contributions made',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('$overallPct%',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(children: [
                  Container(
                      height: 10,
                      color: AppColors.primaryGreen.withOpacity(0.08)),
                  FractionallySizedBox(
                    widthFactor:
                        total > 0 ? (paidCount / total).clamp(0.0, 1.0) : 0,
                    child: Container(
                      height: 10,
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                      LanguageService().isFrench
                          ? '${_fmt(accumulated)} accumulé'
                          : '${_fmt(accumulated)} accumulated',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryGreen)),
                  if (remainCount > 0)
                    Text(
                        LanguageService().isFrench
                            ? '$remainCount restant${remainCount > 1 ? 's' : ''}'
                            : '$remainCount remaining',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],
          ),
        ),

        // ── Accordion groups ─────────────────────────────────────────────────
        ...List.generate(groupCount, (g) {
          final startIdx = g * groupSize; // inclusive, 0-based
          final endIdx =
              (startIdx + groupSize - 1).clamp(0, total - 1); // inclusive
          final startNum = startIdx + 1; // 1-based display
          final endNum = endIdx + 1;

          // Group status
          final allDone = endIdx < doneSlots;
          final hasActive = activeSlot >= startIdx && activeSlot <= endIdx;
          final isExpanded = _expandedGroup == g;

          final Color headerBg = allDone
              ? AppColors.primaryGreen.withOpacity(0.07)
              : hasActive
                  ? const Color(0xFFFFF8F0)
                  : AppColors.offWhite;

          final Color borderColor = allDone
              ? AppColors.primaryGreen.withOpacity(0.35)
              : hasActive
                  ? const Color(0xFFFFB74D)
                  : AppColors.divider;

          final Color dotColor = allDone
              ? AppColors.primaryGreen
              : hasActive
                  ? const Color(0xFFF57C00)
                  : AppColors.textMuted;

          final String statusLabel = allDone
              ? 'All paid'
              : hasActive
                  ? 'In progress'
                  : 'Upcoming';

          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isExpanded
                    ? AppColors.primaryGreen.withOpacity(0.5)
                    : borderColor,
                width: isExpanded ? 1.5 : 1,
              ),
              boxShadow: isExpanded
                  ? [
                      BoxShadow(
                          color: AppColors.primaryGreen.withOpacity(0.07),
                          blurRadius: 10,
                          offset: const Offset(0, 2))
                    ]
                  : [],
            ),
            child: Column(
              children: [
                // Header / tap target
                InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => setState(() {
                    _expandedGroup = isExpanded ? null : g;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: isExpanded
                          ? AppColors.primaryGreen.withOpacity(0.04)
                          : headerBg,
                      borderRadius: isExpanded
                          ? const BorderRadius.vertical(
                              top: Radius.circular(16))
                          : BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        // Status dot
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: dotColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),

                        // Label
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Contributions $startNum–$endNum',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                statusLabel,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: allDone
                                        ? AppColors.primaryGreen
                                        : hasActive
                                            ? const Color(0xFFF57C00)
                                            : AppColors.textMuted,
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),

                        // Paid count chip
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: allDone
                                ? AppColors.primaryGreen.withOpacity(0.1)
                                : AppColors.primaryGreen.withOpacity(0.05),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            allDone
                                ? '${endNum - startNum + 1}/${endNum - startNum + 1} paid'
                                : '${(doneSlots - startIdx).clamp(0, endNum - startNum + 1)}/${endNum - startNum + 1} paid',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: allDone
                                    ? AppColors.primaryGreen
                                    : AppColors.textMuted),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Chevron
                        AnimatedRotation(
                          turns: isExpanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: const Icon(Icons.keyboard_arrow_down_rounded,
                              color: AppColors.textMuted, size: 22),
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded cards
                if (isExpanded)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                    child: Column(
                      children: List.generate(endIdx - startIdx + 1, (j) {
                        return _buildCard(
                          startIdx + j,
                          perSlot: perSlot,
                          total: total,
                          doneSlots: doneSlots,
                          activeSlot: activeSlot,
                          spillover: spillover,
                        );
                      }),
                    ),
                  ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

/// One card per contribution slot showing progress bar + status.
class _SlotProgressCard extends StatelessWidget {
  final int index, total, perSlot, paidInSlot, remaining, percent;
  final double fillRatio;
  final bool isComplete, isActive, isFuture;
  final String Function(int) fmt;

  const _SlotProgressCard({
    required this.index,
    required this.total,
    required this.perSlot,
    required this.paidInSlot,
    required this.remaining,
    required this.fillRatio,
    required this.percent,
    required this.isComplete,
    required this.isActive,
    required this.isFuture,
    required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    // Colour scheme per state
    final Color barFill = isComplete
        ? AppColors.primaryGreen
        : isActive
            ? AppColors.primaryGreen
            : AppColors.primaryGreen.withOpacity(0.18);

    final Color barBg = AppColors.primaryGreen.withOpacity(0.08);

    final Color cardBorder = isComplete
        ? AppColors.primaryGreen.withOpacity(0.35)
        : isActive
            ? AppColors.primaryGreen.withOpacity(0.5)
            : AppColors.divider;

    final Color circleColor = isComplete
        ? AppColors.primaryGreen
        : isActive
            ? AppColors.primaryGreen.withOpacity(0.15)
            : AppColors.primaryGreen.withOpacity(0.07);

    final Color circleTextColor =
        isComplete ? Colors.white : AppColors.primaryGreen;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cardBorder, width: isActive ? 1.5 : 1),
        boxShadow: isActive
            ? [
                BoxShadow(
                    color: AppColors.primaryGreen.withOpacity(0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2))
              ]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ────────────────────────────────────────────────
          Row(
            children: [
              // Slot number circle
              Container(
                width: 38,
                height: 38,
                decoration:
                    BoxDecoration(color: circleColor, shape: BoxShape.circle),
                child: Center(
                  child: isComplete
                      ? const Icon(Icons.check_rounded,
                          color: Colors.white, size: 18)
                      : Text(
                          index.toString().padLeft(2, '0'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: circleTextColor,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),

              // Title + required amount
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Contribution $index/$total',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: isFuture
                            ? AppColors.textMuted
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      fmt(perSlot),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isComplete
                            ? AppColors.primaryGreen
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),

              // Status badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isComplete
                      ? AppColors.primaryGreen.withOpacity(0.12)
                      : isActive
                          ? const Color(0xFFFFF3E0)
                          : AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isComplete
                      ? 'Complete'
                      : isActive
                          ? 'In Progress'
                          : 'Upcoming',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isComplete
                        ? AppColors.primaryGreen
                        : isActive
                            ? const Color(0xFFF57C00)
                            : AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // ── Progress bar ──────────────────────────────────────────────
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Stack(
              children: [
                // Background track
                Container(height: 10, color: barBg),
                // Fill
                FractionallySizedBox(
                  widthFactor: fillRatio,
                  child: Container(
                    height: 10,
                    decoration: BoxDecoration(
                      color: barFill,
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // ── Footer: percentage left + remaining amount ─────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$percent%',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: isComplete
                      ? AppColors.primaryGreen
                      : isActive
                          ? AppColors.primaryGreen
                          : AppColors.textMuted,
                ),
              ),
              if (!isComplete)
                Text(
                  '${fmt(remaining)} left',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFF57C00),
                  ),
                )
              else
                const Text(
                  'Paid ✓',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryGreen,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
