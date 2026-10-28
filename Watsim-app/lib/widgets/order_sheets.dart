import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../order_state.dart';
import '../wallet_state.dart';
import '../notification_state.dart';
import '../services/api_service.dart';
import '../services/language_service.dart';
import '../screens/catalogue_screen.dart';

// ─── Shared order bottom sheets & views ──────────────────────────────────────
// Extracted from history_screen.dart and order_detail_screen.dart where they
// existed as near-identical private copies. Behavioural differences between the
// two variants are preserved via parameters:
//   • DeliverySheet(extended: true) → the richer history form (nom/prénom,
//     résidence, lieu de livraison, couleur, pointure, CNI) which also submits
//     the delivery request to the backend via ApiService.submitDeliveryRequest.
//   • ReceiptView(detailedFees: true) → the itemised fee breakdown
//     (account/delivery/collection/stocking fees) used by order_detail;
//     detailedFees: false → the localised history receipt with
//     colour/shoe-size/CNI rows.
//   • WatSimTransferSheet → order_detail confirm flow (backend
//     transferContribution) merged with the history recipient verification
//     (ApiService.searchUser + "no WatSim account" warning).
//   • WithdrawSheet → the backend-backed variant (withdrawContribution +
//     wallet sync + busy state).

/// Formats an amount as "12,500 FCFA".
String fmtAmount(num v) {
  final i = v.toInt();
  final k = i ~/ 1000;
  final r = (i % 1000).toString().padLeft(3, '0');
  return '$k,$r FCFA';
}

// ── Fully paid banner ──────────────────────────────────────────────────────
class FullyPaidBanner extends StatelessWidget {
  const FullyPaidBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.primaryGreen.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
      ),
      child: Row(children: [
        Icon(Icons.check_circle_rounded,
            color: AppColors.primaryGreen, size: 28),
        SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.allInstalmentsPaid,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryGreen)),
          SizedBox(height: 2),
          Text(lang.orderFullySettled,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
      ]),
    );
  }
}

// ── Exchange confirm sheet ─────────────────────────────────────────────────
class ExchangeConfirmSheet extends StatefulWidget {
  final ConfirmedOrder currentOrder;
  final Product newProduct;
  final int newPrice;
  final int accumulated; // funds already in the order
  final int
      remaining; // still needed after applying accumulated (0 if willComplete)
  final int
      overpayPreview; // excess above newPrice (0 if accumulated ≤ newPrice)
  final bool willComplete; // accumulated >= newPrice
  final VoidCallback onExchanged;

  const ExchangeConfirmSheet({
    super.key,
    required this.currentOrder,
    required this.newProduct,
    required this.newPrice,
    required this.accumulated,
    required this.remaining,
    required this.overpayPreview,
    required this.willComplete,
    required this.onExchanged,
  });

  @override
  State<ExchangeConfirmSheet> createState() => _ExchangeConfirmSheetState();
}

class _ExchangeConfirmSheetState extends State<ExchangeConfirmSheet> {
  bool _showPin = false;
  bool _done = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  void _confirm() async {
    final pinValid =
        await ApiService.verifyTransactionPin(_pinCtrl.text.trim());
    if (!mounted) return;
    if (!pinValid) {
      setState(() => _pinError = "Incorrect PIN. Please try again.");
      return;
    }

    final order = widget.currentOrder;
    final newProduct = widget.newProduct;
    final oldPrice = order.basePrice;

    // ── 1. Adjust the maximum contribution allowance ──────────────────────
    // Remove the old product's price from the cap (exchange frees up that slot)
    // then add back the new product's price.
    WalletState.instance.restoreMaxContribution(oldPrice);
    WalletState.instance.deductMaxContribution(widget.newPrice);

    // ── 2. Swap the product & transfer accumulated funds ──────────────────
    // exchangeProduct resets installment slots and applies the carried funds.
    final result = order.exchangeProduct(newProduct, widget.newPrice);

    // ── 3. Handle completion outcomes ─────────────────────────────────────
    if (result.completed) {
      // Product is immediately paid off — reset cap for this product
      WalletState.instance.restoreMaxContribution(widget.newPrice);

      // Refund any overpay to wallet
      if (result.overpay > 0) {
        WalletState.instance.refundOverpay(newProduct.name, result.overpay);
        NotificationState.instance.addGenericNotification(
          "Exchange Complete — Refund",
          "${fmtAmount(result.overpay)} refunded to your wallet after exchanging ${order.product.name} for ${newProduct.name}.",
        );
      } else {
        NotificationState.instance.addGenericNotification(
          "Exchange Complete",
          "Your accumulated funds exactly covered ${newProduct.name}. Order marked complete.",
        );
      }
    } else {
      // Partially covered — user continues contributing
      NotificationState.instance.addGenericNotification(
        "Product Exchanged",
        "Switched to ${newProduct.name}. ${fmtAmount(widget.accumulated)} transferred. ${fmtAmount(widget.remaining)} still needed.",
      );
    }

    widget.onExchanged();
    setState(() => _done = true);
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final order = widget.currentOrder;
    final newProduct = widget.newProduct;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),

            // ── Done state ───────────────────────────────────────────────
            if (_done) ...[
              Center(
                  child: Column(children: [
                Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withOpacity(0.12),
                        shape: BoxShape.circle),
                    child: Icon(
                      widget.willComplete
                          ? Icons.verified_rounded
                          : Icons.swap_horiz_rounded,
                      size: 36,
                      color: AppColors.primaryGreen,
                    )),
                const SizedBox(height: 16),
                Text(
                  widget.willComplete
                      ? 'Exchange Complete! 🎉'
                      : lang.exchangeConfirmed,
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.willComplete
                      ? widget.overpayPreview > 0
                          ? "Exchanged for ${newProduct.name} and fully paid off.\n${fmtAmount(widget.overpayPreview)} refunded to your wallet."
                          : "Your accumulated funds exactly covered ${newProduct.name}. Order is complete!"
                      : "Exchanged for ${newProduct.name}.\n${fmtAmount(widget.accumulated)} transferred. "
                          "Keep contributing ${fmtAmount(widget.remaining)} more with your ${order.paymentFrequency.toLowerCase()} payments.",
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(lang.done)),
              ])),

              // ── PIN entry ────────────────────────────────────────────────
            ] else if (_showPin) ...[
              Text(lang.confirmWithPIN,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text("Enter your 4-digit PIN to confirm the exchange.",
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 20),

              // Product swap summary
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.divider)),
                child: Row(children: [
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(lang.current,
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(order.product.name,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                      ])),
                  const Icon(Icons.arrow_forward_rounded,
                      color: AppColors.primaryGreen, size: 20),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                        Text(lang.newLabel,
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(newProduct.name,
                            textAlign: TextAlign.end,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                      ])),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome banner
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(
                    Icons.account_balance_wallet_outlined,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    lang.isFrench
                        ? "${fmtAmount(widget.overpayPreview)} sera remboursé sur votre portefeuille après la fin de la commande."
                        : "${fmtAmount(widget.overpayPreview)} will be refunded to your wallet after completing the order.")
              else if (widget.willComplete)
                _infoBanner(
                    Icons.check_circle_outline_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    lang.isFrench
                        ? "Vos fonds accumulés couvrent exactement ${newProduct.name} — la commande sera marquée complète."
                        : "Your accumulated funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(
                    Icons.info_outline_rounded,
                    const Color(0xFFF57C00),
                    const Color(0xFFFFF3E0),
                    lang.isFrench
                        ? "Il vous manque encore ${fmtAmount(widget.remaining)}. Vos contributions ${order.paymentFrequency.toLowerCase()} continueront sur le nouveau produit."
                        : "You still need ${fmtAmount(widget.remaining)} more. Your ${order.paymentFrequency.toLowerCase()} contributions will continue on the new product."),

              const SizedBox(height: 20),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                    labelText: "4-digit PIN",
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    counterText: "",
                    errorText: _pinError),
                onChanged: (_) {
                  if (_pinError != null) setState(() => _pinError = null);
                },
              ),
              const SizedBox(height: 6),

              const SizedBox(height: 20),
              Row(children: [
                Expanded(
                    child: OutlinedButton(
                  onPressed: () => setState(() {
                    _showPin = false;
                    _pinCtrl.clear();
                    _pinError = null;
                  }),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50),
                      side: const BorderSide(color: AppColors.divider),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                  child: Text(lang.back,
                      style: const TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: ElevatedButton(
                        onPressed: _confirm,
                        style: ElevatedButton.styleFrom(
                            minimumSize: const Size(0, 50)),
                        child: Text(lang.confirm))),
              ]),

              // ── Review state ─────────────────────────────────────────────
            ] else ...[
              Text(lang.exchangeProduct,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(
                lang.isFrench
                    ? "Vos fonds accumulés (${fmtAmount(widget.accumulated)}) et la fréquence de paiement ${order.paymentFrequency.toLowerCase()} seront transférés au nouveau produit."
                    : "Your accumulated funds (${fmtAmount(widget.accumulated)}) and ${order.paymentFrequency.toLowerCase()} payment frequency will transfer to the new product.",
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),

              // Product comparison card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  Row(children: [
                    Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: order.product.color,
                            borderRadius: BorderRadius.circular(10)),
                        child: Icon(order.product.icon,
                            color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          const Text("Current",
                              style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                  fontWeight: FontWeight.w600)),
                          Text(order.product.name,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary)),
                          Text(order.product.price,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.primaryGreen)),
                        ])),
                  ]),
                  const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Row(children: [
                        Expanded(child: Divider()),
                        Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Icon(Icons.swap_vert_rounded,
                                color: AppColors.primaryGreen, size: 20)),
                        Expanded(child: Divider()),
                      ])),
                  Row(children: [
                    Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: newProduct.color,
                            borderRadius: BorderRadius.circular(10)),
                        child: Icon(newProduct.icon,
                            color: Colors.white, size: 24)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(lang.newLabel,
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.primaryGreen,
                                  fontWeight: FontWeight.w600)),
                          Text(newProduct.name,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary)),
                          Text(newProduct.price,
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.primaryGreen)),
                        ])),
                  ]),
                ]),
              ),
              const SizedBox(height: 12),

              // Funds transfer summary
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: AppColors.primaryGreen.withOpacity(0.25)),
                ),
                child: Column(children: [
                  _summaryRow(
                      Icons.savings_outlined,
                      lang.isFrench
                          ? "Fonds accumulés transférés"
                          : "Accumulated funds transferred",
                      fmtAmount(widget.accumulated),
                      AppColors.primaryGreen),
                  if (widget.willComplete && widget.overpayPreview > 0) ...[
                    const SizedBox(height: 8),
                    _summaryRow(
                        Icons.account_balance_wallet_outlined,
                        lang.isFrench
                            ? "Excédent remboursé au portefeuille"
                            : "Excess refunded to wallet",
                        fmtAmount(widget.overpayPreview),
                        AppColors.primaryGreen),
                  ],
                  if (!widget.willComplete) ...[
                    const SizedBox(height: 8),
                    _summaryRow(
                        Icons.payments_outlined,
                        lang.isFrench
                            ? "Restant à cotiser"
                            : "Remaining to contribute",
                        fmtAmount(widget.remaining),
                        const Color(0xFFF57C00)),
                  ],
                  const SizedBox(height: 8),
                  _summaryRow(
                      Icons.repeat_rounded,
                      lang.isFrench
                          ? "Fréquence de paiement conservée"
                          : "Payment frequency kept",
                      order.paymentFrequency,
                      AppColors.textSecondary),
                ]),
              ),
              const SizedBox(height: 12),

              // Outcome callout
              if (widget.willComplete && widget.overpayPreview > 0)
                _infoBanner(
                    Icons.verified_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    lang.isFrench
                        ? "La commande sera marquée complète immédiatement. ${fmtAmount(widget.overpayPreview)} remboursé sur votre portefeuille."
                        : "Order will be marked complete immediately. ${fmtAmount(widget.overpayPreview)} refunded to your wallet.")
              else if (widget.willComplete)
                _infoBanner(
                    Icons.verified_rounded,
                    AppColors.primaryGreen,
                    const Color(0xFFE8F5E9),
                    lang.isFrench
                        ? "Vos fonds couvrent exactement ${newProduct.name} — la commande sera marquée complète."
                        : "Your funds exactly cover ${newProduct.name} — order will be marked complete.")
              else
                _infoBanner(
                    Icons.info_outline_rounded,
                    const Color(0xFFF57C00),
                    const Color(0xFFFFF3E0),
                    lang.isFrench
                        ? "${fmtAmount(widget.remaining)} restant à payer. Continuez vos contributions ${order.paymentFrequency.toLowerCase()} — pas de nouveau plan nécessaire."
                        : "${fmtAmount(widget.remaining)} left to pay. Continue your ${order.paymentFrequency.toLowerCase()} contributions — no new plan needed."),

              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => setState(() => _showPin = true),
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52)),
                child: Text(lang.continueToPIN),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoBanner(
      IconData icon, Color iconColor, Color bgColor, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: iconColor.withOpacity(0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Expanded(
            child:
                Text(text, style: TextStyle(fontSize: 12, color: iconColor))),
      ]),
    );
  }

  Widget _summaryRow(
      IconData icon, String label, String value, Color valueColor) {
    return Row(children: [
      Icon(icon, size: 15, color: AppColors.primaryGreen),
      const SizedBox(width: 8),
      Expanded(
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary))),
      Text(value,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700, color: valueColor)),
    ]);
  }
}

// ── Delivery sheet ─────────────────────────────────────────────────────────
class DeliverySheet extends StatefulWidget {
  final ConfirmedOrder order;
  final VoidCallback? onDeliveryConfirmed;

  /// When true, shows the extended delivery form (nom/prénom, résidence,
  /// lieu de livraison, couleur, pointure, CNI) used by the history screen
  /// and submits the request via [ApiService.submitDeliveryRequest].
  /// When false, shows the simpler English form used by order detail.
  final bool extended;

  const DeliverySheet(
      {super.key, required this.order, this.onDeliveryConfirmed, this.extended = false});

  @override
  State<DeliverySheet> createState() => _DeliverySheetState();
}

class _DeliverySheetState extends State<DeliverySheet> {
  // Simple-form controllers
  final _nameCtrl = TextEditingController();
  final _neighbourhoodCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();

  // Extended-form controllers (also reuses _phoneCtrl/_professionCtrl below)
  final _lastNameCtrl = TextEditingController(); // Nom
  final _firstNameCtrl = TextEditingController(); // Prénom
  final _residenceCtrl = TextEditingController(); // Lieu résidence
  final _deliveryLocationCtrl = TextEditingController(); // Lieu livraison
  final _colorCtrl = TextEditingController(); // Couleur
  final _shoeSizeCtrl = TextEditingController(); // Pointure
  final _cniCtrl = TextEditingController(); // CNI

  // Shared controllers
  final _phoneCtrl = TextEditingController();
  final _professionCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  // ID card photos (optional) — stored as mock file paths for demo
  String? _idFrontPhoto;
  String? _idBackPhoto;

  TimeOfDay? _deliveryTime;

  // 'form' | 'pin' | 'receipt'
  String _step = 'form';
  String? _pinError;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _neighbourhoodCtrl.dispose();
    _cityCtrl.dispose();
    _lastNameCtrl.dispose();
    _firstNameCtrl.dispose();
    _residenceCtrl.dispose();
    _deliveryLocationCtrl.dispose();
    _colorCtrl.dispose();
    _shoeSizeCtrl.dispose();
    _cniCtrl.dispose();
    _phoneCtrl.dispose();
    _professionCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  bool get _allFilled => widget.extended
      ? _lastNameCtrl.text.trim().isNotEmpty &&
          _firstNameCtrl.text.trim().isNotEmpty &&
          _phoneCtrl.text.trim().isNotEmpty &&
          _residenceCtrl.text.trim().isNotEmpty &&
          _deliveryLocationCtrl.text.trim().isNotEmpty &&
          _professionCtrl.text.trim().isNotEmpty &&
          _cniCtrl.text.trim().isNotEmpty
      : _nameCtrl.text.trim().isNotEmpty &&
          _phoneCtrl.text.trim().isNotEmpty &&
          _neighbourhoodCtrl.text.trim().isNotEmpty &&
          _cityCtrl.text.trim().isNotEmpty &&
          _professionCtrl.text.trim().isNotEmpty &&
          _deliveryTime != null;

  String get _fullName => widget.extended
      ? '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'
      : _nameCtrl.text.trim();

  void _submitForm() {
    final lang = LanguageProvider.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_deliveryTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(lang.pleaseSelectDeliveryTime),
            backgroundColor: AppColors.warning),
      );
      return;
    }
    setState(() => _step = 'pin');
  }

  void _confirmPin() async {
    final lang = LanguageProvider.of(context);
    final pinValid =
        await ApiService.verifyTransactionPin(_pinCtrl.text.trim());
    if (!mounted) return;
    if (pinValid) {
      // Submit delivery request to backend (extended form only)
      if (widget.extended) {
        try {
          await ApiService.submitDeliveryRequest(
            purchaseId: widget.order.id ?? '',
            lastName: _lastNameCtrl.text.trim(),
            firstName: _firstNameCtrl.text.trim(),
            phone: _phoneCtrl.text.trim(),
            residence: _residenceCtrl.text.trim(),
            deliveryLocation: _deliveryLocationCtrl.text.trim(),
            color: _colorCtrl.text.trim(),
            shoeSize: _shoeSizeCtrl.text.trim(),
            profession: _professionCtrl.text.trim(),
            cni: _cniCtrl.text.trim(),
            idFrontPhoto: _idFrontPhoto,
            idBackPhoto: _idBackPhoto,
            deliveryTime: _deliveryTime?.format(context),
          );
        } catch (_) {
          // Even if API fails, proceed to receipt (data was entered)
        }
        if (!mounted) return;
      }

      // Do NOT remove the order — delivery requested keeps it in history
      widget.onDeliveryConfirmed?.call();
      setState(() => _step = 'receipt');
      // Notify user that delivery details have been received
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          final isFr = LanguageService().isFrench;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              content: Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Colors.white, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.extended
                              ? (isFr
                                  ? 'Demande de livraison reçue!'
                                  : 'Delivery request received!')
                              : 'Delivery request received!',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.extended
                              ? (isFr
                                  ? 'Vos informations ont été enregistrées. Vous recevrez votre produit bientôt.'
                                  : 'Your information has been saved. You will receive your product soon.')
                              : 'Your details have been received. You will receive your product shortly.',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }
      });
    } else {
      setState(() => _pinError = lang.isFrench
          ? 'PIN incorrect. Veuillez réessayer.'
          : 'Incorrect PIN. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 32),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: _step == 'receipt'
            ? ReceiptView(
                order: widget.order,
                name: _fullName,
                phone: _phoneCtrl.text.trim(),
                profession: _professionCtrl.text.trim(),
                idFrontPhoto: _idFrontPhoto,
                idBackPhoto: _idBackPhoto,
                neighbourhood: widget.extended
                    ? _residenceCtrl.text.trim()
                    : _neighbourhoodCtrl.text.trim(),
                city: widget.extended
                    ? _deliveryLocationCtrl.text.trim()
                    : _cityCtrl.text.trim(),
                deliveryTime: _deliveryTime,
                color: _colorCtrl.text.trim(),
                shoeSize: _shoeSizeCtrl.text.trim(),
                cni: _cniCtrl.text.trim(),
                detailedFees: !widget.extended,
              )
            : _step == 'pin'
                ? _DeliveryPinStep(
                    pinCtrl: _pinCtrl,
                    pinError: _pinError,
                    name: _fullName,
                    phone: _phoneCtrl.text.trim(),
                    productName: widget.order.product.name,
                    onConfirm: _confirmPin,
                    onBack: () => setState(() {
                      _step = 'form';
                      _pinError = null;
                      _pinCtrl.clear();
                    }),
                    onChanged: (_) {
                      if (_pinError != null) setState(() => _pinError = null);
                    },
                  )
                : widget.extended
                    ? _ExtendedDeliveryForm(
                        formKey: _formKey,
                        lastNameCtrl: _lastNameCtrl,
                        firstNameCtrl: _firstNameCtrl,
                        phoneCtrl: _phoneCtrl,
                        residenceCtrl: _residenceCtrl,
                        deliveryLocationCtrl: _deliveryLocationCtrl,
                        colorCtrl: _colorCtrl,
                        shoeSizeCtrl: _shoeSizeCtrl,
                        professionCtrl: _professionCtrl,
                        cniCtrl: _cniCtrl,
                        idFrontPhoto: _idFrontPhoto,
                        idBackPhoto: _idBackPhoto,
                        onIdFrontCapture: () =>
                            setState(() => _idFrontPhoto = 'front_captured'),
                        onIdBackCapture: () =>
                            setState(() => _idBackPhoto = 'back_captured'),
                        deliveryTime: _deliveryTime,
                        allFilled: _allFilled,
                        onFieldChanged: () => setState(() {}),
                        onDeliveryTimePick: _pickDeliveryTime,
                        onSubmit: _submitForm,
                      )
                    : _SimpleDeliveryForm(
                        formKey: _formKey,
                        nameCtrl: _nameCtrl,
                        phoneCtrl: _phoneCtrl,
                        professionCtrl: _professionCtrl,
                        idFrontPhoto: _idFrontPhoto,
                        idBackPhoto: _idBackPhoto,
                        onIdFrontCapture: () =>
                            setState(() => _idFrontPhoto = 'front_captured'),
                        onIdBackCapture: () =>
                            setState(() => _idBackPhoto = 'back_captured'),
                        neighbourhoodCtrl: _neighbourhoodCtrl,
                        cityCtrl: _cityCtrl,
                        deliveryTime: _deliveryTime,
                        allFilled: _allFilled,
                        onFieldChanged: () => setState(() {}),
                        onDeliveryTimePick: _pickDeliveryTime,
                        onSubmit: _submitForm,
                      ),
      ),
    );
  }

  Future<void> _pickDeliveryTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _deliveryTime ?? TimeOfDay.now(),
      builder: (c, child) => Theme(
        data: Theme.of(c).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.primaryGreen,
            onPrimary: Colors.white,
            surface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _deliveryTime = picked);
  }
}

// ── Delivery form (simple — order detail variant) ──────────────────────────
class _SimpleDeliveryForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl,
      phoneCtrl,
      professionCtrl,
      neighbourhoodCtrl,
      cityCtrl;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final VoidCallback onIdFrontCapture;
  final VoidCallback onIdBackCapture;
  final TimeOfDay? deliveryTime;
  final bool allFilled;
  final VoidCallback onFieldChanged, onSubmit;
  final VoidCallback onDeliveryTimePick;

  const _SimpleDeliveryForm({
    required this.formKey,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.professionCtrl,
    required this.idFrontPhoto,
    required this.idBackPhoto,
    required this.onIdFrontCapture,
    required this.onIdBackCapture,
    required this.neighbourhoodCtrl,
    required this.cityCtrl,
    required this.deliveryTime,
    required this.allFilled,
    required this.onFieldChanged,
    required this.onDeliveryTimePick,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
              child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.local_shipping_outlined,
                  color: AppColors.primaryGreen, size: 22),
            ),
            const SizedBox(width: 12),
            Text(lang.deliveryInformation,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
          ]),
          const SizedBox(height: 6),
          Padding(
            padding: EdgeInsets.only(left: 54),
            child: Text(lang.confirmIdentityDeliveryDetails,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 22),

          // Full Name
          _fieldLabel('FULL NAME'),
          const SizedBox(height: 6),
          TextFormField(
            controller: nameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Full name',
                hintText: 'e.g. Jean-Paul Mbarga',
                prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Name is required' : null,
          ),
          const SizedBox(height: 14),

          // Phone Number
          _fieldLabel('PHONE NUMBER'),
          const SizedBox(height: 6),
          TextFormField(
            controller: phoneCtrl,
            keyboardType: TextInputType.phone,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Phone number',
              hintText: 'e.g. +237 6XX XXX XXX',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Phone number is required'
                : null,
          ),
          const SizedBox(height: 14),

          // Profession
          _fieldLabel('PROFESSION'),
          const SizedBox(height: 6),
          TextFormField(
            controller: professionCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Your profession',
              hintText: 'e.g. Engineer, Teacher, Trader…',
              prefixIcon: Icon(Icons.work_outline_rounded),
            ),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Profession is required' : null,
          ),
          const SizedBox(height: 18),

          // ID Card Photos (optional)
          Row(children: [
            const Icon(Icons.badge_outlined,
                size: 16, color: AppColors.primaryGreen),
            const SizedBox(width: 6),
            const Text('ID CARD PHOTOS',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('OPTIONAL',
                  style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryGreen,
                      letterSpacing: 0.5)),
            ),
          ]),
          const SizedBox(height: 8),
          const Text(
            'Attach a photo of your national ID card (front and back). This helps us verify your identity faster.',
            style: TextStyle(
                fontSize: 12, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: GestureDetector(
                onTap: onIdFrontCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idFrontPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idFrontPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idFrontPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idFrontPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idFrontPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idFrontPhoto != null
                            ? 'Front captured ✓'
                            : 'Tap to capture\nFRONT side',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idFrontPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: onIdBackCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idBackPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idBackPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idBackPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idBackPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idBackPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idBackPhoto != null
                            ? 'Back captured ✓'
                            : 'Tap to capture\nBACK side',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idBackPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),

          // Neighbourhood
          _fieldLabel('NEIGHBOURHOOD'),
          const SizedBox(height: 6),
          TextFormField(
            controller: neighbourhoodCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Neighbourhood',
                hintText: 'e.g. Bastos, Nlongkak…',
                prefixIcon: Icon(Icons.location_city_outlined)),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Neighbourhood is required'
                : null,
          ),
          const SizedBox(height: 14),

          // City
          _fieldLabel('CITY'),
          const SizedBox(height: 6),
          TextFormField(
            controller: cityCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'City',
                hintText: 'e.g. Yaoundé, Douala…',
                prefixIcon: Icon(Icons.location_on_outlined)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'City is required' : null,
          ),
          const SizedBox(height: 14),

          // Delivery Time
          _fieldLabel('DELIVERY TIME'),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: onDeliveryTimePick,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: deliveryTime != null
                      ? AppColors.primaryGreen
                      : const Color(0xFFD0E8E5),
                  width: deliveryTime != null ? 2 : 1,
                ),
              ),
              child: Row(children: [
                const Icon(Icons.access_time_rounded,
                    color: AppColors.primaryGreen, size: 20),
                const SizedBox(width: 12),
                Expanded(
                    child: Text(
                  deliveryTime != null
                      ? 'Delivery at ${deliveryTime!.format(context)}'
                      : 'Select delivery time',
                  style: TextStyle(
                      fontSize: 14,
                      color: deliveryTime != null
                          ? AppColors.textPrimary
                          : AppColors.textMuted),
                )),
                Icon(Icons.keyboard_arrow_down_rounded,
                    color: deliveryTime != null
                        ? AppColors.primaryGreen
                        : AppColors.textMuted),
              ]),
            ),
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            onPressed: allFilled ? onSubmit : null,
            icon: const Icon(Icons.lock_outline_rounded, size: 18),
            label: Text(lang.continueToPIN),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(text,
      style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1));
}

// ── Delivery form (extended — history variant) ─────────────────────────────
class _ExtendedDeliveryForm extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController lastNameCtrl,
      firstNameCtrl,
      phoneCtrl,
      residenceCtrl,
      deliveryLocationCtrl,
      colorCtrl,
      shoeSizeCtrl,
      professionCtrl,
      cniCtrl;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final VoidCallback onIdFrontCapture;
  final VoidCallback onIdBackCapture;
  final TimeOfDay? deliveryTime;
  final bool allFilled;
  final VoidCallback onFieldChanged, onSubmit;
  final VoidCallback onDeliveryTimePick;

  const _ExtendedDeliveryForm({
    required this.formKey,
    required this.lastNameCtrl,
    required this.firstNameCtrl,
    required this.phoneCtrl,
    required this.residenceCtrl,
    required this.deliveryLocationCtrl,
    required this.colorCtrl,
    required this.shoeSizeCtrl,
    required this.professionCtrl,
    required this.cniCtrl,
    required this.idFrontPhoto,
    required this.idBackPhoto,
    required this.onIdFrontCapture,
    required this.onIdBackCapture,
    required this.deliveryTime,
    required this.allFilled,
    required this.onFieldChanged,
    required this.onDeliveryTimePick,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
              child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.local_shipping_outlined,
                  color: AppColors.primaryGreen, size: 22),
            ),
            const SizedBox(width: 12),
            Text(lang.deliveryInformation,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
          ]),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 54),
            child: Text(
                lang.isFrench
                    ? 'Confirmez vos informations de livraison.'
                    : 'Confirm your delivery information.',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 22),

          // Nom (Last Name)
          _fieldLabel('NOM'),
          const SizedBox(height: 6),
          TextFormField(
            controller: lastNameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Nom',
                hintText: 'e.g. Mbarga',
                prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Le nom est requis' : null,
          ),
          const SizedBox(height: 14),

          // Prénom (First Name)
          _fieldLabel('PRÉNOM'),
          const SizedBox(height: 6),
          TextFormField(
            controller: firstNameCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Prénom',
                hintText: 'e.g. Jean-Paul',
                prefixIcon: Icon(Icons.person_outline_rounded)),
            validator: (v) =>
                v == null || v.trim().isEmpty ? 'Le prénom est requis' : null,
          ),
          const SizedBox(height: 14),

          // Tel (Phone Number)
          _fieldLabel('TEL'),
          const SizedBox(height: 6),
          TextFormField(
            controller: phoneCtrl,
            keyboardType: TextInputType.phone,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Téléphone',
              hintText: 'e.g. +237 6XX XXX XXX',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le numéro de téléphone est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Lieu résidence
          _fieldLabel('LIEU RÉSIDENCE'),
          const SizedBox(height: 6),
          TextFormField(
            controller: residenceCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Lieu de résidence',
                hintText: 'e.g. Bastos, Yaoundé',
                prefixIcon: Icon(Icons.home_outlined)),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le lieu de résidence est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Lieu livraison
          _fieldLabel('LIEU LIVRAISON'),
          const SizedBox(height: 6),
          TextFormField(
            controller: deliveryLocationCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
                labelText: 'Lieu de livraison',
                hintText: 'e.g. Carrefour Nlongkak',
                prefixIcon: Icon(Icons.location_on_outlined)),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le lieu de livraison est requis'
                : null,
          ),
          const SizedBox(height: 14),

          // Couleur
          _fieldLabel('COULEUR'),
          const SizedBox(height: 6),
          TextFormField(
            controller: colorCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Couleur souhaitée',
              hintText: 'e.g. Noir, Blanc, Rouge…',
              prefixIcon: Icon(Icons.color_lens_outlined),
            ),
          ),
          const SizedBox(height: 14),

          // Pointure
          _fieldLabel('POINTURE'),
          const SizedBox(height: 6),
          TextFormField(
            controller: shoeSizeCtrl,
            keyboardType: TextInputType.number,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Pointure',
              hintText: 'e.g. 42, 38…',
              prefixIcon: Icon(Icons.straighten_outlined),
            ),
          ),
          const SizedBox(height: 14),

          // Profession
          _fieldLabel('PROFESSION'),
          const SizedBox(height: 6),
          TextFormField(
            controller: professionCtrl,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Profession',
              hintText: 'e.g. Ingénieur, Enseignant, Commerçant…',
              prefixIcon: Icon(Icons.work_outline_rounded),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'La profession est requise'
                : null,
          ),
          const SizedBox(height: 14),

          // CNI
          _fieldLabel('CNI'),
          const SizedBox(height: 6),
          TextFormField(
            controller: cniCtrl,
            onChanged: (_) => onFieldChanged(),
            decoration: const InputDecoration(
              labelText: 'Numéro CNI',
              hintText: 'e.g. 123456789',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Le numéro CNI est requis'
                : null,
          ),
          const SizedBox(height: 18),

          // ID Card Photos (optional)
          Row(children: [
            const Icon(Icons.badge_outlined,
                size: 16, color: AppColors.primaryGreen),
            const SizedBox(width: 6),
            Text(lang.isFrench ? 'PHOTO CNI' : 'ID PHOTO',
                style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 1)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(lang.isFrench ? 'OPTIONNEL' : 'OPTIONAL',
                  style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryGreen,
                      letterSpacing: 0.5)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            lang.isFrench
                ? 'Joindre une photo de votre carte nationale d\'identité (recto et verso).'
                : 'Attach a photo of your national ID card (front and back).',
            style: const TextStyle(
                fontSize: 12, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: GestureDetector(
                onTap: onIdFrontCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idFrontPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idFrontPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idFrontPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idFrontPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idFrontPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idFrontPhoto != null
                            ? 'Recto capturé ✓'
                            : 'Capturer\nRECTO',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idFrontPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: onIdBackCapture,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 100,
                  decoration: BoxDecoration(
                    color: idBackPhoto != null
                        ? AppColors.primaryGreen.withOpacity(0.08)
                        : AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: idBackPhoto != null
                          ? AppColors.primaryGreen
                          : const Color(0xFFD0E8E5),
                      width: idBackPhoto != null ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        idBackPhoto != null
                            ? Icons.check_circle_rounded
                            : Icons.camera_alt_outlined,
                        color: idBackPhoto != null
                            ? AppColors.primaryGreen
                            : AppColors.textMuted,
                        size: 28,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        idBackPhoto != null
                            ? 'Verso capturé ✓'
                            : 'Capturer\nVERSO',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: idBackPhoto != null
                              ? AppColors.primaryGreen
                              : AppColors.textMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),

          // Delivery Time
          _fieldLabel('HEURE DE LIVRAISON'),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: onDeliveryTimePick,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: deliveryTime != null
                      ? AppColors.primaryGreen
                      : const Color(0xFFD0E8E5),
                  width: deliveryTime != null ? 2 : 1,
                ),
              ),
              child: Row(children: [
                const Icon(Icons.access_time_rounded,
                    color: AppColors.primaryGreen, size: 20),
                const SizedBox(width: 12),
                Expanded(
                    child: Text(
                  deliveryTime != null
                      ? 'Livraison à ${deliveryTime!.format(context)}'
                      : 'Sélectionner l\'heure de livraison',
                  style: TextStyle(
                      fontSize: 14,
                      color: deliveryTime != null
                          ? AppColors.textPrimary
                          : AppColors.textMuted),
                )),
                Icon(Icons.keyboard_arrow_down_rounded,
                    color: deliveryTime != null
                        ? AppColors.primaryGreen
                        : AppColors.textMuted),
              ]),
            ),
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            onPressed: allFilled ? onSubmit : null,
            icon: const Icon(Icons.lock_outline_rounded, size: 18),
            label: Text(lang.continueToPIN),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(text,
      style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1));
}

// ── Delivery PIN step ──────────────────────────────────────────────────────
class _DeliveryPinStep extends StatelessWidget {
  final TextEditingController pinCtrl;
  final String? pinError;
  final String name, phone, productName;
  final VoidCallback onConfirm, onBack;
  final ValueChanged<String> onChanged;

  const _DeliveryPinStep({
    required this.pinCtrl,
    required this.pinError,
    required this.name,
    required this.phone,
    required this.productName,
    required this.onConfirm,
    required this.onBack,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
            child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 20),
        Text(lang.confirmDeliveryBtn,
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text(lang.confirmDeliveryPINDesc,
            style: TextStyle(
                fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
        const SizedBox(height: 20),

        // Summary tile
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: AppColors.offWhite,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.divider)),
          child: Column(children: [
            _summaryRow(Icons.person_outline_rounded, 'Recipient', name),
            const SizedBox(height: 8),
            _summaryRow(Icons.phone_outlined, 'Phone', phone),
            const SizedBox(height: 8),
            _summaryRow(Icons.inventory_2_outlined, 'Product', productName),
          ]),
        ),
        const SizedBox(height: 20),

        TextField(
          controller: pinCtrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 4,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            labelText: '4-digit PIN',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            counterText: '',
            errorText: pinError,
          ),
          onChanged: onChanged,
        ),
        const SizedBox(height: 6),

        const SizedBox(height: 20),

        Row(children: [
          Expanded(
              child: OutlinedButton(
            onPressed: onBack,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 50),
              side: const BorderSide(color: AppColors.divider),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(lang.back,
                style: TextStyle(color: AppColors.textSecondary)),
          )),
          const SizedBox(width: 12),
          Expanded(
              child: ElevatedButton(
            onPressed: onConfirm,
            style: ElevatedButton.styleFrom(minimumSize: const Size(0, 50)),
            child: Text(lang.confirmDeliveryBtn),
          )),
        ]),
      ],
    );
  }

  Widget _summaryRow(IconData icon, String label, String value) {
    return Row(children: [
      Icon(icon, size: 16, color: AppColors.primaryGreen),
      const SizedBox(width: 10),
      Text('$label: ',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      Expanded(
          child: Text(value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary))),
    ]);
  }
}

// ── Receipt view ───────────────────────────────────────────────────────────
class ReceiptView extends StatelessWidget {
  final ConfirmedOrder order;
  final String name, phone, profession, neighbourhood, city;
  final String? idFrontPhoto;
  final String? idBackPhoto;
  final TimeOfDay? deliveryTime;
  final String color;
  final String shoeSize;
  final String cni;

  /// true → itemised fee breakdown (account/delivery/collection/stocking fees)
  /// with English labels (order detail variant).
  /// false → simpler localised receipt used by the history screen, which also
  /// shows colour / shoe size / CNI rows.
  final bool detailedFees;

  const ReceiptView(
      {super.key,
      required this.order,
      required this.name,
      required this.phone,
      required this.profession,
      required this.idFrontPhoto,
      required this.idBackPhoto,
      required this.neighbourhood,
      required this.city,
      required this.deliveryTime,
      this.color = '',
      this.shoeSize = '',
      this.cni = '',
      this.detailedFees = true});

  String get _receiptId {
    final rand = Random(order.orderNumber.hashCode);
    return 'RCP-${rand.nextInt(900000) + 100000}';
  }

  String _monthName(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m - 1];

  String get _today {
    final d = DateTime.now();
    return '${d.day} ${_monthName(d.month)} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final totalPaid = order.totalAmountPaid;
    final grandTotal =
        detailedFees ? order.grandTotal : order.basePrice + order.fee;
    final remaining = grandTotal - totalPaid;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
            child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 20),

        // ── Delivery confirmation banner ──────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            color: AppColors.primaryGreen.withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.primaryGreen.withOpacity(0.3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.local_shipping_rounded,
                    color: AppColors.primaryGreen, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detailedFees
                          ? 'Your details have been received!'
                          : (lang.isFrench
                              ? 'Vos informations ont été reçues !'
                              : 'Your details have been received!'),
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryGreen),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      detailedFees
                          ? 'Thank you! Your delivery request is confirmed. You will receive your product shortly.'
                          : (lang.isFrench
                              ? 'Merci ! Votre demande de livraison est confirmée. Vous recevrez votre produit sous peu.'
                              : 'Thank you! Your delivery request is confirmed. You will receive your product shortly.'),
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        Row(children: [
          Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.receipt_long_rounded,
                  color: AppColors.primaryGreen, size: 24)),
          const SizedBox(width: 14),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.deliveryReceipt,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            Text(_receiptId,
                style:
                    const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ]),
        ]),
        const SizedBox(height: 20),

        Container(
          decoration: BoxDecoration(
              color: AppColors.offWhite,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider)),
          child: Column(children: [
            if (detailedFees)
              _section('CUSTOMER DETAILS', [
                _rRow('Full Name', name),
                _rRow('Phone', phone),
                _rRow('Profession', profession),
                _rRow('ID Front',
                    idFrontPhoto != null ? '✓ Photo captured' : 'Not provided'),
                _rRow('ID Back',
                    idBackPhoto != null ? '✓ Photo captured' : 'Not provided'),
                _rRow('Neighbourhood', neighbourhood),
                _rRow('City', city),
                _rRow('Delivery Time',
                    deliveryTime != null ? deliveryTime!.format(context) : '—'),
              ])
            else
              _section(
                  lang.isFrench ? 'INFORMATIONS CLIENT' : 'CLIENT INFORMATION',
                  [
                    _rRow(lang.isFrench ? 'Nom & Prénom' : 'Full Name', name),
                    _rRow(lang.isFrench ? 'Tél' : 'Phone', phone),
                    _rRow(lang.isFrench ? 'Lieu résidence' : 'Residence',
                        neighbourhood),
                    _rRow(
                        lang.isFrench
                            ? 'Lieu livraison'
                            : 'Delivery Location',
                        city),
                    if (color.isNotEmpty)
                      _rRow(lang.isFrench ? 'Couleur' : 'Color', color),
                    if (shoeSize.isNotEmpty)
                      _rRow(lang.isFrench ? 'Pointure' : 'Shoe Size', shoeSize),
                    _rRow('Profession', profession),
                    _rRow(lang.isFrench ? 'CNI' : 'ID Number',
                        cni.isNotEmpty ? cni : '—'),
                    _rRow(
                        lang.isFrench ? 'Photo CNI Recto' : 'ID Photo Front',
                        idFrontPhoto != null
                            ? (lang.isFrench ? '✓ Capturé' : '✓ Captured')
                            : (lang.isFrench ? 'Non fourni' : 'Not provided')),
                    _rRow(
                        lang.isFrench ? 'Photo CNI Verso' : 'ID Photo Back',
                        idBackPhoto != null
                            ? (lang.isFrench ? '✓ Capturé' : '✓ Captured')
                            : (lang.isFrench ? 'Non fourni' : 'Not provided')),
                    _rRow(
                        lang.isFrench ? 'Heure livraison' : 'Delivery Time',
                        deliveryTime != null
                            ? deliveryTime!.format(context)
                            : '—'),
                  ]),
            const Divider(height: 1, color: AppColors.divider),
            if (detailedFees)
              _section('ORDER DETAILS', [
                _rRow('Order #', order.orderNumber),
                _rRow('Product', order.product.name),
                _rRow('Category', order.product.category),
                _rRow('Request Date', _today),
              ])
            else
              _section(lang.isFrench ? 'DÉTAILS COMMANDE' : 'ORDER DETAILS', [
                _rRow(
                    lang.isFrench ? 'Commande #' : 'Order #', order.orderNumber),
                _rRow(lang.isFrench ? 'Produit' : 'Product', order.product.name),
                _rRow(lang.isFrench ? 'Catégorie' : 'Category',
                    order.product.category),
                _rRow(lang.isFrench ? 'Date demande' : 'Request Date', _today),
              ]),
            const Divider(height: 1, color: AppColors.divider),
            if (detailedFees)
              _section('PRICING BREAKDOWN', [
                _rRow('Base Price', fmtAmount(order.basePrice)),
                if (order.accountCreationFee > 0)
                  _rRow('Account Creation Fee',
                      '+ ${fmtAmount(order.accountCreationFee)}'),
                _rRow('Delivery Fee', '+ ${fmtAmount(order.deliveryFee)}'),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text('Collection Fee',
                              style: TextStyle(
                                  fontSize: 13, color: AppColors.textSecondary)),
                          const SizedBox(width: 8),
                          Transform.scale(
                            scale: 0.7,
                            child: Switch(
                              value: order.isCollectionFeeEnabled,
                              onChanged: (value) {
                                order.toggleCollectionFee(value);
                              },
                              activeColor: AppColors.primaryGreen,
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        '${order.isCollectionFeeEnabled ? '+' : ''} ${fmtAmount(order.collectionFee)}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: order.isCollectionFeeEnabled
                              ? AppColors.textPrimary
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                _rRow('Stocking Fee', '+ ${fmtAmount(order.stockingFee)}'),
                const Divider(height: 12, color: AppColors.divider),
                _rRow('Total Fees', fmtAmount(order.totalFees)),
                _rRow('Payment Plan', order.planDurationLabel),
                _rRow('Frequency', order.paymentFrequency),
                _rRow('Contributions Made',
                    '${order.paidInstallments.length}/${order.totalInstallments}'),
                _rRow('Accumulated Funds', fmtAmount(order.accumulatedFunds)),
                if (remaining > 0) _rRow('Remaining', fmtAmount(remaining)),
              ])
            else
              _section(
                  lang.isFrench ? 'DÉTAIL DES PRIX' : 'PRICING BREAKDOWN', [
                    _rRow(lang.isFrench ? 'Prix de base' : 'Base Price',
                        fmtAmount(order.basePrice)),
                    _rRow(lang.isFrench ? 'Frais de service' : 'Service Fee',
                        fmtAmount(order.fee)),
                    _rRow(lang.isFrench ? 'Plan de paiement' : 'Payment Plan',
                        order.planDurationLabel),
                    _rRow(lang.isFrench ? 'Fréquence' : 'Frequency',
                        order.paymentFrequency),
                    _rRow(
                        lang.isFrench
                            ? 'Contributions effectuées'
                            : 'Contributions Made',
                        '${order.paidInstallments.length}/${order.totalInstallments}'),
                    _rRow(lang.isFrench ? 'Fonds accumulés' : 'Accumulated Funds',
                        fmtAmount(order.accumulatedFunds)),
                    if (remaining > 0)
                      _rRow(lang.isFrench ? 'Restant' : 'Remaining',
                          fmtAmount(remaining)),
                  ]),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.08),
                borderRadius:
                    const BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(lang.totalOrderValue,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary,
                            letterSpacing: 0.5)),
                    Text(fmtAmount(grandTotal),
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryGreen)),
                  ]),
            ),
          ]),
        ),

        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              content: Row(children: [
                Icon(Icons.download_done_rounded,
                    color: Colors.white, size: 20),
                SizedBox(width: 10),
                Text(lang.receiptDownloaded,
                    style: TextStyle(
                        fontWeight: FontWeight.w600, color: Colors.white)),
              ]),
            ));
          },
          icon: const Icon(Icons.download_rounded, size: 20),
          label: Text(lang.downloadReceipt),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(lang.close,
              style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
        ),
      ],
    );
  }

  Widget _section(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
                letterSpacing: 1)),
        const SizedBox(height: 10),
        ...rows,
      ]),
    );
  }

  Widget _rRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 130,
            child: Text(label,
                style:
                    const TextStyle(fontSize: 13, color: AppColors.textMuted))),
        Expanded(
            child: Text(value,
                textAlign: TextAlign.end,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary))),
      ]),
    );
  }
}

// ── WatSim Transfer Sheet ────────────────────────────────────────────────────
class WatSimTransferSheet extends StatefulWidget {
  final ConfirmedOrder sourceOrder;
  final VoidCallback onTransferred;

  const WatSimTransferSheet({
    super.key,
    required this.sourceOrder,
    required this.onTransferred,
  });

  @override
  State<WatSimTransferSheet> createState() => _WatSimTransferSheetState();
}

class _WatSimTransferSheetState extends State<WatSimTransferSheet> {
  // 0 = phone entry  |  1 = PIN confirm  |  2 = success
  int _step = 0;

  final _phoneCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  String? _phoneError;
  String? _pinError;
  bool _unverified = false;
  bool _isVerifying = false;
  bool _busy = false;

  int get _accumulated => widget.sourceOrder.totalAmountPaid;
  int get _deduction => (_accumulated * 0.20).round();
  int get _netAmount => _accumulated - _deduction;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirmTransfer() async {
    final lang = LanguageProvider.of(context);
    if (_pinCtrl.text.trim().isEmpty) {
      setState(() => _pinError = lang.isFrench
          ? 'Veuillez entrer votre PIN.'
          : 'Please enter your PIN.');
      return;
    }
    if (widget.sourceOrder.id == null) {
      setState(() => _pinError = 'Order is not linked to a backend purchase.');
      return;
    }
    setState(() {
      _pinError = null;
      _busy = true;
    });

    // Verify the transaction PIN against the backend login PIN
    final pinValid =
        await ApiService.verifyTransactionPin(_pinCtrl.text.trim());
    if (!pinValid) {
      if (mounted) {
        setState(() {
          _pinError = lang.isFrench
              ? 'PIN incorrect. Veuillez réessayer.'
              : 'Incorrect PIN. Please try again.';
          _busy = false;
        });
      }
      return;
    }

    try {
      final result = await ApiService.transferContribution(
        purchaseId: widget.sourceOrder.id!,
        recipientIdentifier: _phoneCtrl.text.trim(),
      );
      await WalletState.instance.syncWithBackend();
      OrderState.instance.removeOrder(widget.sourceOrder.orderNumber);
      NotificationState.instance.onProductTransferApplied(
        fromProduct: widget.sourceOrder.product.name,
        toProduct: _phoneCtrl.text.trim(),
        transferred: (result['net'] as num?)?.toInt() ?? _netAmount,
        completed: false,
      );
      if (mounted) setState(() => _step = 2);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _pinError = e.message;
          _busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pinError = lang.isFrench
              ? 'Échec du transfert. Réessayez.'
              : 'Transfer failed. Please try again.';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);

    // ── drag handle ──────────────────────────────────────────────────────────
    final handle = Center(
      child: Container(
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: const Color(0xFFD0D0D0),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );

    // ── funds breakdown card ─────────────────────────────────────────────────
    Widget fundsCard() => Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF607D8B).withOpacity(0.06),
            borderRadius: BorderRadius.circular(14),
            border:
                Border.all(color: const Color(0xFF607D8B).withOpacity(0.20)),
          ),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.accumulatedFundsLabel,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(fmtAmount(_accumulated),
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF607D8B))),
            ]),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.serviceFee20,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text('− ${fmtAmount(_deduction)}',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFE53935))),
            ]),
            const Divider(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(lang.recipientReceives,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600)),
              Text(fmtAmount(_netAmount),
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryGreen)),
            ]),
          ]),
        );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 0 – phone number entry
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildPhoneStep() => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            handle,
            const SizedBox(height: 20),
            Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF607D8B).withOpacity(0.10),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.phone_android_rounded,
                    color: Color(0xFF607D8B), size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.transferToWatsim,
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  SizedBox(height: 2),
                  Text(lang.sendAccumulatedFunds,
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                ],
              )),
            ]),
            const SizedBox(height: 18),
            fundsCard(),
            const SizedBox(height: 18),
            if (_accumulated == 0)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFFB74D)),
                ),
                child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded,
                          color: Color(0xFFF57C00), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                          child: Text(
                        'No payments made yet. Make at least one instalment before transferring.',
                        style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFFF57C00),
                            height: 1.4),
                      )),
                    ]),
              )
            else ...[
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                maxLength: 15,
                decoration: InputDecoration(
                  labelText: 'Recipient phone number',
                  hintText: 'e.g. 655000001',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  counterText: '',
                  errorText: _phoneError,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onChanged: (_) {
                  if (_phoneError != null || _unverified) {
                    setState(() {
                      _phoneError = null;
                      _unverified = false;
                    });
                  }
                },
              ),
              const SizedBox(height: 6),
              Text(
                lang.isFrench
                    ? 'Le destinataire doit avoir un compte WatSim actif.'
                    : 'Recipient must have an active WatSim account.',
                style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontStyle: FontStyle.italic),
              ),
              if (_unverified) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEF9A9A)),
                  ),
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            color: Color(0xFFE53935), size: 22),
                        SizedBox(width: 10),
                        Expanded(
                            child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(lang.noWatsimAccount,
                                style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFFB71C1C))),
                            SizedBox(height: 4),
                            Text(
                              'This number does not have a verified WatSim account. '
                              'Check the number or ask the recipient to register on WatSim.',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFFE53935),
                                  height: 1.4),
                            ),
                          ],
                        )),
                      ]),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: Text(lang.continueLabel2),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF607D8B),
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isVerifying
                      ? null
                      : () async {
                          final phone = _phoneCtrl.text
                              .trim()
                              .replaceAll(RegExp(r'[\s\-]'), '');
                          if (phone.isEmpty) {
                            setState(() =>
                                _phoneError = 'Please enter a phone number.');
                            return;
                          }
                          if (phone.length < 8) {
                            setState(() =>
                                _phoneError = 'Enter a valid phone number.');
                            return;
                          }
                          setState(() => _isVerifying = true);
                          try {
                            final result =
                                await ApiService.searchUser(phone);
                            if (!mounted) return;
                            if (result == null) {
                              setState(() {
                                _phoneError = null;
                                _unverified = true;
                              });
                              return;
                            }
                            setState(() {
                              _unverified = false;
                              _phoneError = null;
                              _step = 1;
                            });
                          } catch (_) {
                            if (!mounted) return;
                            setState(() {
                              _phoneError = null;
                              _unverified = true;
                            });
                          } finally {
                            if (mounted) {
                              setState(() => _isVerifying = false);
                            }
                          }
                        },
                ),
              ),
            ],
          ],
        );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 – PIN confirmation
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildPinStep() => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            handle,
            const SizedBox(height: 20),

            Text(lang.confirmTransfer,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            Text(
              'Enter your 4-digit PIN to send ${fmtAmount(_netAmount)} '
              'to ${_phoneCtrl.text.trim()}.',
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 20),

            // Summary card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.divider),
              ),
              child: Column(children: [
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.fromLabel,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(widget.sourceOrder.product.name,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                    ]),
                const SizedBox(height: 8),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.toWatsim,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(_phoneCtrl.text.trim(),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                    ]),
                const Divider(height: 16),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.grossAmount,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(fmtAmount(_accumulated),
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary)),
                    ]),
                const SizedBox(height: 6),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.serviceFee20,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text('− ${fmtAmount(_deduction)}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFE53935))),
                    ]),
                const Divider(height: 12),
                Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(lang.recipientReceives,
                          style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600)),
                      Text(fmtAmount(_netAmount),
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primaryGreen)),
                    ]),
              ]),
            ),
            const SizedBox(height: 20),

            TextField(
              controller: _pinCtrl,
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 4,
              decoration: InputDecoration(
                labelText: '4-digit PIN',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                counterText: '',
                errorText: _pinError,
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: (_) {
                if (_pinError != null) setState(() => _pinError = null);
              },
            ),
            const SizedBox(height: 6),
            Text(
              lang.isFrench
                  ? 'Votre PIN de connexion est requis.'
                  : 'Your login PIN is required.',
              style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 20),

            Row(children: [
              Expanded(
                  child: OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                          _step = 0;
                          _pinCtrl.clear();
                          _pinError = null;
                        }),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 50),
                  side: const BorderSide(color: AppColors.divider),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(lang.back,
                    style: const TextStyle(color: AppColors.textSecondary)),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: ElevatedButton(
                onPressed: _busy ? null : _confirmTransfer,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(0, 50),
                  backgroundColor: const Color(0xFF607D8B),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(lang.confirmTransfer),
              )),
            ]),
          ],
        );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 – success
    // ═══════════════════════════════════════════════════════════════════════
    Widget buildSuccessStep() => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            handle,
            const SizedBox(height: 24),
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withOpacity(0.10),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  size: 44, color: AppColors.primaryGreen),
            ),
            const SizedBox(height: 16),
            Text(lang.transferSuccessful,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            Text(
              '${fmtAmount(_netAmount)} has been sent to\n'
              '${_phoneCtrl.text.trim()}\'s WatSim wallet.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFFB74D)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFFF57C00), size: 18),
                const SizedBox(width: 10),
                Flexible(
                    child: Text(
                  '20% service fee of ${fmtAmount(_deduction)} was deducted '
                  'from your accumulated funds.',
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFFF57C00), height: 1.4),
                )),
              ]),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context); // close sheet
                  widget.onTransferred(); // pop detail screen
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryGreen,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(lang.done),
              ),
            ),
          ],
        );

    return Container(
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: _step == 0
            ? buildPhoneStep()
            : _step == 1
                ? buildPinStep()
                : buildSuccessStep(),
      ),
    );
  }
}

// ── Withdraw sheet ─────────────────────────────────────────────────────────
class WithdrawSheet extends StatefulWidget {
  final ConfirmedOrder order;
  final VoidCallback onWithdrawn;

  const WithdrawSheet({super.key, required this.order, required this.onWithdrawn});

  @override
  State<WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends State<WithdrawSheet> {
  bool _showPin = false;
  bool _done = false;
  bool _busy = false;
  final _pinCtrl = TextEditingController();
  String? _pinError;

  static const double _chargeRate = 0.30;

  int get _accumulated => widget.order.totalAmountPaid;

  int get _charge => (_accumulated * _chargeRate).round();
  int get _netAmount => _accumulated - _charge;

  Future<void> _confirm() async {
    final lang = LanguageProvider.of(context);
    if (_pinCtrl.text.trim().isEmpty) {
      setState(() => _pinError = lang.isFrench
          ? 'Veuillez entrer votre PIN.'
          : 'Please enter your PIN.');
      return;
    }
    if (widget.order.id == null) {
      setState(() => _pinError = 'Order is not linked to a backend purchase.');
      return;
    }
    setState(() {
      _pinError = null;
      _busy = true;
    });

    // Verify the transaction PIN against the backend login PIN
    final pinValid =
        await ApiService.verifyTransactionPin(_pinCtrl.text.trim());
    if (!pinValid) {
      if (mounted) {
        setState(() {
          _pinError = lang.isFrench
              ? 'PIN incorrect. Veuillez réessayer.'
              : 'Incorrect PIN. Please try again.';
          _busy = false;
        });
      }
      return;
    }

    try {
      final result = await ApiService.withdrawContribution(
        purchaseId: widget.order.id!,
      );
      await WalletState.instance.syncWithBackend();
      OrderState.instance.removeOrder(widget.order.orderNumber);
      final net = (result['refund'] as num?)?.toInt() ?? _netAmount;
      NotificationState.instance.addGenericNotification(
        'Withdrawal Processed',
        '${fmtAmount(net)} credited to your wallet after 30% charge (${fmtAmount(_charge)}) on ${widget.order.product.name}.',
      );
      if (mounted) setState(() => _done = true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _pinError = e.message;
          _busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pinError = lang.isFrench
              ? 'Échec du retrait. Réessayez.'
              : 'Withdrawal failed. Please try again.';
          _busy = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 32),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            if (_done) ...[
              Center(
                child: Column(children: [
                  Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                          color: const Color(0xFFF57C00).withOpacity(0.1),
                          shape: BoxShape.circle),
                      child: const Icon(Icons.account_balance_wallet_outlined,
                          size: 36, color: const Color(0xFFF57C00))),
                  const SizedBox(height: 16),
                  Text(lang.withdrawalSuccessful,
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  Text(
                    '${fmtAmount(_netAmount)} has been added to your wallet.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5),
                  ),
                  const SizedBox(height: 8),
                  Text('New balance: ${WalletState.instance.balanceFormatted}',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryGreen)),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: widget.onWithdrawn,
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF57C00)),
                    child: Text(lang.done),
                  ),
                ]),
              ),
            ] else if (_showPin) ...[
              Text(lang.confirmWithdrawal,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              Text(
                lang.isFrench
                    ? 'Entrez votre PIN de connexion à 4 chiffres pour confirmer le retrait.'
                    : 'Enter your 4-digit login PIN to confirm the withdrawal.',
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  _summaryRow('Accumulated', fmtAmount(_accumulated),
                      color: AppColors.textPrimary),
                  const SizedBox(height: 8),
                  _summaryRow('30% Charge', '- ${fmtAmount(_charge)}',
                      color: const Color(0xFFF57C00)),
                  const Divider(height: 16),
                  _summaryRow('You Receive', fmtAmount(_netAmount),
                      color: AppColors.primaryGreen, bold: true),
                ]),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _pinCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                    labelText: '4-digit PIN',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    counterText: '',
                    errorText: _pinError),
                onChanged: (_) {
                  if (_pinError != null) setState(() => _pinError = null);
                },
              ),
              const SizedBox(height: 6),
              Text(
                lang.isFrench
                    ? 'Votre PIN de connexion est requis.'
                    : 'Your login PIN is required.',
                style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(
                    child: OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _showPin = false;
                            _pinCtrl.clear();
                            _pinError = null;
                          }),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50),
                      side: const BorderSide(color: AppColors.divider),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                  child: Text(lang.back,
                      style: TextStyle(color: AppColors.textSecondary)),
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: ElevatedButton(
                  onPressed: _busy ? null : _confirm,
                  style: ElevatedButton.styleFrom(
                      minimumSize: const Size(0, 50),
                      backgroundColor: const Color(0xFFF57C00)),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(lang.confirmWithdrawal),
                )),
              ]),
            ] else ...[
              Text(lang.withdrawFunds,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              const Text(
                  'Withdraw the money accumulated on this product. A 30% processing charge applies.',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4)),
              const SizedBox(height: 20),

              // Warning banner
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                    color: const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFB74D))),
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.warning_amber_rounded,
                          color: Color(0xFFF57C00), size: 20),
                      const SizedBox(width: 10),
                      const Expanded(
                          child: Text(
                        '30% of accumulated funds will be deducted as a processing charge.',
                        style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFFF57C00),
                            height: 1.4),
                      )),
                    ]),
              ),
              const SizedBox(height: 20),

              // Breakdown card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  _summaryRow('Instalments Paid',
                      '${widget.order.paidInstallments.length}/${widget.order.totalInstallments}',
                      color: AppColors.textSecondary),
                  const SizedBox(height: 10),
                  _summaryRow('Accumulated Amount', fmtAmount(_accumulated),
                      color: AppColors.textPrimary),
                  const SizedBox(height: 10),
                  _summaryRow('30% Processing Charge', '− ${fmtAmount(_charge)}',
                      color: const Color(0xFFF57C00)),
                  const Divider(height: 20),
                  _summaryRow('Amount You Receive', fmtAmount(_netAmount),
                      color: AppColors.primaryGreen, bold: true, large: true),
                ]),
              ),
              const SizedBox(height: 24),

              ElevatedButton.icon(
                onPressed: _accumulated > 0
                    ? () => setState(() => _showPin = true)
                    : null,
                icon: const Icon(Icons.lock_outline_rounded, size: 18),
                label: Text(lang.continueToPIN),
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF57C00)),
              ),
              if (_accumulated == 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFB74D))),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Icon(Icons.info_outline_rounded,
                          color: Color(0xFFF57C00), size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'No payments have been made yet. Make at least one instalment to enable withdrawal.',
                          style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFFF57C00),
                              height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value,
      {Color? color, bool bold = false, bool large = false}) {
    return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label,
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
      Text(value,
          style: TextStyle(
              fontSize: large ? 16 : 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: color ?? AppColors.textPrimary)),
    ]);
  }
}
