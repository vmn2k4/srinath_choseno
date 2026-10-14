import 'package:flutter/foundation.dart';

import 'comment.dart';

/// A `posts` row — shared by the Politician Wall's post feed and Feed
/// (§4.D), mirroring the website's single `PostCard` component rendering
/// both (docs/FLUTTER_MOBILE_APP_GUIDE.md §5 in the parent repo). Voting
/// fields are carried even though only Feed turns the vote-bar on —
/// Wall/Candidacy Wall posts simply never call the vote action, same as
/// the web.
@immutable
class Post {
  const Post({
    required this.id,
    required this.ghostId,
    required this.content,
    required this.createdAt,
    this.imageUrl,
    this.videoUrl,
    this.likesCount = 0,
    this.dislikesCount = 0,
    this.comments = const [],
    this.newsArticleSlug,
    this.newsDate,
    this.isNews = false,
    this.linkUrl,
    this.linkTitle,
    this.linkDescription,
    this.linkImage,
  });

  final String id;
  final String ghostId;
  final String content;
  final DateTime createdAt;
  final String? imageUrl;
  final String? videoUrl;
  final int likesCount;
  final int dislikesCount;
  final List<Comment> comments;

  /// A news article mirrored into this wall as a post (`news_article_id`):
  /// shown with a "News" header, the article's image and a link to it.
  final bool isNews;
  final String? newsArticleSlug;
  final DateTime? newsDate;

  /// `link_metadata` saved with the post (a pasted link's preview card).
  final String? linkUrl;
  final String? linkTitle;
  final String? linkDescription;
  final String? linkImage;

  int get commentCount => comments.length;
  int get engagementScore => likesCount + comments.length;

  Post copyWith({
    int? likesCount,
    int? dislikesCount,
    List<Comment>? comments,
  }) {
    return Post(
      id: id,
      ghostId: ghostId,
      content: content,
      createdAt: createdAt,
      imageUrl: imageUrl,
      videoUrl: videoUrl,
      likesCount: likesCount ?? this.likesCount,
      dislikesCount: dislikesCount ?? this.dislikesCount,
      comments: comments ?? this.comments,
      newsArticleSlug: newsArticleSlug,
      newsDate: newsDate,
      isNews: isNews,
      linkUrl: linkUrl,
      linkTitle: linkTitle,
      linkDescription: linkDescription,
      linkImage: linkImage,
    );
  }
}
