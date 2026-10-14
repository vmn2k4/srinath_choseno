// Port of SeatPitchGallery.tsx — every candidate pitch video in a race.
// Order is shuffled per open so no candidate gets the first slot by default.
// Videos open in the OS (YouTube app / browser): the app has no in-app video
// player, and YouTube/Facebook links can't be played from a bare <video>.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_candidate.dart';

/// YouTube id from watch / youtu.be / shorts / embed links, else null
/// (port of parseYouTubeId in src/lib/utils/youtube.ts).
String? parseYouTubeId(String url) {
  final m = RegExp(
    r'(?:youtu\.be/|youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/))([A-Za-z0-9_-]{11})',
  ).firstMatch(url);
  return m?.group(1);
}

Future<void> showPitchGallery(
  BuildContext context, {
  required List<ElectionCandidate> candidates,
  required void Function(ElectionCandidate) onSelectCandidate,
}) {
  final withPitch =
      candidates
          .where((c) => (c.introVideoUrl ?? '').trim().isNotEmpty)
          .toList()
        ..shuffle();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => _PitchGallery(
      pitches: withPitch,
      total: candidates.length,
      onSelectCandidate: (c) {
        Navigator.of(ctx).pop();
        onSelectCandidate(c);
      },
    ),
  );
}

class _PitchGallery extends StatelessWidget {
  const _PitchGallery({
    required this.pitches,
    required this.total,
    required this.onSelectCandidate,
  });

  final List<ElectionCandidate> pitches;
  final int total;
  final void Function(ElectionCandidate) onSelectCandidate;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final missing = total - pitches.length;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ChosenoSpacing.lg,
          0,
          ChosenoSpacing.lg,
          ChosenoSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Watch the candidate pitches',
              style: ChosenoTypography.display(
                color: palette.textMain,
                fontSize: 18,
              ),
            ),
            Text(
              '${pitches.length} of $total candidates have shared a pitch'
              '${missing > 0 ? ' — $missing yet to share.' : '.'}',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: ChosenoSpacing.md),
            SizedBox(
              height: 330,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: pitches.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: ChosenoSpacing.md),
                itemBuilder: (_, i) => _PitchCard(
                  candidate: pitches[i],
                  onSelect: () => onSelectCandidate(pitches[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PitchCard extends StatelessWidget {
  const _PitchCard({required this.candidate, required this.onSelect});

  final ElectionCandidate candidate;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final url = candidate.introVideoUrl!.trim();
    final ytId = parseYouTubeId(url);
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => launchUrl(
                Uri.parse(url),
                mode: LaunchMode.externalApplication,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(ChosenoRadii.card / 2),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: palette.surfaceActive),
                    if (ytId != null)
                      Image.network(
                        'https://i.ytimg.com/vi/$ytId/hqdefault.jpg',
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      ),
                    ColoredBox(color: Colors.black.withValues(alpha: 0.25)),
                    Center(
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: palette.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.play_arrow_rounded,
                          size: 30,
                          color: palette.textOnPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          GestureDetector(
            onTap: onSelect,
            child: Row(
              children: [
                AppAvatar(
                  imageUrl: candidate.avatarUrl,
                  fallbackText: candidate.fullName,
                  radius: 14,
                ),
                const SizedBox(width: ChosenoSpacing.xs),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        candidate.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      if (candidate.partyName != null)
                        Text(
                          candidate.partyName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: ChosenoTypography.body(
                            color: palette.textMuted,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
