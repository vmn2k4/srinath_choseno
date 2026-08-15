# Social Sharing & Dynamic Visual Generation Architecture

**Date**: 2026-08-15  
**Scope**: Choseno Civic News Platform (`/news`, `/news/[slug]`), Social Share Flow (X/Twitter, WhatsApp, LinkedIn, Native), Dynamic Edge Image Generation (`opengraph-image.tsx`, `@vercel/og` Satori Engine).

---

## 1. Overview

Choseno generates dynamic, editorial-quality social preview graphics for every news article. These graphics serve two distinct roles:
1. **Dynamic Social Previews (OpenGraph / Twitter Card)**: Rendered on-the-fly via Next.js App Router Edge runtime (`ImageResponse`) with custom typography, politician portrait integration, topic badges, and a direct 5-star rating callout.
2. **In-App Article Visual Briefing & News Grid**: Embedded seamlessly within the article page (right-floated with body text wrapping) and on every news card widget across `/news`.
3. **1-Click Multi-Platform Sharing**: Context-aware sharing buttons that automatically convert article topic tags and politician names into clean hashtags and format canonical URLs for social media crawlers.

---

## 2. Dynamic Image Generation (`/news/[slug]/opengraph-image.tsx`)

### 2.1 Technology & Runtime
- **Engine**: Next.js App Router Edge `ImageResponse` powered by `@vercel/og` (Satori + Yoga layout engine).
- **Dimensions**: `1200 × 630 px` (Standard OG aspect ratio `1.91:1`).
- **Caching**: Edge-cached per article slug.

### 2.2 Visual Anatomy & Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Choseno Logo SVG] CIVIC NEWS                 [CATEGORY BADGE]  ·  [DATE & LOCATION]│
├──────────────────────────────────────────────────────┬───────────────────────────────┤
│                                                      │                               │
│  Dominant Bold Headline                              │   ┌───────────────────────┐   │
│  (34px - 40px, -0.03em letter spacing)               │   │                       │   │
│                                                      │   │  Politician Headshot  │   │
│  ┌────────────────────────────────────────────────┐  │   │  (128px Circle)       │   │
│  │ 1  Crisp Takeaway Highlight 1 (Emerald #16a34a)│  │   │                       │   │
│  └────────────────────────────────────────────────┘  │   └───────────────────────┘   │
│  ┌────────────────────────────────────────────────┐  │      Politician Name          │
│  │ 2  Key Impact Highlight 2 (Blue #2563eb)       │  │      Designation / Province   │
│  └────────────────────────────────────────────────┘  │                               │
├──────────────────────────────────────────────────────┴───────────────────────────────┤
│  ★  Rate [Politician Name] today on Choseno  [★ ★ ★ ★ ★]                [Rate Now →] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Key Visual Elements
1. **Official Brand Logo**: Custom SVG dual-arc arrows with orange-to-amber gradients (`#f97316` to `#ff8c00`) matching `ChosenoLogo.tsx`.
2. **Vibrant Mesh Background**: Soft gradient background (`#fff7ed` → `#f0fdf4` → `#eff6ff`) with subtle radial glow blobs.
3. **Dominant Typography**: High-contrast headline styling (`#090d16`) with tight line height (`1.15`).
4. **Spotlight Politician Portrait**:
   - Queries `politician_profiles.photo_url` / `avatar_url` from Supabase.
   - Circular frame with 4.5px orange border and drop shadow.
   - Smart fallback: Vibrant initial letter avatar if no photographic headshot exists.
5. **Star Rating Callout**: Vector 5-star rating hook (`#fbbf24`) with dark contrasting background pill (`#0f172a` to `#311042`).

---

## 3. Social Sharing Architecture

### 3.1 Social Sharing Flow

```
User clicks "Share" or "Share on X"
       ↓
Extract Metadata & Context:
  - Canonical URL: https://www.choseno.com/news/[slug]
  - Politician Names: e.g. "David Eby", "Ravi Kahlon"
  - Topic Tags: ["David Eby", "Ravi Kahlon", "BC Politics", "Victoria", "Cabinet"]
  - Category & Province: "Policy", "BC"
       ↓
Smart Hashtag Formatting (PascalCase):
  #DavidEby #RaviKahlon #BcPolitics #Victoria #Cabinet #Policy #BC #Choseno
       ↓
Platform Routing:
  ├── X (Twitter): https://twitter.com/intent/tweet?text=...&url=...&hashtags=...
  ├── WhatsApp: https://api.whatsapp.com/send?text=...
  ├── LinkedIn: https://www.linkedin.com/sharing/share-offsite/?url=...
  ├── Native Web Share: navigator.share({ title, text, url })
  └── Quick Copy: navigator.clipboard.writeText(url) + Toast feedback
```

### 3.2 Canonical URL vs Localhost
Social platform crawlers (TwitterBot, LinkedInBot, WhatsApp/Facebook OpenGraph fetchers) cannot access private local IP addresses (`localhost:3000`).
All share buttons automatically use the production canonical domain (`https://www.choseno.com/news/[slug]`), ensuring social platforms fetch the `summary_large_image` Twitter card and OpenGraph tags to render rich media previews.

---

## 4. UI & Page Integration

### 4.1 Article Detail Page (`NewsArticleDetailClient.tsx`)
- **Right-Floated Visual Card**: On desktop (`lg`), the visual summary card floats to the right (`lg:float-right lg:w-[460px] lg:ml-8 lg:mb-6`), allowing the article body text to wrap naturally around it.
- **Mobile Responsive**: Neatly stacks below the headline on smaller screens.
- **Direct Share Actions**:
  - Top Control Bar Share Popover (X, WhatsApp, LinkedIn, Copy Link).
  - Floating card "Share This Briefing" quick action.
  - Header "Quick Copy Link" pill.

### 4.2 News Grid (`NewsPageClient.tsx`)
- **Dynamic Visual Headers**: All news cards on `/news` render their dynamic OpenGraph visual card or hero image.
- **Card-Level 1-Click Share**: Bottom action bar on every news card with instant link copy and native share triggering.

---

## 5. Metadata & SEO Configuration (`/news/[slug]/page.tsx`)

Every news article automatically generates full OpenGraph, Twitter, and Schema.org NewsArticle metadata:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const ogImageUrl = `https://www.choseno.com/news/${slug}/opengraph-image`;
  return {
    title: `${title} | Choseno Civic News`,
    description,
    keywords: tags,
    openGraph: {
      title,
      description,
      url: `https://www.choseno.com/news/${slug}`,
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
```
