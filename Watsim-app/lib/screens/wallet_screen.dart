import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../wallet_state.dart';
import '../main.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import 'deposit_screen.dart';
import 'history_screen.dart';
import 'messaging_screen.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  String _filter = 'All';
  bool _showAll = false;
  bool _balanceVisible = true;
  Map<String, dynamic>? _profile;
  bool _loadingProfile = true;

  static const _filters = ['All', 'Deposits', 'Withdrawals', 'BNPL'];
  static const _previewCount = 4;

  @override
  void initState() {
    super.initState();
    WalletState.instance.addListener(_onWalletChange);
    _loadProfile();
    // Sync wallet and transactions from backend on every open
    WalletState.instance.syncWithBackend();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await ApiService.fetchProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _loadingProfile = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingProfile = false);
      }
    }
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

  String _getInitials() {
    if (_profile == null) return '?';
    final name = _profile!['fullName'] as String? ?? 
                 _profile!['name'] as String? ?? 
                 _profile!['email'] as String? ?? 
                 _profile!['phone'] as String? ?? 
                 '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (parts.isNotEmpty && parts[0].isNotEmpty) {
      return parts[0][0].toUpperCase();
    }
    return '?';
  }

  List<WalletTransaction> get _filtered {
    final all = WalletState.instance.transactions;
    switch (_filter) {
      case 'Deposits':
        return all.where((t) => t.type == TxType.deposit).toList();
      case 'Withdrawals':
        return all.where((t) => t.type == TxType.withdrawal).toList();
      case 'BNPL':
        return all.where((t) => t.type == TxType.bnpl).toList();
      default:
        return all;
    }
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
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month]} ${dt.day}, ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final filtered = _filtered;
    final hasMore = !_showAll && filtered.length > _previewCount;
    final visible = _showAll ? filtered : filtered.take(_previewCount).toList();
    final filterLabels = [lang.filterAll, lang.filterDeposits, lang.filterWithdrawals, lang.filterBNPL];
    final filterKeys = ['All', 'Deposits', 'Withdrawals', 'BNPL'];

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primaryGreen.withOpacity(0.2),
            backgroundImage: (!_loadingProfile && _profile?['imageUrl'] != null && _profile!['imageUrl'].toString().isNotEmpty)
              ? NetworkImage(ApiService.resolveImageUrl(_profile!['imageUrl'].toString()))
              : null,
            child: _loadingProfile
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primaryGreen,
                  ),
                )
              : (_profile?['imageUrl'] == null || _profile!['imageUrl'].toString().isEmpty)
                ? Text(
                    _getInitials(),
                    style: const TextStyle(
                      color: AppColors.primaryGreen,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : null,
          ),
        ),
        leadingWidth: 54,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _loadingProfile
                ? 'Hello'
                : '${(_profile?['fullName'] ?? _profile?['name'] ?? 'Guest')}',
              style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600)),
            Text(
              _loadingProfile
                ? 'Loading...'
                : '${(_profile?['phone'] ?? _profile?['email'] ?? '@guest')}',
              style: const TextStyle(
                  color: Colors.white54,
                  fontSize: 12,
                  fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white, size: 24),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const MessagingScreen())),
          ),
        ],
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: -1,
        onTap: (i) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => MainShell(initialIndex: i)),
            (route) => false,
          );
        },
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Balance ──────────────────────────────────────────────────────
            Center(
              child: Column(
                children: [
                  Text(lang.totalBalance,
                      style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                          letterSpacing: 1.5,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(
                          _balanceVisible
                              ? WalletState.instance.balanceFormatted
                              : '••••••••',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary),
                        ),
                      ),
                      const SizedBox(width: 10),
                      GestureDetector(
                        onTap: () => setState(() => _balanceVisible = !_balanceVisible),
                        child: Icon(
                          _balanceVisible
                              ? Icons.remove_red_eye_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.textMuted,
                          size: 22,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.trending_up_rounded, color: AppColors.primaryGreen, size: 16),
                      const SizedBox(width: 4),
                      Text(lang.growthThisMonth,
                          style: const TextStyle(
                              color: AppColors.primaryGreen,
                              fontSize: 13,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Add from Wallet ───────────────────────────────────────────────
            AppCard(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.account_balance_wallet_rounded,
                        color: AppColors.primaryGreen, size: 26),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Add from Wallet',
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 3),
                        Text(lang.topUpWalletInstantly,
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const DepositScreen())),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 10),
                      decoration: BoxDecoration(
                          color: AppColors.primaryGreen,
                          borderRadius: BorderRadius.circular(12)),
                      child: Text(lang.deposit,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Transactions header ──────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(lang.transactions,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                TextButton(
                  onPressed: () => Navigator.push(
                      context, MaterialPageRoute(builder: (_) => const HistoryScreen())),
                  child: Text(lang.viewAll,
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryGreen)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // ── Filter chips ─────────────────────────────────────────────────
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: List.generate(filterKeys.length, (idx) {
                  final key = filterKeys[idx];
                  final label = filterLabels[idx];
                  final sel = key == _filter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _filter = key;
                        _showAll = false;
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: sel ? AppColors.primaryGreen : AppColors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: sel ? AppColors.primaryGreen : const Color(0xFFD0E8E5)),
                        ),
                        child: Text(label,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: sel ? Colors.white : AppColors.textSecondary)),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 12),

            // ── Transaction list or empty state ──────────────────────────────
            filtered.isEmpty
                ? _buildEmptyState(lang)
                : AppCard(
                    child: Column(
                      children: [
                        ...List.generate(visible.length, (i) {
                          final tx = visible[i];
                          final color = _colorFor(tx);
                          return Column(
                            children: [
                              if (i > 0) const Divider(height: 1),
                              TransactionRow(
                                icon: _iconFor(tx),
                                iconColor: color,
                                iconBg: color.withOpacity(0.1),
                                title: tx.title,
                                subtitle: _formatDate(tx.date),
                                amount: tx.amountFormatted,
                                isCredit: tx.isCredit,
                                tag: tx.tag,
                              ),
                            ],
                          );
                        }),

                        // Show More
                        if (hasMore) ...[
                          const Divider(height: 1),
                          InkWell(
                            onTap: () => setState(() => _showAll = true),
                            borderRadius:
                                const BorderRadius.vertical(bottom: Radius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Show ${filtered.length - _previewCount} more',
                                    style: const TextStyle(
                                        color: AppColors.primaryGreen,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.keyboard_arrow_down_rounded,
                                      color: AppColors.primaryGreen, size: 18),
                                ],
                              ),
                            ),
                          ),
                        ],

                        // Show Less
                        if (_showAll && filtered.length > _previewCount) ...[
                          const Divider(height: 1),
                          InkWell(
                            onTap: () => setState(() => _showAll = false),
                            borderRadius:
                                const BorderRadius.vertical(bottom: Radius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(lang.showLess,
                                      style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600)),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.keyboard_arrow_up_rounded,
                                      color: AppColors.textMuted, size: 18),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(LanguageService lang) {
    final isFiltered = _filter != 'All';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8F4F2)),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isFiltered ? Icons.filter_list_off_rounded : Icons.receipt_long_rounded,
              color: AppColors.primaryGreen,
              size: 30,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            lang.noTransactionsYet,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            isFiltered
                ? 'Try a different filter to see your history.'
                : 'Make your deposit now so you can\nsee your history here.',
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary, height: 1.5),
          ),
          if (!isFiltered) ...[
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () => Navigator.push(
                  context, MaterialPageRoute(builder: (_) => const DepositScreen())),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                decoration: BoxDecoration(
                    color: AppColors.primaryGreen, borderRadius: BorderRadius.circular(10)),
                child: Text(lang.makeDeposit,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ],
      ),
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
