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
      title: isFirst ? 'Premier dépôt confirmé' : 'Dépôt confirmé',
      body: '$amtStr crédités sur votre portefeuille via $operator.',
      type: 'transaction',
      iconCodePoint: 0xe058,
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));

    final supportMsg = isFirst
        ? 'Félicitations pour votre premier dépôt ! Votre $amtStr via $operator a été confirmé et ajouté à votre portefeuille. Vous pouvez maintenant acheter en BNPL ou transférer des fonds. Bienvenue sur Watsim !'
        : 'Votre dépôt de $amtStr via $operator a été traité avec succès et crédité sur votre portefeuille. Merci d\'utiliser Watsim !';

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
      title: 'Retrait initié',
      body:
          'Le retrait de $amtStr est en cours de traitement. Les fonds arrivent bientôt.',
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
                'Votre retrait de $amtStr a été initié. Vous recevrez les fonds sur votre compte mobile money sous quelques minutes.',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onTransferCompleted(int amount, String recipient) {
    final amtStr = _fmt(amount);
    _addNotification(AppNotification(
      id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Transfert envoyé',
      body: '$amtStr envoyés à $recipient. Ils seront reçus sous peu.',
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
                'Votre transfert de $amtStr à $recipient a été initié. Le destinataire recevra les fonds sur son compte mobile money sous quelques minutes.',
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
      title: isLast ? 'BNPL terminé' : 'Paiement BNPL confirmé',
      body: isLast
          ? 'Vous avez entièrement payé $productName. Il est à vous !'
          : 'Versement $installment/$total de $amtStr pour $productName confirmé.',
      type: 'bnpl',
      iconCodePoint: 0xef6d,
      iconColor: 0xFFFFC107,
      timestamp: DateTime.now(),
    ));
    Future.delayed(const Duration(seconds: 2), () {
      final msg = isLast
          ? 'Félicitations ! Vous avez terminé tous les paiements pour $productName. L\'appareil est entièrement à vous — plus de versements. Merci d\'être client Watsim BNPL !'
          : 'Versement $installment/$total payé ! $amtStr pour $productName enregistré. Il reste ${total - installment} versement(s). Continuez comme ça !';
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
      durationLabel = '${months * 30} jours';
      freqLabel = 'jour';
    } else if (paymentFrequency == 'Weekly') {
      durationLabel = '${months * 4} semaines';
      freqLabel = 'semaine';
    } else {
      durationLabel = '$months mois';
      freqLabel = 'mois';
    }
    _addNotification(AppNotification(
      id: 'order_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Commande confirmée !',
      body:
          '$productName approuvé. Payez $amtStr/$freqLabel pendant $durationLabel.',
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
                'Votre commande BNPL pour $productName a été confirmée ! Vous paierez $amtStr par $freqLabel pendant $durationLabel. Votre premier versement a été collecté. Profitez de votre nouvel appareil !',
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
        title: '$toProduct — Entièrement payé !',
        body:
            'Le transfert de $amtStr a complété le paiement. ${_fmt(refund)} remboursés sur votre portefeuille.',
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
                  'Bonne nouvelle ! Votre transfert de $amtStr de $fromProduct a couvert le solde restant sur $toProduct — il '
                  'est maintenant 100% payé ! L\'excédent de ${_fmt(refund)} a été remboursé sur votre portefeuille Watsim.',
              isMe: false,
              timestamp: DateTime.now(),
            ));
      });
    } else if (completed) {
      // Product fully paid, no overpay
      _addNotification(AppNotification(
        id: 'txc_${DateTime.now().millisecondsSinceEpoch}',
        title: '$toProduct — Entièrement payé !',
        body:
            'Le transfert de $amtStr a réglé tous les paiements. Le produit est à vous !',
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
                  'Votre transfert de $amtStr de $fromProduct a réglé tous les paiements pour $toProduct ! Plus de versements — le produit est entièrement à vous.',
              isMe: false,
              timestamp: DateTime.now(),
            ));
      });
    } else if (refund > 0) {
      // Not fully paid, but partial overpay refunded
      _addNotification(AppNotification(
        id: 'txr_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Remboursement effectué',
        body:
            'Transfert appliqué. L\'excédent de ${_fmt(refund)} a été retourné sur votre portefeuille.',
        type: 'transaction',
        iconCodePoint: 0xe8d6,
        iconColor: 0xFF1A5F7A,
        timestamp: DateTime.now(),
      ));
    } else {
      // Normal transfer, no completion, no refund
      _addNotification(AppNotification(
        id: 'txs_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Transfert appliqué',
        body: '$amtStr de $fromProduct crédités vers $toProduct.',
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
      title: 'Dépôt en espèces en attente',
      body:
          'Votre dépôt en espèces de $amtStr est en attente. Veuillez fournir vos coordonnées pour que nous envoyions un agent Watsim.',
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
                'Bonjour ! Nous avons reçu votre demande de dépôt en espèces de $amtStr.\n\n'
                'Pour envoyer un agent Watsim chez vous, nous avons besoin de quelques informations :\n\n'
                '1. Nom complet\n'
                '2. Localisation / Adresse\n'
                '3. Numéro de téléphone\n\n'
                'Dès réception, notre agent sera en route pour collecter votre argent.',
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
      title: 'Dépôt en espèces terminé',
      body: '$amtStr ont été crédités sur votre portefeuille Watsim.',
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
            text: 'Bonne nouvelle ! L\'agent Watsim a remis votre argent et'
                'votre dépôt de $amtStr a été confirmé à notre bureau.\n\n'
                '$amtStr ont été crédités sur votre portefeuille Watsim.'
                'Vous pouvez maintenant acheter, transférer ou payer vos cotisations.',
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
      title: 'Montant du dépôt mis à jour',
      body:
          'Vous avez demandé $reqStr mais $colStr ont été reçus. Votre portefeuille a été mis à jour.',
      type: 'transaction',
      iconCodePoint: 0xe002, // warning
      iconColor: 0xFFFF9800, // orange
      timestamp: DateTime.now(),
    ));

    final detailMsg = isMore
        ? 'Attention ! Il y a une petite différence sur votre dépôt en espèces.\n\n'
            '• Vous avez demandé : $reqStr\n'
            '• Montant reçu au bureau : $colStr\n'
            '• Différence : +$diffStr (excédent)\n\n'
            'Votre portefeuille a été crédité du montant réellement reçu ($colStr).'
            'L\'excédent de $diffStr sera examiné et traité par notre équipe.'
            'Pour toute question, répondez ici ou contactez notre support.'
        : 'Attention ! Il y a une différence sur votre dépôt en espèces.\n\n'
            '• Vous avez demandé : $reqStr\n'
            '• Montant reçu au bureau : $colStr\n'
            '• Manquant : $diffStr de moins que demandé\n\n'
            'Votre portefeuille a été crédité de $colStr — le montant réel'
            'remis par l\'agent Watsim.\n\n'
            'Si vous pensez qu\'il s\'agit d\'une erreur, contactez votre agent Watsim'
            'ou répondez ici et notre support vous assistera rapidement. Nous nous excusons pour ce désagrément.';

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
      title: 'Transfert envoyé',
      body: '${_fmt(amount)} envoyés à $recipient avec succès.',
      type: 'transaction',
      iconCodePoint: 0xe8d6,
      iconColor: 0xFF1A5F7A,
      timestamp: DateTime.now(),
    ));
  }

  void onTransferReceived(String sender, int amount) {
    _addNotification(AppNotification(
      id: 'rxr_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Transfert reçu',
      body: '$sender vous a envoyé ${_fmt(amount)}.',
      type: 'transaction',
      iconCodePoint: 0xe058,
      iconColor: 0xFF00A86B,
      timestamp: DateTime.now(),
    ));
  }

  void onDeliveryRequested(String productName) {
    _addNotification(AppNotification(
      id: 'dlv_req_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Livraison demandée',
      body:
          'Votre demande de livraison pour $productName a été reçue. Vous recevrez votre produit sous peu.',
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
                'Votre demande de livraison pour $productName a été confirmée ! Notre équipe prépare votre envoi et vous le recevrez sous peu. Merci d\'utiliser WatSim !',
            isMe: false,
            timestamp: DateTime.now(),
          ));
    });
  }

  void onDeliveryCompleted(String productName) {
    _addNotification(AppNotification(
      id: 'dlv_done_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Produit livré ! 🎉',
      body: '$productName a été livré avec succès. Merci d\'utiliser WatSim !',
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
                'Votre $productName a été livré avec succès ! Nous espérons qu\'il vous plaîra. Pour toute question, contactez notre support.',
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
