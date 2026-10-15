import 'package:flutter/foundation.dart';

import 'post.dart';

/// A single post opened from a shared link: the post with its comments, the
/// districts it was posted to, and whether the viewer may join its
/// conversation (people outside those districts can read but not comment).
@immutable
class PostDetail {
  const PostDetail({
    required this.post,
    required this.areaNames,
    required this.canComment,
  });

  final Post post;
  final List<String> areaNames;
  final bool canComment;

  /// "Surrey, Cloverdale" — or a generic phrase when the post has no districts.
  String get areaLabel =>
      areaNames.isEmpty ? 'this area' : areaNames.take(3).join(', ');
}
