import 'package:flutter/foundation.dart';

/// Everything a composer hands to a create-post call: the text plus the
/// optional photo / video URLs (already uploaded) and the politicians
/// @tagged in it. Mirrors the web's `{ content, imageUrl, videoUrl,
/// mentionedPoliticianIds }` post-creation arguments.
@immutable
class PostDraft {
  const PostDraft({
    required this.content,
    this.imageUrl,
    this.videoUrl,
    this.mentionedPoliticianIds = const [],
    this.boundaryIds = const [],
    this.linkMetadata,
  });

  final String content;

  /// Preview card for a pasted link ({title, description, image, video, url}).
  final Map<String, dynamic>? linkMetadata;
  final String? imageUrl;
  final String? videoUrl;
  final List<String> mentionedPoliticianIds;

  /// Districts (map_shape ids) a feed post goes to; empty = all of the
  /// poster's districts.
  final List<int> boundaryIds;
}

/// One entry of the composer's "Post to" dropdown.
@immutable
class PostTarget {
  const PostTarget({required this.shapeId, required this.label});

  final int shapeId;
  final String label;
}

/// A politician an @mention can resolve to (web: `searchTaggablePoliticians`).
@immutable
class TaggablePolitician {
  const TaggablePolitician({
    required this.id,
    required this.fullName,
    this.photoUrl,
    this.office,
  });

  final String id;
  final String fullName;
  final String? photoUrl;

  /// The office they currently hold, e.g. "Councillor · Potton".
  final String? office;
}
