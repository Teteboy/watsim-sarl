import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/app_theme.dart';
import 'screens/home_screen.dart';
import 'screens/catalogue_screen.dart';
import 'screens/history_screen.dart';
import 'screens/referral_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/messaging_screen.dart';
import 'services/language_service.dart';
import 'notification_state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppColors.primaryDark,
    statusBarIconBrightness: Brightness.light,
  ));
  // Prevent uncaught widget errors (e.g. broken network images) from showing
  // red error boxes in release builds.
  ErrorWidget.builder = (FlutterErrorDetails details) {
    if (kDebugMode) {
      return ErrorWidget.withDetails(message: details.exceptionAsString());
    }
    return const SizedBox.shrink();
  };
  runApp(const WatsimApp());
}

class WatsimApp extends StatelessWidget {
  const WatsimApp({super.key});

  @override
  Widget build(BuildContext context) {
    return LanguageProvider(
      service: LanguageService(),
      child: MaterialApp(
        title: 'Watsim',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const SplashScreen(),
      ),
    );
  }
}

// ─── Main Shell with Bottom Navigation ────────────────────────────────────
class MainShell extends StatefulWidget {
  final int initialIndex;
  final int initialHistoryTab;
  const MainShell(
      {super.key, this.initialIndex = 0, this.initialHistoryTab = 0});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  late int _currentIndex;
  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _screens = [
      const HomeScreen(),
      const CatalogueScreen(),
      const MessagingScreen(),
      HistoryScreen(initialTab: widget.initialHistoryTab),
      const ReferralScreen(isNavTab: true),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
      ),
    );
  }
}

// ─── Shared Bottom Nav Bar ─────────────────────────────────────────────────
class AppBottomNav extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  State<AppBottomNav> createState() => _AppBottomNavState();
}

class _AppBottomNavState extends State<AppBottomNav> {
  int _msgBadge = 0;

  @override
  void initState() {
    super.initState();
    _msgBadge = NotificationState.instance.totalUnreadMessages;
    NotificationState.instance.addListener(_onChanged);
  }

  @override
  void dispose() {
    NotificationState.instance.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _msgBadge = NotificationState.instance.totalUnreadMessages;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryDark.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              Expanded(
                child: _NavItem(
                  icon: Icons.home_rounded,
                  label: lang.navHome,
                  selected: widget.currentIndex == 0,
                  onTap: () => widget.onTap(0),
                ),
              ),
              Expanded(
                child: _NavItem(
                  icon: Icons.grid_view_rounded,
                  label: lang.navShop,
                  selected: widget.currentIndex == 1,
                  onTap: () => widget.onTap(1),
                ),
              ),
              Expanded(
                child: _NavItem(
                  icon: Icons.chat_bubble_outline_rounded,
                  label: lang.navMessages,
                  selected: widget.currentIndex == 2,
                  badge: _msgBadge,
                  onTap: () => widget.onTap(2),
                ),
              ),
              Expanded(
                child: _NavItem(
                  icon: Icons.history_rounded,
                  label: lang.navHistory,
                  selected: widget.currentIndex == 3,
                  onTap: () => widget.onTap(3),
                ),
              ),
              Expanded(
                child: _NavItem(
                  icon: Icons.card_giftcard_rounded,
                  label: lang.navReferrals,
                  selected: widget.currentIndex == 4,
                  onTap: () => widget.onTap(4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        decoration: selected
            ? BoxDecoration(
                color: AppColors.deepTeal.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon,
                    size: 24,
                    color: selected ? AppColors.deepTeal : AppColors.textMuted),
                if (badge > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: AppColors.primaryGreen,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          badge > 9 ? '9+' : '$badge',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                softWrap: false,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                    color:
                        selected ? AppColors.deepTeal : AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
