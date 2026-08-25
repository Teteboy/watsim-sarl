import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/api_service.dart';
import '../services/language_service.dart';
import '../main.dart';

class CreditScoreScreen extends StatefulWidget {
  const CreditScoreScreen({super.key});

  @override
  State<CreditScoreScreen> createState() => _CreditScoreScreenState();
}

class _CreditScoreScreenState extends State<CreditScoreScreen> {
  Map<String, dynamic>? _scoreData;
  List<dynamic> _history = [];
  List<String> _tips = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCreditScore();
  }

  Future<void> _loadCreditScore() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getCreditScore(),
        ApiService.getCreditScoreHistory(limit: 5),
        ApiService.getCreditScoreTips(),
      ]);
      if (mounted) {
        setState(() {
          final rawScore = results[0];
          _scoreData = rawScore is Map<dynamic, dynamic>
              ? Map<String, dynamic>.from(rawScore)
              : rawScore as Map<String, dynamic>?;

          final rawHistory = results[1] as List<dynamic>?;
          _history = rawHistory
                  ?.map((e) =>
                      Map<String, dynamic>.from(e as Map<dynamic, dynamic>))
                  .toList() ??
              [];

          final rawTips = results[2] as List<dynamic>?;
          _tips = rawTips?.map((e) => e.toString()).toList() ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  int _toInt(dynamic v, {int fallback = 0}) {
    if (v is int) return v;
    if (v is double) return v.round();
    if (v is num) return v.round();
    return fallback;
  }

  Color _getScoreColor(int score) {
    if (score >= 80) return AppColors.primaryGreen;
    if (score >= 60) return Colors.orange;
    if (score >= 40) return Colors.deepOrange;
    return Colors.red;
  }

  String _getScoreLabel(int score) {
    final fr = LanguageService().isFrench;
    if (score >= 80) return fr ? 'Excellent' : 'Excellent';
    if (score >= 60) return fr ? 'Bon' : 'Good';
    if (score >= 40) return fr ? 'Moyen' : 'Fair';
    return fr ? 'Faible' : 'Poor';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    return Scaffold(
      appBar: WatsimAppBar(title: lang.creditScore, showBack: true),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primaryGreen))
          : _error != null
              ? _buildErrorWidget()
              : RefreshIndicator(
                  onRefresh: _loadCreditScore,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Score Display
                        if (_scoreData != null) ...[
                          _buildScoreCard(),
                          const SizedBox(height: 24),
                          _buildBreakdownCard(),
                          const SizedBox(height: 24),
                        ],

                        // Tips
                        if (_tips.isNotEmpty) ...[
                          _buildTipsCard(),
                          const SizedBox(height: 24),
                        ],

                        // History
                        if (_history.isNotEmpty) _buildHistoryCard(),

                        // Empty state
                        if (_scoreData == null &&
                            _tips.isEmpty &&
                            _history.isEmpty)
                          _buildEmptyWidget(),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildScoreCard() {
    final score = _toInt(_scoreData!['score']);
    final limit = _toInt(_scoreData!['limit']);
    final color = _getScoreColor(score);

    return AppCard(
      child: Column(
        children: [
          Text(
            LanguageService().isFrench
                ? 'Votre score de crédit'
                : 'Your Credit Score',
            style: const TextStyle(
              fontSize: 16,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withOpacity(0.1),
              border: Border.all(color: color, width: 3),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  score.toString(),
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  _getScoreLabel(score),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '${LanguageService().isFrench ? 'Limite de crédit' : 'Credit Limit'}: ${_formatAmount(limit)}',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownCard() {
    final breakdown = _scoreData!['breakdown'] is Map<dynamic, dynamic>
        ? Map<String, dynamic>.from(
            _scoreData!['breakdown'] as Map<dynamic, dynamic>)
        : _scoreData!['breakdown'] as Map<String, dynamic>? ?? {};

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LanguageService().isFrench ? 'Détail du score' : 'Score Breakdown',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          ...breakdown.entries.map((entry) {
            final label = _formatBreakdownLabel(entry.key);
            final value = _toInt(entry.value);
            final isPositive = value >= 0;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  Text(
                    '${isPositive ? '+' : ''}$value',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isPositive ? AppColors.primaryGreen : Colors.red,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildTipsCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LanguageService().isFrench
                ? 'Comment améliorer votre score'
                : 'How to Improve Your Score',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          ..._tips
              .map((tip) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.lightbulb_outline_rounded,
                          color: AppColors.primaryGreen,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            tip,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ))
              .toList(),
        ],
      ),
    );
  }

  Widget _buildHistoryCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            LanguageService().isFrench
                ? 'Changements récents'
                : 'Recent Score Changes',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          ..._history.map((entry) {
            final date = DateTime.parse(entry['createdAt']);
            final rawMetadata = entry['metadata'];
            final metadata = rawMetadata is Map<dynamic, dynamic>
                ? Map<String, dynamic>.from(rawMetadata)
                : rawMetadata as Map<String, dynamic>? ?? {};
            final score = _toInt(metadata['score']);

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatDate(date),
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Text(
                    score.toString(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: _getScoreColor(score),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  String _formatAmount(int amount) {
    final thousands = amount ~/ 1000;
    final remainder = amount % 1000;
    return '$thousands,${remainder.toString().padLeft(3, '0')} FCFA';
  }

  String _formatBreakdownLabel(String key) {
    final fr = LanguageService().isFrench;
    switch (key) {
      case 'base':
        return fr ? 'Score de base' : 'Base Score';
      case 'kycVerified':
        return fr ? 'KYC vérifié' : 'KYC Verified';
      case 'completedPurchases':
        return fr ? 'Achats terminés' : 'Completed Purchases';
      case 'overduePenalty':
        return fr ? 'Paiements en retard' : 'Overdue Payments';
      case 'depositHistory':
        return fr ? 'Historique de dépôts' : 'Deposit History';
      case 'paymentStreak':
        return fr ? 'Série de paiements' : 'Payment Streak';
      case 'accountAgeBonus':
        return fr ? 'Ancienneté du compte' : 'Account Age';
      case 'activityBonus':
        return fr ? 'Activité récente' : 'Recent Activity';
      case 'totalVolumeBonus':
        return fr ? 'Volume de transactions' : 'Transaction Volume';
      default:
        return key;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              LanguageService().isFrench
                  ? 'Échec du chargement du score de crédit'
                  : 'Failed to load credit score',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _error ??
                  (LanguageService().isFrench
                      ? 'Une erreur inconnue s\'est produite'
                      : 'Unknown error occurred'),
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadCreditScore,
              icon: const Icon(Icons.refresh),
              label: Text(LanguageService().isFrench ? 'Réessayer' : 'Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.credit_score_outlined,
                size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              LanguageService().isFrench
                  ? 'Aucune donnée de score de crédit'
                  : 'No Credit Score Data',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              LanguageService().isFrench
                  ? 'Votre score de crédit apparaîtra ici une fois que vous commencerez à utiliser les services BNPL.'
                  : 'Your credit score will appear here once you start using BNPL services.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadCreditScore,
              icon: const Icon(Icons.refresh),
              label:
                  Text(LanguageService().isFrench ? 'Actualiser' : 'Refresh'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryGreen,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
