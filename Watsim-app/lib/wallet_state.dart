// ─── Global Wallet State ───────────────────────────────────────────────────
// Singleton holding balance + full transaction history.
import 'package:flutter/foundation.dart';
import 'services/api_service.dart';
import 'services/language_service.dart';

enum TxType { deposit, withdrawal, bnpl, transfer }

class WalletTransaction {
  final String? id;
  final TxType type;
  final String title;
  final int amount; // positive FCFA
  final bool isCredit;
  final DateTime date;
  String tag; // mutable so cash deposits can update PENDING → SUCCESS

  WalletTransaction({
    this.id,
    required this.type,
    required this.title,
    required this.amount,
    required this.isCredit,
    required this.date,
    required this.tag,
  });

  String get amountFormatted {
    if (amount < 1000) return '$amount FCFA';
    final thousands = amount ~/ 1000;
    final remainder = (amount % 1000).toString().padLeft(3, '0');
    return '$thousands,$remainder FCFA';
  }

  bool get isPending => tag.toUpperCase().contains('PENDING');
  bool get isFailed =>
      tag.toUpperCase().contains('FAIL') ||
      tag.toUpperCase().contains('CANCEL') ||
      tag.toUpperCase().contains('REJECTED');
  bool get isFinalized => !isPending && !isFailed;
}

class WalletState extends ChangeNotifier {
  WalletState._();
  static final WalletState instance = WalletState._();

  int _balance = 0;

  // Tracks the user's total BNPL credit limit (loaded from the backend).
  int _creditLimit = 0;
  int get creditLimit => _creditLimit;

  /// Total price of all active (not fully paid) BNPL orders.
  int _usedCredit = 0;
  int get usedCredit => _usedCredit;
  int get availableCredit =>
      (_creditLimit - _usedCredit).clamp(0, _creditLimit);

  void setCreditLimit(int amount) {
    _creditLimit = amount.clamp(0, double.maxFinite.toInt());
    _notify();
  }

  void setUsedCredit(int amount) {
    _usedCredit = amount.clamp(0, _creditLimit);
    _notify();
  }

  /// @deprecated Use [setCreditLimit] and [setUsedCredit] from real data.
  int _maxContribution = 0;
  int get maxContribution => _maxContribution;
  void deductMaxContribution(int amount) {
    _usedCredit = (_usedCredit + amount).clamp(0, _creditLimit);
    _notify();
  }

  /// Restore [amount] to the BNPL contribution allowance.
  void restoreMaxContribution(int amount) {
    _usedCredit = (_usedCredit - amount).clamp(0, _creditLimit);
    _notify();
  }

  int get balance => _balance;

  String get balanceFormatted {
    if (_balance < 1000) return '$_balance FCFA';
    final thousands = _balance ~/ 1000;
    final remainder = (_balance % 1000).toString().padLeft(3, '0');
    return '$thousands,$remainder FCFA';
  }

  // ── Transaction log ───────────────────────────────────────────────────────
  final List<WalletTransaction> _transactions = [];
  List<WalletTransaction> get transactions =>
      List.unmodifiable(_transactions.reversed.toList());

  void _addTx(WalletTransaction tx) {
    _transactions.add(tx);
    _notify();
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  bool hasSufficientFunds(int amount) => _balance >= amount;

  void topUp(int amount, {String operator = 'Mobile Money'}) {
    _balance += amount;
    _addTx(WalletTransaction(
      type: TxType.deposit,
      title: LanguageService().depositVia(operator),
      amount: amount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'SUCCESS',
    ));
  }

  void deduct(int amount,
      {String? reason,
      TxType type = TxType.withdrawal,
      String tag = 'PROCESSED'}) {
    if (_balance < amount) {
      throw Exception(LanguageService().insufficientFunds);
    }
    _balance -= amount;
    _addTx(WalletTransaction(
      type: type,
      title: reason ?? LanguageService().withdrawalTx,
      amount: amount,
      isCredit: false,
      date: DateTime.now(),
      tag: tag,
    ));
  }

  void addBnplPayment(
      String productName, int amount, int installment, int total) {
    _balance = (_balance - amount).clamp(0, 1 << 62);
    _addTx(WalletTransaction(
      type: TxType.bnpl,
      title: 'BNPL — $productName',
      amount: amount,
      isCredit: false,
      date: DateTime.now(),
      tag: 'INSTALLMENT $installment/$total',
    ));
  }

  /// Credit an overpay refund back to the wallet.
  void refundOverpay(String productName, int amount) {
    _balance += amount;
    _addTx(WalletTransaction(
      type: TxType.deposit,
      title: LanguageService().refundFor(productName),
      amount: amount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'REFUND',
    ));
  }

  void addTransferReceived(String sender, int amount) {
    _balance += amount;
    _addTx(WalletTransaction(
      type: TxType.transfer,
      title: LanguageService().transferReceivedTx(sender),
      amount: amount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'SUCCESS',
    ));
  }

  // ── Cash Deposit Flow ─────────────────────────────────────────────────────

  /// Step 1: User finalises a Pay in Cash deposit.
  /// Records a PENDING transaction and returns its id.
  static String get cashDepositTitle =>
      LanguageService().cashDepositTxTitle;
  static int _idCounter = 0;

  String cashDepositPending(int requestedAmount, {String? transactionId}) {
    final id = transactionId ?? '${DateTime.now().millisecondsSinceEpoch}-${_idCounter++}';
    final tx = WalletTransaction(
      id: id,
      type: TxType.deposit,
      title: cashDepositTitle,
      amount: requestedAmount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'PENDING',
    );
    _transactions.add(tx);
    _notify();
    // Monotonic suffix guarantees uniqueness even within the same millisecond.
    return id;
  }

  /// Step 2: Watsim official hands in cash at office.
  /// [requestedAmount]  – what the user originally submitted.
  /// [collectedAmount]  – what the official actually brought in.
  /// Updates the latest matching PENDING transaction and credits the wallet.
  void cashDepositConfirm({
    required String transactionId,
    required int requestedAmount,
    required int collectedAmount,
  }) {
    // Match this exact request; duplicate confirmations must not credit again.
    final idx = _transactions.indexWhere(
      (t) => t.id == transactionId && t.title == cashDepositTitle && t.tag == 'PENDING',
    );
    if (idx < 0) return;

    _transactions[idx].tag = 'SUCCESS';

    // Credit the actual collected amount to the balance
    _balance += collectedAmount;

    // If the collected amount differs, add a separate adjustment transaction
    if (collectedAmount != requestedAmount) {
      final diff = collectedAmount - requestedAmount;
      _addTx(WalletTransaction(
        type: TxType.deposit,
        title: diff > 0
            ? LanguageService().cashAdjustmentPlus
            : LanguageService().cashAdjustment,
        amount: diff.abs(),
        isCredit: diff > 0,
        date: DateTime.now(),
        tag: 'ADJUSTED',
      ));
    } else {
      _notify();
    }
  }

  // ── Backend Sync ──────────────────────────────────────────────────────────
  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Sync wallet, credit limit and active BNPL usage from the backend.
  Future<void> syncWithBackend() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    _notify();

    try {
      // Fetch wallet balance and profile in parallel
      final [walletData, profileData] = await Future.wait([
        ApiService.fetchWallet(),
        ApiService.fetchProfile(),
      ]);

      final backendBalance =
          ((walletData as Map)['balance'] as num?)?.toInt() ?? 0;
      final parsedLimit =
          ((profileData as Map)['creditLimit'] as num?)?.toInt() ?? 0;

      if (backendBalance != _balance) {
        _balance = backendBalance;
      }

      _creditLimit = parsedLimit;
      _maxContribution = parsedLimit;

      // Fetch active BNPL purchases to compute real credit usage.
      final purchases = await ApiService.fetchOrders();
      _usedCredit = 0;
      for (final raw in purchases) {
        final p = Map<String, dynamic>.from(raw as Map<dynamic, dynamic>);
        final status = p['status'] as String? ?? '';
        if (status == 'COMPLETED' ||
            status == 'CANCELLED' ||
            status == 'REFUNDED') continue;
        _usedCredit += (p['totalAmount'] as num?)?.toInt() ??
            (p['product']?['price'] as num?)?.toInt() ??
            0;
      }

      // Fetch transactions
      final transactions = await ApiService.fetchTransactions();
      _transactions.clear();

      for (final tx in transactions) {
        final txData = Map<String, dynamic>.from(tx as Map<dynamic, dynamic>);
        final type = _parseTxType(txData['type'] as String?);
        final amount = (txData['amount'] as num?)?.toInt() ?? 0;
        final isCredit = type == TxType.deposit || (txData['type'] == 'REFUND');

        _transactions.add(WalletTransaction(
          id: txData['id'] as String?,
          type: type,
          title: _formatTxTitle(txData),
          amount: amount,
          isCredit: isCredit,
          date: txData['createdAt'] != null
              ? DateTime.tryParse(txData['createdAt'] as String) ??
                  DateTime.now()
              : DateTime.now(),
          tag: txData['status'] as String? ?? 'COMPLETED',
        ));
      }

      _isLoading = false;
      _notify();
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      _notify();
    }
  }

  TxType _parseTxType(String? type) {
    switch (type) {
      case 'DEPOSIT':
      case 'REFUND':
        return TxType.deposit;
      case 'WITHDRAWAL':
        return TxType.withdrawal;
      case 'PURCHASE':
      case 'REPAYMENT':
        return TxType.bnpl;
      case 'TRANSFER':
        return TxType.transfer;
      default:
        return TxType.deposit;
    }
  }

  String _formatTxTitle(Map<String, dynamic> tx) {
    final type = tx['type'] as String?;
    final provider = tx['provider'] as String?;
    final lang = LanguageService();

    switch (type) {
      case 'DEPOSIT':
        return lang.depositVia(provider ?? 'Mobile Money');
      case 'WITHDRAWAL':
        return lang.withdrawalVia(provider ?? 'Mobile Money');
      case 'PURCHASE':
        return lang.bnplPurchaseTx;
      case 'REPAYMENT':
        return lang.bnplRepaymentTx;
      case 'REFUND':
        return lang.refundTx;
      default:
        return type ?? lang.transactionTx;
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  void _notify() => notifyListeners();
}
