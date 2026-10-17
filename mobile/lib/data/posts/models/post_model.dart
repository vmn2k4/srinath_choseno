import '../../../domain/posts/entities/comment.dart';
import '../../../domain/posts/entities/post.dart';

extension CommentMapper on Map<String, dynamic> {
  Comment toComment() {
    return Comment(
      id: this['id'] as String,
      ghostId: this['ghost_id'] as String,
      content: this['content'] as String,
      createdAt: DateTime.parse(this['created_at'] as String),
    );
  }
}

extension PostMapper on Map<String, dynamic> {
  Post toPost() {
    final rawComments = (this['comments'] as List<dynamic>?) ?? const [];
    final comments =
        rawComments
            .cast<Map<String, dynamic>>()
            .map((c) => c.toComment())
            .toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final article = this['news_articles'] as Map<String, dynamic>?;
    final meta = this['link_metadata'] as Map<String, dynamic>?;
    final newsDateStr =
        (article?['event_date'] ?? article?['published_at']) as String?;

    return Post(
      id: this['id'] as String,
      ghostId: (this['ghost_id'] ?? this['wall_ghost_id']) as String,
      content: this['content'] as String,
      createdAt: DateTime.parse(this['created_at'] as String),
      imageUrl: this['image_url'] as String?,
      videoUrl: this['video_url'] as String?,
      likesCount: (this['likes_count'] as int?) ?? 0,
      dislikesCount: (this['dislikes_count'] as int?) ?? 0,
      comments: comments,
      isNews: this['news_article_id'] != null,
      newsArticleSlug: article?['slug'] as String?,
      newsImageUrl: article?['hero_image_url'] as String?,
      newsDate: newsDateStr != null ? DateTime.tryParse(newsDateStr) : null,
      linkUrl: meta?['url'] as String?,
      linkTitle: meta?['title'] as String?,
      linkDescription: meta?['description'] as String?,
      linkImage: meta?['image'] as String?,
      linkVideo: meta?['video'] as String?,
    );
  }
}
