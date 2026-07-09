import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import 'messaging_screen.dart';

// ─── Help & Support Screen ────────────────────────────────────────────────
class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  int? _expandedFaq;
  List<Map<String, dynamic>> _faqs = [];
  List<Map<String, dynamic>> _tickets = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ApiService.getFAQ(),
        ApiService.getSupportTickets(),
      ]);
      if (mounted) {
        setState(() {
          _faqs = results[0] as List<Map<String, dynamic>>;
          _tickets = results[1] as List<Map<String, dynamic>>;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _createTicket(String category, String subject, String description) async {
    try {
      await ApiService.createSupportTicket(
        category: category,
        subject: subject,
        description: description,
      );
      if (mounted) {
        final lang = LanguageProvider.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(lang.ticketCreated),
            backgroundColor: AppColors.primaryGreen,
          ),
        );
        _loadData(); // Refresh tickets
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create ticket: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _openChat() async {
    try {
      final conversationId = await ApiService.getOrCreateSupportConversation();
      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatScreen(convId: conversationId),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to open chat: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _showCreateTicketDialog() {
    final lang = LanguageProvider.of(context);
    final subjectController = TextEditingController();
    final descriptionController = TextEditingController();
    String selectedCategory = 'GENERAL';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(lang.submitTicket),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedCategory,
                decoration: const InputDecoration(labelText: 'Category'),
                items: const [
                  DropdownMenuItem(value: 'GENERAL', child: Text('General')),
                  DropdownMenuItem(value: 'TECHNICAL', child: Text('Technical')),
                  DropdownMenuItem(value: 'BILLING', child: Text('Billing')),
                  DropdownMenuItem(value: 'ACCOUNT', child: Text('Account')),
                  DropdownMenuItem(value: 'FRAUD', child: Text('Fraud')),
                ],
                onChanged: (v) => selectedCategory = v!,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: subjectController,
                decoration: const InputDecoration(labelText: 'Subject'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 4,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (subjectController.text.isNotEmpty &&
                  descriptionController.text.isNotEmpty) {
                Navigator.pop(context);
                _createTicket(
                  selectedCategory,
                  subjectController.text,
                  descriptionController.text,
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
            ),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.helpSupport, showBack: true),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primaryGreen),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.helpSupport, showBack: true),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              const Text(
                'Failed to load help data',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadData,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
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

    // Build FAQ from backend or fallback to local
    final faqs = _faqs.isNotEmpty
        ? _faqs.map((f) => (f['question'] as String, f['answer'] as String)).toList()
        : [
            (lang.faqQ1, lang.faqA1),
            (lang.faqQ2, lang.faqA2),
            (lang.faqQ3, lang.faqA3),
            (lang.faqQ4, lang.faqA4),
            (lang.faqQ5, lang.faqA5),
          ];

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.helpSupport, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Contact cards ──────────────────────────────────────────────
            _sectionLabel(lang.contactUs),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _ContactCard(
                    icon: Icons.chat_bubble_outline_rounded,
                    color: AppColors.primaryGreen,
                    title: lang.liveChat,
                    subtitle: lang.liveChatSub,
                    onTap: _openChat,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ContactCard(
                    icon: Icons.phone_outlined,
                    color: const Color(0xFF1565C0),
                    title: lang.callUs,
                    subtitle: lang.callUsSub,
                    onTap: () => _showComingSoon(context, lang),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _ContactCard(
                    icon: Icons.email_outlined,
                    color: AppColors.warning,
                    title: lang.emailUs,
                    subtitle: lang.emailUsSub,
                    onTap: () => _showComingSoon(context, lang),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ContactCard(
                    icon: Icons.description_outlined,
                    color: AppColors.textSecondary,
                    title: lang.submitTicket,
                    subtitle: lang.submitTicketSub,
                    onTap: _showCreateTicketDialog,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── FAQ ────────────────────────────────────────────────────────
            _sectionLabel(lang.faqTitle),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE8F2F1)),
              ),
              child: Column(
                children: faqs.asMap().entries.map((e) {
                  final idx = e.key;
                  final q = e.value.$1;
                  final a = e.value.$2;
                  final isLast = idx == faqs.length - 1;
                  final isOpen = _expandedFaq == idx;

                  return Column(
                    children: [
                      InkWell(
                        onTap: () =>
                            setState(() => _expandedFaq = isOpen ? null : idx),
                        borderRadius: BorderRadius.vertical(
                          top: idx == 0
                              ? const Radius.circular(16)
                              : Radius.zero,
                          bottom: isLast
                              ? const Radius.circular(16)
                              : Radius.zero,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(q,
                                    style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: isOpen
                                            ? AppColors.primaryGreen
                                            : AppColors.textPrimary)),
                              ),
                              AnimatedRotation(
                                turns: isOpen ? 0.5 : 0,
                                duration: const Duration(milliseconds: 200),
                                child: Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  color: isOpen
                                      ? AppColors.primaryGreen
                                      : AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      AnimatedCrossFade(
                        firstChild: const SizedBox.shrink(),
                        secondChild: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                          child: Text(a,
                              style: const TextStyle(
                                  fontSize: 13,
                                  height: 1.6,
                                  color: AppColors.textSecondary)),
                        ),
                        crossFadeState: isOpen
                            ? CrossFadeState.showSecond
                            : CrossFadeState.showFirst,
                        duration: const Duration(milliseconds: 200),
                      ),
                      if (!isLast) const Divider(height: 1, indent: 16),
                    ],
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 24),

            // ── My Tickets ───────────────────────────────────────────────
            _sectionLabel(lang.myTickets),
            const SizedBox(height: 8),
            if (_tickets.isEmpty)
              AppCard(
                child: Row(
                  children: [
                    const Icon(Icons.confirmation_num_outlined,
                        color: AppColors.textMuted),
                    const SizedBox(width: 12),
                    Text(lang.noTickets,
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.textSecondary)),
                  ],
                ),
              )
            else
              Column(
                children: _tickets.asMap().entries.map((e) {
                  final ticket = e.value;
                  final isLast = e.key == _tickets.length - 1;
                  final status = (ticket['status'] ?? 'OPEN').toString();
                  final priority = (ticket['priority'] ?? 'MEDIUM').toString();
                  final subject = (ticket['subject'] ?? 'No subject').toString();
                  final createdAt = ticket['createdAt'] != null
                      ? DateTime.parse(ticket['createdAt'].toString())
                      : null;

                  Color statusColor;
                  switch (status) {
                    case 'OPEN':
                      statusColor = AppColors.warning;
                      break;
                    case 'IN_PROGRESS':
                      statusColor = const Color(0xFF1565C0);
                      break;
                    case 'RESOLVED':
                    case 'CLOSED':
                      statusColor = AppColors.primaryGreen;
                      break;
                    default:
                      statusColor = AppColors.textMuted;
                  }

                  return Padding(
                    padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                    child: AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  subject,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: statusColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: statusColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Text(
                                '${lang.priorityLabel}: ',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              Text(
                                priority,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              if (createdAt != null) ...[
                                const Spacer(),
                                Text(
                                  '${createdAt.day}/${createdAt.month}/${createdAt.year}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            const SizedBox(height: 24),

            // ── Operating hours ────────────────────────────────────────────
            _sectionLabel(lang.operatingHours),
            const SizedBox(height: 8),
            AppCard(
              child: Column(
                children: [
                  _HoursRow(
                      day: lang.monFri,
                      hours: '08:00 – 20:00',
                      active: true),
                  const Divider(height: 1),
                  _HoursRow(day: lang.saturday, hours: '09:00 – 17:00'),
                  const Divider(height: 1),
                  _HoursRow(day: lang.sunday, hours: lang.closed),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(
        text.toUpperCase(),
        style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
            letterSpacing: 1),
      );

  void _showComingSoon(BuildContext context, LanguageService lang) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(children: [
          const Icon(Icons.info_outline_rounded, color: Colors.white),
          const SizedBox(width: 10),
          Text(lang.comingSoon),
        ]),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

// ─── Contact card ─────────────────────────────────────────────────────────
class _ContactCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _ContactCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE8F2F1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 10),
            Text(title,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

// ─── Hours row ────────────────────────────────────────────────────────────
class _HoursRow extends StatelessWidget {
  final String day;
  final String hours;
  final bool active;

  const _HoursRow({required this.day, required this.hours, this.active = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(day,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textPrimary)),
          Text(hours,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active
                      ? AppColors.primaryGreen
                      : AppColors.textSecondary)),
        ],
      ),
    );
  }
}
