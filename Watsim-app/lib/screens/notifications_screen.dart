import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../notification_state.dart';
import '../services/language_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  // Tab keys (internal logic stays English; display uses lang)
  String _tab = 'All';
  final _tabKeys = ['All', 'Transactions', 'BNPL', 'Promos'];

  @override
  void initState() {
    super.initState();
    NotificationState.instance.addListener(_onChanged);
    NotificationState.instance.syncWithBackend();
  }

  @override
  void dispose() {
    NotificationState.instance.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  List<AppNotification> get _filtered {
    final all = NotificationState.instance.notifications;
    if (_tab == 'All') return all;
    final map = {
      'Transactions': ['transaction'],
      'BNPL': ['bnpl'],
      'Promos': ['promo', 'reward', 'referral'],
    };
    return all.where((n) => (map[_tab] ?? []).contains(n.type)).toList();
  }

  Color _iconColor(int hex) => Color(hex);

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final unreadCount = NotificationState.instance.unreadCount;
    final tabLabels = [
      lang.tabAll,
      lang.tabTransactions,
      lang.filterBNPL,
      lang.tabPromos
    ];

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(lang.notificationsTitle),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          if (unreadCount > 0)
            TextButton(
              onPressed: () => NotificationState.instance.markAllRead(),
              child: Text(lang.markAllRead,
                  style: const TextStyle(
                      color: AppColors.primaryGreen,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Unread badge strip
          if (unreadCount > 0)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: AppColors.primaryGreen.withOpacity(0.08),
              child: Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('$unreadCount ${lang.unread}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),

          // Filter tabs
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: List.generate(_tabKeys.length, (i) {
                  final key = _tabKeys[i];
                  final label = tabLabels[i];
                  final sel = key == _tab;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _tab = key),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 6),
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
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: sel
                                    ? Colors.white
                                    : AppColors.textSecondary)),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
          const SizedBox(height: 8),

          // List
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primaryGreen,
              onRefresh: () => NotificationState.instance.syncWithBackend(),
              child: NotificationState.instance.isLoading && _filtered.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: const [
                        SizedBox(
                          height: 200,
                          child: Center(
                              child: CircularProgressIndicator(
                                  color: AppColors.primaryGreen)),
                        ),
                      ],
                    )
                  : _filtered.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          children: [_emptyState(lang)],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final n = _filtered[i];
                            return Dismissible(
                              key: ValueKey(n.id),
                              direction: n.isRead
                                  ? DismissDirection.endToStart
                                  : DismissDirection.none,
                              background: Container(
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                decoration: BoxDecoration(
                                  color: Colors.redAccent,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(Icons.delete_outline,
                                    color: Colors.white),
                              ),
                              onDismissed: (_) => NotificationState.instance
                                  .deleteNotification(n.id),
                              child: GestureDetector(
                                onTap: () =>
                                    NotificationState.instance.markRead(n.id),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: !n.isRead
                                        ? AppColors.primaryGreen
                                            .withOpacity(0.04)
                                        : AppColors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: !n.isRead
                                          ? AppColors.primaryGreen
                                              .withOpacity(0.2)
                                          : const Color(0xFFE8F2F1),
                                      width: !n.isRead ? 1.5 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 42,
                                        height: 42,
                                        decoration: BoxDecoration(
                                          color: _iconColor(n.iconColor)
                                              .withOpacity(0.12),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Icon(
                                          IconData(n.iconCodePoint,
                                              fontFamily: 'MaterialIcons'),
                                          color: _iconColor(n.iconColor),
                                          size: 20,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(n.title,
                                                      style: TextStyle(
                                                          fontSize: 14,
                                                          fontWeight: !n.isRead
                                                              ? FontWeight.w700
                                                              : FontWeight.w600,
                                                          color: AppColors
                                                              .textPrimary)),
                                                ),
                                                if (!n.isRead)
                                                  Container(
                                                    width: 8,
                                                    height: 8,
                                                    decoration:
                                                        const BoxDecoration(
                                                      color: AppColors
                                                          .primaryGreen,
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(n.body,
                                                style: const TextStyle(
                                                    fontSize: 13,
                                                    color:
                                                        AppColors.textSecondary,
                                                    height: 1.4),
                                                maxLines: 2,
                                                overflow:
                                                    TextOverflow.ellipsis),
                                            const SizedBox(height: 6),
                                            Text(
                                                _relativeTime(
                                                    n.timestamp, lang),
                                                style: const TextStyle(
                                                    fontSize: 11,
                                                    color:
                                                        AppColors.textMuted)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }

  String _relativeTime(DateTime dt, LanguageService lang) {
    final diff = DateTime.now().difference(dt);
    final m = diff.inMinutes;
    final h = diff.inHours;
    final d = diff.inDays;
    if (diff.inSeconds < 60) return lang.justNow;
    if (m < 60) {
      return lang.isFrench ? 'il y a $m min' : '$m${lang.minutesAgo} ago';
    }
    if (h < 24) {
      return lang.isFrench ? 'il y a $h h' : '$h${lang.hoursAgo} ago';
    }
    if (d == 1) return lang.yesterday;
    return lang.isFrench ? 'il y a $d jours' : '$d${lang.daysAgo} ago';
  }

  Widget _emptyState(LanguageService lang) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_off_outlined,
              size: 56, color: AppColors.textMuted.withOpacity(0.4)),
          const SizedBox(height: 12),
          Text(lang.noNotificationsHere,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 14)),
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
