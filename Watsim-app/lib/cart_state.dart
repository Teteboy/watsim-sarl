// ─── Global Cart State ─────────────────────────────────────────────────────
// Simple in-memory singleton cart that persists across screens.
import 'package:flutter/foundation.dart';
import 'screens/catalogue_screen.dart';

class CartState extends ChangeNotifier {
  CartState._();
  static final CartState instance = CartState._();

  final List<Product> _items = [];

  List<Product> get items => List.unmodifiable(_items);
  int get count => _items.length;

  /// Returns true if added, false if already in cart (no duplicates).
  bool add(Product p) {
    if (_items.contains(p)) return false;
    _items.add(p);
    _notify();
    return true;
  }

  bool contains(Product p) => _items.contains(p);

  void remove(Product p) {
    _items.remove(p);
    _notify();
  }

  void clear() {
    _items.clear();
    _notify();
  }

  // Simple listener list for rebuilds
  void _notify() => notifyListeners();
}
