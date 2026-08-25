import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/app_lock_manager.dart';
import '../services/language_service.dart';
import '../theme/app_theme.dart';
import 'splash_screen.dart';

class AppLockScreen extends StatefulWidget {
  const AppLockScreen({super.key});

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> {
  final _pinCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _unlock() async {
    final pin = _pinCtrl.text.trim();
    if (pin.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = await AuthService.getUser();
      final phone = user?['phone']?.toString();
      if (phone == null || phone.isEmpty) {
        throw ApiException(
            0,
            LanguageService().isFrench
                ? 'Session expirée. Veuillez vous reconnecter.'
                : 'Session expired. Please log in again.');
      }

      final result = await ApiService.loginWithPin(phone: phone, pin: pin);
      if (result['requires2FA'] == true) {
        setState(() => _error = LanguageService().isFrench
            ? 'L\'authentification à deux facteurs est requise.'
            : 'Two-factor authentication is required.');
        return;
      }

      await AppLockManager().unlock();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = LanguageService().isFrench
          ? 'Une erreur est survenue. Réessayez.'
          : 'An error occurred. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await AuthService.clear();
    await AppLockManager().unlock();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const SplashScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.lock_outline_rounded,
                size: 64,
                color: AppColors.primaryGreen,
              ),
              const SizedBox(height: 24),
              Text(
                lang.isFrench
                    ? 'Application verrouillée'
                    : 'Application Locked',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                lang.isFrench
                    ? 'Entrez votre code PIN pour continuer'
                    : 'Enter your PIN to continue',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  letterSpacing: 8,
                ),
                decoration: InputDecoration(
                  hintText: '• • • • • •',
                  hintStyle:
                      TextStyle(color: AppColors.textMuted, fontSize: 24),
                  filled: true,
                  fillColor: AppColors.deepTeal,
                  counterText: '',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (_) => _unlock(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.error, fontSize: 13),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _loading ? null : _unlock,
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(lang.isFrench ? 'Déverrouiller' : 'Unlock'),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: _loading ? null : _logout,
                child: Text(lang.signOut,
                    style: const TextStyle(color: AppColors.textMuted)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
