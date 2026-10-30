import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/language_service.dart';

/// Reusable PIN confirmation dialog for sensitive operations
/// (transfers, withdrawals, etc.)
///
/// Returns `true` if PIN was verified successfully, `false` if cancelled.
Future<bool> showPinConfirmDialog(BuildContext context, {String? title}) async {
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _PinConfirmDialog(title: title),
  );
  return result ?? false;
}

class _PinConfirmDialog extends StatefulWidget {
  final String? title;
  const _PinConfirmDialog({this.title});

  @override
  State<_PinConfirmDialog> createState() => _PinConfirmDialogState();
}

class _PinConfirmDialogState extends State<_PinConfirmDialog> {
  final _pinCtrl = TextEditingController();
  bool _verifying = false;
  String? _error;

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final lang = LanguageProvider.of(context);
    final pin = _pinCtrl.text.trim();
    if (pin.isEmpty || pin.length < 4) {
      setState(() => _error = lang.enterPinError);
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });

    bool valid;
    try {
      valid = await ApiService.verifyTransactionPin(pin);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _error = e is ApiException ? lang.apiError(e) : lang.verifyFailed;
      });
      return;
    }

    if (!mounted) return;

    if (valid) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _verifying = false;
        _error = lang.incorrectPinFull;
        _pinCtrl.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.lock_rounded,
                color: AppColors.primaryGreen, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              widget.title ?? lang.pinDialogTitle,
              style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            lang.pinDialogBody,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _pinCtrl,
            keyboardType: TextInputType.number,
            obscureText: true,
            maxLength: 6,
            autofocus: true,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: 12),
            decoration: InputDecoration(
              counterText: '',
              hintText: '••••',
              hintStyle: TextStyle(
                  color: AppColors.textMuted.withOpacity(0.4),
                  fontSize: 24,
                  letterSpacing: 12),
              filled: true,
              fillColor: AppColors.primaryGreen.withOpacity(0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide:
                    const BorderSide(color: AppColors.primaryGreen, width: 1.5),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Colors.redAccent, width: 1),
              ),
            ),
            onSubmitted: (_) => _verify(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style:
                    const TextStyle(color: Colors.redAccent, fontSize: 12)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _verifying ? null : () => Navigator.of(context).pop(false),
          child: Text(lang.cancel,
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500)),
        ),
        ElevatedButton(
          onPressed: _verifying ? null : _verify,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryGreen,
            foregroundColor: Colors.white,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
          ),
          child: _verifying
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2))
              : Text(lang.confirm,
                  style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}
