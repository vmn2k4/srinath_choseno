// The chain of representation as an org-chart style tree: one collapsible
// section per level of government (Federal, Provincial, Municipal, School…),
// the head of that level on top (Prime Minister, Premier, Mayor), and the
// rest branching below on a connector line. Rows are compact — tap one to
// open that person's wall.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/branch_holder_node.dart';
import '../../../../domain/elections/entities/representation_branch.dart';

/// Members shown under a head before "+ N more".
const _initialMembers = 3;

class RepresentationTree extends StatelessWidget {
  const RepresentationTree({
    super.key,
    required this.branches,
    required this.onOpen,
  });

  final List<RepresentationBranch> branches;
  final void Function(BranchHolderNode node) onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final b in branches) _BranchSection(branch: b, onOpen: onOpen),
      ],
    );
  }
}

class _BranchSection extends StatefulWidget {
  const _BranchSection({required this.branch, required this.onOpen});

  final RepresentationBranch branch;
  final void Function(BranchHolderNode node) onOpen;

  @override
  State<_BranchSection> createState() => _BranchSectionState();
}

class _BranchSectionState extends State<_BranchSection> {
  bool _open = true;
  bool _showAll = false;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final b = widget.branch;
    final members = b.bottom;
    final visible = _showAll ? members : members.take(_initialMembers).toList();
    final hidden = members.length - visible.length;
    final count = members.length + (b.top != null ? 1 : 0);
    final title = [
      b.label,
      if (b.districtName != null) b.districtName!,
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(ChosenoRadii.card),
        border: Border.all(color: palette.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(ChosenoRadii.card),
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ChosenoSpacing.md,
                vertical: ChosenoSpacing.sm + 4,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ChosenoTypography.body(
                        color: palette.textTertiary,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ).copyWith(letterSpacing: 0.6),
                    ),
                  ),
                  Text(
                    '$count',
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(width: ChosenoSpacing.xs),
                  Icon(
                    _open
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    size: 20,
                    color: palette.textMuted,
                  ),
                ],
              ),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.md,
                0,
                ChosenoSpacing.md,
                ChosenoSpacing.sm + 2,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (b.top != null)
                    _PersonRow(
                      node: b.top!,
                      head: true,
                      onTap: () => widget.onOpen(b.top!),
                    ),
                  if (members.isNotEmpty)
                    Padding(
                      // Lines hang from the head's avatar centre (radius 20).
                      padding: EdgeInsets.only(left: b.top != null ? 19 : 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < visible.length; i++)
                            _TreeBranch(
                              last: i == visible.length - 1 && hidden == 0,
                              drawn: b.top != null,
                              child: _PersonRow(
                                node: visible[i],
                                onTap: () => widget.onOpen(visible[i]),
                              ),
                            ),
                          if (hidden > 0 ||
                              (_showAll && members.length > _initialMembers))
                            _TreeBranch(
                              last: true,
                              drawn: b.top != null,
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: AppButton(
                                  label: _showAll
                                      ? 'Show fewer'
                                      : '+ $hidden more',
                                  variant: AppButtonVariant.text,
                                  onPressed: () =>
                                      setState(() => _showAll = !_showAll),
                                ),
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

/// One child of a head: indented, with the vertical trunk and a horizontal
/// tick into the row. The last child's trunk stops at the tick (an elbow).
class _TreeBranch extends StatelessWidget {
  const _TreeBranch({
    required this.child,
    required this.last,
    required this.drawn,
  });

  final Widget child;
  final bool last;
  final bool drawn;

  @override
  Widget build(BuildContext context) {
    if (!drawn) return child;
    final palette = ChosenoTheme.of(context);
    return Stack(
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: _ConnectorPainter(color: palette.border, last: last),
          ),
        ),
        Padding(padding: const EdgeInsets.only(left: 20), child: child),
      ],
    );
  }
}

class _ConnectorPainter extends CustomPainter {
  _ConnectorPainter({required this.color, required this.last});

  final Color color;
  final bool last;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    final mid = size.height / 2;
    // Trunk (x = 0): full height, or down to the tick for the last child.
    canvas.drawLine(Offset(0, 0), Offset(0, last ? mid : size.height), paint);
    // Tick into the row.
    canvas.drawLine(Offset(0, mid), Offset(14, mid), paint);
  }

  @override
  bool shouldRepaint(_ConnectorPainter old) =>
      old.color != color || old.last != last;
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.node,
    required this.onTap,
    this.head = false,
  });

  final BranchHolderNode node;
  final bool head;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final avatar = head ? 20.0 : 16.0;
    return InkWell(
      borderRadius: BorderRadius.circular(ChosenoRadii.sm),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: ChosenoSpacing.xs + 2),
        child: Row(
          children: [
            AppAvatar(
              imageUrl: node.photoUrl,
              fallbackText: node.fullName,
              radius: avatar,
            ),
            const SizedBox(width: ChosenoSpacing.sm + 2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    node.fullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ChosenoTypography.body(
                      color: palette.textMain,
                      fontWeight: FontWeight.w600,
                      fontSize: head ? 15 : 14,
                    ),
                  ),
                  Text(
                    [
                      node.roleTitle,
                      if (node.partyName != null) node.partyName!,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: ChosenoSpacing.xs),
            Icon(Icons.chevron_right, size: 18, color: palette.textDark),
          ],
        ),
      ),
    );
  }
}
