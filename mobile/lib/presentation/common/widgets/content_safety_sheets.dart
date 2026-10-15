// Report / block / terms dialogs shared by every place user content is shown
// or written (wall posts, comments, the composer).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../features/feed/providers/content_safety_providers.dart';
import '../../features/feed/providers/feed_repository_providers.dart';

const _reasons = <(String, String)>[
  ('spam', 'Spam'),
  ('harassment', 'Harassment'),
  ('hate_speech', 'Hate speech'),
  ('misinformation', 'Misinformation'),
  ('other', 'Something else'),
];

void _toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Asks why, files the report, and returns true when it was sent.
Future<bool> showReportSheet(
  BuildContext context,
  WidgetRef ref, {
  required String targetType,
  required String targetId,
}) async {
  final reason = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    // Scrollable and allowed to use the full height: on a short screen (or
    // with the bottom nav showing) a fixed column overflowed and cut off the
    // last reason.
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text(
                'Report this content',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text('Why are you reporting it?'),
            ),
            for (final (key, label) in _reasons)
              ListTile(
                title: Text(label),
                onTap: () => Navigator.pop(ctx, key),
              ),
          ],
        ),
      ),
    ),
  );
  if (reason == null || !context.mounted) return false;
  final result = await ref
      .read(feedRepositoryProvider)
      .reportContent(targetType, targetId, reason);
  if (!context.mounted) return false;
  return result.when(
    ok: (_) {
      _toast(context, 'Thanks — we’ll review this.');
      return true;
    },
    err: (f) {
      _toast(context, f.message);
      return false;
    },
  );
}

/// Confirms, blocks the author, and returns true when it was done.
Future<bool> confirmBlockAuthor(
  BuildContext context,
  WidgetRef ref, {
  required String targetType,
  required String targetId,
  required String ghostId,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Block this author?'),
      content: const Text(
        'You won’t see their posts or comments any more. The block ends if '
        'they reset their anonymous identity.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Block'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return false;
  final error = await ref
      .read(blockedAuthorsProvider.notifier)
      .block(targetType, targetId, ghostId);
  if (!context.mounted) return false;
  _toast(context, error ?? 'Author blocked.');
  return error == null;
}

/// True once the user has agreed to the Terms and community rules (asked once).
Future<bool> ensureTermsAccepted(BuildContext context) async {
  if (await TermsGate.accepted()) return true;
  if (!context.mounted) return false;
  final agreed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Before you post'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Be respectful. No harassment, hate speech, spam or '
            'misinformation. Posts can be reported and removed, and repeat '
            'offenders lose access.',
          ),
          TextButton(
            onPressed: () => launchUrl(
              Uri.parse('https://www.choseno.com/terms'),
              mode: LaunchMode.externalApplication,
            ),
            child: const Text('Read the Terms'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('I agree'),
        ),
      ],
    ),
  );
  if (agreed != true) return false;
  await TermsGate.accept();
  return true;
}

/// The "Report / Block author" sheet shared by every post and comment.
/// Returns true when a *post* was reported (callers hide it right away).
Future<bool> showContentActionsSheet(
  BuildContext context,
  WidgetRef ref, {
  required String targetType,
  required String targetId,
  required String ghostId,
}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.flag_outlined),
            title: Text('Report this $targetType'),
            onTap: () => Navigator.pop(ctx, 'report'),
          ),
          ListTile(
            leading: const Icon(Icons.block),
            title: const Text('Block author'),
            onTap: () => Navigator.pop(ctx, 'block'),
          ),
        ],
      ),
    ),
  );
  if (choice == null || !context.mounted) return false;
  if (choice == 'report') {
    final sent = await showReportSheet(
      context,
      ref,
      targetType: targetType,
      targetId: targetId,
    );
    return sent && targetType == 'post';
  }
  await confirmBlockAuthor(
    context,
    ref,
    targetType: targetType,
    targetId: targetId,
    ghostId: ghostId,
  );
  return false;
}
