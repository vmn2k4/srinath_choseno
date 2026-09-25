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
    );
  }
}
