import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../widgets/shared_widgets.dart';
import '../services/language_service.dart';
import '../services/api_service.dart';
import '../wallet_state.dart';
import '../profile_state.dart';
import '../notification_state.dart';
import 'notifications_screen.dart';
import 'splash_screen.dart';
import 'security_screen.dart';
import 'help_support_screen.dart';
import 'about_screen.dart';
import 'credit_score_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _wallet;

  @override
  void initState() {
    super.initState();
    _load();
    WalletState.instance.addListener(_onWalletChanged);
  }

  @override
  void dispose() {
    WalletState.instance.removeListener(_onWalletChanged);
    super.dispose();
  }

  void _onWalletChanged() {
    if (!mounted) return;
    // Refresh wallet data from state
    setState(() {
      _wallet = {
        'balance': WalletState.instance.balance,
        'currency': 'FCFA',
      };
    });
  }

  Future<void> _load() async {
    try {
      final cached = await AuthService.getUser();
      if (cached != null && mounted) setState(() => _user = cached);
      final [profile, wallet] = await Future.wait([
        ApiService.fetchProfile(),
        ApiService.fetchWallet(),
      ]);
      if (!mounted) return;
      await AuthService.saveUser(profile as Map<String, dynamic>);
      setState(() {
        _user = profile as Map<String, dynamic>;
        _wallet = wallet as Map<String, dynamic>;
      });
    } catch (_) {}
  }

  Future<void> _pickAndUploadImageProfile() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
        maxWidth: 800,
        maxHeight: 800,
      );
      
      if (picked == null) return;
      
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );
      
      final bytes = await picked.readAsBytes();
      final result = await ApiService.uploadProfilePicture(bytes, picked.name);

      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog

      final resolvedImageUrl = result['fullUrl']?.toString() ?? ApiService.resolveImageUrl(result['imageUrl']?.toString());
      final updatedUser = {...?_user, 'imageUrl': resolvedImageUrl};
      setState(() => _user = updatedUser);
      await AuthService.saveUser(updatedUser);
      // Update global ProfileState
      ProfileState.instance.updateUser(updatedUser);
      // Notify other screens that profile has been updated
      NotificationState.instance.onProfileUpdated(updatedUser);
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile picture updated successfully'),
          backgroundColor: AppColors.primaryGreen,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // Close loading dialog if open
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to upload image: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        title: const SizedBox(
          width: 40,
          height: 40,
          child: Image(
            image: AssetImage('assets/images/logo_green.png'),
            fit: BoxFit.contain,
          ),
        ),
        actions: [
          // ── Language switcher ────────────────────────────────
          _buildLanguageSwitcher(),
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined,
                color: Colors.white),
            onPressed: () {},
          ),
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: Colors.white),
                onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const NotificationsScreen())),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryGreen,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ── User info card ──────────────────────────────────────────────────
            AppCard(
              child: Row(
                children: [
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 36,
                        backgroundColor: const Color(0xFFE8F5E9),
                        backgroundImage: (_user?['imageUrl'] != null && _user!['imageUrl'].toString().isNotEmpty)
                          ? NetworkImage(ApiService.resolveImageUrl(_user!['imageUrl'].toString()))
                          : null,
                        child: (_user?['imageUrl'] == null || _user!['imageUrl'].toString().isEmpty)
                          ? const Icon(Icons.person_rounded,
                              size: 40, color: AppColors.secondaryGreen)
                          : null,
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: _pickAndUploadImageProfile,
                          child: Container(
                            width: 22,
                            height: 22,
                            decoration: const BoxDecoration(
                              color: AppColors.primaryGreen,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                size: 12, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_user?['fullName'] ?? '—',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 4),
                        Text(_user?['phone'] ?? _user?['email'] ?? '—',
                            style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              _user?['kycStatus'] == 'VERIFIED'
                                  ? Icons.verified_rounded
                                  : Icons.pending_outlined,
                              size: 14,
                              color: _user?['kycStatus'] == 'VERIFIED'
                                  ? AppColors.primaryGreen
                                  : AppColors.warning,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _user?['kycStatus'] == 'VERIFIED'
                                  ? lang.identityVerified
                                  : (_user?['kycStatus'] ?? 'KYC Pending'),
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: _user?['kycStatus'] == 'VERIFIED'
                                      ? AppColors.primaryGreen
                                      : AppColors.warning),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined,
                        color: AppColors.textMuted, size: 20),
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const AccountEditScreen())),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            const SizedBox(height: 20),

            // ── Menu items ────────────────────────────────────────
            _menuSection(context, lang.settings, [
              _MenuItem(
                icon: Icons.person_outline_rounded,
                color: AppColors.secondaryGreen,
                title: lang.myAccount,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const AccountEditScreen())),
              ),
              _MenuItem(
                icon: Icons.notifications_outlined,
                color: AppColors.primaryGreen,
                title: lang.notifications,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const NotificationsScreen())),
              ),
              _MenuItem(
                icon: Icons.scoreboard_outlined,
                color: AppColors.secondaryGreen,
                title: 'Credit Score',
                subtitle: 'View your credit score and tips',
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const CreditScoreScreen())),
              ),
              _MenuItem(
                icon: Icons.shield_outlined,
                color: const Color(0xFF1565C0),
                title: lang.security,
                subtitle: lang.securitySubtitle,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const SecurityScreen())),
              ),
              // ── Language toggle row ──────────────────────────────
              _LanguageToggleItem(lang: lang),
            ]),
            const SizedBox(height: 12),

            _menuSection(context, lang.support, [
              _MenuItem(
                icon: Icons.help_outline_rounded,
                color: AppColors.warning,
                title: lang.helpSupport,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const HelpSupportScreen())),
              ),
              _MenuItem(
                icon: Icons.info_outline_rounded,
                color: AppColors.textSecondary,
                title: lang.about,
                subtitle: lang.version,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const AboutScreen())),
              ),
            ]),
            const SizedBox(height: 16),

            // ── Logout ────────────────────────────────────────────
            GestureDetector(
              onTap: () => _confirmLogout(context, lang),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: AppColors.error.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.logout_rounded,
                        color: AppColors.error, size: 20),
                    const SizedBox(width: 12),
                    Text(lang.signOut,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.error)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _menuSection(
      BuildContext context, String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(),
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE8F2F1)),
          ),
          child: Column(
            children: items.asMap().entries.map((e) {
              final isLast = e.key == items.length - 1;
              return Column(
                children: [
                  e.value,
                  if (!isLast)
                    const Divider(height: 1, indent: 66),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  void _confirmLogout(BuildContext context, LanguageService lang) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(lang.signOutConfirmTitle,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        content: Text(lang.signOutConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(lang.cancel),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await AuthService.clear();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (_) => false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              minimumSize: const Size(100, 40),
            ),
            child: Text(lang.signOut),
          ),
        ],
      ),
    );
  }

  // ── Language switcher ────────────────────────────────
  Widget _buildLanguageSwitcher() {
    final lang = LanguageProvider.of(context);
    return TextButton.icon(
      onPressed: () {
        LanguageService().toggle();
      },
      icon: const Icon(Icons.language, color: AppColors.white, size: 18),
      label: Text(
        lang.isFrench ? 'FR' : 'EN',
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        minimumSize: const Size(40, 40),
      ),
    );
  }
}

// ─── Language Toggle Item ─────────────────────────────────────────────────
class _LanguageToggleItem extends StatelessWidget {
  final LanguageService lang;
  const _LanguageToggleItem({required this.lang});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.textSecondary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.language_rounded,
                color: AppColors.textSecondary, size: 18),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(lang.language,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary)),
          ),
          // FR / EN toggle
          GestureDetector(
            onTap: () => lang.toggle(),
            child: Container(
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE8F2F1), width: 1.5),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // FR side
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: lang.isFrench
                          ? AppColors.primaryGreen
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      'FR',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: lang.isFrench ? Colors.white : AppColors.textMuted,
                      ),
                    ),
                  ),
                  // EN side
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: !lang.isFrench
                          ? AppColors.primaryGreen
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      'EN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: !lang.isFrench ? Colors.white : AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  const _MenuItem({
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(title,
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary)),
      subtitle: subtitle != null
          ? Text(subtitle!,
              style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textMuted))
          : null,
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.textMuted, size: 18),
      onTap: onTap,
    );
  }
}

// ─── Account Edit Screen ──────────────────────────────────────────────────
class AccountEditScreen extends StatefulWidget {
  const AccountEditScreen({super.key});

  @override
  State<AccountEditScreen> createState() => _AccountEditScreenState();
}

class _AccountEditScreenState extends State<AccountEditScreen> {
  Map<String, dynamic>? _user;
  bool _loading = true;
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await ApiService.fetchProfile();
      if (mounted) {
        final fullName = profile['fullName'] as String? ?? '';
        final nameParts = fullName.split(' ');
        _firstNameCtrl.text = nameParts.isNotEmpty ? nameParts.first : '';
        _lastNameCtrl.text = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
        _phoneCtrl.text = profile['phone'] as String? ?? '';
        _emailCtrl.text = profile['email'] as String? ?? '';
        _cityCtrl.text = profile['city'] as String? ?? '';
        setState(() {
          _user = profile;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _loading = true);
    try {
      final fullName = '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();
      final updated = await ApiService.updateProfile(
        fullName: fullName.isNotEmpty ? fullName : null,
        phone: _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : null,
      );
      if (mounted) {
        setState(() {
          _user = updated;
          _loading = false;
        });
        await AuthService.saveUser(updated);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Text(LanguageProvider.of(context).profileUpdated),
            ]),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _pickAndUploadImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
        maxWidth: 800,
        maxHeight: 800,
      );
      
      if (picked == null) return;
      
      setState(() => _loading = true);
      
      final bytes = await picked.readAsBytes();
      final result = await ApiService.uploadProfilePicture(bytes, picked.name);
      
      if (mounted) {
        setState(() {
          _user = {...?_user, 'imageUrl': result['imageUrl']};
          _loading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile picture updated successfully'),
            backgroundColor: AppColors.primaryGreen,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    return Scaffold(
      backgroundColor: AppColors.offWhite,
      appBar: WatsimAppBar(title: lang.myAccountTitle, showBack: true),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Center(
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 50,
                        backgroundColor: const Color(0xFFE8F5E9),
                        backgroundImage: (_user?['imageUrl'] != null && _user!['imageUrl'].toString().isNotEmpty)
                          ? NetworkImage(ApiService.resolveImageUrl(_user!['imageUrl'].toString()))
                          : null,
                        child: (_user?['imageUrl'] == null || _user!['imageUrl'].toString().isEmpty)
                          ? const Icon(Icons.person_rounded,
                              size: 56, color: AppColors.secondaryGreen)
                          : null,
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: _pickAndUploadImage,
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: const BoxDecoration(
                              color: AppColors.primaryGreen,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                size: 16, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                _field(lang.firstName, _firstNameCtrl),
                const SizedBox(height: 14),
                _field(lang.lastName, _lastNameCtrl),
                const SizedBox(height: 14),
                _field(lang.phoneNumber, _phoneCtrl),
                const SizedBox(height: 14),
                _field(lang.email, _emailCtrl, readOnly: true),
                const SizedBox(height: 14),
                _field(lang.city, _cityCtrl),
                const SizedBox(height: 28),
                ElevatedButton(
                  onPressed: _saveProfile,
                  child: Text(lang.saveChanges),
                ),
              ],
            ),
          ),
    );
  }

  Widget _field(String label, TextEditingController controller, {bool readOnly = false}) {
    return TextField(
      decoration: InputDecoration(labelText: label),
      controller: controller,
      readOnly: readOnly,
    );
  }
}
