// ─── Global Wallet State ───────────────────────────────────────────────────
// Singleton holding balance + full transaction history.
import 'services/api_service.dart';

enum TxType { deposit, withdrawal, bnpl, transfer }

class WalletTransaction {
  final TxType type;
  final String title;
  final int amount; // positive FCFA
  final bool isCredit;
  final DateTime date;
  String tag; // mutable so cash deposits can update PENDING → SUCCESS

  WalletTransaction({
    required this.type,
    required this.title,
    required this.amount,
    required this.isCredit,
    required this.date,
    required this.tag,
  });

  String get amountFormatted {
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

class WalletState {
  WalletState._();
  static final WalletState instance = WalletState._();

  int _balance = 0;

  // Tracks the user's remaining BNPL contribution allowance.
  int _maxContribution = 500000;
  int get maxContribution => _maxContribution;
  void deductMaxContribution(int amount) {
    _maxContribution = (_maxContribution - amount).clamp(0, _maxContribution);
    _notify();
  }

  /// Restore [amount] to the BNPL contribution allowance.
  /// Called when a user exchanges a product (removes the old product's price)
  /// or when the cap needs to be partially reversed.
  void restoreMaxContribution(int amount) {
    _maxContribution = (_maxContribution + amount).clamp(0, 500000);
    _notify();
  }

  int get balance => _balance;

  String get balanceFormatted {
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
      title: 'Deposit via $operator',
      amount: amount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'SUCCESS',
    ));
  }

  void deduct(int amount,
      {String reason = 'Withdrawal',
      TxType type = TxType.withdrawal,
      String tag = 'PROCESSED'}) {
    if (_balance < amount) throw Exception('Insufficient funds');
    _balance -= amount;
    _addTx(WalletTransaction(
      type: type,
      title: reason,
      amount: amount,
      isCredit: false,
      date: DateTime.now(),
      tag: tag,
    ));
  }

  void addBnplPayment(
      String productName, int amount, int installment, int total) {
    _balance -= amount;
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
      title: 'Refund — $productName',
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
      title: 'Transfer Received — $sender',
      amount: amount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'SUCCESS',
    ));
  }

  // ── Cash Deposit Flow ─────────────────────────────────────────────────────

  /// Step 1: User finalises a Pay in Cash deposit.
  /// Records a PENDING transaction and returns its id.
  String cashDepositPending(int requestedAmount) {
    final tx = WalletTransaction(
      type: TxType.deposit,
      title: 'Dépôt en espèces via un agent Watsim',
      amount: requestedAmount,
      isCredit: true,
      date: DateTime.now(),
      tag: 'PENDING',
    );
    _transactions.add(tx);
    _notify();
    return '${DateTime.now().millisecondsSinceEpoch}'; // used as reference id
  }

  /// Step 2: Watsim official hands in cash at office.
  /// [requestedAmount]  – what the user originally submitted.
  /// [collectedAmount]  – what the official actually brought in.
  /// Updates the latest matching PENDING transaction and credits the wallet.
  void cashDepositConfirm({
    required int requestedAmount,
    required int collectedAmount,
  }) {
    // Find the most recent PENDING cash deposit to update its tag
    final pending = _transactions.lastWhere(
      (t) =>
          t.tag == 'PENDING' &&
          t.title == 'Dépôt en espèces via un agent Watsim',
      orElse: () => WalletTransaction(
        type: TxType.deposit,
        title: '',
        amount: 0,
        isCredit: true,
        date: DateTime.now(),
        tag: '',
      ),
    );

    if (pending.tag == 'PENDING') {
      pending.tag = 'SUCCESS';
    }

    // Credit the actual collected amount to the balance
    _balance += collectedAmount;

    // If the collected amount differs, add a separate adjustment transaction
    if (collectedAmount != requestedAmount) {
      final diff = collectedAmount - requestedAmount;
      _addTx(WalletTransaction(
        type: TxType.deposit,
        title: diff > 0
            ? 'Ajustement de dépôt en espèces (+)'
            : 'Ajustement de dépôt en espèces',
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

  /// Sync wallet balance and transactions from backend
  Future<void> syncWithBackend() async {
    _isLoading = true;
    _error = null;
    _notify();

    try {
      // Fetch wallet balance
      final walletData = await ApiService.fetchWallet();
      final backendBalance = (walletData['balance'] as num?)?.toInt() ?? 0;

      // Update balance if different
      if (backendBalance != _balance) {
        _balance = backendBalance;
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

    switch (type) {
      case 'DEPOSIT':
        return 'Deposit via ${provider ?? 'Mobile Money'}';
      case 'WITHDRAWAL':
        return 'Withdrawal via ${provider ?? 'Mobile Money'}';
      case 'PURCHASE':
        return 'BNPL Purchase';
      case 'REPAYMENT':
        return 'BNPL Repayment';
      case 'REFUND':
        return 'Refund';
      default:
        return type ?? 'Transaction';
    }
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  final List<void Function()> _listeners = [];
  void addListener(void Function() l) => _listeners.add(l);
  void removeListener(void Function() l) => _listeners.remove(l);
  void _notify() {
    for (final l in _listeners) l();
  }
}
