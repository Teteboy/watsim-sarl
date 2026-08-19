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

// Notification Model
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

// Message Model
class AppMessage {
  final String id;
  final String conversationId;
  final String text;
  final bool isMe;
  final DateTime timestamp;
  final MessageAttachment? attachment;

  const AppMessage({
    required this.id,
    required this.conversationId,
    required this.text,
    required this.isMe,
    required this.timestamp,
    this.attachment,
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

// Notification State
class NotificationState extends ChangeNotifier {
  NotificationState._();
  static final NotificationState instance = NotificationState._();

  // Notifications — loaded from backend on app start
  final List<AppNotification> _notifications = [];
  bool _isLoading = false;
  String? _error;

  List<AppNotification> get notifications =>
      List.unmodifiable(_notifications.reversed.toList());

  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  bool get isLoading => _isLoading;
  String? get error => _error;

  void _addNotification(AppNotification n) {
    _notifications.add(n);
    notifyListeners();
  }

  /// Sync notifications from backend
  Future<void> syncWithBackend() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await ApiService.fetchNotifications();
      _notifications.clear();

      for (final n in data) {
        final noteData = n as Map<String, dynamic>;
        _notifications.add(AppNotification(
          id: noteData['id'] as String? ??
              'note_${DateTime.now().millisecondsSinceEpoch}',
          title: noteData['title'] as String? ?? 'Notification',
          body: noteData['body'] as String? ?? '',
          type: noteData['type'] as String? ?? 'info',
          iconCodePoint: _getIconForType(noteData['type'] as String?),
          iconColor: _getColorForType(noteData['type'] as String?),
          timestamp: noteData['createdAt'] != null
              ? DateTime.tryParse(noteData['createdAt'] as String) ??
                  DateTime.now()
              : DateTime.now(),
          isRead: noteData['isRead'] as bool? ?? false,
        ));
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
    }
  }

  int _getIconForType(String? type) {
    switch (type) {
      case 'transaction':
        return 0xe058; // account_balance_wallet
      case 'bnpl':
        return 0xef6d; // shopping_cart
      case 'alert':
        return 0xe002; // warning
      case 'promotion':
        return 0xe7f2; // local_offer
      default:
        return 0xe147; // info
    }
  }

  int _getColorForType(String? type) {
    switch (type) {
      case 'transaction':
        return 0xFF00A86B; // green
      case 'bnpl':
        return 0xFFFFC107; // amber
      case 'alert':
        return 0xFFFF9800; // orange
      case 'promotion':
        return 0xFF1565C0; // blue
      default:
        return 0xFF1565C0; // blue
    }
  }

  Future<void> markAllRead() async {
    try {
      await ApiService.markAllNotificationsRead();
    } catch (_) {}
    for (final n in _notifications) {
      n.isRead = true;
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

  /// Called when profile is updated so other screens can refresh user-related data.
  void onProfileUpdated(Map<String, dynamic> user) {
    // No-op for now; notifications don't cache user data.
  }

  // Messaging — loaded from backend
  final List<Conversation> _conversations = [];

  List<Conversation> get conversations => _conversations;

  Conversation? getConversation(String id) {
    try {
      return _conversations.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Add conversations that are not already in the local state.
  void syncConversations(List<Conversation> conversations) {
    final existingIds = _conversations.map((c) => c.id).toSet();
    for (final c in conversations) {
      if (!existingIds.contains(c.id)) {
        _conversations.add(c);
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
      conv.unreadCount++;
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

  // WebSocket messaging methods

  // Event Triggers

  void onDepositCompleted(int amount, String operator) {
    final amtStr = _fmt(amount);
    final depCount =
        _notifications.where((n) => n.id.startsWith('dep_')).length;
    final isFirst = depCount == 0;

    _addNotification(AppNotification(
      id: 'dep_${DateTime.now().millisecondsSinceEpoch}',
      title: isFirst ? 'First Deposit Confirmed' : 'Deposit Confirmed',
      body: '$amtStr credited to your wallet via $operator.',
      type: 'transaction',
      iconCodePoint: 0xe058,
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));

    final supportMsg = isFirst
        ? 'Congratulations on your first deposit! Your $amtStr via $operator has been confirmed and added to your wallet. You can now shop on BNPL or transfer funds. Welcome to Watsim!'
        : 'Your deposit of $amtStr via $operator has been successfully processed and credited to your wallet. Thank you for using Watsim!';

    Future.delayed(const Duration(seconds: 2), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_dep_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text: supportMsg,
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onWithdrawalCompleted(int amount) {
    final amtStr = _fmt(amount);
    _addNotification(AppNotification(
      id: 'wd_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Withdrawal Initiated',
      body: '$amtStr withdrawal is being processed. Funds arrive shortly.',
      type: 'transaction',
      iconCodePoint: 0xe8d6,
      iconColor: 0xFF1A5F7A,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 3), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_wd_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                'Your withdrawal of $amtStr has been initiated. You\'ll receive the funds in your mobile money account within a few minutes.',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onTransferCompleted(int amount, String recipient) {
    final amtStr = _fmt(amount);
    _addNotification(AppNotification(
      id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Transfer Sent',
      body: '$amtStr sent to $recipient. They will receive it shortly.',
      type: 'transaction',
      iconCodePoint: 0xe8d6,
      iconColor: 0xFF1A5F7A,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 3), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_tx_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                'Your transfer of $amtStr to $recipient has been initiated. The recipient will receive the funds in their mobile money account within a few minutes.',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onBnplPaymentMade(
      String productName, int amount, int installment, int total) {
    final amtStr = _fmt(amount);
    final isLast = installment >= total;
    _addNotification(AppNotification(
      id: 'bnpl_${DateTime.now().millisecondsSinceEpoch}',
      title: isLast ? 'BNPL Completed' : 'BNPL Payment Confirmed',
      body: isLast
          ? 'You\'ve fully paid for $productName. It\'s all yours!'
          : 'Instalment $installment/$total of $amtStr for $productName confirmed.',
      type: 'bnpl',
      iconCodePoint: 0xef6d,
      iconColor: 0xFFFFC107,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 2), () {
      final msg = isLast
          ? 'Amazing! You\'ve completed all payments for $productName. The device is fully yours — no more instalments. Thank you for being a Watsim BNPL customer!'
          : 'Instalment $installment of $total paid! $amtStr for $productName recorded. ${total - installment} instalment(s) remaining. Keep it up!';
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_bnpl_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text: msg,
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onBnplOrderConfirmed(String productName, int monthly, int months,
      {String paymentFrequency = 'Monthly'}) {
    final amtStr = _fmt(monthly);
    final String durationLabel;
    final String freqLabel;
    if (paymentFrequency == 'Daily') {
      durationLabel = '${months * 30} days';
      freqLabel = 'day';
    } else if (paymentFrequency == 'Weekly') {
      durationLabel = '${months * 4} weeks';
      freqLabel = 'week';
    } else {
      durationLabel = '$months month${months > 1 ? 's' : ''}';
      freqLabel = 'month';
    }
    _addNotification(AppNotification(
      id: 'order_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Order Confirmed!',
      body: '$productName approved. Pay $amtStr/$freqLabel for $durationLabel.',
      type: 'bnpl',
      iconCodePoint: 0xe86c,
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 1), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_order_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                'Your BNPL order for $productName has been confirmed! You\'ll pay $amtStr per $freqLabel for $durationLabel. Your first instalment has been collected. Enjoy your new device!',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  /// Called when accumulated funds are transferred to a product.
  /// [completed] = true means the product reached 100% payment.
  /// [refund] > 0 means excess was returned to the wallet.
  void onProductTransferApplied({
    required String fromProduct,
    required String toProduct,
    required int transferred,
    required bool completed,
    int refund = 0,
  }) {
    final amtStr = _fmt(transferred);
    if (completed && refund > 0) {
      // Product fully paid AND overpay refund issued
      _addNotification(AppNotification(
        id: 'txc_${DateTime.now().millisecondsSinceEpoch}',
        title: '$toProduct — Fully Paid!',
        body:
            'Transferred $amtStr completed the payment. ${_fmt(refund)} refunded to your wallet.',
        type: 'transaction',
        iconCodePoint: 0xe876, // check_circle
        iconColor: 0xFF00A86B,
        timestamp: DateTime.now(),
      ));
      Future.delayed(const Duration(seconds: 2), () {
        addMessageToConversation(
            'watsim_support',
            AppMessage(
              id: 'msg_txc_${DateTime.now().millisecondsSinceEpoch}',
              conversationId: 'watsim_support',
              text:
                  'Great news! Your transfer of $amtStr from $fromProduct has fully covered the remaining balance on $toProduct — it'
                  's now 100% paid off! The excess ${_fmt(refund)} has been refunded to your Watsim wallet.',
              isMe: false,
              timestamp: DateTime.now(),
            ));
      });
    } else if (completed) {
      // Product fully paid, no overpay
      _addNotification(AppNotification(
        id: 'txc_${DateTime.now().millisecondsSinceEpoch}',
        title: '$toProduct — Fully Paid!',
        body:
            'Transfer of $amtStr completed all payments. The product is yours!',
        type: 'transaction',
        iconCodePoint: 0xe876,
        iconColor: 0xFF00A86B,
        timestamp: DateTime.now(),
      ));
      Future.delayed(const Duration(seconds: 2), () {
        addMessageToConversation(
            'watsim_support',
            AppMessage(
              id: 'msg_txc_${DateTime.now().millisecondsSinceEpoch}',
              conversationId: 'watsim_support',
              text:
                  'Your transfer of $amtStr from $fromProduct has completed all payments for $toProduct! No more instalments — the product is fully yours.',
              isMe: false,
              timestamp: DateTime.now(),
            ));
      });
    } else if (refund > 0) {
      // Not fully paid, but partial overpay refunded
      _addNotification(AppNotification(
        id: 'txr_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Refund Issued',
        body:
            'Transfer applied. Excess ${_fmt(refund)} returned to your wallet.',
        type: 'transaction',
        iconCodePoint: 0xe8d6,
        iconColor: 0xFF1A5F7A,
        timestamp: DateTime.now(),
      ));
    } else {
      // Normal transfer, no completion, no refund
      _addNotification(AppNotification(
        id: 'txs_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Transfer Applied',
        body: '$amtStr from $fromProduct credited to $toProduct.',
        type: 'transaction',
        iconCodePoint: 0xe8d6,
        iconColor: 0xFF1A5F7A,
        timestamp: DateTime.now(),
      ));
    }
  }

  // Cash Deposit Events

  /// Called immediately when the user submits a Pay in Cash deposit.
  void onCashDepositPending(int amount) {
    final amtStr = _fmt(amount);
    _addNotification(AppNotification(
      id: 'cash_pend_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Cash Deposit Pending',
      body:
          'Your $amtStr cash deposit is pending. Please provide your details so we can dispatch a Watsim official.',
      type: 'transaction',
      iconCodePoint: 0xe8b5, // hourglass
      iconColor: 0xFFFFC107, // amber
      timestamp: DateTime.now(),
    ));

    Future.delayed(const Duration(seconds: 2), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_cash_pend_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                'Hello! We have received your cash deposit request of $amtStr.\n\n'
                'To dispatch a Watsim official to you, we need a few quick details.'
                'Please reply with the following:\n\n'
                '1. Full Name\n'
                '2. Your Location / Address\n'
                '3. Phone Number\n\n'
                'Once we have your details, our agent will be on their way to collect your cash.',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  /// Called when the Watsim official has delivered the cash and the office
  /// confirms the deposit. [requestedAmount] is what the user entered;
  /// [collectedAmount] is what was actually received — these should be equal
  /// in the normal case.
  void onCashDepositCompleted(int requestedAmount, int collectedAmount) {
    final amtStr = _fmt(collectedAmount);
    _addNotification(AppNotification(
      id: 'cash_done_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Cash Deposit Completed',
      body: '$amtStr has been credited to your Watsim wallet.',
      type: 'transaction',
      iconCodePoint: 0xe058, // account_balance_wallet
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));

    Future.delayed(const Duration(seconds: 2), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_cash_done_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text: 'Great news! The Watsim official has delivered your cash and'
                'your deposit of $amtStr has been confirmed at our office.\n\n'
                '$amtStr has been credited to your Watsim wallet.'
                'You can now use your funds to shop, transfer, or pay instalments.',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  /// Called when the amount collected by the official differs from what
  /// the user originally requested. The wallet is updated with the actual
  /// collected amount; this message explains the discrepancy.
  void onCashDepositAmountMismatch({
    required int requestedAmount,
    required int collectedAmount,
  }) {
    final reqStr = _fmt(requestedAmount);
    final colStr = _fmt(collectedAmount);
    final diff = collectedAmount - requestedAmount;
    final diffStr = _fmt(diff.abs());
    final isMore = diff > 0;

    _addNotification(AppNotification(
      id: 'cash_mis_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Deposit Amount Updated',
      body:
          'You requested $reqStr but $colStr was received. Your wallet has been updated accordingly.',
      type: 'transaction',
      iconCodePoint: 0xe002, // warning
      iconColor: 0xFFFF9800, // orange
      timestamp: DateTime.now(),
    ));

    final detailMsg = isMore
        ? 'Heads up! There is a small difference in your cash deposit.\n\n'
            '• You requested: $reqStr\n'
            '• Amount received at office: $colStr\n'
            '• Difference: +$diffStr (extra received)\n\n'
            'Your wallet has been credited with the actual amount received ($colStr).'
            'The extra $diffStr will be reviewed and processed by our team.'
            'If you have any questions, please reply here or contact our support team.'
        : 'Heads up! There is a difference in your cash deposit.\n\n'
            '• You requested: $reqStr\n'
            '• Amount received at office: $colStr\n'
            '• Shortfall: $diffStr less than requested\n\n'
            'Your wallet has been credited with $colStr — the actual amount'
            'delivered by the Watsim official.\n\n'
            'If you believe this is an error, please contact your Watsim official'
            'or reply here and our support team will assist you promptly. We apologise for any inconvenience.';

    Future.delayed(const Duration(seconds: 2), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_cash_mis_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text: detailMsg,
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onTransferSent(String recipient, int amount) {
    _addNotification(AppNotification(
      id: 'txs_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Transfer Sent',
      body: '${_fmt(amount)} sent to $recipient successfully.',
      type: 'transaction',
      iconCodePoint: 0xe8d6,
      iconColor: 0xFF1A5F7A,
      timestamp: DateTime.now(),
    ));
  }

  void onTransferReceived(String sender, int amount) {
    _addNotification(AppNotification(
      id: 'rxr_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Transfer Received',
      body: '$sender sent you ${_fmt(amount)}.',
      type: 'transaction',
      iconCodePoint: 0xe058,
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));
  }

  void onDeliveryRequested(String productName) {
    _addNotification(AppNotification(
      id: 'dlv_req_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Delivery Requested',
      body:
          'Your delivery request for $productName has been received. You will receive your product shortly.',
      type: 'transaction',
      iconCodePoint: 0xe558, // local_shipping
      iconColor: 0xFF1565C0,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 2), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_dlv_req_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                'Your delivery request for $productName has been confirmed! Our team is preparing your shipment and you will receive it shortly. Thank you for using WatSim!',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onDeliveryCompleted(String productName) {
    _addNotification(AppNotification(
      id: 'dlv_done_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Product Delivered! 🎉',
      body:
          '$productName was successfully delivered. Thank you for using WatSim!',
      type: 'transaction',
      iconCodePoint: 0xe876, // check_circle
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 1), () {
      addMessageToConversation(
          'watsim_support',
          AppMessage(
            id: 'msg_dlv_done_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: 'watsim_support',
            text:
                '$productName was successfully delivered to you! We hope you enjoy it. Thank you for using WatSim — it\'s been a pleasure serving you! 🎉',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void addGenericNotification(String title, String body) {
    _addNotification(AppNotification(
      id: 'gen_${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      body: body,
      type: 'transaction',
      iconCodePoint: 0xe147,
      iconColor: 0xFF1565C0,
      timestamp: DateTime.now(),
    ));
  }

  // Helpers
  String _fmt(int v) {
    if (v < 1000) return '$v FCFA';
    final k = v ~/ 1000;
    final r = (v % 1000).toString().padLeft(3, '0');
    return '$k,$r FCFA';
  }

  // Legacy compat
  void setCount(int count) => notifyListeners();
  void increment() => notifyListeners();

  // WebSocket messaging methods
  void addMessage(String conversationId, AppMessage message) {
    addMessageToConversation(conversationId, message);
  }

  void onNewMessage(String conversationId, String senderName, String content) {
    // Handle new message notification
    notifyListeners();
  }

  void updateConversation(dynamic conversation) {
    final convData = conversation as Map<String, dynamic>?;
    if (convData != null) {
      final id = convData['id']?.toString();
      final index = conversations.indexWhere((c) => c.id == id);
      if (index >= 0) {
        notifyListeners();
      }
    }
  }
}
