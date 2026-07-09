import 'package:flutter/material.dart';

// ─── Watsim Color Palette ─────────────────────────────────────────────────
// Palette: #014945 | #4DB049 | #196D43 | #014A41 | #FAFEF9
class AppColors {
  // Primary greens
  static const primaryDark    = Color(0xFF014945); // deep teal-green (dominant dark)
  static const primaryGreen   = Color(0xFF4DB049); // bright green (CTAs, accents)
  static const secondaryGreen = Color(0xFF196D43); // mid forest green
  static const deepTeal       = Color(0xFF014A41); // deep teal (nav active, badges)
  static const offWhite       = Color(0xFFFAFEF9); // near-white background

  // Utility
  static const white          = Color(0xFFFFFFFF);
  static const cardBg         = Color(0xFFFFFFFF);
  static const textPrimary    = Color(0xFF0A2420);
  static const textSecondary  = Color(0xFF4A6662);
  static const textMuted      = Color(0xFF8AABA7);
  static const divider        = Color(0xFFE8F2F1);
  static const success        = Color(0xFF4DB049);
  static const error          = Color(0xFFE53935);
  static const warning        = Color(0xFFFFA726);

  // Subtle tints derived from palette
  static const greenTint10    = Color(0x1A4DB049); // 10% primaryGreen
  static const greenTint15    = Color(0x264DB049); // 15% primaryGreen
  static const tealTint10     = Color(0x1A014945); // 10% primaryDark
  static const tealTint08     = Color(0x14014A41); // 8% deepTeal
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    fontFamily: 'DM Sans',
    colorScheme: ColorScheme.light(
      primary: AppColors.primaryGreen,
      primaryContainer: AppColors.primaryDark,
      secondary: AppColors.secondaryGreen,
      surface: AppColors.offWhite,
      onPrimary: AppColors.white,
      onSurface: AppColors.textPrimary,
    ),
    scaffoldBackgroundColor: AppColors.offWhite,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.primaryDark,
      foregroundColor: AppColors.white,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'DM Sans',
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.white,
      selectedItemColor: AppColors.deepTeal,
      unselectedItemColor: AppColors.textMuted,
      showSelectedLabels: true,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
      elevation: 12,
      selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontSize: 11),
    ),
    cardTheme: CardThemeData(
      color: AppColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.divider, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected)
              ? AppColors.primaryGreen
              : Colors.transparent),
      side: const BorderSide(color: AppColors.textMuted, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.offWhite,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
      ),
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
      prefixIconColor: AppColors.primaryGreen,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primaryGreen,
        foregroundColor: AppColors.white,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        elevation: 0,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryGreen,
        textStyle: const TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 0,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? AppColors.white : AppColors.textMuted),
      trackColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected)
              ? AppColors.primaryGreen
              : AppColors.divider),
    ),
  );
}
