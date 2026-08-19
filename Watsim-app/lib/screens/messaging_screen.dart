import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../notification_state.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';

// ─── Messaging Screen (Conversation List) ────────────────────────────────
class MessagingScreen extends StatefulWidget {
  const MessagingScreen({super.key});

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  bool _searchVisible = false;

  bool _loading = true;
  List<Conversation> _conversations = [];

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(
        () => setState(() => _query = _searchCtrl.text.toLowerCase()));
    _conversations = [];
    _loadConversations();
    // Initialize WebSocket for real-time messaging
    WebSocketService.instance.connect();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    WebSocketService.instance.disconnect();
    super.dispose();
  }

  Future<void> _loadConversations() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.fetchConversations();
      final mapped = raw
          .map((e) {
            final id = (e['id'] ?? e['conversationId'] ?? '').toString();
            final title = (e['title'] ?? e['name'] ?? id).toString();
            final unread = (e['unreadCount'] ?? e['unread'] ?? 0);
            final last = e['lastMessage'] as Map<String, dynamic>?;
            final List<AppMessage> messages = [];
            if (last != null) {
              final tsRaw = last['createdAt'] ?? last['created_at'];
              DateTime ts;
              if (tsRaw is String) {
                ts = DateTime.tryParse(tsRaw) ?? DateTime.now();
              } else if (tsRaw is int) {
                ts = DateTime.fromMillisecondsSinceEpoch(tsRaw);
              } else {
                ts = DateTime.now();
              }
              messages.add(AppMessage(
                id: last['id']?.toString() ?? '${id}_last',
                conversationId: id,
                text: (last['text'] ?? last['body'] ?? '').toString(),
                isMe: false,
                timestamp: ts,
              ));
            }
            final isSupport = title.toLowerCase().contains('watsim support');
            return Conversation(
              id: id,
              name: title,
              iconCodePoint: (e['iconCodePoint'] ?? 0xe7fd) as int,
              iconColor: (e['iconColor'] ?? 0xFF1A5F7A) as int,
              isSystem: isSupport || (e['isSystem'] ?? false) as bool,
              messages: messages,
              unreadCount: unread is num ? unread.toInt() : 0,
            );
          })
          .where((c) => c.id.isNotEmpty)
          .toList();

      // Add backend conversations to global state so ChatScreen can resolve them.
      NotificationState.instance.syncConversations(mapped);

      if (!mounted) return;
      setState(() {
        _conversations = mapped;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _conversations = [];
        _loading = false;
      });
    }
  }

  List<Conversation> get _filtered {
    if (_query.isEmpty) return _conversations;
    return _conversations
        .where((c) => c.name.toLowerCase().contains(_query))
        .toList();
  }

  void _openNewChat(BuildContext context) {
    final phoneCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NewChatSheet(phoneCtrl: phoneCtrl, nameCtrl: nameCtrl),
    ).then((_) => _loadConversations());
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final convs = _filtered;

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: AppColors.primaryDark,
        title: Text(lang.messagesTitle),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          IconButton(
            icon: Icon(
              _searchVisible ? Icons.search_off_rounded : Icons.search_rounded,
              color: Colors.white,
            ),
            onPressed: () {
              setState(() {
                _searchVisible = !_searchVisible;
                if (!_searchVisible) {
                  _searchCtrl.clear();
                  _query = '';
                }
              });
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
            color: AppColors.white,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            onSelected: (value) {
              switch (value) {
                case 'mark_all_read':
                  NotificationState.instance.markAllRead();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Row(children: [
                        const Icon(Icons.done_all_rounded,
                            color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Text(lang.allMarkedAsRead),
                      ]),
                      backgroundColor: AppColors.primaryGreen,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  );
                  break;
                case 'settings':
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const _ChatSettingsSheet(),
                  );
                  break;
              }
            },
            itemBuilder: (ctx) {
              final l = LanguageProvider.of(ctx);
              return [
                PopupMenuItem(
                  value: 'mark_all_read',
                  child: Row(children: [
                    const Icon(Icons.done_all_rounded,
                        size: 18, color: AppColors.textSecondary),
                    const SizedBox(width: 10),
                    Text(l.markAllAsRead, style: const TextStyle(fontSize: 14)),
                  ]),
                ),
                PopupMenuItem(
                  value: 'settings',
                  child: Row(children: [
                    const Icon(Icons.settings_outlined,
                        size: 18, color: AppColors.textSecondary),
                    const SizedBox(width: 10),
                    Text(l.settingsMenu, style: const TextStyle(fontSize: 14)),
                  ]),
                ),
              ];
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 250),
            crossFadeState: _searchVisible
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: const SizedBox.shrink(),
            secondChild: Container(
              color: AppColors.primaryDark,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: lang.searchConversations,
                  hintStyle:
                      const TextStyle(color: Colors.white54, fontSize: 14),
                  prefixIcon: const Icon(Icons.search_rounded,
                      color: Colors.white54, size: 20),
                  filled: true,
                  fillColor: Colors.white12,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
          ),

          // ── Conversation list ────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : convs.isEmpty
                    ? Center(
                        child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline_rounded,
                              size: 56,
                              color: AppColors.textMuted.withOpacity(0.4)),
                          const SizedBox(height: 12),
                          Text(lang.noConversationsYet,
                              style: const TextStyle(
                                  color: AppColors.textMuted, fontSize: 14)),
                        ],
                      ))
                    : ListView.separated(
                        itemCount: convs.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 72, endIndent: 16),
                        itemBuilder: (_, i) {
                          final c = convs[i];
                          return _ConversationTile(
                            conversation: c,
                            onTap: () {
                              NotificationState.instance
                                  .markConversationRead(c.id);
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => ChatScreen(convId: c.id)),
                              );
                            },
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primaryGreen,
        elevation: 3,
        child: const Icon(Icons.chat_rounded, color: Colors.white),
        onPressed: () => _openNewChat(context),
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

// ─── Conversation Tile ────────────────────────────────────────────────────
class _ConversationTile extends StatelessWidget {
  final Conversation conversation;
  final VoidCallback onTap;

  const _ConversationTile({required this.conversation, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = conversation;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            // Avatar
            Stack(
              clipBehavior: Clip.none,
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: Color(c.iconColor).withOpacity(0.15),
                  child: c.isSystem
                      ? Icon(
                          IconData(c.iconCodePoint,
                              fontFamily: 'MaterialIcons'),
                          color: Color(c.iconColor),
                          size: 24,
                        )
                      : Text(
                          c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                          style: TextStyle(
                            color: Color(c.iconColor),
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
                if (c.isSystem)
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                    ),
                  ),
                if (c.unreadCount > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 5, vertical: 2),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryGreen,
                        borderRadius: BorderRadius.all(Radius.circular(10)),
                      ),
                      child: Text(
                        '${c.unreadCount}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(c.name,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: c.unreadCount > 0
                                    ? FontWeight.w700
                                    : FontWeight.w600,
                                color: AppColors.textPrimary)),
                      ),
                      Text(c.lastMessageTime,
                          style: TextStyle(
                              fontSize: 11,
                              color: c.unreadCount > 0
                                  ? AppColors.primaryGreen
                                  : AppColors.textMuted,
                              fontWeight: c.unreadCount > 0
                                  ? FontWeight.w600
                                  : FontWeight.w400)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(c.lastMessageText,
                      style: TextStyle(
                          fontSize: 13,
                          color: c.unreadCount > 0
                              ? AppColors.textSecondary
                              : AppColors.textMuted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── New Chat Sheet ────────────────────────────────────────────────────────
class _NewChatSheet extends StatefulWidget {
  final TextEditingController phoneCtrl;
  final TextEditingController nameCtrl;
  const _NewChatSheet({required this.phoneCtrl, required this.nameCtrl});

  @override
  State<_NewChatSheet> createState() => _NewChatSheetState();
}

class _NewChatSheetState extends State<_NewChatSheet> {
  bool _startingSupport = false;

  Future<void> _start() async {
    final phone = widget.phoneCtrl.text.trim();
    if (phone.isEmpty) return;

    // Backend-driven conversation creation (1:1)
    try {
      // Backend resolves phone -> user and creates/finds a 1:1 conversation.
      final convId = await ApiService.createOrGetConversationByPhone(phone);

      if (!mounted) return;
      Navigator.pop(context);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ChatScreen(convId: convId)),
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException ? e.message : 'Could not start chat';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  Future<void> _startSupport() async {
    setState(() => _startingSupport = true);
    try {
      final convId = await ApiService.getOrCreateSupportConversation();
      if (!mounted) return;
      Navigator.pop(context);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ChatScreen(convId: convId)),
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException ? e.message : 'Could not open support';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) setState(() => _startingSupport = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.divider,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 20),
          Text(lang.newConversation,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text(lang.newConversationSub,
              style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _startingSupport ? null : _startSupport,
              icon: _startingSupport
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.support_agent_rounded),
              label: Text(_startingSupport ? lang.loading : lang.supportChat),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryGreen,
                side: BorderSide(color: AppColors.primaryGreen),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const Divider(height: 32),
          Text(lang.orStartWithPhone,
              style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
          const SizedBox(height: 12),
          TextField(
            controller: widget.phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: lang.phoneOrId,
              prefixIcon: const Icon(Icons.phone_outlined),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: widget.nameCtrl,
            decoration: InputDecoration(
              labelText: lang.nameOptional,
              prefixIcon: const Icon(Icons.person_outline_rounded),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _start,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(lang.startChat),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Chat Screen ──────────────────────────────────────────────────────────
class ChatScreen extends StatefulWidget {
  final String convId;
  const ChatScreen({super.key, required this.convId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  bool _isTyping = false;
  bool _showAttachMenu = false;
  bool _showEmojiPicker = false;
  Conversation get _conv =>
      NotificationState.instance.getConversation(widget.convId) ??
      Conversation(
        id: widget.convId,
        name: 'Chat',
        iconCodePoint: 0xe7fd,
        iconColor: 0xFF1A5F7A,
        isSystem: false,
        messages: const [],
      );

  // Backend messages (fallbacks to NotificationState when needed)
  List<AppMessage> _backendMessages = const [];

  @override
  void initState() {
    super.initState();
    NotificationState.instance.addListener(_onChanged);
    _ctrl.addListener(
        () => setState(() => _isTyping = _ctrl.text.trim().isNotEmpty));

    // Sync support conversation with backend and load messages
    _initConversation();

    // Subscribe to conversation updates via WebSocket
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WebSocketService.instance.subscribeToConversation(widget.convId);
    });
  }

  Future<void> _initConversation() async {
    await ApiService.markConversationRead(widget.convId);
    NotificationState.instance.markConversationRead(widget.convId);
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    await _loadBackendMessages(widget.convId);
  }

  @override
  void dispose() {
    NotificationState.instance.removeListener(_onChanged);
    WebSocketService.instance.unsubscribeFromConversation(widget.convId);
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;

    final conv = NotificationState.instance.getConversation(widget.convId);
    if (conv == null) return;

    // If backend messages haven't been loaded yet, let NotificationState drive UI.
    if (_backendMessages.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {});
          _scrollToBottom();
        }
      });
      return;
    }

    // Merge any newly-arrived WebSocket messages into the backend list.
    final existingIds = _backendMessages.map((m) => m.id).toSet();
    final newMessages =
        conv.messages.where((m) => !existingIds.contains(m.id)).toList();
    if (newMessages.isNotEmpty) {
      if (mounted) {
        setState(() {
          _backendMessages.addAll(newMessages);
          _backendMessages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
        });
      }
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    }
  }

  void _scrollToBottom() {
    if (!mounted) return;
    if (_scroll.hasClients) {
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _loadBackendMessages([String? convId]) async {
    final targetConvId = convId ?? widget.convId;
    final currentUser = await AuthService.currentUser;
    final currentUserId = currentUser?['id'] as String?;
    try {
      final raw = await ApiService.fetchMessages(targetConvId, limit: 200);

      // Map backend payload to AppMessage (keep compatible with existing UI)
      final mapped = raw.map((e) {
        final text = (e['text'] ?? e['body'] ?? '').toString();
        final senderMap = e['sender'] as Map<String, dynamic>?;
        final senderId =
            (senderMap?['id'] ?? e['senderId'] ?? e['fromId'] ?? '').toString();
        final isMe = senderId.isNotEmpty && senderId == currentUserId;

        final tsRaw = e['timestamp'] ?? e['createdAt'] ?? e['created_at'];
        DateTime ts;
        if (tsRaw is String) {
          ts = DateTime.tryParse(tsRaw) ?? DateTime.now();
        } else if (tsRaw is int) {
          ts = DateTime.fromMillisecondsSinceEpoch(tsRaw);
        } else {
          ts = DateTime.now();
        }

        final attachmentType = e['attachmentType'] ?? e['attachment_type'];
        final attachment = _mapBackendAttachment(e, attachmentType);

        return AppMessage(
          id: (e['id'] ?? '').toString(),
          conversationId: targetConvId,
          text: text,
          timestamp: ts,
          isMe: isMe,
          attachment: attachment,
        );
      }).toList();

      if (mounted) {
        setState(() => _backendMessages = mapped);
      }

      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (_) {}
  }

  MessageAttachment? _mapBackendAttachment(
      Map<String, dynamic> e, dynamic attachmentTypeRaw) {
    if (attachmentTypeRaw == null) {
      // try detect by presence of known attachment fields
      if (e['attachmentUrl'] != null || e['attachmentUrl'] != '') {
        attachmentTypeRaw = 'image';
      }
    }

    final attachmentType = attachmentTypeRaw?.toString().toLowerCase();
    final url = (e['attachmentUrl'] ?? e['url'] ?? '').toString();
    final fileName = (e['fileName'] ?? e['filename'] ?? '').toString();

    if (url.isEmpty && fileName.isEmpty) return null;

    // NOTE: current UI previews local files only.
    // For remote URLs, it will fall back to placeholder unless file exists.
    // We still populate metadata so the bubble renders.
    return MessageAttachment(
      id: (e['attachmentId'] ?? '').toString(),
      type: attachmentType == 'image'
          ? AttachmentType.image
          : attachmentType == 'audio'
              ? AttachmentType.audio
              : AttachmentType.file,
      fileName: fileName.isEmpty ? 'attachment' : fileName,
      filePath: url,
      fileSize: e['fileSize'] is int ? e['fileSize'] as int : null,
      mimeType: (e['mimeType'] ?? e['mime_type'])?.toString(),
    );
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;

    _ctrl.clear();

    final targetConvId = widget.convId;

    // Send via WebSocket if connected; otherwise fall back to the REST API.
    if (WebSocketService.instance.isConnected) {
      WebSocketService.instance.sendChatMessage(
        conversationId: targetConvId,
        content: text,
      );
      return;
    }
    try {
      await ApiService.sendChatMessage(targetConvId, text);
      await _loadBackendMessages();
    } catch (_) {}
  }

  Future<void> _pickImage(ImageSource source) async {
    setState(() => _showAttachMenu = false);
    try {
      // Attachments require backend upload support.
    } catch (_) {}
  }

  Future<void> _pickFile() async {
    setState(() => _showAttachMenu = false);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      // Attachments require backend upload support.
    } catch (_) {}
  }

  Future<void> _pickAudio() async {
    setState(() => _showAttachMenu = false);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.audio,
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      // Attachments require backend upload support.
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final conv = _conv;

    return Scaffold(
      backgroundColor: const Color(0xFFECE5DD), // WhatsApp-style background
      appBar: _buildAppBar(context, conv, lang),
      body: Stack(
        children: [
          // ── Subtle pattern background ──────────────────────────────
          Positioned.fill(
            child: CustomPaint(painter: _ChatBgPainter()),
          ),

          Column(
            children: [
              // ── Messages ─────────────────────────────────────────
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  itemCount: _backendMessages.isNotEmpty
                      ? _backendMessages.length
                      : conv.messages.length,
                  itemBuilder: (_, i) {
                    final useBackend = _backendMessages.isNotEmpty;
                    final m =
                        useBackend ? _backendMessages[i] : conv.messages[i];
                    final prevMsg = useBackend
                        ? (i > 0 ? _backendMessages[i - 1] : null)
                        : (i > 0 ? conv.messages[i - 1] : null);
                    final showDate = prevMsg == null ||
                        !_sameDay(prevMsg.timestamp, m.timestamp);
                    return Column(
                      children: [
                        if (showDate) _DateDivider(dt: m.timestamp),
                        _MessageBubble(message: m),
                      ],
                    );
                  },
                ),
              ),

              // ── Attachment quick-menu ─────────────────────────────
              if (_showAttachMenu)
                _AttachMenu(
                  onCamera: () => _pickImage(ImageSource.camera),
                  onGallery: () => _pickImage(ImageSource.gallery),
                  onFile: _pickFile,
                  onAudio: _pickAudio,
                ),

              // ── Input bar ─────────────────────────────────────────
              _buildInputBar(context, lang),

              // ── Emoji picker ──────────────────────────────────────
              if (_showEmojiPicker)
                SafeArea(
                  top: false,
                  left: false,
                  right: false,
                  child: _buildEmojiPicker(),
                ),
            ],
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(
      BuildContext context, Conversation conv, dynamic lang) {
    return AppBar(
      backgroundColor: AppColors.primaryDark,
      leadingWidth: 48,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded,
            color: Colors.white, size: 20),
        onPressed: () => Navigator.pop(context),
      ),
      titleSpacing: 0,
      title: InkWell(
        onTap: () {},
        child: Row(
          children: [
            CircleAvatar(
              radius: 19,
              backgroundColor: Color(conv.iconColor).withOpacity(0.2),
              child: conv.isSystem
                  ? Icon(
                      IconData(conv.iconCodePoint, fontFamily: 'MaterialIcons'),
                      color: Color(conv.iconColor),
                      size: 19,
                    )
                  : Text(
                      conv.name.isNotEmpty ? conv.name[0].toUpperCase() : '?',
                      style: TextStyle(
                        color: Color(conv.iconColor),
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(conv.name,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600)),
                  Text(
                    conv.isSystem ? lang.online : 'Watsim user',
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: TextStyle(
                        color: conv.isSystem
                            ? AppColors.primaryGreen
                            : Colors.white60,
                        fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        if (!conv.isSystem)
          IconButton(
            icon: const Icon(Icons.videocam_outlined,
                color: Colors.white, size: 22),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(lang.videoCallSoon),
                  backgroundColor: AppColors.primaryDark,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              );
            },
          ),
        if (!conv.isSystem)
          IconButton(
            icon:
                const Icon(Icons.call_outlined, color: Colors.white, size: 20),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(lang.callingName(conv.name)),
                  backgroundColor: AppColors.primaryDark,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              );
            },
          ),
        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
          color: AppColors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          onSelected: (value) {
            switch (value) {
              case 'view_contact':
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(lang.viewProfile(conv.name)),
                    backgroundColor: AppColors.primaryDark,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                );
                break;
              case 'mute':
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(children: [
                      const Icon(Icons.notifications_off_rounded,
                          color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      Text(lang.notificationsMuted),
                    ]),
                    backgroundColor: AppColors.primaryDark,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                );
                break;
              case 'clear':
                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    title: Text(lang.clearChat,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    content: Text(lang.clearChatContent),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text(lang.cancel),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(lang.chatCleared),
                              backgroundColor: AppColors.primaryGreen,
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                            ),
                          );
                        },
                        child: Text(lang.clearLabel,
                            style: const TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );
                break;
              case 'block':
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(lang.blockedUser(conv.name)),
                    backgroundColor: Colors.red,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                );
                break;
            }
          },
          itemBuilder: (ctx) {
            final l = LanguageProvider.of(ctx);
            return [
              PopupMenuItem(
                value: 'view_contact',
                child: Row(children: [
                  const Icon(Icons.person_outline_rounded,
                      size: 18, color: AppColors.textSecondary),
                  const SizedBox(width: 10),
                  Text(l.viewContact, style: const TextStyle(fontSize: 14)),
                ]),
              ),
              PopupMenuItem(
                value: 'mute',
                child: Row(children: [
                  const Icon(Icons.notifications_off_outlined,
                      size: 18, color: AppColors.textSecondary),
                  const SizedBox(width: 10),
                  Text(l.muteNotifications,
                      style: const TextStyle(fontSize: 14)),
                ]),
              ),
              PopupMenuItem(
                value: 'clear',
                child: Row(children: [
                  const Icon(Icons.delete_sweep_outlined,
                      size: 18, color: AppColors.textSecondary),
                  const SizedBox(width: 10),
                  Text(l.clearChat, style: const TextStyle(fontSize: 14)),
                ]),
              ),
              PopupMenuItem(
                value: 'block',
                child: Row(children: [
                  const Icon(Icons.block_rounded, size: 18, color: Colors.red),
                  const SizedBox(width: 10),
                  Text(l.blockLabel,
                      style: const TextStyle(fontSize: 14, color: Colors.red)),
                ]),
              ),
            ];
          },
        ),
      ],
    );
  }

  Widget _buildInputBar(BuildContext context, dynamic lang) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
      color: Colors.transparent,
      child: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Message field
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 6,
                        offset: const Offset(0, 2)),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Emoji / sticker button
                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 6),
                      child: IconButton(
                        icon: Icon(
                            _showEmojiPicker
                                ? Icons.keyboard_outlined
                                : Icons.emoji_emotions_outlined,
                            color: _showEmojiPicker
                                ? AppColors.primaryGreen
                                : AppColors.textMuted,
                            size: 22),
                        onPressed: () {
                          FocusScope.of(context).unfocus();
                          setState(() {
                            _showEmojiPicker = !_showEmojiPicker;
                            _showAttachMenu = false;
                          });
                        },
                      ),
                    ),
                    // Text field
                    Expanded(
                      child: TextField(
                        controller: _ctrl,
                        minLines: 1,
                        maxLines: 5,
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: lang.writeAMessage,
                          hintStyle: const TextStyle(
                              color: AppColors.textMuted, fontSize: 14),
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    // Attach button
                    Padding(
                      padding: const EdgeInsets.only(right: 4, bottom: 6),
                      child: IconButton(
                        icon: Icon(
                          _showAttachMenu
                              ? Icons.close_rounded
                              : Icons.attach_file_rounded,
                          color: _showAttachMenu
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
                          size: 22,
                        ),
                        onPressed: () =>
                            setState(() => _showAttachMenu = !_showAttachMenu),
                      ),
                    ),
                    // Camera
                    Padding(
                      padding: const EdgeInsets.only(right: 8, bottom: 6),
                      child: IconButton(
                        icon: const Icon(Icons.camera_alt_outlined,
                            color: AppColors.textMuted, size: 22),
                        onPressed: () => _pickImage(ImageSource.camera),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            // Send / Mic button
            GestureDetector(
              onTap: _isTyping ? _send : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.primaryGreen.withOpacity(0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 3)),
                  ],
                ),
                child: Icon(
                  _isTyping ? Icons.send_rounded : Icons.mic_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmojiPicker() {
    return SizedBox(
      height: 280,
      child: EmojiPicker(
        textEditingController: _ctrl,
        config: Config(
          height: 280,
          checkPlatformCompatibility: true,
          emojiViewConfig: const EmojiViewConfig(
            emojiSizeMax: 28,
            backgroundColor: AppColors.offWhite,
            columns: 8,
          ),
          categoryViewConfig: const CategoryViewConfig(
            backgroundColor: AppColors.offWhite,
            indicatorColor: AppColors.primaryGreen,
            iconColor: AppColors.textMuted,
            iconColorSelected: AppColors.primaryGreen,
            backspaceColor: AppColors.primaryGreen,
          ),
          bottomActionBarConfig: const BottomActionBarConfig(
            backgroundColor: AppColors.offWhite,
            buttonColor: AppColors.primaryGreen,
            buttonIconColor: Colors.white,
            showBackspaceButton: true,
          ),
          searchViewConfig: const SearchViewConfig(
            backgroundColor: AppColors.offWhite,
            buttonIconColor: AppColors.primaryGreen,
            hintText: 'Rechercher un emoji',
          ),
        ),
      ),
    );
  }
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

// ─── Message Bubble ────────────────────────────────────────────────────────
class _MessageBubble extends StatelessWidget {
  final AppMessage message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isMe = message.isMe;
    final att = message.attachment;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: EdgeInsets.only(
          bottom: 4,
          left: isMe ? 48 : 0,
          right: isMe ? 0 : 48,
        ),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFFDCF8C6) : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft: Radius.circular(isMe ? 12 : 2),
            bottomRight: Radius.circular(isMe ? 2 : 12),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft: Radius.circular(isMe ? 12 : 2),
            bottomRight: Radius.circular(isMe ? 2 : 12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Attachment preview
              if (att != null) _AttachmentPreview(attachment: att),

              // Text body
              if (message.text.isNotEmpty || att == null)
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    10,
                    att != null ? 6 : 8,
                    10,
                    2,
                  ),
                  child: Text(
                    message.text.isEmpty && att != null ? '' : message.text,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textPrimary,
                        height: 1.4),
                  ),
                ),

              // Time + status row
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 2, 8, 6),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Flexible(
                      child: Text(
                        _time(message.timestamp),
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.textMuted),
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 3),
                      const Icon(Icons.done_all_rounded,
                          size: 14, color: Color(0xFF53BDEB)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _time(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

// ─── Attachment Preview ────────────────────────────────────────────────────
class _AttachmentPreview extends StatelessWidget {
  final MessageAttachment attachment;
  const _AttachmentPreview({required this.attachment});

  @override
  Widget build(BuildContext context) {
    switch (attachment.type) {
      case AttachmentType.image:
        return _buildImagePreview();
      case AttachmentType.audio:
        return _buildAudioPreview();
      case AttachmentType.file:
        return _buildFilePreview();
    }
  }

  Widget _buildImagePreview() {
    final file = File(attachment.filePath);
    return ConstrainedBox(
      constraints:
          const BoxConstraints(maxHeight: 220, minHeight: 120, minWidth: 200),
      child: file.existsSync()
          ? Image.file(file,
              fit: BoxFit.cover,
              width: double.infinity,
              errorBuilder: (_, __, ___) => _placeholderImage())
          : _placeholderImage(),
    );
  }

  Widget _placeholderImage() {
    return Container(
      height: 160,
      color: AppColors.divider,
      child: const Center(
        child: Icon(Icons.image_outlined, size: 48, color: AppColors.textMuted),
      ),
    );
  }

  Widget _buildAudioPreview() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
                color: AppColors.primaryGreen, shape: BoxShape.circle),
            child: const Icon(Icons.play_arrow_rounded,
                color: Colors.white, size: 22),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Simulated waveform
                Row(
                  children: List.generate(
                    20,
                    (i) => Container(
                      width: 3,
                      height: (6 + (i % 5) * 5).toDouble(),
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(attachment.fileName,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilePreview() {
    final ext = attachment.fileName.split('.').last.toUpperCase();
    final sizeStr =
        attachment.fileSize != null ? _formatSize(attachment.fileSize!) : '';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.insert_drive_file_outlined,
                    color: AppColors.primaryGreen, size: 20),
                Text(ext,
                    style: const TextStyle(
                        fontSize: 8,
                        color: AppColors.primaryGreen,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(attachment.fileName,
                    style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                if (sizeStr.isNotEmpty)
                  Text(sizeStr,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

// ─── Attach Menu ──────────────────────────────────────────────────────────
class _AttachMenu extends StatelessWidget {
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onFile;
  final VoidCallback onAudio;

  const _AttachMenu({
    required this.onCamera,
    required this.onGallery,
    required this.onFile,
    required this.onAudio,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFECE5DD),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _AttachOption(
            icon: Icons.photo_library_rounded,
            label: 'Gallery',
            color: const Color(0xFF8E44AD),
            onTap: onGallery,
          ),
          _AttachOption(
            icon: Icons.camera_alt_rounded,
            label: 'Camera',
            color: const Color(0xFFE91E63),
            onTap: onCamera,
          ),
          _AttachOption(
            icon: Icons.insert_drive_file_rounded,
            label: 'Document',
            color: const Color(0xFF1565C0),
            onTap: onFile,
          ),
          _AttachOption(
            icon: Icons.headset_rounded,
            label: 'Audio',
            color: const Color(0xFFE65100),
            onTap: onAudio,
          ),
        ],
      ),
    );
  }
}

class _AttachOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _AttachOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                    color: color.withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 3)),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 6),
          Text(label,
              style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ─── Date Divider ─────────────────────────────────────────────────────────
class _DateDivider extends StatelessWidget {
  final DateTime dt;
  const _DateDivider({required this.dt});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final diff = now.difference(dt).inDays;
    final label = diff == 0
        ? 'Today'
        : diff == 1
            ? 'Yesterday'
            : '${dt.day}/${dt.month}/${dt.year}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFD1F0E3).withOpacity(0.85),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
        ),
      ),
    );
  }
}

// ─── Chat Background Painter ───────────────────────────────────────────────
class _ChatBgPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Very subtle dot pattern like WhatsApp
    final paint = Paint()
      ..color = const Color(0xFF014945).withOpacity(0.03)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.fill;

    const spacing = 24.0;
    const dotRadius = 1.5;

    for (double x = 0; x < size.width; x += spacing) {
      for (double y = 0; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), dotRadius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ─── Chat Settings Sheet ──────────────────────────────────────────────────
class _ChatSettingsSheet extends StatefulWidget {
  const _ChatSettingsSheet();

  @override
  State<_ChatSettingsSheet> createState() => _ChatSettingsSheetState();
}

class _ChatSettingsSheetState extends State<_ChatSettingsSheet> {
  bool _notificationsEnabled = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;
  bool _readReceipts = true;
  bool _onlineStatus = true;
  String _fontSize = 'Medium';
  String _wallpaper = 'Default';

  Widget _settingsTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 19),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary)),
                  if (subtitle != null)
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            if (trailing != null) trailing,
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1.1)),
      );

  void _pickFontSize(BuildContext ctx) {
    final lang = LanguageProvider.of(ctx);
    showDialog(
      context: ctx,
      builder: (_) => SimpleDialog(
        title: Text(lang.fontSizeLabel,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        children: ['Small', 'Medium', 'Large'].map((size) {
          return RadioListTile<String>(
            value: size,
            groupValue: _fontSize,
            title: Text(size),
            activeColor: AppColors.primaryGreen,
            onChanged: (v) {
              setState(() => _fontSize = v!);
              Navigator.pop(ctx);
            },
          );
        }).toList(),
      ),
    );
  }

  void _pickWallpaper(BuildContext ctx) {
    final lang = LanguageProvider.of(ctx);
    showDialog(
      context: ctx,
      builder: (_) => SimpleDialog(
        title: Text(lang.chatWallpaper,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        children: ['Default', 'Light', 'Dark', 'Nature'].map((wp) {
          return RadioListTile<String>(
            value: wp,
            groupValue: _wallpaper,
            title: Text(wp),
            activeColor: AppColors.primaryGreen,
            onChanged: (v) {
              setState(() => _wallpaper = v!);
              Navigator.pop(ctx);
            },
          );
        }).toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.offWhite,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.settings_rounded,
                      color: AppColors.primaryGreen, size: 20),
                ),
                const SizedBox(width: 12),
                Text(lang.chatSettings,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary)),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Notifications ─────────────────────────────────
                  _sectionLabel(lang.notificationsSection),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE8F2F1)),
                    ),
                    child: Column(
                      children: [
                        _settingsTile(
                          icon: Icons.notifications_rounded,
                          iconColor: AppColors.primaryGreen,
                          title: lang.messageNotifications,
                          subtitle: lang.messageNotificationsSub,
                          trailing: Switch(
                            value: _notificationsEnabled,
                            activeColor: AppColors.primaryGreen,
                            onChanged: (v) =>
                                setState(() => _notificationsEnabled = v),
                          ),
                        ),
                        const Divider(height: 1, indent: 68),
                        _settingsTile(
                          icon: Icons.volume_up_rounded,
                          iconColor: AppColors.secondaryGreen,
                          title: lang.soundLabel,
                          subtitle: lang.soundSub,
                          trailing: Switch(
                            value: _soundEnabled,
                            activeColor: AppColors.primaryGreen,
                            onChanged: _notificationsEnabled
                                ? (v) => setState(() => _soundEnabled = v)
                                : null,
                          ),
                        ),
                        const Divider(height: 1, indent: 68),
                        _settingsTile(
                          icon: Icons.vibration_rounded,
                          iconColor: AppColors.deepTeal,
                          title: lang.vibrationLabel,
                          subtitle: lang.vibrationSub,
                          trailing: Switch(
                            value: _vibrationEnabled,
                            activeColor: AppColors.primaryGreen,
                            onChanged: _notificationsEnabled
                                ? (v) => setState(() => _vibrationEnabled = v)
                                : null,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Privacy ───────────────────────────────────────
                  _sectionLabel(lang.privacySection2),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE8F2F1)),
                    ),
                    child: Column(
                      children: [
                        _settingsTile(
                          icon: Icons.done_all_rounded,
                          iconColor: const Color(0xFF53BDEB),
                          title: lang.readReceipts,
                          subtitle: lang.readReceiptsSub,
                          trailing: Switch(
                            value: _readReceipts,
                            activeColor: AppColors.primaryGreen,
                            onChanged: (v) => setState(() => _readReceipts = v),
                          ),
                        ),
                        const Divider(height: 1, indent: 68),
                        _settingsTile(
                          icon: Icons.circle_rounded,
                          iconColor: AppColors.primaryGreen,
                          title: lang.onlineStatusLabel,
                          subtitle: lang.onlineStatusSub,
                          trailing: Switch(
                            value: _onlineStatus,
                            activeColor: AppColors.primaryGreen,
                            onChanged: (v) => setState(() => _onlineStatus = v),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Appearance ────────────────────────────────────
                  _sectionLabel(lang.appearanceSection),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE8F2F1)),
                    ),
                    child: Column(
                      children: [
                        _settingsTile(
                          icon: Icons.format_size_rounded,
                          iconColor: const Color(0xFF7B1FA2),
                          title: lang.fontSizeLabel,
                          subtitle: _fontSize,
                          trailing: const Icon(Icons.chevron_right_rounded,
                              color: AppColors.textMuted, size: 18),
                          onTap: () => _pickFontSize(context),
                        ),
                        const Divider(height: 1, indent: 68),
                        _settingsTile(
                          icon: Icons.wallpaper_rounded,
                          iconColor: const Color(0xFFE65100),
                          title: lang.chatWallpaper,
                          subtitle: _wallpaper,
                          trailing: const Icon(Icons.chevron_right_rounded,
                              color: AppColors.textMuted, size: 18),
                          onTap: () => _pickWallpaper(context),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
