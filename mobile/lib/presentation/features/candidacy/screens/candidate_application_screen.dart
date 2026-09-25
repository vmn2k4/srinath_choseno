// Candidate Application (§4.G, docs/FLUTTER_MOBILE_APP_GUIDE.md, parent
// repo) — Written Questionnaire mode only. Intro-video recording uses
// image_picker's `pickVideo(source: ImageSource.camera)`, which delegates
// to the OS's own native camera app rather than a custom in-app camera
// preview — simpler to build, and more "native feel" than reinventing a
// camera UI. See candidate_application_providers.dart's header comment
// for what isn't ported (Video Interview player, per-answer video,
// "choose your questions" screen, answer→wall-post pitches).
//
// Submit follows the same gates as the server's
// `submit_candidate_application` RPC: an intro video and every required
// question answered (a ranking counts only when every option is ranked).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/utils/haptics.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../../../domain/elections/entities/candidate_answer_draft.dart';
import '../../../../domain/elections/entities/editable_question.dart';
import '../../../../domain/elections/entities/election_question_option.dart';
import '../providers/candidate_application_providers.dart';

class CandidateApplicationScreen extends ConsumerWidget {
  const CandidateApplicationScreen({super.key, required this.candidateId});

  final String candidateId;

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final palette = ChosenoTheme.of(context);
    AppHaptics.tap();
    final ok = await ref
        .read(candidateApplicationControllerProvider(candidateId).notifier)
        .submit();
    if (!ok || !context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        icon: Icon(Icons.check_circle, color: palette.success, size: 40),
        title: const Text('Application submitted'),
        content: const Text(
          "You're now a confirmed candidate for this seat — no admin review needed, it's live immediately.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
    if (context.mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final dataAsync = ref.watch(
      candidateApplicationControllerProvider(candidateId),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Candidate application')),
      body: dataAsync.when(
        data: (state) {
          final questions = [...state.questions]
            ..sort((a, b) => a.rank.compareTo(b.rank));
          final isApproved = state.application.status == 'approved';
          final hasVideo = state.application.introVideoUrl != null;
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              ChosenoSpacing.lg,
              ChosenoSpacing.md,
              ChosenoSpacing.lg,
              ChosenoSpacing.xxl,
            ),
            children: [
              SectionHeader(
                icon: Icons.assignment_ind_outlined,
                title: state.application.roleTitle ?? 'Your candidacy',
                subtitle: isApproved
                    ? 'Submitted and live.'
                    : 'Statement, intro video and questionnaire.',
                trailing: isApproved
                    ? const AppBadge(
                        label: 'Submitted',
                        tone: AppBadgeTone.success,
                      )
                    : const AppBadge(
                        label: 'Draft',
                        tone: AppBadgeTone.warning,
                      ),
              ),
              const SizedBox(height: ChosenoSpacing.lg),
              _StatementCard(candidateId: candidateId, state: state),
              const SizedBox(height: ChosenoSpacing.md),
              _IntroVideoCard(candidateId: candidateId, state: state),
              if (questions.isNotEmpty) ...[
                const SizedBox(height: ChosenoSpacing.xl),
                const SectionHeader(
                  icon: Icons.quiz_outlined,
                  title: 'Questionnaire',
                  subtitle: 'Required questions are marked.',
                ),
                const SizedBox(height: ChosenoSpacing.md),
                ...questions.map(
                  (q) => Padding(
                    padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
                    child: _QuestionCard(
                      candidateId: candidateId,
                      question: q,
                      draft: state.answersByQuestionId[q.id],
                      highlighted: state.highlightedQuestionIds.contains(q.id),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: ChosenoSpacing.lg),
              if (state.submitError != null) ...[
                Text(
                  state.submitError!,
                  textAlign: TextAlign.center,
                  style: ChosenoTypography.body(
                    color: palette.danger,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: ChosenoSpacing.md),
              ],
              if (!isApproved && !hasVideo)
                Padding(
                  padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
                  child: Text(
                    'Record your intro video before submitting.',
                    textAlign: TextAlign.center,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 13,
                    ),
                  ),
                ),
              AppButton(
                label: isApproved
                    ? 'Application submitted'
                    : 'Submit application',
                loading: state.submitting,
                onPressed: isApproved || state.submitting || !hasVideo
                    ? null
                    : () => _submit(context, ref),
              ),
            ],
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(ChosenoSpacing.lg),
            child: Text(
              '$error',
              textAlign: TextAlign.center,
              style: ChosenoTypography.body(color: palette.danger),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatementCard extends ConsumerStatefulWidget {
  const _StatementCard({required this.candidateId, required this.state});

  final String candidateId;
  final CandidateApplicationState state;

  @override
  ConsumerState<_StatementCard> createState() => _StatementCardState();
}

class _StatementCardState extends ConsumerState<_StatementCard> {
  late final _controller = TextEditingController(
    text: widget.state.application.statement ?? '',
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final notifier = ref.read(
      candidateApplicationControllerProvider(widget.candidateId).notifier,
    );
    return AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Your statement',
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          TextField(
            controller: _controller,
            maxLines: 5,
            onChanged: notifier.setStatementDraft,
            decoration: const InputDecoration(
              labelText: 'Why are you running? What will you fight for?',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: ChosenoSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: AppButton(
              label: 'Save',
              variant: AppButtonVariant.outline,
              loading: widget.state.savingStatement,
              onPressed: widget.state.savingStatement
                  ? null
                  : () => notifier.saveStatement(_controller.text.trim()),
            ),
          ),
        ],
      ),
    );
  }
}

class _IntroVideoCard extends ConsumerWidget {
  const _IntroVideoCard({required this.candidateId, required this.state});

  final String candidateId;
  final CandidateApplicationState state;

  Future<void> _record(BuildContext context, WidgetRef ref) async {
    final picked = await ImagePicker().pickVideo(
      source: ImageSource.camera,
      maxDuration: const Duration(seconds: 30),
    );
    if (picked == null) return;
    AppHaptics.tap();
    final bytes = await picked.readAsBytes();
    final extension = picked.path.split('.').last;
    final success = await ref
        .read(candidateApplicationControllerProvider(candidateId).notifier)
        .uploadIntroVideo(bytes, extension);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success ? 'Intro video saved.' : 'Could not upload video.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final hasVideo = state.application.introVideoUrl != null;
    return AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Intro video',
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              const AppBadge(
                label: 'Required',
                tone: AppBadgeTone.warning,
                size: AppBadgeSize.xs,
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              Icon(
                hasVideo ? Icons.check_circle : Icons.videocam_outlined,
                size: 18,
                color: hasVideo ? palette.success : palette.textMuted,
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Text(
                hasVideo
                    ? 'Intro video recorded'
                    : 'A short (up to 30s) pitch to voters.',
                style: ChosenoTypography.body(
                  color: hasVideo ? palette.success : palette.textMuted,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          AppButton(
            label: hasVideo ? 'Re-record intro video' : 'Record intro video',
            icon: Icons.videocam_outlined,
            variant: AppButtonVariant.outline,
            loading: state.uploadingVideo,
            onPressed: state.uploadingVideo
                ? null
                : () => _record(context, ref),
          ),
        ],
      ),
    );
  }
}

class _QuestionCard extends ConsumerWidget {
  const _QuestionCard({
    required this.candidateId,
    required this.question,
    required this.draft,
    this.highlighted = false,
  });

  final String candidateId;
  final EditableQuestion question;
  final CandidateAnswerDraft? draft;
  final bool highlighted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final controller = ref.read(
      candidateApplicationControllerProvider(candidateId).notifier,
    );
    final card = AppCard(
      padding: const EdgeInsets.all(ChosenoSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  question.questionText,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    height: 1.35,
                  ),
                ),
              ),
              if (question.required)
                const Padding(
                  padding: EdgeInsets.only(left: ChosenoSpacing.sm),
                  child: AppBadge(
                    label: 'Required',
                    tone: AppBadgeTone.warning,
                    size: AppBadgeSize.xs,
                  ),
                ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.md),
          switch (question.questionType) {
            CandidacyQuestionType.singleChoice => _SingleChoiceInput(
              options: question.options,
              selectedOptionId: draft?.optionId,
              onChanged: (id) => controller.answerSingleChoice(question.id, id),
            ),
            CandidacyQuestionType.multipleChoice => _MultipleChoiceInput(
              options: question.options,
              selectedOptionIds: draft?.selectedOptionIds.toSet() ?? const {},
              onChanged: (ids) =>
                  controller.answerMultipleChoice(question.id, ids),
            ),
            CandidacyQuestionType.rating => _RatingInput(
              value: draft?.ratingValue,
              onChanged: (v) => controller.answerRating(question.id, v),
            ),
            CandidacyQuestionType.ranking => _RankingInput(
              options: question.options,
              orderedOptionIds: draft?.selectedOptionIds ?? const [],
              onChanged: (ids) => controller.answerRanking(question.id, ids),
            ),
            CandidacyQuestionType.text ||
            CandidacyQuestionType.unknown => _TextAnswerInput(
              initialText: draft?.textAnswer ?? '',
              onSave: (text) => controller.answerText(question.id, text),
            ),
          },
        ],
      ),
    );
    if (!highlighted) return card;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ChosenoRadii.card),
        border: Border.all(color: palette.danger, width: 1.5),
      ),
      child: card,
    );
  }
}

class _ChoiceRow extends StatelessWidget {
  const _ChoiceRow({
    required this.selected,
    required this.label,
    required this.onTap,
    required this.selectedIcon,
    required this.unselectedIcon,
  });

  final bool selected;
  final String label;
  final VoidCallback onTap;
  final IconData selectedIcon;
  final IconData unselectedIcon;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        AppHaptics.tap();
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(
          vertical: ChosenoSpacing.sm + 2,
          horizontal: ChosenoSpacing.xs,
        ),
        child: Row(
          children: [
            Icon(
              selected ? selectedIcon : unselectedIcon,
              size: 22,
              color: selected ? palette.primary : palette.textMuted,
            ),
            const SizedBox(width: ChosenoSpacing.md),
            Expanded(
              child: Text(
                label,
                style: ChosenoTypography.body(
                  color: palette.textMain,
                  fontSize: 14,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SingleChoiceInput extends StatelessWidget {
  const _SingleChoiceInput({
    required this.options,
    required this.selectedOptionId,
    required this.onChanged,
  });

  final List<ElectionQuestionOption> options;
  final String? selectedOptionId;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final option in options)
          _ChoiceRow(
            selected: option.id == selectedOptionId,
            label: option.optionText,
            selectedIcon: Icons.radio_button_checked,
            unselectedIcon: Icons.radio_button_off,
            onTap: () => onChanged(option.id),
          ),
      ],
    );
  }
}

class _MultipleChoiceInput extends StatelessWidget {
  const _MultipleChoiceInput({
    required this.options,
    required this.selectedOptionIds,
    required this.onChanged,
  });

  final List<ElectionQuestionOption> options;
  final Set<String> selectedOptionIds;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final option in options)
          _ChoiceRow(
            selected: selectedOptionIds.contains(option.id),
            label: option.optionText,
            selectedIcon: Icons.check_box,
            unselectedIcon: Icons.check_box_outline_blank,
            onTap: () {
              final updated = Set<String>.from(selectedOptionIds);
              updated.contains(option.id)
                  ? updated.remove(option.id)
                  : updated.add(option.id);
              onChanged(updated.toList());
            },
          ),
      ],
    );
  }
}

class _RatingInput extends StatelessWidget {
  const _RatingInput({required this.value, required this.onChanged});

  final int? value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return Row(
      children: List.generate(5, (i) {
        final n = i + 1;
        final filled = value != null && n <= value!;
        return Padding(
          padding: const EdgeInsets.only(right: ChosenoSpacing.sm),
          child: InkWell(
            onTap: () {
              AppHaptics.tap();
              onChanged(n);
            },
            borderRadius: BorderRadius.circular(ChosenoRadii.full),
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? palette.primary : Colors.transparent,
                border: Border.all(
                  color: filled ? palette.primary : palette.borderLight,
                ),
              ),
              child: Text(
                '$n',
                style: ChosenoTypography.body(
                  color: filled ? palette.textOnPrimary : palette.textMuted,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _RankingInput extends StatefulWidget {
  const _RankingInput({
    required this.options,
    required this.orderedOptionIds,
    required this.onChanged,
  });

  final List<ElectionQuestionOption> options;
  final List<String> orderedOptionIds;
  final ValueChanged<List<String>> onChanged;

  @override
  State<_RankingInput> createState() => _RankingInputState();
}

class _RankingInputState extends State<_RankingInput> {
  late final List<String> _order = widget.orderedOptionIds.isNotEmpty
      ? [...widget.orderedOptionIds]
      : widget.options.map((o) => o.id).toList();

  String _textFor(String id) =>
      widget.options.firstWhere((o) => o.id == id).optionText;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return ReorderableListView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      buildDefaultDragHandles: false,
      onReorder: (oldIndex, newIndex) {
        AppHaptics.tap();
        setState(() {
          if (newIndex > oldIndex) newIndex -= 1;
          final id = _order.removeAt(oldIndex);
          _order.insert(newIndex, id);
        });
        widget.onChanged([..._order]);
      },
      children: [
        for (final (index, id) in _order.indexed)
          ReorderableDelayedDragStartListener(
            key: ValueKey(id),
            index: index,
            child: Container(
              margin: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
              padding: const EdgeInsets.symmetric(
                horizontal: ChosenoSpacing.md,
                vertical: ChosenoSpacing.md,
              ),
              decoration: BoxDecoration(
                color: palette.surfaceHover,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: palette.primary.withValues(alpha: 0.18),
                    ),
                    child: Text(
                      '${index + 1}',
                      style: ChosenoTypography.body(
                        color: palette.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(width: ChosenoSpacing.md),
                  Expanded(
                    child: Text(
                      _textFor(id),
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Icon(Icons.drag_handle, color: palette.textMuted, size: 20),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _TextAnswerInput extends StatefulWidget {
  const _TextAnswerInput({required this.initialText, required this.onSave});

  final String initialText;
  final ValueChanged<String> onSave;

  @override
  State<_TextAnswerInput> createState() => _TextAnswerInputState();
}

class _TextAnswerInputState extends State<_TextAnswerInput> {
  late final _controller = TextEditingController(text: widget.initialText);
  late String _lastSaved = widget.initialText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    final text = _controller.text.trim();
    if (text == _lastSaved) return;
    _lastSaved = text;
    widget.onSave(text);
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      // Saved when the field loses focus, not only via a button — typing an
      // answer and going straight to Submit must not drop it.
      onFocusChange: (hasFocus) {
        if (!hasFocus) _save();
      },
      child: TextField(
        controller: _controller,
        maxLines: 4,
        onEditingComplete: _save,
        decoration: const InputDecoration(
          labelText: 'Your answer',
          alignLabelWithHint: true,
        ),
      ),
    );
  }
}
