import 'package:flutter/foundation.dart';
import 'services/api_service.dart';
// AuthService is defined in api_service.dart

/// ProfileState - Singleton for managing profile data across all screens
/// Ensures profile picture and user info stay synchronized throughout the app
class ProfileState extends ChangeNotifier {
  static final ProfileState _instance = ProfileState._internal();
  static ProfileState get instance => _instance;
  ProfileState._internal();

  Map<String, dynamic>? _user;
  bool _isLoading = false;

  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;

  String? get imageUrl => _user?['imageUrl']?.toString();
  String? get fullName => _user?['fullName']?.toString();
  String? get phone => _user?['phone']?.toString();
  String? get email => _user?['email']?.toString();

  /// Initialize from cached data
  Future<void> init() async {
    final cached = await AuthService.getUser();
    if (cached != null) {
      _user = cached;
      notifyListeners();
    }
  }

  /// Sync profile data with backend
  Future<void> syncWithBackend() async {
    if (_isLoading) return;

    _isLoading = true;
    notifyListeners();

    try {
      final profile = await ApiService.fetchProfile();
      _user = profile;
      await AuthService.saveUser(profile);
      notifyListeners();
    } catch (e) {
      debugPrint('ProfileState sync error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update profile picture and notify all listeners
  void updateProfileImage(String imageUrl) {
    if (_user != null) {
      _user = {..._user!, 'imageUrl': imageUrl};
      notifyListeners();
    }
  }

  /// Update user data and notify listeners
  void updateUser(Map<String, dynamic> userData) {
    _user = {...?_user, ...userData};
    notifyListeners();
  }

  /// Clear all data (on logout)
  void clear() {
    _user = null;
    _isLoading = false;
    notifyListeners();
  }
}
