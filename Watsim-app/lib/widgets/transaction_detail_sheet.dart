import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/language_service.dart';
import '../wallet_state.dart';

/// Bottom-sheet that displays the details of a wallet transaction.
class TransactionDetailSheet extends StatelessWidget {
  final WalletTransaction tx;

  const TransactionDetailSheet({super.key, required this.tx});

  String _typeLabel(BuildContext context) {
    final lang = LanguageProvider.of(context);
    switch (tx.type) {
      case TxType.deposit:
        return lang.isFrench ? 'Dépôt' : 'Deposit';
      case TxType.withdrawal:
        return lang.isFrench ? 'Retrait' : 'Withdrawal';
      case TxType.bnpl:
        return lang.isFrench ? 'Achat BNPL' : 'BNPL Purchase';
      case TxType.transfer:
        return lang.isFrench ? 'Transfert' : 'Transfer';
    }
  }

  String _statusLabel(BuildContext context) {
    final tag = tx.tag.toUpperCase();
    if (tag.contains('PEND')) {
      return LanguageProvider.of(context).isFrench ? 'En attente' : 'Pending';
    }
    if (tag.contains('FAIL') || tag.contains('CANCEL') || tag.contains('REJECTED')) {
      return LanguageProvider.of(context).isFrench ? 'Échoué' : 'Failed';
    }
    if (tag.contains('ADJUSTED') || tag.contains('REFUND')) {
      return LanguageProvider.of(context).isFrench ? 'Ajusté' : 'Adjusted';
    }
    return LanguageProvider.of(context).isFrench ? 'Terminé' : 'Completed';
  }

  Color _statusColor() {
    final tag = tx.tag.toUpperCase();
    if (tag.contains('PEND')) return AppColors.warning;
    if (tag.contains('FAIL') || tag.contains('CANCEL') || tag.contains('REJECTED')) {
      return AppColors.error;
    }
    if (tag.contains('ADJUSTED') || tag.contains('REFUND')) return AppColors.deepTeal;
    return AppColors.primaryGreen;
  }

  String _formatDate(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} $h:$m';
  }

  String _amountText() {
    final sign = tx.isCredit ? '+' : '-';
    final t = tx.amount ~/ 1000;
    final r = (tx.amount % 1000).toString().padLeft(3, '0');
    return '$sign $t,$r FCFA';
  }

  @override
  Widget build(BuildContext context) {
    final lang = LanguageProvider.of(context);
    final type = _typeLabel(context);
    final status = _statusLabel(context);
    final statusColor = _statusColor();

    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            lang.isFrench ? 'Détail de la transaction' : 'Transaction Details',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 20),
          _detailRow(lang.isFrench ? 'Type' : 'Type', type),
          _detailRow(lang.isFrench ? 'Description' : 'Description', tx.title),
          _detailRow(lang.isFrench ? 'Montant' : 'Amount', _amountText(),
              valueColor: tx.isCredit ? AppColors.primaryGreen : AppColors.error),
          _detailRow(lang.isFrench ? 'Date' : 'Date', _formatDate(tx.date)),
          _detailRow(lang.isFrench ? 'Statut' : 'Status', status,
              valueColor: statusColor),
          if (tx.tag.isNotEmpty) _detailRow(lang.isFrench ? 'Tag' : 'Tag', tx.tag),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: Text(lang.isFrench ? 'Fermer' : 'Close'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: valueColor ?? AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
