// Port of the website's Input.jsx/Textarea.jsx — form controls stay solid/
// opaque (never glassy), per DESIGN.md's Components section, unlike
// AppCard's blur. Styling comes entirely from the theme's
// InputDecorationTheme (see core/theme/app_theme.dart) — this widget only
// wires up the label/obscure/validator plumbing, it never sets its own
// colors.
import 'package:flutter/material.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.autofillHints,
    this.errorText,
    this.onChanged,
  });

  final String label;
  final TextEditingController? controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      autofillHints: autofillHints,
      onChanged: onChanged,
      decoration: InputDecoration(labelText: label, errorText: errorText),
    );
  }
}
