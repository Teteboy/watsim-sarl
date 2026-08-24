import 'dart:convert';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../notification_state.dart';
import '../order_state.dart';
import '../wallet_state.dart';
import '../profile_state.dart';
import '../services/api_service.dart';
import 'deposit_screen.dart';
import 'catalogue_screen.dart';
import '../main.dart';
import 'balance_check_screen.dart';
import 'bnpl_simulator_screen.dart';
import 'wallet_screen.dart';
import 'order_detail_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'credit_score_screen.dart';
import 'publicity_detail_screen.dart';
import '../services/language_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  bool _balanceVisible = true;
  bool _showAllPayments = false;
  int _notifCount = 0;
  int _slideshowIndex = 0;
  int _walletBalance = 0;
  late final PageController _slideshowController;

  bool _loading = true;
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _wallet;

  // Slideshow items (publicity/ads) loaded from backend only
  List<_SlideshowItem> _slideshowItems = const [];

  // Publicity/ads loaded from backend
  List<Map<String, dynamic>> _publicities = const [];

  // Exclusive offers (products) loaded from backend
  List<Product> _exclusiveOffers = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _slideshowController = PageController();
    _notifCount = NotificationState.instance.unreadCount;
    NotificationState.instance.addListener(_onNotifChanged);
    OrderState.instance.addListener(_onOrderChanged);
    WalletState.instance.addListener(_onOrderChanged);
    ProfileState.instance.addListener(_onProfileChanged);
    // Auto-advance slideshow every 3.5 seconds
    Future.delayed(Duration.zero, _startSlideshow);
    _loadHomeData();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadHomeData();
    }
  }

  Future<void> _loadHomeData() async {
    setState(() => _loading = true);

    try {
      // Sync all local state with backend first
      await Future.wait([
        WalletState.instance.syncWithBackend(),
        OrderState.instance.syncWithBackend(),
        NotificationState.instance.syncWithBackend(),
      ]);

      final [products, bestOffers, wallet, profile, publicities] =
          await Future.wait([
        ApiService.fetchProducts(limit: 6),
        ApiService.fetchBestOffers(limit: 8),
        ApiService.fetchWallet(),
        ApiService.fetchProfile(),
        ApiService.fetchPublicities(),
      ]);

      if (!mounted) return;

      final profileMap = profile as Map<String, dynamic>?;

      // Sync ProfileState with fetched data
      if (profileMap != null) {
        ProfileState.instance.updateUser(profileMap);
      }

      final productList = products as List? ?? const [];
      final bestOfferList = bestOffers as List? ?? const [];
      final walletMap = wallet as Map<String, dynamic>;
      final balance = (walletMap['balance'] as num?)?.toInt() ?? 0;

      // syncWithBackend() already set the exact balance and transactions above

      final safeProducts = productList
          .map((e) => Map<String, dynamic>.from(e as Map<dynamic, dynamic>))
          .toList();
      final safeBestOffers = bestOfferList
          .map((e) => Map<String, dynamic>.from(e as Map<dynamic, dynamic>))
          .toList();

      final priceToInt = (dynamic v) {
        if (v is num) return v.toInt();
        if (v is String) {
          final cleaned = v.replaceAll(RegExp(r'[^0-9]'), '');
          return int.tryParse(cleaned) ?? 0;
        }
        return 0;
      };

      final fmt = (int v) {
        if (v < 1000) return '$v';
        return '${v ~/ 1000},${(v % 1000).toString().padLeft(3, '0')}';
      };

      Color _parseColor(String colorStr) {
        try {
          return Color(int.parse(colorStr.replaceAll('#', '0xFF')));
        } catch (_) {
          return const Color(0xFF4DB049);
        }
      }

      setState(() {
        _loading = false;
        _walletBalance = balance;
        _profile = profileMap;
        _publicities = publicities as List<Map<String, dynamic>>;

        // Populate exclusive offers from best offers using Product.fromJson for proper gallery parsing
        _exclusiveOffers = bestOfferList.map((p) {
          // Use fromJson if price is numeric, otherwise manual mapping for pre-formatted
          final priceVal = p['price'];
          if (priceVal is num) {
            return Product.fromJson(p);
          }
          // Fallback for pre-formatted strings - still parse gallery
          final colorStr = p['color']?.toString() ?? '#4DB049';
          final color = _parseColor(colorStr);
          final catMap = p['category'] as Map<String, dynamic>?;
          final catName = catMap?['name']?.toString() ??
              p['category']?.toString() ??
              'General';

          // Parse gallery images from backend
          final List<String> galleryUrls = [];
          final galleryList = p['gallery'] as List<dynamic>?;
          if (galleryList != null && galleryList.isNotEmpty) {
            for (final item in galleryList) {
              if (item is Map<String, dynamic>) {
                final galleryUrl =
                    ApiService.resolveImageUrl(item['imageUrl'] as String?);
                if (galleryUrl.isNotEmpty) {
                  galleryUrls.add(galleryUrl);
                }
              }
            }
          }
          final mainImgUrl =
              ApiService.resolveImageUrl(p['imageUrl']?.toString());
          final List<String> imageUrls = galleryUrls.isNotEmpty
              ? galleryUrls
              : (mainImgUrl.isNotEmpty ? <String>[mainImgUrl] : <String>[]);

          return Product(
            id: p['id']?.toString() ?? '',
            name: p['name']?.toString() ?? '',
            price: p['price']?.toString() ?? '',
            monthlyPrice: p['monthlyPrice']?.toString() ?? '',
            imageUrl: mainImgUrl,
            color: color,
            icon: Icons.shopping_bag,
            category: catName,
            cashback: 0.0,
            imageGradient: [color, color.withOpacity(0.7)],
            imageUrls: imageUrls,
            description: p['description'] as String?,
            merchantName: (p['merchant']
                as Map<String, dynamic>?)?['businessName'] as String?,
            stock: (p['stock'] as num?)?.toInt(),
          );
        }).toList();

        // Build slideshow only from real backend publicities; no mock fallback
        final slideList = _publicities.take(4).map((item) {
          final merchantData = item['merchant'];
          String merchantName = '';
          if (merchantData is Map) {
            merchantName = merchantData['businessName']?.toString() ??
                merchantData['name']?.toString() ??
                '';
          } else if (merchantData is String) {
            merchantName = merchantData;
          }

          return _SlideshowItem(
            imageUrl: ApiService.resolveImageUrl(item['imageUrl'] as String?),
            name: item['name'] as String? ?? '',
            price: '', // No price for publicity
            monthly: merchantName,
            publicity: item,
          );
        }).toList();

        // Deduplicate slideshow by name (no ID available here)
        final seenSlideNames = <String>{};
        _slideshowItems = slideList.where((s) {
          if (seenSlideNames.contains(s.name)) return false;
          seenSlideNames.add(s.name);
          return true;
        }).toList();

        // Deduplicate exclusive offers by ID and name (same product might have different IDs)
        final seenIds = <String>{};
        final seenNames = <String>{};
        _exclusiveOffers = _exclusiveOffers.where((p) {
          if (p.id != null && p.id!.isNotEmpty) {
            if (seenIds.contains(p.id)) return false;
            seenIds.add(p.id!);
          }
          final normalizedName = p.name.trim().toLowerCase();
          if (seenNames.contains(normalizedName)) return false;
          seenNames.add(normalizedName);
          return true;
        }).toList();
      });
    } catch (e) {
      debugPrint('Home data load error: $e');
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _runDiagnostics() async {
    final results = await ApiService.diagnoseConnection();
    if (!mounted) return;

    final jsonText = const JsonEncoder.withIndent('  ').convert(results);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Connection Diagnostics'),
        content: SingleChildScrollView(
          child: SelectableText(
            jsonText,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
            },
            icon: const Icon(Icons.copy, size: 18),
            label: const Text('Copy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _showDataDebug() async {
    // Fetch fresh data to show what's coming from backend
    try {
      final [products, bestOffers, profile] = await Future.wait([
        ApiService.fetchProducts(limit: 6),
        ApiService.fetchBestOffers(limit: 8),
        ApiService.fetchProfile(),
      ]);

      if (!mounted) return;

      final data = {
        'profile': profile,
        'products': products,
        'bestOffers': bestOffers,
      };

      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('API Data Debug'),
          content: SingleChildScrollView(
            child: SelectableText(
              const JsonEncoder.withIndent('  ').convert(data),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 10),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Error'),
          content: Text('Failed to fetch debug data: $e'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    }
  }

  void _startSlideshow() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(milliseconds: 3500));
      if (!mounted) return false;
      if (_slideshowItems.isEmpty) return true; // Skip if no items
      final next = (_slideshowIndex + 1) % _slideshowItems.length;
      setState(() => _slideshowIndex = next);
      _slideshowController.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
      return true;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _slideshowController.dispose();
    NotificationState.instance.removeListener(_onNotifChanged);
    OrderState.instance.removeListener(_onOrderChanged);
    WalletState.instance.removeListener(_onOrderChanged);
    ProfileState.instance.removeListener(_onProfileChanged);
    super.dispose();
  }

  void _onNotifChanged() {
    if (!mounted) return;
    // Use post frame callback to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() => _notifCount = NotificationState.instance.unreadCount);
      }
    });
  }

  void _onOrderChanged() {
    if (!mounted) return;
    // Use post frame callback to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  void _onProfileChanged() {
    if (!mounted) return;
    // Use post frame callback to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  String _getInitials() {
    final name = ProfileState.instance.fullName ??
        ProfileState.instance.email ??
        ProfileState.instance.phone ??
        '?';
    if (name == '?') return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (parts.isNotEmpty && parts[0].isNotEmpty) {
      return parts[0][0].toUpperCase();
    }
    return '?';
  }

  List<Map<String, dynamic>> get _allPayments {
    return OrderState.instance.orders
        .where((o) => !o.isDemo)
        .map((o) => {
              'icon': o.product.icon,
              'title': o.product.name,
              'sub': o.contributionEndLabel,
              'amount': o.monthlyFormatted,
              'imageUrl': o.product.imageUrl,
              'order': o,
              'isPaid': o.isCurrentInstallmentPaid,
              'isFullyPaid': o.isFullyPaid,
            })
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final payments =
        _showAllPayments ? _allPayments : _allPayments.take(2).toList();

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        automaticallyImplyLeading: false,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: GestureDetector(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primaryGreen.withOpacity(0.2),
              backgroundImage: (!_loading &&
                      ProfileState.instance.imageUrl != null &&
                      ProfileState.instance.imageUrl!.isNotEmpty)
                  ? NetworkImage(ProfileState.instance.imageUrl!)
                  : null,
              child: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primaryGreen,
                      ),
                    )
                  : (ProfileState.instance.imageUrl == null ||
                          ProfileState.instance.imageUrl!.isEmpty)
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
        ),
        leadingWidth: 54,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(lang.helloUser,
                style: TextStyle(
                    color: AppColors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
            Text(
              _loading
                  ? lang.loading
                  : '${(_profile?['fullName'] ?? _profile?['name'] ?? _profile?['phone'] ?? _profile?['email'] ?? lang.guest)}',
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ],
        ),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          // ── Notification bell with badge ──────────────────────
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined,
                    color: AppColors.white, size: 22),
                if (_notifCount > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryGreen,
                        shape: BoxShape.circle,
                      ),
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        _notifCount > 9 ? "9+" : "$_notifCount",
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w800),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          // ── Wallet icon ───────────────────────────────────────
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined,
                color: AppColors.white, size: 22),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Loading indicator ───────────────────────────────
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: CircularProgressIndicator(),
                ),
              ),

            // ── Balance Card ──────────────────────────────────────────
            GradientCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.availableBalance,
                          style:
                              TextStyle(color: Colors.white70, fontSize: 14)),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (_profile?['kycStatus'] == 'VERIFIED'
                                  ? AppColors.primaryGreen
                                  : AppColors.warning)
                              .withOpacity(0.25),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                            _profile?['kycStatus'] == 'VERIFIED'
                                ? lang.verified
                                : (_profile?['kycStatus']
                                            ?.toString()
                                            .toLowerCase() ==
                                        'pending'
                                    ? 'Pending'
                                    : 'Unverified'),
                            style: TextStyle(
                                color: _profile?['kycStatus'] == 'VERIFIED'
                                    ? AppColors.primaryGreen
                                    : AppColors.warning,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Flexible(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 250),
                          child: Text(
                            _balanceVisible
                                ? WalletState.instance.balanceFormatted
                                : '•••••• FCFA',
                            key: ValueKey(_balanceVisible),
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // ── Eye icon: toggle balance visibility ──
                      GestureDetector(
                        onTap: () =>
                            setState(() => _balanceVisible = !_balanceVisible),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 200),
                          child: Icon(
                            _balanceVisible
                                ? Icons.remove_red_eye_outlined
                                : Icons.visibility_off_outlined,
                            key: ValueKey(_balanceVisible),
                            color: Colors.white54,
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // ── Credit Score row (backend-driven) ──────────
                  Builder(builder: (ctx) {
                    final score = (_profile?['creditScore'] ?? 0);
                    final creditScore = (score is num) ? score.toInt() : 0;
                    final percent = (creditScore.clamp(0, 1000) / 1000) * 100;

                    final qualityLabel = () {
                      if (creditScore >= 800) return lang.excellent;
                      if (creditScore >= 650) return 'GOOD';
                      if (creditScore >= 500) return 'FAIR';
                      if (creditScore > 0) return 'LOW';
                      return '—';
                    }();

                    return GestureDetector(
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const CreditScoreScreen()),
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 36,
                              height: 36,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  CircularProgressIndicator(
                                    value: percent / 100,
                                    strokeWidth: 4,
                                    backgroundColor: Colors.white24,
                                    valueColor: const AlwaysStoppedAnimation(
                                        AppColors.primaryGreen),
                                  ),
                                  Text(
                                    '${percent.toStringAsFixed(0)}%',
                                    style: const TextStyle(
                                      fontSize: 7,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lang.creditScore,
                                    style: const TextStyle(
                                        color: Colors.white60, fontSize: 11),
                                  ),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Text(
                                        '$creditScore',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        qualityLabel,
                                        style: const TextStyle(
                                          color: AppColors.primaryGreen,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.credit_score_rounded,
                                color: AppColors.primaryGreen, size: 18),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 16),

                  // ── Deposit & Transfer CTAs ─────────────────────────────────
                  Row(
                    children: [
                      // Deposit Button
                      Expanded(
                        child: GestureDetector(
                          onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const DepositScreen())),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                vertical: 14, horizontal: 16),
                            decoration: BoxDecoration(
                              color: AppColors.primaryGreen,
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.18),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.add_circle_rounded,
                                    color: Colors.white, size: 20),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    lang.deposit,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.3),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Transfer Button
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showTransferSheet(context),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                vertical: 14, horizontal: 16),
                            decoration: BoxDecoration(
                              color: AppColors.secondaryGreen,
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.18),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.send_rounded,
                                    color: Colors.white, size: 20),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    lang.homeTransfer,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.3),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
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

            const SizedBox(height: 20),

            // ── Publicity/Featured Slideshow Banner ──────────────────────────────
            if (_slideshowItems.isEmpty)
              AppCard(
                child: Container(
                  height: 180,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.campaign_outlined,
                        size: 40,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(height: 6),
                      const Flexible(
                        child: Text(
                          'Les publicités en vedette apparaîtront ici',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                          maxLines: 2,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextButton.icon(
                        onPressed: () => Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    const MainShell(initialIndex: 1))),
                        icon: const Icon(Icons.explore, size: 16),
                        label: const Text('Parcourir le catalogue'),
                      ),
                    ],
                  ),
                ),
              )
            else
              GestureDetector(
                onTap: () {
                  final pub = _slideshowItems[_slideshowIndex].publicity;
                  if (pub != null) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PublicityDetailScreen(publicity: pub),
                      ),
                    );
                  }
                },
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(
                    height: 180,
                    child: Stack(
                      children: [
                        // ── Page view of product slides ──
                        PageView.builder(
                          controller: _slideshowController,
                          itemCount: _slideshowItems.length,
                          onPageChanged: (i) =>
                              setState(() => _slideshowIndex = i),
                          itemBuilder: (ctx, i) {
                            final item = _slideshowItems[i];
                            return Stack(
                              fit: StackFit.expand,
                              children: [
                                item.imageUrl.isNotEmpty
                                    ? Image.network(
                                        item.imageUrl,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Container(
                                            color: AppColors.primaryDark),
                                      )
                                    : Container(color: AppColors.primaryDark),
                                // Dark gradient overlay
                                Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.centerRight,
                                      end: Alignment.centerLeft,
                                      colors: [
                                        Colors.transparent,
                                        Colors.black.withOpacity(0.75),
                                      ],
                                    ),
                                  ),
                                ),
                                // Text overlay
                                Positioned(
                                  left: 18,
                                  bottom: 18,
                                  right: 80,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                          item.price.isEmpty
                                              ? 'PUBLICITÉ'
                                              : lang.buyNow,
                                          style: TextStyle(
                                              color: item.price.isEmpty
                                                  ? Colors.orange
                                                  : AppColors.primaryGreen,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 1.0)),
                                      const SizedBox(height: 4),
                                      Text(item.name,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 17,
                                              fontWeight: FontWeight.w800)),
                                      const SizedBox(height: 2),
                                      if (item.price.isNotEmpty) ...[
                                        Text(item.price,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700)),
                                        const SizedBox(height: 2),
                                        Text(item.monthly,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: Colors.white
                                                    .withOpacity(0.7),
                                                fontSize: 11)),
                                      ] else if (item.monthly.isNotEmpty) ...[
                                        Text('par ${item.monthly}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: Colors.white
                                                    .withOpacity(0.8),
                                                fontSize: 12,
                                                fontWeight: FontWeight.w500)),
                                      ],
                                      const SizedBox(height: 10),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                            color: AppColors.primaryGreen,
                                            borderRadius:
                                                BorderRadius.circular(7)),
                                        child: Text(
                                            item.price.isEmpty
                                                ? 'Voir l\'offre'
                                                : lang.explore,
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.5)),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                        // ── Dot indicators ──
                        Positioned(
                          bottom: 10,
                          right: 14,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children:
                                List.generate(_slideshowItems.length, (i) {
                              final active = i == _slideshowIndex;
                              return AnimatedContainer(
                                duration: const Duration(milliseconds: 300),
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 3),
                                width: active ? 18 : 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: active
                                      ? AppColors.primaryGreen
                                      : Colors.white38,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              );
                            }),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // ── Upcoming Payments ─────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(lang.upcomingPayments,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                if (_allPayments.length > 2)
                  TextButton(
                    onPressed: () =>
                        setState(() => _showAllPayments = !_showAllPayments),
                    child: Text(
                      _showAllPayments ? lang.seeLess : lang.seeAll,
                      style: const TextStyle(
                          color: AppColors.primaryGreen,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (_allPayments.isEmpty)
              AppCard(
                padding:
                    const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
                child: SizedBox(
                  width: double.infinity,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.receipt_long_outlined,
                            size: 36,
                            color: AppColors.primaryGreen.withOpacity(0.55)),
                      ),
                      const SizedBox(height: 16),
                      Text(lang.noUpcomingPayments,
                          style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                      const SizedBox(height: 6),
                      Text(lang.ordersWillAppear,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.textMuted)),
                      const SizedBox(height: 20),
                      GestureDetector(
                        onTap: () => Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    const MainShell(initialIndex: 1))),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.primaryGreen,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(lang.browseCatalogue,
                              style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: AnimatedSize(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  child: Column(
                    children: [
                      for (int i = 0; i < payments.length; i++) ...[
                        _installmentRow(
                          context,
                          lang,
                          payments[i]['icon'] as IconData,
                          payments[i]['title'] as String,
                          payments[i]['sub'] as String,
                          payments[i]['amount'] as String,
                          imageUrl: payments[i]['imageUrl'] as String?,
                          order: payments[i]['order'] as ConfirmedOrder?,
                          isPaid: payments[i]['isPaid'] as bool? ?? false,
                          isFullyPaid:
                              payments[i]['isFullyPaid'] as bool? ?? false,
                        ),
                        if (i < payments.length - 1) const Divider(height: 1),
                      ],
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // ── Exclusive Offers ──────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(lang.exclusiveOffers,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
                Icon(Icons.shopping_bag_outlined,
                    color: AppColors.textMuted, size: 20),
              ],
            ),
            const SizedBox(height: 12),
            if (_exclusiveOffers.isEmpty)
              AppCard(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Icon(
                        Icons.local_offer_outlined,
                        size: 48,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'No exclusive offers available',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Check back later for special deals',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              SizedBox(
                height: 210,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (int i = 0; i < _exclusiveOffers.length; i++) ...[
                      _productCard(
                        context,
                        _exclusiveOffers[i],
                      ),
                      if (i < _exclusiveOffers.length - 1)
                        const SizedBox(width: 12),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 24),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _installmentRow(
    BuildContext context,
    LanguageService lang,
    IconData icon,
    String title,
    String sub,
    String amount, {
    String? imageUrl,
    ConfirmedOrder? order,
    bool isPaid = false,
    bool isFullyPaid = false,
  }) {
    Widget thumbnail;
    if (imageUrl != null && imageUrl.isNotEmpty) {
      thumbnail = Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: AppColors.primaryGreen.withOpacity(0.1),
        ),
        clipBehavior: Clip.hardEdge,
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              Icon(icon, color: AppColors.secondaryGreen, size: 22),
          loadingBuilder: (_, child, progress) {
            if (progress == null) return child;
            return Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  color: AppColors.primaryGreen,
                  strokeWidth: 2,
                  value: progress.expectedTotalBytes != null
                      ? progress.cumulativeBytesLoaded /
                          progress.expectedTotalBytes!
                      : null,
                ),
              ),
            );
          },
        ),
      );
    } else {
      thumbnail = Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.primaryGreen.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: AppColors.secondaryGreen, size: 22),
      );
    }

    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          thumbnail,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary)),
                Text(sub,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isFullyPaid)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                lang.paid,
                style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryGreen),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'ONGOING',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFF57C00)),
              ),
            ),
          if (order != null) ...[
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textMuted, size: 18),
          ],
        ],
      ),
    );

    if (order != null) {
      return InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => OrderDetailScreen(order: order)),
        ),
        child: row,
      );
    }
    return row;
  }

  Widget _productCard(
    BuildContext context,
    Product product,
  ) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BnplSimulatorScreen(product: product),
        ),
      ),
      child: Container(
        width: 160,
        decoration: BoxDecoration(
          color: product.color,
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.hardEdge,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Product image
            product.imageUrl.isNotEmpty
                ? Image.network(
                    product.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        Container(color: product.color),
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        color: product.color,
                        child: const Center(
                          child: CircularProgressIndicator(
                              color: AppColors.primaryGreen, strokeWidth: 2),
                        ),
                      );
                    },
                  )
                : Container(color: product.color),
            Positioned(
              top: 8,
              right: 8,
              child: ProductStockBadge(stock: product.stock, fontSize: 9),
            ),
            // Gradient overlay so text is readable
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.78),
                  ],
                  stops: const [0.35, 1.0],
                ),
              ),
            ),
            // Text content
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  Text(product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(product.monthlyPrice,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.primaryGreen,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _publicityCard(BuildContext context, Map<String, dynamic> publicity) {
    final String name = publicity['name']?.toString() ?? 'Publicité';
    final String imageUrl =
        ApiService.resolveImageUrl(publicity['imageUrl']?.toString());
    final String position = publicity['position']?.toString() ?? '';

    String merchant = '';
    final rawMerchant = publicity['merchant'];
    if (rawMerchant is Map<String, dynamic>) {
      merchant = rawMerchant['businessName']?.toString() ??
          rawMerchant['name']?.toString() ??
          '';
    } else if (rawMerchant is String) {
      merchant = rawMerchant;
    }

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PublicityDetailScreen(publicity: publicity),
          ),
        );
      },
      child: Container(
        width: 280,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Publicity image
            imageUrl.isNotEmpty
                ? Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.primaryGreen,
                            AppColors.primaryDark
                          ],
                        ),
                      ),
                    ),
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              AppColors.primaryGreen,
                              AppColors.primaryDark
                            ],
                          ),
                        ),
                        child: const Center(
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2),
                        ),
                      );
                    },
                  )
                : Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [AppColors.primaryGreen, AppColors.primaryDark],
                      ),
                    ),
                  ),
            // Gradient overlay for text readability
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.8),
                  ],
                  stops: const [0.4, 1.0],
                ),
              ),
            ),
            // Publicity badge
            Positioned(
              top: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'PUBLICITÉ',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            // Text content
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  Text(
                    name,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 2,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (merchant.isNotEmpty)
                    Text(
                      'par $merchant',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withOpacity(0.3)),
                    ),
                    child: const Text(
                      'Voir l\'offre',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
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

class _SlideshowItem {
  final String imageUrl;
  final String name;
  final String price;
  final String monthly;
  final Map<String, dynamic>? publicity;
  const _SlideshowItem({
    required this.imageUrl,
    required this.name,
    required this.price,
    required this.monthly,
    this.publicity,
  });
}

// ─── Show Transfer Bottom Sheet ───────────────────────────────────────────

void _showTransferSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _TransferBottomSheet(),
  );
}

// ─── Transfer Bottom Sheet ────────────────────────────────────────────────

class _TransferBottomSheet extends StatefulWidget {
  const _TransferBottomSheet();

  @override
  State<_TransferBottomSheet> createState() => _TransferBottomSheetState();
}

class _TransferBottomSheetState extends State<_TransferBottomSheet> {
  final _recipientCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  bool _isProcessing = false;
  String? _recipientName;
  bool _isVerifying = false;

  @override
  void dispose() {
    _recipientCtrl.dispose();
    _amountCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  void _verifyRecipient() async {
    final identifier = _recipientCtrl.text.trim();
    if (identifier.length < 3) return;

    setState(() => _isVerifying = true);

    try {
      // Search for user by phone or email
      final result = await ApiService.searchUser(identifier);
      setState(() {
        _recipientName = result?['fullName'];
        _isVerifying = false;
      });
    } catch (_) {
      setState(() {
        _recipientName = null;
        _isVerifying = false;
      });
    }
  }

  void _submit() async {
    final lang = LanguageService();
    final identifier = _recipientCtrl.text.trim();
    final amount = int.tryParse(_amountCtrl.text) ?? 0;
    final note = _noteCtrl.text.trim();

    if (identifier.isEmpty) {
      _showError(lang.errorEnterRecipient);
      return;
    }

    if (amount < 100) {
      _showError(lang.errorMinAmount);
      return;
    }

    setState(() => _isProcessing = true);

    try {
      final result = await ApiService.transferMoney(
        recipientIdentifier: identifier,
        amount: amount,
        note: note.isNotEmpty ? note : null,
      );

      if (result['success'] == true) {
        Navigator.pop(context);
        _showSuccess(lang.homeTransferSuccess(
            amount.toString(), result['recipientName'] ?? identifier));
      } else {
        _showError(result['message'] ?? 'Transfer failed');
      }
    } catch (e) {
      _showError(lang.errorTransferFailed);
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  void _showError(String message) {
    final lang = LanguageService();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(lang.errorGeneric),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showSuccess(String message) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle,
                color: AppColors.primaryGreen, size: 64),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageService();
    final theme = Theme.of(context);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Title
              Text(
                lang.homeTransferMoney,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                lang.homeTransferSubtitle,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 24),

              // Recipient field
              TextField(
                controller: _recipientCtrl,
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() => _recipientName = null),
                onEditingComplete: _verifyRecipient,
                decoration: InputDecoration(
                  labelText: lang.homeTransferRecipientLabel,
                  hintText: lang.homeTransferRecipientHint,
                  prefixIcon: const Icon(Icons.person_outline),
                  suffixIcon: _isVerifying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(Icons.search),
                          onPressed: _verifyRecipient,
                        ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              if (_recipientName != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle,
                          color: AppColors.primaryGreen, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${lang.recipient}: $_recipientName',
                          style: const TextStyle(
                              color: AppColors.primaryGreen,
                              fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),

              // Amount field
              TextField(
                controller: _amountCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: lang.homeTransferAmountLabel,
                  hintText: '100',
                  prefixIcon: const Icon(Icons.attach_money),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Note field (optional)
              TextField(
                controller: _noteCtrl,
                maxLength: 50,
                decoration: InputDecoration(
                  labelText: lang.homeTransferNoteLabel,
                  hintText: lang.homeTransferNoteHint,
                  prefixIcon: const Icon(Icons.edit_note),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Submit button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _isProcessing
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          lang.homeTransferButton,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  lang.homeTransferMinimum,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[500],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
