import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import 'otp_screen.dart';
import '../main.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../services/biometric_service.dart';
import '../profile_state.dart';

// ─── Splash Screen ────────────────────────────────────────────────────────
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;
  late Animation<double> _scale;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    // Initialize ProfileState from cached data
    ProfileState.instance.init();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2800));
    _fade = CurvedAnimation(
        parent: _ctrl, curve: const Interval(0.0, 0.4, curve: Curves.easeIn));
    _scale = Tween<double>(begin: 0.72, end: 1.0).animate(CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.5, curve: Curves.elasticOut)));
    _progress = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.2, 0.95, curve: Curves.easeInOut)));
    _ctrl.forward();
    Future.delayed(const Duration(milliseconds: 3200), () async {
      if (mounted) {
        // Check auth state and validate token before navigating
        debugPrint('🔍 SPLASH: Starting auth check...');
        final isLoggedIn = await AuthService.isLoggedIn();
        debugPrint('🔍 SPLASH: isLoggedIn = $isLoggedIn');
        if (isLoggedIn) {
          // Validate token is still valid with backend
          debugPrint('🔍 SPLASH: Validating token...');
          final isValid = await ApiService.validateToken();
          debugPrint('🔍 SPLASH: isValid = $isValid');
          if (isValid) {
            debugPrint('🔍 SPLASH: Navigating to MainShell');
            Navigator.pushReplacement(
                context, MaterialPageRoute(builder: (_) => const MainShell()));
          } else {
            // Token expired, clear and go to onboarding
            debugPrint(
                '🔍 SPLASH: Token invalid, clearing and going to Onboarding');
            await AuthService.clear();
            Navigator.pushReplacement(context,
                MaterialPageRoute(builder: (_) => const OnboardingScreen()));
          }
        } else {
          debugPrint('🔍 SPLASH: Not logged in, going to Onboarding');
          Navigator.pushReplacement(context,
              MaterialPageRoute(builder: (_) => const OnboardingScreen()));
        }
      }
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: FadeTransition(
                  opacity: _fade,
                  child: ScaleTransition(
                    scale: _scale,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Logo — white version for dark background - Full screen implementation
                        Image.asset(
                          'assets/images/logo_green.png',
                          width: MediaQuery.of(context).size.width * 0.6,
                          height: MediaQuery.of(context).size.height * 0.3,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Center(
                            child: Text('W',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 80,
                                    fontWeight: FontWeight.w900)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(40, 0, 40, 52),
              child: AnimatedBuilder(
                animation: _progress,
                builder: (_, __) => Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _progress.value,
                        backgroundColor: Colors.white.withOpacity(0.12),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            AppColors.primaryGreen),
                        minHeight: 4,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Builder(builder: (ctx) {
                      final lang = LanguageProvider.of(ctx);
                      return Column(
                        children: [
                          Text(lang.loadingUniverse,
                              style: TextStyle(
                                  color: Colors.white.withOpacity(0.38),
                                  fontSize:
                                      MediaQuery.of(context).size.width * 0.028,
                                  letterSpacing: 0.3)),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 18,
                                height: 18,
                                decoration: const BoxDecoration(
                                  color: AppColors.secondaryGreen,
                                  shape: BoxShape.circle,
                                ),
                                child: ClipOval(
                                  child: Image.asset('assets/cm_flag.png',
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => const Icon(
                                          Icons.flag,
                                          color: Colors.white,
                                          size: 12)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(lang.cameroun,
                                  style: TextStyle(
                                      color: Colors.white.withOpacity(0.45),
                                      fontSize:
                                          MediaQuery.of(context).size.width *
                                              0.028,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1.5)),
                            ],
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Onboarding Screen ────────────────────────────────────────────────────
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  List<_OnboardData> _buildPages(LanguageService lang) => [
        _OnboardData(
          image: 'assets/images/onboarding1.png',
          color: AppColors.primaryGreen,
        ),
        _OnboardData(
          image: 'assets/images/onboarding2.png',
          color: AppColors.secondaryGreen,
        ),
        _OnboardData(
          image: 'assets/images/onboarding3.png',
          color: AppColors.deepTeal,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final pages = _buildPages(lang);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: Stack(
        children: [
          // Full screen image — responsive across all devices
          Positioned.fill(
            child: PageView.builder(
              controller: _controller,
              itemCount: pages.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) {
                final p = pages[i];
                return LayoutBuilder(
                  builder: (context, constraints) {
                    return SizedBox.expand(
                      child: Image.asset(
                        p.image!,
                        fit: BoxFit.contain,
                        width: constraints.maxWidth,
                        height: constraints.maxHeight,
                        errorBuilder: (_, __, ___) => Container(
                          color: AppColors.primaryDark,
                          child: Center(
                            child: Icon(
                              Icons.image_not_supported,
                              size: MediaQuery.of(context).size.width * 0.15,
                              color: Colors.white.withOpacity(0.3),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          // Bottom overlay for buttons
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    AppColors.primaryDark.withOpacity(0.3),
                    AppColors.primaryDark,
                  ],
                  stops: const [0.0, 0.4, 1.0],
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 40, 24, 28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Page indicators
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          pages.length,
                          (i) => AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: _page == i ? 28 : 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: _page == i
                                  ? AppColors.primaryGreen
                                  : Colors.white.withOpacity(0.5),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 36),
                      ElevatedButton(
                        onPressed: () {
                          if (_page < pages.length - 1) {
                            _controller.nextPage(
                                duration: const Duration(milliseconds: 350),
                                curve: Curves.easeInOut);
                          } else {
                            Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const RegisterScreen()));
                          }
                        },
                        child: Text(_page < pages.length - 1
                            ? lang.next
                            : lang.createMyAccount),
                      ),
                      const SizedBox(height: 14),
                      TextButton(
                        onPressed: () => Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const LoginScreen())),
                        child: Text(lang.iAlreadyHaveAccount,
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 14)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardData {
  final String? image;
  final IconData? icon;
  final Color color;
  const _OnboardData({this.image, this.icon, required this.color});
}

// ─── Register Screen ──────────────────────────────────────────────────────
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  bool _agreed = false;
  bool _loading = false;

  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _referralCtrl = TextEditingController();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _referralCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phoneRaw = _phoneCtrl.text.trim();
    debugPrint('🔍 SUBMIT: phoneRaw = "$phoneRaw"');
    debugPrint('🔍 SUBMIT: _agreed = $_agreed, _loading = $_loading');

    if (phoneRaw.isEmpty) {
      debugPrint('🔍 SUBMIT: Phone empty, returning');
      return;
    }
    if (!_agreed || _loading) {
      debugPrint('🔍 SUBMIT: Not agreed or loading, returning');
      return;
    }

    final phone = ApiService.normalizePhone(phoneRaw);
    debugPrint('🔍 SUBMIT: normalized phone = $phone');

    final referralCode = _referralCtrl.text.trim();
    setState(() => _loading = true);
    try {
      debugPrint('🔍 SUBMIT: Calling registerPhone...');
      // POST /auth/register { phone, referralCode? }
      await ApiService.registerPhone(
          phone: phone,
          referralCode: referralCode.isNotEmpty ? referralCode : null);
      debugPrint('🔍 SUBMIT: registerPhone succeeded, navigating to OTP');
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OtpScreen(phone: phone),
        ),
      );
    } on ApiException catch (e) {
      debugPrint('🔍 SUBMIT: ApiException - ${e.message}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      debugPrint('🔍 SUBMIT: Error - $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(LanguageService().isFrench
              ? 'Inscription échouée : $e'
              : 'Registration failed: $e'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top bar: back arrow left, WATSIM centered
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Center(
                      child: Image(
                        image: AssetImage('assets/images/logo_green.png'),
                        width: 64,
                        height: 64,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
              const SizedBox(height: 12),
              Text(lang.createMyAccountTitle,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(lang.fillInYourInfo,
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.6), fontSize: 15)),
              const SizedBox(height: 28),
              // Form Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label(lang.phoneNumberLabel),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        hintText: '6XX XXX XXX',
                        prefixText: '+237  ',
                        prefixStyle: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _label(lang.isFrench
                            ? 'Code de parrainage'
                            : 'Referral Code'),
                        const Spacer(),
                        Text(lang.optional,
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textMuted)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _referralCtrl,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        hintText:
                            lang.isFrench ? 'Ex: WATSIM-123' : 'Ex: WATSIM-123',
                        prefixIcon: const Icon(Icons.card_giftcard_rounded,
                            color: AppColors.primaryGreen, size: 20),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Terms
                    GestureDetector(
                      onTap: () => setState(() => _agreed = !_agreed),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Checkbox(
                            value: _agreed,
                            onChanged: (v) =>
                                setState(() => _agreed = v ?? false),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: RichText(
                                text: TextSpan(
                                  style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.textSecondary),
                                  children: [
                                    TextSpan(text: lang.acceptTerms),
                                    TextSpan(
                                        text: lang.generalTerms,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.primaryGreen)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _loading
                          ? null
                          : () {
                              if (!_agreed) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(lang.isFrench
                                        ? 'Veuillez accepter les conditions générales'
                                        : 'Please accept the terms and conditions'),
                                    backgroundColor: AppColors.warning,
                                    behavior: SnackBarBehavior.floating,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                                return;
                              }
                              _submit();
                            },
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(lang.continueLabel),
                                const SizedBox(width: 8),
                                const Icon(Icons.arrow_forward_rounded,
                                    size: 18),
                              ],
                            ),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: GestureDetector(
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const LoginScreen())),
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.textSecondary),
                            children: [
                              TextSpan(text: lang.alreadyHaveAccount),
                              TextSpan(
                                  text: lang.signIn,
                                  style: const TextStyle(
                                      color: AppColors.primaryGreen,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1));
}

// ─── Login Screen ─────────────────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;
  bool _pinVisible = false;
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  String? _storedPhone;

  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _pinCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _checkBiometricStatus();
  }

  Future<void> _checkBiometricStatus() async {
    final enabled = await BiometricService.isBiometricEnabled();
    final available = await BiometricService.canCheckBiometrics();
    final deviceSupported = await BiometricService.isDeviceSupported();

    setState(() {
      _biometricEnabled = enabled && available && deviceSupported;
      _biometricAvailable = available && deviceSupported;
    });
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  void _login({bool skipPinValidation = false}) async {
    if (_loading) return;

    final phoneRaw = _phoneCtrl.text.trim();
    final pin = skipPinValidation ? _pinCtrl.text.trim() : _pinCtrl.text.trim();
    if (phoneRaw.isEmpty || (pin.isEmpty && !skipPinValidation)) return;

    final phone = ApiService.normalizePhone(phoneRaw);

    setState(() => _loading = true);
    try {
      final result = await ApiService.loginWithPin(phone: phone, pin: pin);

      // Check if 2FA is required
      if (result['requires2FA'] == true) {
        if (!mounted) return;
        setState(() => _loading = false);
        _show2FADialog(phone, pin);
        return;
      }

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const MainShell()),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      // ApiException already includes the backend message/raw body (see ApiService._decode)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
      );
    } catch (e) {
      if (!mounted) return;
      // Show the actual error when available (connectivity, JSON parse, etc.)
      final msg = e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg.isNotEmpty
              ? msg
              : (LanguageService().isFrench
                  ? 'Connexion échouée.'
                  : 'Login failed.')),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _show2FADialog(String phone, String pin) {
    final otpController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: Text(LanguageService().isFrench
            ? 'Authentification à deux facteurs'
            : 'Two-Factor Authentication'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(LanguageService().isFrench
                ? 'Entrez le code à 6 chiffres envoyé sur votre téléphone :'
                : 'Enter the 6-digit code sent to your phone:'),
            const SizedBox(height: 16),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                hintText: '000000',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(LanguageService().isFrench ? 'Annuler' : 'Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final otp = otpController.text.trim();
              if (otp.length != 6) return;

              Navigator.pop(dialogContext);
              setState(() => _loading = true);

              try {
                final result = await ApiService.verify2FALogin(
                    phone: phone, pin: pin, otp: otp);
                if (!mounted) return;

                // Check if login was successful (has tokens)
                if (result['accessToken'] != null) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const MainShell()),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(LanguageService().isFrench
                          ? 'Connexion échouée. Veuillez réessayer.'
                          : 'Login failed. Please try again.'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              } on ApiException catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text(e.message),
                      backgroundColor: AppColors.error),
                );
              } catch (_) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(LanguageService().isFrench
                        ? 'Vérification échouée. Veuillez réessayer.'
                        : 'Verification failed. Please try again.'),
                    backgroundColor: AppColors.error,
                  ),
                );
              } finally {
                if (mounted) setState(() => _loading = false);
              }
            },
            child: Text(LanguageService().isFrench ? 'Vérifier' : 'Verify'),
          ),
        ],
      ),
    );
  }

  void _showBiometricScan() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _FingerprintScanSheet(),
    ).then((authenticated) async {
      if (authenticated == true && mounted) {
        // Biometric auth successful - check if we have stored credentials
        final user = await AuthService.getUser();
        if (user != null && user['phone'] != null) {
          _phoneCtrl.text = user['phone'] as String;
          // Show snackbar to prompt for PIN
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LanguageService().isFrench
                  ? 'Biométrie vérifiée. Veuillez entrer votre code PIN.'
                  : 'Biometric verified. Please enter your PIN.'),
              backgroundColor: AppColors.primaryGreen,
            ),
          );
          // Focus on PIN field
          FocusScope.of(context).requestFocus(FocusNode());
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            children: [
              // Top bar with back arrow and WATSIM centered
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Center(
                      child: Image(
                        image: AssetImage('assets/images/logo_green.png'),
                        width: 64,
                        height: 64,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
              const SizedBox(height: 16),
              const SizedBox(height: 40),
              // Login card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lang.welcomeBack,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(lang.signInToAccount,
                        style: TextStyle(
                            color: Colors.white.withOpacity(0.55),
                            fontSize: 14)),
                    const SizedBox(height: 24),
                    // Phone field
                    Text(lang.phoneNumberField,
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white54,
                            letterSpacing: 1)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        hintText: '6XX XXX XXX',
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        prefixText: '+237  ',
                        prefixStyle: const TextStyle(
                            color: AppColors.primaryGreen,
                            fontWeight: FontWeight.w700,
                            fontSize: 15),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(
                                color: AppColors.primaryGreen, width: 1.5)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(lang.pinCode,
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white54,
                            letterSpacing: 1)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _pinCtrl,
                      obscureText: !_pinVisible,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(
                          color: AppColors.textPrimary, fontSize: 20),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        hintText: '••••',
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        prefixIcon: const Icon(Icons.lock_outline_rounded,
                            color: AppColors.textMuted),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _pinVisible
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: AppColors.textMuted,
                          ),
                          onPressed: () =>
                              setState(() => _pinVisible = !_pinVisible),
                        ),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(
                                color: AppColors.primaryGreen, width: 1.5)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 16),
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const ForgotPinScreen()),
                        ),
                        child: Text(lang.forgotPin,
                            style: const TextStyle(
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ElevatedButton(
                      onPressed: _loading ? null : _login,
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : Text(lang.signInButton),
                    ),
                    const SizedBox(height: 20),
                    // Biometrics - only show if enabled and available
                    if (_biometricEnabled)
                      Column(
                        children: [
                          const DividerWithText(text: 'OR'),
                          const SizedBox(height: 20),
                          Center(
                            child: GestureDetector(
                              onTap: _showBiometricScan,
                              child: Column(
                                children: [
                                  Container(
                                    width: 64,
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryGreen
                                          .withOpacity(0.12),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: AppColors.primaryGreen
                                              .withOpacity(0.35),
                                          width: 1.5),
                                    ),
                                    child: const Icon(Icons.fingerprint_rounded,
                                        color: AppColors.primaryGreen,
                                        size: 34),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(lang.useBiometrics,
                                      style: TextStyle(
                                          color: Colors.white.withOpacity(0.7),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const RegisterScreen())),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 14, color: Colors.white54),
                    children: [
                      TextSpan(text: lang.noAccountYet),
                      TextSpan(
                          text: lang.register,
                          style: const TextStyle(
                              color: AppColors.primaryGreen,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset(
                    'assets/images/logo_green.png',
                    width: 12,
                    height: 12,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: 6),
                  Text(lang.securedByWatsim,
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.25),
                          fontSize: 10,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Fingerprint Scan Bottom Sheet ───────────────────────────────────────
enum _ScanState { waiting, scanning, success, failed }

class _FingerprintScanSheet extends StatefulWidget {
  const _FingerprintScanSheet();
  @override
  State<_FingerprintScanSheet> createState() => _FingerprintScanSheetState();
}

class _FingerprintScanSheetState extends State<_FingerprintScanSheet>
    with TickerProviderStateMixin {
  _ScanState _state = _ScanState.waiting;

  // Pulse ring animation
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseScale;
  late Animation<double> _pulseOpacity;

  // Scan line sweep animation
  late AnimationController _scanCtrl;
  late Animation<double> _scanLine;

  // Icon pop animation (success/fail)
  late AnimationController _popCtrl;
  late Animation<double> _popScale;

  @override
  void initState() {
    super.initState();

    // Idle pulse
    _pulseCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
    _pulseScale = Tween<double>(begin: 1.0, end: 1.55)
        .animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut));
    _pulseOpacity = Tween<double>(begin: 0.45, end: 0.0)
        .animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut));

    // Scan sweep
    _scanCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1600));
    _scanLine = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _scanCtrl, curve: Curves.easeInOut));

    // Pop
    _popCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 450));
    _popScale = Tween<double>(begin: 0.5, end: 1.0)
        .animate(CurvedAnimation(parent: _popCtrl, curve: Curves.elasticOut));
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _scanCtrl.dispose();
    _popCtrl.dispose();
    super.dispose();
  }

  Future<void> _startScan() async {
    if (_state == _ScanState.scanning) return;
    setState(() => _state = _ScanState.scanning);
    _pulseCtrl.stop();
    _scanCtrl.forward(from: 0.0);

    // Perform actual biometric authentication
    final authenticated = await BiometricService.authenticate(
      localizedReason: 'Authenticate to access your WATSIM account',
    );

    if (!mounted) return;

    if (authenticated) {
      setState(() => _state = _ScanState.success);
      _popCtrl.forward(from: 0.0);
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      Navigator.pop(context, true);
    } else {
      setState(() => _state = _ScanState.failed);
      _popCtrl.forward(from: 0.0);
      await Future.delayed(const Duration(milliseconds: 1200));
      if (!mounted) return;
      // Reset to try again
      setState(() => _state = _ScanState.waiting);
      _scanCtrl.reset();
      _pulseCtrl.repeat();
    }
  }

  Color get _ringColor {
    switch (_state) {
      case _ScanState.success:
        return const Color(0xFF4DB049);
      case _ScanState.failed:
        return const Color(0xFFE53935);
      default:
        return const Color(0xFF4DB049);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF012E2B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(28, 16, 28, 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 28),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Text(
            _state == _ScanState.success
                ? lang.scanVerified
                : _state == _ScanState.failed
                    ? lang.scanNotRecognised
                    : _state == _ScanState.scanning
                        ? lang.scanScanning
                        : lang.scanTouchToVerify,
            style: const TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            _state == _ScanState.failed
                ? lang.scanTryAgain
                : lang.scanPlaceFinger,
            style:
                TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
          ),
          const SizedBox(height: 40),

          // ── Fingerprint sensor widget ─────────────────────────────────
          GestureDetector(
            onTap: _startScan,
            child: SizedBox(
              width: 160,
              height: 160,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Pulse ring (idle only)
                  if (_state == _ScanState.waiting)
                    AnimatedBuilder(
                      animation: _pulseCtrl,
                      builder: (_, __) => Transform.scale(
                        scale: _pulseScale.value,
                        child: Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: const Color(0xFF4DB049)
                                    .withOpacity(_pulseOpacity.value),
                                width: 2.5),
                          ),
                        ),
                      ),
                    ),

                  // Sensor circle background
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.07),
                      border: Border.all(
                          color: _ringColor.withOpacity(0.4), width: 2),
                    ),
                  ),

                  // Scan line sweep (scanning state)
                  if (_state == _ScanState.scanning)
                    ClipOval(
                      child: SizedBox(
                        width: 120,
                        height: 120,
                        child: AnimatedBuilder(
                          animation: _scanLine,
                          builder: (_, __) {
                            return CustomPaint(
                              painter: _ScanLinePainter(_scanLine.value),
                            );
                          },
                        ),
                      ),
                    ),

                  // Fingerprint icon
                  if (_state == _ScanState.waiting ||
                      _state == _ScanState.scanning)
                    Icon(
                      Icons.fingerprint_rounded,
                      size: 72,
                      color: _state == _ScanState.scanning
                          ? const Color(0xFF4DB049)
                          : Colors.white.withOpacity(0.6),
                    ),

                  // Success / fail icon
                  if (_state == _ScanState.success ||
                      _state == _ScanState.failed)
                    ScaleTransition(
                      scale: _popScale,
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _ringColor.withOpacity(0.15),
                        ),
                        child: Icon(
                          _state == _ScanState.success
                              ? Icons.check_rounded
                              : Icons.close_rounded,
                          color: _ringColor,
                          size: 44,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 36),

          // Cancel button
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(lang.cancelLabel,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.45), fontSize: 14)),
          ),
        ],
      ),
    );
  }
}

/// Paints a sweeping gradient "scan line" from top to bottom.
class _ScanLinePainter extends CustomPainter {
  final double progress; // 0.0 → 1.0
  _ScanLinePainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height * progress;

    // Trailing fill (already-scanned tint)
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF4DB049).withOpacity(0.18),
          const Color(0xFF4DB049).withOpacity(0.05),
        ],
        stops: const [0.0, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, size.width, y));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, y), fillPaint);

    // Bright scan line
    final linePaint = Paint()
      ..color = const Color(0xFF4DB049).withOpacity(0.85)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(0, y), Offset(size.width, y), linePaint);

    // Glow below the line
    final glowPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF4DB049).withOpacity(0.35),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(0, y, size.width, 22));
    canvas.drawRect(Rect.fromLTWH(0, y, size.width, 22), glowPaint);
  }

  @override
  bool shouldRepaint(_ScanLinePainter old) => old.progress != progress;
}

// ─── Forgot PIN Screen ────────────────────────────────────────────────────
class ForgotPinScreen extends StatefulWidget {
  const ForgotPinScreen({super.key});
  @override
  State<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends State<ForgotPinScreen> {
  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _otpCtrl = TextEditingController();
  final TextEditingController _pinCtrl = TextEditingController();
  final TextEditingController _confirmPinCtrl = TextEditingController();
  bool _loading = false;
  bool _otpSent = false;
  bool _otpVerified = false;
  bool _pinVisible = false;
  bool _confirmPinVisible = false;
  String? _verificationToken;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _pinCtrl.dispose();
    _confirmPinCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phoneRaw = _phoneCtrl.text.trim();
    if (phoneRaw.isEmpty) {
      _showError('Please enter your phone number');
      return;
    }
    final phone = ApiService.normalizePhone(phoneRaw);

    setState(() => _loading = true);
    try {
      await ApiService.sendOtp(phone);
      setState(() => _otpSent = true);
      _showSuccess('OTP sent to your phone');
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Failed to send OTP. Please try again.');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      _showError('Please enter the 6-digit OTP');
      return;
    }
    final phone = ApiService.normalizePhone(_phoneCtrl.text.trim());

    setState(() => _loading = true);
    try {
      final result = await ApiService.verifyOtp(phone, otp);
      setState(() {
        _otpVerified = true;
        _verificationToken = result['verificationToken'] as String?;
      });
      _showSuccess('OTP verified. Set your new PIN');
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('OTP verification failed');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _resetPin() async {
    final pin = _pinCtrl.text.trim();
    final confirmPin = _confirmPinCtrl.text.trim();

    if (pin.length != 4) {
      _showError('PIN must be 4 digits');
      return;
    }
    if (pin != confirmPin) {
      _showError('PINs do not match');
      return;
    }
    if (_verificationToken == null) {
      _showError('Verification token missing. Please start over.');
      return;
    }

    setState(() => _loading = true);
    try {
      await ApiService.resetPinWithToken(
        verificationToken: _verificationToken!,
        newPin: pin,
      );
      _showSuccess('PIN reset successful!');
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Failed to reset PIN');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.deepTeal,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              // Back button
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.arrow_back, color: Colors.white),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                lang.isFrench ? 'Réinitialiser le PIN' : 'Reset PIN',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                lang.isFrench
                    ? 'Entrez votre numéro de téléphone pour recevoir un code de vérification'
                    : 'Enter your phone number to receive a verification code',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.6),
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 40),
              // Form Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Phone field
                    Text(
                      lang.phoneNumberLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      enabled: !_otpSent,
                      decoration: const InputDecoration(
                        hintText: '6XX XXX XXX',
                        prefixText: '+237  ',
                        prefixStyle: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (_otpSent) ...[
                      // OTP field
                      Text(
                        lang.isFrench ? 'Code OTP' : 'OTP Code',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _otpCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        enabled: !_otpVerified,
                        decoration: InputDecoration(
                          hintText: '6 digits',
                          counterText: '',
                          suffixIcon: _otpVerified
                              ? const Icon(Icons.check_circle,
                                  color: AppColors.success)
                              : null,
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (_otpVerified) ...[
                      // New PIN field
                      Text(
                        lang.isFrench ? 'Nouveau PIN' : 'New PIN',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _pinCtrl,
                        obscureText: !_pinVisible,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        decoration: InputDecoration(
                          hintText: '••••',
                          counterText: '',
                          suffixIcon: IconButton(
                            icon: Icon(
                              _pinVisible
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                            onPressed: () =>
                                setState(() => _pinVisible = !_pinVisible),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Confirm PIN field
                      Text(
                        lang.isFrench ? 'Confirmer le PIN' : 'Confirm PIN',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _confirmPinCtrl,
                        obscureText: !_confirmPinVisible,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        decoration: InputDecoration(
                          hintText: '••••',
                          counterText: '',
                          suffixIcon: IconButton(
                            icon: Icon(
                              _confirmPinVisible
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                            onPressed: () => setState(
                                () => _confirmPinVisible = !_confirmPinVisible),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                    // Action button
                    ElevatedButton(
                      onPressed: _loading
                          ? null
                          : _otpVerified
                              ? _resetPin
                              : _otpSent
                                  ? _verifyOtp
                                  : _sendOtp,
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _otpVerified
                                  ? (lang.isFrench
                                      ? 'Réinitialiser le PIN'
                                      : 'Reset PIN')
                                  : _otpSent
                                      ? (lang.isFrench ? 'Vérifier' : 'Verify')
                                      : (lang.isFrench
                                          ? 'Envoyer OTP'
                                          : 'Send OTP'),
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
