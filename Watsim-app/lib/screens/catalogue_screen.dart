import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import 'bnpl_simulator_screen.dart';
import '../notification_state.dart';
import 'notifications_screen.dart';
import 'messaging_screen.dart';
import 'wallet_screen.dart';
import '../order_state.dart';

// ─── Product model ─────────────────────────────────────────────────────────
class Product {
  final String? id;
  final String? merchantId;
  final String name;
  final String price;
  final String monthlyPrice;
  final IconData icon;
  final String category;
  final double cashback;
  final Color color;
  final String imageUrl;
  final List<Color> imageGradient;
  final List<String> imageUrls; // multiple images for detail gallery
  
  // Extended fields from backend
  final String? description;
  final int? stock;
  final String? merchantName;
  final bool? bnplEligible;

  const Product({
    this.id,
    this.merchantId,
    required this.name,
    required this.price,
    required this.monthlyPrice,
    required this.icon,
    required this.category,
    required this.cashback,
    required this.color,
    required this.imageUrl,
    required this.imageGradient,
    this.imageUrls = const [],
    this.description,
    this.stock,
    this.merchantName,
    this.bnplEligible,
  });

  /// Build a Product from a backend API JSON response.
  factory Product.fromJson(Map<String, dynamic> json) {
    final priceInt = (json['price'] as num?)?.toInt() ?? 0;
    final catMap = json['category'] as Map<String, dynamic>?;
    final catName = catMap?['name'] as String? ?? (json['categoryName'] as String? ?? 'General');
    final rawImgUrl = json['imageUrl'] as String? ?? '';
    final resolvedImgUrl = ApiService.resolveImageUrl(rawImgUrl);
    final imgUrl = resolvedImgUrl.isNotEmpty ? resolvedImgUrl : 'https://picsum.photos/400/400.webp';
    // Monthly: approximate as price / 3 months
    final monthly = (priceInt / 3).round();
    final fmt = _formatPriceInt;
    
    // Parse gallery images from backend
    final List<String> galleryUrls = [];
    final galleryList = json['gallery'] as List<dynamic>?;
    if (galleryList != null && galleryList.isNotEmpty) {
      for (final item in galleryList) {
        if (item is Map<String, dynamic>) {
          final galleryUrl = ApiService.resolveImageUrl(item['imageUrl'] as String?);
          if (galleryUrl.isNotEmpty) {
            galleryUrls.add(galleryUrl);
          }
        }
      }
    }
    
    // If no gallery, use main image as fallback
    final imageUrls = galleryUrls.isNotEmpty ? galleryUrls : [imgUrl];
    
    // Parse merchant name from nested object
    final merchantMap = json['merchant'] as Map<String, dynamic>?;
    final merchantName = merchantMap?['businessName'] as String? ?? 
                        merchantMap?['name'] as String?;
    
    return Product(
      id: json['id'] as String?,
      merchantId: merchantMap?['id'] as String? ?? json['merchantId'] as String?,
      name: json['name'] as String? ?? 'Product',
      price: '${fmt(priceInt)} FCFA',
      monthlyPrice: 'from ${fmt(monthly)} FCFA/month',
      icon: Icons.inventory_2_rounded,
      category: catName,
      cashback: 0,
      color: const Color(0xFF014945),
      imageUrl: imgUrl,
      imageGradient: const [Color(0xFF014945), Color(0xFF014A41)],
      imageUrls: imageUrls,
      description: json['description'] as String?,
      stock: (json['stock'] as num?)?.toInt(),
      merchantName: merchantName,
      bnplEligible: json['bnplEligible'] as bool? ?? true,
    );
  }

  static String _formatPriceInt(int v) {
    if (v < 1000) return '$v';
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r';
  }

  /// Parses the price string (e.g. "249,000 FCFA") to an integer.
  int get priceValue {
    final cleaned = price.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(cleaned) ?? 0;
  }
}

// ─── Catalogue Screen ──────────────────────────────────────────────────────
class CatalogueScreen extends StatefulWidget {
  const CatalogueScreen({
    super.key,
    this.exchangeMode = false,
    this.exchangeSourceOrder,
    this.onProductSelectedForExchange,
  });

  final bool exchangeMode;
  final ConfirmedOrder? exchangeSourceOrder;
  final void Function(Product)? onProductSelectedForExchange;

  @override
  State<CatalogueScreen> createState() => _CatalogueScreenState();
}

class _CatalogueScreenState extends State<CatalogueScreen> {
  String _category = 'All';
  String _searchQuery = '';
  final _searchController = TextEditingController();
  // Internal keys — display labels come from lang in build
  List<String> _categoryKeys = ['All'];

  // Products loaded from backend only
  List<Product> _backendProducts = [];
  bool _loadingProducts = true;

  List<Product> get _allProducts => _backendProducts;

  @override
  void initState() {
    super.initState();
    NotificationState.instance.addListener(_rebuild);
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final raw = await ApiService.fetchProducts(limit: 50);
      if (!mounted) return;
      final loaded = raw
          .whereType<Map<String, dynamic>>()
          .map((j) => Product.fromJson(j))
          .toList();
      final cats = <String>{'All'};
      for (final p in loaded) cats.add(p.category);
      setState(() {
        _backendProducts = loaded;
        _categoryKeys = cats.toList();
        _loadingProducts = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loadingProducts = false; });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    NotificationState.instance.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  List<Product> get _filtered {
    var list = _category == 'All'
        ? _allProducts
        : _allProducts.where((p) => p.category == _category).toList();

    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list
          .where((p) =>
              p.name.toLowerCase().contains(q) ||
              p.category.toLowerCase().contains(q) ||
              p.price.toLowerCase().contains(q))
          .toList();
    }

    return list;
  }

  String _catLabel(String key, dynamic lang) {
    switch (key) {
      case 'All': return lang.catAll;
      case 'Electronics': return lang.catElectronics;
      case 'Accessories': return lang.catAccessories;
      case 'Kitchen': return lang.catKitchen;
      case 'Sports': return lang.catSports;
      default: return key;
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final results = _filtered;
    final notifCount = NotificationState.instance.unreadCount;

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        automaticallyImplyLeading: false,
        title: null,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined,
                color: Colors.white),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
          ),
          // ── Notification bell with badge ──────────────────────
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined,
                      color: Colors.white),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const NotificationsScreen()),
                  ),
                ),
                if (notifCount > 0)
                  Positioned(
                    right: 4,
                    top: 4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryGreen,
                        shape: BoxShape.circle,
                      ),
                      constraints:
                          const BoxConstraints(minWidth: 18, minHeight: 18),
                      child: Text(
                        '$notifCount',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Exchange mode banner ────────────────────────────────
          if (widget.exchangeMode)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF1A3A2A), Color(0xFF0D5E3F)],
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.swap_horiz_rounded, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Select a product to exchange — your paid amount carries over',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
          // ── Search bar ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: InputDecoration(
                hintText: lang.searchForProduct,
                prefixIcon: const Icon(Icons.search_rounded,
                    color: AppColors.textMuted),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded,
                            color: AppColors.textMuted, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                fillColor: AppColors.white,
                filled: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFD0E8E5)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFD0E8E5)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide:
                      const BorderSide(color: AppColors.primaryGreen, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Category chips ──────────────────────────────────────
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categoryKeys.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final key = _categoryKeys[i];
                final label = _catLabel(key, lang);
                final sel = key == _category;
                return GestureDetector(
                  onTap: () => setState(() => _category = key),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: sel ? AppColors.primaryGreen : AppColors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: sel
                            ? AppColors.primaryGreen
                            : const Color(0xFFD0E8E5),
                      ),
                    ),
                    child: Text(label,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color:
                                sel ? Colors.white : AppColors.textSecondary)),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 6),

          // ── Results count ───────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Text(
                  _searchQuery.isNotEmpty
                      ? '${results.length} ${lang.resultsFor} "$_searchQuery"'
                      : '${results.length} ${lang.productsCount}',
                  style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),

          // ── Product grid or empty state ─────────────────────────
          Expanded(
            child: _loadingProducts
                ? const Center(child: CircularProgressIndicator(color: AppColors.primaryGreen))
                : results.isEmpty
                    ? _EmptySearchState(query: _searchQuery, lang: lang)
                    : RefreshIndicator(
                        color: AppColors.primaryGreen,
                        onRefresh: _loadProducts,
                        child: GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 0.68,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                          ),
                          itemCount: results.length,
                          itemBuilder: (_, i) => _ProductCard(
                            product: results[i],
                            exchangeMode: widget.exchangeMode,
                            onSelectForExchange: widget.onProductSelectedForExchange,
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ─── Empty Search State ────────────────────────────────────────────────────
class _EmptySearchState extends StatelessWidget {
  final String query;
  final LanguageService lang;
  const _EmptySearchState({required this.query, required this.lang});

  @override
  Widget build(BuildContext context) {
    return Center(
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
            child: const Icon(Icons.search_off_rounded,
                size: 40, color: AppColors.primaryGreen),
          ),
          const SizedBox(height: 16),
          Text('${lang.noResultsFor} "$query"',
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 6),
          Text(lang.tryDifferentKeyword,
              style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

// ─── Product Card ──────────────────────────────────────────────────────────
class _ProductCard extends StatefulWidget {
  final Product product;
  final bool exchangeMode;
  final void Function(Product)? onSelectForExchange;

  const _ProductCard({
    required this.product,
    this.exchangeMode = false,
    this.onSelectForExchange,
  });

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.07).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;

    final isExchange = widget.exchangeMode;

    void handleTap() {
      if (isExchange) {
        widget.onSelectForExchange?.call(product);
      } else {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ProductDetailScreen(product: product)),
        );
      }
    }

    return GestureDetector(
      onTap: handleTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: isExchange
              ? Border.all(color: const Color(0xFF0D5E3F).withOpacity(0.35), width: 1.5)
              : null,
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryDark.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Product image ───────────────────────────────────
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: _ProductImage(product: product, height: 130),
            ),

            // ── Info ────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name,
                        style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(product.price,
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen)),
                    const SizedBox(height: 1),
                    Text(product.monthlyPrice,
                        style: const TextStyle(
                            fontSize: 9.5, color: AppColors.textMuted),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    const Spacer(),
                    // ── Action button (pulsing in normal mode, solid in exchange) ──
                    Builder(builder: (ctx) {
                      final lang = LanguageProvider.of(ctx);
                      if (isExchange) {
                        return GestureDetector(
                          onTap: handleTap,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 7),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF0D5E3F), Color(0xFF1A8A5A)],
                              ),
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0D5E3F).withOpacity(0.4),
                                  blurRadius: 8,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.swap_horiz_rounded,
                                    color: Colors.white, size: 13),
                                SizedBox(width: 4),
                                Text(
                                  'SELECT',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5),
                                ),
                              ],
                            ),
                          ),
                        );
                      }
                      return GestureDetector(
                      onTap: handleTap,
                      child: ScaleTransition(
                        scale: _pulseAnim,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          decoration: BoxDecoration(
                            color: AppColors.primaryGreen,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primaryGreen.withOpacity(0.45),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                lang.saveNow.toUpperCase(),
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );})

                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Product Image (real photo, fallback to gradient) ─────────────────────
class _ProductImage extends StatelessWidget {
  final Product product;
  final double height;
  const _ProductImage({required this.product, required this.height});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Stack(
        children: [
          // Real product image
          Positioned.fill(
            child: Image.network(
              product.imageUrl,
              fit: BoxFit.cover,
              loadingBuilder: (_, child, progress) {
                if (progress == null) return child;
                return Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: product.imageGradient,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: const Center(
                    child: CircularProgressIndicator(
                        color: Colors.white38, strokeWidth: 2),
                  ),
                );
              },
              errorBuilder: (_, __, ___) => Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: product.imageGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Icon(product.icon,
                    size: height * 0.4, color: Colors.white38),
              ),
            ),
          ),

          // Dark gradient overlay at bottom for readability
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.45,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.45),
                  ],
                ),
              ),
            ),
          ),

          // Stock badge backed by backend product.stock
          Positioned(
            top: 8,
            left: 8,
            child: ProductStockBadge(stock: product.stock, fontSize: 9),
          ),
        ],
      ),
    );
  }
}

// ─── Product Detail Screen ─────────────────────────────────────────────────
class ProductDetailScreen extends StatefulWidget {
  final Product product;
  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _currentImageIndex = 0;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _rebuild() => setState(() {});

  List<String> get _images {
    final urls = widget.product.imageUrls;
    return urls.isNotEmpty ? urls : [widget.product.imageUrl];
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final product = widget.product;
    final images = _images;

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      body: CustomScrollView(
        slivers: [
          // ── Collapsing image gallery header ──────────────────────
          SliverAppBar(
            expandedHeight: 320,
            pinned: true,
            backgroundColor: AppColors.primaryDark,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: Colors.white, size: 20),
              onPressed: () => Navigator.pop(context),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: _ImageGallery(
                images: images,
                product: product,
                pageController: _pageController,
                currentIndex: _currentImageIndex,
                onPageChanged: (i) => setState(() => _currentImageIndex = i),
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Dot indicators ──────────────────────────────
                  if (images.length > 1)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(
                            images.length,
                            (i) => AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              width: i == _currentImageIndex ? 20 : 7,
                              height: 7,
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              decoration: BoxDecoration(
                                color: i == _currentImageIndex
                                    ? AppColors.primaryGreen
                                    : AppColors.primaryGreen.withOpacity(0.25),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // ── Thumbnail strip ─────────────────────────────
                  if (images.length > 1) ...[
                    SizedBox(
                      height: 64,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: images.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final selected = i == _currentImageIndex;
                          return GestureDetector(
                            onTap: () {
                              _pageController.animateToPage(i,
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 64,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.primaryGreen
                                      : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  images[i],
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    color: product.imageGradient.first,
                                    child: Icon(product.icon,
                                        size: 24, color: Colors.white38),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  const SizedBox(height: 12),
                  Text(product.name,
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(product.price,
                      style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryGreen)),
                  Text(product.monthlyPrice,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary)),
                  const SizedBox(height: 8),
                  ProductStockBadge(stock: product.stock),
                  const SizedBox(height: 20),
                  // Product info card with merchant and stock
                  AppCard(
                    child: Column(
                      children: [
                        if (product.merchantName != null)
                          _feature(Icons.store_outlined, 'Vendeur: ${product.merchantName}'),
                        if (product.stock != null)
                          _feature(Icons.inventory_2_outlined, 'Stock: ${product.stock} disponibles'),
                        _feature(Icons.check_circle_rounded, lang.freeDelivery),
                        _feature(Icons.shield_rounded, lang.warranty12),
                        if (product.bnplEligible == true)
                          _feature(Icons.credit_score_outlined, 'BNPL éligible'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(lang.description,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(
                    product.description ?? '${lang.enjoyProduct} ${product.name} ${lang.bnplPaymentDesc}',
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.6),
                  ),
                  const SizedBox(height: 28),
                  const SizedBox(height: 80), // space for floating BNPL button
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          const int creditLimit = 150000;
          final activeOrders = OrderState.instance.orders
              .where((o) => !o.isDemo && !o.isFullyPaid)
              .toList();
          final int usedCredit =
              activeOrders.fold(0, (sum, o) => sum + o.basePrice);
          final int productPrice = product.priceValue;

          // Case 1: no active product but price exceeds the max contribution
          if (activeOrders.isEmpty && productPrice > creditLimit) {
            showDialog(
              context: context,
              builder: (_) => AlertDialog(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18)),
                icon: const Icon(Icons.price_change_rounded,
                    color: Colors.orange, size: 36),
                title: Text(lang.maxContribTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                content: Text(lang.maxContribBody,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14, color: AppColors.textSecondary)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.chooseAnotherProduct),
                  ),
                ],
              ),
            );
            return;
          }

          // Case 2: has active order and adding this product would exceed limit
          if (activeOrders.isNotEmpty &&
              usedCredit + productPrice > creditLimit) {
            showDialog(
              context: context,
              builder: (_) => AlertDialog(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18)),
                icon: const Icon(Icons.warning_amber_rounded,
                    color: Colors.orange, size: 36),
                title: Text(lang.activeOrderTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                content: Text(lang.activeOrderBody,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14, color: AppColors.textSecondary)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.gotIt),
                  ),
                ],
              ),
            );
            return;
          }
          Navigator.push(context,
              MaterialPageRoute(
                  builder: (_) => BnplSimulatorScreen(product: product)));
        },
        backgroundColor: AppColors.primaryGreen,
        label: Text(
          lang.simulateBnpl,
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _feature(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primaryGreen),
          const SizedBox(width: 10),
          Text(text,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

// ─── Image Gallery (swipeable, full-width) ────────────────────────────────
class _ImageGallery extends StatelessWidget {
  final List<String> images;
  final Product product;
  final PageController pageController;
  final int currentIndex;
  final ValueChanged<int> onPageChanged;

  const _ImageGallery({
    required this.images,
    required this.product,
    required this.pageController,
    required this.currentIndex,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Swipeable image pages
        PageView.builder(
          controller: pageController,
          onPageChanged: onPageChanged,
          itemCount: images.length,
          itemBuilder: (_, i) => Image.network(
            images[i],
            fit: BoxFit.cover,
            width: double.infinity,
            loadingBuilder: (_, child, progress) {
              if (progress == null) return child;
              return Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: product.imageGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: const Center(
                  child: CircularProgressIndicator(
                      color: Colors.white38, strokeWidth: 2),
                ),
              );
            },
            errorBuilder: (_, __, ___) => Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: product.imageGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Icon(product.icon, size: 80, color: Colors.white38),
            ),
          ),
        ),

        // Bottom gradient for readability
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withOpacity(0.5),
                ],
              ),
            ),
          ),
        ),

        // Image counter badge
        if (images.length > 1)
          Positioned(
            bottom: 14,
            right: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.55),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.photo_library_outlined,
                      color: Colors.white70, size: 13),
                  const SizedBox(width: 4),
                  Text(
                    '${currentIndex + 1} / ${images.length}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),


      ],
    );
  }
}

// ─── BNPL Orders Screen ────────────────────────────────────────────────────
class BnplOrdersScreen extends StatefulWidget {
  const BnplOrdersScreen({super.key});

  @override
  State<BnplOrdersScreen> createState() => _BnplOrdersScreenState();
}

class _BnplOrdersScreenState extends State<BnplOrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(lang.myBnplOrders),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.primaryGreen,
          labelColor: AppColors.primaryGreen,
          unselectedLabelColor: Colors.white60,
          tabs: [
            Tab(text: lang.tabActive),
            Tab(text: lang.tabCompleted),
            Tab(text: lang.tabCancelled),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _orderList(active: true),
          _orderList(active: false),
          _emptyState(lang.noCancelledOrders),
        ],
      ),
    );
  }

  Widget _orderList({required bool active}) {
    final orders = active
        ? [
            _OrderData('Smartphone Samsung S23', '6/12', '15 000 FCFA',
                AppColors.warning, 'IN PROGRESS'),
            _OrderData('MacBook Air M2', '1/12', '45 000 FCFA',
                AppColors.primaryGreen, 'ACTIVE'),
            _OrderData('Sony WH-1000XM5', '2/3', '83 000 FCFA',
                AppColors.primaryGreen, 'ACTIVE'),
          ]
        : [
            _OrderData('Nike Air Zoom', '6/6', '95,000 FCFA',
                AppColors.secondaryGreen, 'SETTLED'),
            _OrderData('Nespresso Vertuo', '4/4', '155,000 FCFA',
                AppColors.secondaryGreen, 'SETTLED'),
          ];

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _OrderCard(order: orders[i]),
    );
  }

  Widget _emptyState(String msg) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inventory_2_outlined,
              size: 56, color: AppColors.textMuted.withOpacity(0.5)),
          const SizedBox(height: 12),
          Text(msg,
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 14)),
        ],
      ),
    );
  }
}

class _OrderData {
  final String name;
  final String progress;
  final String amount;
  final Color color;
  final String status;
  const _OrderData(
      this.name, this.progress, this.amount, this.color, this.status);
}

class _OrderCard extends StatelessWidget {
  final _OrderData order;
  const _OrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final parts = order.progress.split('/');
    final current = int.parse(parts[0]);
    final total = int.parse(parts[1]);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(order.name,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
              ),
              StatusChip(
                label: order.status,
                color: order.color.withOpacity(0.12),
                textColor: order.color,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${lang.instalment} $current ${lang.of} $total',
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textSecondary)),
              Text(order.amount,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
            ],
          ),
          const SizedBox(height: 8),
          AppProgressBar(
            value: current / total,
            color: order.color,
          ),
          const SizedBox(height: 4),
          Text('$current ${lang.of} $total ${lang.paymentsMade}',
              style: const TextStyle(
                  fontSize: 11, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}
