import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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

/// Debug logging that is compiled out of release builds.
void apiLog(String message) {
  if (kDebugMode) debugPrint(message);
}

/// HTTP client that applies a global timeout to every request so stalled
/// connections can't hang the app indefinitely.
class _TimeoutClient extends http.BaseClient {
  _TimeoutClient(this._inner, this._timeout);
  final http.Client _inner;
  final Duration _timeout;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) =>
      _inner.send(request).timeout(_timeout);

  @override
  void close() => _inner.close();
}

// ─── Auth Service ─────────────────────────────────────────────────────────
class AuthService {
  static const _accessKey = 'watsim_access_token';
  static const _refreshKey = 'watsim_refresh_token';
  static const _userKey = 'watsim_user_json';

  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> getAccessToken() =>
      _secureStorage.read(key: _accessKey);

  static Future<String?> getRefreshToken() =>
      _secureStorage.read(key: _refreshKey);

  static Future<void> saveTokens(String access, String refresh) async {
    await _secureStorage.write(key: _accessKey, value: access);
    await _secureStorage.write(key: _refreshKey, value: refresh);
    // Remove legacy plaintext copies from SharedPreferences if present.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
  }

  static Future<void> saveUser(Map<String, dynamic> user) async {
    await _secureStorage.write(key: _userKey, value: jsonEncode(user));
    _currentUser = Map<String, dynamic>.from(user);
    // Remove legacy plaintext copy from SharedPreferences if present.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final raw = await _secureStorage.read(key: _userKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  static Future<void> clear() async {
    _currentUser = null;
    await _secureStorage.delete(key: _accessKey);
    await _secureStorage.delete(key: _refreshKey);
    await _secureStorage.delete(key: _userKey);
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
  static const Duration _timeout = Duration(seconds: 30);
  static final http.Client _client = _TimeoutClient(http.Client(), _timeout);

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

  /// In-flight refresh, so concurrent requests share a single refresh call.
  static Future<bool>? _refreshFuture;

  /// Refresh access token using stored refresh token.
  /// Concurrent callers share one in-flight request (single-flight).
  static Future<bool> _refreshToken() {
    return _refreshFuture ??= _doRefreshToken().whenComplete(() {
      _refreshFuture = null;
    });
  }

  static Future<bool> _doRefreshToken() async {
    try {
      final refresh = await AuthService.getRefreshToken();
      if (refresh == null || refresh.isEmpty) return false;
      final res = await _client.post(
        Uri.parse('$kApiBase/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );
      if (res.statusCode == 401 || res.statusCode == 403) return false;
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (accessToken != null) {
        await AuthService.saveTokens(accessToken, newRefresh ?? refresh);
        return true;
      }
      throw const ApiException(500, 'Réponse de renouvellement invalide.');
    } catch (e) {
      apiLog('Token refresh failed: $e');
      rethrow;
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
      apiLog('Token expiry check failed: $e');
      throw const ApiException(500, 'Impossible de vérifier la session. Veuillez réessayer.');
    }
  }

  /// Public entry point so non-HTTP clients (e.g. WebSocket) can ensure the
  /// stored access token is fresh before connecting.
  static Future<void> ensureFreshToken() => _ensureValidToken();

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
      apiLog('JSON parse error: $e');
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
      apiLog('API error ${res.statusCode}: $msg');
      throw ApiException(res.statusCode, msg);
    }

    return body;
  }

  static List<dynamic> _decodeList(http.Response res) {
    if (res.statusCode == 401) {
      if (res.request?.headers.keys.any(
              (key) => key.toLowerCase() == 'authorization') ?? false) {
        AuthService.clear();
      }
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
      apiLog('JSON parse error (list): $e');
      if (res.statusCode >= 400) {
        throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
      }
      throw ApiException(500, _fallbackMessage(500));
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
        apiLog('API error ${res.statusCode}: $msg');
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

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/auth/login'),
      headers: await _headers(auth: false),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  /// Mobile registration — single step: creates the user with a PIN and
  /// returns auth tokens. No OTP step.
  /// Phone normalization should be done by the caller (no auto +237 here).
  static Future<Map<String, dynamic>> registerPhone({
    required String phone,
    required String pin,
    String? fullName,
    String? referralCode,
  }) async {
    final body = <String, dynamic>{'phone': phone, 'pin': pin};
    if (fullName != null && fullName.isNotEmpty) {
      body['fullName'] = fullName;
    }
    if (referralCode != null && referralCode.isNotEmpty) {
      body['referralCode'] = referralCode;
    }

    try {
      final res = await _client.post(
        Uri.parse('$kApiBase/auth/register'),
        headers: await _headers(auth: false),
        body: jsonEncode(body),
      );

      final data = _decode(res);
      await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
      if (data['user'] != null) await AuthService.saveUser(data['user']);
      return data;
    } on SocketException {
      throw const ApiException(
          0, 'Problème de connexion. Vérifiez votre réseau.');
    } on TimeoutException {
      throw const ApiException(
          0, 'Le serveur met trop de temps à répondre. Veuillez réessayer.');
    } on ApiException {
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> loginWithPin({
    required String phone,
    required String pin,
  }) async {
    final uri = Uri.parse('$kApiBase/auth/login-pin');
    final body = <String, String>{'phone': phone, 'pin': pin};

    http.Response res;
    try {
      res = await _client.post(
        uri,
        headers: await _headers(auth: false),
        body: jsonEncode(body),
      );
    } on SocketException {
      throw const ApiException(
          0, 'Problème de connexion. Vérifiez votre réseau.');
    } on TimeoutException {
      throw const ApiException(
          0, 'Le serveur met trop de temps à répondre. Veuillez réessayer.');
    }

    final data = _decode(res);
    await AuthService.saveTokens(data['accessToken'], data['refreshToken']);
    if (data['user'] != null) await AuthService.saveUser(data['user']);
    return data;
  }

  static Future<void> logout(String refreshToken) async {
    try {
      await _client.post(
        Uri.parse('$kApiBase/auth/logout'),
        headers: await _headers(),
        body: jsonEncode({'refreshToken': refreshToken}),
      );
    } catch (_) {}
    await AuthService.clear();
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
    final res = await _client.get(uri);
    return _decodeList(res);
  }

  /// Fetch products with pagination metadata.
  /// Returns { 'items': [...], 'pagination': { page, limit, total, totalPages } }
  static Future<Map<String, dynamic>> fetchProductsPaginated({
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
    final res = await _client.get(uri);
    final bodyText = res.body.trim();
    if (res.statusCode == 401) {
      // Public product requests do not carry credentials.
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    dynamic decoded;
    try {
      decoded = bodyText.isEmpty ? null : jsonDecode(bodyText);
    } catch (_) {
      decoded = null;
    }
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
    }
    if (decoded is Map<String, dynamic>) return decoded;
    // Fallback: wrap list in pagination envelope
    if (decoded is List) {
      return {
        'items': decoded,
        'pagination': {
          'page': page,
          'limit': limit,
          'total': decoded.length,
          'totalPages': 1
        }
      };
    }
    return {
      'items': [],
      'pagination': {'page': page, 'limit': limit, 'total': 0, 'totalPages': 0}
    };
  }

  /// “Exclusive offers” = backend-driven best offers (best price)
  static Future<List<dynamic>> fetchBestOffers({int limit = 8}) async {
    final uri = Uri.parse('$kApiBase/products/best-offers')
        .replace(queryParameters: {'limit': limit.toString()});
    final res = await _client.get(uri);
    return _decodeList(res);
  }

  static Future<List<dynamic>> fetchCategories() async {
    try {
      final res = await _client.get(Uri.parse('$kApiBase/products/categories'));
      if (res.statusCode >= 400) return [];
      final decoded = jsonDecode(res.body);
      if (decoded is List) return decoded;
      if (decoded is Map && decoded['items'] is List) {
        return decoded['items'] as List;
      }
      return [];
    } on ApiException {
      rethrow;
    } catch (_) {
      return [];
    }
  }

  // ── Wallet & Transactions ─────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchWallet() async {
    final res = await _client.get(
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
    final res = await _client.get(uri, headers: await _headers());
    return _decodeList(res);
  }

  // ── BNPL / Orders ─────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchOrders({
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse('$kApiBase/users/me/purchases').replace(
        queryParameters: {'page': page.toString(), 'limit': limit.toString()});
    final res = await _client.get(uri, headers: await _headers());
    final body = _decode(res);
    // Backend returns {items: [...]}
    final items = body['items'];
    if (items is List) return items;
    return [];
  }

  // ── Notifications ─────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchNotifications() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/notifications'),
      headers: await _headers(),
    );
    return _decodeList(res);
  }

  static Future<int> fetchUnreadNotificationCount() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/notifications/unread-count'),
      headers: await _headers(),
    );
    if (res.statusCode >= 400) return 0;
    try {
      final data = jsonDecode(res.body);
      return (data['count'] ?? 0) as int;
    } catch (_) {
      return 0;
    }
  }

  static Future<void> markNotificationRead(String id) async {
    await _client.put(
      Uri.parse('$kApiBase/users/me/notifications/$id/read'),
      headers: await _headers(),
    );
  }

  static Future<void> markAllNotificationsRead() async {
    await _client.put(
      Uri.parse('$kApiBase/users/me/notifications/mark-all-read'),
      headers: await _headers(),
    );
  }

  static Future<void> deleteNotification(String id) async {
    final res = await _client.delete(
      Uri.parse('$kApiBase/users/me/notifications/$id'),
      headers: await _headers(),
    );
    _decode(res);
  }

  // ── Payments ──────────────────────────────────────────────────────────

  /// Create a cash deposit transaction (admin approval required).
  /// This does not trigger a mobile money payment; it just records the
  /// request so the admin dashboard can list and approve it.
  static Future<Map<String, dynamic>> requestCashDeposit({
    required int amount,
  }) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/transactions/deposit'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount, 'provider': 'CASH'}),
    );
    return _decode(res);
  }

  /// Initiate a deposit (creates a transaction + triggers CamPay payment)
  static Future<Map<String, dynamic>> initiateDeposit({
    required int amount,
    required String provider, // 'ORANGE_MONEY' or 'MTN_MOMO'
    required String phone,
  }) async {
    // 1. Create a DEPOSIT transaction
    final txRes = await _client.post(
      Uri.parse('$kApiBase/users/me/transactions/deposit'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount, 'provider': provider}),
    );
    final txData = _decode(txRes);
    final transactionId = txData['transactionId'] as String;

    // 2. Initiate payment via CamPay
    final payRes = await _client.post(
      Uri.parse('$kApiBase/payments/initiate'),
      headers: await _headers(),
      body: jsonEncode({
        'transactionId': transactionId,
        'provider': provider,
        'phone': phone,
      }),
    );
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
    final res = await _client.post(
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

  static String _normalizeIdentifier(String identifier) {
    final raw = identifier.trim();
    if (raw.contains('@')) return raw;
    // Leave UUID-style user IDs untouched
    if (RegExp(
            r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
        .hasMatch(raw)) {
      return raw;
    }
    final digitsOnly = raw.replaceAll(RegExp(r'[\s\-]'), '');
    if (RegExp(r'^\+?\d+$').hasMatch(digitsOnly)) {
      return normalizePhone(digitsOnly);
    }
    return raw;
  }

  /// Initiate a wallet-to-wallet transfer to another Watsim user.
  static Future<Map<String, dynamic>> initiateTransfer({
    required int amount,
    required String recipientIdentifier, // phone, email or user id
    String? note,
  }) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/wallet/transfer'),
      headers: await _headers(),
      body: jsonEncode({
        'amount': amount,
        'recipientIdentifier': _normalizeIdentifier(recipientIdentifier),
        if (note != null && note.isNotEmpty) 'note': note,
      }),
    );
    return _decode(res);
  }

  /// Poll the status of any user transaction.
  static Future<Map<String, dynamic>> getTransactionStatus(
      String transactionId) async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/transactions/$transactionId/status'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Poll payment status
  static Future<Map<String, dynamic>> getPaymentStatus(
      String transactionId) async {
    final res = await _client.get(
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
    final res = await _client.post(
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
    final res = await _client.post(
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
    final res = await _client.post(
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

  /// Withdraw all contributed BNPL funds for a purchase back to the wallet.
  static Future<Map<String, dynamic>> withdrawContribution(
      {required String purchaseId}) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/bnpl/purchases/$purchaseId/withdraw'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Transfer all contributed BNPL funds for a purchase to another Watsim user.
  static Future<Map<String, dynamic>> transferContribution({
    required String purchaseId,
    required String recipientIdentifier,
  }) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/bnpl/purchases/$purchaseId/transfer'),
      headers: await _headers(),
      body: jsonEncode({
        'recipientIdentifier': _normalizeIdentifier(recipientIdentifier),
      }),
    );
    return _decode(res);
  }

  // ── PIN management ────────────────────────────────────────────────────

  /// Set or change PIN after login (requires JWT token in storage)
  static Future<Map<String, dynamic>> setPin(String pin) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/auth/set-pin'),
      headers: await _headers(),
      body: jsonEncode({'pin': pin}),
    );
    return _decode(res);
  }

  /// Verify PIN for transaction confirmation (transfers/withdrawals).
  /// Returns false only when the server explicitly rejects the PIN.
  /// Network/server failures throw so callers can show a real error
  /// instead of misleading the user with "incorrect PIN".
  static Future<bool> verifyTransactionPin(String pin) async {
    try {
      final res = await _client.post(
        Uri.parse('$kApiBase/users/me/verify-pin'),
        headers: await _headers(),
        body: jsonEncode({'pin': pin}),
      );
      if (res.statusCode < 400) {
        final body = _decode(res);
        // /users/me/verify-pin returns {verified: true}.
        return body['verified'] == true || body['success'] == true || body['status'] == 'success';
      }
      if (res.statusCode == 400 || res.statusCode == 401 || res.statusCode == 403) {
        return false;
      }
      throw ApiException(res.statusCode, _fallbackMessage(res.statusCode));
    } on ApiException {
      rethrow;
    } on SocketException {
      throw const ApiException(
          0, 'Problème de connexion. Vérifiez votre réseau.');
    } on TimeoutException {
      throw const ApiException(
          0, 'Le serveur met trop de temps à répondre. Veuillez réessayer.');
    }
  }

  /// Change PIN with current PIN verification
  static Future<Map<String, dynamic>> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/auth/change-pin'),
      headers: await _headers(),
      body: jsonEncode({
        'currentPin': currentPin,
        'newPin': newPin,
      }),
    );
    return _decode(res);
  }

  // ── Messaging ─────────────────────────────────────────────────────────

  static Future<List<dynamic>> fetchConversations() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/messages/conversations'),
      headers: await _headers(),
    );
    if (res.statusCode == 401) {
      await AuthService.clear();
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    if (res.statusCode >= 400) return [];
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['conversations'] is List) {
        return body['conversations'] as List;
      }
      if (body is List) return body;
    } catch (_) {}
    return [];
  }

  static Future<String> getOrCreateSupportConversation() async {
    final res = await _client.get(
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
    final res = await _client.get(uri, headers: await _headers());
    if (res.statusCode == 401) {
      await AuthService.clear();
      throw const ApiException(
          401, 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    if (res.statusCode >= 400) return [];
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['messages'] is List) {
        return body['messages'] as List;
      }
    } catch (_) {}
    return [];
  }

  static Future<Map<String, dynamic>> sendChatMessage(
      String convId, String text) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/messages/conversations/$convId/messages'),
      headers: await _headers(),
      body: jsonEncode({'text': text}),
    );
    return _decode(res);
  }

  static Future<void> markConversationRead(String convId) async {
    try {
      await _client.post(
        Uri.parse('$kApiBase/messages/conversations/$convId/read'),
        headers: await _headers(),
        body: jsonEncode({}),
      );
    } catch (_) {}
  }

  /// Mark messages in a conversation as DELIVERED
  static Future<void> markMessagesDelivered(String convId) async {
    try {
      await _client.post(
        Uri.parse('$kApiBase/messages/conversations/$convId/delivered'),
        headers: await _headers(),
        body: jsonEncode({}),
      );
    } catch (_) {}
  }

  /// Mark specific messages as READ by their IDs
  static Future<void> markMessagesReadByIds(
      String convId, List<String> messageIds) async {
    try {
      await _client.post(
        Uri.parse('$kApiBase/messages/conversations/$convId/read-messages'),
        headers: await _headers(),
        body: jsonEncode({'messageIds': messageIds}),
      );
    } catch (_) {}
  }

  static Future<String> createOrGetConversation(
      List<String> participantIds) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/messages/conversations'),
      headers: await _headers(),
      body: jsonEncode({'participantIds': participantIds}),
    );
    final body = _decode(res);
    return body['conversationId'] as String;
  }

  /// Create a 1:1 conversation by the other user's phone number.
  static Future<String> createOrGetConversationByPhone(String phone) async {
    final res = await _client.post(
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
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/statistics'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> fetchProfile() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> updateProfile({
    String? fullName,
    String? phone,
  }) async {
    final res = await _client.put(
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
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/credit-score'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Get credit score history
  static Future<List<dynamic>> getCreditScoreHistory({int limit = 10}) async {
    final uri = Uri.parse('$kApiBase/users/me/credit-score/history')
        .replace(queryParameters: {'limit': limit.toString()});
    final res = await _client.get(uri, headers: await _headers());
    return _decodeList(res);
  }

  /// Get credit score improvement tips
  static Future<List<String>> getCreditScoreTips() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/credit-score/tips'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<String>.from(data['tips'] ?? []);
  }

  /// Fetch active publicity/ads for mobile app
  static Future<List<Map<String, dynamic>>> fetchPublicities() async {
    final res = await _client.get(
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
    final res = await _client.get(
      Uri.parse('$kApiBase/bnpl/purchases/$purchaseId'),
      headers: await _headers(),
    );
    return _decode(res);
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
      await fetchProfile();
      return true;
    } on ApiException catch (e) {
      if (e.statusCode == 401) return false;
      // Server error / empty body – trust local JWT expiry instead of kicking user out
      return await _isTokenLocallyValid();
    } on TimeoutException catch (_) {
      return await _isTokenLocallyValid();
    } catch (e) {
      apiLog('validateToken error: $e');
      return await _isTokenLocallyValid();
    }
  }

  // ─── Referrals ─────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchReferralStats() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/referral'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<Map<String, dynamic>> updateReferralCode(String code) async {
    final res = await _client.patch(
      Uri.parse('$kApiBase/users/me/referral'),
      headers: await _headers(),
      body: jsonEncode({'code': code.trim().toUpperCase()}),
    );
    return _decode(res);
  }

  // ─── Rewards & Cashback ──────────────────────────────────────────────────

  /// Fetches user's rewards summary including available balance, pending balance, and history.
  static Future<Map<String, dynamic>> fetchRewardsSummary() async {
    final res = await _client.get(
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
    final res = await _client.post(
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
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/rewards/convert'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount}),
    );
    return _decode(res);
  }

  /// Fetches user's badges/achievements with earned status.
  static Future<Map<String, dynamic>> fetchBadges() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/badges'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Checks and awards new badges based on user activity.
  static Future<Map<String, dynamic>> checkAndAwardBadges() async {
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/badges/check'),
      headers: await _headers(),
      body: jsonEncode({}),
    );
    return _decode(res);
  }

  // ─── Wallet Transfers ────────────────────────────────────────────────────

  /// Transfers money from user's wallet to another user.
  /// Alias for [initiateTransfer] (kept for call-site compatibility).
  static Future<Map<String, dynamic>> transferMoney({
    required String recipientIdentifier,
    required int amount,
    String? note,
  }) =>
      initiateTransfer(
        amount: amount,
        recipientIdentifier: recipientIdentifier,
        note: note,
      );

  /// Fetches user's transfer history.
  static Future<Map<String, dynamic>> fetchTransferHistory(
      {int limit = 20}) async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/wallet/transfers?limit=$limit'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  /// Searches for a user by phone, email, or userId for transfers.
  static Future<Map<String, dynamic>?> searchUser(String identifier) async {
    final res = await _client.get(
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
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/security'),
      headers: await _headers(),
    );
    final data = _decode(res);
    final settings = data['settings'];
    if (settings is Map<dynamic, dynamic>) {
      return Map<String, dynamic>.from(settings);
    }
    return {};
  }

  /// Update user security settings
  static Future<Map<String, dynamic>> updateSecuritySettings({
    bool? fingerprintEnabled,
    bool? faceIdEnabled,
    bool? irisEnabled,
    bool? loginAlertsEnabled,
    bool? transactionAlertsEnabled,
  }) async {
    final body = <String, dynamic>{};
    if (fingerprintEnabled != null)
      body['fingerprintEnabled'] = fingerprintEnabled;
    if (faceIdEnabled != null) body['faceIdEnabled'] = faceIdEnabled;
    if (irisEnabled != null) body['irisEnabled'] = irisEnabled;
    if (loginAlertsEnabled != null)
      body['loginAlertsEnabled'] = loginAlertsEnabled;
    if (transactionAlertsEnabled != null)
      body['transactionAlertsEnabled'] = transactionAlertsEnabled;

    final res = await _client.put(
      Uri.parse('$kApiBase/users/me/security'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    final data = _decode(res);
    final settings = data['settings'];
    if (settings is Map<dynamic, dynamic>) {
      return Map<String, dynamic>.from(settings);
    }
    return {};
  }

  /// Freeze user account
  static Future<Map<String, dynamic>> freezeAccount({String? reason}) async {
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/security/freeze'),
      headers: await _headers(),
      body: jsonEncode({'reason': reason}),
    );
    return _decode(res);
  }

  /// Unfreeze user account
  static Future<Map<String, dynamic>> unfreezeAccount() async {
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/security/unfreeze'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  // ─── Support Tickets ───────────────────────────────────────────────────────

  /// Get FAQ data
  static Future<List<Map<String, dynamic>>> getFAQ() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/support/faq'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<Map<String, dynamic>>.from(data['faqs'] ?? []);
  }

  /// Get all user support tickets
  static Future<List<Map<String, dynamic>>> getSupportTickets() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/users/me/support/tickets'),
      headers: await _headers(),
    );
    final data = _decode(res);
    return List<Map<String, dynamic>>.from(data['tickets'] ?? []);
  }

  /// Get specific support ticket
  static Future<Map<String, dynamic>?> getSupportTicket(String ticketId) async {
    final res = await _client.get(
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

    final res = await _client.post(
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
    final res = await _client.post(
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
    final res = await _client.post(
      Uri.parse('$kApiBase/users/me/support/tickets/$ticketId/close'),
      headers: await _headers(),
    );
    return res.statusCode < 400;
  }

  // ── Delivery ────────────────────────────────────────────────────────────

  /// Submit a delivery request for a BNPL purchase
  static Future<Map<String, dynamic>> submitDeliveryRequest({
    required String purchaseId,
    required String lastName,
    required String firstName,
    required String phone,
    required String residence,
    required String deliveryLocation,
    String? color,
    String? shoeSize,
    required String profession,
    required String cni,
    String? idFrontPhoto,
    String? idBackPhoto,
    String? deliveryTime,
  }) async {
    final body = <String, dynamic>{
      'purchaseId': purchaseId,
      'lastName': lastName,
      'firstName': firstName,
      'phone': phone,
      'residence': residence,
      'deliveryLocation': deliveryLocation,
      'profession': profession,
      'cni': cni,
    };
    if (color != null && color.isNotEmpty) body['color'] = color;
    if (shoeSize != null && shoeSize.isNotEmpty) body['shoeSize'] = shoeSize;
    if (idFrontPhoto != null) body['idFrontPhoto'] = idFrontPhoto;
    if (idBackPhoto != null) body['idBackPhoto'] = idBackPhoto;
    if (deliveryTime != null) body['deliveryTime'] = deliveryTime;

    final res = await _client.post(
      Uri.parse('$kApiBase/delivery'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  /// Get user's delivery requests
  static Future<List<dynamic>> getDeliveryRequests() async {
    final res = await _client.get(
      Uri.parse('$kApiBase/delivery'),
      headers: await _headers(),
    );
    return _decodeList(res);
  }
}
