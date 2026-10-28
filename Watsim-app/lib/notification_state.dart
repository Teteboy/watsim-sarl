import 'package:flutter/foundation.dart';
import 'services/api_service.dart';

// Attachment Types
enum AttachmentType { image, audio, file }

class MessageAttachment {
  final String id;
  final AttachmentType type;
  final String fileName;
  final String filePath;
  final int? fileSize;
  final String? mimeType;

  const MessageAttachment({
    required this.id,
    required this.type,
    required this.fileName,
    required this.filePath,
    this.fileSize,
    this.mimeType,
  });
}

class AppNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final int iconCodePoint;
  final int iconColor;
  final DateTime timestamp;
  bool isRead;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.iconCodePoint,
    required this.iconColor,
    required this.timestamp,
    this.isRead = false,
  });
}

class AppMessage {
  final String id;
  final String conversationId;
  final String? senderId;
  final String text;
  final bool isMe;
  final DateTime timestamp;
  final MessageAttachment? attachment;

  /// Message delivery status: 'SENT', 'DELIVERED', or 'READ'.
  String status;

  AppMessage({
    required this.id,
    required this.conversationId,
    this.senderId,
    required this.text,
    required this.isMe,
    required this.timestamp,
    this.attachment,
    this.status = 'SENT',
  });
}

class Conversation {
  final String id;
  final String name;
  final int iconCodePoint;
  final int iconColor;
  final bool isSystem;
  final List<AppMessage> messages;
  int unreadCount;

  Conversation({
    required this.id,
    required this.name,
    required this.iconCodePoint,
    required this.iconColor,
    required this.isSystem,
    required this.messages,
    this.unreadCount = 0,
  });

  String get lastMessageText => messages.isNotEmpty ? messages.last.text : '';

  String get lastMessageTime {
    if (messages.isEmpty) return '';
    final dt = messages.last.timestamp;
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) {
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    }
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }
}

class NotificationState extends ChangeNotifier {
  NotificationState._();
  static final NotificationState instance = NotificationState._();
  int _localIdCounter = 0;

  String _nextLocalId(String prefix) =>
      '${prefix}_${DateTime.now().millisecondsSinceEpoch}_${_localIdCounter++}';

  final List<AppNotification> _notifications = [];
  bool _isLoading = false;
  String? _error;

  List<AppNotification> get notifications =>
      List.unmodifiable(_notifications.reversed.toList());
  int get unreadCount => _notifications.where((n) => !n.isRead).length;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Only the backend supplies notification content.
  Future<void> syncWithBackend() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await ApiService.fetchNotifications();
      final notifications = data.map((n) {
        final noteData = n as Map<String, dynamic>;
        return AppNotification(
          id: noteData['id']?.toString() ?? _nextLocalId('note'),
          title: noteData['title'] as String? ?? 'Notification',
          body: noteData['body'] as String? ?? '',
          type: noteData['type'] as String? ?? 'info',
          iconCodePoint: _getIconForType(noteData['type'] as String?),
          iconColor: _getColorForType(noteData['type'] as String?),
          timestamp: noteData['createdAt'] != null
              ? DateTime.tryParse(noteData['createdAt'] as String) ?? DateTime.now()
              : DateTime.now(),
          isRead: noteData['isRead'] as bool? ?? false,
        );
      }).toList();
      _notifications
        ..clear()
        ..addAll(notifications);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  int _getIconForType(String? type) {
    switch (type) {
      case 'transaction': return 0xe058;
      case 'bnpl': return 0xef6d;
      case 'alert': return 0xe002;
      case 'promotion': return 0xe7f2;
      default: return 0xe147;
    }
  }

  int _getColorForType(String? type) {
    switch (type) {
      case 'transaction': return 0xFF00A86B;
      case 'bnpl': return 0xFFFFC107;
      case 'alert': return 0xFFFF9800;
      case 'promotion': return 0xFF1565C0;
      default: return 0xFF1565C0;
    }
  }

  Future<void> markAllRead() async {
    try {
      await ApiService.markAllNotificationsRead();
    } catch (_) {}
    for (final n in _notifications) {
      n.isRead = true;
    }
    for (final c in _conversations) {
      if (c.unreadCount > 0) {
        c.unreadCount = 0;
        ApiService.markConversationRead(c.id);
      }
    }
    notifyListeners();
  }

  Future<void> markRead(String id) async {
    try {
      await ApiService.markNotificationRead(id);
    } catch (_) {}
    try {
      final n = _notifications.firstWhere((n) => n.id == id);
      n.isRead = true;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> deleteNotification(String id) async {
    try {
      await ApiService.deleteNotification(id);
    } catch (_) {}
    _notifications.removeWhere((n) => n.id == id);
    notifyListeners();
  }

  void onProfileUpdated(Map<String, dynamic> user) {
    // Notifications don't cache user data.
  }

  final List<Conversation> _conversations = [];
  String? activeConversationId;
  final Set<String> typingUsers = {};
  final Set<String> onlineUsers = {};

  void setUserTyping(String userId, bool isTyping) {
    if (userId.isEmpty) return;
    if (isTyping) {
      typingUsers.add(userId);
    } else {
      typingUsers.remove(userId);
    }
    notifyListeners();
  }

  void setUserOnline(String userId, bool isOnline) {
    if (userId.isEmpty) return;
    if (isOnline) {
      onlineUsers.add(userId);
    } else {
      onlineUsers.remove(userId);
    }
    notifyListeners();
  }

  List<Conversation> get conversations => _conversations;

  Conversation? getConversation(String id) {
    try {
      return _conversations.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }

  void syncConversations(List<Conversation> conversations) {
    for (final c in conversations) {
      final existing = getConversation(c.id);
      if (existing == null) {
        _conversations.add(c);
      } else {
        existing.unreadCount = c.unreadCount;
        if (c.messages.isNotEmpty) {
          final last = c.messages.last;
          final known = existing.messages.any((m) => m.id == last.id);
          if (!known && (existing.messages.isEmpty ||
              !last.timestamp.isBefore(existing.messages.last.timestamp))) {
            existing.messages.add(last);
          }
        }
      }
    }
    notifyListeners();
  }

  int get totalUnreadMessages =>
      _conversations.fold(0, (sum, c) => sum + c.unreadCount);

  void addMessageToConversation(String convId, AppMessage msg) {
    final conv = getConversation(convId);
    if (conv != null) {
      conv.messages.add(msg);
      if (!msg.isMe && activeConversationId != convId) {
        conv.unreadCount++;
      }
      notifyListeners();
    }
  }

  void markConversationRead(String convId) {
    final conv = getConversation(convId);
    if (conv != null) {
      conv.unreadCount = 0;
      notifyListeners();
    }
  }

  void markConversationMessagesRead(String convId) {
    final conv = getConversation(convId);
    if (conv != null) {
      for (final m in conv.messages) {
        if (m.isMe && m.status != 'READ') m.status = 'READ';
      }
      notifyListeners();
    }
  }

  // Keep event entry points used by other screens, but never fabricate
  // notifications or support messages. Refresh authoritative backend data.
  void onDepositCompleted(int amount, String operator) { syncWithBackend(); }
  void onWithdrawalCompleted(int amount) { syncWithBackend(); }
  void onTransferCompleted(int amount, String recipient) { syncWithBackend(); }
  void onBnplPaymentMade(String productName, int amount, int installment, int total) {
    syncWithBackend();
  }
  void onBnplOrderConfirmed(String productName, int monthly, int months,
      {String paymentFrequency = 'Monthly'}) { syncWithBackend(); }
  void onProductTransferApplied({
    required String fromProduct,
    required String toProduct,
    required int transferred,
    required bool completed,
    int refund = 0,
  }) { syncWithBackend(); }
  void onCashDepositPending(int amount) { syncWithBackend(); }
  void onCashDepositCompleted(int requestedAmount, int collectedAmount) {
    syncWithBackend();
  }
  void onCashDepositAmountMismatch({required int requestedAmount, required int collectedAmount}) {
    syncWithBackend();
  }
  void onTransferSent(String recipient, int amount) { syncWithBackend(); }
  void onTransferReceived(String sender, int amount) { syncWithBackend(); }
  void onDeliveryRequested(String productName) { syncWithBackend(); }
  void onDeliveryCompleted(String productName) { syncWithBackend(); }
  void addGenericNotification(String title, String body) { syncWithBackend(); }

  void addMessage(String conversationId, AppMessage message) {
    addMessageToConversation(conversationId, message);
  }

  // Still called by the WebSocket service.
  void onNewMessage(String conversationId, String senderName, String content) {
    notifyListeners();
  }

  void updateConversation(dynamic conversation) {
    final convData = conversation as Map<String, dynamic>?;
    if (convData == null) return;
    final id = convData['id']?.toString();
    if (id == null || id.isEmpty) return;
    final conv = getConversation(id);
    if (conv == null) return;
    final unread = convData['unreadCount'] ?? convData['unread'];
    if (unread is num) conv.unreadCount = unread.toInt();
    final last = convData['lastMessage'] as Map<String, dynamic>?;
    if (last != null) {
      final msgId = last['id']?.toString() ?? '';
      if (msgId.isNotEmpty && !conv.messages.any((m) => m.id == msgId)) {
        final senderMap = last['sender'] as Map<String, dynamic>?;
        final senderId = (senderMap?['id'] ?? last['senderId'] ?? last['fromId'] ?? '').toString();
        conv.messages.add(AppMessage(
          id: msgId,
          conversationId: id,
          senderId: senderId.isNotEmpty ? senderId : null,
          text: (last['text'] ?? last['body'] ?? last['content'] ?? '').toString(),
          isMe: false,
          timestamp: DateTime.tryParse(last['createdAt']?.toString() ?? '') ?? DateTime.now(),
          status: (last['status'] as String?) ?? 'SENT',
        ));
      }
    }
    notifyListeners();
  }
}
