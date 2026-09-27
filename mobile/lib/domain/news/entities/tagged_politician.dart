import 'package:flutter/foundation.dart';

/// One row of `news_article_politicians` joined to the tagged profile —
/// port of the shape `NewsArticleLinkedPoliticians`/`NewsArticleDetailClient`
/// read on web (`getNewsArticleBySlug`'s join). Just enough to render an
/// avatar + name + "Rate" entry point; the web's fuller shape (designation,
/// constituency, contact info) isn't needed for that.
@immutable
class TaggedPolitician {
  const TaggedPolitician({
    required this.id,
    required this.fullName,
    this.photoUrl,
    this.wallSlug,
  });

  final String id;
  final String fullName;
  final String? photoUrl;
  final String? wallSlug;
}
