import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/language_service.dart';
import '../theme/app_theme.dart';

class PublicityDetailScreen extends StatelessWidget {
  final Map<String, dynamic> publicity;

  const PublicityDetailScreen({super.key, required this.publicity});

  String get _name => publicity['name']?.toString() ?? 'Publicité';

  String get _imageUrl {
    final raw = publicity['imageUrl']?.toString() ?? '';
    final resolved = ApiService.resolveImageUrl(raw);
    return resolved.isNotEmpty ? resolved : '';
  }

  String get _merchant {
    final merchant = publicity['merchant'];
    if (merchant is Map<String, dynamic>) {
      return merchant['businessName']?.toString() ??
          merchant['name']?.toString() ??
          '';
    }
    if (merchant is String) return merchant;
    return '';
  }

  String get _description => publicity['description']?.toString() ?? '';

  String get _aim => publicity['aim']?.toString() ?? '';

  String get _location => publicity['location']?.toString() ?? '';

  String get _phoneNumber => publicity['phoneNumber']?.toString() ?? '';

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: AppColors.primaryDark,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: _imageUrl.isNotEmpty
                  ? Image.network(
                      _imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _placeholder(),
                    )
                  : _placeholder(),
            ),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      lang.isFrench ? 'PUBLICITÉ' : 'ADVERTISEMENT',
                      style: const TextStyle(
                        color: AppColors.primaryGreen,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (_merchant.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.storefront_outlined,
                          color: AppColors.textSecondary,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${lang.isFrench ? 'par' : 'by'} $_merchant',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (_description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        _description,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.5,
                        ),
                      ),
                    ),
                  if (_aim.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.primaryGreen.withOpacity(0.2),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.track_changes_outlined,
                              color: AppColors.primaryGreen,
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _aim,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (_location.isNotEmpty || _phoneNumber.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.deepTeal,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_location.isNotEmpty)
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    color: AppColors.primaryGreen,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      _location,
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 14,
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            if (_location.isNotEmpty && _phoneNumber.isNotEmpty)
                              const SizedBox(height: 10),
                            if (_phoneNumber.isNotEmpty)
                              Row(
                                children: [
                                  const Icon(
                                    Icons.phone_outlined,
                                    color: AppColors.primaryGreen,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    _phoneNumber,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 14,
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primaryGreen, AppColors.primaryDark],
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.campaign_outlined,
          color: Colors.white54,
          size: 64,
        ),
      ),
    );
  }
}
