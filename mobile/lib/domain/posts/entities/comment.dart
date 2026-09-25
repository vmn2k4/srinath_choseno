import 'package:flutter/foundation.dart';

/// A `comments` row — shared by Feed, Politician Wall, and Candidacy Wall
/// threads (identical shape on web, per src/lib/services/feed.ts's own
/// comment on `createComment`).
@immutable
class Comment {
  const Comment({
    required this.id,
    required this.ghostId,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String ghostId;
  final String content;
  final DateTime createdAt;
}
