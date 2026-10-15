// "Write on this wall" — posts to a politician's wall via `create_wall_post`.
// One collapsed row that opens the shared composer sheet (text, photo,
// @tags; plus Video Pitch when the wall's owner is the one posting).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../domain/posts/entities/post_draft.dart';
import '../../../common/widgets/content_safety_sheets.dart';
import '../../../common/widgets/post_composer_sheet.dart';
import '../../profile/providers/profile_providers.dart';
import '../providers/politician_wall_providers.dart';

class WallComposer extends ConsumerWidget {
  const WallComposer({
    super.key,
    required this.wallGhostId,
    required this.ownerId,
    required this.ownerName,
  });

  final String wallGhostId;
  final String ownerId;
  final String ownerName;

  Future<void> _open(BuildContext context, WidgetRef ref, bool isOwner) async {
    final me = ref.read(ownProfileProvider).value;
    if (me?.currentGhostId == null) return;
    if (!await ensureTermsAccepted(context)) return;
    if (!context.mounted) return;
    final first = ownerName.split(' ').first;
    await showPostComposerSheet(
      context,
      hint: isOwner
          ? 'Post an update to your public wall… Type @ to tag a politician'
          : 'Leave a post or message for $first… Type @ to tag a politician',
      ghostId: me!.currentGhostId!,
      allowVideo: isOwner,
      viewerCountry: me.country,
      onSubmit: (PostDraft draft) async {
        final result = await ref
            .read(politicianWallRepositoryProvider)
            .createWallPost(wallGhostId, draft);
        final ok = result.when(ok: (_) => true, err: (_) => false);
        if (ok) {
          AppHaptics.tap();
          ref.invalidate(wallPostsProvider(wallGhostId));
        }
        return ok;
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final first = ownerName.split(' ').first;
    final me = ref.watch(ownProfileProvider).value;
    final isOwner = me != null && me.id == ownerId;
    return InkWell(
      borderRadius: BorderRadius.circular(ChosenoRadii.card),
      onTap: () => _open(context, ref, isOwner),
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
                isOwner
                    ? 'Post an update to your public wall…'
                    : 'Write on $first’s wall…',
                style: ChosenoTypography.body(
                  color: palette.textMuted,
                  fontSize: 14,
                ),
              ),
            ),
            Icon(Icons.image_outlined, size: 18, color: palette.textMuted),
            if (isOwner) ...[
              const SizedBox(width: ChosenoSpacing.xs),
              Icon(Icons.videocam_outlined, size: 18, color: palette.textMuted),
            ],
          ],
        ),
      ),
    );
  }
}
