import React from "react";
import Link from "next/link";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { BlogPost, BLOG_CATEGORIES } from "@/lib/data/blogs/types";
import { Card, Badge } from "@/components/primitives";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

export default function BlogCard({ post, featured = false }: BlogCardProps) {
  const categoryMeta = BLOG_CATEGORIES.find((c) => c.slug === post.category);
  const formattedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card
      variant={featured ? "hero" : "default"}
      padding="none"
      className={`group relative flex flex-col justify-between transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 ${
        featured ? "p-6 md:p-8 bg-surface-elevated/70" : "p-5 md:p-6"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <Badge tone="primary" size="sm" className="font-semibold">
            {categoryMeta?.name || post.category}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock size={13} className="text-text-muted/70" />
            <span>{post.readingTimeMinutes} min read</span>
          </div>
        </div>

        <Link href={`/blog/${post.slug}`} className="block focus:outline-none">
          <h3
            className={`font-display font-bold text-text-main group-hover:text-primary transition-colors tracking-tight line-clamp-2 ${
              featured ? "text-2xl md:text-3xl leading-tight mb-3" : "text-xl leading-snug mb-2"
            }`}
          >
            {post.title}
          </h3>
        </Link>

        <p className="text-sm text-text-muted line-clamp-3 mb-4 leading-relaxed">
          {post.excerpt}
        </p>

        {featured && post.takeaways && (
          <div className="mb-4 space-y-1.5 p-3 rounded-xl bg-surface/60 border border-border-light/40">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
              <Sparkles size={12} />
              <span>Key Takeaway</span>
            </div>
            <p className="text-xs text-text-main/90 italic">
              &ldquo;{post.takeaways[0]}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border-light/40 flex items-center justify-between">
        <span className="text-xs text-text-muted">{formattedDate}</span>
        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors group-hover:translate-x-1 duration-200"
        >
          <span>Read Guide</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </Card>
  );
}
