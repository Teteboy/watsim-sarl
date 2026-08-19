import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Manages app lock state. Locks the app after it has been in the background
/// for longer than [lockTimeout].
class AppLockManager extends ChangeNotifier {
  static const _lastActiveKey = 'watsim_last_active_at';
  static const _isLockedKey = 'watsim_app_locked';

  static final AppLockManager _instance = AppLockManager._internal();
  factory AppLockManager() => _instance;
  AppLockManager._internal();

  Duration lockTimeout = const Duration(minutes: 5);
  bool _isLocked = false;

  bool get isLocked => _isLocked;

  /// Call whenever the app resumes to check if it should lock.
  Future<bool> shouldLock() async {
    final prefs = await SharedPreferences.getInstance();
    final lastActive = prefs.getInt(_lastActiveKey);
    if (lastActive == null) return false;

    final inactiveDuration = DateTime.now()
        .difference(DateTime.fromMillisecondsSinceEpoch(lastActive));
    return inactiveDuration >= lockTimeout;
  }

  /// Locks the app immediately.
  Future<void> lock() async {
    _isLocked = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isLockedKey, true);
    notifyListeners();
  }

  /// Unlocks the app and updates last active time.
  Future<void> unlock() async {
    _isLocked = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isLockedKey, false);
    await updateLastActive();
    notifyListeners();
  }

  /// Records that the app was active (called on pause/resume/unlock).
  Future<void> updateLastActive() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lastActiveKey, DateTime.now().millisecondsSinceEpoch);
  }

  /// Initialize state from storage.
  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _isLocked = prefs.getBool(_isLockedKey) ?? false;
  }
}
