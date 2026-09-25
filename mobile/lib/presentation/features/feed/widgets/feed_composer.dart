// Facebook-style composer: nothing permanently open in the feed (a
// multi-line box would eat a quarter of the screen), just a compose button
// in the top bar (`ScreenHeader`) that opens a real compose sheet when
// tapped. Not yet ported:
// image attach (`uploadPostImage`), link-preview auto-detect, @mention
// autocomplete, and the politician-only in-app-recorded video pitch
// (`VideoRecorderWidget`, needs the `camera` package wired up — see §8's
// native-camera recommendation).
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';

/// Opens the compose sheet. [onSubmit] returns whether the post actually
/// saved — the sheet stays open and shows the failure inline when this
/// resolves false, closes itself on true. `FeedController.submitPost`
/// already returns exactly this shape.
Future<void> showFeedComposeSheet(
  BuildContext context, {
  required Future<bool> Function(String content) onSubmit,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
      ),
      child: _ComposeSheet(onSubmit: onSubmit),
    ),
  );
}

class _ComposeSheet extends StatefulWidget {
  const _ComposeSheet({required this.onSubmit});

  final Future<bool> Function(String content) onSubmit;

  @override
  State<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends State<_ComposeSheet> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Sheet opens specifically because the viewer tapped "compose" — the
    // keyboard should already be up, not require a second tap on the
    // field once the sheet finishes animating in.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _focusNode.requestFocus(),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final content = _controller.text.trim();
    if (content.isEmpty || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await widget.onSubmit(content);
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = 'Could not post. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.all(ChosenoSpacing.md),
        padding: const EdgeInsets.all(ChosenoSpacing.md),
        decoration: BoxDecoration(
          color: palette.surface,
          borderRadius: BorderRadius.circular(ChosenoRadii.card),
          border: Border.all(color: palette.borderLight),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'New post',
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: 18,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            TextField(
              controller: _controller,
              focusNode: _focusNode,
              maxLines: 6,
              minLines: 3,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: "What's happening in your area?",
                border: InputBorder.none,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: ChosenoSpacing.xs),
              Text(
                _error!,
                style: ChosenoTypography.body(
                  color: palette.danger,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: ChosenoSpacing.sm),
            Align(
              alignment: Alignment.centerRight,
              child: AppButton(
                label: 'Post',
                loading: _submitting,
                onPressed: _submitting ? null : _submit,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
