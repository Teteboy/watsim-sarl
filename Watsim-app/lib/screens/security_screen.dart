import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../services/biometric_service.dart';
import 'otp_screen.dart';

// ─── Security Screen ──────────────────────────────────────────────────────
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  // ── Authentication toggles ─────────────────────────────────────────────
  bool _fingerprintEnabled = false;
  bool _faceIdEnabled = false;
  bool _irisEnabled = false;
  bool _twoFAEnabled = true;

  // ── Privacy toggles ────────────────────────────────────────────────────
  bool _loginAlerts = true;
  bool _transactionAlerts = true;

  // ── Biometrics expand state ────────────────────────────────────────────
  bool _biometricsExpanded = false;

  // ── Loading state ───────────────────────────────────────────────────────
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSecuritySettings();
  }

  // ── Biometric availability ────────────────────────────────────────────
  bool _fingerprintAvailable = false;
  bool _faceIdAvailable = false;
  bool _biometricsAvailable = false;

  Future<void> _loadSecuritySettings() async {
    try {
      final settings = await ApiService.getSecuritySettings();

      // Check device biometric capabilities
      final fingerprintAvail = await BiometricService.isFingerprintAvailable();
      final faceIdAvail = await BiometricService.isFaceIdAvailable();
      final canCheckBiometrics = await BiometricService.canCheckBiometrics();
      final isDeviceSupported = await BiometricService.isDeviceSupported();

      // Load local biometric preferences
      final biometricEnabled = await BiometricService.isBiometricEnabled();
      final biometricType = await BiometricService.getStoredBiometricType();

      if (mounted) {
        setState(() {
          _fingerprintEnabled =
              biometricEnabled && biometricType == 'Fingerprint';
          _faceIdEnabled = biometricEnabled && biometricType == 'Face ID';
          _fingerprintAvailable = fingerprintAvail;
          _faceIdAvailable = faceIdAvail;
          _biometricsAvailable = canCheckBiometrics && isDeviceSupported;
          _irisEnabled = settings['irisEnabled'] ?? false;
          _twoFAEnabled = settings['twoFAEnabled'] ?? true;
          _loginAlerts = settings['loginAlertsEnabled'] ?? true;
          _transactionAlerts = settings['transactionAlertsEnabled'] ?? true;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _updateSetting(String key, dynamic value) async {
    try {
      await ApiService.updateSecuritySettings(
        fingerprintEnabled: key == 'fingerprintEnabled' ? value : null,
        faceIdEnabled: key == 'faceIdEnabled' ? value : null,
        irisEnabled: key == 'irisEnabled' ? value : null,
        twoFAEnabled: key == 'twoFAEnabled' ? value : null,
        loginAlertsEnabled: key == 'loginAlertsEnabled' ? value : null,
        transactionAlertsEnabled:
            key == 'transactionAlertsEnabled' ? value : null,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update setting: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _handleBiometricToggle(
    BuildContext context,
    String label,
    IconData icon,
    Color color,
    bool currentValue,
    ValueChanged<bool> onChanged,
    String settingKey,
  ) async {
    if (!currentValue) {
      // Enable biometric - first verify with device biometric
      final authenticated = await BiometricService.authenticate(
        localizedReason: 'Verify your $label to enable biometric login',
      );

      if (!authenticated) {
        // Authentication failed, don't enable
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(LanguageService().isFrench
                  ? 'Vérification biométrique échouée. Veuillez réessayer.'
                  : 'Biometric verification failed. Please try again.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      // Authentication succeeded, enable biometric
      onChanged(true);
      await _updateSetting(settingKey, true);

      // Save local preference
      await BiometricService.setBiometricEnabled(true);
      await BiometricService.setBiometricType(label);

      // Show success dialog
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => _BiometricScanDialog(
              label: label, icon: icon, color: color, success: true),
        );
      }
    } else {
      // Disable biometric
      onChanged(false);
      await _updateSetting(settingKey, false);
      await BiometricService.setBiometricEnabled(false);
      await BiometricService.setBiometricType('');
    }
  }

  void _showFreezeConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.lock_clock_rounded,
                  color: AppColors.error, size: 20),
            ),
            const SizedBox(width: 12),
            const Text('Freeze Account',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to freeze your account?',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 8),
            Text(
              'While frozen, all transactions and logins will be blocked. You can unfreeze at any time by contacting support.',
              style: TextStyle(
                  fontSize: 13, color: AppColors.textMuted, height: 1.5),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.pop(context);
              try {
                await ApiService.freezeAccount(reason: 'User requested');
                if (mounted) {
                  showDialog(
                    context: context,
                    barrierDismissible: false,
                    builder: (_) => const _FreezeSimulationDialog(),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to freeze account: $e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            },
            child: const Text('Freeze Account'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.securityTitle, showBack: true),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primaryGreen),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.offWhite,
        appBar: WatsimAppBar(title: lang.securityTitle, showBack: true),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'Failed to load security settings',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _loadSecuritySettings,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryGreen,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.securityTitle, showBack: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Security status banner ─────────────────────────────────
            GradientCard(
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.25),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.shield_rounded,
                        color: Colors.white, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(lang.accountSecured,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(lang.allSecurityActive,
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                  const Icon(Icons.check_circle_rounded,
                      color: AppColors.primaryGreen, size: 28),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Authentication ─────────────────────────────────────────
            _sectionTitle(lang.authentication),
            const SizedBox(height: 10),
            _securityCard(
              context,
              icon: Icons.lock_rounded,
              color: AppColors.primaryGreen,
              title: lang.changePIN,
              subtitle: lang.changePINSubtitle,
              onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const ChangePinScreen())),
            ),
            const SizedBox(height: 10),

            // ── Biometrics expandable block ────────────────────────────
            _BiometricsCard(
              expanded: _biometricsExpanded,
              onExpandToggle: () =>
                  setState(() => _biometricsExpanded = !_biometricsExpanded),
              fingerprintEnabled: _fingerprintEnabled,
              faceIdEnabled: _faceIdEnabled,
              irisEnabled: _irisEnabled,
              fingerprintAvailable: _fingerprintAvailable,
              faceIdAvailable: _faceIdAvailable,
              biometricsAvailable: _biometricsAvailable,
              onFingerprintChanged: _fingerprintAvailable
                  ? (_) => _handleBiometricToggle(
                        context,
                        'Fingerprint',
                        Icons.fingerprint_rounded,
                        AppColors.deepTeal,
                        _fingerprintEnabled,
                        (v) => setState(() => _fingerprintEnabled = v),
                        'fingerprintEnabled',
                      )
                  : null,
              onFaceIdChanged: _faceIdAvailable
                  ? (_) => _handleBiometricToggle(
                        context,
                        'Face ID',
                        Icons.face_retouching_natural_rounded,
                        AppColors.secondaryGreen,
                        _faceIdEnabled,
                        (v) => setState(() => _faceIdEnabled = v),
                        'faceIdEnabled',
                      )
                  : null,
              onIrisChanged: null, // Iris not implemented yet
            ),

            const SizedBox(height: 10),
            _securityCard(
              context,
              icon: Icons.smartphone_rounded,
              color: AppColors.secondaryGreen,
              title: lang.twoFA,
              subtitle: lang.twoFASubtitle,
              trailing: Switch(
                value: _twoFAEnabled,
                activeColor: AppColors.primaryGreen,
                onChanged: (v) {
                  setState(() => _twoFAEnabled = v);
                  _updateSetting('twoFAEnabled', v);
                },
              ),
            ),
            const SizedBox(height: 20),

            // ── Privacy ────────────────────────────────────────────────
            _sectionTitle(lang.privacySection),
            const SizedBox(height: 10),
            _securityCard(
              context,
              icon: Icons.notifications_active_rounded,
              color: AppColors.warning,
              title: lang.loginAlerts,
              subtitle: lang.loginAlertsSubtitle,
              trailing: Switch(
                value: _loginAlerts,
                activeColor: AppColors.primaryGreen,
                onChanged: (v) {
                  setState(() => _loginAlerts = v);
                  _updateSetting('loginAlertsEnabled', v);
                },
              ),
            ),
            const SizedBox(height: 10),
            _securityCard(
              context,
              icon: Icons.receipt_long_rounded,
              color: AppColors.primaryGreen,
              title: lang.transactionAlerts,
              subtitle: lang.transactionAlertsSubtitle,
              trailing: Switch(
                value: _transactionAlerts,
                activeColor: AppColors.primaryGreen,
                onChanged: (v) {
                  setState(() => _transactionAlerts = v);
                  _updateSetting('transactionAlertsEnabled', v);
                },
              ),
            ),
            const SizedBox(height: 20),

            // ── Danger zone ────────────────────────────────────────────
            _sectionTitle(lang.dangerZone),
            const SizedBox(height: 10),
            _securityCard(
              context,
              icon: Icons.lock_clock_rounded,
              color: AppColors.error,
              title: lang.freezeAccount,
              subtitle: lang.freezeAccountSubtitle,
              onTap: () => _showFreezeConfirmation(context),
              danger: true,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String t) => Text(t,
      style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1));

  Widget _securityCard(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    Widget? trailing,
    bool danger = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: danger
                ? AppColors.error.withOpacity(0.2)
                : const Color(0xFFE8F2F1),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: danger
                              ? AppColors.error
                              : AppColors.textPrimary)),
                  if (subtitle != null)
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            trailing ??
                Icon(
                  Icons.chevron_right_rounded,
                  color: danger ? AppColors.error : AppColors.textMuted,
                  size: 18,
                ),
          ],
        ),
      ),
    );
  }
}

// ─── Biometrics Card ──────────────────────────────────────────────────────
class _BiometricsCard extends StatelessWidget {
  final bool expanded;
  final VoidCallback onExpandToggle;
  final bool fingerprintEnabled;
  final bool faceIdEnabled;
  final bool irisEnabled;
  final bool fingerprintAvailable;
  final bool faceIdAvailable;
  final bool biometricsAvailable;
  final ValueChanged<bool>? onFingerprintChanged;
  final ValueChanged<bool>? onFaceIdChanged;
  final ValueChanged<bool>? onIrisChanged;

  const _BiometricsCard({
    required this.expanded,
    required this.onExpandToggle,
    required this.fingerprintEnabled,
    required this.faceIdEnabled,
    required this.irisEnabled,
    this.fingerprintAvailable = false,
    this.faceIdAvailable = false,
    this.biometricsAvailable = false,
    this.onFingerprintChanged,
    this.onFaceIdChanged,
    this.onIrisChanged,
  });

  int get _enabledCount =>
      (fingerprintEnabled ? 1 : 0) +
      (faceIdEnabled ? 1 : 0) +
      (irisEnabled ? 1 : 0);

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final anyEnabled = _enabledCount > 0;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8F2F1)),
      ),
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          GestureDetector(
            onTap: onExpandToggle,
            child: Container(
              padding: const EdgeInsets.all(14),
              color: Colors.transparent,
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.deepTeal.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.fingerprint_rounded,
                        color: AppColors.deepTeal, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(lang.biometrics,
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary)),
                        Text(
                          !biometricsAvailable
                              ? 'Not available on this device'
                              : anyEnabled
                                  ? '$_enabledCount method${_enabledCount > 1 ? 's' : ''} active'
                                  : 'Fingerprint / Face ID / Iris',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  if (anyEnabled)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('ON',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryGreen)),
                    ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 250),
                    child: const Icon(Icons.keyboard_arrow_down_rounded,
                        color: AppColors.textMuted, size: 20),
                  ),
                ],
              ),
            ),
          ),

          // ── Sub-options ──────────────────────────────────────────────
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: !biometricsAvailable
                ? Column(
                    children: [
                      const Divider(height: 1, color: Color(0xFFE8F2F1)),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: AppColors.textMuted, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Biometric authentication is not available on this device or not enrolled. Please check your device settings.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      const Divider(height: 1, color: Color(0xFFE8F2F1)),
                      if (fingerprintAvailable)
                        _biometricRow(
                          icon: Icons.fingerprint_rounded,
                          color: AppColors.deepTeal,
                          label: 'Fingerprint',
                          value: fingerprintEnabled,
                          onChanged: onFingerprintChanged,
                        ),
                      if (fingerprintAvailable && faceIdAvailable)
                        const Divider(
                            height: 1, color: Color(0xFFE8F2F1), indent: 58),
                      if (faceIdAvailable)
                        _biometricRow(
                          icon: Icons.face_retouching_natural_rounded,
                          color: AppColors.secondaryGreen,
                          label: 'Face ID',
                          value: faceIdEnabled,
                          onChanged: onFaceIdChanged,
                        ),
                    ],
                  ),
            crossFadeState:
                expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }

  Widget _biometricRow({
    required IconData icon,
    required Color color,
    required String label,
    required bool value,
    required ValueChanged<bool>? onChanged,
    bool isLast = false,
  }) {
    return Padding(
      padding: EdgeInsets.fromLTRB(14, 10, 14, isLast ? 14 : 10),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: color, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary)),
          ),
          Switch(
            value: value,
            activeColor: AppColors.primaryGreen,
            onChanged: onChanged != null ? (v) => onChanged(v) : null,
          ),
        ],
      ),
    );
  }
}

// ─── Biometric Scan Simulation Dialog ─────────────────────────────────────
class _BiometricScanDialog extends StatefulWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool? success;

  const _BiometricScanDialog({
    required this.label,
    required this.icon,
    required this.color,
    this.success,
  });

  @override
  State<_BiometricScanDialog> createState() => _BiometricScanDialogState();
}

class _BiometricScanDialogState extends State<_BiometricScanDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulse;
  bool _success = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);

    _pulse = Tween<double>(begin: 0.85, end: 1.1)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    // If success is pre-set, show it immediately
    if (widget.success == true) {
      _controller.stop();
      _success = true;
      Future.delayed(const Duration(milliseconds: 1200), () {
        if (mounted) Navigator.of(context).pop();
      });
    } else {
      // Simulate scan for demo purposes (when called from simulation mode)
      Future.delayed(const Duration(milliseconds: 2500), () {
        if (mounted) {
          _controller.stop();
          setState(() => _success = true);
          Future.delayed(const Duration(milliseconds: 900), () {
            if (mounted) Navigator.of(context).pop();
          });
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.primaryDark,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulse,
              builder: (_, __) => Transform.scale(
                scale: _success ? 1.0 : _pulse.value,
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _success
                        ? AppColors.primaryGreen.withOpacity(0.2)
                        : widget.color.withOpacity(0.15),
                    border: Border.all(
                      color: _success ? AppColors.primaryGreen : widget.color,
                      width: 2.5,
                    ),
                  ),
                  child: Icon(
                    _success ? Icons.check_rounded : widget.icon,
                    color: _success ? AppColors.primaryGreen : widget.color,
                    size: 44,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _success ? 'Verified!' : 'Scanning…',
              style: TextStyle(
                color: _success ? AppColors.primaryGreen : Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _success
                  ? '${widget.label} enabled'
                  : 'Place your ${widget.label.toLowerCase()} on the sensor',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 13),
            ),
            if (!_success) ...[
              const SizedBox(height: 20),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 2500),
                builder: (_, v, __) => ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: v,
                    minHeight: 4,
                    backgroundColor: Colors.white12,
                    valueColor: AlwaysStoppedAnimation(widget.color),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Change PIN Screen ────────────────────────────────────────────────────
class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key});

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  int _step = 0;
  String _pin = '';
  String _currentPin = '';
  String _newPin = '';
  bool _loading = false;

  final _stepLabels = [
    'Enter your current PIN',
    'Enter your new PIN',
    'Confirm your new PIN',
  ];

  void _addDigit(String d) {
    if (_pin.length < 4) setState(() => _pin += d);
    if (_pin.length == 4) _next();
  }

  void _deleteDigit() {
    if (_pin.isNotEmpty) {
      setState(() => _pin = _pin.substring(0, _pin.length - 1));
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(children: [
            const Icon(Icons.error_outline, color: Colors.white),
            const SizedBox(width: 10),
            Text(message),
          ]),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _next() async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (_step == 0) {
      setState(() {
        _currentPin = _pin;
        _step = 1;
        _newPin = '';
        _pin = '';
      });
    } else if (_step == 1) {
      setState(() {
        _newPin = _pin;
        _step = 2;
        _pin = '';
      });
    } else {
      if (_pin != _newPin) {
        _showError('PINs do not match. Try again.');
        setState(() {
          _step = 1;
          _newPin = '';
          _pin = '';
        });
        return;
      }
      setState(() => _loading = true);
      try {
        await ApiService.changePin(
          currentPin: _currentPin,
          newPin: _newPin,
        );
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 10),
                Text('PIN changed successfully'),
              ]),
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      } catch (e) {
        _showError('Failed to change PIN: $e');
        if (mounted) {
          setState(() {
            _loading = false;
            _step = 0;
            _pin = '';
            _newPin = '';
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new_rounded,
                            color: Colors.white, size: 20),
                        onPressed: () => Navigator.pop(context),
                      ),
                      const Expanded(
                        child: Center(
                          child: Text('Change PIN',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                  const SizedBox(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(3, (i) {
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: _step == i ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: i <= _step
                              ? AppColors.primaryGreen
                              : Colors.white24,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 32),
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.lock_rounded,
                        size: 40, color: AppColors.primaryGreen),
                  ),
                  const SizedBox(height: 24),
                  Text(_stepLabels[_step],
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 32),
                  PinDots(filled: _pin.length, total: 4),
                  const Spacer(),
                  NumPad(onKey: _addDigit, onDelete: _deleteDigit),
                  const SizedBox(height: 20),
                ],
              ),
            ),
            if (_loading)
              Container(
                color: Colors.black54,
                child: const Center(
                  child:
                      CircularProgressIndicator(color: AppColors.primaryGreen),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Freeze Account Simulation Dialog ─────────────────────────────────────
class _FreezeSimulationDialog extends StatefulWidget {
  const _FreezeSimulationDialog();

  @override
  State<_FreezeSimulationDialog> createState() =>
      _FreezeSimulationDialogState();
}

class _FreezeSimulationDialogState extends State<_FreezeSimulationDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulse;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);

    _pulse = Tween<double>(begin: 0.88, end: 1.08)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) {
        _controller.stop();
        setState(() => _done = true);
        Future.delayed(const Duration(milliseconds: 1200), () {
          if (mounted) Navigator.of(context).pop();
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.primaryDark,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulse,
              builder: (_, __) => Transform.scale(
                scale: _done ? 1.0 : _pulse.value,
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _done
                        ? AppColors.primaryGreen.withOpacity(0.15)
                        : AppColors.error.withOpacity(0.15),
                    border: Border.all(
                      color: _done ? AppColors.primaryGreen : AppColors.error,
                      width: 2.5,
                    ),
                  ),
                  child: Icon(
                    _done ? Icons.check_rounded : Icons.lock_clock_rounded,
                    color: _done ? AppColors.primaryGreen : AppColors.error,
                    size: 44,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _done ? 'Account Frozen' : 'Freezing Account…',
              style: TextStyle(
                color: _done ? AppColors.primaryGreen : Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _done
                  ? 'Your account has been frozen.\nContact support to unfreeze.'
                  : 'Please wait while we secure your account',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white60, fontSize: 13, height: 1.5),
            ),
            if (!_done) ...[
              const SizedBox(height: 20),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 2800),
                builder: (_, v, __) => ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: v,
                    minHeight: 4,
                    backgroundColor: Colors.white12,
                    valueColor: const AlwaysStoppedAnimation(AppColors.error),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
