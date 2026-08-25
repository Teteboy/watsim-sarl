import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import 'rewards_screen.dart';

// ─── Referral Screen ───────────────────────────────────────────────────────
class ReferralScreen extends StatefulWidget {
  final bool isNavTab;
  const ReferralScreen({super.key, this.isNavTab = false});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  String _code = '';
  bool _isLoading = true;
  bool _hasError = false;

  // Stats
  int _totalReferrals = 0;
  int _firstRewardsPaid = 0;
  int _secondRewardsPaid = 0;
  int _totalFirstRewards = 0;
  int _totalSecondRewards = 0;

  List<ReferralItem> _referrals = [];

  bool _isEditing = false;
  bool _isSaving = false;
  String? _editError;
  final _codeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadReferralData();
  }

  Future<void> _loadReferralData() async {
    try {
      setState(() {
        _isLoading = true;
        _hasError = false;
      });

      final data = await ApiService.fetchReferralStats();

      setState(() {
        _code = data['code'] ?? '';
        _totalReferrals = data['totalReferrals'] ?? 0;
        _firstRewardsPaid = data['firstRewardsPaid'] ?? 0;
        _secondRewardsPaid = data['secondRewardsPaid'] ?? 0;
        _totalFirstRewards = data['totalFirstRewards'] ?? 0;
        _totalSecondRewards = data['totalSecondRewards'] ?? 0;

        if (data['referrals'] != null) {
          _referrals = (data['referrals'] as List)
              .map((r) => ReferralItem(
                    name: r['referredName'] ?? 'Unknown',
                    status: r['status'] ?? 'PENDING',
                    firstReward: r['firstRewardAmount'] ?? 1000,
                    firstRewardPaid: r['firstRewardPaid'] ?? false,
                    secondReward: r['secondRewardAmount'] ?? 0,
                    secondRewardPaid: r['secondRewardPaid'] ?? false,
                    date: _formatDate(r['createdAt']),
                  ))
              .toList();
        }

        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _hasError = true;
      });
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

  String _formatAmount(int amount) {
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(1)}k';
    }
    return amount.toString();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _saveCode() async {
    final lang = LanguageProvider.of(context);
    final newCode = _codeController.text.trim().toUpperCase();
    if (newCode.isEmpty) {
      setState(() => _editError =
          lang.isFrench ? 'Veuillez entrer un code' : 'Please enter a code');
      return;
    }
    if (newCode.length < 4 || newCode.length > 16) {
      setState(() => _editError = lang.isFrench
          ? 'Le code doit faire 4 à 16 caractères'
          : 'Code must be 4 to 16 characters');
      return;
    }
    if (!RegExp(r'^[A-Z0-9_-]+$').hasMatch(newCode)) {
      setState(() => _editError = lang.isFrench
          ? 'Caractères autorisés : lettres, chiffres, - et _'
          : 'Only letters, numbers, - and _ are allowed');
      return;
    }

    setState(() {
      _isSaving = true;
      _editError = null;
    });

    try {
      final result = await ApiService.updateReferralCode(newCode);
      setState(() {
        _code = (result['code'] as String?) ?? newCode;
        _isEditing = false;
        _isSaving = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(lang.isFrench
              ? 'Code de parrainage mis à jour'
              : 'Referral code updated'),
          backgroundColor: AppColors.primaryGreen,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on ApiException catch (e) {
      setState(() {
        _editError = e.message;
        _isSaving = false;
      });
    } catch (e) {
      setState(() {
        _editError =
            lang.isFrench ? 'Échec de la mise à jour' : 'Update failed';
        _isSaving = false;
      });
    }
  }

  // ── Copy code ─────────────────────────────────────────────────────────────
  void _copyCode(LanguageService lang) {
    Clipboard.setData(ClipboardData(text: _code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(children: [
          const Icon(Icons.check_circle_rounded, color: Colors.white),
          const SizedBox(width: 10),
          Text(lang.codeCopied),
        ]),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // ── Share code ────────────────────────────────────────────────────────────
  void _shareCode(LanguageService lang) {
    final shareText = lang.isFrench
        ? '🎉 Rejoins Watsim et profite de services cotisation simples et sécurisés !\n\n'
            'Utilise mon code de parrainage : $_code\n\n'
            'Tu recevras 1 000 FCFA à ton premier dépôt, et je gagnerai aussi 1 000 FCFA !\n'
            'Plus, je gagne 0.6% quand tu finalises une cotisation 💰\n\n'
            '👉 Télécharge Watsim dès maintenant !'
        : '🎉 Join Watsim and enjoy simple, secure savings services!\n\n'
            'Use my referral code: $_code\n\n'
            'You will receive 1,000 FCFA on your first deposit, and I will earn 1,000 FCFA too!\n'
            'Plus, I earn 0.6% when you complete a contribution 💰\n\n'
            '👉 Download Watsim now!';

    Clipboard.setData(ClipboardData(text: shareText));

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) =>
          _ShareSheet(code: _code, shareText: shareText, lang: lang),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: widget.isNavTab
          ? WatsimAppBar(
              title: lang.referrals,
              greeting: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined,
                      color: Colors.white),
                  onPressed: () {},
                ),
              ],
            )
          : WatsimAppBar(title: lang.referrals, showBack: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _hasError
              ? _buildErrorState(lang)
              : _buildContent(lang),
    );
  }

  Widget _buildErrorState(LanguageService lang) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            lang.isFrench ? 'Erreur de chargement' : 'Loading error',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: _loadReferralData,
            child: Text(lang.isFrench ? 'Réessayer' : 'Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(LanguageService lang) {
    final hasReferrals = _referrals.isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Hero card ────────────────────────────────────────────
          GradientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lang.referFriends,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Earn 1000 FCFA when your friend makes their first deposit, and 0.6% when they complete a BNPL purchase!',
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.75), fontSize: 14),
                ),
                const SizedBox(height: 20),

                // ── Code box ────────────────
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.25),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            lang.yourReferralCode,
                            style: const TextStyle(
                              color: Colors.white54,
                              fontSize: 11,
                              letterSpacing: 1.2,
                            ),
                          ),
                          if (!_isEditing)
                            GestureDetector(
                              onTap: () {
                                _codeController.text = _code;
                                setState(() {
                                  _isEditing = true;
                                  _editError = null;
                                });
                              },
                              child: Text(
                                lang.isFrench ? 'Modifier' : 'Edit',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_isEditing) ...[
                        TextField(
                          controller: _codeController,
                          autofocus: true,
                          textCapitalization: TextCapitalization.characters,
                          cursorColor: Colors.white,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                          ),
                          decoration: InputDecoration(
                            hintText:
                                lang.isFrench ? 'NOUVEAU CODE' : 'NEW CODE',
                            hintStyle: const TextStyle(color: Colors.white54),
                            filled: true,
                            fillColor: Colors.black.withOpacity(0.35),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                  color: Colors.white, width: 1.5),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                          ),
                        ),
                        if (_editError != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              _editError!,
                              style: const TextStyle(
                                  color: Color(0xFFFFCDD2), fontSize: 12),
                            ),
                          ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: _isSaving
                                    ? null
                                    : () => setState(() => _isEditing = false),
                                child: Container(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    lang.isFrench ? 'Annuler' : 'Cancel',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: GestureDetector(
                                onTap: _isSaving ? null : _saveCode,
                                child: Container(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryGreen,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  alignment: Alignment.center,
                                  child: _isSaving
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : Text(
                                          lang.isFrench
                                              ? 'Enregistrer'
                                              : 'Save',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ] else
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _code.isEmpty ? '---' : _code,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 2,
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Copy / Share row ─────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _copyCode(lang),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.primaryGreen,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.copy_rounded,
                                  color: Colors.white, size: 16),
                              const SizedBox(width: 6),
                              Text(lang.copy,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _shareCode(lang),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: Colors.white.withOpacity(0.3)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.share_rounded,
                                  color: Colors.white, size: 16),
                              const SizedBox(width: 6),
                              Text(lang.share,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Stats ──────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: _statCard(
                  _totalReferrals.toString(),
                  lang.isFrench ? 'Parrainages' : 'Referrals',
                  Icons.people_rounded,
                  AppColors.primaryGreen,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _statCard(
                  _formatAmount(_totalFirstRewards + _totalSecondRewards),
                  lang.isFrench ? 'Gains Totaux' : 'Total Earned',
                  Icons.account_balance_wallet_rounded,
                  AppColors.deepTeal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // ── Rewards & Cashback Breakdown ─────────────────────────
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lang.isFrench
                      ? 'Récompenses & Cashback'
                      : 'Rewards & Cashback',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lang.isFrench
                                ? 'Parrainage (1er dépôt)'
                                : 'Referral (1st deposit)',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_formatAmount(_totalFirstRewards)} FCFA',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primaryGreen,
                            ),
                          ),
                          Text(
                            '$_firstRewardsPaid ${lang.isFrench ? "payé(s)" : "paid"}',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                        width: 1, height: 50, color: const Color(0xFFE8F2F1)),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              lang.isFrench
                                  ? 'Cashback BNPL (0.6%)'
                                  : 'BNPL Cashback (0.6%)',
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_formatAmount(_totalSecondRewards)} FCFA',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppColors.deepTeal,
                              ),
                            ),
                            Text(
                              '$_secondRewardsPaid ${lang.isFrench ? "payé(s)" : "paid"}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          if (hasReferrals) ...[
            // ── Referral list ───────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  lang.recentReferrals,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            ..._referrals.take(5).map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor:
                              AppColors.primaryGreen.withOpacity(0.15),
                          child: Text(
                            r.name.substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                              color: AppColors.secondaryGreen,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r.name,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              _buildStatusChip(r.status),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (r.firstRewardPaid)
                              Text(
                                '+${r.firstReward} FCFA',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primaryGreen,
                                ),
                              ),
                            if (r.secondRewardPaid)
                              Text(
                                '+${r.secondReward} FCFA',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primaryGreen,
                                ),
                              ),
                            if (!r.firstRewardPaid && !r.secondRewardPaid)
                              const Text(
                                'Pending',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.warning,
                                ),
                              ),
                            Text(
                              r.date,
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                )),
          ] else ...[
            // ── Empty state ─────────────────────────────────────────
            _buildEmptyState(lang),
          ],

          const SizedBox(height: 24),

          // ── Cashback banner ────────────────────────────────────────
          GestureDetector(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const RewardsScreen()),
            ),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    AppColors.deepTeal,
                    AppColors.secondaryGreen,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.account_balance_wallet_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lang.isFrench
                              ? 'Récompenses & Cashback'
                              : 'Rewards & Cashback',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          lang.isFrench
                              ? 'Voir votre solde et retirer vos gains'
                              : 'View your balance and withdraw earnings',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // ── How it works ───────────────────────────────────────────
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lang.howItWorks,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 14),
                _step('1', 'Share your referral code with friends'),
                _step('2', 'Friend signs up using your code'),
                _step('3', 'You both earn 1000 FCFA on their first deposit'),
                _step('4', 'You earn 0.6% when they complete a BNPL purchase'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    Color color;
    String label;

    switch (status) {
      case 'COMPLETED':
        color = AppColors.primaryGreen;
        label = 'Completed';
        break;
      case 'FIRST_REWARDED':
        color = Colors.blue;
        label = 'First Reward';
        break;
      case 'PENDING':
      default:
        color = AppColors.warning;
        label = 'Pending';
    }

    return StatusChip(
      label: label,
      color: color.withOpacity(0.12),
      textColor: color,
    );
  }

  Widget _buildEmptyState(LanguageService lang) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
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
            child: const Icon(
              Icons.people_outline_rounded,
              size: 40,
              color: AppColors.primaryGreen,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            lang.noReferralsYet,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            lang.noReferralsBody,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _step(String num, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: const BoxDecoration(
              color: AppColors.primaryGreen,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                num,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Referral Item Model ──────────────────────────────────────────────────
class ReferralItem {
  final String name;
  final String status;
  final int firstReward;
  final bool firstRewardPaid;
  final int secondReward;
  final bool secondRewardPaid;
  final String date;

  ReferralItem({
    required this.name,
    required this.status,
    required this.firstReward,
    required this.firstRewardPaid,
    required this.secondReward,
    required this.secondRewardPaid,
    required this.date,
  });
}

// ─── Share Sheet ──────────────────────────────────────────────────────────
class _ShareSheet extends StatelessWidget {
  final String code;
  final String shareText;
  final LanguageService lang;

  const _ShareSheet(
      {required this.code, required this.shareText, required this.lang});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.deepTeal, AppColors.secondaryGreen],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(
                  lang.isFrench ? 'Parrainer un ami' : 'Refer a Friend',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.3)),
                  ),
                  child: Text(
                    code,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  lang.isFrench
                      ? 'Copié dans le presse-papiers ! Partagez-le où vous voulez.'
                      : 'Copied to clipboard! Share it anywhere.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _shareButton(Icons.message, 'SMS / WhatsApp', () {
                  Clipboard.setData(ClipboardData(text: shareText));
                  Navigator.pop(context);
                }),
                _shareButton(Icons.content_copy, lang.copy, () {
                  Clipboard.setData(ClipboardData(text: shareText));
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(lang.codeCopied),
                      backgroundColor: AppColors.primaryGreen,
                    ),
                  );
                }),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(lang.isFrench ? 'Annuler' : 'Cancel'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _shareButton(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppColors.offWhite,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primaryGreen, size: 22),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
