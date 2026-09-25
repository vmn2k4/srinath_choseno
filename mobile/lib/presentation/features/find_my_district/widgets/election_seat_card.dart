// Port of the "2026 Candidates in Your Area" seat card
// (FindMyDistrictClient.tsx, parent repo). Tapping should open Seat Detail
// (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.A.7) — not yet built, so [onTap]
// is nullable and the caller shows a "not yet built" message meanwhile.
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';

class ElectionSeatCard extends StatelessWidget {
  const ElectionSeatCard({super.key, required this.seat, this.onTap});

  final ElectionSeatSummary seat;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final dateLabel = seat.electionDate != null
        ? DateFormat.yMMMd().format(seat.electionDate!)
        : null;

    return AppCard(
      variant: AppCardVariant.row,
      padding: const EdgeInsets.all(ChosenoSpacing.md + 2),
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  seat.roleTitle,
                  style: ChosenoTypography.body(
                    color: palette.textMain,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 2),
                if (seat.boundaryName != null)
                  Text(
                    seat.boundaryName!,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                if (dateLabel != null)
                  Text(
                    dateLabel,
                    style: ChosenoTypography.body(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ChosenoSpacing.md,
              vertical: ChosenoSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: palette.primary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(ChosenoRadii.full),
            ),
            child: Row(
              children: [
                Icon(Icons.groups_outlined, size: 16, color: palette.primary),
                const SizedBox(width: 6),
                Text(
                  '${seat.candidateCount}',
                  style: ChosenoTypography.body(
                    color: palette.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
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
