import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
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

// ─── Fetch products from backend for exchange matching ────────────────────────
Future<List<Product>> _fetchExchangeCandidates(int currentPrice) async {
  try {
    final productsData = await ApiService.fetchProducts();
    // Convert dynamic list to Product list using fromJson for proper gallery parsing
    final products = productsData
        .whereType<Map<String, dynamic>>()
        .map((p) => Product.fromJson(p))
        .toList();
    
    // Filter products with similar price (within 20% range)
    final minPrice = (currentPrice * 0.8).round();
    final maxPrice = (currentPrice * 1.2).round();
    
    return products.where((p) {
      final price = _parseProductPrice(p.price);
      return price >= minPrice && price <= maxPrice;
    }).toList();
  } catch (e) {
    print('Error fetching exchange candidates: $e');
    return [];
  }
}

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
  ConfirmedOrder get order => widget.order;

  String _monthName(int m) => [
        'Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'
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

  void _handlePayNow() {
    // Show contribution entry sheet — no predefined amount
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ContributionSheet(
        totalAmount: order.grandTotal,
        productPrice: order.basePrice,
        onAmountConfirmed: (amount) {
          Navigator.pop(context);
          final wallet = WalletState.instance;
          if (wallet.hasSufficientFunds(amount)) {
            wallet.deduct(amount);
            order.addContribution(amount);
            final installmentNum = order.paidInstallments.length;
            NotificationState.instance.onBnplPaymentMade(
              order.product.name,
              amount,
              installmentNum,
              order.months,
            );

            // Check if accumulated funds now cover the full product price
            final accumulated = order.accumulatedFunds;
            final bool nowComplete = accumulated >= order.basePrice;
            int overpay = 0;

            if (nowComplete && !order.isFullyPaid) {
              // Mark all installments as paid
              order.markFullyPaid();
              // Subtract this product price from the user's maximum contribution
              // allowance since it has been fully paid for.
              WalletState.instance.deductMaxContribution(order.basePrice);
              // If the user paid more than the product price, refund the excess
              overpay = accumulated - order.basePrice;
              if (overpay > 0) {
                wallet.refundOverpay(order.product.name, overpay);
              }
            }

            showModalBottomSheet(
              context: context,
              backgroundColor: Colors.transparent,
              builder: (_) => _PaymentSuccessSheet(
                order: order,
                isNowComplete: nowComplete,
                overpayRefunded: overpay,
              ),
            );
          } else {
            showModalBottomSheet(
              context: context,
              backgroundColor: Colors.transparent,
              isScrollControlled: true,
              builder: (_) => _InsufficientFundsSheet(
                required: amount,
                available: wallet.balance,
              ),
            );
          }
        },
      ),
    );
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
            final int overpayPreview = accumulated > newPrice ? accumulated - newPrice : 0;
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
      builder: (_) => _ExchangeConfirmSheet(
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
      builder: (_) => _DeliverySheet(
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
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: const [
                  Icon(Icons.local_shipping_rounded, color: Colors.white, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Delivery details received!',
                          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 14),
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
      builder: (_) => _WatSimTransferSheet(
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
      builder: (_) => _WithdrawSheet(
        order: order,
        onWithdrawn: () {
          setState(() {});
          Navigator.pop(context);
        },
      ),
    );
  }

  /// The date on which the contribution plan ends (last installment due date).
  DateTime get _planEndDate => order.installmentDueDate(order.totalInstallments - 1);

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
    final endDateStr = '${endDate.day} ${_monthName(endDate.month)} ${endDate.year}';
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
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
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
                      return Container(color: p.color, child: const Center(child: CircularProgressIndicator(color: AppColors.primaryGreen, strokeWidth: 2)));
                    },
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.black.withOpacity(0.25), Colors.black.withOpacity(0.72)],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 20, left: 20, right: 20,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const BnplTag(),
                        const SizedBox(height: 8),
                        Text(p.name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(p.price, style: const TextStyle(color: AppColors.primaryGreen, fontSize: 15, fontWeight: FontWeight.w600)),
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
                            valueColor: isFullyPaid ? AppColors.textMuted : AppColors.primaryGreen),
                        const Divider(height: 20),
                        // Countdown to plan termination (replaces Plan)
                        if (!isFullyPaid) ...[
                          _rowWithBadge(
                            'Time remaining',
                            countdown,
                            badgeColor: AppColors.primaryGreen.withOpacity(0.12),
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
                          valueColor: isFullyPaid ? AppColors.primaryGreen : null,
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
                    _FullyPaidBanner()
                  else
                    _PayNowSection(order: order, onPay: _handlePayNow),

                  // ── Transfer & Withdraw (ongoing) ──────────────────────────
                  if (!isFullyPaid) ...[
                    const SizedBox(height: 20),
                    Text(lang.manageContribution,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
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
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
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
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        ),
        const SizedBox(width: 8),
        Text(value,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: valueColor ?? AppColors.textPrimary)),
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
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
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
                fontSize: 13, fontWeight: FontWeight.w700, color: badgeTextColor),
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

  const _ActionButton({required this.icon, required this.label, required this.subtitle, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.18), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(height: 12),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

// ── Exchange confirm sheet (catalogue-based, handles all price scenarios) ────
class _ExchangeConfirmSheet extends StatefulWidget {
  final ConfirmedOrder currentOrder;
  final Product newProduct;
  final int newPrice;
  final int accumulated;   // funds already in the order
  final int remaining;     // still needed after applying accumulated (0 if willComplete)
  final int overpayPreview; // excess above newPrice (0 if accumulated ≤ newPrice)
  final bool willComplete; // accumulated >= newPrice
  final VoidCallback onExchanged;

  const _ExchangeConfirmSheet({
    required this.currentOrder,
    required this.newProduct,
    required this.newPrice,
    required this.accumulated,
    required this.remaining,
    required this.overpayPreview,
    required this.willComplete,
    required this.onExchanged,
  });

  @override
  State<_ExchangeConfirmSheet> createState() => _ExchangeConfirmSheetState();
}

class _ExchangeConfirmSheetState extends State<_ExchangeConfirmSheet> {
  bool _showPin = false;
  bool _done = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;
  static const _validPin = "1234";

  @override
  void dispose() { _pinCtrl.dispose(); super.dispose(); }

  String _fmt(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, "0");
    return "$t,$r FCFA";
  }

  void _confirm() {
    if (_pinCtrl.text != _validPin) {
      setState(() => _pinError = "Incorrect PIN. Please try again.");
      return;
    }

    final order      = widget.currentOrder;
    final newProduct = widget.newProduct;
    final oldPrice   = order.basePrice;

    // ── 1. Adjust the maximum contribution allowance ──────────────────────
    // Remove the old product's price from the cap (exchange frees up that slot)
    // then add back the new product's price.
    WalletState.instance.restoreMaxContribution(oldPrice);
    WalletState.instance.deductMaxContribution(widget.newPrice);

    // ── 2. Swap the product & transfer accumulated funds ──────────────────
    // exchangeProduct resets installment slots and applies the carried funds.
    final result = order.exchangeProduct(newProduct, widget.newPrice);

    // ── 3. Handle completion outcomes ─────────────────────────────────────
    if (result.completed) {
      // Product is immediately paid off — reset cap for this product
      WalletState.instance.restoreMaxContribution(widget.newPrice);

      // Refund any overpay to wallet
      if (result.overpay > 0) {
        WalletState.instance.refundOverpay(newProduct.name, result.overpay);
        NotificationState.instance.addGenericNotification(
          "Exchange Complete — Refund",
          "${_fmt(result.overpay)} refunded to your wallet after exchanging ${order.product.name} for ${newProduct.name}.",
        );
      } else {
        NotificationState.instance.addGenericNotification(
          "Exchange Complete",
          "Your accumulated funds exactly covered ${newProduct.name}. Order marked complete.",
        );
      }
    } else {
      // Partially covered — user continues contributing
      NotificationState.instance.addGenericNotification(
        "Product Exchanged",
        "Switched to ${newProduct.name}. ${_fmt(widget.accumulated)} transferred. ${_fmt(widget.remaining)} still needed.",
      );
    }

    widget.onExchanged();
    setState(() => _done = true);
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final order      = widget.currentOrder;
    final newProduct = widget.newProduct;
    final isShortfall = !widget.willComplete && widget.remaining > 0;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),

            // ── Done state ───────────────────────────────────────────────
            if (_done) ...[
              Center(child: Column(children: [
                Container(width: 72, height: 72,
                    decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.12), shape: BoxShape.circle),
                    child: Icon(
                      widget.willComplete ? Icons.verified_rounded : Icons.swap_horiz_rounded,
                      size: 36, color: AppColors.primaryGreen,
                    )),
                const SizedBox(height: 16),
                Text(
                  widget.willComplete ? 'Exchange Complete! 🎉' : lang.exchangeConfirmed,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.willComplete
                      ? widget.overpayPreview > 0
                          ? "Exchanged for ${newProduct.name} and fully paid off.\n${_fmt(widget.overpayPreview)} refunded to your wallet."
                          : "Your accumulated funds exactly covered ${newProduct.name}. Order is complete!"
                      : "Exchanged for ${newProduct.name}.\n${_fmt(widget.accumulated)} transferred. "
                        "Keep contributing ${_fmt(widget.remaining)} more with your ${order.paymentFrequency.toLowerCase()} payments.",
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(onPressed: () => Navigator.pop(context), child: Text(lang.done)),
              ])),

            // ── PIN entry ────────────────────────────────────────────────
            ] else if (_showPin) ...[
              Text(lang.confirmWithPIN,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text("Enter your 4-digit PIN to confirm the exchange.",
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
              const SizedBox(height: 20),

              // Product swap summary
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.divider)),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(lang.current, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(order.product.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  ])),
                  const Icon(Icons.arrow_forward_rounded, color: AppColors.primaryGreen, size: 20),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(lang.newLabel, style: const TextStyle(fontSize: 11, color: AppColors.primaryGreen, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(newProduct.name, textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  ])),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome banner
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(Icons.account_balance_wallet_outlined, AppColors.primaryGreen, const Color(0xFFE8F5E9),
                  "${_fmt(widget.overpayPreview)} will be refunded to your wallet after completing the order.")
              else if (widget.willComplete)
                _infoBanner(Icons.check_circle_outline_rounded, AppColors.primaryGreen, const Color(0xFFE8F5E9),
                  "Your accumulated funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(Icons.info_outline_rounded, const Color(0xFFF57C00), const Color(0xFFFFF3E0),
                  "You still need ${_fmt(widget.remaining)} more. Your ${order.paymentFrequency.toLowerCase()} contributions will continue on the new product."),

              const SizedBox(height: 20),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(labelText: "4-digit PIN", prefixIcon: const Icon(Icons.lock_outline_rounded), counterText: "", errorText: _pinError),
                onChanged: (_) { if (_pinError != null) setState(() => _pinError = null); },
              ),
              const SizedBox(height: 6),
              Text(lang.demoPIN, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic)),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(child: OutlinedButton(
                  onPressed: () => setState(() { _showPin = false; _pinCtrl.clear(); _pinError = null; }),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50), side: const BorderSide(color: AppColors.divider), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  child: Text(lang.back, style: const TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(child: ElevatedButton(onPressed: _confirm, style: ElevatedButton.styleFrom(minimumSize: const Size(0, 50)), child: Text(lang.confirm))),
              ]),

            // ── Review state ─────────────────────────────────────────────
            ] else ...[
              Text(lang.exchangeProduct,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(
                "Your accumulated funds (${_fmt(widget.accumulated)}) and ${order.paymentFrequency.toLowerCase()} payment frequency will transfer to the new product.",
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),

              // Product comparison card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  Row(children: [
                    Container(width: 48, height: 48,
                        decoration: BoxDecoration(color: order.product.color, borderRadius: BorderRadius.circular(10)),
                        child: Icon(order.product.icon, color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text("Current", style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                      Text(order.product.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      Text(order.product.price, style: const TextStyle(fontSize: 12, color: AppColors.primaryGreen)),
                    ])),
                  ]),
                  const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Row(children: [
                    Expanded(child: Divider()),
                    Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.swap_vert_rounded, color: AppColors.primaryGreen, size: 20)),
                    Expanded(child: Divider()),
                  ])),
                  Row(children: [
                    Container(width: 48, height: 48,
                        decoration: BoxDecoration(color: newProduct.color, borderRadius: BorderRadius.circular(10)),
                        child: Icon(newProduct.icon, color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(lang.newLabel, style: const TextStyle(fontSize: 11, color: AppColors.primaryGreen, fontWeight: FontWeight.w600)),
                      Text(newProduct.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      Text(newProduct.price, style: const TextStyle(fontSize: 12, color: AppColors.primaryGreen)),
                    ])),
                  ]),
                ]),
              ),
              const SizedBox(height: 12),

              // Funds transfer summary
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primaryGreen.withOpacity(0.25)),
                ),
                child: Column(children: [
                  _summaryRow(Icons.savings_outlined, "Accumulated funds transferred", _fmt(widget.accumulated), AppColors.primaryGreen),
                  if (widget.willComplete && widget.overpayPreview > 0) ...[
                    const SizedBox(height: 8),
                    _summaryRow(Icons.account_balance_wallet_outlined, "Excess refunded to wallet", _fmt(widget.overpayPreview), AppColors.primaryGreen),
                  ],
                  if (!widget.willComplete) ...[
                    const SizedBox(height: 8),
                    _summaryRow(Icons.payments_outlined, "Remaining to contribute", _fmt(widget.remaining), const Color(0xFFF57C00)),
                  ],
                  const SizedBox(height: 8),
                  _summaryRow(Icons.repeat_rounded, "Payment frequency kept", order.paymentFrequency, AppColors.textSecondary),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome callout
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(Icons.verified_rounded, AppColors.primaryGreen, const Color(0xFFE8F5E9),
                  "Order will be marked complete immediately. ${_fmt(widget.overpayPreview)} refunded to your wallet.")
              else if (widget.willComplete)
                _infoBanner(Icons.verified_rounded, AppColors.primaryGreen, const Color(0xFFE8F5E9),
                  "Your funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(Icons.info_outline_rounded, const Color(0xFFF57C00), const Color(0xFFFFF3E0),
                  "${_fmt(widget.remaining)} left to pay. Continue your ${order.paymentFrequency.toLowerCase()} contributions — no new plan needed."),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => setState(() => _showPin = true),
                style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
                child: Text(lang.continueToPIN),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoBanner(IconData icon, Color iconColor, Color bgColor, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: iconColor.withOpacity(0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 12, color: iconColor))),
      ]),
    );
  }

  Widget _summaryRow(IconData icon, String label, String value, Color valueColor) {
    return Row(children: [
      Icon(icon, size: 15, color: AppColors.primaryGreen),
      const SizedBox(width: 8),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
      Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: valueColor)),
    ]);
  }
}

// ── Exchange sheet ─────────────────────────────────────────────────────────
class _ExchangeSheet extends StatefulWidget {
  final ConfirmedOrder currentOrder;
  final List<Product> candidates;
  final VoidCallback onExchanged;

  const _ExchangeSheet({required this.currentOrder, required this.candidates, required this.onExchanged});

  @override
  State<_ExchangeSheet> createState() => _ExchangeSheetState();
}

class _ExchangeSheetState extends State<_ExchangeSheet> {
  Product? _selected;
  bool _showPin = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;
  bool _done = false;

  static const _validPin = '1234';

  @override
  void dispose() { _pinCtrl.dispose(); super.dispose(); }

  void _confirm() {
    if (_pinCtrl.text == _validPin) {
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
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),

            if (_done) ...[
              Center(child: Column(children: [
                Container(width: 72, height: 72,
                    decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.12), shape: BoxShape.circle),
                    child: const Icon(Icons.swap_horiz_rounded, size: 36, color: AppColors.primaryGreen)),
                const SizedBox(height: 16),
                Text(lang.exchangeConfirmed, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                const SizedBox(height: 8),
                Text(lang.exchangedFor(_selected!.name), textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
                const SizedBox(height: 24),
                ElevatedButton(onPressed: () => Navigator.pop(context), child: Text(lang.done)),
              ])),
            ] else if (_showPin) ...[
              Text(lang.confirmWithPIN, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(lang.exchangePINDesc(widget.currentOrder.product.name, _selected!.name),
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.divider)),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(lang.current, style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(widget.currentOrder.product.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  ])),
                  const Icon(Icons.arrow_forward_rounded, color: AppColors.primaryGreen, size: 20),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(lang.newLabel, style: TextStyle(fontSize: 11, color: AppColors.primaryGreen, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(_selected!.name, textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
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
                decoration: InputDecoration(labelText: '4-digit PIN', prefixIcon: const Icon(Icons.lock_outline_rounded), counterText: '', errorText: _pinError),
                onChanged: (_) { if (_pinError != null) setState(() => _pinError = null); },
              ),
              const SizedBox(height: 6),
              Text(lang.demoPIN, style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic)),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(child: OutlinedButton(
                  onPressed: () => setState(() => _showPin = false),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50), side: const BorderSide(color: AppColors.divider), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  child: Text(lang.back, style: TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(child: ElevatedButton(onPressed: _confirm, style: ElevatedButton.styleFrom(minimumSize: const Size(0, 50)), child: Text(lang.confirm))),
              ]),
            ] else ...[
              Text(lang.exchangeProduct, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(lang.selectSamePriceProduct, style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
              const SizedBox(height: 16),
              if (widget.candidates.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.divider)),
                  child: Center(child: Text(lang.noOtherProductsSamePrice, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.textMuted))),
                )
              else ...[
                ...widget.candidates.map((p) => GestureDetector(
                  onTap: () => setState(() => _selected = p),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _selected?.name == p.name ? AppColors.primaryGreen.withOpacity(0.06) : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _selected?.name == p.name ? AppColors.primaryGreen : AppColors.divider,
                        width: _selected?.name == p.name ? 1.5 : 1,
                      ),
                    ),
                    child: Row(children: [
                      Container(width: 48, height: 48,
                          decoration: BoxDecoration(color: p.color, borderRadius: BorderRadius.circular(10)),
                          child: Icon(p.icon, color: Colors.white, size: 24)),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        const SizedBox(height: 2),
                        Text(p.price, style: const TextStyle(fontSize: 12, color: AppColors.primaryGreen, fontWeight: FontWeight.w600)),
                        Text(p.category, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      ])),
                      if (_selected?.name == p.name) const Icon(Icons.check_circle_rounded, color: AppColors.primaryGreen, size: 22),
                    ]),
                  ),
                )),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _selected == null ? null : () => setState(() => _showPin = true),
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

// ── Delivery sheet ─────────────────────────────────────────────────────────
class _DeliverySheet extends StatefulWidget {
  final ConfirmedOrder order;
  final VoidCallback? onDeliveryConfirmed;
  const _DeliverySheet({required this.order, this.onDeliveryConfirmed});

  @override
  State<_DeliverySheet> createState() => _DeliverySheetState();
}

class _DeliverySheetState extends State<_DeliverySheet> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _neighbourhoodCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _professionCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  // ID card photos (optional) — stored as mock file paths for demo
  String? _idFrontPhoto;
  String? _idBackPhoto;

  TimeOfDay? _deliveryTime;

  // 'form' | 'pin' | 'receipt'
  String _step = 'form';
  String? _pinError;

  static const _validPin = '1234';

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose();
    _neighbourhoodCtrl.dispose(); _cityCtrl.dispose();
    _pinCtrl.dispose(); _professionCtrl.dispose();
    super.dispose();
  }

  bool get _allFilled =>
      _nameCtrl.text.trim().isNotEmpty &&
      _phoneCtrl.text.trim().isNotEmpty &&
      _neighbourhoodCtrl.text.trim().isNotEmpty &&
      _cityCtrl.text.trim().isNotEmpty &&
      _professionCtrl.text.trim().isNotEmpty &&
      _deliveryTime != null;

  void _submitForm() {
    final lang = LanguageProvider.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_deliveryTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(lang.pleaseSelectDeliveryTime), backgroundColor: AppColors.warning),
      );
      return;
    }
    setState(() => _step = 'pin');
  }

  void _confirmPin() {
    if (_pinCtrl.text == _validPin) {
      // Do NOT remove the order — delivery requested keeps it in history
      widget.onDeliveryConfirmed?.call();
      setState(() => _step = 'receipt');
      // Notify user that delivery details have been received
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: const [
                  Icon(Icons.check_circle_rounded, color: Colors.white, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Delivery request received!',
                          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 14),
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
        }
      });
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
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: _step == 'receipt'
            ? _ReceiptView(
                order: widget.order,
                name: _nameCtrl.text.trim(),
                phone: _phoneCtrl.text.trim(),
                profession: _professionCtrl.text.trim(),
                idFrontPhoto: _idFrontPhoto,
                idBackPhoto: _idBackPhoto,
                neighbourhood: _neighbourhoodCtrl.text.trim(),
                city: _cityCtrl.text.trim(),
                deliveryTime: _deliveryTime,
              )
            : _step == 'pin'
                ? _DeliveryPinStep(
                    pinCtrl: _pinCtrl,
                    pinError: _pinError,
                    name: _nameCtrl.text.trim(),
                    phone: _phoneCtrl.text.trim(),
                    productName: widget.order.product.name,
                    onConfirm: _confirmPin,
                    onBack: () => setState(() { _step = 'form'; _pinError = null; _pinCtrl.clear(); }),
                    onChanged: (_) { if (_pinError != null) setState(() => _pinError = null); },
                  )
                : _DeliveryForm(
                    formKey: _formKey,
                    nameCtrl: _nameCtrl,
                    phoneCtrl: _phoneCtrl,
                    professionCtrl: _professionCtrl,
                    idFrontPhoto: _idFrontPhoto,
                    idBackPhoto: _idBackPhoto,
                    onIdFrontCapture: () => setState(() => _idFrontPhoto = 'front_captured'),
                    onIdBackCapture: () => setState(() => _idBackPhoto = 'back_captured'),
                    neighbourhoodCtrl: _neighbourhoodCtrl,
                    cityCtrl: _cityCtrl,
                    deliveryTime: _deliveryTime,
                    allFilled: _allFilled,
                    onFieldChanged: () => setState(() {}),
                    onDeliveryTimePick: () async {
                      final picked = await showTimePicker(
                        context: context,
                        initialTime: _deliveryTime ?? TimeOfDay.now(),
                        builder: (c, child) => Theme(
                          data: Theme.of(c).copyWith(
                            colorScheme: const ColorScheme.light(
                              primary: AppColors.primaryGreen,
                              onPrimary: Colors.white,
                              surface: Colors.white,
                            ),
                          ),
                          child: child!,
                        ),
                      );
                      if (picked != null) setState(() => _deliveryTime = picked);
                    },
                    onSubmit: _submitForm,
                  ),
      ),
    );
  }
}

// ── Delivery form ──────────────────────────────────────────────────────────
class _DeliveryForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl, phoneCtrl, professionCtrl, neighbourhoodCtrl, cityCtrl;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final VoidCallback onIdFrontCapture;
  final VoidCallback onIdBackCapture;
  final TimeOfDay? deliveryTime;
  final bool allFilled;
  final VoidCallback onFieldChanged, onSubmit;
  final VoidCallback onDeliveryTimePick;

  const _DeliveryForm({
    required this.formKey,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.professionCtrl,
    required this.idFrontPhoto,
    required this.idBackPhoto,
    required this.onIdFrontCapture,
    required this.onIdBackCapture,
    required this.neighbourhoodCtrl,
    required this.cityCtrl,
    required this.deliveryTime,
    required this.allFilled,
    required this.onFieldChanged,
    required this.onDeliveryTimePick,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Row(children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.local_shipping_outlined, color: AppColors.primaryGreen, size: 22),
            ),
            const SizedBox(width: 12),
            Text(lang.deliveryInformation, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          ]),
          const SizedBox(height: 6),
          Padding(
            padding: EdgeInsets.only(left: 54),
            child: Text(lang.confirmIdentityDeliveryDetails, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 22),

          // Full Name
          _fieldLabel('FULL NAME'),
          const SizedBox(height: 6),
          TextFormField(
            controller: nameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(labelText: 'Full name', hintText: 'e.g. Jean-Paul Mbarga', prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
          ),
          const SizedBox(height: 14),

          // Phone Number
          _fieldLabel('PHONE NUMBER'),
          const SizedBox(height: 6),
          TextFormField(
            controller: phoneCtrl,
            keyboardType: TextInputType.phone,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Phone number',
              hintText: 'e.g. +237 6XX XXX XXX',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty ? 'Phone number is required' : null,
          ),
          const SizedBox(height: 14),

          // Profession
          _fieldLabel('PROFESSION'),
          const SizedBox(height: 6),
          TextFormField(
            controller: professionCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Your profession',
              hintText: 'e.g. Engineer, Teacher, Trader…',
              prefixIcon: Icon(Icons.work_outline_rounded),
            ),
            validator: (v) => v == null || v.trim().isEmpty ? 'Profession is required' : null,
          ),
          const SizedBox(height: 18),

          // ID Card Photos (optional)
          Row(children: [
            const Icon(Icons.badge_outlined, size: 16, color: AppColors.primaryGreen),
            const SizedBox(width: 6),
            const Text('ID CARD PHOTOS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('OPTIONAL', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.primaryGreen, letterSpacing: 0.5)),
            ),
          ]),
          const SizedBox(height: 8),
          const Text(
            'Attach a photo of your national ID card (front and back). This helps us verify your identity faster.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: GestureDetector(
                onTap: onIdFrontCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idFrontPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idFrontPhoto != null ? AppColors.primaryGreen : const Color(0xFFD0E8E5),
                      width: idFrontPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idFrontPhoto != null ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                        color: idFrontPhoto != null ? AppColors.primaryGreen : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idFrontPhoto != null ? 'Front captured ✓' : 'Tap to capture\nFRONT side',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idFrontPhoto != null ? AppColors.primaryGreen : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: onIdBackCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idBackPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idBackPhoto != null ? AppColors.primaryGreen : const Color(0xFFD0E8E5),
                      width: idBackPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idBackPhoto != null ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                        color: idBackPhoto != null ? AppColors.primaryGreen : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idBackPhoto != null ? 'Back captured ✓' : 'Tap to capture\nBACK side',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idBackPhoto != null ? AppColors.primaryGreen : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),

          // Neighbourhood
          _fieldLabel('NEIGHBOURHOOD'),
          const SizedBox(height: 6),
          TextFormField(
            controller: neighbourhoodCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(labelText: 'Neighbourhood', hintText: 'e.g. Bastos, Nlongkak…', prefixIcon: Icon(Icons.location_city_outlined)),
            validator: (v) => v == null || v.trim().isEmpty ? 'Neighbourhood is required' : null,
          ),
          const SizedBox(height: 14),

          // City
          _fieldLabel('CITY'),
          const SizedBox(height: 6),
          TextFormField(
            controller: cityCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(labelText: 'City', hintText: 'e.g. Yaoundé, Douala…', prefixIcon: Icon(Icons.location_on_outlined)),
            validator: (v) => v == null || v.trim().isEmpty ? 'City is required' : null,
          ),
          const SizedBox(height: 14),

          // Delivery Time
          _fieldLabel('DELIVERY TIME'),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: onDeliveryTimePick,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: deliveryTime != null ? AppColors.primaryGreen : const Color(0xFFD0E8E5),
                  width: deliveryTime != null ? 2 : 1,
                ),
              ),
              child: Row(children: [
                const Icon(Icons.access_time_rounded, color: AppColors.primaryGreen, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(
                  deliveryTime != null ? 'Delivery at ${deliveryTime!.format(context)}' : 'Select delivery time',
                  style: TextStyle(fontSize: 14, color: deliveryTime != null ? AppColors.textPrimary : AppColors.textMuted),
                )),
                Icon(Icons.keyboard_arrow_down_rounded, color: deliveryTime != null ? AppColors.primaryGreen : AppColors.textMuted),
              ]),
            ),
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            onPressed: allFilled ? onSubmit : null,
            icon: const Icon(Icons.lock_outline_rounded, size: 18),
            label: Text(lang.continueToPIN),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(text,
    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1));
}

// ── Delivery PIN step ──────────────────────────────────────────────────────
class _DeliveryPinStep extends StatelessWidget {
  final TextEditingController pinCtrl;
  final String? pinError;
  final String name, phone, productName;
  final VoidCallback onConfirm, onBack;
  final ValueChanged<String> onChanged;

  const _DeliveryPinStep({
    required this.pinCtrl,
    required this.pinError,
    required this.name,
    required this.phone,
    required this.productName,
    required this.onConfirm,
    required this.onBack,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(child: Container(width: 40, height: 4,
            decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 20),
        Text(lang.confirmDeliveryBtn, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text(lang.confirmDeliveryPINDesc, style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
        const SizedBox(height: 20),

        // Summary tile
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.divider)),
          child: Column(children: [
            _summaryRow(Icons.person_outline_rounded, 'Recipient', name),
            const SizedBox(height: 8),
            _summaryRow(Icons.phone_outlined, 'Phone', phone),
            const SizedBox(height: 8),
            _summaryRow(Icons.inventory_2_outlined, 'Product', productName),
          ]),
        ),
        const SizedBox(height: 20),

        TextField(
          controller: pinCtrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 4,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            labelText: '4-digit PIN',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            counterText: '',
            errorText: pinError,
          ),
          onChanged: onChanged,
        ),
        const SizedBox(height: 6),
        Text(lang.demoPIN, style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic)),
        const SizedBox(height: 20),

        Row(children: [
          Expanded(child: OutlinedButton(
            onPressed: onBack,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 50),
              side: const BorderSide(color: AppColors.divider),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.back, style: TextStyle(color: AppColors.textSecondary)),
          )),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(
            onPressed: onConfirm,
            style: ElevatedButton.styleFrom(minimumSize: const Size(0, 50)),
            child: Text(lang.confirmDeliveryBtn),
          )),
        ]),
      ],
    );
  }

  Widget _summaryRow(IconData icon, String label, String value) {
    return Row(children: [
      Icon(icon, size: 16, color: AppColors.primaryGreen),
      const SizedBox(width: 10),
      Text('$label: ', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      Expanded(child: Text(value, textAlign: TextAlign.end,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary))),
    ]);
  }
}

// ── Receipt view ───────────────────────────────────────────────────────────
class _ReceiptView extends StatelessWidget {
  final ConfirmedOrder order;
  final String name, phone, profession, neighbourhood, city;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final TimeOfDay? deliveryTime;

  const _ReceiptView({required this.order, required this.name, required this.phone, required this.profession, required this.idFrontPhoto, required this.idBackPhoto, required this.neighbourhood, required this.city, required this.deliveryTime});

  String _fmt(int v) {
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  String get _receiptId {
    final rand = Random(order.orderNumber.hashCode);
    return 'RCP-${rand.nextInt(900000) + 100000}';
  }

  String _monthName(int m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];

  String get _today {
    final d = DateTime.now();
    return '${d.day} ${_monthName(d.month)} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final totalPaid = order.totalAmountPaid;
    final grandTotal = order.grandTotal;
    final remaining = grandTotal - totalPaid;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 20),

        // ── Delivery confirmation banner ──────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            color: AppColors.primaryGreen.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.local_shipping_rounded, color: AppColors.primaryGreen, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your details have been received!',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primaryGreen),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Thank you! Your delivery request is confirmed. You will receive your product shortly.',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        Row(children: [
          Container(width: 44, height: 44,
              decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.receipt_long_rounded, color: AppColors.primaryGreen, size: 24)),
          const SizedBox(width: 14),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.deliveryReceipt, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            Text(_receiptId, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ]),
        ]),
        const SizedBox(height: 20),

        Container(
          decoration: BoxDecoration(color: AppColors.offWhite, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.divider)),
          child: Column(children: [
            _section('CUSTOMER DETAILS', [
              _rRow('Full Name', name),
              _rRow('Phone', phone),
              _rRow('Profession', profession),
              _rRow('ID Front', idFrontPhoto != null ? '✓ Photo captured' : 'Not provided'),
              _rRow('ID Back', idBackPhoto != null ? '✓ Photo captured' : 'Not provided'),
              _rRow('Neighbourhood', neighbourhood),
              _rRow('City', city),
              _rRow('Delivery Time', deliveryTime != null ? deliveryTime!.format(context) : '—'),
            ]),
            const Divider(height: 1, color: AppColors.divider),
            _section('ORDER DETAILS', [
              _rRow('Order #', order.orderNumber),
              _rRow('Product', order.product.name),
              _rRow('Category', order.product.category),
              _rRow('Request Date', _today),
            ]),
            const Divider(height: 1, color: AppColors.divider),
            _section('PRICING BREAKDOWN', [
              _rRow('Base Price', _fmt(order.basePrice)),
              if (order.accountCreationFee > 0) _rRow('Account Creation Fee', '+ ${_fmt(order.accountCreationFee)}'),
              _rRow('Delivery Fee', '+ ${_fmt(order.deliveryFee)}'),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text('Collection Fee', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        const SizedBox(width: 8),
                        Transform.scale(
                          scale: 0.7,
                          child: Switch(
                            value: order.isCollectionFeeEnabled,
                            onChanged: (value) {
                            order.toggleCollectionFee(value);
                          },
                            activeColor: AppColors.primaryGreen,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${order.isCollectionFeeEnabled ? '+' : ''} ${_fmt(order.collectionFee)}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: order.isCollectionFeeEnabled ? AppColors.textPrimary : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              _rRow('Stocking Fee', '+ ${_fmt(order.stockingFee)}'),
              const Divider(height: 12, color: AppColors.divider),
              _rRow('Total Fees', _fmt(order.totalFees)),
              _rRow('Payment Plan', order.planDurationLabel),
              _rRow('Frequency', order.paymentFrequency),
              _rRow('Contributions Made', '${order.paidInstallments.length}/${order.totalInstallments}'),
              _rRow('Accumulated Funds', _fmt(order.accumulatedFunds)),
              if (remaining > 0) _rRow('Remaining', _fmt(remaining)),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(lang.totalOrderValue, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.5)),
                Text(_fmt(grandTotal), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primaryGreen)),
              ]),
            ),
          ]),
        ),

        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              content: Row(children: [
                Icon(Icons.download_done_rounded, color: Colors.white, size: 20),
                SizedBox(width: 10),
                Text(lang.receiptDownloaded, style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
              ]),
            ));
          },
          icon: const Icon(Icons.download_rounded, size: 20),
          label: Text(lang.downloadReceipt),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(lang.close, style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
        ),
      ],
    );
  }

  Widget _section(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 1)),
        const SizedBox(height: 10),
        ...rows,
      ]),
    );
  }

  Widget _rRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 130, child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textMuted))),
        Expanded(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary))),
      ]),
    );
  }
}

// ── WatSim Transfer Sheet ────────────────────────────────────────────────────
class _WatSimTransferSheet extends StatefulWidget {
  final ConfirmedOrder sourceOrder;
  final VoidCallback onTransferred;

  const _WatSimTransferSheet({
    required this.sourceOrder,
    required this.onTransferred,
  });

  @override
  State<_WatSimTransferSheet> createState() => _WatSimTransferSheetState();
}

class _WatSimTransferSheetState extends State<_WatSimTransferSheet> {
  // Demo whitelist – phone numbers with a verified WatSim account
  static const _verifiedNumbers = {
    '655000001', '655000002', '677000001',
    '699000001', '620000001', '690000001',
  };
  static const _validPin = '1234';

  // 0 = phone entry  |  1 = PIN confirm  |  2 = success
  int _step = 0;

  final _phoneCtrl = TextEditingController();
  final _pinCtrl   = TextEditingController();
  String? _phoneError;
  String? _pinError;
  bool _unverified = false;

  int get _accumulated => widget.sourceOrder.totalAmountPaid;
  int get _deduction   => (_accumulated * 0.20).round();
  int get _netAmount   => _accumulated - _deduction;

  String _fmt(int v) =>
      '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')} FCFA';

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  void _confirmTransfer() {
    if (_pinCtrl.text != _validPin) {
      setState(() => _pinError = 'Incorrect PIN. Please try again.');
      return;
    }
    // Record outgoing transfer (deduct from wallet)
    WalletState.instance.deduct(
      _accumulated,
      reason: 'Transfer to ${_phoneCtrl.text.trim()}',
      type: TxType.transfer,
      tag: 'SENT',
    );
    // Remove this order
    OrderState.instance.removeOrder(widget.sourceOrder.orderNumber);
    // Fire notification
    NotificationState.instance.onProductTransferApplied(
      fromProduct: widget.sourceOrder.product.name,
      toProduct: _phoneCtrl.text.trim(),
      transferred: _netAmount,
      completed: false,
    );
    setState(() => _step = 2);
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    // ── drag handle ──────────────────────────────────────────────────────────
    final handle = Center(
      child: Container(
        width: 40, height: 4,
        decoration: BoxDecoration(
          color: const Color(0xFFD0D0D0),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );

    // ── funds breakdown card ─────────────────────────────────────────────────
    Widget fundsCard() => Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF607D8B).withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF607D8B).withOpacity(0.20)),
      ),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(lang.accumulatedFundsLabel,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                  fontWeight: FontWeight.w600)),
          Text(_fmt(_accumulated),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                  color: Color(0xFF607D8B))),
        ]),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(lang.serviceFee20,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                  fontWeight: FontWeight.w600)),
          Text('− ${_fmt(_deduction)}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                  color: Color(0xFFE53935))),
        ]),
        const Divider(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(lang.recipientReceives,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                  fontWeight: FontWeight.w600)),
          Text(_fmt(_netAmount),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800,
                  color: AppColors.primaryGreen)),
        ]),
      ]),
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 0 – phone number entry
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildPhoneStep() => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        handle,
        const SizedBox(height: 20),

        Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF607D8B).withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.phone_android_rounded,
                color: Color(0xFF607D8B), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(lang.transferToWatsim,
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              SizedBox(height: 2),
              Text(lang.sendAccumulatedFunds,
                  style: TextStyle(fontSize: 12,
                      color: AppColors.textSecondary)),
            ],
          )),
        ]),
        const SizedBox(height: 18),

        fundsCard(),
        const SizedBox(height: 18),

        if (_accumulated == 0)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFB74D)),
            ),
            child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.info_outline_rounded, color: Color(0xFFF57C00), size: 20),
              SizedBox(width: 10),
              Expanded(child: Text(
                'No payments made yet. Make at least one instalment before transferring.',
                style: TextStyle(fontSize: 13, color: Color(0xFFF57C00), height: 1.4),
              )),
            ]),
          )
        else ...[
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            maxLength: 15,
            decoration: InputDecoration(
              labelText: 'Recipient phone number',
              hintText: 'e.g. 655000001',
              prefixIcon: const Icon(Icons.phone_outlined),
              counterText: '',
              errorText: _phoneError,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: (_) {
              if (_phoneError != null || _unverified) {
                setState(() { _phoneError = null; _unverified = false; });
              }
            },
          ),
          const SizedBox(height: 6),
          const Text(
            'Demo verified numbers: 655000001 · 677000001 · 699000001',
            style: TextStyle(fontSize: 11, color: AppColors.textMuted,
                fontStyle: FontStyle.italic),
          ),

          if (_unverified) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEE),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEF9A9A)),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.warning_amber_rounded,
                    color: Color(0xFFE53935), size: 22),
                SizedBox(width: 10),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lang.noWatsimAccount,
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700,
                            color: Color(0xFFB71C1C))),
                    SizedBox(height: 4),
                    Text(
                      'This number does not have a verified WatSim account. '
                      'Check the number or ask the recipient to register on WatSim.',
                      style: TextStyle(fontSize: 12, color: Color(0xFFE53935),
                          height: 1.4),
                    ),
                  ],
                )),
              ]),
            ),
          ],

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(lang.continueLabel2),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF607D8B),
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                final phone = _phoneCtrl.text
                    .trim()
                    .replaceAll(RegExp(r'[\s\-]'), '');
                if (phone.isEmpty) {
                  setState(() => _phoneError = 'Please enter a phone number.');
                  return;
                }
                if (phone.length < 8) {
                  setState(() => _phoneError = 'Enter a valid phone number.');
                  return;
                }
                if (!_verifiedNumbers.contains(phone)) {
                  setState(() { _phoneError = null; _unverified = true; });
                  return;
                }
                setState(() { _unverified = false; _phoneError = null; _step = 1; });
              },
            ),
          ),
        ],
      ],
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 – PIN confirmation
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildPinStep() => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        handle,
        const SizedBox(height: 20),

        Text(lang.confirmTransfer,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text(
          'Enter your 4-digit PIN to send ${_fmt(_netAmount)} '
          'to ${_phoneCtrl.text.trim()}.',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary,
              height: 1.4),
        ),
        const SizedBox(height: 20),

        // Summary card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.offWhite,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.fromLabel,
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(widget.sourceOrder.product.name,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
            ]),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.toWatsim,
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(_phoneCtrl.text.trim(),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
            ]),
            const Divider(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.grossAmount,
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(_fmt(_accumulated),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary)),
            ]),
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.serviceFee20,
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text('− ${_fmt(_deduction)}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                      color: Color(0xFFE53935))),
            ]),
            const Divider(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.recipientReceives,
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(_fmt(_netAmount),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800,
                      color: AppColors.primaryGreen)),
            ]),
          ]),
        ),
        const SizedBox(height: 20),

        TextField(
          controller: _pinCtrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 4,
          decoration: InputDecoration(
            labelText: '4-digit PIN',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            counterText: '',
            errorText: _pinError,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
          onChanged: (_) {
            if (_pinError != null) setState(() => _pinError = null);
          },
        ),
        const SizedBox(height: 6),
        Text(lang.demoPIN,
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted,
                fontStyle: FontStyle.italic)),
        const SizedBox(height: 20),

        Row(children: [
          Expanded(child: OutlinedButton(
            onPressed: () => setState(() {
              _step = 0;
              _pinCtrl.clear();
              _pinError = null;
            }),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 50),
              side: const BorderSide(color: AppColors.divider),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.back,
                style: const TextStyle(color: AppColors.textSecondary)),
          )),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(
            onPressed: _confirmTransfer,
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(0, 50),
              backgroundColor: const Color(0xFF607D8B),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.confirmTransfer),
          )),
        ]),
      ],
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 – success
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildSuccessStep() => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        handle,
        const SizedBox(height: 24),
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: AppColors.primaryGreen.withOpacity(0.10),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle_rounded,
              size: 44, color: AppColors.primaryGreen),
        ),
        const SizedBox(height: 16),
        Text(lang.transferSuccessful,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        Text(
          '${_fmt(_netAmount)} has been sent to\n'
          '${_phoneCtrl.text.trim()}\'s WatSim wallet.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary,
              height: 1.5),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF3E0),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFFB74D)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.info_outline_rounded,
                color: Color(0xFFF57C00), size: 18),
            const SizedBox(width: 10),
            Flexible(child: Text(
              '20% service fee of ${_fmt(_deduction)} was deducted '
              'from your accumulated funds.',
              style: const TextStyle(fontSize: 12, color: Color(0xFFF57C00),
                  height: 1.4),
            )),
          ]),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              Navigator.pop(context);   // close sheet
              widget.onTransferred();  // pop detail screen
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.done),
          ),
        ),
      ],
    );

    return Container(
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: _step == 0
            ? buildPhoneStep()
            : _step == 1
                ? buildPinStep()
                : buildSuccessStep(),
      ),
    );
  }
}

// ── Withdraw sheet ─────────────────────────────────────────────────────────
class _WithdrawSheet extends StatefulWidget {
  final ConfirmedOrder order;
  final VoidCallback onWithdrawn;

  const _WithdrawSheet({required this.order, required this.onWithdrawn});

  @override
  State<_WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends State<_WithdrawSheet> {
  bool _showPin = false;
  bool _done = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;

  static const _validPin = '1234';
  static const double _chargeRate = 0.30;

  int get _accumulated => widget.order.totalAmountPaid;

  int get _charge => (_accumulated * _chargeRate).round();
  int get _netAmount => _accumulated - _charge;

  String _fmt(int v) {
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  void _confirm() {
    if (_pinCtrl.text != _validPin) {
      setState(() => _pinError = 'Incorrect PIN. Please try again.');
      return;
    }
    WalletState.instance.topUp(_netAmount,
        operator: 'Withdrawal from ${widget.order.product.name}');
    NotificationState.instance.addGenericNotification(
      'Withdrawal Processed',
      '${_fmt(_netAmount)} credited to your wallet after 30% charge (${_fmt(_charge)}) on ${widget.order.product.name}.',
    );
    // Remove the order from the order screen after successful withdrawal
    OrderState.instance.removeOrder(widget.order.orderNumber);
    setState(() => _done = true);
  }

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
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
                          color: const Color(0xFFF57C00).withOpacity(0.1),
                          shape: BoxShape.circle),
                      child: const Icon(
                          Icons.account_balance_wallet_outlined,
                          size: 36,
                          color: const Color(0xFFF57C00))),
                  const SizedBox(height: 16),
                  Text(lang.withdrawalSuccessful,
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(
                    '${_fmt(_netAmount)} has been added to your wallet.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5),
                  ),
                  const SizedBox(height: 8),
                  Text('New balance: ${WalletState.instance.balanceFormatted}',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryGreen)),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: widget.onWithdrawn,
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF57C00)),
                    child: Text(lang.done),
                  ),
                ]),
              ),
            ] else if (_showPin) ...[
              Text(lang.confirmWithdrawal,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              const Text(
                  'Enter your 4-digit PIN to confirm the withdrawal.',
                  style: TextStyle(
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
                child: Column(children: [
                  _summaryRow('Accumulated', _fmt(_accumulated),
                      color: AppColors.textPrimary),
                  const SizedBox(height: 8),
                  _summaryRow('30% Charge', '- ${_fmt(_charge)}',
                      color: const Color(0xFFF57C00)),
                  const Divider(height: 16),
                  _summaryRow('You Receive', _fmt(_netAmount),
                      color: AppColors.primaryGreen, bold: true),
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
              Text(lang.demoPIN,
                  style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontStyle: FontStyle.italic)),
              const SizedBox(height: 20),

              Row(children: [
                Expanded(
                    child: OutlinedButton(
                  onPressed: () => setState(() {
                    _showPin = false;
                    _pinCtrl.clear();
                    _pinError = null;
                  }),
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
                      minimumSize: const Size(0, 50),
                      backgroundColor: const Color(0xFFF57C00)),
                  child: Text(lang.confirmWithdrawal),
                )),
              ]),
            ] else ...[
              Text(lang.withdrawFunds,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              const Text(
                  'Withdraw the money accumulated on this product. A 30% processing charge applies.',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 20),

              // Warning banner
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                    color: const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: const Color(0xFFFFB74D))),
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: Color(0xFFF57C00), size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                      child: Text(
                    '30% of accumulated funds will be deducted as a processing charge.',
                    style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFFF57C00),
                        height: 1.4),
                  )),
                ]),
              ),
              const SizedBox(height: 20),

              // Breakdown card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  _summaryRow(
                      'Instalments Paid',
                      '${widget.order.paidInstallments.length}/${widget.order.totalInstallments}',
                      color: AppColors.textSecondary),
                  const SizedBox(height: 10),
                  _summaryRow('Accumulated Amount', _fmt(_accumulated),
                      color: AppColors.textPrimary),
                  const SizedBox(height: 10),
                  _summaryRow('30% Processing Charge', '− ${_fmt(_charge)}',
                      color: const Color(0xFFF57C00)),
                  const Divider(height: 20),
                  _summaryRow('Amount You Receive', _fmt(_netAmount),
                      color: AppColors.primaryGreen, bold: true, large: true),
                ]),
              ),
              const SizedBox(height: 24),

              ElevatedButton.icon(
                onPressed: _accumulated > 0 ? () => setState(() => _showPin = true) : null,
                icon: const Icon(Icons.lock_outline_rounded, size: 18),
                label: Text(lang.continueToPIN),
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF57C00)),
              ),
              if (_accumulated == 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFB74D))),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Icon(Icons.info_outline_rounded, color: Color(0xFFF57C00), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'No payments have been made yet. Make at least one instalment to enable withdrawal.',
                          style: TextStyle(fontSize: 13, color: Color(0xFFF57C00), height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value,
      {Color? color, bool bold = false, bool large = false}) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label,
          style: const TextStyle(
              fontSize: 13, color: AppColors.textSecondary)),
      Text(value,
          style: TextStyle(
              fontSize: large ? 16 : 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: color ?? AppColors.textPrimary)),
    ]);
  }
}

// ── Fully paid banner ──────────────────────────────────────────────────────
class _FullyPaidBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.primaryGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
      ),
      child: Row(children: [
        Icon(Icons.check_circle_rounded, color: AppColors.primaryGreen, size: 28),
        SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.allInstalmentsPaid, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primaryGreen)),
          SizedBox(height: 2),
          Text(lang.orderFullySettled, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
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
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.deliveryRequestedTitle, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1565C0))),
          SizedBox(height: 2),
          Text(lang.deliveryOnTheWay, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
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
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.productDeliveredCelebration, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primaryGreen)),
          SizedBox(height: 2),
          Text('Your product was successfully delivered. Thank you for using WatSim!', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
    );
  }
}

// ── This month already paid banner ────────────────────────────────────────
class _ThisMonthPaidBanner extends StatelessWidget {
  final ConfirmedOrder order;
  final String Function(int) monthName;

  const _ThisMonthPaidBanner({required this.order, required this.monthName});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    // Compute contribution end date
    final DateTime endDate;
    if (order.paymentFrequency == 'Daily') {
      endDate = order.confirmedAt.add(Duration(days: order.months * 30));
    } else if (order.paymentFrequency == 'Weekly') {
      endDate = order.confirmedAt.add(Duration(days: order.months * 4 * 7));
    } else {
      endDate = DateTime(order.confirmedAt.year, order.confirmedAt.month + order.months, order.confirmedAt.day);
    }
    final endDateInfo = 'Contribution ends ${endDate.day} ${monthName(endDate.month)} ${endDate.year}';

    final periodLabel = order.paymentFrequency == 'Daily'
        ? "Today's payment done"
        : order.paymentFrequency == 'Weekly'
            ? "This week's payment done"
            : "This month's payment done";
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.primaryGreen.withOpacity(0.35))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.check_circle_outline_rounded, color: AppColors.primaryGreen, size: 22),
          const SizedBox(width: 10),
          Text(periodLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primaryGreen)),
        ]),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.primaryGreen.withOpacity(0.18))),
          child: Row(children: [
            const Icon(Icons.calendar_month_rounded, size: 16, color: AppColors.primaryGreen),
            const SizedBox(width: 8),
            Expanded(child: Text(endDateInfo, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textSecondary))),
          ]),
        ),
        const SizedBox(height: 10),
        Text('${order.remainingPayments} instalment${order.remainingPayments == 1 ? '' : 's'} remaining', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
      ]),
    );
  }
}

// ── Pay now section ────────────────────────────────────────────────────────
class _PayNowSection extends StatelessWidget {
  final ConfirmedOrder order;
  final VoidCallback onPay;

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
          color: hasAnyFunds ? AppColors.primaryGreen.withOpacity(0.08) : AppColors.warning.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: hasAnyFunds ? AppColors.primaryGreen.withOpacity(0.25) : AppColors.warning.withOpacity(0.35)),
        ),
        child: Row(children: [
          Icon(Icons.account_balance_wallet_outlined, size: 18, color: hasAnyFunds ? AppColors.primaryGreen : AppColors.warning),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Wallet: ${wallet.balanceFormatted}',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hasAnyFunds ? AppColors.primaryGreen : AppColors.warning)),
            Text('Accumulated: ${_fmtAccumulated(order.accumulatedFunds)}',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ])),
        ]),
      ),
      const SizedBox(height: 14),
      ElevatedButton.icon(onPressed: onPay, icon: const Icon(Icons.payments_outlined, size: 18), label: Text(lang.makeAContribution)),
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
  Widget _buildCard(int i, {
    required int perSlot,
    required int total,
    required int doneSlots,
    required int activeSlot,
    required int spillover,
  }) {
    final isComplete = i < doneSlots;
    final isActive   = i == activeSlot;
    final isFuture   = !isComplete && !isActive;

    final double fillRatio = isComplete
        ? 1.0
        : isActive && perSlot > 0
            ? (spillover / perSlot).clamp(0.0, 1.0)
            : 0.0;

    final int paidInSlot = isComplete ? perSlot : isActive ? spillover : 0;
    final int remaining  = perSlot - paidInSlot;
    final int pct        = (fillRatio * 100).round();

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
    final perSlot     = widget.order.perInstallment;
    final total       = widget.order.totalInstallments;
    final accumulated = widget.order.accumulatedFunds;

    final fullSlots  = perSlot > 0 ? (accumulated ~/ perSlot) : 0;
    final spillover  = perSlot > 0 ? (accumulated % perSlot)  : 0;
    final doneSlots  = fullSlots.clamp(0, total);
    final activeSlot = doneSlots < total ? doneSlots : -1;

    // ── Short plan: show all cards directly (≤ 12) ──────────────────────────
    if (total <= 12) {
      return Column(
        children: List.generate(total, (i) => _buildCard(i,
          perSlot: perSlot, total: total, doneSlots: doneSlots,
          activeSlot: activeSlot, spillover: spillover,
        )),
      );
    }

    // ── Long plan: group into buckets of 6, shown as accordion ──────────────
    const groupSize = 6;
    final groupCount = (total / groupSize).ceil();

    // Summary bar at the top
    final paidCount    = doneSlots;
    final remainCount  = total - paidCount;
    final overallPct   = total > 0 ? (paidCount / total * 100).round() : 0;

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
              BoxShadow(color: AppColors.primaryGreen.withOpacity(0.06),
                  blurRadius: 8, offset: const Offset(0, 2)),
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
                        fontSize: 13, fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('$overallPct%',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(children: [
                  Container(height: 10,
                      color: AppColors.primaryGreen.withOpacity(0.08)),
                  FractionallySizedBox(
                    widthFactor: total > 0 ? (paidCount / total).clamp(0.0, 1.0) : 0,
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
                  Text('${_fmt(accumulated)} accumulated',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: AppColors.primaryGreen)),
                  if (remainCount > 0)
                    Text('$remainCount remaining',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],
          ),
        ),

        // ── Accordion groups ─────────────────────────────────────────────────
        ...List.generate(groupCount, (g) {
          final startIdx  = g * groupSize;           // inclusive, 0-based
          final endIdx    = (startIdx + groupSize - 1).clamp(0, total - 1); // inclusive
          final startNum  = startIdx + 1;            // 1-based display
          final endNum    = endIdx + 1;

          // Group status
          final allDone   = endIdx < doneSlots;
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
                color: isExpanded ? AppColors.primaryGreen.withOpacity(0.5) : borderColor,
                width: isExpanded ? 1.5 : 1,
              ),
              boxShadow: isExpanded
                  ? [BoxShadow(color: AppColors.primaryGreen.withOpacity(0.07),
                        blurRadius: 10, offset: const Offset(0, 2))]
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
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: isExpanded ? AppColors.primaryGreen.withOpacity(0.04) : headerBg,
                      borderRadius: isExpanded
                          ? const BorderRadius.vertical(top: Radius.circular(16))
                          : BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        // Status dot
                        Container(
                          width: 10, height: 10,
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
                                    fontSize: 14, fontWeight: FontWeight.w700,
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                                fontSize: 11, fontWeight: FontWeight.w700,
                                color: allDone ? AppColors.primaryGreen : AppColors.textMuted),
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
                        return _buildCard(startIdx + j,
                          perSlot: perSlot, total: total, doneSlots: doneSlots,
                          activeSlot: activeSlot, spillover: spillover,
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

    final Color circleTextColor = isComplete
        ? Colors.white
        : AppColors.primaryGreen;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cardBorder, width: isActive ? 1.5 : 1),
        boxShadow: isActive
            ? [BoxShadow(color: AppColors.primaryGreen.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))]
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
                decoration: BoxDecoration(color: circleColor, shape: BoxShape.circle),
                child: Center(
                  child: isComplete
                      ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
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
                        color: isFuture ? AppColors.textMuted : AppColors.textPrimary,
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
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isComplete
                      ? AppColors.primaryGreen.withOpacity(0.12)
                      : isActive
                          ? const Color(0xFFFFF3E0)
                          : AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isComplete ? 'Complete' : isActive ? 'In Progress' : 'Upcoming',
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

class _InstallRow extends StatelessWidget {
  final int index, total;
  final String date, amount;
  final bool isPaid, isCurrent;

  const _InstallRow({required this.index, required this.total, required this.date, required this.amount, required this.isPaid, required this.isCurrent});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final circleColor = isPaid || isCurrent ? AppColors.primaryGreen : AppColors.primaryGreen.withOpacity(0.1);
    final circleTextColor = isPaid || isCurrent ? Colors.white : AppColors.primaryGreen;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Container(width: 36, height: 36,
            decoration: BoxDecoration(color: circleColor, shape: BoxShape.circle),
            child: Center(child: isPaid
                ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                : Text(index.toString().padLeft(2, '0'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: circleTextColor)))),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.instalmentCount(index, total), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
              color: isPaid ? AppColors.textMuted : AppColors.textPrimary, decoration: isPaid ? TextDecoration.lineThrough : null)),
          Text(date, style: TextStyle(fontSize: 12, color: date == 'Immediate' ? AppColors.primaryGreen : AppColors.textMuted,
              fontWeight: date == 'Immediate' ? FontWeight.w600 : FontWeight.normal)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: isPaid ? AppColors.primaryGreen.withOpacity(0.1) : isCurrent ? AppColors.primaryGreen.withOpacity(0.1) : AppColors.primaryGreen.withOpacity(0.05),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            isPaid ? 'PAID' : isCurrent ? 'DUE NOW' : 'UPCOMING',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: isPaid || isCurrent ? AppColors.primaryGreen : AppColors.textMuted),
          ),
        ),
      ]),
    );
  }
}

// ── Payment success sheet ──────────────────────────────────────────────────
class _PaymentSuccessSheet extends StatelessWidget {
  final ConfirmedOrder order;
  final bool isNowComplete;
  final int overpayRefunded;
  const _PaymentSuccessSheet({
    required this.order,
    this.isNowComplete = false,
    this.overpayRefunded = 0,
  });

  String _fmtAmount(int v) {
    final t = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$t,${r} FCFA';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2))),
        Container(width: 72, height: 72,
            decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.12), shape: BoxShape.circle),
            child: Icon(
              isNowComplete ? Icons.verified_rounded : Icons.check_circle_rounded,
              size: 40,
              color: AppColors.primaryGreen,
            )),
        const SizedBox(height: 16),
        Text(
          isNowComplete ? 'Order Complete! 🎉' : 'Payment Successful!',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        if (isNowComplete) ...[
          Text(
            '${order.product.name} has been fully paid off.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
          ),
          if (overpayRefunded > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.account_balance_wallet_outlined, size: 18, color: AppColors.primaryGreen),
                  const SizedBox(width: 8),
                  Text(
                    '${_fmtAmount(overpayRefunded)} refunded to wallet',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primaryGreen),
                  ),
                ],
              ),
            ),
          ],
        ] else ...[
          Text(lang.contributionAddedFunds, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
          const SizedBox(height: 8),
          Text('Accumulated: ${_fmtAmount(order.accumulatedFunds)}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primaryGreen)),
        ],
        const SizedBox(height: 4),
        Text('Wallet balance: ${WalletState.instance.balanceFormatted}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        const SizedBox(height: 24),
        ElevatedButton(onPressed: () => Navigator.pop(context), child: Text(lang.done)),
      ]),
    );
  }
}

// ── Contribution amount sheet ──────────────────────────────────────────────
class _ContributionSheet extends StatefulWidget {
  final int totalAmount;
  final int productPrice;
  final void Function(int amount) onAmountConfirmed;
  const _ContributionSheet({
    required this.totalAmount,
    required this.productPrice,
    required this.onAmountConfirmed,
  });

  @override
  State<_ContributionSheet> createState() => _ContributionSheetState();
}

class _ContributionSheetState extends State<_ContributionSheet> {
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
    if (amount <= 0) {
      setState(() => _error = 'Please enter a valid amount.');
      return;
    }
    final walletBalance = WalletState.instance.balance;
    if (amount > walletBalance) {
      setState(() => _error = 'Exceeds wallet balance: ${_fmt(walletBalance)}');
      return;
    }
    widget.onAmountConfirmed(amount);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final walletBalance = WalletState.instance.balance;
    final bool willComplete = _typedAmount > 0 && _typedAmount >= widget.productPrice;
    final int overpayPreview = willComplete ? (_typedAmount - widget.productPrice) : 0;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
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
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
            ),
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(color: AppColors.primaryGreen.withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
              child: const Icon(Icons.payments_outlined, size: 28, color: AppColors.primaryGreen),
            ),
            const SizedBox(height: 14),
            Text(lang.enterYourContribution,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            const Text(
              "Pay any amount you're comfortable with. It accumulates towards your total.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.07),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primaryGreen.withOpacity(0.2)),
              ),
              child: Row(children: const [
                Icon(Icons.savings_outlined, size: 16, color: AppColors.primaryGreen),
                SizedBox(width: 8),
                Expanded(child: Text(
                  'Every payment accumulates. Transfer your balance to a new product anytime.',
                  style: TextStyle(fontSize: 12, color: AppColors.primaryGreen),
                )),
              ]),
            ),
            const SizedBox(height: 14),
            if (_typedAmount > 0)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
                ),
                child: Column(children: [
                  Text(lang.youAreContributing, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  const SizedBox(height: 2),
                  Text(_fmt(_typedAmount),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primaryGreen)),
                ]),
              ),
            if (willComplete)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primaryGreen.withOpacity(0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.verified_rounded, size: 16, color: AppColors.primaryGreen),
                      SizedBox(width: 6),
                      Text(lang.thisWillCompleteOrder,
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primaryGreen)),
                    ]),
                    if (overpayPreview > 0) ...[
                      const SizedBox(height: 4),
                      Row(children: [
                        const Icon(Icons.account_balance_wallet_outlined, size: 14, color: AppColors.primaryGreen),
                        const SizedBox(width: 6),
                        Text(
                          '${_fmt(overpayPreview)} extra will be refunded to your wallet.',
                          style: const TextStyle(fontSize: 12, color: AppColors.primaryGreen),
                        ),
                      ]),
                    ],
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
                helperText: 'Wallet balance: ${_fmt(walletBalance)}',
                prefixIcon: const Icon(Icons.attach_money_rounded, color: AppColors.primaryGreen),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primaryGreen, width: 2),
                ),
              ),
              onChanged: (val) {
                final raw = val.replaceAll(RegExp(r'[^0-9]'), '');
                setState(() { _error = null; _typedAmount = int.tryParse(raw) ?? 0; });
              },
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _confirm,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(lang.confirmContribution, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
// ── Insufficient funds sheet ───────────────────────────────────────────────
class _InsufficientFundsSheet extends StatelessWidget {
  final int required, available;

  const _InsufficientFundsSheet({required this.required, required this.available});

  String _fmt(int v) { final t = v ~/ 1000; final r = (v % 1000).toString().padLeft(3, '0'); return '$t,$r FCFA'; }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final shortfall = required - available;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(color: Colors.grey.withOpacity(0.3), borderRadius: BorderRadius.circular(2))),
        Container(width: 64, height: 64,
            decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(20)),
            child: const Icon(Icons.account_balance_wallet_outlined, size: 32, color: Color(0xFFF57C00))),
        const SizedBox(height: 16),
        Text(lang.insufficientBalance, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        Text('Your wallet balance is ${_fmt(available)}, but this instalment requires ${_fmt(required)}.', textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: const Color(0xFFFFF8F0), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFFCC80))),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(lang.amountNeededTopUp, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            Text(_fmt(shortfall), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFFF57C00))),
          ]),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () { Navigator.pop(context); Navigator.push(context, MaterialPageRoute(builder: (_) => const DepositScreen())); },
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(lang.topUpWallet),
          style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 52), backgroundColor: AppColors.primaryGreen, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        ),
        const SizedBox(height: 10),
        TextButton(onPressed: () => Navigator.pop(context), child: Text(lang.maybeLater, style: TextStyle(color: AppColors.textMuted, fontSize: 14))),
      ]),
    );
  }
}
