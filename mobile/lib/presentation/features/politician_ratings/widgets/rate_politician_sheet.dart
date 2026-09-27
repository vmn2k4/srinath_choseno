// Port of PoliticianInlineRating.tsx's composer half (the past-reviews list
// isn't ported — see politician_ratings_providers.dart's header comment for
// why the aggregate the caller shows elsewhere is enough for now). Same
// bottom-sheet pattern as change_location_sheet.dart: a top-level
// `showRatePoliticianSheet` function, a private ConsumerStatefulWidget body.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../providers/politician_ratings_providers.dart';

/// Returns true if a rating was actually submitted, so the caller can
/// invalidate whatever engagement-summary provider it's showing an avg
/// from.
Future<bool?> showRatePoliticianSheet(
  BuildContext context, {
  required String politicianId,
  required String politicianName,
  String? newsArticleId,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _RatePoliticianSheet(
      politicianId: politicianId,
      politicianName: politicianName,
      newsArticleId: newsArticleId,
    ),
  );
}

class _RatePoliticianSheet extends ConsumerStatefulWidget {
  const _RatePoliticianSheet({
    required this.politicianId,
    required this.politicianName,
    this.newsArticleId,
  });

  final String politicianId;
  final String politicianName;
  final String? newsArticleId;

  @override
  ConsumerState<_RatePoliticianSheet> createState() =>
      _RatePoliticianSheetState();
}

class _RatePoliticianSheetState extends ConsumerState<_RatePoliticianSheet> {
  int _rating = 0;
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating < 1) return;
    final ok = await ref
        .read(politicianRatingControllerProvider.notifier)
        .submit(
          politicianId: widget.politicianId,
          rating: _rating,
          comment: _commentController.text.trim().isEmpty
              ? null
              : _commentController.text.trim(),
          newsArticleId: widget.newsArticleId,
        );
    if (!mounted) return;
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final submitState = ref.watch(politicianRatingControllerProvider);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        ChosenoSpacing.lg,
        ChosenoSpacing.sm,
        ChosenoSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + ChosenoSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Rate ${widget.politicianName}',
            style: ChosenoTypography.display(
              color: palette.textMain,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          Center(
            child: AppStarRating(
              value: _rating.toDouble(),
              size: 36,
              onChanged: (v) => setState(() => _rating = v),
            ),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          AppTextField(
            label: 'Share your thoughts (optional)',
            controller: _commentController,
            maxLines: 3,
          ),
          if (submitState.hasError) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Text(
              '${submitState.error}',
              style: ChosenoTypography.body(color: palette.danger, fontSize: 13),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.md),
          AppButton(
            label: submitState.isLoading ? 'Submitting…' : 'Submit Rating',
            onPressed: (_rating < 1 || submitState.isLoading) ? null : _submit,
          ),
        ],
      ),
    );
  }
}
