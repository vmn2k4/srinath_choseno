// Port of `NodeCard` (src/components/features/RepresentationBranchTree.tsx).
// Doesn't yet port the report-incorrect-info flag button (ReportDialog,
// §5's shared widget list) — add once the Moderation domain exists.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../domain/elections/entities/branch_holder_node.dart';

class BranchHolderCard extends StatelessWidget {
  const BranchHolderCard({
    super.key,
    required this.node,
    this.emphasized = false,
    this.onViewWall,
  });

  final BranchHolderNode node;
  final bool emphasized;
  final VoidCallback? onViewWall;

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return AppCard(
      variant: AppCardVariant.row,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              AppAvatar(
                imageUrl: node.photoUrl,
                fallbackText: node.fullName,
                radius: emphasized ? 24 : 18,
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      node.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: ChosenoSpacing.xs,
                      runSpacing: 4,
                      children: [
                        AppBadge(
                          label: node.roleTitle,
                          tone: AppBadgeTone.primary,
                          size: AppBadgeSize.xs,
                        ),
                        if (node.partyName != null)
                          AppBadge(
                            label: node.partyName!,
                            tone: AppBadgeTone.neutral,
                            size: AppBadgeSize.xs,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (node.boundaryName != null) ...[
            const SizedBox(height: ChosenoSpacing.xs),
            Text(
              node.boundaryName!,
              style: ChosenoTypography.body(
                color: palette.textDark,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: ChosenoSpacing.sm),
          Wrap(
            spacing: ChosenoSpacing.md,
            runSpacing: ChosenoSpacing.xs,
            children: [
              if (node.contactEmail != null)
                _ContactLink(
                  icon: Icons.mail_outline,
                  label: 'Email',
                  onTap: () => _launch('mailto:${node.contactEmail}'),
                ),
              if (node.contactPhone != null)
                _ContactLink(
                  icon: Icons.call_outlined,
                  label: 'Call',
                  onTap: () => _launch('tel:${node.contactPhone}'),
                ),
              if (node.sourceUrl != null)
                _ContactLink(
                  icon: Icons.open_in_new,
                  label: 'Official',
                  onTap: () => _launch(node.sourceUrl!),
                ),
            ],
          ),
          if (onViewWall != null && node.ghostId != null) ...[
            const SizedBox(height: ChosenoSpacing.sm),
            AppButton(
              label: 'View Wall',
              variant: AppButtonVariant.text,
              onPressed: onViewWall,
            ),
          ],
        ],
      ),
    );
  }
}

class _ContactLink extends StatelessWidget {
  const _ContactLink({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: palette.textMuted),
          const SizedBox(width: 3),
          Text(
            label,
            style: ChosenoTypography.body(
              color: palette.textMuted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
