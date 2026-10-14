// "Write on this wall" — posts to a politician's wall via `create_wall_post`.
// One collapsed row until tapped, so it costs a single line of screen space.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/politician_wall_providers.dart';

const _maxLength = 1000;

class WallComposer extends ConsumerStatefulWidget {
  const WallComposer({
    super.key,
    required this.wallGhostId,
    required this.ownerName,
  });

  final String wallGhostId;
  final String ownerName;

  @override
  ConsumerState<WallComposer> createState() => _WallComposerState();
}

class _WallComposerState extends ConsumerState<WallComposer> {
  final _controller = TextEditingController();
  bool _open = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    final result = await ref
        .read(politicianWallRepositoryProvider)
        .createWallPost(widget.wallGhostId, text);
    if (!mounted) return;
    result.when(
      ok: (_) {
        AppHaptics.tap();
        _controller.clear();
        ref.invalidate(wallPostsProvider(widget.wallGhostId));
        setState(() {
          _sending = false;
          _open = false;
        });
      },
      err: (f) => setState(() {
        _sending = false;
        _error = f.message;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final first = widget.ownerName.split(' ').first;

    if (!_open) {
      return InkWell(
        borderRadius: BorderRadius.circular(ChosenoRadii.card),
        onTap: () => setState(() => _open = true),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChosenoSpacing.md,
            vertical: ChosenoSpacing.sm + 4,
          ),
          decoration: BoxDecoration(
            border: Border.all(color: palette.borderLight),
            borderRadius: BorderRadius.circular(ChosenoRadii.card),
            color: palette.surfaceHover,
          ),
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 18, color: palette.primary),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Text(
                  'Write on $first’s wall…',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.sm + 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            minLines: 2,
            maxLines: 6,
            maxLength: _maxLength,
            decoration: InputDecoration(
              hintText: 'Say something to $first — posts are anonymous',
              counterText: '',
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
              child: Text(
                _error!,
                style: ChosenoTypography.body(
                  color: palette.danger,
                  fontSize: 12,
                ),
              ),
            ),
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Cancel',
                  variant: AppButtonVariant.outline,
                  onPressed: _sending
                      ? null
                      : () => setState(() {
                          _open = false;
                          _error = null;
                        }),
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: AppButton(
                  label: 'Post',
                  icon: Icons.send_rounded,
                  loading: _sending,
                  onPressed: _sending ? null : _post,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
