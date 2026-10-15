// Screen A.8 from docs/FLUTTER_MOBILE_APP_GUIDE.md (parent repo) — a
// candidate's per-election profile + questionnaire answers, distinct from
// their standing Politician Wall (§4.A.9, already built). Not yet ported:
// Candidacy Wall's own post feed + pitch videos, answer comments, and the
// inline star-rating review panel — all of which need infra (video
// playback, nested comments) this app doesn't have yet for this screen;
// the read profile + questionnaire + Support toggle + Claim Candidacy
// (Flow B only — see candidacy_providers.dart) below covers what a
// visitor most needs to decide who to support, and what an unclaimed
// candidate needs to take ownership of their page.
import '../../../../core/widgets/expandable_text.dart';
import '../../../common/widgets/detail_app_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/candidacy_detail.dart';
import '../../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../auth/providers/auth_providers.dart';
import '../../../../domain/posts/entities/post_draft.dart';
import '../../../common/widgets/content_safety_sheets.dart';
import '../../../common/widgets/post_composer_sheet.dart';
import '../../politician_wall/providers/politician_wall_providers.dart';
import '../../politician_wall/widgets/wall_post_tile.dart';
import '../../profile/providers/profile_providers.dart';
import '../providers/candidacy_providers.dart';

class CandidacyWallScreen extends ConsumerWidget {
  const CandidacyWallScreen({super.key, required this.candidateId});

  final String candidateId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final dataAsync = ref.watch(candidacyWallProvider(candidateId));

    return Scaffold(
      appBar: DetailAppBar(
        title: dataAsync.value?.detail.fullName ?? 'Candidate',
        subtitle: dataAsync.value?.detail.roleTitle,
      ),
      body: dataAsync.when(
        data: (data) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref
                .read(wallSupportControllerProvider.notifier)
                .load(data.detail.politicianId);
          });
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(candidacyWallProvider(candidateId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.lg,
                ChosenoSpacing.sm,
                ChosenoSpacing.lg,
                ChosenoSpacing.xxl,
              ),
              children: [
                _ProfileCard(candidateId: candidateId, detail: data.detail),
                if (data.detail.isUnclaimedStub) ...[
                  const SizedBox(height: ChosenoSpacing.md),
                  _ClaimCandidacyCard(candidateId: candidateId),
                ],
                const SizedBox(height: ChosenoSpacing.lg),
                _CandidacyPosts(candidateId: candidateId, detail: data.detail),
                const SizedBox(height: ChosenoSpacing.lg),
                if (data.answers.isNotEmpty) ...[
                  const SectionHeader(
                    icon: Icons.quiz_outlined,
                    title: 'Where they stand',
                    subtitle: 'Their answers to the questionnaire.',
                  ),
                  const SizedBox(height: ChosenoSpacing.md),
                  ...data.answers.asMap().entries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
                      child: _AnswerCard(index: entry.key, answer: entry.value),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
        loading: () => const Center(child: LoadingIndicator()),
        error: (error, _) => Center(
          child: Text(
            'This candidate could not be found.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ),
    );
  }
}

class _ProfileCard extends ConsumerWidget {
  const _ProfileCard({required this.candidateId, required this.detail});

  final String candidateId;
  final CandidacyDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final supporterCountAsync = ref.watch(
      wallSupporterCountProvider(detail.politicianId),
    );
    final isSupportingAsync = ref.watch(wallSupportControllerProvider);

    return AppCard(
      variant: AppCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(
                imageUrl: detail.avatarUrl,
                fallbackText: detail.fullName,
                radius: 34,
              ),
              const SizedBox(width: ChosenoSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.fullName,
                      style: ChosenoTypography.display(
                        color: palette.textMain,
                        fontSize: 20,
                      ),
                    ),
                    if (detail.partyName != null)
                      Text(
                        detail.partyName!,
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                    if (detail.roleTitle != null)
                      Text(
                        [
                          detail.roleTitle,
                          if (detail.boundaryName != null) detail.boundaryName,
                        ].join(' · '),
                        style: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (detail.statement != null && detail.statement!.isNotEmpty) ...[
            const SizedBox(height: ChosenoSpacing.md),
            Text(
              'Statement',
              style: ChosenoTypography.body(
                color: palette.textTertiary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: ChosenoSpacing.xs),
            Text(
              detail.statement!,
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontSize: 14,
              ),
            ),
          ],
          if (detail.bio != null && detail.bio!.isNotEmpty) ...[
            const SizedBox(height: ChosenoSpacing.md),
            Text(
              'About',
              style: ChosenoTypography.body(
                color: palette.textTertiary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: ChosenoSpacing.xs),
            ExpandableText(
              text: detail.bio!,
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.md),
          isSupportingAsync.when(
            data: (isSupporting) => AppButton(
              label: isSupporting ? 'Supported' : 'Support',
              icon: isSupporting ? Icons.favorite : Icons.favorite_border,
              variant: isSupporting
                  ? AppButtonVariant.primary
                  : AppButtonVariant.outline,
              tone: AppButtonTone.success,
              onPressed: () =>
                  ref.read(wallSupportControllerProvider.notifier).toggle(),
            ),
            loading: () => const LoadingIndicator(size: 16),
            error: (_, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: ChosenoSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              supporterCountAsync.when(
                data: (count) => Text(
                  '$count supporter${count == 1 ? '' : 's'}',
                  style: ChosenoTypography.body(
                    color: palette.textMuted,
                    fontSize: 13,
                  ),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
              ),
              if (detail.wallSlug != null)
                TextButton(
                  onPressed: () =>
                      context.push(AppRoutes.wall(detail.wallSlug!)),
                  child: const Text('View wall'),
                ),
            ],
          ),
          if (ref.watch(authStateChangesProvider).value?.id ==
              detail.politicianId) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'Answer Application Questions',
              icon: Icons.edit_outlined,
              variant: AppButtonVariant.outline,
              onPressed: () =>
                  context.push(AppRoutes.candidateApplication(candidateId)),
            ),
          ],
        ],
      ),
    );
  }
}

/// Claim Candidacy Flow B (§4.H) — "this is me", reviewed by an election
/// admin. Only rendered when [CandidacyDetail.isUnclaimedStub] is true.
class _ClaimCandidacyCard extends ConsumerStatefulWidget {
  const _ClaimCandidacyCard({required this.candidateId});

  final String candidateId;

  @override
  ConsumerState<_ClaimCandidacyCard> createState() =>
      _ClaimCandidacyCardState();
}

class _ClaimCandidacyCardState extends ConsumerState<_ClaimCandidacyCard> {
  bool _formOpen = false;
  String? _validationError;
  final _emailController = TextEditingController();
  final _socialController = TextEditingController();
  final _motivationController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _socialController.dispose();
    _motivationController.dispose();
    super.dispose();
  }

  void _submit() {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _validationError = 'Contact email is required.');
      return;
    }
    setState(() => _validationError = null);
    ref
        .read(claimCandidacyControllerProvider(widget.candidateId).notifier)
        .submit(
          motivation: _motivationController.text.trim(),
          contactEmail: email,
          socialMediaInfo: _socialController.text.trim().isEmpty
              ? null
              : _socialController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final state = ref.watch(
      claimCandidacyControllerProvider(widget.candidateId),
    );

    return Container(
      padding: const EdgeInsets.all(ChosenoSpacing.md),
      decoration: BoxDecoration(
        color: palette.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(ChosenoRadii.sm),
        border: Border.all(color: palette.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Listed by a verified election administrator.',
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
          if (state.submitted) ...[
            const SizedBox(height: ChosenoSpacing.xs),
            Text(
              'Claim request submitted for review.',
              style: ChosenoTypography.body(
                color: palette.primary,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ] else ...[
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'This is me — Claim Candidacy',
              icon: Icons.how_to_reg_outlined,
              variant: AppButtonVariant.outline,
              onPressed: () => setState(() => _formOpen = !_formOpen),
            ),
            if (_formOpen) ...[
              const SizedBox(height: ChosenoSpacing.sm),
              AppTextField(
                label: 'Contact Email',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: ChosenoSpacing.xs),
              AppTextField(
                label: 'Social Media / Proof Link (optional)',
                controller: _socialController,
              ),
              const SizedBox(height: ChosenoSpacing.xs),
              TextField(
                controller: _motivationController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Why are you claiming this candidacy?',
                ),
              ),
              if (_validationError != null || state.error != null) ...[
                const SizedBox(height: ChosenoSpacing.xs),
                Text(
                  _validationError ?? state.error!,
                  style: ChosenoTypography.body(
                    color: palette.danger,
                    fontSize: 12,
                  ),
                ),
              ],
              const SizedBox(height: ChosenoSpacing.sm),
              AppButton(
                label: 'Submit Claim Request',
                loading: state.submitting,
                onPressed: state.submitting ? null : _submit,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

String _questionTypeLabel(CandidacyQuestionType type) {
  switch (type) {
    case CandidacyQuestionType.singleChoice:
      return 'Yes/No';
    case CandidacyQuestionType.multipleChoice:
      return 'Multiple Choice';
    case CandidacyQuestionType.ranking:
      return 'Priority Ranking';
    case CandidacyQuestionType.rating:
      return 'Rating';
    case CandidacyQuestionType.text:
    case CandidacyQuestionType.unknown:
      return 'Text';
  }
}

class _AnswerCard extends StatelessWidget {
  const _AnswerCard({required this.index, required this.answer});

  final int index;
  final CandidacyQuestionAnswer answer;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: palette.primary.withValues(alpha: 0.15),
                ),
                child: Text(
                  '${index + 1}',
                  style: ChosenoTypography.body(
                    color: palette.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              AppBadge(
                label: _questionTypeLabel(answer.questionType),
                tone: AppBadgeTone.neutral,
                size: AppBadgeSize.xs2,
              ),
            ],
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          Text(
            answer.questionText,
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          if (answer.hasValue) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            _AnswerValue(answer: answer),
          ],
          if (answer.contextText != null && answer.contextText!.isNotEmpty) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            Text(
              '"${answer.contextText}"',
              style: ChosenoTypography.body(
                color: palette.textMuted,
                fontSize: 13,
              ).copyWith(fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }
}

/// Port of `AnswerValue.tsx` (src/components/features) — one rendering per
/// [CandidacyQuestionType].
class _AnswerValue extends StatelessWidget {
  const _AnswerValue({required this.answer});

  final CandidacyQuestionAnswer answer;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    switch (answer.questionType) {
      case CandidacyQuestionType.multipleChoice:
        return Wrap(
          spacing: ChosenoSpacing.xs,
          runSpacing: ChosenoSpacing.xs,
          children: answer.selectedOptionTexts
              .map((t) => AppBadge(label: t, tone: AppBadgeTone.primary))
              .toList(),
        );
      case CandidacyQuestionType.ranking:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: answer.selectedOptionTexts
              .asMap()
              .entries
              .map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: ChosenoSpacing.xs),
                  child: Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: palette.primary.withValues(alpha: 0.15),
                        ),
                        child: Text(
                          '${e.key + 1}',
                          style: ChosenoTypography.body(
                            color: palette.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                          ),
                        ),
                      ),
                      const SizedBox(width: ChosenoSpacing.xs),
                      Text(
                        e.value,
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        );
      case CandidacyQuestionType.text:
        return Text(
          answer.textAnswer ?? '',
          style: ChosenoTypography.body(color: palette.textMain, fontSize: 14),
        );
      case CandidacyQuestionType.rating:
        return Row(
          children: List.generate(5, (i) {
            final filled = i < (answer.ratingValue ?? 0);
            return Container(
              width: 20,
              height: 20,
              margin: const EdgeInsets.only(right: ChosenoSpacing.xs),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? palette.primary : Colors.transparent,
                border: Border.all(
                  color: filled ? palette.primary : palette.borderLight,
                ),
              ),
              child: Text(
                '${i + 1}',
                style: ChosenoTypography.body(
                  color: filled ? palette.textOnPrimary : palette.textMuted,
                  fontWeight: FontWeight.w700,
                  fontSize: 10,
                ),
              ),
            );
          }),
        );
      case CandidacyQuestionType.singleChoice:
      case CandidacyQuestionType.unknown:
        return Text(
          answer.optionText ?? '',
          style: ChosenoTypography.body(color: palette.textMain, fontSize: 14),
        );
    }
  }
}

/// Candidacy Wall posts: the feed plus a collapsed composer (text, photo and
/// @tags — the web has no video attach here).
class _CandidacyPosts extends ConsumerWidget {
  const _CandidacyPosts({required this.candidateId, required this.detail});

  final String candidateId;
  final CandidacyDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ChosenoTheme.of(context);
    final key = (candidateId: candidateId, politicianId: detail.politicianId);
    final postsAsync = ref.watch(candidacyPostsProvider(key));
    final me = ref.watch(ownProfileProvider).value;
    final isOwner = me != null && me.id == detail.politicianId;
    final first = detail.fullName.split(' ').first;

    Future<void> openComposer() async {
      if (me?.currentGhostId == null) return;
      if (!await ensureTermsAccepted(context)) return;
      if (!context.mounted) return;
      await showPostComposerSheet(
        context,
        hint: isOwner
            ? 'Post an update to your candidacy wall… Type @ to tag a politician'
            : 'Leave a post or message for $first… Type @ to tag a politician',
        ghostId: me!.currentGhostId!,
        viewerCountry: me.country,
        onSubmit: (PostDraft draft) async {
          final result = await ref
              .read(politicianWallRepositoryProvider)
              .createCandidatePost(candidateId, me.currentGhostId!, draft);
          final ok = result.when(ok: (_) => true, err: (_) => false);
          if (ok) ref.invalidate(candidacyPostsProvider(key));
          return ok;
        },
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(
          icon: Icons.forum_outlined,
          title: 'Posts',
          subtitle: 'Updates and messages on this candidacy.',
        ),
        const SizedBox(height: ChosenoSpacing.md),
        InkWell(
          borderRadius: BorderRadius.circular(ChosenoRadii.card),
          onTap: openComposer,
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
                        ? 'Post an update to your candidacy wall…'
                        : 'Leave a post or message for $first…',
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 14,
                    ),
                  ),
                ),
                Icon(Icons.image_outlined, size: 18, color: palette.textMuted),
              ],
            ),
          ),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        postsAsync.when(
          data: (posts) => posts.isEmpty
              ? const EmptyState(
                  icon: Icons.chat_bubble_outline,
                  title: 'No posts yet',
                  message: 'Posts on this candidacy will show up here.',
                )
              : Column(
                  children: [
                    for (final p in posts)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: ChosenoSpacing.md,
                        ),
                        child: WallPostTile(post: p),
                      ),
                  ],
                ),
          loading: () => const Padding(
            padding: EdgeInsets.all(ChosenoSpacing.lg),
            child: Center(child: LoadingIndicator()),
          ),
          error: (_, _) => Text(
            'Could not load posts.',
            style: ChosenoTypography.body(color: palette.danger),
          ),
        ),
      ],
    );
  }
}
