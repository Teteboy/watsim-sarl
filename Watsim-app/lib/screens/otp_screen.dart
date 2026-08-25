import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../main.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';

// ─── OTP Verification Screen ──────────────────────────────────────────────
class OtpScreen extends StatefulWidget {
  final String phone; // normalized for backend

  const OtpScreen({super.key, required this.phone});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  String _code = '';
  int _seconds = 285;
  Timer? _timer;
  bool _verifying = false;

  // Backend enforces a 6-digit OTP (auth.schema.ts: verifyOtpSchema.code)
  static const int _otpLength = 6;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_seconds > 0) {
        setState(() => _seconds--);
      } else {
        _timer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _addDigit(String d) {
    if (_code.length >= _otpLength) return;
    setState(() => _code += d);
    if (_code.length == _otpLength) _verify();
  }

  void _deleteDigit() {
    if (_code.isEmpty) return;
    setState(() => _code = _code.substring(0, _code.length - 1));
  }

  void _verify() async {
    if (_verifying) return;
    if (_code.length != _otpLength) return;

    setState(() => _verifying = true);
    try {
      final result = await ApiService.verifyOtp(widget.phone, _code);
      if (!mounted) return;
      final verificationToken = result['verificationToken'] as String?;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
            builder: (_) =>
                PinSetupScreen(verificationToken: verificationToken)),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(LanguageService().isFrench
              ? 'Vérification OTP échouée. Réessayez.'
              : 'OTP verification failed. Try again.'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  String get _timerDisplay {
    final m = _seconds ~/ 60;
    final s = _seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 10, 16, 0),
              child: Row(
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
                        width: 56,
                        height: 56,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            // ── Scrollable body ──────────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    const SizedBox(height: 24),

                    // Phone icon circle
                    Container(
                      width: 108,
                      height: 108,
                      decoration: BoxDecoration(
                        color: AppColors.deepTeal,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primaryGreen.withOpacity(0.25),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.30),
                            blurRadius: 28,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.smartphone_rounded,
                              size: 46, color: AppColors.primaryGreen),
                          Positioned(
                            bottom: 20,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _indicatorDot(true),
                                const SizedBox(width: 4),
                                _indicatorDot(false),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Title
                    const Text(
                      'Phone Verification',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'DM Sans',
                      ),
                    ),
                    const SizedBox(height: 10),
                    RichText(
                      textAlign: TextAlign.center,
                      text: TextSpan(
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 14,
                          height: 1.55,
                          fontFamily: 'DM Sans',
                        ),
                        children: const [
                          TextSpan(text: 'A 5-digit code has been sent to\n'),
                          TextSpan(
                            text: '+237 6 *********',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 30),

                    // OTP boxes — uses MediaQuery to prevent overflow
                    _OtpBoxRow(code: _code),

                    const SizedBox(height: 20),

                    // Timer
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.access_time_rounded,
                            size: 14, color: Colors.white.withOpacity(0.45)),
                        const SizedBox(width: 6),
                        Text(
                          'Code valid for  ',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 13,
                            fontFamily: 'DM Sans',
                          ),
                        ),
                        Text(
                          _timerDisplay,
                          style: const TextStyle(
                            color: AppColors.primaryGreen,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'DM Sans',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Resend
                    GestureDetector(
                      onTap: _seconds == 0
                          ? () {
                              setState(() => _seconds = 285);
                              _startTimer();
                            }
                          : null,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Text(
                          'Resend code',
                          style: TextStyle(
                            color: _seconds == 0
                                ? AppColors.primaryGreen
                                : Colors.white24,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            fontFamily: 'DM Sans',
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // ── Numpad — outside ScrollView so taps are never swallowed ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _WatsimNumPad(
                onKey: _addDigit,
                onDelete: _deleteDigit,
              ),
            ),
            const SizedBox(height: 10),

            // ── Verify button — always visible at bottom ─────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: GestureDetector(
                onTap: (_code.length == _otpLength && !_verifying)
                    ? _verify
                    : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: double.infinity,
                  height: 54,
                  decoration: BoxDecoration(
                    color: _code.length == _otpLength
                        ? AppColors.primaryGreen
                        : AppColors.primaryGreen.withOpacity(0.35),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: _code.length == _otpLength
                        ? [
                            BoxShadow(
                              color: AppColors.primaryGreen.withOpacity(0.30),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ]
                        : [],
                  ),
                  child: Center(
                    child: _verifying
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Verify',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'DM Sans',
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _indicatorDot(bool active) => Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color:
              active ? AppColors.primaryGreen : Colors.white.withOpacity(0.25),
        ),
      );
}

// ─── OTP Box Row — sizes computed from screen width, never overflows ──────
class _OtpBoxRow extends StatelessWidget {
  final String code;
  const _OtpBoxRow({required this.code});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableW = constraints.maxWidth;
        // 6 boxes with 4px margin on each side = 48px total margin
        final totalMargin = 6 * 8.0;
        final boxW = ((availableW - totalMargin) / 6).clamp(0.0, 56.0);
        final boxH = (boxW * 1.18).clamp(0.0, 64.0);

        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (i) {
            final isFilled = i < code.length;
            final isFocused = i == code.length && code.length < 6;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: boxW,
              height: boxH,
              decoration: BoxDecoration(
                color: isFilled
                    ? AppColors.secondaryGreen.withOpacity(0.2)
                    : AppColors.deepTeal.withOpacity(0.7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isFocused
                      ? AppColors.primaryGreen
                      : isFilled
                          ? AppColors.secondaryGreen
                          : Colors.white.withOpacity(0.15),
                  width: isFocused ? 2.0 : 1.5,
                ),
              ),
              child: Center(
                child: isFilled
                    ? Text(
                        code[i],
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          fontFamily: 'DM Sans',
                        ),
                      )
                    : null,
              ),
            );
          }),
        );
      },
    );
  }
}

// ─── Numpad key — stateful so press highlight works independently ─────────
class _NumKey extends StatefulWidget {
  final String label;
  final VoidCallback onTap;
  const _NumKey({required this.label, required this.onTap});
  @override
  State<_NumKey> createState() => _NumKeyState();
}

class _NumKeyState extends State<_NumKey> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDelete = widget.label == '⌫';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        height: 56,
        decoration: BoxDecoration(
          color: _pressed
              ? AppColors.primaryGreen.withOpacity(0.25)
              : AppColors.deepTeal,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _pressed
                ? AppColors.primaryGreen.withOpacity(0.5)
                : Colors.white.withOpacity(0.08),
            width: 1,
          ),
        ),
        child: Center(
          child: isDelete
              ? Icon(Icons.backspace_outlined,
                  size: 20, color: _pressed ? Colors.white : Colors.white70)
              : Text(
                  widget.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'DM Sans',
                  ),
                ),
        ),
      ),
    );
  }
}

// ─── Numpad ────────────────────────────────────────────────────────────────
class _WatsimNumPad extends StatelessWidget {
  final void Function(String) onKey;
  final VoidCallback onDelete;

  const _WatsimNumPad({required this.onKey, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];

    return Column(
      children: rows.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: row.map((key) {
              if (key.isEmpty) {
                return const Expanded(child: SizedBox());
              }
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: _NumKey(
                    label: key,
                    onTap: () => key == '⌫' ? onDelete() : onKey(key),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}

// ─── PIN Setup Screen ─────────────────────────────────────────────────────
class PinSetupScreen extends StatefulWidget {
  final String? verificationToken;
  const PinSetupScreen({super.key, this.verificationToken});
  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen>
    with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _confirm = false;
  String _firstPin = '';
  bool _error = false;
  late AnimationController _shake;
  late Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();
    _shake = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _shakeAnim = Tween<double>(begin: 0, end: 10)
        .chain(CurveTween(curve: Curves.elasticIn))
        .animate(_shake);
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  void _addDigit(String d) {
    if (_pin.length >= 4) return;
    setState(() => _pin += d);
    if (_pin.length == 4) {
      Future.delayed(const Duration(milliseconds: 150), () {
        if (!mounted) return;
        if (!_confirm) {
          setState(() {
            _firstPin = _pin;
            _pin = '';
            _confirm = true;
            _error = false;
          });
        } else {
          _finalize();
        }
      });
    }
  }

  void _deleteDigit() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  void _finalize() async {
    if (_pin != _firstPin) {
      setState(() {
        _error = true;
        _pin = '';
      });
      _shake.forward(from: 0);
      return;
    }

    // PIN must be exactly 4 digits
    if (_pin.length != 4) {
      setState(() {
        _error = true;
        _pin = '';
      });
      _shake.forward(from: 0);
      return;
    }

    try {
      if (widget.verificationToken != null) {
        // New registration flow: complete registration with PIN
        await ApiService.registerComplete(
          verificationToken: widget.verificationToken!,
          pin: _pin,
        );
      } else {
        // Fallback: set PIN for logged in user
        await ApiService.setPin(_pin);
      }
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const MainShell()),
        (_) => false,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _pin = '';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
      );
      _shake.forward(from: 0);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _pin = '';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to set PIN. Try again.'),
          backgroundColor: AppColors.error,
        ),
      );
      _shake.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: ConstrainedBox(
              constraints:
                  BoxConstraints(minHeight: constraints.maxHeight - 32),
              child: IntrinsicHeight(
                child: Column(
                  children: [
                    // Top bar
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: const Padding(
                            padding: EdgeInsets.all(8),
                            child: Icon(Icons.arrow_back_ios_new_rounded,
                                color: Colors.white, size: 20),
                          ),
                        ),
                        const Expanded(
                          child: Center(
                            child: Image(
                              image: AssetImage('assets/images/logo_green.png'),
                              width: 56,
                              height: 56,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.deepTeal,
                            border: Border.all(
                                color: Colors.white.withOpacity(0.15),
                                width: 1.5),
                          ),
                          child: const Icon(Icons.person_rounded,
                              color: Colors.white54, size: 20),
                        ),
                      ],
                    ),

                    const SizedBox(height: 36),

                    Text(
                      _confirm ? 'Confirm your PIN' : 'Create your PIN',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'DM Sans',
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _confirm
                          ? 'Re-enter the same PIN to confirm'
                          : 'This PIN secures your transactions',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 14,
                        fontFamily: 'DM Sans',
                      ),
                    ),

                    const SizedBox(height: 28),

                    _StepDots(step: _confirm ? 1 : 0, total: 4),

                    const SizedBox(height: 12),

                    Text(
                      _confirm ? 'STEP 2 OF 2' : 'STEP 1 OF 2',
                      style: const TextStyle(
                        color: AppColors.primaryGreen,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        fontFamily: 'DM Sans',
                      ),
                    ),

                    const SizedBox(height: 32),

                    if (_error) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.error.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppColors.error.withOpacity(0.4)),
                        ),
                        child: const Text(
                          'PINs do not match. Try again.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.error,
                            fontSize: 13,
                            fontFamily: 'DM Sans',
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    const Spacer(),

                    AnimatedBuilder(
                      animation: _shakeAnim,
                      builder: (_, child) => Transform.translate(
                        offset: Offset(
                          _error
                              ? _shakeAnim.value *
                                  ((_shake.value % 0.2 > 0.1) ? 1 : -1)
                              : 0,
                          0,
                        ),
                        child: child,
                      ),
                      child: _PinNumPad(
                        filled: _pin.length,
                        total: 4,
                        onKey: _addDigit,
                        onDelete: _deleteDigit,
                      ),
                    ),

                    const SizedBox(height: 20),

                    Text(
                      "Don't use simple combinations\nlike 1234 or 0000.",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.35),
                        fontSize: 12,
                        height: 1.5,
                        fontFamily: 'DM Sans',
                      ),
                    ),

                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Step progress dots ───────────────────────────────────────────────────
class _StepDots extends StatelessWidget {
  final int step;
  final int total;
  const _StepDots({required this.step, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total, (i) {
        final active = i == step;
        final done = i < step;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 5),
          width: active ? 22 : 14,
          height: 14,
          decoration: BoxDecoration(
            color: active
                ? AppColors.primaryGreen
                : done
                    ? AppColors.primaryGreen.withOpacity(0.4)
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
            border: Border.all(
              color: active || done
                  ? AppColors.primaryGreen
                  : Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
        );
      }),
    );
  }
}

// ─── PIN numpad with dot indicators ──────────────────────────────────────
class _PinNumPad extends StatelessWidget {
  final int filled;
  final int total;
  final void Function(String) onKey;
  final VoidCallback onDelete;

  const _PinNumPad({
    required this.filled,
    required this.total,
    required this.onKey,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⌫', '0', '✓'],
    ];

    return Column(
      children: [
        // PIN dot indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(total, (i) {
            final isFilled = i < filled;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isFilled ? AppColors.primaryGreen : Colors.transparent,
                border: Border.all(
                  color: isFilled
                      ? AppColors.primaryGreen
                      : Colors.white.withOpacity(0.3),
                  width: 2,
                ),
              ),
            );
          }),
        ),

        const SizedBox(height: 28),

        // Key grid
        ...rows.map((row) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: row.map((key) {
                final isDelete = key == '⌫';
                final isConfirm = key == '✓';
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    child: isConfirm
                        ? AnimatedContainer(
                            duration: const Duration(milliseconds: 80),
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppColors.primaryGreen,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Icon(Icons.check_circle_outline_rounded,
                                  size: 22, color: Colors.white),
                            ),
                          )
                        : _NumKey(
                            label: key,
                            onTap: () {
                              if (isDelete) {
                                onDelete();
                              } else {
                                onKey(key);
                              }
                            },
                          ),
                  ),
                );
              }).toList(),
            ),
          );
        }),
      ],
    );
  }
}

// ─── KYC Screen ───────────────────────────────────────────────────────────
class KycScreen extends StatefulWidget {
  const KycScreen({super.key});
  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  // step 0 = personal info, step 1 = ID front, step 2 = ID back
  int _step = 0;
  static const int _totalSteps = 3;

  // ── Personal info controllers ──────────────────────────────────────────
  final _fullNameCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  String _idType = 'National ID';
  final _addressCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  // ── Document upload state — now uses real files ────────────────────────
  File? _frontImage;
  File? _backImage;
  bool _uploading = false;
  String? _uploadError;

  final _picker = ImagePicker();

  final _docSteps = const [
    _KycStep(
        icon: Icons.credit_card_rounded,
        title: 'ID Card — Front',
        desc:
            'Take a clear photo of the FRONT side of your national identity card. Make sure all text is legible and the card is fully visible.'),
    _KycStep(
        icon: Icons.flip_rounded,
        title: 'ID Card — Back',
        desc:
            'Take a clear photo of the BACK side of your national identity card. Make sure all text is legible and the card is fully visible.'),
  ];

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _dobCtrl.dispose();
    _idNumberCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final docIdx = _step - 1;
    setState(() {
      _uploadError = null;
      _uploading = true;
    });
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 1600,
        maxHeight: 1200,
      );
      if (picked == null) {
        setState(() => _uploading = false);
        return;
      }
      final file = File(picked.path);
      setState(() {
        _uploading = false;
        if (docIdx == 0) _frontImage = file;
        if (docIdx == 1) _backImage = file;
      });
    } catch (e) {
      setState(() {
        _uploading = false;
        _uploadError = 'Could not open camera. Please grant camera permission.';
      });
    }
  }

  Future<void> _submitKyc() async {
    if (_frontImage == null || _backImage == null) return;
    setState(() {
      _uploading = true;
      _uploadError = null;
    });
    try {
      await ApiService.uploadKyc(
        frontImage: _frontImage!,
        backImage: _backImage!,
        docType: _idType == 'Passport' ? 'PASSPORT' : 'NATIONAL_ID',
      );
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const KycSuccessScreen()),
        (_) => false,
      );
    } on ApiException catch (e) {
      setState(() {
        _uploading = false;
        _uploadError = e.message;
      });
    } catch (e) {
      setState(() {
        _uploading = false;
        _uploadError = 'Upload failed. Check your internet connection.';
      });
    }
  }

  File? get _currentFile => _step == 1 ? _frontImage : _backImage;

  bool get _canContinue {
    if (_step == 0) {
      return _fullNameCtrl.text.trim().isNotEmpty &&
          _dobCtrl.text.trim().isNotEmpty &&
          _idNumberCtrl.text.trim().isNotEmpty &&
          _addressCtrl.text.trim().isNotEmpty;
    }
    if (_step == 1) return _frontImage != null;
    if (_step == 2) return _backImage != null;
    return false;
  }

  InputDecoration _inputDecoration(String label, {IconData? icon}) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(
          color: AppColors.textSecondary, fontSize: 14, fontFamily: 'DM Sans'),
      prefixIcon: icon != null
          ? Icon(icon, color: AppColors.primaryGreen, size: 20)
          : null,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade200),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade200),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.8),
      ),
    );
  }

  // Multiline variant — icon pinned to top so it aligns with the first line of text
  InputDecoration _multilineInputDecoration(String label, {IconData? icon}) {
    return InputDecoration(
      labelText: label,
      alignLabelWithHint: true,
      labelStyle: const TextStyle(
          color: AppColors.textSecondary, fontSize: 14, fontFamily: 'DM Sans'),
      prefixIcon: icon != null
          ? Align(
              alignment: Alignment.topCenter,
              widthFactor: 1,
              child: Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Icon(icon, color: AppColors.primaryGreen, size: 20),
              ),
            )
          : null,
      prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade200),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey.shade200),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.8),
      ),
    );
  }

  Widget _buildPersonalInfoStep() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Full name
          TextFormField(
            controller: _fullNameCtrl,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(
                fontFamily: 'DM Sans', color: AppColors.textPrimary),
            decoration: _inputDecoration('Full Legal Name',
                icon: Icons.person_outline_rounded),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 20),

          // Date of birth
          TextFormField(
            controller: _dobCtrl,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(
                fontFamily: 'DM Sans', color: AppColors.textPrimary),
            decoration: _inputDecoration('Date of Birth (DD/MM/YYYY)',
                icon: Icons.cake_outlined),
            keyboardType: TextInputType.datetime,
          ),
          const SizedBox(height: 20),

          // ID type dropdown + ID number row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ID type
              Expanded(
                flex: 5,
                child: DropdownButtonFormField<String>(
                  value: _idType,
                  style: const TextStyle(
                      fontFamily: 'DM Sans',
                      color: AppColors.textPrimary,
                      fontSize: 14),
                  decoration: _inputDecoration('ID Type'),
                  dropdownColor: Colors.white,
                  icon: const Icon(Icons.expand_more_rounded,
                      color: AppColors.primaryGreen),
                  items: const [
                    'National ID',
                    'Passport',
                    'Driver\'s License',
                    'Residence Permit',
                  ]
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _idType = v!),
                ),
              ),
              const SizedBox(width: 10),
              // ID number
              Expanded(
                flex: 6,
                child: TextFormField(
                  controller: _idNumberCtrl,
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(
                      fontFamily: 'DM Sans', color: AppColors.textPrimary),
                  decoration:
                      _inputDecoration('ID Number', icon: Icons.tag_rounded),
                  textCapitalization: TextCapitalization.characters,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Address
          TextFormField(
            controller: _addressCtrl,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(
                fontFamily: 'DM Sans',
                color: AppColors.textPrimary,
                height: 1.4),
            textAlign: TextAlign.start,
            textDirection: TextDirection.ltr,
            decoration: _inputDecoration('Residential Address',
                icon: Icons.home_outlined),
            keyboardType: TextInputType.streetAddress,
          ),
          const SizedBox(height: 20),

          const InfoBanner(
              text:
                  'This information must match your official identity documents exactly.'),
        ],
      ),
    );
  }

  Widget _buildDocUploadStep() {
    final docIdx = _step - 1;
    final stepInfo = _docSteps[docIdx];
    final file = _currentFile;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(stepInfo.desc,
            style: const TextStyle(
                fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
        const SizedBox(height: 24),
        GestureDetector(
          onTap: _uploading ? null : _pickImage,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: double.infinity,
            height: 220,
            decoration: BoxDecoration(
              color: file != null
                  ? AppColors.primaryGreen.withOpacity(0.07)
                  : AppColors.primaryGreen.withOpacity(0.03),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: file != null
                    ? AppColors.primaryGreen
                    : AppColors.primaryGreen.withOpacity(0.3),
                width: file != null ? 2 : 1.5,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: _uploading
                ? const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(color: AppColors.primaryGreen),
                      SizedBox(height: 14),
                      Text('Opening camera...',
                          style: TextStyle(
                              color: AppColors.primaryGreen,
                              fontWeight: FontWeight.w600)),
                    ],
                  )
                : file != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.file(file, fit: BoxFit.cover),
                          Positioned(
                            bottom: 10,
                            right: 10,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.primaryDark.withOpacity(0.75),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.camera_alt_rounded,
                                      size: 14, color: Colors.white),
                                  SizedBox(width: 6),
                                  Text('Retake',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: AppColors.primaryGreen.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                size: 34, color: AppColors.primaryGreen),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'Tap to take a photo',
                            style: TextStyle(
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w600,
                                fontSize: 15),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Use your camera to capture the document',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
          ),
        ),
        if (_uploadError != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.error.withOpacity(0.3)),
            ),
            child: Row(children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppColors.error, size: 18),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(_uploadError!,
                      style: const TextStyle(
                          color: AppColors.error, fontSize: 13))),
            ]),
          ),
        ],
        const SizedBox(height: 16),
        const InfoBanner(
            text:
                'Your documents are encrypted and stored securely. We comply with all data protection regulations.'),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final stepTitles = [
      'Personal Information',
      'ID Card — Front',
      'ID Card — Back',
    ];

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 20),
          onPressed: () {
            if (_step > 0) {
              setState(() => _step--);
            } else {
              Navigator.pop(context);
            }
          },
        ),
        centerTitle: true,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Image(
              image: AssetImage('assets/images/logo_green.png'),
              width: 56,
              height: 56,
              fit: BoxFit.contain,
            ),
            SizedBox(width: 10),
            Text('Identity Verification',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Progress bar
                  Row(
                    children: List.generate(_totalSteps, (i) {
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                              right: i < _totalSteps - 1 ? 6 : 0),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            height: 5,
                            decoration: BoxDecoration(
                              color: i <= _step
                                  ? AppColors.primaryGreen
                                  : AppColors.divider,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 28),

                  Text('Step ${_step + 1} of $_totalSteps',
                      style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 13,
                          fontWeight: FontWeight.w500)),
                  const SizedBox(height: 6),
                  Text(stepTitles[_step],
                      style: const TextStyle(
                          fontSize: 21,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 24),

                  // Step content
                  if (_step == 0)
                    _buildPersonalInfoStep()
                  else
                    _buildDocUploadStep(),

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // Bottom actions
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              children: [
                AnimatedBuilder(
                  animation: Listenable.merge(
                      [_fullNameCtrl, _dobCtrl, _idNumberCtrl, _addressCtrl]),
                  builder: (_, __) {
                    final isLastStep = _step == _totalSteps - 1;
                    return ElevatedButton(
                      onPressed: _canContinue && !_uploading
                          ? () {
                              if (!isLastStep) {
                                setState(() => _step++);
                              } else {
                                _submitKyc();
                              }
                            }
                          : null,
                      child: _uploading && isLastStep
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.5, color: Colors.white))
                          : Text(
                              isLastStep ? 'Submit Verification' : 'Continue'),
                    );
                  },
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () {
                    Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(builder: (_) => const MainShell()),
                        (_) => false);
                  },
                  child: Builder(
                      builder: (ctx) =>
                          Text(LanguageProvider.of(ctx).skipForNow)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KycStep {
  final IconData icon;
  final String title;
  final String desc;
  const _KycStep({required this.icon, required this.title, required this.desc});
}

// ─── Forgot PIN Screen ────────────────────────────────────────────────────
// 3-step flow: enter phone → verify OTP → set new PIN (+ confirm)
class ForgotPinScreen extends StatefulWidget {
  const ForgotPinScreen({super.key});
  @override
  State<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends State<ForgotPinScreen>
    with SingleTickerProviderStateMixin {
  int _step = 0; // 0=phone, 1=otp, 2=new pin
  bool _loading = false;
  String? _error;

  final _phoneCtrl = TextEditingController();

  // OTP
  String _otpCode = '';
  int _otpSeconds = 285;
  Timer? _otpTimer;
  String? _verificationToken;

  // New PIN
  String _pin = '';
  String _firstPin = '';
  bool _confirmMode = false;

  late AnimationController _shake;
  late Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();
    _shake = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _shakeAnim = Tween<double>(begin: 0, end: 10)
        .chain(CurveTween(curve: Curves.elasticIn))
        .animate(_shake);
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpTimer?.cancel();
    _shake.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Enter your phone number.');
      return;
    }
    final normalized = ApiService.normalizePhone(phone);

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.sendOtp(normalized);
      setState(() {
        _loading = false;
        _step = 1;
        _otpSeconds = 285;
      });
      _startOtpTimer();
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Failed to send OTP.';
      });
    }
  }

  void _startOtpTimer() {
    _otpTimer?.cancel();
    _otpTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_otpSeconds > 0)
          _otpSeconds--;
        else
          _otpTimer?.cancel();
      });
    });
  }

  void _addOtpDigit(String d) {
    if (_otpCode.length >= 5) return;
    setState(() => _otpCode += d);
    if (_otpCode.length == 5) _verifyOtp();
  }

  void _deleteOtpDigit() {
    if (_otpCode.isEmpty) return;
    setState(() => _otpCode = _otpCode.substring(0, _otpCode.length - 1));
  }

  Future<void> _verifyOtp() async {
    if (_loading) return;
    final phone = _phoneCtrl.text.trim();
    final normalized = ApiService.normalizePhone(phone);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.verifyOtp(normalized, _otpCode);
      _verificationToken = res['verificationToken'] as String?;
      setState(() {
        _loading = false;
        _step = 2;
      });
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _otpCode = '';
        _error = e.message;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _otpCode = '';
        _error = 'Invalid or expired code.';
      });
    }
  }

  void _addPinDigit(String d) {
    if (_pin.length >= 4) return;
    setState(() => _pin += d);
    if (_pin.length == 4) {
      Future.delayed(const Duration(milliseconds: 150), () {
        if (!mounted) return;
        if (!_confirmMode) {
          setState(() {
            _firstPin = _pin;
            _pin = '';
            _confirmMode = true;
            _error = null;
          });
        } else {
          _finalize();
        }
      });
    }
  }

  void _deletePinDigit() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _finalize() async {
    if (_pin != _firstPin) {
      setState(() {
        _error = 'PINs do not match. Try again.';
        _pin = '';
        _confirmMode = false;
        _firstPin = '';
      });
      _shake.forward(from: 0);
      return;
    }
    if (_verificationToken == null) {
      setState(() {
        _error = 'Session expired. Restart.';
        _step = 0;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.resetPin(
          verificationToken: _verificationToken!, newPin: _pin);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('PIN reset successfully! Please log in.'),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ));
      Navigator.pop(context);
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
        _pin = '';
        _confirmMode = false;
        _firstPin = '';
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Reset failed. Try again.';
        _pin = '';
        _confirmMode = false;
        _firstPin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 10, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                    onPressed: () {
                      if (_step == 1) {
                        setState(() {
                          _step = 0;
                          _error = null;
                          _otpTimer?.cancel();
                        });
                      } else {
                        Navigator.pop(context);
                      }
                    },
                  ),
                  const Expanded(
                      child: Center(
                          child: Image(
                              image: AssetImage('assets/images/logo_green.png'),
                              width: 56,
                              height: 56,
                              fit: BoxFit.contain))),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),
                    // Progress
                    Row(
                      children: List.generate(
                          3,
                          (i) => Expanded(
                                  child: Padding(
                                padding: EdgeInsets.only(right: i < 2 ? 6 : 0),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  height: 4,
                                  decoration: BoxDecoration(
                                    color: i <= _step
                                        ? AppColors.primaryGreen
                                        : Colors.white.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              ))),
                    ),
                    const SizedBox(height: 28),
                    if (_step == 0) _buildPhoneStep(),
                    if (_step == 1) _buildOtpStep(),
                    if (_step == 2) _buildPinStep(),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                            color: AppColors.error.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: AppColors.error.withOpacity(0.4))),
                        child: Row(children: [
                          const Icon(Icons.error_outline_rounded,
                              color: AppColors.error, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(_error!,
                                  style: const TextStyle(
                                      color: AppColors.error,
                                      fontSize: 13,
                                      fontFamily: 'DM Sans'))),
                        ]),
                      ),
                    ],
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
            // Numpad for OTP
            if (_step == 1) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _WatsimNumPad(
                    onKey: _addOtpDigit, onDelete: _deleteOtpDigit),
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: GestureDetector(
                  onTap:
                      (_otpCode.length == 5 && !_loading) ? _verifyOtp : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: double.infinity,
                    height: 54,
                    decoration: BoxDecoration(
                      color: _otpCode.length == 5
                          ? AppColors.primaryGreen
                          : AppColors.primaryGreen.withOpacity(0.35),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                        child: _loading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white))
                            : const Text('Verify',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    fontFamily: 'DM Sans'))),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Reset your PIN',
            style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
                fontFamily: 'DM Sans')),
        const SizedBox(height: 8),
        Text('Enter your registered phone number. We\'ll send a 5-digit code.',
            style: TextStyle(
                color: Colors.white.withOpacity(0.55),
                fontSize: 14,
                fontFamily: 'DM Sans')),
        const SizedBox(height: 28),
        TextField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          style: const TextStyle(
              color: AppColors.textPrimary, fontFamily: 'DM Sans'),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            hintText: '6XXXXXXXX',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            prefixIcon:
                const Icon(Icons.phone_outlined, color: AppColors.primaryGreen),
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
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _sendOtp,
            child: _loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Send Verification Code'),
          ),
        ),
      ],
    );
  }

  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Text('Verification Code',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
                fontFamily: 'DM Sans')),
        const SizedBox(height: 10),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 14,
                height: 1.55,
                fontFamily: 'DM Sans'),
            children: [
              const TextSpan(text: 'Code sent to '),
              TextSpan(
                  text: _phoneCtrl.text.trim(),
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _OtpBoxRow(code: _otpCode),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _otpSeconds == 0
              ? () {
                  setState(() {
                    _otpCode = '';
                    _otpSeconds = 285;
                  });
                  _startOtpTimer();
                  _sendOtp();
                }
              : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text(
              _otpSeconds == 0 ? 'Resend code' : 'Resend in ${_otpSeconds}s',
              style: TextStyle(
                  color: _otpSeconds == 0
                      ? AppColors.primaryGreen
                      : Colors.white24,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'DM Sans'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPinStep() {
    return AnimatedBuilder(
      animation: _shakeAnim,
      builder: (_, child) => Transform.translate(
        offset: Offset(
            _error != null
                ? _shakeAnim.value * ((_shake.value % 0.2 > 0.1) ? 1 : -1)
                : 0,
            0),
        child: child,
      ),
      child: _PinNumPad(
        filled: _pin.length,
        total: 4,
        onKey: _addPinDigit,
        onDelete: _deletePinDigit,
      ),
    );
  }
}

// ─── KYC Success Screen ───────────────────────────────────────────────────
class KycSuccessScreen extends StatelessWidget {
  const KycSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(36),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryGreen,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_rounded,
                      color: Colors.white, size: 64),
                ),
                const SizedBox(height: 32),
                Text(lang.verificationSubmitted,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 14),
                Text(
                  lang.verificationReviewDesc,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.6),
                      fontSize: 15,
                      height: 1.6),
                ),
                const SizedBox(height: 48),
                ElevatedButton(
                  onPressed: () => Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const MainShell()),
                      (_) => false),
                  child: Text(lang.goToDashboard),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
