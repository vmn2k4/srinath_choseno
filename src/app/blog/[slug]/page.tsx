import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  HelpCircle,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getRelatedBlogPosts,
} from "@/lib/services/blogs";
import { BLOG_CATEGORIES } from "@/lib/data/blogs/types";
import { SITE_URL } from "@/lib/constants/site";
import { Card, Badge, Button } from "@/components/primitives";
import BlogCard from "@/components/features/BlogCard";

const BASE_URL = SITE_URL;

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | Choseno",
      description: "The requested civic guide could not be found.",
    };
  }

  const ogImageUrl = `${BASE_URL}/blog/${slug}/opengraph-image`;

  return {
    title: `${post.metaTitle} | Choseno`,
    description: post.metaDescription,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords],
    alternates: {
      canonical: `${BASE_URL}/blog/${slug}`,
      types: {
        "application/rss+xml": `${BASE_URL}/blog/rss.xml`,
      },
    },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      url: `${BASE_URL}/blog/${slug}`,
      siteName: "Choseno",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
      images: [ogImageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const categoryMeta = BLOG_CATEGORIES.find((c) => c.slug === post.category);
  const relatedPosts = await getRelatedBlogPosts(post.slug, post.category, 3);

  const formattedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const canonicalUrl = `${BASE_URL}/blog/${post.slug}`;
  const ogImageUrl = `${BASE_URL}/blog/${post.slug}/opengraph-image`;

  // Schema.org BreadcrumbList
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Blogs", url: `${BASE_URL}/blog` },
    { name: categoryMeta?.name || post.category, url: `${BASE_URL}/blog?category=${post.category}` },
    { name: post.title, url: canonicalUrl },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: b.url,
    })),
  };

  // Schema.org BlogPosting
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    image: [ogImageUrl],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    author: {
      "@type": "Organization",
      name: "Choseno Civic Research Bureau",
      url: `${BASE_URL}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "Choseno",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.svg`,
      },
    },
    keywords: [post.primaryKeyword, ...post.secondaryKeywords].join(", "),
  };

  // Schema.org FAQPage for Google Search Rich Snippets
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 pt-6">
      {/* JSON-LD Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogPostingJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted mb-6">
        {breadcrumbItems.map((b, i) => (
          <span key={`${b.name}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
            {i === breadcrumbItems.length - 1 ? (
              <span className="font-semibold text-text-main truncate max-w-[280px] sm:max-w-none">
                {b.name}
              </span>
            ) : (
              <Link href={b.url.replace(BASE_URL, "") || "/"} className="hover:text-text-main transition-colors">
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Article Header Card */}
      <div className="bg-surface/50 border border-border-light/50 rounded-2xl p-6 sm:p-10 mb-8 shadow-sm">
        <div className="max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="primary" size="sm" className="font-semibold">
              {categoryMeta?.name || post.category}
            </Badge>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                <span>{formattedDate}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} />
                <span>{post.readingTimeMinutes} min read</span>
              </span>
            </div>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-text-main tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-base sm:text-lg text-text-muted leading-relaxed">
            {post.excerpt}
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Article Body & FAQs */}
        <article className="lg:col-span-8 space-y-8">
          {/* Key Takeaways Highlight Box */}
          <div className="p-5 sm:p-6 rounded-2xl bg-surface-elevated/70 border border-primary/25 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles size={15} />
              <span>Core Takeaways</span>
            </div>
            <ul className="space-y-2 text-sm text-text-main">
              {post.takeaways.map((takeaway, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="leading-relaxed font-medium">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Formatted Markdown Content */}
          <div className="space-y-6 text-text-main leading-relaxed">
            {post.contentMarkdown.split("\n\n").map((chunk, idx) => {
              const trimmed = chunk.trim();
              if (trimmed.startsWith("## ")) {
                return (
                  <h2
                    key={idx}
                    className="font-display font-bold text-2xl sm:text-3xl text-text-main tracking-tight pt-4 border-t border-border-light/30"
                  >
                    {trimmed.replace(/^##\s+/, "")}
                  </h2>
                );
              }
              if (trimmed.startsWith("### ")) {
                return (
                  <h3
                    key={idx}
                    className="font-display font-semibold text-xl text-text-main tracking-tight pt-2"
                  >
                    {trimmed.replace(/^###\s+/, "")}
                  </h3>
                );
              }
              if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
                const listItems = trimmed.split("\n").map((l) => l.replace(/^[\*\-]\s+/, ""));
                return (
                  <ul key={idx} className="space-y-2 pl-4 list-disc marker:text-primary text-sm sm:text-base">
                    {listItems.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                );
              }
              if (trimmed.startsWith("1. ")) {
                const listItems = trimmed.split("\n").map((l) => l.replace(/^\d+\.\s+/, ""));
                return (
                  <ol key={idx} className="space-y-2 pl-4 list-decimal marker:text-primary text-sm sm:text-base">
                    {listItems.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ol>
                );
              }
              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote
                    key={idx}
                    className="p-4 rounded-xl border-l-4 border-primary bg-surface/60 text-sm sm:text-base italic text-text-main/90"
                  >
                    {trimmed.replace(/^>\s+/, "")}
                  </blockquote>
                );
              }
              if (trimmed === "---") {
                return <hr key={idx} className="border-border-light/30 my-4" />;
              }
              return (
                <p key={idx} className="text-sm sm:text-base text-text-main/90 leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </div>

          {/* Interactive FAQs Section (FAQPage Schema target) */}
          <div className="pt-6 border-t border-border-light/40 space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-primary" />
              <h3 className="font-display font-bold text-xl sm:text-2xl text-text-main">
                Frequently Asked Questions
              </h3>
            </div>

            <div className="space-y-3">
              {post.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-border-light bg-surface/40 p-4 transition-all open:bg-surface-elevated/60"
                >
                  <summary className="cursor-pointer font-semibold text-sm sm:text-base text-text-main flex items-center justify-between gap-3 list-none">
                    <span>{faq.question}</span>
                    <ChevronRight
                      size={16}
                      className="text-text-muted transition-transform duration-200 group-open:rotate-90 shrink-0"
                    />
                  </summary>
                  <p className="mt-3 text-sm text-text-muted leading-relaxed pt-2 border-t border-border-light/30">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </article>

        {/* Right Column: Internal Links & Choseno Conversion Widgets */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
          {/* Internal Conversion Links Card */}
          <Card variant="default" padding="none" className="p-5 space-y-4 border-primary/20">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <MapPin size={14} />
              <span>Recommended Civic Tools</span>
            </div>

            <div className="space-y-3">
              {post.internalLinks.map((link, idx) => (
                <Link
                  key={idx}
                  href={link.url}
                  className="block p-3.5 rounded-xl bg-surface/70 border border-border-light hover:border-primary/40 hover:bg-surface-elevated transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-text-main group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{link.title}</span>
                      <ExternalLink size={12} className="opacity-60" />
                    </span>
                    {link.badge && (
                      <Badge tone="accent" size="sm">
                        {link.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </Card>

          {/* Privacy & Anti-Doxxing Commitment Callout */}
          <Card variant="row" padding="none" className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-main">
              <ShieldCheck size={16} className="text-primary" />
              <span>Boundary-Verified Privacy</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Every post, comment, and politician rating on Choseno is tied to un-linkable rotating Ghost IDs. Express your opinion on local governance without risk of doxxing.
            </p>
            <Link href="/about" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors">
              <span>Read About Ghost IDs</span>
              <ArrowRight size={12} />
            </Link>
          </Card>

          {/* District Action Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/15 via-surface to-accent/10 border border-primary/30 space-y-3 shadow-md">
            <h4 className="font-display font-bold text-lg text-text-main leading-snug">
              Who Represents Your Address Right Now?
            </h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Map your congressional district, state legislature, county commissioners, and school board trustees in seconds.
            </p>
            <Link href="/find-my-district" className="block pt-1">
              <Button variant="primary" className="w-full flex items-center justify-center gap-1.5 shadow-sm text-xs font-semibold">
                <MapPin size={14} />
                <span>Find My District Now</span>
              </Button>
            </Link>
          </div>
        </aside>
      </div>

      {/* Related Articles Strip */}
      {relatedPosts.length > 0 && (
        <div className="mt-16 pt-10 border-t border-border-light/40 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-2xl text-text-main">
              Related Civic Guides in {categoryMeta?.name}
            </h3>
            <Link
              href={`/blog?category=${post.category}`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View Category</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {relatedPosts.map((rPost) => (
              <BlogCard key={rPost.slug} post={rPost} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
