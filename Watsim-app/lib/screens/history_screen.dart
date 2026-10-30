import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/order_sheets.dart';
import '../widgets/shared_widgets.dart';
import '../wallet_state.dart';
import '../notification_state.dart';
import '../order_state.dart';
import '../services/language_service.dart';
import 'deposit_screen.dart';
import 'catalogue_screen.dart';
import '../services/api_service.dart';
import '../widgets/transaction_detail_sheet.dart';
import '../widgets/pin_confirm_dialog.dart';

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
          tabs: [
            Tab(text: lang.transactions),
            Tab(text: lang.orderStatistics),
            Tab(text: lang.statisticsTitle)
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
    final lang = LanguageService();
    if (diff == 0) {
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '${lang.today}, $h:$m';
    } else if (diff == 1) {
      return lang.yesterday;
    }
    return '${lang.monthAbbr(dt.month)} ${dt.day}, ${dt.year}';
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
    final statusFilterLabels = [
      lang.filterAll,
      lang.pendingLabel,
      lang.tabCompleted
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
                final label = statusFilterLabels[idx];
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
                  child: _summaryChip('+${_fmt(totalReceived)}',
                      lang.receivedLabel, AppColors.primaryGreen),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _summaryChip(
                      '-${_fmt(totalSpent)}', lang.spentLabel, AppColors.error),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _summaryChip(
                      _fmt(net.abs()), lang.netLabel, AppColors.deepTeal),
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
              Text(
                lang.browseOrdersBody,
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
                  ? lang.noTxMatchFilters
                  : lang.noTransactionsYet,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              isFiltered
                  ? lang.tryDifferentFilter
                  : lang.firstDepositBody,
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
            lang.thisWeek,
            today.subtract(Duration(days: today.weekday - 1)),
            today
          ),
          (lang.thisMonth, DateTime(now.year, now.month, 1), today),
          (lang.last3Months, DateTime(now.year, now.month - 2, 1), today),
          (lang.thisYear, DateTime(now.year, 1, 1), today),
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
                title: Text(lang.clearFilter,
                    style: const TextStyle(color: AppColors.primaryGreen)),
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

  String _periodLabel(String key, LanguageService lang) {
    switch (key) {
      case 'Week':
        return lang.periodWeek;
      case 'Quarter':
        return lang.periodQuarter;
      case 'Year':
        return lang.periodYear;
      default:
        return lang.periodMonth;
    }
  }

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
    final Map<int, double> byMonth = {};
    for (final t in txs) {
      if (!t.isCredit) {
        byMonth[t.date.month] = (byMonth[t.date.month] ?? 0) + t.amount / 1000.0;
      }
    }
    final lang = LanguageService();
    return byMonth.entries
        .map((e) => _MonthBar(lang.monthAbbr(e.key), e.value, e.key))
        .toList()
      ..sort((a, b) => a.monthIndex.compareTo(b.monthIndex));
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
    final lang = LanguageService();
    final labels = {
      TxType.bnpl: ('BNPL', AppColors.primaryGreen),
      TxType.withdrawal: (lang.filterWithdrawals, AppColors.secondaryGreen),
      TxType.transfer: (lang.filterTransfers, AppColors.deepTeal),
    };
    return byType.entries.where((e) => labels.containsKey(e.key)).map((e) {
      final info = labels[e.key]!;
      return _Cat(info.$1, e.value / total, info.$2);
    }).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
  }

  @override
  Widget build(BuildContext context) {
    final txs = WalletState.instance.transactions;
    final hasData = txs.isNotEmpty;

    final body = hasData ? _buildStats() : _buildEmptyState();

    if (widget.embedded) return body;

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(
          title: LanguageProvider.of(context).statisticsTitle, showBack: true),
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
            Text(
              lang.statsAppearBody,
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
                        child: Text(_periodLabel(p, lang),
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
                  child: _kpiCard(lang.incomeLabel, _fmt(totalReceived),
                      AppColors.primaryGreen, Icons.trending_up_rounded)),
              const SizedBox(width: 12),
              Expanded(
                  child: _kpiCard(lang.expensesLabel, _fmtSpent(totalSpent),
                      AppColors.error, Icons.trending_down_rounded)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _kpiCard(lang.transactions, '${txs.length}',
                      AppColors.deepTeal, Icons.receipt_long_rounded)),
              const SizedBox(width: 12),
              Expanded(
                  child: _kpiCard(
                      lang.netBalance,
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

  String _fmtDate(DateTime dt) =>
      '${dt.day} ${LanguageService().monthAbbr(dt.month)} ${dt.year}';

  String _fmt(int v) =>
      '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')} FCFA';

  // ── Delivery sheet (matches order_detail_screen) ─────────────────────────
  void _showDeliveryDetails(BuildContext context) {
    final lang = LanguageProvider.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => DeliverySheet(
        extended: true,
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
                      child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: Color(0xFFF57C00), size: 20),
                            SizedBox(width: 10),
                            Expanded(
                                child: Text(
                              lang.noPaymentsMadeYet,
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
                        labelText: lang.recipientPhoneLabel,
                        hintText: lang.hintPhoneNum,
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
                    Text(
                      lang.recipientMustHaveWatsim,
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
                                    lang.noWatsimAccountBody,
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
                                phoneError = lang.enterPhoneRequired);
                            return;
                          }
                          if (phone.length < 8) {
                            setSheet(() =>
                                phoneError = lang.enterValidPhone);
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
                    lang.pinToSendAmount(
                        fmt(netAmount), phoneCtrl.text.trim()),
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
                      labelText: lang.pin4Label,
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
                          setSheet(() => pinError = lang.orderNotLinked);
                          return;
                        }
                        final phone = phoneCtrl.text
                            .trim()
                            .replaceAll(RegExp(r'[\s\-]'), '');
                        if (phone.isEmpty) {
                          setSheet(
                              () => pinError = lang.enterPhoneRequired);
                          return;
                        }
                        if (pinCtrl.text.isEmpty) {
                          setSheet(() => pinError = lang.enterPinRequired);
                          return;
                        }
                        setSheet(() => pinError = null);
                        // Verify the transaction PIN against the login PIN stored on the backend
                        final pinValid = await ApiService.verifyTransactionPin(
                          pinCtrl.text.trim(),
                        );
                        if (!pinValid) {
                          setSheet(
                            () => pinError = lang.incorrectPinFull,
                          );
                          return;
                        }
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
                          setSheet(() => pinError = lang.apiError(e));
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
                    lang.sentToWallet(
                        fmt(netAmount), phoneCtrl.text.trim()),
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
                        lang.feeDeducted20(fmt(deduction)),
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
              Text(
                lang.chargebackNote,
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
                    _sheetRow(lang.totalPaidOnOrders, _fmt(totalPaid)),
                    const Divider(height: 16),
                    _sheetRow(lang.chargeback30, '− ${_fmt(chargeback)}',
                        valueColor: AppColors.warning),
                    const Divider(height: 16),
                    _sheetRow(lang.youWillReceive, _fmt(refund),
                        valueColor: AppColors.primaryGreen),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  final confirmed = await showPinConfirmDialog(
                    context,
                    title: lang.confirmWithdrawal,
                  );
                  if (!confirmed) return;

                  if (order.id == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(lang.orderNotLinked)),
                    );
                    return;
                  }
                  Navigator.pop(context);
                  try {
                    final result = await ApiService.withdrawContribution(
                        purchaseId: order.id!);
                    await WalletState.instance.syncWithBackend();
                    if (!mounted) return;
                    setState(() => _withdrawn = true);
                    final msg = result['message'] as String?;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(msg != null
                            ? lang.translateApiMessage(msg)
                            : lang.refundedToWallet(_fmt(refund))),
                        backgroundColor: AppColors.primaryGreen,
                      ),
                    );
                  } on ApiException catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(lang.apiError(e)),
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
              builder: (_) => ExchangeConfirmSheet(
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
      statusLabel = lang.deliveredStatus;
      statusIcon = Icons.verified_rounded;
    } else if (order.deliveryRequested) {
      statusColor = const Color(0xFF1565C0);
      statusLabel = lang.deliveryRequestedTitle;
      statusIcon = Icons.local_shipping_rounded;
    } else if (isComplete) {
      statusColor = AppColors.primaryGreen;
      statusLabel = lang.tabCompleted;
      statusIcon = Icons.check_circle_rounded;
    } else {
      statusColor = AppColors.deepTeal;
      statusLabel = lang.inProgressStatus;
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
                        lang.orderedLabel,
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
                        isComplete ? lang.tabCompleted : lang.nextDueLabel,
                        isComplete
                            ? lang.allPaidCheck
                            : _fmtDate(order.nextDue),
                        statusColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _detailChip(
                        Icons.date_range_rounded,
                        lang.planLabel,
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
                          label: lang.transferLabel,
                          subtitle: lang.transferSubLabel,
                          color: const Color(0xFF1565C0),
                          onTap: () => _showTransfer(context),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _actionBtn(
                          icon: Icons.account_balance_wallet_outlined,
                          label: _withdrawn
                              ? lang.withdrawnLabel
                              : lang.withdrawLabel,
                          subtitle:
                              _withdrawn ? null : lang.withdrawSubLabel,
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
                            label: _exchangeRequested
                                ? lang.requestedLabel
                                : lang.exchangeLabel,
                            subtitle: _exchangeRequested
                                ? null
                                : lang.exchangeSubLabel,
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
                            label: _withdrawn
                                ? lang.withdrawnLabel
                                : lang.withdrawLabel,
                            subtitle:
                                _withdrawn ? null : lang.withdrawSubLabel,
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
                            label: lang.deliveryAction,
                            subtitle: lang.deliverSubLabel,
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

class _Cat {
  final String name;
  final double value;
  final Color color;
  const _Cat(this.name, this.value, this.color);
}

class _MonthBar {
  final String label;
  final double value;
  final int monthIndex;
  const _MonthBar(this.label, this.value, [this.monthIndex = 0]);
}

int _parseHistoryProductPrice(String priceStr) {
  final digits = priceStr.replaceAll(RegExp(r'[^0-9]'), '');
  return int.tryParse(digits) ?? 0;
}

// ── Delivery Requested banner ──────────────────────────────────────────────
