// The address box of the website's InteractiveLocationPicker.tsx: debounced
// (450ms, ≥3 chars) Nominatim lookup with a suggestion list. Picking a hit
// reports its point and clears the field.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../domain/geocoding/entities/geocode_suggestion.dart';
import '../providers/location_providers.dart';

class AddressSearchField extends ConsumerStatefulWidget {
  const AddressSearchField({super.key, required this.onSelected});

  final ValueChanged<GeocodeSuggestion> onSelected;

  @override
  ConsumerState<AddressSearchField> createState() => _AddressSearchFieldState();
}

class _AddressSearchFieldState extends ConsumerState<AddressSearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<GeocodeSuggestion> _suggestions = const [];
  bool _searching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length < 3) {
      setState(() {
        _suggestions = const [];
        _searching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      setState(() => _searching = true);
      final result = await ref.read(geocodingRepositoryProvider).search(value);
      if (!mounted) return;
      setState(() {
        _suggestions = result.valueOrNull ?? const [];
        _searching = false;
      });
    });
  }

  void _select(GeocodeSuggestion s) {
    AppHaptics.tap();
    FocusScope.of(context).unfocus();
    _controller.clear();
    setState(() => _suggestions = const []);
    widget.onSelected(s);
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _controller,
          onChanged: _onChanged,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search an address, city or postal code',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
          ),
        ),
        if (_suggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: ChosenoSpacing.xs),
            decoration: BoxDecoration(
              color: palette.surfaceHover,
              borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
              border: Border.all(color: palette.borderLight),
            ),
            child: Column(
              children: [
                for (final s in _suggestions)
                  InkWell(
                    onTap: () => _select(s),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: ChosenoSpacing.md,
                        vertical: ChosenoSpacing.sm + 2,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.place_outlined,
                            size: 18,
                            color: palette.primary,
                          ),
                          const SizedBox(width: ChosenoSpacing.sm),
                          Expanded(
                            child: Text(
                              s.displayName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: ChosenoTypography.body(
                                color: palette.textMain,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
