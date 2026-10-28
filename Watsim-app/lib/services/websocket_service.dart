import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../notification_state.dart';
import 'api_service.dart';

void _wsLog(String message) {
  if (kDebugMode) debugPrint(message);
}

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
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ??
          DateTime.now(),
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

  static const int _maxReconnectAttempts = 15;
  static const int _maxReconnectDelaySeconds = 60;

  WebSocketChannel? _channel;
  bool _isConnected = false;
  bool _connecting = false;
  StreamSubscription? _subscription;
  final Map<String, List<void Function(WebSocketMessage)>> _listeners = {};
  int _reconnectAttempts = 0;

  /// Outgoing messages queued while disconnected. Flushed on connect.
  final List<WebSocketMessage> _outbox = [];

  bool get isConnected => _isConnected;

  Future<void> connect() async {
    if (_isConnected || _connecting) return;
    _connecting = true;

    try {
      // Refresh the token before connecting so reconnects don't loop on
      // an expired access token.
      try {
        await ApiService.ensureFreshToken();
      } catch (_) {
        // Token refresh failure clears auth; nothing to connect with.
        return;
      }
      final token = await AuthService.getAccessToken();
      if (token == null) {
        _wsLog('WebSocket: No access token available');
        return;
      }

      // Authenticate via Authorization header so the token never appears
      // in the URL (and therefore in server/proxy logs).
      final wsUrl = kBaseUrl.replaceFirst('http', 'ws') + '/ws';
      _wsLog('WebSocket: Connecting');

      // Clean up any previous channel before reconnecting
      await _cleanup();

      final socket = await WebSocket.connect(
        wsUrl,
        headers: {'Authorization': 'Bearer $token'},
      );
      _channel = IOWebSocketChannel(socket);

      // Wait for the handshake to complete before marking connected
      await _channel!.ready;
      _isConnected = true;
      _reconnectAttempts = 0;

      // Listen for messages
      _subscription = _channel!.stream.listen(
        _handleMessage,
        onError: (error) {
          _wsLog('WebSocket error: $error');
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          _wsLog('WebSocket connection closed');
          _isConnected = false;
          _scheduleReconnect();
        },
      );

      _wsLog('WebSocket: Connected successfully');
      _flushOutbox();
    } on SocketException catch (e) {
      _wsLog('WebSocket: Network/DNS failure - $e');
      _isConnected = false;
      _scheduleReconnect();
    } catch (e) {
      _wsLog('WebSocket: Failed to connect - $e');
      _isConnected = false;
      _scheduleReconnect();
    } finally {
      _connecting = false;
    }
  }

  Future<void> _cleanup() async {
    await _subscription?.cancel();
    _subscription = null;
    try {
      await _channel?.sink.close();
    } catch (_) {
      // ignore close errors
    }
    _channel = null;
  }

  Future<void> _handleMessage(dynamic message) async {
    try {
      final json = Map<String, dynamic>.from(
          jsonDecode(message as String) as Map<dynamic, dynamic>);
      final wsMessage = WebSocketMessage.fromJson(json);

      // Handle different message types
      switch (wsMessage.type) {
        case 'message':
          await _handleNewMessage(wsMessage);
          break;
        case 'conversation_list':
          _handleConversationList(wsMessage);
          break;
        case 'typing':
          _handleTypingIndicator(wsMessage);
          break;
        case 'read':
          await _handleReadReceipt(wsMessage);
          break;
        case 'online_status':
          _handleOnlineStatus(wsMessage);
          break;
        case 'error':
          _wsLog('WebSocket error from server: ${wsMessage.data}');
          break;
      }
      // Notify registered listeners (all types, including handled ones).
      _notifyListeners(wsMessage);
    } catch (e) {
      _wsLog('WebSocket: Failed to parse message - $e');
    }
  }

  void _notifyListeners(WebSocketMessage message) {
    final callbacks = _listeners[message.type];
    if (callbacks == null) return;
    for (final fn in List.of(callbacks)) {
      try {
        fn(message);
      } catch (e) {
        _wsLog('WebSocket listener error: $e');
      }
    }
  }

  Future<void> _handleNewMessage(WebSocketMessage message) async {
    final messageData =
        Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    final senderId = messageData['sender']?['id'] as String? ?? '';
    final currentUser = await AuthService.currentUser;
    final currentUserId = currentUser?['id'] as String?;
    final isFromMe = senderId.isNotEmpty && senderId == currentUserId;

    // Update notification state - create AppMessage from data
    final msg = AppMessage(
      id: messageData['id']?.toString() ?? '',
      conversationId: messageData['conversationId']?.toString() ?? '',
      text: messageData['text']?.toString() ??
          messageData['content']?.toString() ??
          '',
      isMe: isFromMe,
      timestamp: messageData['createdAt'] != null
          ? DateTime.tryParse(messageData['createdAt'].toString()) ??
              DateTime.now()
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
        messageData['text']?.toString() ??
            messageData['content']?.toString() ??
            '',
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
    final data =
        Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    final userId = data['userId']?.toString() ?? message.userId ?? '';
    final isTyping = data['isTyping'] == true;
    NotificationState.instance.setUserTyping(userId, isTyping);
  }

  Future<void> _handleReadReceipt(WebSocketMessage message) async {
    final data =
        Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    final convId = data['conversationId']?.toString() ??
        message.conversationId ??
        '';
    if (convId.isEmpty) return;

    // If the read event came from me (e.g. another device), clear my badge.
    // If it came from another participant, only update read ticks on my
    // messages — never clear MY unread count.
    final currentUser = await AuthService.currentUser;
    final currentUserId = currentUser?['id']?.toString();
    final readerId = data['userId']?.toString() ?? message.userId;
    if (readerId != null && readerId == currentUserId) {
      NotificationState.instance.markConversationRead(convId);
    } else {
      NotificationState.instance.markConversationMessagesRead(convId);
    }
  }

  void _handleOnlineStatus(WebSocketMessage message) {
    final data =
        Map<String, dynamic>.from(message.data as Map<dynamic, dynamic>);
    final userId = data['userId']?.toString() ?? message.userId ?? '';
    final isOnline = data['isOnline'] == true;
    NotificationState.instance.setUserOnline(userId, isOnline);
  }

  /// Low-level send. Returns true if the message was written to the socket
  /// or queued for delivery on reconnect; false only on serialization errors.
  bool _send(WebSocketMessage message) {
    if (!_isConnected || _channel == null) {
      _outbox.add(message);
      // Kick off a connection attempt in the background.
      unawaited(connect());
      return true;
    }

    try {
      _channel!.sink.add(jsonEncode(message.toJson()));
      return true;
    } catch (e) {
      _wsLog('WebSocket: Failed to send message - $e');
      _outbox.add(message);
      return true;
    }
  }

  void _flushOutbox() {
    if (_outbox.isEmpty || _channel == null) return;
    final pending = List<WebSocketMessage>.from(_outbox);
    _outbox.clear();
    for (final msg in pending) {
      try {
        _channel!.sink.add(jsonEncode(msg.toJson()));
      } catch (_) {
        _outbox.add(msg);
      }
    }
  }

  /// Send a chat text message. Returns true if sent or queued for retry
  /// once the connection is restored.
  bool sendMessage(String conversationId, String text) {
    return sendChatMessage(
      conversationId: conversationId,
      content: text,
    );
  }

  bool sendChatMessage({
    required String conversationId,
    required String content,
    String type = 'TEXT',
    String? attachmentUrl,
  }) {
    return _send(WebSocketMessage(
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
    // Typing indicators are ephemeral — drop rather than queue.
    if (!_isConnected || _channel == null) return;
    _send(WebSocketMessage(
      type: 'typing',
      data: {'isTyping': isTyping},
      conversationId: conversationId,
    ));
  }

  void markConversationAsRead(String conversationId) {
    _send(WebSocketMessage(
      type: 'read',
      data: {'conversationId': conversationId},
      conversationId: conversationId,
    ));
  }

  void subscribeToConversation(String conversationId) {
    _send(WebSocketMessage(
      type: 'subscribe',
      data: {},
      conversationId: conversationId,
    ));
  }

  void unsubscribeFromConversation(String conversationId) {
    _send(WebSocketMessage(
      type: 'unsubscribe',
      data: {},
      conversationId: conversationId,
    ));
  }

  /// Register a listener for a message type. Multiple listeners per type
  /// are supported.
  void addListener(
      String messageType, void Function(WebSocketMessage) listener) {
    _listeners.putIfAbsent(messageType, () => []).add(listener);
  }

  void removeListener(
      String messageType, void Function(WebSocketMessage) listener) {
    _listeners[messageType]?.remove(listener);
  }

  Timer? _reconnectTimer;

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();

    if (_reconnectAttempts >= _maxReconnectAttempts) {
      _wsLog('WebSocket: Stopping reconnect attempts.');
      return;
    }

    _reconnectAttempts++;
    var delaySeconds = 5 * (1 << (_reconnectAttempts - 1));
    if (delaySeconds > _maxReconnectDelaySeconds) {
      delaySeconds = _maxReconnectDelaySeconds;
    }

    _wsLog(
        'WebSocket: Scheduling reconnect in ${delaySeconds}s (attempt $_reconnectAttempts/$_maxReconnectAttempts)');
    _reconnectTimer = Timer(Duration(seconds: delaySeconds), () {
      connect();
    });
  }

  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _reconnectAttempts = 0;
    _outbox.clear();
    await _cleanup();
    _isConnected = false;
  }

  void dispose() {
    disconnect();
    _instance = null;
  }
}
