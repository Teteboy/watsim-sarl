import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../wallet_state.dart';
import '../notification_state.dart';
import '../order_state.dart';
import '../services/language_service.dart';
import '../services/biometric_service.dart';
import 'deposit_screen.dart';
import 'catalogue_screen.dart';
import '../services/api_service.dart';
import '../widgets/transaction_detail_sheet.dart';

class HistoryScreen extends StatefulWidget {
  final int initialTab;
  const HistoryScreen({super.key, this.initialTab = 0});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  String _filter = 'All';
  // Internal keys — display labels come from lang in build
  final _filterKeys = ['All', 'Deposits', 'Withdrawals', 'Transfers', 'BNPL'];

  String _statusFilter = 'All';
  final _statusFilterKeys = ['All', 'Pending', 'Completed'];
  final _statusFilterLabels = ['All', 'Pending', 'Completed'];

  // Period filter state
  DateTime? _periodStart;
  DateTime? _periodEnd;

  @override
  void initState() {
    super.initState();
    _tabs =
        TabController(length: 3, vsync: this, initialIndex: widget.initialTab);
    WalletState.instance.addListener(_onWalletChange);
    OrderState.instance.addListener(_onWalletChange);
    // Sync wallet transactions and orders from backend on every open
    WalletState.instance.syncWithBackend();
    OrderState.instance.syncWithBackend();
  }

  @override
  void dispose() {
    WalletState.instance.removeListener(_onWalletChange);
    OrderState.instance.removeListener(_onWalletChange);
    _tabs.dispose();
    super.dispose();
  }

  void _onWalletChange() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final filterLabels = [
      lang.filterAll,
      lang.filterDeposits,
      lang.filterWithdrawals,
      lang.filterTransfers,
      lang.filterBNPL
    ];
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        title: Text(lang.history),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          IconButton(
            icon: const Icon(Icons.bar_chart_rounded, color: Colors.white),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const StatisticsScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: Colors.white),
            onPressed: () => _showFilter(context),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.primaryGreen,
          labelColor: AppColors.primaryGreen,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(text: 'Transactions'),
            Tab(text: 'Orders'),
            Tab(text: 'Statistics')
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _buildTransactions(),
          _buildOrders(),
          const StatisticsScreen(embedded: true),
        ],
      ),
    );
  }

  List<WalletTransaction> get _filtered {
    var all = WalletState.instance.transactions.toList();
    // Apply type filter
    switch (_filter) {
      case 'Deposits':
        all = all.where((t) => t.type == TxType.deposit).toList();
      case 'Withdrawals':
        all = all.where((t) => t.type == TxType.withdrawal).toList();
      case 'Transfers':
        all = all.where((t) => t.type == TxType.transfer).toList();
      case 'BNPL':
        all = all.where((t) => t.type == TxType.bnpl).toList();
    }
    // Apply status filter
    switch (_statusFilter) {
      case 'Pending':
        all = all.where((t) => t.isPending).toList();
      case 'Completed':
        all = all.where((t) => t.isFinalized).toList();
    }
    // Apply period filter
    if (_periodStart != null && _periodEnd != null) {
      all = all.where((t) {
        final d = t.date;
        return !d.isBefore(_periodStart!) && !d.isAfter(_periodEnd!);
      }).toList();
    }
    return all;
  }

  IconData _iconFor(WalletTransaction tx) {
    switch (tx.type) {
      case TxType.deposit:
        return Icons.arrow_circle_up_rounded;
      case TxType.withdrawal:
        return Icons.arrow_circle_down_rounded;
      case TxType.bnpl:
        return Icons.shopping_bag_rounded;
      case TxType.transfer:
        return Icons.people_alt_rounded;
    }
  }

  Color _colorFor(WalletTransaction tx) {
    switch (tx.type) {
      case TxType.deposit:
        return AppColors.primaryGreen;
      case TxType.withdrawal:
        return AppColors.warning;
      case TxType.bnpl:
        return AppColors.deepTeal;
      case TxType.transfer:
        return AppColors.secondaryGreen;
    }
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final txDay = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(txDay).inDays;
    if (diff == 0) {
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return 'Today, $h:$m';
    } else if (diff == 1) {
      return 'Yesterday';
    }
    const months = [
      '',
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
    return '${months[dt.month]} ${dt.day}, ${dt.year}';
  }

  Widget _buildTransactions() {
    final lang = LanguageProvider.of(context);
    final filterLabels = [
      lang.filterAll,
      lang.filterDeposits,
      lang.filterWithdrawals,
      lang.filterTransfers,
      lang.filterBNPL
    ];
    final filtered = _filtered;
    final all = WalletState.instance.transactions;
    final hasAny = all.isNotEmpty;

    // Compute summary from finalized transactions only (exclude pending/failed)
    int totalReceived = 0, totalSpent = 0;
    for (final t in all) {
      if (!t.isFinalized) continue;
      if (t.isCredit) {
        totalReceived += t.amount;
      } else {
        totalSpent += t.amount;
      }
    }
    final net = totalReceived - totalSpent;
    String _fmt(int v) {
      final thousands = v ~/ 1000;
      final rem = (v % 1000).toString().padLeft(3, '0');
      return '$thousands,$rem';
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: List.generate(_filterKeys.length, (idx) {
                final key = _filterKeys[idx];
                final label = filterLabels[idx];
                final sel = key == _filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() => _filter = key),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: sel ? AppColors.primaryGreen : AppColors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: sel
                                ? AppColors.primaryGreen
                                : const Color(0xFFD0E8E5)),
                      ),
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: sel
                                  ? Colors.white
                                  : AppColors.textSecondary)),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Status filter chips
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: List.generate(_statusFilterKeys.length, (idx) {
                final key = _statusFilterKeys[idx];
                final label = _statusFilterLabels[idx];
                final sel = key == _statusFilter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() => _statusFilter = key),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: sel ? AppColors.warning : AppColors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: sel
                                ? AppColors.warning
                                : const Color(0xFFD0E8E5)),
                      ),
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: sel
                                  ? Colors.white
                                  : AppColors.textSecondary)),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (hasAny) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: _summaryChip('+${_fmt(totalReceived)}', 'Received',
                      AppColors.primaryGreen),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _summaryChip(
                      '-${_fmt(totalSpent)}', 'Spent', AppColors.error),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child:
                      _summaryChip(_fmt(net.abs()), 'Net', AppColors.deepTeal),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Expanded(
          child: filtered.isEmpty
              ? _buildEmptyState()
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 56),
                  itemBuilder: (_, i) {
                    final t = filtered[i];
                    final color = _colorFor(t);
                    return TransactionRow(
                      icon: _iconFor(t),
                      iconColor: color,
                      iconBg: color.withOpacity(0.1),
                      title: t.title,
                      subtitle: _formatDate(t.date),
                      amount: t.amountFormatted,
                      isCredit: t.isCredit,
                      tag: t.tag,
                      onTap: () => showModalBottomSheet(
                        context: context,
                        backgroundColor: Colors.transparent,
                        isScrollControlled: true,
                        builder: (_) => TransactionDetailSheet(tx: t),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ─── Orders Tab ────────────────────────────────────────────────────────────
  Widget _buildOrders() {
    final lang = LanguageProvider.of(context);
    final orders = OrderState.instance.orders;

    if (orders.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.shopping_bag_outlined,
                    color: AppColors.primaryGreen, size: 38),
              ),
              const SizedBox(height: 18),
              Text(lang.noOrdersYet,
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              const Text(
                'Browse our catalogue and place your first\nBNPL order to see it here.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const CatalogueScreen())),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                  decoration: BoxDecoration(
                      color: AppColors.primaryGreen,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text(lang.browseCatalogue,
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _OrderCard(order: orders[i]),
    );
  }

  Widget _buildEmptyState() {
    final lang = LanguageProvider.of(context);
    final isFiltered = _filter != 'All' || _statusFilter != 'All';
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isFiltered
                    ? Icons.filter_list_off_rounded
                    : Icons.receipt_long_rounded,
                color: AppColors.primaryGreen,
                size: 34,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              isFiltered
                  ? 'No transactions match your filters'
                  : 'No transactions yet',
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              isFiltered
                  ? 'Try a different filter to see your history.'
                  : 'Make your first deposit to start\ntracking your transactions here.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary, height: 1.5),
            ),
            if (!isFiltered) ...[
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const DepositScreen())),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                  decoration: BoxDecoration(
                      color: AppColors.primaryGreen,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text(lang.makeDeposit,
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _summaryChip(String amount, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text('$amount F',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  void _showFilter(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        final lang = LanguageProvider.of(ctx);
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final periods = [
          (
            'This Week',
            today.subtract(Duration(days: today.weekday - 1)),
            today
          ),
          ('This Month', DateTime(now.year, now.month, 1), today),
          ('Last 3 Months', DateTime(now.year, now.month - 2, 1), today),
          ('This Year', DateTime(now.year, 1, 1), today),
        ];
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(lang.filterByPeriod,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              ...periods.map((p) => ListTile(
                    title: Text(p.$1),
                    trailing: const Icon(Icons.chevron_right_rounded,
                        color: AppColors.textMuted),
                    onTap: () {
                      setState(() {
                        _periodStart = p.$2;
                        _periodEnd = p.$3;
                      });
                      Navigator.pop(context);
                    },
                  )),
              ListTile(
                title: const Text('Clear Filter',
                    style: TextStyle(color: AppColors.primaryGreen)),
                trailing:
                    const Icon(Icons.clear, color: AppColors.primaryGreen),
                onTap: () {
                  setState(() {
                    _periodStart = null;
                    _periodEnd = null;
                  });
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      }, // end filter period builder
    );
  }

  // ── Language switcher ────────────────────────────────
  Widget _buildLanguageSwitcher() {
    final lang = LanguageProvider.of(context);
    return TextButton.icon(
      onPressed: () {
        LanguageService().toggle();
      },
      icon: const Icon(Icons.language, color: AppColors.white, size: 18),
      label: Text(
        lang.isFrench ? 'FR' : 'EN',
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        minimumSize: const Size(40, 40),
      ),
    );
  }
}

// ─── Statistics Screen ─────────────────────────────────────────────────────
class StatisticsScreen extends StatefulWidget {
  final bool embedded;
  const StatisticsScreen({super.key, this.embedded = false});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  String _period = 'Month';
  final _periods = ['Week', 'Month', 'Quarter', 'Year'];

  @override
  void initState() {
    super.initState();
    WalletState.instance.addListener(_onWalletChange);
  }

  @override
  void dispose() {
    WalletState.instance.removeListener(_onWalletChange);
    super.dispose();
  }

  void _onWalletChange() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  // Compute bar data from real transactions grouped by month
  List<_MonthBar> _computeBarData() {
    final txs = WalletState.instance.transactions;
    final Map<String, double> byMonth = {};
    const months = [
      '',
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
    for (final t in txs) {
      if (!t.isCredit) {
        final key = months[t.date.month];
        byMonth[key] = (byMonth[key] ?? 0) + t.amount / 1000.0;
      }
    }
    return byMonth.entries.map((e) => _MonthBar(e.key, e.value)).toList()
      ..sort((a, b) {
        final order =
            months.indexOf(a.label).compareTo(months.indexOf(b.label));
        return order;
      });
  }

  List<_Cat> _computeCategories() {
    final txs =
        WalletState.instance.transactions.where((t) => !t.isCredit).toList();
    if (txs.isEmpty) return [];
    final total = txs.fold<int>(0, (s, t) => s + t.amount);
    final Map<TxType, int> byType = {};
    for (final t in txs) {
      byType[t.type] = (byType[t.type] ?? 0) + t.amount;
    }
    final labels = {
      TxType.bnpl: ('BNPL', AppColors.primaryGreen),
      TxType.withdrawal: ('Withdrawals', AppColors.secondaryGreen),
      TxType.transfer: ('Transfers', AppColors.deepTeal),
    };
    return byType.entries.where((e) => labels.containsKey(e.key)).map((e) {
      final info = labels[e.key]!;
      return _Cat(info.$1, e.value / total, info.$2);
    }).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final txs = WalletState.instance.transactions;
    final hasData = txs.isNotEmpty;

    final body = hasData ? _buildStats() : _buildEmptyState();

    if (widget.embedded) return body;

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: const WatsimAppBar(title: 'Statistics', showBack: true),
      body: body,
    );
  }

  Widget _buildEmptyState() {
    final lang = LanguageProvider.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.bar_chart_rounded,
                  color: AppColors.primaryGreen, size: 34),
            ),
            const SizedBox(height: 18),
            Text(lang.noDataYet,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            const Text(
              'Your spending statistics will appear\nhere once you make transactions.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13, color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const DepositScreen())),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                decoration: BoxDecoration(
                    color: AppColors.primaryGreen,
                    borderRadius: BorderRadius.circular(10)),
                child: Text(lang.makeDeposit,
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStats() {
    final lang = LanguageProvider.of(context);
    final txs = WalletState.instance.transactions;
    int totalReceived = 0, totalSpent = 0;
    for (final t in txs) {
      if (t.isCredit) {
        totalReceived += t.amount;
      } else {
        totalSpent += t.amount;
      }
    }

    String _fmt(int v) {
      final thousands = v ~/ 1000;
      final rem = (v % 1000).toString().padLeft(3, '0');
      return '+$thousands,$rem F';
    }

    String _fmtSpent(int v) {
      final thousands = v ~/ 1000;
      final rem = (v % 1000).toString().padLeft(3, '0');
      return '-$thousands,$rem F';
    }

    final barData = _computeBarData();
    final categories = _computeCategories();
    final maxBar = barData.isEmpty
        ? 1.0
        : barData.map((b) => b.value).reduce((a, b) => a > b ? a : b);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE8F2F1)),
            ),
            child: Row(
              children: _periods.map((p) {
                final sel = p == _period;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _period = p),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color:
                            sel ? AppColors.primaryGreen : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Center(
                        child: Text(p,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: sel
                                    ? Colors.white
                                    : AppColors.textSecondary)),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                  child: _kpiCard('Income', _fmt(totalReceived),
                      AppColors.primaryGreen, Icons.trending_up_rounded)),
              const SizedBox(width: 12),
              Expanded(
                  child: _kpiCard('Expenses', _fmtSpent(totalSpent),
                      AppColors.error, Icons.trending_down_rounded)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _kpiCard('Transactions', '${txs.length}',
                      AppColors.deepTeal, Icons.receipt_long_rounded)),
              const SizedBox(width: 12),
              Expanded(
                  child: _kpiCard(
                      'Net Balance',
                      _fmt(totalReceived - totalSpent),
                      AppColors.secondaryGreen,
                      Icons.account_balance_wallet_rounded)),
            ],
          ),
          const SizedBox(height: 24),
          if (barData.isNotEmpty) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.spendingByMonth,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 140,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: List.generate(barData.length, (i) {
                        final b = barData[i];
                        final h = (b.value / maxBar) * 130;
                        final isLast = i == barData.length - 1;
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Container(
                              width: 28,
                              height: h.clamp(4.0, 130.0),
                              decoration: BoxDecoration(
                                color: isLast
                                    ? AppColors.primaryGreen
                                    : AppColors.primaryGreen.withOpacity(0.25),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(b.label,
                                style: TextStyle(
                                    fontSize: 10,
                                    color: isLast
                                        ? AppColors.primaryGreen
                                        : AppColors.textMuted,
                                    fontWeight: isLast
                                        ? FontWeight.w700
                                        : FontWeight.w400)),
                          ],
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          if (categories.isNotEmpty) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.breakdownByCategory,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 16),
                  ...categories.map((c) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 10,
                                      height: 10,
                                      decoration: BoxDecoration(
                                        color: c.color,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(c.name,
                                        style: const TextStyle(
                                            fontSize: 13,
                                            color: AppColors.textSecondary)),
                                  ],
                                ),
                                Text('${(c.value * 100).toInt()}%',
                                    style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: c.color)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            AppProgressBar(value: c.value, color: c.color),
                          ],
                        ),
                      )),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ],
      ),
    );
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted)),
                Text(value,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: color)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Order Card Widget ─────────────────────────────────────────────────────
class _OrderCard extends StatefulWidget {
  final ConfirmedOrder order;
  const _OrderCard({required this.order});

  @override
  State<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<_OrderCard> {
  bool _withdrawn = false;
  bool _exchangeRequested = false;

  ConfirmedOrder get order => widget.order;

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

  String _fmtDate(DateTime dt) =>
      '${dt.day} ${_monthName(dt.month)} ${dt.year}';

  String _fmt(int v) =>
      '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')} FCFA';

  // ── Delivery sheet (matches order_detail_screen) ─────────────────────────
  void _showDeliveryDetails(BuildContext context) {
    final lang = LanguageProvider.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _HistoryDeliverySheet(
        order: order,
        onDeliveryConfirmed: () {
          order.markDeliveryRequested();
          NotificationState.instance.onDeliveryRequested(order.product.name);
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 5),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: [
                  Icon(Icons.local_shipping_rounded,
                      color: Colors.white, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(lang.deliveryDetailsReceived,
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                fontSize: 14)),
                        SizedBox(height: 2),
                        Text(lang.deliveryDetailsBody,
                            style:
                                TextStyle(color: Colors.white70, fontSize: 12)),
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

  // ── Transfer to WatSim Wallet ────────────────────────────────────────────
  void _showTransfer(BuildContext context) {
    final accumulated = order.totalAmountPaid;
    final deduction = (accumulated * 0.20).round();
    final netAmount = accumulated - deduction;

    String fmt(int v) =>
        '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')} FCFA';

    // The recipient phone number, email, or user ID is validated on the server.

    // 0 = phone entry  |  1 = PIN confirm  |  2 = success
    int step = 0;
    final phoneCtrl = TextEditingController();
    final pinCtrl = TextEditingController();
    String? phoneError;
    String? pinError;
    bool unverified = false;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final lang = LanguageProvider.of(ctx);

          // ── drag handle ────────────────────────────────────────────────
          final handle = Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFD0D0D0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );

          // ── funds breakdown card ───────────────────────────────────────
          final fundsCard = Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF607D8B).withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
              border:
                  Border.all(color: const Color(0xFF607D8B).withOpacity(0.20)),
            ),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(lang.accumulatedFundsLabel,
                    style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w600)),
                Text(fmt(accumulated),
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF607D8B))),
              ]),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(lang.serviceFee20,
                    style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w600)),
                Text('− ${fmt(deduction)}',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFE53935))),
              ]),
              const Divider(height: 16),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(lang.recipientReceives,
                    style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w600)),
                Text(fmt(netAmount),
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryGreen)),
              ]),
            ]),
          );

          // ═══════════════════════════════════════════════════════════════
          // STEP 0 – phone number entry
          // ═══════════════════════════════════════════════════════════════
          Widget buildPhoneStep() => Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  handle,
                  const SizedBox(height: 20),

                  // Header row
                  Row(children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFF607D8B).withOpacity(0.10),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.phone_android_rounded,
                          color: Color(0xFF607D8B), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                        child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(lang.transferToWatsim,
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary)),
                        SizedBox(height: 2),
                        Text(lang.sendAccumulatedFunds,
                            style: TextStyle(
                                fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    )),
                  ]),
                  const SizedBox(height: 18),

                  fundsCard,
                  const SizedBox(height: 18),

                  // No funds yet
                  if (accumulated == 0)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFFB74D)),
                      ),
                      child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: Color(0xFFF57C00), size: 20),
                            SizedBox(width: 10),
                            Expanded(
                                child: Text(
                              'No payments made yet. Make at least one instalment before transferring.',
                              style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFFF57C00),
                                  height: 1.4),
                            )),
                          ]),
                    )
                  else ...[
                    // Phone number input
                    TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      maxLength: 15,
                      decoration: InputDecoration(
                        labelText: 'Recipient phone number',
                        hintText: 'e.g. 655000001',
                        prefixIcon: const Icon(Icons.phone_outlined),
                        counterText: '',
                        errorText: phoneError,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (_) {
                        if (phoneError != null || unverified) {
                          setSheet(() {
                            phoneError = null;
                            unverified = false;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Recipient must have an active WatSim account.',
                      style: TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                          fontStyle: FontStyle.italic),
                    ),

                    // Unverified account warning
                    if (unverified) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFEBEE),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFEF9A9A)),
                        ),
                        child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.warning_amber_rounded,
                                  color: Color(0xFFE53935), size: 22),
                              SizedBox(width: 10),
                              Expanded(
                                  child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(lang.noWatsimAccount,
                                      style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFFB71C1C))),
                                  SizedBox(height: 4),
                                  Text(
                                    'This number does not have a verified WatSim account. '
                                    'Check the number or ask the recipient to register on WatSim.',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFFE53935),
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
                          final phone = phoneCtrl.text
                              .trim()
                              .replaceAll(RegExp(r'[\s\-]'), '');
                          if (phone.isEmpty) {
                            setSheet(() =>
                                phoneError = 'Please enter a phone number.');
                            return;
                          }
                          if (phone.length < 8) {
                            setSheet(() =>
                                phoneError = 'Enter a valid phone number.');
                            return;
                          }
                          setSheet(() {
                            unverified = false;
                            phoneError = null;
                            step = 1;
                          });
                        },
                      ),
                    ),
                  ],
                ],
              );

          // ═══════════════════════════════════════════════════════════════
          // STEP 1 – PIN confirmation
          // ═══════════════════════════════════════════════════════════════
          Widget buildPinStep() => Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  handle,
                  const SizedBox(height: 20),

                  Text(lang.confirmTransfer,
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 6),
                  Text(
                    'Enter your 4-digit PIN to send ${fmt(netAmount)} '
                    'to ${phoneCtrl.text.trim()}.',
                    style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4),
                  ),
                  const SizedBox(height: 20),

                  // Transfer summary card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.offWhite,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: Column(children: [
                      Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(lang.fromLabel,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600)),
                            Text(order.product.name,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary)),
                          ]),
                      const SizedBox(height: 8),
                      Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(lang.toWatsim,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600)),
                            Text(phoneCtrl.text.trim(),
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary)),
                          ]),
                      const Divider(height: 16),
                      Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(lang.grossAmount,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600)),
                            Text(fmt(accumulated),
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textSecondary)),
                          ]),
                      const SizedBox(height: 6),
                      Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(lang.serviceFee20,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600)),
                            Text('− ${fmt(deduction)}',
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFE53935))),
                          ]),
                      const Divider(height: 12),
                      Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(lang.recipientReceives,
                                style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                    fontWeight: FontWeight.w600)),
                            Text(fmt(netAmount),
                                style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.primaryGreen)),
                          ]),
                    ]),
                  ),
                  const SizedBox(height: 20),

                  // PIN field
                  TextField(
                    controller: pinCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 4,
                    decoration: InputDecoration(
                      labelText: '4-digit PIN',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      counterText: '',
                      errorText: pinError,
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onChanged: (_) {
                      if (pinError != null) setSheet(() => pinError = null);
                    },
                  ),
                  const SizedBox(height: 20),

                  Row(children: [
                    Expanded(
                        child: OutlinedButton(
                      onPressed: () => setSheet(() {
                        step = 0;
                        pinCtrl.clear();
                        pinError = null;
                      }),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 50),
                        side: const BorderSide(color: AppColors.divider),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(lang.back,
                          style:
                              const TextStyle(color: AppColors.textSecondary)),
                    )),
                    const SizedBox(width: 12),
                    Expanded(
                        child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(0, 50),
                        backgroundColor: const Color(0xFF607D8B),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () async {
                        if (order.id == null) {
                          setSheet(() => pinError =
                              'Order is not linked to a backend purchase.');
                          return;
                        }
                        final phone = phoneCtrl.text
                            .trim()
                            .replaceAll(RegExp(r'[\s\-]'), '');
                        if (phone.isEmpty) {
                          setSheet(
                              () => pinError = 'Please enter a phone number.');
                          return;
                        }
                        if (pinCtrl.text.isEmpty) {
                          setSheet(() => pinError = 'Please enter your PIN.');
                          return;
                        }
                        // The PIN is not verified locally; it is handled server-side through auth.
                        setSheet(() => pinError = null);
                        try {
                          final result = await ApiService.transferContribution(
                            purchaseId: order.id!,
                            recipientIdentifier: phone,
                          );
                          await WalletState.instance.syncWithBackend();
                          OrderState.instance.removeOrder(order.orderNumber);
                          NotificationState.instance.onProductTransferApplied(
                            fromProduct: order.product.name,
                            toProduct: phone,
                            transferred:
                                (result['net'] as num?)?.toInt() ?? netAmount,
                            completed: false,
                          );
                          setSheet(() => step = 2);
                        } on ApiException catch (e) {
                          setSheet(() => pinError = e.message);
                        }
                      },
                      child: Text(lang.confirmTransfer),
                    )),
                  ]),
                ],
              );

          // ═══════════════════════════════════════════════════════════════
          // STEP 2 – success screen
          // ═══════════════════════════════════════════════════════════════
          Widget buildSuccessStep() => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  handle,
                  const SizedBox(height: 24),
                  Container(
                    width: 80,
                    height: 80,
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
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(
                    '${fmt(netAmount)} has been sent to\n'
                    '${phoneCtrl.text.trim()}\'s WatSim wallet.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFB74D)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.info_outline_rounded,
                          color: Color(0xFFF57C00), size: 18),
                      const SizedBox(width: 10),
                      Flexible(
                          child: Text(
                        '20% service fee of ${fmt(deduction)} was deducted '
                        'from your accumulated funds.',
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFFF57C00),
                            height: 1.4),
                      )),
                    ]),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx),
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
                24, 20, 24, MediaQuery.of(ctx).viewInsets.bottom + 32),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SingleChildScrollView(
              child: step == 0
                  ? buildPhoneStep()
                  : step == 1
                      ? buildPinStep()
                      : buildSuccessStep(),
            ),
          );
        },
      ),
    );
  }

  // ── Withdraw sheet ─────────────────────────────────────────────────────
  void _showWithdraw(BuildContext context) {
    final totalPaid = order.basePrice + order.fee;
    final chargeback = (totalPaid * 0.30).round();
    final refund = totalPaid - chargeback;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        final lang = LanguageProvider.of(ctx);
        return Container(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
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
                decoration: BoxDecoration(
                    color: const Color(0xFFD0D0D0),
                    borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 20),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.12),
                    shape: BoxShape.circle),
                child: const Icon(Icons.undo_rounded,
                    size: 28, color: AppColors.warning),
              ),
              const SizedBox(height: 14),
              Text(lang.withdrawPayment,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              const Text(
                'A 30% chargeback fee applies to all withdrawals.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.offWhite,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFD0E8E5)),
                ),
                child: Column(
                  children: [
                    _sheetRow('Total Paid', _fmt(totalPaid)),
                    const Divider(height: 16),
                    _sheetRow('30% Chargeback', '− ${_fmt(chargeback)}',
                        valueColor: AppColors.warning),
                    const Divider(height: 16),
                    _sheetRow('You will receive', _fmt(refund),
                        valueColor: AppColors.primaryGreen),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  if (order.id == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text(
                              'Order is not linked to a backend purchase')),
                    );
                    return;
                  }
                  Navigator.pop(context);
                  try {
                    final result = await ApiService.withdrawContribution(
                        purchaseId: order.id!);
                    await WalletState.instance.syncWithBackend();
                    setState(() => _withdrawn = true);
                    final msg = result['message'] as String?;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content:
                            Text(msg ?? lang.refundedToWallet(_fmt(refund))),
                        backgroundColor: AppColors.primaryGreen,
                      ),
                    );
                  } on ApiException catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(e.message),
                          backgroundColor: Colors.red),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  backgroundColor: AppColors.warning,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(lang.confirmWithdrawal,
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  side: const BorderSide(color: AppColors.primaryGreen),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(lang.cancel,
                    style: TextStyle(color: AppColors.primaryGreen)),
              ),
            ],
          ),
        );
      }, // end withdraw builder
    );
  }

  // ── Exchange (matches order_detail_screen: CatalogueScreen + confirm sheet) ─
  void _showExchange(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CatalogueScreen(
          exchangeMode: true,
          exchangeSourceOrder: order,
          onProductSelectedForExchange: (Product newProduct) {
            Navigator.pop(context);
            final newPrice = _parseHistoryProductPrice(newProduct.price);
            final accumulated = order.accumulatedFunds;
            final int remaining = (newPrice - accumulated).clamp(0, newPrice);
            final int overpayPreview =
                accumulated > newPrice ? accumulated - newPrice : 0;
            final bool willComplete = accumulated >= newPrice;
            showModalBottomSheet(
              context: context,
              backgroundColor: Colors.transparent,
              isScrollControlled: true,
              builder: (_) => _HistoryExchangeConfirmSheet(
                currentOrder: order,
                newProduct: newProduct,
                newPrice: newPrice,
                accumulated: accumulated,
                remaining: remaining,
                overpayPreview: overpayPreview,
                willComplete: willComplete,
                onExchanged: () => setState(() {
                  _exchangeRequested = false;
                }),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _sheetRow(String l, String v, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(l,
            style:
                const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        Text(v,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: valueColor ?? AppColors.textPrimary)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final isComplete = order.isFullyPaid;
    final paidCount = order.paidInstallments.length;
    final progress = paidCount / order.totalInstallments;

    final Color statusColor;
    final String statusLabel;
    final IconData statusIcon;

    if (order.deliveryCompleted) {
      statusColor = AppColors.primaryGreen;
      statusLabel = 'Delivered';
      statusIcon = Icons.verified_rounded;
    } else if (order.deliveryRequested) {
      statusColor = const Color(0xFF1565C0);
      statusLabel = 'Delivery Requested';
      statusIcon = Icons.local_shipping_rounded;
    } else if (isComplete) {
      statusColor = AppColors.primaryGreen;
      statusLabel = 'Completed';
      statusIcon = Icons.check_circle_rounded;
    } else {
      statusColor = AppColors.deepTeal;
      statusLabel = 'In Progress';
      statusIcon = Icons.timelapse_rounded;
    }

    return Container(
      decoration: BoxDecoration(
        color: isComplete
            ? AppColors.primaryGreen.withOpacity(0.04)
            : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isComplete
              ? AppColors.primaryGreen.withOpacity(0.4)
              : const Color(0xFFD0E8E5),
          width: isComplete ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isComplete
                ? AppColors.primaryGreen.withOpacity(0.08)
                : AppColors.primaryDark.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ───────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.08),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: order.product.color,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(order.product.icon,
                      color: Colors.white.withOpacity(0.7), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(order.product.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                      const SizedBox(height: 2),
                      Text(order.orderNumber,
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 12, color: statusColor),
                      const SizedBox(width: 4),
                      Text(statusLabel,
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: statusColor)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Body ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Progress bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(lang.instalmentsCount,
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                    Text('$paidCount / ${order.totalInstallments}',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: statusColor)),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: statusColor.withOpacity(0.12),
                    valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                  ),
                ),
                const SizedBox(height: 14),
                // Details row
                Row(
                  children: [
                    Expanded(
                      child: _detailChip(
                        Icons.calendar_today_rounded,
                        'Ordered',
                        _fmtDate(order.confirmedAt),
                        AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _detailChip(
                        isComplete
                            ? Icons.check_circle_outline_rounded
                            : Icons.schedule_rounded,
                        isComplete ? 'Completed' : 'Next due',
                        isComplete ? 'All paid ✓' : _fmtDate(order.nextDue),
                        statusColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _detailChip(
                        Icons.date_range_rounded,
                        'Plan',
                        order.planDurationLabel,
                        AppColors.deepTeal,
                      ),
                    ),
                  ],
                ),

                // ── Active order: Transfer + Withdraw buttons ────
                if (!isComplete) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _actionBtn(
                          icon: Icons.swap_horiz_rounded,
                          label: 'Transfer',
                          subtitle: 'Move to another plan',
                          color: const Color(0xFF1565C0),
                          onTap: () => _showTransfer(context),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _actionBtn(
                          icon: Icons.account_balance_wallet_outlined,
                          label: _withdrawn ? 'Withdrawn' : 'Withdraw',
                          subtitle: _withdrawn ? null : '30% charge applies',
                          color: const Color(0xFFF57C00),
                          disabled: _withdrawn,
                          onTap:
                              _withdrawn ? null : () => _showWithdraw(context),
                        ),
                      ),
                    ],
                  ),
                ],

                // ── Completed order: banner + 3 action buttons ────
                if (isComplete) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: AppColors.primaryGreen.withOpacity(0.2)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.verified_rounded,
                            size: 14, color: AppColors.primaryGreen),
                        const SizedBox(width: 6),
                        Text(lang.allInstalmentsComplete,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primaryGreen)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Delivery requested state — show "Mark as Received" button
                  if (order.deliveryCompleted)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: AppColors.primaryGreen.withOpacity(0.3)),
                      ),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.verified_rounded,
                                size: 16, color: AppColors.primaryGreen),
                            SizedBox(width: 8),
                            Text(lang.productDelivered,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primaryGreen)),
                          ]),
                    )
                  else if (order.deliveryRequested)
                    Column(children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            vertical: 10, horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE3F2FD),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: const Color(0xFF1565C0).withOpacity(0.3)),
                        ),
                        child: Row(children: [
                          Icon(Icons.local_shipping_rounded,
                              size: 16, color: Color(0xFF1565C0)),
                          SizedBox(width: 8),
                          Expanded(
                              child: Text(lang.deliveryRequested2,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF1565C0)))),
                        ]),
                      ),
                      const SizedBox(height: 8),
                      // "Mark as Received" simulates the product being delivered
                      GestureDetector(
                        onTap: () {
                          order.markDeliveryCompleted();
                          NotificationState.instance
                              .onDeliveryCompleted(order.product.name);
                          setState(() {});
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.primaryGreen.withOpacity(0.10),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: AppColors.primaryGreen.withOpacity(0.3)),
                          ),
                          child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_circle_outline_rounded,
                                    size: 16, color: AppColors.primaryGreen),
                                SizedBox(width: 8),
                                Text(lang.markAsReceived,
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.primaryGreen)),
                              ]),
                        ),
                      ),
                    ])
                  else
                    Row(
                      children: [
                        Expanded(
                          child: _actionBtn(
                            icon: Icons.swap_horiz_rounded,
                            label:
                                _exchangeRequested ? 'Requested' : 'Exchange',
                            subtitle: _exchangeRequested
                                ? null
                                : 'Swap for same price',
                            color: const Color(0xFF607D8B),
                            disabled: _exchangeRequested,
                            onTap: _exchangeRequested
                                ? null
                                : () => _showExchange(context),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _actionBtn(
                            icon: Icons.undo_rounded,
                            label: _withdrawn ? 'Withdrawn' : 'Withdraw',
                            subtitle: _withdrawn ? null : '30% charge applies',
                            color: AppColors.warning,
                            disabled: _withdrawn,
                            onTap: _withdrawn
                                ? null
                                : () => _showWithdraw(context),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _actionBtn(
                            icon: Icons.local_shipping_outlined,
                            label: 'Delivery',
                            subtitle: 'Request delivery',
                            color: AppColors.primaryGreen,
                            onTap: () => _showDeliveryDetails(context),
                          ),
                        ),
                      ],
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn({
    required IconData icon,
    required String label,
    required Color color,
    String? subtitle,
    VoidCallback? onTap,
    bool disabled = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: disabled ? const Color(0xFFF0F0F0) : color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color:
                  disabled ? const Color(0xFFDDDDDD) : color.withOpacity(0.30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: disabled ? AppColors.textMuted : color),
            const SizedBox(height: 4),
            Text(label,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: disabled ? AppColors.textMuted : color)),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(subtitle,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 9,
                      color: disabled
                          ? AppColors.textMuted
                          : color.withOpacity(0.70))),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailChip(IconData icon, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 11, color: color),
              const SizedBox(width: 4),
              Text(label,
                  style: TextStyle(
                      fontSize: 10,
                      color: color.withOpacity(0.8),
                      fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 3),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}

// ─── Field Label Helper ────────────────────────────────────────────────────
class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
            letterSpacing: 0.8));
  }
}

// ─── Delivery PIN Sheet ────────────────────────────────────────────────────
class _DeliveryPinSheet extends StatefulWidget {
  final String fullName;
  final String idCard;
  final int quantity;
  final String productName;
  final String orderNumber;
  final VoidCallback onPinConfirmed;

  const _DeliveryPinSheet({
    required this.fullName,
    required this.idCard,
    required this.quantity,
    required this.productName,
    required this.orderNumber,
    required this.onPinConfirmed,
  });

  @override
  State<_DeliveryPinSheet> createState() => _DeliveryPinSheetState();
}

class _DeliveryPinSheetState extends State<_DeliveryPinSheet> {
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
      localizedReason: 'Confirm with biometric',
    );

    if (authenticated && mounted) {
      // Biometric auth successful - simulate PIN entry
      setState(() {
        _pin = '****';
        _error = false;
      });
      _verify();
    }
  }

  void _verify() async {
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
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

          // Delivery summary
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.local_shipping_outlined,
                        color: AppColors.primaryGreen, size: 16),
                    SizedBox(width: 8),
                    Text(lang.confirmDelivery,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                  ],
                ),
                const SizedBox(height: 10),
                _infoRow(Icons.inventory_2_outlined, widget.productName,
                    badge: '×${widget.quantity}'),
                const SizedBox(height: 6),
                _infoRow(Icons.tag_rounded, widget.orderNumber),
                const SizedBox(height: 6),
                _infoRow(Icons.person_outline_rounded, widget.fullName),
                const SizedBox(height: 6),
                _infoRow(Icons.credit_card_rounded, widget.idCard),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(lang.enterPINToConfirm,
              style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
          const SizedBox(height: 6),
          Text(lang.authoriseDelivery,
              style: TextStyle(
                  fontSize: 13, color: Colors.white.withOpacity(0.55))),
          const SizedBox(height: 20),

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
              ),
            ),
          ),
          if (_error) ...[
            const SizedBox(height: 10),
            Text(lang.incorrectPIN,
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
                  return _numKey('${row * 3 + col + 1}');
                }),
              ),
            ),
          ),
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

  Widget _infoRow(IconData icon, String text, {String? badge}) {
    return Row(
      children: [
        Icon(icon, size: 13, color: Colors.white54),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: const TextStyle(fontSize: 12, color: Colors.white70),
              overflow: TextOverflow.ellipsis),
        ),
        if (badge != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withOpacity(0.2),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(badge,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryGreen)),
          ),
      ],
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

class _Cat {
  final String name;
  final double value;
  final Color color;
  const _Cat(this.name, this.value, this.color);
}

class _MonthBar {
  final String label;
  final double value;
  const _MonthBar(this.label, this.value);
}

int _parseHistoryProductPrice(String priceStr) {
  final digits = priceStr.replaceAll(RegExp(r'[^0-9]'), '');
  return int.tryParse(digits) ?? 0;
}

class _HistoryExchangeConfirmSheet extends StatefulWidget {
  final ConfirmedOrder currentOrder;
  final Product newProduct;
  final int newPrice;
  final int accumulated; // funds already in the order
  final int
      remaining; // still needed after applying accumulated (0 if willComplete)
  final int
      overpayPreview; // excess above newPrice (0 if accumulated ≤ newPrice)
  final bool willComplete; // accumulated >= newPrice
  final VoidCallback onExchanged;

  const _HistoryExchangeConfirmSheet({
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
  State<_HistoryExchangeConfirmSheet> createState() =>
      _HistoryExchangeConfirmSheetState();
}

class _HistoryExchangeConfirmSheetState
    extends State<_HistoryExchangeConfirmSheet> {
  bool _showPin = false;
  bool _done = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;
  static const _validPin = "1234";

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

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

    final order = widget.currentOrder;
    final newProduct = widget.newProduct;
    final oldPrice = order.basePrice;

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
    final order = widget.currentOrder;
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
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),

            // ── Done state ───────────────────────────────────────────────
            if (_done) ...[
              Center(
                  child: Column(children: [
                Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.12),
                        shape: BoxShape.circle),
                    child: Icon(
                      widget.willComplete
                          ? Icons.verified_rounded
                          : Icons.swap_horiz_rounded,
                      size: 36,
                      color: AppColors.primaryGreen,
                    )),
                const SizedBox(height: 16),
                Text(
                  widget.willComplete
                      ? 'Exchange Complete! 🎉'
                      : lang.exchangeConfirmed,
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary),
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
                  style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.done)),
              ])),

              // ── PIN entry ────────────────────────────────────────────────
            ] else if (_showPin) ...[
              Text(lang.confirmWithPIN,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text("Enter your 4-digit PIN to confirm the exchange.",
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 20),

              // Product swap summary
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
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(order.product.name,
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
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(newProduct.name,
                            textAlign: TextAlign.end,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                      ])),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome banner
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(
                    Icons.account_balance_wallet_outlined,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    "${_fmt(widget.overpayPreview)} will be refunded to your wallet after completing the order.")
              else if (widget.willComplete)
                _infoBanner(
                    Icons.check_circle_outline_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    "Your accumulated funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(
                    Icons.info_outline_rounded,
                    const Color(0xFFF57C00),
                    const Color(0xFFFFF3E0),
                    "You still need ${_fmt(widget.remaining)} more. Your ${order.paymentFrequency.toLowerCase()} contributions will continue on the new product."),

              const SizedBox(height: 20),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                    labelText: "4-digit PIN",
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    counterText: "",
                    errorText: _pinError),
                onChanged: (_) {
                  if (_pinError != null) setState(() => _pinError = null);
                },
              ),
              const SizedBox(height: 6),
              Text(lang.demoPIN,
                  style: const TextStyle(
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
                      style: const TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: ElevatedButton(
                        onPressed: _confirm,
                        style: ElevatedButton.styleFrom(
                            minimumSize: const Size(0, 50)),
                        child: Text(lang.confirm))),
              ]),

              // ── Review state ─────────────────────────────────────────────
            ] else ...[
              Text(lang.exchangeProduct,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(
                "Your accumulated funds (${_fmt(widget.accumulated)}) and ${order.paymentFrequency.toLowerCase()} payment frequency will transfer to the new product.",
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),

              // Product comparison card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  Row(children: [
                    Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: order.product.color,
                            borderRadius: BorderRadius.circular(10)),
                        child: Icon(order.product.icon,
                            color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          const Text("Current",
                              style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                  fontWeight: FontWeight.w600)),
                          Text(order.product.name,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary)),
                          Text(order.product.price,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.primaryGreen)),
                        ])),
                  ]),
                  const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Row(children: [
                        Expanded(child: Divider()),
                        Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Icon(Icons.swap_vert_rounded,
                                color: AppColors.primaryGreen, size: 20)),
                        Expanded(child: Divider()),
                      ])),
                  Row(children: [
                    Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: newProduct.color,
                            borderRadius: BorderRadius.circular(10)),
                        child: Icon(newProduct.icon,
                            color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(lang.newLabel,
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.primaryGreen,
                                  fontWeight: FontWeight.w600)),
                          Text(newProduct.name,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary)),
                          Text(newProduct.price,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.primaryGreen)),
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
                  border: Border.all(
                      color: AppColors.primaryGreen.withOpacity(0.25)),
                ),
                child: Column(children: [
                  _summaryRow(
                      Icons.savings_outlined,
                      "Accumulated funds transferred",
                      _fmt(widget.accumulated),
                      AppColors.primaryGreen),
                  if (widget.willComplete && widget.overpayPreview > 0) ...[
                    const SizedBox(height: 8),
                    _summaryRow(
                        Icons.account_balance_wallet_outlined,
                        "Excess refunded to wallet",
                        _fmt(widget.overpayPreview),
                        AppColors.primaryGreen),
                  ],
                  if (!widget.willComplete) ...[
                    const SizedBox(height: 8),
                    _summaryRow(
                        Icons.payments_outlined,
                        "Remaining to contribute",
                        _fmt(widget.remaining),
                        const Color(0xFFF57C00)),
                  ],
                  const SizedBox(height: 8),
                  _summaryRow(Icons.repeat_rounded, "Payment frequency kept",
                      order.paymentFrequency, AppColors.textSecondary),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome callout
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(
                    Icons.verified_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    "Order will be marked complete immediately. ${_fmt(widget.overpayPreview)} refunded to your wallet.")
              else if (widget.willComplete)
                _infoBanner(
                    Icons.verified_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    "Your funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(
                    Icons.info_outline_rounded,
                    const Color(0xFFF57C00),
                    const Color(0xFFFFF3E0),
                    "${_fmt(widget.remaining)} left to pay. Continue your ${order.paymentFrequency.toLowerCase()} contributions — no new plan needed."),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => setState(() => _showPin = true),
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52)),
                child: Text(lang.continueToPIN),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoBanner(
      IconData icon, Color iconColor, Color bgColor, String text) {
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
        Expanded(
            child:
                Text(text, style: TextStyle(fontSize: 12, color: iconColor))),
      ]),
    );
  }

  Widget _summaryRow(
      IconData icon, String label, String value, Color valueColor) {
    return Row(children: [
      Icon(icon, size: 15, color: AppColors.primaryGreen),
      const SizedBox(width: 8),
      Expanded(
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary))),
      Text(value,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700, color: valueColor)),
    ]);
  }
}

class _HistoryDeliverySheet extends StatefulWidget {
  final ConfirmedOrder order;
  final VoidCallback? onDeliveryConfirmed;
  const _HistoryDeliverySheet({required this.order, this.onDeliveryConfirmed});

  @override
  State<_HistoryDeliverySheet> createState() => _HistoryDeliverySheetState();
}

class _HistoryDeliverySheetState extends State<_HistoryDeliverySheet> {
  final _lastNameCtrl = TextEditingController(); // Nom
  final _firstNameCtrl = TextEditingController(); // Prénom
  final _phoneCtrl = TextEditingController(); // Tel
  final _residenceCtrl = TextEditingController(); // Lieu résidence
  final _deliveryLocationCtrl = TextEditingController(); // Lieu livraison
  final _colorCtrl = TextEditingController(); // Couleur
  final _shoeSizeCtrl = TextEditingController(); // Pointure
  final _professionCtrl = TextEditingController(); // Profession
  final _cniCtrl = TextEditingController(); // CNI
  final _pinCtrl = TextEditingController();
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
    _lastNameCtrl.dispose();
    _firstNameCtrl.dispose();
    _phoneCtrl.dispose();
    _residenceCtrl.dispose();
    _deliveryLocationCtrl.dispose();
    _colorCtrl.dispose();
    _shoeSizeCtrl.dispose();
    _professionCtrl.dispose();
    _cniCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  bool get _allFilled =>
      _lastNameCtrl.text.trim().isNotEmpty &&
      _firstNameCtrl.text.trim().isNotEmpty &&
      _phoneCtrl.text.trim().isNotEmpty &&
      _residenceCtrl.text.trim().isNotEmpty &&
      _deliveryLocationCtrl.text.trim().isNotEmpty &&
      _professionCtrl.text.trim().isNotEmpty &&
      _cniCtrl.text.trim().isNotEmpty;

  void _submitForm() {
    final lang = LanguageProvider.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_deliveryTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(lang.pleaseSelectDeliveryTime),
            backgroundColor: AppColors.warning),
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
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: const [
                  Icon(Icons.check_circle_rounded,
                      color: Colors.white, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Delivery request received!',
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
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: _step == 'receipt'
            ? _HistoryReceiptView(
                order: widget.order,
                name:
                    '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
                phone: _phoneCtrl.text.trim(),
                profession: _professionCtrl.text.trim(),
                idFrontPhoto: _idFrontPhoto,
                idBackPhoto: _idBackPhoto,
                neighbourhood: _residenceCtrl.text.trim(),
                city: _deliveryLocationCtrl.text.trim(),
                deliveryTime: _deliveryTime,
                color: _colorCtrl.text.trim(),
                shoeSize: _shoeSizeCtrl.text.trim(),
                cni: _cniCtrl.text.trim(),
              )
            : _step == 'pin'
                ? _HistoryDeliveryPinStep(
                    pinCtrl: _pinCtrl,
                    pinError: _pinError,
                    name:
                        '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
                    phone: _phoneCtrl.text.trim(),
                    productName: widget.order.product.name,
                    onConfirm: _confirmPin,
                    onBack: () => setState(() {
                      _step = 'form';
                      _pinError = null;
                      _pinCtrl.clear();
                    }),
                    onChanged: (_) {
                      if (_pinError != null) setState(() => _pinError = null);
                    },
                  )
                : _HistoryDeliveryForm(
                    formKey: _formKey,
                    lastNameCtrl: _lastNameCtrl,
                    firstNameCtrl: _firstNameCtrl,
                    phoneCtrl: _phoneCtrl,
                    residenceCtrl: _residenceCtrl,
                    deliveryLocationCtrl: _deliveryLocationCtrl,
                    colorCtrl: _colorCtrl,
                    shoeSizeCtrl: _shoeSizeCtrl,
                    professionCtrl: _professionCtrl,
                    cniCtrl: _cniCtrl,
                    idFrontPhoto: _idFrontPhoto,
                    idBackPhoto: _idBackPhoto,
                    onIdFrontCapture: () =>
                        setState(() => _idFrontPhoto = 'front_captured'),
                    onIdBackCapture: () =>
                        setState(() => _idBackPhoto = 'back_captured'),
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
                      if (picked != null)
                        setState(() => _deliveryTime = picked);
                    },
                    onSubmit: _submitForm,
                  ),
      ),
    );
  }
}

// ── Delivery form ──────────────────────────────────────────────────────────
class _HistoryDeliveryForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController lastNameCtrl,
      firstNameCtrl,
      phoneCtrl,
      residenceCtrl,
      deliveryLocationCtrl,
      colorCtrl,
      shoeSizeCtrl,
      professionCtrl,
      cniCtrl;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final VoidCallback onIdFrontCapture;
  final VoidCallback onIdBackCapture;
  final TimeOfDay? deliveryTime;
  final bool allFilled;
  final VoidCallback onFieldChanged, onSubmit;
  final VoidCallback onDeliveryTimePick;

  const _HistoryDeliveryForm({
    required this.formKey,
    required this.lastNameCtrl,
    required this.firstNameCtrl,
    required this.phoneCtrl,
    required this.residenceCtrl,
    required this.deliveryLocationCtrl,
    required this.colorCtrl,
    required this.shoeSizeCtrl,
    required this.professionCtrl,
    required this.cniCtrl,
    required this.idFrontPhoto,
    required this.idBackPhoto,
    required this.onIdFrontCapture,
    required this.onIdBackCapture,
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
          Center(
              child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.local_shipping_outlined,
                  color: AppColors.primaryGreen, size: 22),
            ),
            const SizedBox(width: 12),
            Text(lang.deliveryInformation,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
          ]),
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.only(left: 54),
            child: Text('Confirmez vos informations de livraison.',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 22),

          // Nom (Last Name)
          _fieldLabel('NOM'),
          const SizedBox(height: 6),
          TextFormField(
            controller: lastNameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Nom',
                hintText: 'e.g. Mbarga',
                prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Le nom est requis' : null,
          ),
          const SizedBox(height: 14),

          // Prénom (First Name)
          _fieldLabel('PRÉNOM'),
          const SizedBox(height: 6),
          TextFormField(
            controller: firstNameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Prénom',
                hintText: 'e.g. Jean-Paul',
                prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Le prénom est requis' : null,
          ),
          const SizedBox(height: 14),

          // Tel (Phone Number)
          _fieldLabel('TEL'),
          const SizedBox(height: 6),
          TextFormField(
            controller: phoneCtrl,
            keyboardType: TextInputType.phone,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Téléphone',
              hintText: 'e.g. +237 6XX XXX XXX',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le numéro de téléphone est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Lieu résidence
          _fieldLabel('LIEU RÉSIDENCE'),
          const SizedBox(height: 6),
          TextFormField(
            controller: residenceCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Lieu de résidence',
                hintText: 'e.g. Bastos, Yaoundé',
                prefixIcon: Icon(Icons.home_outlined)),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le lieu de résidence est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Lieu livraison
          _fieldLabel('LIEU LIVRAISON'),
          const SizedBox(height: 6),
          TextFormField(
            controller: deliveryLocationCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Lieu de livraison',
                hintText: 'e.g. Carrefour Nlongkak',
                prefixIcon: Icon(Icons.location_on_outlined)),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le lieu de livraison est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Couleur
          _fieldLabel('COULEUR'),
          const SizedBox(height: 6),
          TextFormField(
            controller: colorCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Couleur souhaitée',
              hintText: 'e.g. Noir, Blanc, Rouge…',
              prefixIcon: Icon(Icons.color_lens_outlined),
            ),
          ),
          const SizedBox(height: 14),

          // Pointure
          _fieldLabel('POINTURE'),
          const SizedBox(height: 6),
          TextFormField(
            controller: shoeSizeCtrl,
            keyboardType: TextInputType.number,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Pointure',
              hintText: 'e.g. 42, 38…',
              prefixIcon: Icon(Icons.straighten_outlined),
            ),
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
              labelText: 'Profession',
              hintText: 'e.g. Ingénieur, Enseignant, Commerçant…',
              prefixIcon: Icon(Icons.work_outline_rounded),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'La profession est requise'
                : null,
          ),
          const SizedBox(height: 14),

          // CNI
          _fieldLabel('CNI'),
          const SizedBox(height: 6),
          TextFormField(
            controller: cniCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Numéro CNI',
              hintText: 'e.g. 123456789',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le numéro CNI est requis'
                : null,
          ),
          const SizedBox(height: 18),

          // ID Card Photos (optional)
          Row(children: [
            const Icon(Icons.badge_outlined,
                size: 16, color: AppColors.primaryGreen),
            const SizedBox(width: 6),
            const Text('PHOTO CNI',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('OPTIONNEL',
                  style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryGreen,
                      letterSpacing: 0.5)),
            ),
          ]),
          const SizedBox(height: 8),
          const Text(
            'Joindre une photo de votre carte nationale d\'identité (recto et verso).',
            style: TextStyle(
                fontSize: 12, color: AppColors.textSecondary, height: 1.4),
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
                      color: idFrontPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idFrontPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idFrontPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idFrontPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idFrontPhoto != null
                            ? 'Recto capturé ✓'
                            : 'Capturer\nRECTO',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idFrontPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
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
                      color: idBackPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idBackPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idBackPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idBackPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idBackPhoto != null
                            ? 'Verso capturé ✓'
                            : 'Capturer\nVERSO',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idBackPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
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

          // Delivery Time
          _fieldLabel('HEURE DE LIVRAISON'),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: onDeliveryTimePick,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: deliveryTime != null
                      ? AppColors.primaryGreen
                      : const Color(0xFFD0E8E5),
                  width: deliveryTime != null ? 2 : 1,
                ),
              ),
              child: Row(children: [
                const Icon(Icons.access_time_rounded,
                    color: AppColors.primaryGreen, size: 20),
                const SizedBox(width: 12),
                Expanded(
                    child: Text(
                  deliveryTime != null
                      ? 'Livraison à ${deliveryTime!.format(context)}'
                      : 'Sélectionner l\'heure de livraison',
                  style: TextStyle(
                      fontSize: 14,
                      color: deliveryTime != null
                          ? AppColors.textPrimary
                          : AppColors.textMuted),
                )),
                Icon(Icons.keyboard_arrow_down_rounded,
                    color: deliveryTime != null
                        ? AppColors.primaryGreen
                        : AppColors.textMuted),
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
      style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1));
}

// ── Delivery PIN step ──────────────────────────────────────────────────────
class _HistoryDeliveryPinStep extends StatelessWidget {
  final TextEditingController pinCtrl;
  final String? pinError;
  final String name, phone, productName;
  final VoidCallback onConfirm, onBack;
  final ValueChanged<String> onChanged;

  const _HistoryDeliveryPinStep({
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
        Center(
            child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 20),
        Text(lang.confirmDeliveryBtn,
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text(lang.confirmDeliveryPINDesc,
            style: TextStyle(
                fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
        const SizedBox(height: 20),

        // Summary tile
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: AppColors.offWhite,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.divider)),
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
        Text(lang.demoPIN,
            style: TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
                fontStyle: FontStyle.italic)),
        const SizedBox(height: 20),

        Row(children: [
          Expanded(
              child: OutlinedButton(
            onPressed: onBack,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 50),
              side: const BorderSide(color: AppColors.divider),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.back,
                style: TextStyle(color: AppColors.textSecondary)),
          )),
          const SizedBox(width: 12),
          Expanded(
              child: ElevatedButton(
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
      Text('$label: ',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      Expanded(
          child: Text(value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary))),
    ]);
  }
}

// ── Receipt view ───────────────────────────────────────────────────────────
class _HistoryReceiptView extends StatelessWidget {
  final ConfirmedOrder order;
  final String name, phone, profession, neighbourhood, city;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final TimeOfDay? deliveryTime;
  final String color;
  final String shoeSize;
  final String cni;

  const _HistoryReceiptView(
      {required this.order,
      required this.name,
      required this.phone,
      required this.profession,
      required this.idFrontPhoto,
      required this.idBackPhoto,
      required this.neighbourhood,
      required this.city,
      required this.deliveryTime,
      this.color = '',
      this.shoeSize = '',
      this.cni = ''});

  String _fmt(int v) {
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  String get _receiptId {
    final rand = Random(order.orderNumber.hashCode);
    return 'RCP-${rand.nextInt(900000) + 100000}';
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

  String get _today {
    final d = DateTime.now();
    return '${d.day} ${_monthName(d.month)} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final totalPaid = order.totalAmountPaid;
    final grandTotal = order.basePrice + order.fee;
    final remaining = grandTotal - totalPaid;

    return Column(
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
                child: const Icon(Icons.local_shipping_rounded,
                    color: AppColors.primaryGreen, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your details have been received!',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryGreen),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Thank you! Your delivery request is confirmed. You will receive your product shortly.',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        Row(children: [
          Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.receipt_long_rounded,
                  color: AppColors.primaryGreen, size: 24)),
          const SizedBox(width: 14),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.deliveryReceipt,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            Text(_receiptId,
                style:
                    const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ]),
        ]),
        const SizedBox(height: 20),

        Container(
          decoration: BoxDecoration(
              color: AppColors.offWhite,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider)),
          child: Column(children: [
            _section('INFORMATIONS CLIENT', [
              _rRow('Nom & Prénom', name),
              _rRow('Tél', phone),
              _rRow('Lieu résidence', neighbourhood),
              _rRow('Lieu livraison', city),
              if (color.isNotEmpty) _rRow('Couleur', color),
              if (shoeSize.isNotEmpty) _rRow('Pointure', shoeSize),
              _rRow('Profession', profession),
              _rRow('CNI', cni.isNotEmpty ? cni : '—'),
              _rRow('Photo CNI Recto',
                  idFrontPhoto != null ? '✓ Capturé' : 'Non fourni'),
              _rRow('Photo CNI Verso',
                  idBackPhoto != null ? '✓ Capturé' : 'Non fourni'),
              _rRow('Heure livraison',
                  deliveryTime != null ? deliveryTime!.format(context) : '—'),
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
              _rRow('Service Fee', _fmt(order.fee)),
              _rRow('Payment Plan', order.planDurationLabel),
              _rRow('Frequency', order.paymentFrequency),
              _rRow('Contributions Made',
                  '${order.paidInstallments.length}/${order.totalInstallments}'),
              _rRow('Accumulated Funds', _fmt(order.accumulatedFunds)),
              if (remaining > 0) _rRow('Remaining', _fmt(remaining)),
            ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                borderRadius:
                    const BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(lang.totalOrderValue,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary,
                            letterSpacing: 0.5)),
                    Text(_fmt(grandTotal),
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen)),
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
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              content: Row(children: [
                Icon(Icons.download_done_rounded,
                    color: Colors.white, size: 20),
                SizedBox(width: 10),
                Text(lang.receiptDownloaded,
                    style: TextStyle(
                        fontWeight: FontWeight.w600, color: Colors.white)),
              ]),
            ));
          },
          icon: const Icon(Icons.download_rounded, size: 20),
          label: Text(lang.downloadReceipt),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(lang.close,
              style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
        ),
      ],
    );
  }

  Widget _section(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1)),
        const SizedBox(height: 10),
        ...rows,
      ]),
    );
  }

  Widget _rRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 130,
            child: Text(label,
                style:
                    const TextStyle(fontSize: 13, color: AppColors.textMuted))),
        Expanded(
            child: Text(value,
                textAlign: TextAlign.end,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary))),
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
    '655000001',
    '655000002',
    '677000001',
    '699000001',
    '620000001',
    '690000001',
  };
  static const _validPin = '1234';

  // 0 = phone entry  |  1 = PIN confirm  |  2 = success
  int _step = 0;

  final _phoneCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  String? _phoneError;
  String? _pinError;
  bool _unverified = false;

  int get _accumulated => widget.sourceOrder.totalAmountPaid;
  int get _deduction => (_accumulated * 0.20).round();
  int get _netAmount => _accumulated - _deduction;

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
        width: 40,
        height: 4,
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
            border:
                Border.all(color: const Color(0xFF607D8B).withOpacity(0.20)),
          ),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.accumulatedFundsLabel,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(_fmt(_accumulated),
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF607D8B))),
            ]),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.serviceFee20,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text('− ${_fmt(_deduction)}',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFE53935))),
            ]),
            const Divider(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.recipientReceives,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(_fmt(_netAmount),
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
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
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF607D8B).withOpacity(0.10),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.phone_android_rounded,
                    color: Color(0xFF607D8B), size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.transferToWatsim,
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  SizedBox(height: 2),
                  Text(lang.sendAccumulatedFunds,
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
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
                child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded,
                          color: Color(0xFFF57C00), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                          child: Text(
                        'No payments made yet. Make at least one instalment before transferring.',
                        style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFFF57C00),
                            height: 1.4),
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
                    setState(() {
                      _phoneError = null;
                      _unverified = false;
                    });
                  }
                },
              ),
              const SizedBox(height: 6),
              const Text(
                'Demo verified numbers: 655000001 · 677000001 · 699000001',
                style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
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
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            color: Color(0xFFE53935), size: 22),
                        SizedBox(width: 10),
                        Expanded(
                            child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(lang.noWatsimAccount,
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFFB71C1C))),
                            SizedBox(height: 4),
                            Text(
                              'This number does not have a verified WatSim account. '
                              'Check the number or ask the recipient to register on WatSim.',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFFE53935),
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
                      setState(
                          () => _phoneError = 'Please enter a phone number.');
                      return;
                    }
                    if (phone.length < 8) {
                      setState(
                          () => _phoneError = 'Enter a valid phone number.');
                      return;
                    }
                    if (!_verifiedNumbers.contains(phone)) {
                      setState(() {
                        _phoneError = null;
                        _unverified = true;
                      });
                      return;
                    }
                    setState(() {
                      _unverified = false;
                      _phoneError = null;
                      _step = 1;
                    });
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
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            Text(
              'Enter your 4-digit PIN to send ${_fmt(_netAmount)} '
              'to ${_phoneCtrl.text.trim()}.',
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary, height: 1.4),
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
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.fromLabel,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(widget.sourceOrder.product.name,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                    ]),
                const SizedBox(height: 8),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.toWatsim,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(_phoneCtrl.text.trim(),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                    ]),
                const Divider(height: 16),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.grossAmount,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(_fmt(_accumulated),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary)),
                    ]),
                const SizedBox(height: 6),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.serviceFee20,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text('− ${_fmt(_deduction)}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFE53935))),
                    ]),
                const Divider(height: 12),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.recipientReceives,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(_fmt(_netAmount),
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
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
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: (_) {
                if (_pinError != null) setState(() => _pinError = null);
              },
            ),
            const SizedBox(height: 6),
            Text(lang.demoPIN,
                style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontStyle: FontStyle.italic)),
            const SizedBox(height: 20),

            Row(children: [
              Expanded(
                  child: OutlinedButton(
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
              Expanded(
                  child: ElevatedButton(
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
              width: 80,
              height: 80,
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
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            Text(
              '${_fmt(_netAmount)} has been sent to\n'
              '${_phoneCtrl.text.trim()}\'s WatSim wallet.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary, height: 1.5),
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
                Flexible(
                    child: Text(
                  '20% service fee of ${_fmt(_deduction)} was deducted '
                  'from your accumulated funds.',
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFFF57C00), height: 1.4),
                )),
              ]),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context); // close sheet
                  widget.onTransferred(); // pop detail screen
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
                      child: const Icon(Icons.account_balance_wallet_outlined,
                          size: 36, color: const Color(0xFFF57C00))),
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
                  Text(
                      '${lang.newBalanceLabel}: ${WalletState.instance.balanceFormatted}',
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
              const Text('Enter your 4-digit PIN to confirm the withdrawal.',
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
                    border: Border.all(color: const Color(0xFFFFB74D))),
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
                  _summaryRow('Instalments Paid',
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
                onPressed: _accumulated > 0
                    ? () => setState(() => _showPin = true)
                    : null,
                icon: const Icon(Icons.lock_outline_rounded, size: 18),
                label: Text(lang.continueToPIN),
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF57C00)),
              ),
              if (_accumulated == 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFB74D))),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Icon(Icons.info_outline_rounded,
                          color: Color(0xFFF57C00), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'No payments have been made yet. Make at least one instalment to enable withdrawal.',
                          style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFFF57C00),
                              height: 1.4),
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
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
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
        Icon(Icons.check_circle_rounded,
            color: AppColors.primaryGreen, size: 28),
        SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.allInstalmentsPaid,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryGreen)),
          SizedBox(height: 2),
          Text(lang.orderFullySettled,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
    );
  }
}

// ── Delivery Requested banner ──────────────────────────────────────────────
