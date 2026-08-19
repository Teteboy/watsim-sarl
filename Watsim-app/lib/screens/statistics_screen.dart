import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/language_service.dart';
import '../theme/app_theme.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  bool _loading = true;
  Map<String, dynamic>? _stats;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final stats = await ApiService.fetchStatistics();
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  int _int(dynamic v) {
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    return 0;
  }

  String _fmt(dynamic v) {
    final n = _int(v);
    if (n < 1000) return '$n';
    final k = n ~/ 1000;
    final r = (n % 1000).toString().padLeft(3, '0');
    return '$k,$r';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        foregroundColor: Colors.white,
        title: Text(lang.statisticsTitle),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(lang.errorGeneric, style: const TextStyle(color: AppColors.error)),
                      const SizedBox(height: 8),
                      Text(_error!, textAlign: TextAlign.center),
                      TextButton.icon(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh),
                        label: Text(lang.retry),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _sectionTitle(lang.walletStatistics),
                        _cardWrap([
                          _statTile(lang.currentBalance, '${_fmt(_stats?['wallet']?['balance'])} FCFA'),
                          _statTile(lang.totalDeposited, '${_fmt(_stats?['transactions']?['totalDeposited'])} FCFA'),
                          _statTile(lang.totalWithdrawn, '${_fmt(_stats?['transactions']?['totalWithdrawn'])} FCFA'),
                        ]),
                        _sectionTitle(lang.transferStatistics),
                        _cardWrap([
                          _statTile(lang.totalTransferredIn, '${_fmt(_stats?['transactions']?['totalTransferredIn'])} FCFA'),
                          _statTile(lang.totalTransferredOut, '${_fmt(_stats?['transactions']?['totalTransferredOut'])} FCFA'),
                        ]),
                        _sectionTitle(lang.orderStatistics),
                        _cardWrap([
                          _statTile(lang.totalOrders, '${_int(_stats?['orders']?['totalOrders'])}'),
                          _statTile(lang.completedOrders, '${_int(_stats?['orders']?['completedOrders'])}'),
                          _statTile(lang.activeOrders, '${_int(_stats?['orders']?['activeOrders'])}'),
                          _statTile(lang.totalOrderValue, '${_fmt(_stats?['orders']?['totalOrderValue'])} FCFA'),
                          _statTile(lang.totalPaidOnOrders, '${_fmt(_stats?['orders']?['totalPaidOnOrders'])} FCFA'),
                          _statTile(lang.remainingOnOrders, '${_fmt(_stats?['orders']?['remainingOnOrders'])} FCFA'),
                        ]),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _cardWrap(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Wrap(
        spacing: 16,
        runSpacing: 16,
        children: children,
      ),
    );
  }

  Widget _statTile(String label, String value) {
    return SizedBox(
      width: MediaQuery.of(context).size.width / 2 - 40,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
