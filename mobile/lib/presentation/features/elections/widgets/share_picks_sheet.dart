// Port of PickShareDialog.tsx — "Share my picks". Choose one or more
// candidates in a race, add an optional note per pick, get a choseno.com/p/
// <code> link (whose preview image is rendered server-side) and hand it to
// the OS share sheet. Signed-in only on mobile (no anonymous supporter id).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/config/site_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_candidate.dart';
import '../../politician_ratings/providers/politician_ratings_providers.dart';
import '../providers/elections_providers.dart';
import '../providers/seat_detail_providers.dart';

const _noteMax = 140;
const _nameMax = 40;

String joinNames(List<String> names) {
  if (names.length <= 1) return names.isEmpty ? '' : names.first;
  if (names.length == 2) return '${names[0]} and ${names[1]}';
  return '${names.sublist(0, names.length - 1).join(', ')}, and ${names.last}';
}

Future<void> showSharePicksSheet(
  BuildContext context, {
  required String seatId,
  required String roleTitle,
  String? place,
  required List<ElectionCandidate> candidates,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SharePicksSheet(
        seatId: seatId,
        roleTitle: roleTitle,
        place: place,
        candidates: candidates,
      ),
    ),
  );
}

class SharePicksSheet extends ConsumerStatefulWidget {
  const SharePicksSheet({
    super.key,
    required this.seatId,
    required this.roleTitle,
    required this.candidates,
    this.place,
  });

  final String seatId;
  final String roleTitle;
  final String? place;
  final List<ElectionCandidate> candidates;

  @override
  ConsumerState<SharePicksSheet> createState() => _SharePicksSheetState();
}

class _SharePicksSheetState extends ConsumerState<SharePicksSheet> {
  final _picked = <String>[]; // candidacy ids, in the order chosen
  final _notes = <String, TextEditingController>{};
  final _nameController = TextEditingController();
  bool _alsoSupport = true;
  bool _alsoReview = true;
  bool _submitting = false;
  String? _error;
  String? _code;

  @override
  void dispose() {
    for (final c in _notes.values) {
      c.dispose();
    }
    _nameController.dispose();
    super.dispose();
  }

  ElectionCandidate _byId(String id) =>
      widget.candidates.firstWhere((c) => c.id == id);

  String _note(String id) => (_notes[id]?.text ?? '').trim();

  void _toggle(String id) => setState(() {
    if (_picked.remove(id)) return;
    _picked.add(id);
    _notes.putIfAbsent(id, TextEditingController.new);
  });

  Future<void> _create() async {
    if (_picked.isEmpty || _submitting) return;
    for (final id in _picked) {
      if (RegExp(
        r'https?://|www\.',
        caseSensitive: false,
      ).hasMatch(_note(id))) {
        setState(() => _error = 'Please leave links out of your messages.');
        return;
      }
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final repo = ref.read(electionsRepositoryProvider);
    final result = await repo.createRacePickShare(
      seatId: widget.seatId,
      picks: [for (final id in _picked) (candidateId: id, note: _note(id))],
      authorLabel: _nameController.text.trim(),
    );
    if (!mounted) return;
    final code = result.when(ok: (c) => c, err: (f) => null);
    if (code == null) {
      setState(() {
        _submitting = false;
        _error = result.when(ok: (_) => null, err: (f) => f.message);
      });
      return;
    }
    setState(() {
      _submitting = false;
      _code = code;
    });

    // Best-effort, silent follow-ups: the share already exists, so nothing
    // below may surface an error. Already-supported / recently-reviewed
    // candidates are quietly skipped or refused server-side.
    try {
      await repo.postPickShareToWalls(code);
      final controller = ref.read(
        seatDetailControllerProvider(widget.seatId).notifier,
      );
      final data = ref.read(seatDetailControllerProvider(widget.seatId)).value;
      for (final id in _picked) {
        final c = _byId(id);
        if (_alsoSupport &&
            data?.mySupportedIds.contains(c.politicianId) != true) {
          await controller.toggleSupport(c.politicianId);
        }
        if (_alsoReview && _note(id).isNotEmpty) {
          await ref
              .read(politicianRatingsRepositoryProvider)
              .upsertRating(
                politicianId: c.politicianId,
                rating: 5,
                comment: _note(id),
              );
        }
      }
    } catch (_) {
      // ignore
    }
  }

  Future<void> _share() {
    final code = _code!;
    final names = _picked.map((id) => _byId(id).fullName).toList();
    final place = widget.place;
    final headline =
        "I'm backing ${joinNames(names)} for ${widget.roleTitle}${place != null ? ' in $place' : ''}.";
    final noteLines = [
      for (final id in _picked)
        if (_note(id).isNotEmpty) '• ${_byId(id).fullName}: “${_note(id)}”',
    ];
    final url =
        '${SiteConfig.siteUrl}/p/$code?utm_source=pick_share&utm_medium=social';
    final text =
        '$headline${noteLines.isEmpty ? '' : '\n\n${noteLines.join('\n')}'}\n\nSee everyone running and make your own picks:\n$url';
    return SharePlus.instance.share(ShareParams(text: text));
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final muted = ChosenoTypography.body(
      color: palette.textMuted,
      fontSize: 12,
    );
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            ChosenoSpacing.lg,
            0,
            ChosenoSpacing.lg,
            ChosenoSpacing.md,
          ),
          child: _code != null ? _done(palette, muted) : _form(palette, muted),
        ),
      ),
    );
  }

  Widget _done(ChosenoPalette palette, TextStyle muted) {
    final names = _picked.map((id) => _byId(id).fullName).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Your picks are ready to share',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        Text(
          "You're backing ${joinNames(names)}. Send the link to friends — it opens a page showing your picks.",
          style: ChosenoTypography.body(color: palette.textMuted, fontSize: 14),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        AppButton(label: 'Share', icon: Icons.ios_share, onPressed: _share),
        const SizedBox(height: ChosenoSpacing.xs),
        AppButton(
          label: 'Done',
          variant: AppButtonVariant.outline,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }

  Widget _form(ChosenoPalette palette, TextStyle muted) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Share your picks',
          style: ChosenoTypography.display(
            color: palette.textMain,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: ChosenoSpacing.xs),
        Text(
          'Pick the candidates you support in ${widget.roleTitle}'
          '${widget.place != null ? ' (${widget.place})' : ''}. You can choose '
          'more than one, and tell people why you support each.',
          style: ChosenoTypography.body(color: palette.textMuted, fontSize: 13),
        ),
        const SizedBox(height: ChosenoSpacing.sm),
        for (final c in widget.candidates) ...[
          AppCard(
            variant: AppCardVariant.row,
            onTap: () => _toggle(c.id),
            child: Row(
              children: [
                AppAvatar(
                  imageUrl: c.avatarUrl,
                  fallbackText: c.fullName,
                  radius: 16,
                ),
                const SizedBox(width: ChosenoSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.fullName,
                        style: ChosenoTypography.body(
                          color: palette.textMain,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      if (c.partyName != null) Text(c.partyName!, style: muted),
                    ],
                  ),
                ),
                Icon(
                  _picked.contains(c.id)
                      ? Icons.check_circle
                      : Icons.circle_outlined,
                  color: _picked.contains(c.id)
                      ? palette.primary
                      : palette.textMuted,
                ),
              ],
            ),
          ),
          if (_picked.contains(c.id))
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.sm,
                ChosenoSpacing.xs,
                ChosenoSpacing.sm,
                0,
              ),
              child: TextField(
                controller: _notes[c.id],
                maxLines: 2,
                maxLength: _noteMax,
                decoration: InputDecoration(
                  hintText:
                      'Why do you support ${c.fullName.split(' ').first}? (optional, no links)',
                ),
              ),
            ),
          const SizedBox(height: ChosenoSpacing.xs),
        ],
        const SizedBox(height: ChosenoSpacing.sm),
        AppTextField(
          label: 'Your name (optional — first name or nickname)',
          controller: _nameController,
          maxLength: _nameMax,
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _alsoSupport,
          onChanged: (v) => setState(() => _alsoSupport = v ?? false),
          title: Text(
            'Also add my support for these candidates',
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _alsoReview,
          onChanged: (v) => setState(() => _alsoReview = v ?? false),
          title: Text(
            'Post my messages as 5-star reviews',
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          subtitle: Text(
            'Each message appears on that candidate\'s reviews, under your anonymous Choseno name.',
            style: muted,
          ),
        ),
        Text(
          "Your picks are your personal opinion and are shown publicly on a shareable page, and your messages are posted on each candidate's wall. Choseno doesn't endorse candidates.",
          style: ChosenoTypography.body(color: palette.textDark, fontSize: 11),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: ChosenoSpacing.sm),
            child: Text(
              _error!,
              style: ChosenoTypography.body(
                color: palette.danger,
                fontSize: 12,
              ),
            ),
          ),
        const SizedBox(height: ChosenoSpacing.sm),
        AppButton(
          label: 'Create share${_picked.isEmpty ? '' : ' (${_picked.length})'}',
          loading: _submitting,
          onPressed: _picked.isEmpty || _submitting ? null : _create,
        ),
      ],
    );
  }
}
