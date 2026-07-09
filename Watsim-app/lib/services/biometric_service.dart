import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service for handling biometric authentication (fingerprint, face ID)
class BiometricService {
  static final LocalAuthentication _localAuth = LocalAuthentication();

  // Keys for storing biometric preferences
  static const String _biometricEnabledKey = 'biometric_enabled';
  static const String _biometricTypeKey = 'biometric_type';

  /// Check if the device supports biometrics
  static Future<bool> isDeviceSupported() async {
    return await _localAuth.isDeviceSupported();
  }

  /// Check if biometrics are available on this device
  static Future<bool> canCheckBiometrics() async {
    return await _localAuth.canCheckBiometrics;
  }

  /// Get available biometric types on this device
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    return await _localAuth.getAvailableBiometrics();
  }

  /// Check if fingerprint is available
  static Future<bool> isFingerprintAvailable() async {
    final available = await getAvailableBiometrics();
    return available.contains(BiometricType.fingerprint) ||
        available.contains(BiometricType.strong);
  }

  /// Check if face ID/face recognition is available
  static Future<bool> isFaceIdAvailable() async {
    final available = await getAvailableBiometrics();
    return available.contains(BiometricType.face) ||
        available.contains(BiometricType.weak);
  }

  /// Get the primary biometric type name for display
  static Future<String?> getPrimaryBiometricType() async {
    final available = await getAvailableBiometrics();
    if (available.contains(BiometricType.fingerprint) ||
        available.contains(BiometricType.strong)) {
      return 'Fingerprint';
    }
    if (available.contains(BiometricType.face) ||
        available.contains(BiometricType.weak)) {
      return 'Face ID';
    }
    return null;
  }

  /// Authenticate using biometrics
  /// Returns true if authenticated, false otherwise
  static Future<bool> authenticate({
    String localizedReason = 'Please authenticate to continue',
    bool useErrorDialogs = true,
    bool stickyAuth = false,
    bool sensitiveTransaction = true,
  }) async {
    try {
      final bool didAuthenticate = await _localAuth.authenticate(
        localizedReason: localizedReason,
        options: AuthenticationOptions(
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
          sensitiveTransaction: sensitiveTransaction,
          biometricOnly: true,
        ),
      );
      return didAuthenticate;
    } catch (e) {
      print('Biometric authentication error: $e');
      return false;
    }
  }

  /// Stop authentication (useful when user cancels)
  static Future<bool> stopAuthentication() async {
    return await _localAuth.stopAuthentication();
  }

  // ── Preference Storage ───────────────────────────────────────────────────

  /// Check if biometric login is enabled by the user
  static Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_biometricEnabledKey) ?? false;
  }

  /// Enable/disable biometric login
  static Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_biometricEnabledKey, enabled);
  }

  /// Get the stored biometric type preference
  static Future<String?> getStoredBiometricType() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_biometricTypeKey);
  }

  /// Store the biometric type preference
  static Future<void> setBiometricType(String type) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_biometricTypeKey, type);
  }

  /// Clear all biometric preferences
  static Future<void> clearPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_biometricEnabledKey);
    await prefs.remove(_biometricTypeKey);
  }

  /// Complete setup for biometric authentication
  /// This should be called after successful PIN login when user enables biometrics
  static Future<bool> setupBiometric(String biometricType) async {
    // First verify the user can authenticate with biometrics
    final canAuth = await authenticate(
      localizedReason: 'Verify your $biometricType to enable biometric login',
    );

    if (canAuth) {
      await setBiometricEnabled(true);
      await setBiometricType(biometricType);
      return true;
    }
    return false;
  }

  /// Attempt biometric login
  /// Returns true if enabled and authenticated successfully
  static Future<BiometricLoginResult> attemptBiometricLogin() async {
    // Check if biometrics are enabled
    final enabled = await isBiometricEnabled();
    if (!enabled) {
      return BiometricLoginResult.notEnabled;
    }

    // Check if device supports biometrics
    final canCheck = await canCheckBiometrics();
    final isSupported = await isDeviceSupported();
    if (!canCheck || !isSupported) {
      return BiometricLoginResult.notAvailable;
    }

    // Attempt authentication
    final authenticated = await authenticate(
      localizedReason: 'Authenticate to access your account',
    );

    return authenticated
        ? BiometricLoginResult.success
        : BiometricLoginResult.failed;
  }
}

enum BiometricLoginResult {
  success,
  failed,
  notEnabled,
  notAvailable,
}
