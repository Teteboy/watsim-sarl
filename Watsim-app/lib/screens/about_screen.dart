import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';

// ─── About Screen ─────────────────────────────────────────────────────────
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.about, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ── Logo & version ─────────────────────────────────────────────
            AppCard(
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primaryDark,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(16),
                      child: Image(
                        image: AssetImage('assets/images/logo_green.png'),
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('Watsim',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  Text(lang.version,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary)),
                  const SizedBox(height: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(lang.latestVersion,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryGreen)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Mission ────────────────────────────────────────────────────
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _aboutHeader(Icons.rocket_launch_rounded,
                      AppColors.primaryGreen, lang.ourMission),
                  const SizedBox(height: 10),
                  Text(lang.missionBody,
                      style: const TextStyle(
                          fontSize: 13,
                          height: 1.7,
                          color: AppColors.textSecondary)),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Key features ───────────────────────────────────────────────
            _sectionLabel(lang.keyFeatures),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE8F2F1)),
              ),
              child: Column(
                children: [
                  _FeatureRow(
                    icon: Icons.credit_score_rounded,
                    color: AppColors.primaryGreen,
                    title: lang.featureBnpl,
                    subtitle: lang.featureBnplSub,
                  ),
                  const Divider(height: 1, indent: 66),
                  _FeatureRow(
                    icon: Icons.account_balance_wallet_outlined,
                    color: const Color(0xFF1565C0),
                    title: lang.featureWallet,
                    subtitle: lang.featureWalletSub,
                  ),
                  const Divider(height: 1, indent: 66),
                  _FeatureRow(
                    icon: Icons.savings_outlined,
                    color: AppColors.warning,
                    title: lang.featureSavings,
                    subtitle: lang.featureSavingsSub,
                  ),
                  const Divider(height: 1, indent: 66),
                  _FeatureRow(
                    icon: Icons.card_giftcard_rounded,
                    color: const Color(0xFF7B1FA2),
                    title: lang.featureRewards,
                    subtitle: lang.featureRewardsSub,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Legal ──────────────────────────────────────────────────────
            _sectionLabel(lang.legal),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE8F2F1)),
              ),
              child: Column(
                children: [
                  _LegalRow(
                    icon: Icons.privacy_tip_outlined,
                    title: lang.privacyPolicy,
                    onTap: () {},
                  ),
                  const Divider(height: 1, indent: 66),
                  _LegalRow(
                    icon: Icons.gavel_rounded,
                    title: lang.termsOfService,
                    onTap: () {},
                  ),
                  const Divider(height: 1, indent: 66),
                  _LegalRow(
                    icon: Icons.cookie_outlined,
                    title: lang.cookiePolicy,
                    onTap: () {},
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Build info ─────────────────────────────────────────────────
            AppCard(
              child: Column(
                children: [
                  _InfoRow(label: lang.buildNumber, value: '100'),
                  const Divider(height: 1),
                  _InfoRow(
                      label: lang.releaseDate,
                      value: lang.isFrench ? 'Janvier 2025' : 'January 2025'),
                  const Divider(height: 1),
                  _InfoRow(
                      label: lang.platform,
                      value:
                          lang.isFrench ? 'iOS et Android' : 'iOS & Android'),
                  const Divider(height: 1),
                  _InfoRow(
                      label: lang.developedBy, value: 'Watsim Technologies'),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Copyright ──────────────────────────────────────────────────
            Text(
              lang.copyright,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 1),
        ),
      );

  Widget _aboutHeader(IconData icon, Color color, String title) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Text(title,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary)),
      ],
    );
  }
}

// ─── Feature row ──────────────────────────────────────────────────────────
class _FeatureRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  const _FeatureRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(title,
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary)),
      subtitle: Text(subtitle,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
    );
  }
}

// ─── Legal row ────────────────────────────────────────────────────────────
class _LegalRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback? onTap;

  const _LegalRow({required this.icon, required this.title, this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.textSecondary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppColors.textSecondary, size: 18),
      ),
      title: Text(title,
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary)),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.textMuted, size: 18),
      onTap: onTap,
    );
  }
}

// ─── Info row ─────────────────────────────────────────────────────────────
class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
          Text(value,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
