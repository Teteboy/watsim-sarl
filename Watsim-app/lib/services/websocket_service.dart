import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../notification_state.dart';
import 'api_service.dart';

class WebSocketMessage {
  final String type;
  final dynamic data;
  final String? conversationId;
  final String? userId;
  final DateTime timestamp;

  WebSocketMessage({
    required this.type,
    required this.data,
    this.conversationId,
    this.userId,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  factory WebSocketMessage.fromJson(Map<String, dynamic> json) {
    return WebSocketMessage(
      type: json['type'] as String,
      data: json['data'],
      conversationId: json['conversationId'] as String?,
      userId: json['userId'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'data': data,
      if (conversationId != null) 'conversationId': conversationId,
      if (userId != null) 'userId': userId,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

class WebSocketService {
  static WebSocketService? _instance;
  static WebSocketService get instance {
    _instance ??= WebSocketService._();
    return _instance!;
  }

  WebSocketService._();

  WebSocketChannel? _channel;
  bool _isConnected = false;
  StreamSubscription? _subscription;
  final Map<String, void Function(WebSocketMessage)> _listeners = {};

  bool get isConnected => _isConnected;

  Future<void> connect() async {
    if (_isConnected) return;

    try {
      final token = await AuthService.getAccessToken();
      if (token == null) {
        print('WebSocket: No access token available');
        return;
      }

      // Use HTTP URL for WebSocket connection
      final wsUrl = kBaseUrl.replaceFirst('http', 'ws') + '/ws?token=$token';
      print('WebSocket: Connecting to $wsUrl');

      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _isConnected = true;

      // Listen for messages
      _subscription = _channel!.stream.listen(
        _handleMessage,
        onError: (error) {
          print('WebSocket error: $error');
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          print('WebSocket connection closed');
          _isConnected = false;
          _scheduleReconnect();
        },
      );

      print('WebSocket: Connected successfully');
    } catch (e) {
      print('WebSocket: Failed to connect - $e');
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final json = Map<String, dynamic>.from(jsonDecode(message as String) as Map<dynamic, dynamic>);
      final wsMessage = WebSocketMessage.fromJson(json);

      print('WebSocket: Received ${wsMessage.type} message');

      // Handle different message types
      switch (wsMessage.type) {
        case 'message':
          _handleNewMessage(wsMessage);
          break;
        case 'conversation_list':
          _handleConversationList(wsMessage);
          break;
        case 'typing':
          _handleTypingIndicator(wsMessage);
          break;
        case 'read':
          _handleReadReceipt(wsMessage);
          break;
        case 'online_status':
          _handleOnlineStatus(wsMessage);
          break;
        case 'error':
          print('WebSocket error from server: ${wsMessage.data}');
          break;
        default:
          // Notify listeners
          final listener = _listeners[wsMessage.type];
          if (listener != null) {
            listener(wsMessage);
          }
      }
    } catch (e) {
      print('WebSocket: Failed to parse message - $e');
    }
  }

  void _handleNewMessage(WebSocketMessage message) {
    final messageData = Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    final senderId = messageData['sender']?['id'] as String? ?? '';
    final isFromMe = senderId.isEmpty || senderId == 'me' || senderId == 'current_user';
    
    // Update notification state - create AppMessage from data
    final msg = AppMessage(
      id: messageData['id']?.toString() ?? '',
      conversationId: messageData['conversationId']?.toString() ?? '',
      text: messageData['content']?.toString() ?? '',
      isMe: isFromMe,
      timestamp: messageData['createdAt'] != null
          ? DateTime.tryParse(messageData['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
    NotificationState.instance.addMessage(
      messageData['conversationId']?.toString() ?? '',
      msg,
    );

    // Show notification if message is from another user
    if (!isFromMe) {
      NotificationState.instance.onNewMessage(
        messageData['conversationId']?.toString() ?? '',
        messageData['sender']?['fullName']?.toString() ?? 'Unknown',
        messageData['content']?.toString() ?? '',
      );
    }
  }

  void _handleConversationList(WebSocketMessage message) {
    final conversations = message.data as List;
    // Update notification state with latest conversations
    for (final conv in conversations) {
      NotificationState.instance.updateConversation(conv);
    }
  }

  void _handleTypingIndicator(WebSocketMessage message) {
    final data = Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    // Update typing indicator in UI
    print('User ${data['userId']} is typing: ${data['isTyping']}');
  }

  void _handleReadReceipt(WebSocketMessage message) {
    final data = Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    // Mark messages as read in UI
    NotificationState.instance.markConversationRead(data['conversationId'] as String);
  }

  void _handleOnlineStatus(WebSocketMessage message) {
    final data = Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    // Update online status in UI
    print('User ${data['userId']} is ${data['isOnline'] ? 'online' : 'offline'}');
  }

  void sendMessage(WebSocketMessage message) {
    if (!_isConnected || _channel == null) {
      print('WebSocket: Not connected, cannot send message');
      return;
    }

    try {
      _channel!.sink.add(jsonEncode(message.toJson()));
    } catch (e) {
      print('WebSocket: Failed to send message - $e');
    }
  }

  void sendChatMessage({
    required String conversationId,
    required String content,
    String type = 'TEXT',
    String? attachmentUrl,
  }) {
    sendMessage(WebSocketMessage(
      type: 'message',
      data: {
        'conversationId': conversationId,
        'content': content,
        'type': type,
        if (attachmentUrl != null) 'attachmentUrl': attachmentUrl,
      },
      conversationId: conversationId,
    ));
  }

  void sendTypingIndicator({
    required String conversationId,
    required bool isTyping,
  }) {
    sendMessage(WebSocketMessage(
      type: 'typing',
      data: {'isTyping': isTyping},
      conversationId: conversationId,
    ));
  }

  void markConversationAsRead(String conversationId) {
    sendMessage(WebSocketMessage(
      type: 'read',
      data: {'conversationId': conversationId},
      conversationId: conversationId,
    ));
  }

  void subscribeToConversation(String conversationId) {
    sendMessage(WebSocketMessage(
      type: 'subscribe',
      data: {},
      conversationId: conversationId,
    ));
  }

  void unsubscribeFromConversation(String conversationId) {
    sendMessage(WebSocketMessage(
      type: 'unsubscribe',
      data: {},
      conversationId: conversationId,
    ));
  }

  void addListener(String messageType, void Function(WebSocketMessage) listener) {
    _listeners[messageType] = listener;
  }

  void removeListener(String messageType) {
    _listeners.remove(messageType);
  }

  Timer? _reconnectTimer;

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      print('WebSocket: Attempting to reconnect...');
      connect();
    });
  }

  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    await _channel?.sink.close();
    _isConnected = false;
    print('WebSocket: Disconnected');
  }

  void dispose() {
    disconnect();
    _instance = null;
  }
}
