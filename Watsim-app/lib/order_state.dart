// ─── Global Order State ─────────────────────────────────────────────────────
// In-memory singleton that stores confirmed BNPL orders.
import 'package:flutter/material.dart';
import 'screens/catalogue_screen.dart';
import 'services/api_service.dart';

class ConfirmedOrder {
  /// Backend BNPL purchase id (null for demo/offline orders).
  final String? id;

  Product product;
  final int months;
  final int monthly;
  final int fee;
  int basePrice;
  final DateTime confirmedAt;
  final String orderNumber;

  /// Payment frequency chosen by the user: 'Daily', 'Weekly', or 'Monthly'.
  final String paymentFrequency;

  /// When true this order is a demo/seed entry and should NOT count
  /// toward the BNPL credit usage shown on the home/profile screens.
  final bool isDemo;

  /// True once the user has submitted a delivery request (after full contribution).
  bool deliveryRequested;

  /// True once the product has been physically delivered and confirmed.
  bool deliveryCompleted;

  /// Tracks which installment indices (0-based) have been paid.
  /// Index 0 is always paid at order confirmation (first instalment = immediate).
  final Set<int> paidInstallments;

  /// Raw instalment data from backend (id, status, amount, dueDate)
  final List<Map<String, dynamic>> instalments;

  /// Running total of actual money the user has contributed to this order.
  /// Every call to [addContribution] adds to this value.
  /// This is the canonical "accumulated funds" used for transfers and display.
  int _accumulatedFunds;

  int get accumulatedFunds => _accumulatedFunds;

  /// Individual contribution amounts in order of payment.
  final List<int> contributionAmounts;

  // ── Fee breakdown (matches BNPL simulator) ────────────────────────────────
  final int downPayment;
  final int stockingFee;
  final int accountCreationFee;
  final int deliveryFee;
  int collectionFee; // Can be toggled on/off by user
  int totalFees;

  int get grandTotal => basePrice + totalFees;

  ConfirmedOrder({
    this.id,
    required this.product,
    required this.months,
    required this.monthly,
    required this.fee,
    required this.basePrice,
    required this.confirmedAt,
    required this.orderNumber,
    this.paymentFrequency = 'Monthly',
    Set<int>? paidInstallments,
    List<Map<String, dynamic>>? instalments,
    this.isDemo = false,
    this.deliveryRequested = false,
    this.deliveryCompleted = false,
    int initialAccumulatedFunds = 0,
    List<int>? contributionAmounts,
    this.downPayment = 0,
    this.stockingFee = 0,
    this.accountCreationFee = 0,
    this.deliveryFee = 0,
    this.collectionFee = 0,
    this.totalFees = 0,
  })  : paidInstallments = paidInstallments ?? {},
        this.instalments = instalments ?? [],
        _accumulatedFunds = initialAccumulatedFunds,
        contributionAmounts = contributionAmounts ?? [];

  /// Exchange this order's product for [newProduct] at [newPrice].
  ///
  /// Accumulated funds are transferred to the new product as-is.
  /// Installment slots are reset so progress is recalculated against the new price.
  /// Payment frequency is preserved — no new BNPL simulation needed.
  ///
  /// Returns a record describing the outcome:
  ///   - overpay : excess funds above newPrice (caller should refund to wallet)
  ///   - completed: whether the new product is immediately fully paid
  ({int overpay, bool completed}) exchangeProduct(
      Product newProduct, int newPrice) {
    product = newProduct;
    basePrice = newPrice;

    // Reset installment slots — they will be re-credited from accumulated funds
    paidInstallments.clear();

    final int carried = _accumulatedFunds;
    int overpay = 0;
    bool completed = false;

    if (carried >= newPrice) {
      // New product is already fully covered
      overpay = carried - newPrice;
      completed = true;
      // Cap accumulated funds at newPrice (excess is refunded separately)
      _accumulatedFunds = newPrice;
      // Mark all installment slots as paid
      for (int i = 0; i < totalInstallments; i++) {
        paidInstallments.add(i);
      }
    } else {
      // Partially covered — mark as many slots as the carried funds allow
      int remaining = carried;
      for (int i = 0; i < totalInstallments; i++) {
        if (remaining >= perInstallment) {
          paidInstallments.add(i);
          remaining -= perInstallment;
        } else {
          break;
        }
      }
    }

    OrderState.instance._notify();
    return (overpay: overpay, completed: completed);
  }

  void markFullyPaid() {
    for (int i = 0; i < totalInstallments; i++) {
      paidInstallments.add(i);
    }
    OrderState.instance._notify();
  }

  /// Mark this order as having a delivery requested.
  void markDeliveryRequested() {
    deliveryRequested = true;
    OrderState.instance._notify();
  }

  /// Toggle collection fee on/off and recalculate totals
  void toggleCollectionFee(bool enabled) {
    final originalValue = collectionFee;
    collectionFee = enabled ? 1000 : 0;
    totalFees = downPayment +
        stockingFee +
        accountCreationFee +
        deliveryFee +
        collectionFee;
    if (originalValue != collectionFee) {
      OrderState.instance._notify();
    }
  }

  /// Check if collection fee is currently enabled
  bool get isCollectionFeeEnabled => collectionFee > 0;

  /// Mark this order as delivered. The order stays in history but
  /// is no longer shown in the active order detail view.
  void markDeliveryCompleted() {
    deliveryRequested = true;
    deliveryCompleted = true;
    OrderState.instance._notify();
  }

  /// Add [amount] to accumulated funds and mark a payment slot.
  void addContribution(int amount) {
    _accumulatedFunds += amount;
    contributionAmounts.add(amount);
    // Mark the next unpaid installment slot so progress tracking still works
    for (int i = 0; i < totalInstallments; i++) {
      if (!paidInstallments.contains(i)) {
        paidInstallments.add(i);
        break;
      }
    }
    OrderState.instance._notify();
  }

  /// The actual amount paid per single instalment, accounting for frequency.
  /// `monthly` stores the month-based rate; for Daily/Weekly plans the real
  /// per-payment amount is smaller.
  int get perInstallment {
    if (paymentFrequency == 'Daily') return monthly ~/ 30;
    if (paymentFrequency == 'Weekly') return monthly ~/ 4;
    return monthly;
  }

  /// Total amount the user has actually paid so far.
  /// Uses [accumulatedFunds] which tracks real contributions.
  int get totalAmountPaid => _accumulatedFunds;

  // ── Frequency-aware helpers ──────────────────────────────────────────────

  /// Total number of payments based on frequency.
  /// Daily → months × 30, Weekly → months × 4, Monthly → months.
  int get totalInstallments {
    if (paymentFrequency == 'Daily') return months * 30;
    if (paymentFrequency == 'Weekly') return months * 4;
    return months;
  }

  /// Human-readable label for one payment period.
  String get frequencyPeriodLabel {
    if (paymentFrequency == 'Daily') return 'day';
    if (paymentFrequency == 'Weekly') return 'week';
    return 'month';
  }

  /// Suffix used in amount labels, e.g. "/day", "/week", "/month".
  String get frequencySuffix {
    if (paymentFrequency == 'Daily') return '/day';
    if (paymentFrequency == 'Weekly') return '/week';
    return '/month';
  }

  /// Human-readable plan duration label.
  /// Daily in 3 months → "90 days", Weekly → "12 weeks", Monthly → "3 months".
  String get planDurationLabel {
    if (paymentFrequency == 'Daily') return '${months * 30} days';
    if (paymentFrequency == 'Weekly') return '${months * 4} weeks';
    return '$months month${months > 1 ? 's' : ''}';
  }

  // ── Index tracking (always on totalInstallments scale) ──────────────────

  /// 0-based index of the current installment based on elapsed time.
  int get currentInstallmentIndex {
    final elapsedDays = DateTime.now().difference(confirmedAt).inDays;
    int elapsed;
    if (paymentFrequency == 'Daily') {
      elapsed = elapsedDays;
    } else if (paymentFrequency == 'Weekly') {
      elapsed = elapsedDays ~/ 7;
    } else {
      elapsed = elapsedDays ~/ 30;
    }
    return elapsed.clamp(0, totalInstallments - 1);
  }

  /// Whether the current installment has already been paid.
  bool get isCurrentInstallmentPaid =>
      paidInstallments.contains(currentInstallmentIndex);

  /// Whether all installments are paid.
  bool get isFullyPaid => paidInstallments.length >= totalInstallments;

  /// Number of installments remaining (unpaid).
  int get remainingPayments => totalInstallments - paidInstallments.length;

  /// Mark the current installment as paid.
  void payCurrentInstallment() {
    paidInstallments.add(currentInstallmentIndex);
    OrderState.instance._notify();
  }

  /// e.g. "Instalment 2/90" for daily, "2/12" weekly, "2/3" monthly.
  String get installmentLabel {
    final current = currentInstallmentIndex + 1;
    return 'Instalment $current/$totalInstallments';
  }

  /// Due date for a given installment index.
  DateTime installmentDueDate(int index) {
    if (paymentFrequency == 'Daily') {
      return confirmedAt.add(Duration(days: index + 1));
    } else if (paymentFrequency == 'Weekly') {
      return confirmedAt.add(Duration(days: (index + 1) * 7));
    }
    // Monthly: 15th of each subsequent month
    return DateTime(confirmedAt.year, confirmedAt.month + index, 15);
  }

  /// Due date for the current installment.
  DateTime get currentInstallmentDue =>
      installmentDueDate(currentInstallmentIndex);

  /// Next unpaid installment due date.
  DateTime get nextDue {
    for (int i = 0; i < totalInstallments; i++) {
      if (!paidInstallments.contains(i)) {
        return installmentDueDate(i);
      }
    }
    return installmentDueDate(totalInstallments - 1);
  }

  String get monthlyFormatted {
    final k = monthly ~/ 1000;
    final r = (monthly % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  /// Same value as [monthlyFormatted] but with the frequency suffix appended.
  String get paymentAmountLabel => '${monthlyFormatted}${frequencySuffix}';

  /// Human-readable label for the next payment due date.
  /// e.g. "Next payment: 15 Jun" or "Next payment: Today"
  String get nextPaymentLabel {
    if (isFullyPaid) return 'All paid ✓';
    final due = nextDue;
    final today = DateTime.now();
    final isToday = due.year == today.year &&
        due.month == today.month &&
        due.day == today.day;
    if (isToday) return 'Next payment: Today';
    const monthNames = [
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
    ];
    return 'Next payment: ${due.day} ${monthNames[due.month - 1]}';
  }

  /// Human-readable label for the contribution end date.
  /// e.g. "Ends 15 Jun 2026" or "Completed ✓"
  String get contributionEndLabel {
    if (isFullyPaid) return 'Completed ✓';
    const monthNames = [
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
    ];
    final end = installmentDueDate(totalInstallments - 1);
    return 'Ends ${end.day} ${monthNames[end.month - 1]} ${end.year}';
  }
}

class OrderState {
  OrderState._();
  static final OrderState instance = OrderState._();

  final List<ConfirmedOrder> _orders = [];
  bool _isLoading = false;
  String? _error;

  List<ConfirmedOrder> get orders => List.unmodifiable(_orders);
  bool get isLoading => _isLoading;
  String? get error => _error;

  void addOrder(ConfirmedOrder order) {
    // Remove any existing order with the same backend id to avoid duplicates.
    if (order.id != null && order.id!.isNotEmpty) {
      _orders.removeWhere((o) => o.id == order.id);
    }
    _orders.insert(0, order); // newest first
    _notify();
  }

  /// Load orders from backend and sync with local state
  Future<void> syncWithBackend() async {
    _isLoading = true;
    _error = null;
    _notify();

    try {
      final purchases = await ApiService.fetchOrders();
      _orders.clear();

      for (final p in purchases) {
        final order = _convertPurchaseToOrder(p);
        if (order != null) {
          _orders.add(order);
        }
      }

      _isLoading = false;
      _notify();
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      _notify();
    }
  }

  /// Convert backend purchase JSON to ConfirmedOrder
  ConfirmedOrder? _convertPurchaseToOrder(Map<String, dynamic> p) {
    try {
      final product = p['product'] as Map<String, dynamic>?;
      if (product == null) return null;

      final price = (product['price'] as num?)?.toInt() ?? 0;
      final totalAmount = (p['totalAmount'] as num?)?.toInt() ?? price;
      final instalmentCount = (p['instalmentCount'] as num?)?.toInt() ?? 3;
      final instalmentAmount = (p['instalmentAmount'] as num?)?.toInt() ??
          (totalAmount ~/ instalmentCount);
      final downPayment = (p['downPayment'] as num?)?.toInt() ?? 0;

      // Build paid installments from backend instalments data if available
      final Set<int> paidInstalments = {};
      final instalments = p['instalments'] as List<dynamic>?;
      if (instalments != null) {
        for (int i = 0; i < instalments.length; i++) {
          final inst = instalments[i] as Map<String, dynamic>;
          final status = inst['status'] as String?;
          if (status == 'PAID') {
            paidInstalments.add(i);
          }
        }
      }

      // Calculate accumulated funds from paid installments
      final accumulatedFunds =
          paidInstalments.length * instalmentAmount + downPayment;

      // Build raw instalment list for repayment screen
      final rawInstalments = <Map<String, dynamic>>[];
      if (instalments != null) {
        for (final inst in instalments) {
          final instMap = inst as Map<String, dynamic>;
          rawInstalments.add({
            'id': instMap['id'] as String? ?? '',
            'amount': (instMap['amount'] as num?)?.toInt() ?? instalmentAmount,
            'status': instMap['status'] as String? ?? 'UPCOMING',
            'dueDate': instMap['dueDate'] as String? ?? '',
          });
        }
      }

      // Frequency may be stored lower-case in the backend.
      final rawFrequency =
          (p['frequency'] as String? ?? 'monthly').toLowerCase();
      final paymentFrequency = rawFrequency == 'daily'
          ? 'Daily'
          : rawFrequency == 'weekly'
              ? 'Weekly'
              : 'Monthly';

      return ConfirmedOrder(
        id: p['id'] as String?,
        product: Product(
          id: product['id'] as String?,
          merchantId:
              (p['merchant'] as Map<String, dynamic>?)?['id'] as String? ??
                  p['merchantId'] as String?,
          name: product['name'] as String? ?? 'Unknown Product',
          price: '${_formatPrice(price)} FCFA',
          monthlyPrice: '${_formatPrice(instalmentAmount)} FCFA/month',
          icon: Icons.shopping_bag_rounded,
          category: (product['category'] as Map<String, dynamic>?)?['name']
                  as String? ??
              'General',
          cashback: 0,
          color: const Color(0xFF014945),
          imageUrl: product['imageUrl'] as String? ?? '',
          imageGradient: const [Color(0xFF014945), Color(0xFF014A41)],
        ),
        months: instalmentCount,
        monthly: instalmentAmount,
        fee: totalAmount - price,
        basePrice: price,
        confirmedAt: p['createdAt'] != null
            ? DateTime.tryParse(p['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
        orderNumber: p['id'] as String? ??
            'ORD-${DateTime.now().millisecondsSinceEpoch}',
        paymentFrequency: paymentFrequency,
        paidInstallments: paidInstalments,
        instalments: rawInstalments,
        isDemo: false,
        deliveryRequested:
            p['status'] == 'DELIVERED' || p['status'] == 'SHIPPED',
        deliveryCompleted: p['status'] == 'DELIVERED',
        initialAccumulatedFunds: accumulatedFunds,
        downPayment: downPayment,
        stockingFee: (p['stockingFee'] as num?)?.toInt() ?? 0,
        accountCreationFee: (p['accountCreationFee'] as num?)?.toInt() ?? 0,
        deliveryFee: (p['deliveryFee'] as num?)?.toInt() ?? 0,
        collectionFee: (p['collectionFee'] as num?)?.toInt() ?? 0,
        totalFees: (p['totalFees'] as num?)?.toInt() ?? (totalAmount - price),
      );
    } catch (e) {
      return null;
    }
  }

  String _formatPrice(int v) {
    if (v < 1000) return '$v';
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r';
  }

  /// Remove an order by its order number (used after a transfer).
  void removeOrder(String orderNumber) {
    _orders.removeWhere((o) => o.orderNumber == orderNumber);
    _notify();
  }

  /// Apply a transferred amount to [target] by adding it to the target's
  /// accumulated funds and marking installment slots as paid.
  ///
  /// Returns a record with:
  ///   - credited: number of installment slots newly marked paid
  ///   - overpay: any amount that exceeds the product remaining balance
  ///   - completed: whether the product is now fully paid off
  ({int credited, int overpay, bool completed}) applyTransferCredit(
      ConfirmedOrder target, int transferredAmount) {
    final alreadyPaid = target._accumulatedFunds;
    final totalNeeded = target.basePrice;
    final stillNeeded = (totalNeeded - alreadyPaid).clamp(0, totalNeeded);

    final int applied;
    final int overpay;
    if (transferredAmount > stillNeeded) {
      applied = stillNeeded;
      overpay = transferredAmount - stillNeeded;
    } else {
      applied = transferredAmount;
      overpay = 0;
    }

    target._accumulatedFunds += applied;

    int remaining = applied;
    int credited = 0;
    for (int i = 0; i < target.totalInstallments; i++) {
      if (!target.paidInstallments.contains(i) &&
          remaining >= target.perInstallment) {
        target.paidInstallments.add(i);
        remaining -= target.perInstallment;
        credited++;
      }
    }

    // If overpay the product price is reached -> mark all slots paid
    if (overpay > 0) {
      for (int i = 0; i < target.totalInstallments; i++) {
        target.paidInstallments.add(i);
      }
    }

    final completed = target.isFullyPaid;
    _notify();
    return (credited: credited, overpay: overpay, completed: completed);
  }

  // Simple listener list
  final List<void Function()> _listeners = [];
  void addListener(void Function() l) => _listeners.add(l);
  void removeListener(void Function() l) => _listeners.remove(l);
  void _notify() {
    for (final l in _listeners) {
      l();
    }
  }
}
