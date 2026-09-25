"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Sparkles, BookOpen, MapPin } from "lucide-react";
import { BlogPost, BLOG_CATEGORIES } from "@/lib/data/blogs/types";
import BlogCard from "@/components/features/BlogCard";
import { EmptyState, Badge, Button } from "@/components/primitives";

interface BlogHubClientProps {
  initialPosts: BlogPost[];
}

export default function BlogHubClient({ initialPosts }: BlogHubClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      const matchesCategory =
        selectedCategory === "all" || post.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        post.title.toLowerCase().includes(q) ||
        post.primaryKeyword.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.secondaryKeywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [initialPosts, selectedCategory, searchQuery]);

  const featuredPost = useMemo(() => {
    if (selectedCategory !== "all" || searchQuery.trim()) return null;
    return initialPosts.find((p) => p.featured) || initialPosts[0];
  }, [initialPosts, selectedCategory, searchQuery]);

  const gridPosts = useMemo(() => {
    if (featuredPost) {
      return filteredPosts.filter((p) => p.slug !== featuredPost.slug);
    }
    return filteredPosts;
  }, [filteredPosts, featuredPost]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Search Hero */}
      <div className="bg-surface/50 border border-border-light/50 rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Badge tone="primary" size="sm" className="font-semibold uppercase tracking-wider">
              Civic Education & Guides
            </Badge>
            <span className="text-xs text-text-muted">• 100 In-Depth Voter Resources</span>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-text-main tracking-tight leading-tight">
            The North American Civic & Election Knowledge Base
          </h1>

          <p className="text-base sm:text-lg text-text-muted leading-relaxed">
            Unpack who represents you, how government jurisdictions work, down-ballot voter vetting, and how to hold elected officials accountable—without partisan spin.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Search topics (e.g. 'who is my representative', 'zoning', 'voter ID', 'property taxes')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/80 border border-border text-text-main placeholder:text-text-muted/60 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-main"
                >
                  Clear
                </button>
              )}
            </div>

            <Link href="/find-my-district">
              <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center gap-1.5 whitespace-nowrap">
                <MapPin size={15} />
                <span>Find My District</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3.5 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
            selectedCategory === "all"
              ? "bg-primary text-text-on-primary font-semibold shadow-sm"
              : "bg-surface/80 border border-border-light text-text-muted hover:text-text-main hover:bg-surface-hover"
          }`}
        >
          All Topics ({initialPosts.length})
        </button>
        {BLOG_CATEGORIES.map((cat) => {
          const count = initialPosts.filter((p) => p.category === cat.slug).length;
          const isActive = selectedCategory === cat.slug;
          return (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-3.5 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-primary text-text-on-primary font-semibold shadow-sm"
                  : "bg-surface/80 border border-border-light text-text-muted hover:text-text-main hover:bg-surface-hover"
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Featured Post Hero (if on 'all' and no active search) */}
      {featuredPost && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <Sparkles size={14} className="text-primary" />
            <span>Featured Civic Guide</span>
          </div>
          <BlogCard post={featuredPost} featured={true} />
        </div>
      )}

      {/* Post Grid */}
      {gridPosts.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              Showing {filteredPosts.length} {filteredPosts.length === 1 ? "article" : "articles"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {gridPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No articles found"
          description={`We couldn't find any guides matching "${searchQuery}". Try searching for another topic or clear filters.`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      )}
    </div>
  );
}
