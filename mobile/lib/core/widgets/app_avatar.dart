// A network avatar that degrades gracefully — caught live in testing: a
// broken/expired Supabase Storage URL (HTTP 400, e.g. an `avatar_url` still
// pointing at a deleted object) threw an uncaught `NetworkImageLoadException`
// and left a blank circle wherever a plain `CircleAvatar(backgroundImage:
// NetworkImage(...))` was used directly. This widget shows initials (or a
// generic icon) whenever there's no URL OR the image fails to load, and
// uses `Image.network`'s `errorBuilder` so the failure is handled quietly —
// no blank frame, no "exception caught by image resource service" spam.
// Every avatar in the app should go through this, never a raw
// `CircleAvatar` + `NetworkImage` pair.
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/theme_config.dart';

class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.imageUrl,
    this.fallbackText,
    this.fallbackIcon = Icons.person_outline,
    this.radius = 16,
  });

  final String? imageUrl;

  /// When set (and non-empty), its first character is shown as the
  /// fallback instead of [fallbackIcon] — e.g. a candidate's name.
  final String? fallbackText;
  final IconData fallbackIcon;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final size = radius * 2;
    final url = imageUrl?.trim();

    final fallback = Center(
      child: fallbackText?.isNotEmpty == true
          ? Text(
              fallbackText![0].toUpperCase(),
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontWeight: FontWeight.w700,
                fontSize: radius * 0.85,
              ),
            )
          : Icon(fallbackIcon, size: radius, color: palette.textMuted),
    );

    return SizedBox.square(
      dimension: size,
      child: ClipOval(
        child: ColoredBox(
          color: palette.surfaceHover,
          child: url == null || url.isEmpty
              ? fallback
              : Image.network(
                  url,
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => fallback,
                ),
        ),
      ),
    );
  }
}
