import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../wallet_state.dart';

// ─── Rewards Screen ────────────────────────────────────────────────────────
class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  bool _showAllCashback = false;
  bool _isLoading = true;
  bool _hasError = false;

  // Cashback amount in integer FCFA
  int _cashbackAmount = 0;
  int _pendingCashback = 0;

  List<_CashbackEntry> _allCashback = [];
  List<dynamic> _badges = [];

  @override
  void initState() {
    super.initState();
    _loadRewardsData();
  }

  Future<void> _loadRewardsData() async {
    try {
      setState(() {
        _isLoading = true;
        _hasError = false;
      });

      final results = await Future.wait([
        ApiService.fetchRewardsSummary(),
        ApiService.fetchBadges(),
      ]);

      final data = results[0];
      final badgesData = results[1];

      setState(() {
        _cashbackAmount = data['availableBalance'] ?? 0;
        _pendingCashback = data['pendingBalance'] ?? 0;

        if (data['history'] != null) {
          _allCashback = (data['history'] as List)
              .map((h) => _CashbackEntry(
                    _getIconForType(h['type']),
                    _getColorForType(h['type']),
                    h['title'] ?? 'Unknown',
                    _formatDate(h['createdAt']),
                    '+${h['amount']} FCFA',
                    h['percentage'] ?? h['type'],
                  ))
              .toList();
        }

        _badges = badgesData['badges'] ?? [];
        _isLoading = false;
      });

      // Check for new badges after loading
      await _checkAndAwardBadges();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _checkAndAwardBadges() async {
    try {
      final result = await ApiService.checkAndAwardBadges();
      if (result['count'] > 0) {
        // Refresh badges if new ones were awarded
        final badgesData = await ApiService.fetchBadges();
        setState(() {
          _badges = badgesData['badges'] ?? [];
        });
      }
    } catch (_) {
      // Silently fail - badges aren't critical
    }
  }

  IconData _getIconForType(String? type) {
    switch (type) {
      case 'REFERRAL_FIRST':
        return Icons.people_alt_rounded;
      case 'REFERRAL_SECOND':
        return Icons.shopping_bag_rounded;
      case 'BNPL_CASHBACK':
        return Icons.percent_rounded;
      case 'PURCHASE':
        return Icons.shopping_cart_rounded;
      default:
        return Icons.card_giftcard_rounded;
    }
  }

  Color _getColorForType(String? type) {
    switch (type) {
      case 'REFERRAL_FIRST':
        return AppColors.secondaryGreen;
      case 'REFERRAL_SECOND':
        return AppColors.deepTeal;
      case 'BNPL_CASHBACK':
        return AppColors.primaryGreen;
      case 'PURCHASE':
        return AppColors.warning;
      default:
        return AppColors.primaryGreen;
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return '';
    }
  }

  void _showWithdrawSheet(BuildContext context, LanguageService lang) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WithdrawBottomSheet(
        availableBalance: _cashbackAmount,
        onWithdrawSuccess: (int amount) {
          setState(() {
            _cashbackAmount -= amount;
          });
          _loadRewardsData(); // Refresh data
        },
      ),
    );
  }

  void _convertToWatsim(BuildContext context, LanguageService lang) async {
    if (_cashbackAmount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(lang.noCashbackToConvert),
        backgroundColor: AppColors.textMuted,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ));
      return;
    }

    try {
      await ApiService.convertRewardsToWallet(_cashbackAmount);

      // Add to wallet state
      WalletState.instance.topUp(_cashbackAmount, operator: 'Cashback Rewards');

      final int converted = _cashbackAmount;

      // Zero out cashback
      setState(() {
        _cashbackAmount = 0;
      });

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Row(children: [
          const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${_fmt(converted)} FCFA ${lang.addedToWallet}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ]),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(lang.isFrench
            ? 'Erreur lors de la conversion. Réessayez.'
            : 'Error converting rewards. Please try again.'),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ));
    }
  }

  String _fmt(int v) {
    final s = v.toString();
    if (s.length <= 3) return s;
    final cut = s.length % 3;
    final parts = <String>[];
    if (cut > 0) parts.add(s.substring(0, cut));
    for (int i = cut; i < s.length; i += 3) {
      parts.add(s.substring(i, i + 3));
    }
    return parts.join(',');
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final hasCashback = _cashbackAmount > 0;
    final visibleCashback =
        _showAllCashback ? _allCashback : _allCashback.take(3).toList();

    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.rewardsCashbackTitle, showBack: true),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_hasError) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.rewardsCashbackTitle, showBack: true),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                lang.isFrench
                    ? 'Erreur de chargement. Réessayez.'
                    : 'Failed to load. Please retry.',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadRewardsData,
                child: Text(lang.isFrench ? 'Réessayer' : 'Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.rewardsCashbackTitle, showBack: true),
      body: RefreshIndicator(
        onRefresh: _loadRewardsData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Balance card ─────────────────────────────────────────
              GradientCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.availableCashback,
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 6),
                          Text(
                            '${_fmt(_cashbackAmount)} FCFA',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 30,
                                fontWeight: FontWeight.w800),
                          ),
                          if (_pendingCashback > 0) ...[
                            const SizedBox(height: 4),
                            Text(
                              '${lang.isFrench ? 'En attente' : 'Pending'}: ${_fmt(_pendingCashback)} FCFA',
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 12),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Text(
                            hasCashback
                                ? lang.cashbackBreakdown
                                : (lang.isFrench
                                    ? 'Commencez à parrainer et à acheter !'
                                    : 'Start referring and shopping!'),
                            style: const TextStyle(
                                color: Colors.white60,
                                fontSize: 12,
                                height: 1.5),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.3),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.card_giftcard_rounded,
                          color: Colors.white, size: 32),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              if (hasCashback) ...[
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _convertToWatsim(context, lang),
                        icon: const Icon(Icons.account_balance_wallet_rounded,
                            size: 16),
                        label: Text(lang.isFrench
                            ? 'Ajouter au portefeuille'
                            : 'Add to Wallet'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _showWithdrawSheet(context, lang),
                        icon:
                            const Icon(Icons.account_balance_rounded, size: 16),
                        label: Text(lang.withdrawRewards),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primaryGreen,
                          side: const BorderSide(
                              color: AppColors.primaryGreen, width: 1.5),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(
                              vertical: 14, horizontal: 10),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Cashback history ─────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(lang.cashbackHistory,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary)),
                    if (_allCashback.length > 3)
                      GestureDetector(
                        onTap: () => setState(
                            () => _showAllCashback = !_showAllCashback),
                        child: Text(
                          _showAllCashback ? lang.showLess : lang.viewAll,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primaryGreen),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_allCashback.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE8F2F1)),
                    ),
                    child: Center(
                      child: Text(
                        lang.noRewardsYet,
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 14),
                      ),
                    ),
                  )
                else
                  AppCard(
                    child: Column(
                      children: visibleCashback.asMap().entries.map((e) {
                        final isLast = e.key == visibleCashback.length - 1;
                        final entry = e.value;
                        return Column(
                          children: [
                            _cashbackRow(entry.icon, entry.color, entry.title,
                                entry.date, entry.amount, entry.tag),
                            if (!isLast) const Divider(height: 1),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
              ] else ...[
                // ── Empty / converted state ────────────────────────────
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE8F2F1)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.account_balance_wallet_rounded,
                            size: 40, color: AppColors.primaryGreen),
                      ),
                      const SizedBox(height: 16),
                      Text(lang.cashbackConverted,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryGreen)),
                      const SizedBox(height: 8),
                      Text(
                        lang.noRewardsBody,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.5),
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 28, vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.warning,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.shopping_bag_rounded,
                                color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Text(lang.startShopping,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // ── Badges ─────────────────────────────────────────────
              Text(lang.myBadges,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 12),
              if (_badges.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE8F2F1)),
                  ),
                  child: Center(
                    child: Text(
                      lang.isFrench
                          ? 'Aucun badge pour le moment'
                          : 'No badges yet',
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 14),
                    ),
                  ),
                )
              else
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  children: _badges.map((badge) {
                    return _badge(
                      _getBadgeIcon(badge['icon']),
                      lang.isFrench ? badge['nameFr'] : badge['name'],
                      badge['earned'] ?? false,
                      _parseColor(badge['color']),
                    );
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cashbackRow(IconData icon, Color color, String title, String date,
      String amount, String tag) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text(date,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amount,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryGreen)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(tag,
                    style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryGreen)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getBadgeIcon(String? iconName) {
    switch (iconName) {
      case 'star_rounded':
        return Icons.star_rounded;
      case 'people_rounded':
        return Icons.people_rounded;
      case 'verified_rounded':
        return Icons.verified_rounded;
      case 'military_tech_rounded':
        return Icons.military_tech_rounded;
      case 'local_fire_department_rounded':
        return Icons.local_fire_department_rounded;
      case 'diamond_rounded':
        return Icons.diamond_rounded;
      default:
        return Icons.emoji_events_rounded;
    }
  }

  Color _parseColor(String? hexColor) {
    if (hexColor == null) return AppColors.textMuted;
    try {
      return Color(int.parse(hexColor.replaceAll('#', '0xFF')));
    } catch (_) {
      return AppColors.textMuted;
    }
  }

  Widget _badge(IconData icon, String label, bool earned, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: earned ? color.withOpacity(0.08) : AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: earned ? color.withOpacity(0.25) : const Color(0xFFE8F2F1),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon,
              size: 28,
              color: earned ? color : AppColors.textMuted.withOpacity(0.4)),
          const SizedBox(height: 6),
          Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: earned ? color : AppColors.textMuted.withOpacity(0.5)),
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ─── Withdrawal Bottom Sheet ───────────────────────────────────────────────
class _WithdrawBottomSheet extends StatefulWidget {
  final int availableBalance;
  final void Function(int amount) onWithdrawSuccess;

  const _WithdrawBottomSheet({
    required this.availableBalance,
    required this.onWithdrawSuccess,
  });

  @override
  State<_WithdrawBottomSheet> createState() => _WithdrawBottomSheetState();
}

class _WithdrawBottomSheetState extends State<_WithdrawBottomSheet> {
  String? _selectedMethod;
  final _phoneCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  bool _isProcessing = false;

  static const _methods = [
    {
      'id': 'mtn',
      'label': 'MTN Mobile Money',
      'color': 0xFFFFCC00,
      'icon': Icons.phone_android
    },
    {
      'id': 'orange',
      'label': 'Orange Money',
      'color': 0xFFFF6B00,
      'icon': Icons.phone_android
    },
    {
      'id': 'cash',
      'label': 'Cash Collection',
      'color': 0xFF10B981,
      'icon': Icons.payments
    },
  ];

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  String _fmt(int v) {
    final s = v.toString();
    if (s.length <= 3) return s;
    final cut = s.length % 3;
    final parts = <String>[];
    if (cut > 0) parts.add(s.substring(0, cut));
    for (int i = cut; i < s.length; i += 3) {
      parts.add(s.substring(i, i + 3));
    }
    return parts.join(',');
  }

  void _setAll() {
    _amountCtrl.text = widget.availableBalance.toString();
    setState(() {});
  }

  void _submit(LanguageService lang) async {
    if (_selectedMethod == null) {
      _snack(lang.selectMethod, AppColors.textMuted);
      return;
    }
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      _snack(lang.mobileNumber, AppColors.textMuted);
      return;
    }
    final amount = int.tryParse(_amountCtrl.text.trim().replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      _snack(lang.invalidAmount, AppColors.error);
      return;
    }
    if (amount < 500) {
      _snack(lang.minWithdrawAmount, AppColors.error);
      return;
    }
    if (amount > widget.availableBalance) {
      _snack(lang.amountExceedsBalance, AppColors.error);
      return;
    }

    setState(() => _isProcessing = true);

    try {
      await ApiService.withdrawRewards(
        amount: amount,
        phoneNumber: phone,
        method: _selectedMethod!,
      );

      if (!mounted) return;
      setState(() => _isProcessing = false);
      Navigator.pop(context);
      widget.onWithdrawSuccess(amount);

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Row(children: [
          const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(lang.withdrawSuccess,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13)),
                Text(lang.withdrawProcessing,
                    style:
                        const TextStyle(fontSize: 11, color: Colors.white70)),
              ],
            ),
          ),
        ]),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 4),
      ));
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      _snack(
          lang.isFrench
              ? 'Échec du retrait. Réessayez.'
              : 'Withdrawal failed. Please retry.',
          AppColors.error);
    }
  }

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      duration: const Duration(seconds: 2),
    ));
  }

  int get _parsedAmount {
    final v = int.tryParse(_amountCtrl.text.trim().replaceAll(',', ''));
    return v ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final amt = _parsedAmount;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 0, 20, 24 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE0E0E0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Title row
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.account_balance_rounded,
                      color: AppColors.primaryGreen, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lang.withdrawTitle,
                          style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary)),
                      Text(lang.withdrawSubtitle,
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Available balance
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.06),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: AppColors.primaryGreen.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.stars_rounded,
                      color: AppColors.warning, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    '${lang.availableCashback}: ${_fmt(widget.availableBalance)} FCFA',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryGreen),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Rewards-only notice
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.warning.withOpacity(0.25)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: AppColors.warning, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(lang.rewardsOnlyNote,
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.warning,
                            fontWeight: FontWeight.w500,
                            height: 1.5)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            // Method label
            Text(lang.withdrawMethod,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 10),
            // Method cards
            Row(
              children: List.generate(_methods.length, (i) {
                final m = _methods[i];
                final id = m['id'] as String;
                final selected = _selectedMethod == id;
                final color = Color(m['color'] as int);
                final methodLabels = lang.isFrench
                    ? [
                        'MTN Mobile Money',
                        'Orange Money',
                        'Collecte en espèces'
                      ]
                    : ['MTN Mobile Money', 'Orange Money', 'Cash Collection'];
                final label = methodLabels[i];
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: i < 2 ? 8.0 : 0),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedMethod = id),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                            vertical: 14, horizontal: 6),
                        decoration: BoxDecoration(
                          color: selected
                              ? color.withOpacity(0.1)
                              : const Color(0xFFF8F8F8),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: selected ? color : const Color(0xFFE8F2F1),
                            width: selected ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.18),
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: m['icon'] != null
                                    ? Icon(
                                        m['icon'] as IconData,
                                        color: color,
                                        size: 26,
                                      )
                                    : Image.asset(
                                        id == 'mtn'
                                            ? 'assets/images/momo.png'
                                            : 'assets/images/orange-money.png',
                                        width: 26,
                                        height: 26,
                                        fit: BoxFit.contain,
                                      ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(label,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: selected
                                        ? color
                                        : AppColors.textSecondary),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: selected ? color : Colors.transparent,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 20),
            // Phone number
            Text(lang.mobileNumber,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: lang.enterPhoneNumber,
                prefixIcon: const Icon(Icons.phone_rounded,
                    color: AppColors.primaryGreen, size: 20),
                prefixText: '+237 ',
                prefixStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            // Amount field
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(lang.withdrawAmount,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                GestureDetector(
                  onTap: _setAll,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(lang.withdrawAll,
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryGreen)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _amountCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              decoration: const InputDecoration(
                hintText: '0',
                prefixIcon: Icon(Icons.account_balance_wallet_outlined,
                    color: AppColors.primaryGreen, size: 20),
                suffixText: 'FCFA',
                suffixStyle: TextStyle(
                    fontSize: 14,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w600),
              ),
              onChanged: (_) => setState(() {}),
            ),
            // Summary
            if (amt > 0) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.offWhite,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE8F2F1)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(lang.processingFee,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textSecondary)),
                        Text(lang.free,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primaryGreen)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Divider(height: 1),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(lang.youWillReceive,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        Text('${_fmt(amt)} FCFA',
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryGreen)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isProcessing ? null : () => _submit(lang),
                style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _isProcessing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(lang.confirmWithdraw,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Data model for cashback entries ─────────────────────────────────────
class _CashbackEntry {
  final IconData icon;
  final Color color;
  final String title, date, amount, tag;
  const _CashbackEntry(
      this.icon, this.color, this.title, this.date, this.amount, this.tag);
}
