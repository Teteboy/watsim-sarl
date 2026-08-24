import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'package:shared_preferences/shared_preferences.dart';

// ─── API Configuration ───────────────────────────────────────────────────
// IMPORTANT:
// - Set the base URL via --dart-define when running the app.
// - Example:
//   flutter run --dart-define=WATSIM_API_BASE=https://watsimsarl.synchroerp.cloud/api/v1
//   flutter run --dart-define=WATSIM_API_ROOT=https://watsimsarl.synchroerp.cloud
//
// Default points to the hosted production backend.
const String kApiBase = String.fromEnvironment(
  'WATSIM_API_BASE',
  defaultValue: 'https://watsimsarl.synchroerp.cloud/api/v1',
);

// Base URL without API prefix for health checks and WebSocket
const String kBaseUrl = String.fromEnvironment(
  'WATSIM_API_ROOT',
  defaultValue: 'https://watsimsarl.synchroerp.cloud',
);

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

// ─── Auth Service ─────────────────────────────────────────────────────────
class AuthService {
  static const _accessKey = 'watsim_access_token';
  static const _refreshKey = 'watsim_refresh_token';
  static const _userKey = 'watsim_user_json';

  static Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessKey);
  }

  static Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshKey);
  }

  static Future<void> saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, access);
    await prefs.setString(_refreshKey, refresh);
  }

  static Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user));
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_userKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
    await prefs.remove(_userKey);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  // Cached current user for synchronous access
  static Map<String, dynamic>? _currentUser;

  static Future<Map<String, dynamic>?> get currentUser async {
    _currentUser ??= await getUser();
    return _currentUser;
  }

  static void setCurrentUser(Map<String, dynamic>? user) {
    _currentUser = user;
  }
}

// ─── API Service ──────────────────────────────────────────────────────────
class ApiService {
  /// Normalize phone for backend.
  /// The app currently collects phone as local digits or with '+'.
  /// Backend expects a single canonical string.
  /// IMPORTANT: do NOT auto-prepend '+237' if the user already provided it.
  static String normalizePhone(String phone) {
    final p = phone.trim();
    if (p.startsWith('+')) return p;
    return '+237$p';
  }

  /// Resolve a stored image URL/path to a full accessible URL.
  /// Handles full URLs, /uploads/ paths, and raw filenames.
  static String resolveImageUrl(String? storedUrl) {
    if (storedUrl == null || storedUrl.isEmpty) {
      return '';
    }
    if (storedUrl.startsWith('http')) {
      return storedUrl;
    }
    if (storedUrl.startsWith('/uploads/')) {
      return '$kBaseUrl$storedUrl';
    }
    // Legacy raw filename fallback
    return '$kBaseUrl/uploads/$storedUrl';
  }

  /// Generic image upload to backend
  static Future<Map<String, dynamic>> uploadImage(
      List<int> imageBytes, String filename) async {
    final uri = Uri.parse('$kApiBase/upload/image');
    final headers = await _headers();
    headers.remove('Content-Type');

    final ext = filename.toLowerCase().split('.').last;
    String contentType = 'image/jpeg';
    if (ext == 'png') contentType = 'image/png';
    if (ext == 'gif') contentType = 'image/gif';
    if (ext == 'webp') contentType = 'image/webp';

    final request = http.MultipartRequest('POST', uri);
    request.headers.addAll(headers);
    request.files.add(http.MultipartFile.fromBytes(
      'image',
      imageBytes,
      filename: filename.isNotEmpty ? filename : 'upload.jpg',
      contentType: MediaType.parse(contentType),
    ));

    final streamedRes = await request.send();
    final res = await http.Response.fromStream(streamedRes);

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, 'Upload failed. Please try again.');
    }

    return _decode(res);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /// Refresh access token using stored refresh token.
  static Future<bool> _refreshToken() async {
    try {
      final refresh = await AuthService.getRefreshToken();
      if (refresh == null || refresh.isEmpty) return false;
      final res = await http.post(
        Uri.parse('$kApiBase/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );
      if (res.statusCode >= 400) return false;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (accessToken != null) {
        await AuthService.saveTokens(accessToken, newRefresh ?? refresh);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Token refresh failed: $e');
      return false;
    }
  }

  /// Check if token is expired (or about to expire within 60s) and refresh if needed.
  /// Clears auth and throws if the refresh token is also expired/invalid.
  static Future<void> _ensureValidToken() async {
    final token = await AuthService.getAccessToken();
    if (token == null || token.isEmpty) return;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      ) as Map<String, dynamic>;
      final exp = payload['exp'] as int?;
      if (exp == null) return;
      final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      if (DateTime.now()
          .isAfter(expiry.subtract(const Duration(seconds: 60)))) {
        final refreshed = await _refreshToken();
        if (!refreshed) {
          await AuthService.clear();
          throw const ApiException(
              401, 'Votre session a expiré. Veuillez vous reconnecter.');
        }
      }
    } on ApiException {
      rethrow;
    } catch (e) {
      debugPrint('Token expiry check failed: $e');
      await AuthService.clear();
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
  }

  static Future<Map<String, String>> _headers({bool auth = true}) async {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      await _ensureValidToken();
      final token = await AuthService.getAccessToken();
      if (token != null) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  static String _fallbackMessage(int statusCode) {
    switch (statusCode) {
      case 400:
        return 'Requête invalide. Veuillez vérifier vos informations.';
      case 401:
        return 'Votre session a expiré. Veuillez vous reconnecter.';
      case 403:
        return 'Vous n\'avez pas la permission d\'effectuer cette action.';
      case 404:
        return 'La ressource demandée est introuvable.';
      case 409:
        return 'Cette action entre en conflit avec des données existantes.';
      case 429:
        return 'Trop de requêtes. Veuillez patienter un moment.';
      default:
        if (statusCode >= 500) {
          return 'Un problème est survenu. Veuillez réessayer plus tard.';
        }
        return 'La requête a échoué. Veuillez réessayer.';
    }
  }

  /// Convert raw backend error text into friendly French toast messages.
  static String _sanitizeErrorMessage(String message, int statusCode) {
    final lower = message.toLowerCase();
    if (lower.contains('invalid credentials') ||
        lower.contains('invalid pin') ||
        lower.contains('incorrect')) {
      return 'Identifiants incorrects. Veuillez vérifier et réessayer.';
    }
    if (lower.contains('unauthorized') || lower.contains('unauthenticated')) {
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    }
    if (lower.contains('network') || lower.contains('socket')) {
      return 'Problème de connexion. Vérifiez votre réseau.';
    }
    if (lower.contains('timeout')) {
      return 'Le serveur met trop de temps à répondre. Veuillez réessayer.';
    }
    if (lower.contains('already exists') || lower.contains('duplicate')) {
      return 'Ces informations existent déjà.';
    }
    if (lower.contains('not found')) {
      return 'Élément introuvable.';
    }
    if (lower.contains('insufficient funds') ||
        lower.contains('insufficient balance')) {
      return 'Solde insuffisant.';
    }
    if (message.length > 200) {
      return _fallbackMessage(statusCode);
    }
    return message;
  }

  static Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode == 401) {
      AuthService.clear();
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    // Gracefully handle empty body (e.g. 204 No Content or proxy strip)
    final bodyText = res.body.trim();
    if (bodyText.isEmpty) {
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      return {};
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(bodyText);
    } catch (e) {
      debugPrint('🔍 JSON parse error: $e');
      debugPrint('🔍 Raw response: $bodyText');
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      throw ApiException(500, _fallbackMessage(500));
    }

    if (decoded is! Map<dynamic, dynamic>) {
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      throw ApiException(500, _fallbackMessage(500));
    }

    final body = Map<String, dynamic>.from(decoded);

    if (res.statusCode >= 400) {
      final dynamic msgRaw =
          body['message'] ?? body['error'] ?? _fallbackMessage(res.statusCode);
      final String rawMsg = msgRaw is String ? msgRaw : msgRaw.toString();
      final msg = _sanitizeErrorMessage(rawMsg, res.statusCode);
      debugPrint('🔍 API error ${res.statusCode}: $msg');
      throw ApiException(res.statusCode, msg);
    }

    return body;
  }

  static List<dynamic> _decodeList(http.Response res) {
    if (res.statusCode == 401) {
      AuthService.clear();
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    final bodyText = res.body.trim();
    if (bodyText.isEmpty) {
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      return [];
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(bodyText);
    } catch (e) {
      debugPrint('🔍 JSON parse error (list): $e');
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      return [];
    }

    if (res.statusCode >= 400) {
      // Error responses may be {message/error} or even a plain string.
      if (decoded is Map<dynamic, dynamic>) {
        final rawMsg = decoded['message'] ??
            decoded['error'] ??
            _fallbackMessage(res.statusCode);
        final msg = rawMsg is String
            ? _sanitizeErrorMessage(rawMsg, res.statusCode)
            : _fallbackMessage(res.statusCode);
        debugPrint('🔍 API error ${res.statusCode}: $msg');
        throw ApiException(res.statusCode, msg);
      }
      throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
    }

    if (decoded is List) return decoded;
    // Some endpoints wrap in {items: [...]}
    if (decoded is Map<dynamic, dynamic> && decoded['items'] is List) {
      return decoded['items'] as List;
    }
    return [];
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> register({
    required String email,
    required String phone,
    required String password,
    required String fullName,
    String? initialPin,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/register'),
      headers: await _headers(auth: false),
      body: jsonEncode({
        'email': email,
        'phone': phone,
        'password': password,
        'fullName': fullName,
        if (initialPin != null) 'initialPin': initialPin,
      }),
    );
    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/login'),
      headers: await _headers(auth: false),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  /// Mobile registration (creates user + sets initial PIN on backend)
  /// Backend currently sets a generated PIN during registration and returns it.
  /// Phone normalization should be done by the caller (no auto +237 here).
  static Future<Map<String, dynamic>> registerPhone({
    required String phone,
    String? referralCode,
  }) async {
    final body = <String, dynamic>{'phone': phone};
    if (referralCode != null && referralCode.isNotEmpty) {
      body['referralCode'] = referralCode;
    }

    debugPrint('🔍 RegisterPhone: Sending request to $kApiBase/auth/register');
    debugPrint('🔍 Body: $body');

    try {
      final res = await http
          .post(
            Uri.parse('$kApiBase/auth/register'),
            headers: await _headers(auth: false),
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 30));

      debugPrint('🔍 Response status: ${res.statusCode}');
      debugPrint('🔍 Response body: ${res.body}');

      final data = _decode(res);
      // Step 1: OTP sent, no tokens yet (will get tokens after complete registration)
      return data;
    } on SocketException catch (e) {
      debugPrint('🔍 Connection error: $e');
      throw ApiException(0,
          'Cannot connect to server. Check your internet and that the backend is running.');
    } on TimeoutException catch (e) {
      debugPrint('🔍 Timeout error: $e');
      throw ApiException(0, 'Connection timed out. Please try again.');
    } catch (e) {
      debugPrint('🔍 Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> loginWithPin({
    required String phone,
    required String pin,
    String? otp2fa,
  }) async {
    final uri = Uri.parse('$kApiBase/auth/login-pin');
    final body = <String, String>{'phone': phone, 'pin': pin};
    if (otp2fa != null) body['otp2fa'] = otp2fa;

    // Capture request/response details so UI can show the *exact* backend body.
    debugPrint('🔍 loginWithPin: POST $uri');
    debugPrint('🔍 loginWithPin: body=$body');

    http.Response res;
    try {
      res = await http.post(
        uri,
        headers: await _headers(auth: false),
        body: jsonEncode(body),
      );
    } on SocketException catch (e) {
      debugPrint('🔍 loginWithPin: SocketException: $e');
      // Add connectivity diagnostics so you can see which host/port/path is failing.
      final diag = await diagnoseConnection();
      throw ApiException(
        0,
        'Cannot connect to server. Check internet + that backend is reachable.\n'
        'SocketException: ${e.message}\n'
        'Diagnostics: ${jsonEncode(diag)}',
      );
    } on TimeoutException catch (e) {
      debugPrint('🔍 loginWithPin: TimeoutException: $e');
      final diag = await diagnoseConnection();
      throw ApiException(
        0,
        'Connection timed out while calling /auth/login-pin.\n'
        '${e.toString()}\n'
        'Diagnostics: ${jsonEncode(diag)}',
      );
    }

    debugPrint('🔍 loginWithPin: status=${res.statusCode}');
    debugPrint('🔍 loginWithPin: raw body=${res.body}');

    try {
      final data = _decode(res);

      // Only save tokens if login is fully complete (not requiring 2FA)
      if (data['requires2FA'] != true) {
        await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
        if (data['user'] != null) await AuthService.saveUser(data['user']);
      }
      return data;
    } on ApiException {
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> verify2FALogin({
    required String phone,
    required String pin,
    required String otp,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/verify-2fa'),
      headers: await _headers(auth: false),
      body: jsonEncode({'phone': phone, 'pin': pin, 'otp': otp}),
    );
    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  static Future<void> logout(String refreshToken) async {
    try {
      await http.post(
        Uri.parse('$kApiBase/auth/logout'),
        headers: await _headers(),
        body: jsonEncode({'refreshToken': refreshToken}),
      );
    } catch (_) {}
    await AuthService.clear();
  }

  static Future<Map<String, dynamic>> sendOtp(String phone) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/send-otp'),
      headers: await _headers(auth: false),
      body: jsonEncode({'phone': phone}),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> verifyOtp(
      String phone, String code) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/verify-otp'),
      headers: await _headers(auth: false),
      body: jsonEncode({'phone': phone, 'code': code}),
    );
    return _decode(res);
  }

  /// Set PIN after OTP verification.
  /// Note: Backend currently requires an authenticated request for /auth/set-pin.
  /// If your backend changes to accept verificationToken, adjust this accordingly.
  static Future<Map<String, dynamic>> setPinAfterOtp(String pin) async {
    return setPin(pin);
  }

  /// Reset PIN using verification token from OTP
  static Future<Map<String, dynamic>> resetPinWithToken({
    required String verificationToken,
    required String newPin,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/reset-pin'),
      headers: await _headers(auth: false),
      body: jsonEncode({
        'verificationToken': verificationToken,
        'newPin': newPin,
      }),
    );
    return _decode(res);
  }

  // ── KYC ──────────────────────────────────────────────────────────────

  /// Upload KYC documents (front + back of ID card)
  static Future<Map<String, dynamic>> uploadKyc({
    required File frontImage,
    required File backImage,
    String docType = 'NATIONAL_ID',
  }) async {
    final token = await AuthService.getAccessToken();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$kApiBase/auth/kyc/upload'),
    );
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.fields['type'] = docType;
    request.files.add(
      await http.MultipartFile.fromPath('id', frontImage.path,
          filename: 'id_front.jpg'),
    );
    request.files.add(
      await http.MultipartFile.fromPath('back', backImage.path,
          filename: 'id_back.jpg'),
    );
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }

  // ── Products ──────────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchProducts({
    int page = 1,
    int limit = 20,
    String? search,
    String? categoryId,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'categoryId': categoryId,
    };
    final uri =
        Uri.parse('$kApiBase/products').replace(queryParameters: params);
    final res = await http.get(uri);
    return _decodeList(res);
  }

  /// “Exclusive offers” = backend-driven best offers (best price)
  static Future<List<dynamic>> fetchBestOffers({int limit = 8}) async {
    final uri = Uri.parse('$kApiBase/products/best-offers')
        .replace(queryParameters: {'limit': limit.toString()});
    final res = await http.get(uri);
    return _decodeList(res);
  }

  static Future<List<dynamic>> fetchCategories() async {
    final res = await http.get(Uri.parse('$kApiBase/products/categories'));
    if (res.statusCode >= 400) return [];
    final decoded = jsonDecode(res.body);
    if (decoded is List) return decoded;
    if (decoded is Map && decoded['items'] is List)
      return decoded['items'] as List;
    return [];
  }

  // ── Wallet & Transactions ─────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchWallet() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/wallet'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<List<dynamic>> fetchTransactions({
    int page = 1,
    int limit = 30,
  }) async {
    final uri = Uri.parse('$kApiBase/users/me/transactions').replace(
        queryParameters: {'page': page.toString(), 'limit': limit.toString()});
    final res = await http.get(uri, headers: await _headers());
    return _decodeList(res);
  }

  // ── BNPL / Orders ─────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchOrders({
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse('$kApiBase/users/me/purchases').replace(
        queryParameters: {'page': page.toString(), 'limit': limit.toString()});
    final res = await http.get(uri, headers: await _headers());
    final body = _decode(res);
    // Backend returns {items: [...]}
    final items = body['items'];
    if (items is List) return items;
    return [];
  }

  // ── Notifications ─────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchNotifications() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/notifications'),
      headers: await _headers(),
    );
    return _decodeList(res);
  }

  static Future<int> fetchUnreadNotificationCount() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/notifications/unread-count'),
      headers: await _headers(),
    );
    if (res.statusCode >= 400) return 0;
    final data = jsonDecode(res.body);
    return (data['count'] ?? 0) as int;
  }

  static Future<void> markNotificationRead(String id) async {
    await http.put(
      Uri.parse('$kApiBase/users/me/notifications/$id/read'),
      headers: await _headers(),
    );
  }

  static Future<void> markAllNotificationsRead() async {
    await http.put(
      Uri.parse('$kApiBase/users/me/notifications/mark-all-read'),
      headers: await _headers(),
    );
  }

  static Future<void> deleteNotification(String id) async {
    final res = await http.delete(
      Uri.parse('$kApiBase/users/me/notifications/$id'),
      headers: await _headers(),
    );
    _decode(res);
  }

  // ── Payments ──────────────────────────────────────────────────────────

  /// Initiate a deposit (creates a transaction + triggers CamPay payment)
  static Future<Map<String, dynamic>> initiateDeposit({
    required int amount,
    required String provider, // 'ORANGE_MONEY' or 'MTN_MOMO'
    required String phone,
  }) async {
    // 1. Create a DEPOSIT transaction
    debugPrint(
        'API: POST /users/me/transactions/deposit amount=$amount provider=$provider');
    final txRes = await http
        .post(
      Uri.parse('$kApiBase/users/me/transactions/deposit'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount, 'provider': provider}),
    )
        .timeout(const Duration(seconds: 30), onTimeout: () {
      throw Exception(
          'Transaction creation timed out. Check server connection.');
    });
    debugPrint('API: txRes status=${txRes.statusCode} body=${txRes.body}');
    final txData = _decode(txRes);
    final transactionId = txData['transactionId'] as String;
    debugPrint('API: transactionId=$transactionId');

    // 2. Initiate payment via CamPay
    debugPrint('API: POST /payments/initiate txId=$transactionId');
    final payRes = await http
        .post(
      Uri.parse('$kApiBase/payments/initiate'),
      headers: await _headers(),
      body: jsonEncode({
        'transactionId': transactionId,
        'provider': provider,
        'phone': phone,
      }),
    )
        .timeout(const Duration(seconds: 30), onTimeout: () {
      throw Exception('Payment initiation timed out. Check server connection.');
    });
    debugPrint('API: payRes status=${payRes.statusCode} body=${payRes.body}');
    final payData = _decode(payRes);
    return {
      ...payData,
      'transactionId': transactionId,
    };
  }

  /// Initiate a wallet withdrawal to mobile money or cash.
  static Future<Map<String, dynamic>> initiateWithdrawal({
    required int amount,
    required String provider, // 'ORANGE_MONEY' or 'MTN_MOMO'
    required String phone,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/withdraw'),
      headers: await _headers(),
      body: jsonEncode({
        'amount': amount,
        'provider': provider,
        'phoneNumber': phone,
      }),
    );
    return _decode(res);
  }

  /// Initiate a wallet-to-wallet transfer to another Watsim user.
  static Future<Map<String, dynamic>> initiateTransfer({
    required int amount,
    required String recipientIdentifier, // phone, email or user id
    String? note,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/wallet/transfer'),
      headers: await _headers(),
      body: jsonEncode({
        'amount': amount,
        'recipientIdentifier': recipientIdentifier,
        if (note != null && note.isNotEmpty) 'note': note,
      }),
    );
    return _decode(res);
  }

  /// Poll the status of any user transaction.
  static Future<Map<String, dynamic>> getTransactionStatus(
      String transactionId) async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/transactions/$transactionId/status'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Poll payment status
  static Future<Map<String, dynamic>> getPaymentStatus(
      String transactionId) async {
    final res = await http.get(
      Uri.parse('$kApiBase/payments/$transactionId/status'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Simulate a BNPL purchase plan
  static Future<Map<String, dynamic>> simulateBnpl({
    required String productId,
    required int instalmentCount,
    String frequency = 'monthly',
    int? downPayment,
  }) async {
    final body = {
      'productId': productId,
      'instalmentCount': instalmentCount,
      'frequency': frequency,
      if (downPayment != null && downPayment > 0) 'downPayment': downPayment,
    };
    final res = await http.post(
      Uri.parse('$kApiBase/bnpl/simulate'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  /// Request a BNPL purchase
  static Future<Map<String, dynamic>> requestBnpl({
    required String productId,
    required int instalmentCount,
    required String paymentProvider,
    required String phone,
    int? downPayment,
    String frequency = 'monthly',
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/bnpl/purchase'),
      headers: await _headers(),
      body: jsonEncode({
        'productId': productId,
        'instalmentCount': instalmentCount,
        'paymentProvider': paymentProvider,
        'phone': phone,
        if (downPayment != null) 'downPayment': downPayment,
        'frequency': frequency,
      }),
    );
    return _decode(res);
  }

  /// Pay an instalment (repayment)
  static Future<Map<String, dynamic>> payInstalment({
    required String purchaseId,
    required String instalmentId,
    required String paymentProvider,
    required String phone,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/bnpl/purchases/$purchaseId/repay'),
      headers: await _headers(),
      body: jsonEncode({
        'instalmentId': instalmentId,
        'paymentProvider': paymentProvider,
        'phone': phone,
      }),
    );
    return _decode(res);
  }

  // ── PIN management ────────────────────────────────────────────────────

  /// Set or change PIN after login (requires JWT token in storage)
  static Future<Map<String, dynamic>> setPin(String pin) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/set-pin'),
      headers: await _headers(),
      body: jsonEncode({'pin': pin}),
    );
    return _decode(res);
  }

  /// Change PIN with current PIN verification
  static Future<Map<String, dynamic>> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/change-pin'),
      headers: await _headers(),
      body: jsonEncode({
        'currentPin': currentPin,
        'newPin': newPin,
      }),
    );
    return _decode(res);
  }

  /// Complete registration with PIN after OTP verification
  static Future<Map<String, dynamic>> registerComplete({
    required String verificationToken,
    required String pin,
    String? fullName,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/register-complete'),
      headers: await _headers(auth: false),
      body: jsonEncode({
        'verificationToken': verificationToken,
        'pin': pin,
        if (fullName != null) 'fullName': fullName,
      }),
    );
    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  /// Reset PIN via OTP verification token (returned from verifyOtp)
  static Future<Map<String, dynamic>> resetPin({
    required String verificationToken,
    required String newPin,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/reset-pin'),
      headers: await _headers(auth: false),
      body: jsonEncode(
          {'verificationToken': verificationToken, 'newPin': newPin}),
    );
    return _decode(res);
  }

  // ── Messaging ─────────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchConversations() async {
    final res = await http.get(
      Uri.parse('$kApiBase/messages/conversations'),
      headers: await _headers(),
    );
    if (res.statusCode >= 400) return [];
    final body = jsonDecode(res.body);
    if (body is Map && body['conversations'] is List)
      return body['conversations'] as List;
    if (body is List) return body;
    return [];
  }

  static Future<String> getOrCreateSupportConversation() async {
    final res = await http.get(
      Uri.parse('$kApiBase/messages/support/conversation'),
      headers: await _headers(),
    );
    final body = _decode(res);
    return body['conversationId'] as String;
  }

  static Future<List<dynamic>> fetchMessages(String convId,
      {int limit = 50}) async {
    final uri = Uri.parse('$kApiBase/messages/conversations/$convId/messages')
        .replace(queryParameters: {'limit': limit.toString()});
    final res = await http.get(uri, headers: await _headers());
    if (res.statusCode >= 400) return [];
    final body = jsonDecode(res.body);
    if (body is Map && body['messages'] is List)
      return body['messages'] as List;
    return [];
  }

  static Future<Map<String, dynamic>> sendChatMessage(
      String convId, String text) async {
    final res = await http.post(
      Uri.parse('$kApiBase/messages/conversations/$convId/messages'),
      headers: await _headers(),
      body: jsonEncode({'text': text}),
    );
    return _decode(res);
  }

  static Future<void> markConversationRead(String convId) async {
    try {
      await http.post(
        Uri.parse('$kApiBase/messages/conversations/$convId/read'),
        headers: await _headers(),
        body: jsonEncode({}),
      );
    } catch (_) {}
  }

  static Future<String> createOrGetConversation(
      List<String> participantIds) async {
    final res = await http.post(
      Uri.parse('$kApiBase/messages/conversations'),
      headers: await _headers(),
      body: jsonEncode({'participantIds': participantIds}),
    );
    final body = _decode(res);
    return body['conversationId'] as String;
  }

  /// Create a 1:1 conversation by the other user's phone number.
  static Future<String> createOrGetConversationByPhone(String phone) async {
    final res = await http.post(
      Uri.parse('$kApiBase/messages/conversations'),
      headers: await _headers(),
      body: jsonEncode({
        'participantPhones': [phone]
      }),
    );
    final body = _decode(res);
    return body['conversationId'] as String;
  }

  // ── Profile ───────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchStatistics() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/statistics'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> fetchProfile() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> updateProfile({
    String? fullName,
    String? phone,
  }) async {
    final res = await http.put(
      Uri.parse('$kApiBase/users/me'),
      headers: await _headers(),
      body: jsonEncode({
        if (fullName != null) 'fullName': fullName,
        if (phone != null) 'phone': phone,
      }),
    );
    return _decode(res);
  }

  /// Get credit score with breakdown
  static Future<Map<String, dynamic>> getCreditScore() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/credit-score'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Get credit score history
  static Future<List<dynamic>> getCreditScoreHistory({int limit = 10}) async {
    final uri = Uri.parse('$kApiBase/users/me/credit-score/history')
        .replace(queryParameters: {'limit': limit.toString()});
    final res = await http.get(uri, headers: await _headers());
    return _decodeList(res);
  }

  /// Get credit score improvement tips
  static Future<List<String>> getCreditScoreTips() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/credit-score/tips'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<String>.from(data['tips'] ?? []);
  }

  /// Fetch active publicity/ads for mobile app
  static Future<List<Map<String, dynamic>>> fetchPublicities() async {
    final res = await http.get(
      Uri.parse('$kApiBase/publicities/active'),
      headers: await _headers(),
    );
    final data = _decode(res);
    final publicities = data['publicities'] as List<dynamic>?;
    return publicities
            ?.map((e) => Map<String, dynamic>.from(e as Map<dynamic, dynamic>))
            .toList() ??
        [];
  }

  /// Upload profile picture
  static Future<Map<String, dynamic>> uploadProfilePicture(
      List<int> imageBytes, String filename) async {
    final uri = Uri.parse('$kApiBase/users/me/profile-picture');
    final headers = await _headers();

    // Remove Content-Type from headers as multipart sets its own
    headers.remove('Content-Type');

    // Detect content type from filename extension
    final ext = filename.toLowerCase().split('.').last;
    String contentType = 'image/jpeg';
    if (ext == 'png') contentType = 'image/png';
    if (ext == 'gif') contentType = 'image/gif';
    if (ext == 'webp') contentType = 'image/webp';

    final request = http.MultipartRequest('POST', uri);
    request.headers.addAll(headers);

    request.files.add(http.MultipartFile.fromBytes(
      'image',
      imageBytes,
      filename: filename.isNotEmpty ? filename : 'profile.jpg',
      contentType: MediaType.parse(contentType),
    ));

    final streamedRes = await request.send();
    final res = await http.Response.fromStream(streamedRes);

    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, 'Upload failed. Please try again.');
    }

    return _decode(res);
  }

  // ── Single Purchase ────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getPurchase(String purchaseId) async {
    final res = await http.get(
      Uri.parse('$kApiBase/bnpl/purchases/$purchaseId'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  // ── Health & Validation ────────────────────────────────────────────────

  /// Check if backend is reachable
  static Future<bool> checkHealth() async {
    try {
      final res = await http
          .get(Uri.parse('$kBaseUrl/health'))
          .timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Comprehensive connection diagnostic
  static Future<Map<String, dynamic>> diagnoseConnection() async {
    final results = <String, dynamic>{
      'apiBase': kApiBase,
      'baseUrl': kBaseUrl,
      'timestamp': DateTime.now().toIso8601String(),
      'troubleshootingSteps': [
        '1. Verify backend is running: npm run dev',
        '2. Check Windows Firewall allows port 3001',
        '3. Ensure phone and computer are on same WiFi',
        '4. Try accessing from computer browser first',
        '5. Disable mobile data on phone (use WiFi only)',
        '6. Check router does not have AP/client isolation',
      ],
    };

    // Test 1: Basic health check
    try {
      final stopwatch = Stopwatch()..start();
      final res = await http
          .get(Uri.parse('$kBaseUrl/health'))
          .timeout(const Duration(seconds: 5));
      stopwatch.stop();
      results['healthCheck'] = {
        'success': res.statusCode == 200,
        'statusCode': res.statusCode,
        'responseTimeMs': stopwatch.elapsedMilliseconds,
        'body': res.body,
      };
    } on SocketException catch (e) {
      results['healthCheck'] = {
        'success': false,
        'error': 'SocketException: ${e.message}',
        'osError': e.osError?.toString(),
        'hint':
            'Cannot reach backend. Check if backend is running and firewall allows port 3001',
      };
    } on TimeoutException catch (_) {
      results['healthCheck'] = {
        'success': false,
        'error': 'TimeoutException: Request took longer than 5 seconds',
        'hint':
            'Backend may be running but blocked by firewall or router isolation',
      };
    } catch (e) {
      results['healthCheck'] = {
        'success': false,
        'error': e.toString(),
        'type': e.runtimeType.toString(),
      };
    }

    // Test 2: Network test endpoint
    if (results['healthCheck']['success'] == true) {
      try {
        final res = await http
            .get(Uri.parse('$kBaseUrl/network-test'))
            .timeout(const Duration(seconds: 5));
        results['networkTest'] = {
          'success': res.statusCode == 200,
          'response': jsonDecode(res.body),
        };
      } catch (e) {
        results['networkTest'] = {'success': false, 'error': e.toString()};
      }
    }

    return results;
  }

  /// Check whether the stored token is locally valid (not expired).
  static Future<bool> _isTokenLocallyValid() async {
    final token = await AuthService.getAccessToken();
    if (token == null || token.isEmpty) return false;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      ) as Map<String, dynamic>;
      final exp = payload['exp'] as int?;
      if (exp == null) return true;
      final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      return DateTime.now().isBefore(expiry);
    } catch (e) {
      return false;
    }
  }

  /// Validate stored auth token is still valid (with timeout).
  /// Only returns false on 401 or if the token is locally expired.
  /// On timeout or other network issues, falls back to local expiry check.
  static Future<bool> validateToken() async {
    try {
      debugPrint('🔍 API: validateToken - checking with timeout');
      await fetchProfile().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('🔍 API: validateToken - TIMEOUT');
          throw TimeoutException('Token validation timeout');
        },
      );
      debugPrint('🔍 API: validateToken - SUCCESS');
      return true;
    } on ApiException catch (e) {
      debugPrint('🔍 API: validateToken - ApiException ${e.statusCode}');
      if (e.statusCode == 401) return false;
      // Server error / empty body – trust local JWT expiry instead of kicking user out
      return await _isTokenLocallyValid();
    } on TimeoutException catch (_) {
      debugPrint('🔍 API: validateToken - timeout, checking local expiry');
      return await _isTokenLocallyValid();
    } catch (e) {
      debugPrint('🔍 API: validateToken - ERROR: $e');
      return await _isTokenLocallyValid();
    }
  }

  // ─── Referrals ─────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchReferralStats() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/referral'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> updateReferralCode(String code) async {
    final res = await http.patch(
      Uri.parse('$kApiBase/users/me/referral'),
      headers: await _headers(),
      body: jsonEncode({'code': code.trim().toUpperCase()}),
    );
    return _decode(res);
  }

  static Future<bool> registerWithReferral(
      String phone, String? referralCode) async {
    final body = <String, dynamic>{'phone': phone};
    if (referralCode != null && referralCode.isNotEmpty) {
      body['referralCode'] = referralCode;
    }
    final res = await http.post(
      Uri.parse('$kApiBase/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode,
          jsonDecode(res.body)['message'] ?? 'Registration failed');
    }
    final data = jsonDecode(res.body);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    await AuthService.saveUser(data['user']);
    return true;
  }

  // ─── Rewards & Cashback ──────────────────────────────────────────────────

  /// Fetches user's rewards summary including available balance, pending balance, and history.
  static Future<Map<String, dynamic>> fetchRewardsSummary() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/rewards'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Withdraws rewards to mobile money (MTN, Orange, Wave).
  static Future<Map<String, dynamic>> withdrawRewards({
    required int amount,
    required String phoneNumber,
    required String method, // 'mtn', 'orange', 'wave'
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/rewards/withdraw'),
      headers: await _headers(),
      body: jsonEncode({
        'amount': amount,
        'phoneNumber': phoneNumber,
        'method': method,
      }),
    );
    return _decode(res);
  }

  /// Converts available rewards/cashback to main wallet balance.
  static Future<Map<String, dynamic>> convertRewardsToWallet(int amount) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/rewards/convert'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount}),
    );
    return _decode(res);
  }

  /// Fetches user's badges/achievements with earned status.
  static Future<Map<String, dynamic>> fetchBadges() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/badges'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Checks and awards new badges based on user activity.
  static Future<Map<String, dynamic>> checkAndAwardBadges() async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/badges/check'),
      headers: await _headers(),
      body: jsonEncode({}),
    );
    return _decode(res);
  }

  // ─── Wallet Transfers ────────────────────────────────────────────────────

  /// Transfers money from user's wallet to another user.
  static Future<Map<String, dynamic>> transferMoney({
    required String recipientIdentifier,
    required int amount,
    String? note,
  }) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/wallet/transfer'),
      headers: await _headers(),
      body: jsonEncode({
        'recipientIdentifier': recipientIdentifier,
        'amount': amount,
        'note': note,
      }),
    );
    return _decode(res);
  }

  /// Fetches user's transfer history.
  static Future<Map<String, dynamic>> fetchTransferHistory(
      {int limit = 20}) async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/wallet/transfers?limit=$limit'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Searches for a user by phone, email, or userId for transfers.
  static Future<Map<String, dynamic>?> searchUser(String identifier) async {
    final res = await http.get(
      Uri.parse(
          '$kApiBase/users/search?identifier=${Uri.encodeComponent(identifier)}'),
      headers: await _headers(),
    );
    if (res.statusCode == 200) {
      return _decode(res);
    }
    return null;
  }

  // ─── Security Settings ───────────────────────────────────────────────────

  /// Get user security settings
  static Future<Map<String, dynamic>> getSecuritySettings() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/security'),
      headers: await _headers(),
    );
    final data = _decode(res);
    final settings = data['settings'];
    if (settings is Map<dynamic, dynamic>) {
      return Map<String, dynamic>.from(settings);
    }
    return (settings as Map<String, dynamic>?) ?? {};
  }

  /// Update user security settings
  static Future<Map<String, dynamic>> updateSecuritySettings({
    bool? fingerprintEnabled,
    bool? faceIdEnabled,
    bool? irisEnabled,
    bool? twoFAEnabled,
    bool? loginAlertsEnabled,
    bool? transactionAlertsEnabled,
  }) async {
    final body = <String, dynamic>{};
    if (fingerprintEnabled != null)
      body['fingerprintEnabled'] = fingerprintEnabled;
    if (faceIdEnabled != null) body['faceIdEnabled'] = faceIdEnabled;
    if (irisEnabled != null) body['irisEnabled'] = irisEnabled;
    if (twoFAEnabled != null) body['twoFAEnabled'] = twoFAEnabled;
    if (loginAlertsEnabled != null)
      body['loginAlertsEnabled'] = loginAlertsEnabled;
    if (transactionAlertsEnabled != null)
      body['transactionAlertsEnabled'] = transactionAlertsEnabled;

    final res = await http.put(
      Uri.parse('$kApiBase/users/me/security'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    final data = _decode(res);
    final settings = data['settings'];
    if (settings is Map<dynamic, dynamic>) {
      return Map<String, dynamic>.from(settings);
    }
    return (settings as Map<String, dynamic>?) ?? {};
  }

  /// Freeze user account
  static Future<Map<String, dynamic>> freezeAccount({String? reason}) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/security/freeze'),
      headers: await _headers(),
      body: jsonEncode({'reason': reason}),
    );
    return _decode(res);
  }

  /// Unfreeze user account
  static Future<Map<String, dynamic>> unfreezeAccount() async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/security/unfreeze'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  // ─── Support Tickets ───────────────────────────────────────────────────────

  /// Get FAQ data
  static Future<List<Map<String, dynamic>>> getFAQ() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/support/faq'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<Map<String, dynamic>>.from(data['faqs'] ?? []);
  }

  /// Get all user support tickets
  static Future<List<Map<String, dynamic>>> getSupportTickets() async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/support/tickets'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<Map<String, dynamic>>.from(data['tickets'] ?? []);
  }

  /// Get specific support ticket
  static Future<Map<String, dynamic>?> getSupportTicket(String ticketId) async {
    final res = await http.get(
      Uri.parse('$kApiBase/users/me/support/tickets/$ticketId'),
      headers: await _headers(),
    );
    if (res.statusCode == 404) return null;
    final data = _decode(res);
    return data['ticket'] as Map<String, dynamic>?;
  }

  /// Create new support ticket
  static Future<Map<String, dynamic>> createSupportTicket({
    required String category,
    required String subject,
    required String description,
    String? priority,
  }) async {
    final body = <String, dynamic>{
      'category': category,
      'subject': subject,
      'description': description,
    };
    if (priority != null) body['priority'] = priority;

    final res = await http.post(
      Uri.parse('$kApiBase/users/me/support/tickets'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    final data = _decode(res);
    return data['ticket'] as Map<String, dynamic>;
  }

  /// Add message to support ticket
  static Future<Map<String, dynamic>?> addTicketMessage(
    String ticketId,
    String message,
  ) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/support/tickets/$ticketId/messages'),
      headers: await _headers(),
      body: jsonEncode({'message': message}),
    );
    if (res.statusCode == 404) return null;
    final data = _decode(res);
    return data['ticket'] as Map<String, dynamic>?;
  }

  /// Close support ticket
  static Future<bool> closeSupportTicket(String ticketId) async {
    final res = await http.post(
      Uri.parse('$kApiBase/users/me/support/tickets/$ticketId/close'),
      headers: await _headers(),
    );
    return res.statusCode < 400;
  }
}
