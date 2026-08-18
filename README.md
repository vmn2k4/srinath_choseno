# Choseno - Political Engagement Platform

**Status**: Active Development | **Last Updated**: August 17, 2026

A comprehensive civic engagement platform connecting voters with their elected officials and political information across Canada and the United States.

---

## 🎯 What is Choseno?

Choseno is a multi-jurisdictional political engagement platform that enables:

### For Voters
- 🔍 **Find Your Representatives** - Interactive map to locate elected officials at all levels
- 📰 **News & Updates** - Real-time civic news aggregated by jurisdiction
- 💬 **Engage with Politicians** - Post directly to politician walls, rate and review officials
- 🗳️ **Election Information** - Candidate profiles, questionnaires, voting resources

### For Politicians
- 📊 **Digital Presence** - Automatic walls for all elected officials
- 📝 **Constituent Engagement** - Direct communication channels with constituents
- ⭐ **Ratings & Reviews** - Public accountability through ratings system
- 🎥 **Candidate Tools** - Video pitches, detailed profiles, statement sharing

### For Administrators
- 🔐 **Secure Management** - Full RLS protection and audit trails
- 👥 **User Administration** - Role management, permissions, reporting
- 📋 **Content Moderation** - Report system with admin dashboard
- 🌍 **Geographic Data** - Boundary management and spatial queries

---

## 📚 Documentation

### Getting Started
- **[CODE_LAYERS.md](docs/CODE_LAYERS.md)** - Frontend layered architecture overview
- **[CHOSENO_ARCHITECTURE_GUIDE.md](docs/CHOSENO_ARCHITECTURE_GUIDE.md)** - Complete system architecture (database, services, data flows)

### Recent Features (August 2026)
- **[RECENT_UPDATES_2026_08_17.md](docs/RECENT_UPDATES_2026_08_17.md)** - All latest features: Search, Reporting, Sharing, News Cycle, Office Holders, SEO

### Feature Documentation
- **[NEWS_GENERATION_GUIDE.md](docs/NEWS_GENERATION_GUIDE.md)** - News ingestion pipeline and prompts
- **[SOCIAL_SHARING_AND_IMAGE_GENERATION.md](docs/SOCIAL_SHARING_AND_IMAGE_GENERATION.md)** - Dynamic OG images and sharing
- **[OFFICE_HOLDERS_FEATURE.md](docs/OFFICE_HOLDERS_FEATURE.md)** - Office holder database system
- **[OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](docs/OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md)** - Claim system for real officials
- **[DIRECTORY_QUICK_START.md](docs/DIRECTORY_QUICK_START.md)** - Find My District feature guide

### Database & Schema
- **[SCHEMA_TABLE_INDEX.md](docs/SCHEMA_TABLE_INDEX.md)** - Complete table reference
- **[SCHEMA_QUICK_START.md](docs/SCHEMA_QUICK_START.md)** - Schema overview

### News Collection
- **[NewsPrompts/NewsCollectionPrompt.md](docs/NewsPrompts/NewsCollectionPrompt.md)** - General civic news ingestion
- **[NewsPrompts/KeyLeadersNewsCollectionPrompt.md](docs/NewsPrompts/KeyLeadersNewsCollectionPrompt.md)** - Political leader news
- **[NewsPrompts/UniversalWebNewsCollectionPrompt.md](docs/NewsPrompts/UniversalWebNewsCollectionPrompt.md)** - Broad web search directive
- **[GEMINI_NEWS_SCRAPING_STANDARD.md](docs/GEMINI_NEWS_SCRAPING_STANDARD.md)** - Research methodology for news articles

### Admin & Moderation
- **[ADMIN_FEATURES.md](docs/ADMIN_FEATURES.md)** - Administrator dashboard features
- **[ROLES_AND_RESPONSIBILITIES_GUIDE.md](docs/ROLES_AND_RESPONSIBILITIES_GUIDE.md)** - User role definitions

---

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript + React
- **Styling**: Tailwind CSS + CSS Modules
- **Client Libraries**: 
  - Leaflet (maps)
  - React Markdown (article rendering)
  - Framer Motion (animations)
  - Sonner (notifications)

### Backend Stack
- **Database**: Supabase PostgreSQL with PostGIS
- **Authentication**: Supabase Auth (email/password)
- **Storage**: Supabase Storage (S3-compatible)
- **Spatial Queries**: PostGIS for boundary polygon operations
- **API**: RESTful via Supabase client, Custom RPCs for complex operations

### Deployment
- **Hosting**: Vercel (Next.js optimized)
- **Database**: Managed Supabase PostgreSQL
- **CDN**: Vercel Edge Network
- **Analytics**: Vercel Analytics
- **Search**: Full-text PostgreSQL GIN indexes

---

## 📊 Key Statistics

| Metric | Value |
|--------|-------|
| **Database Tables** | 44 |
| **Migrations Applied** | 105+ |
| **Electoral Boundaries** | 100k–500k (all countries) |
| **Office Holders** | 2,000+ (Canada: 6 provinces/territories complete) |
| **News Articles** | 500+ (continuously updated) |
| **Countries Supported** | 4 (Canada, US, India, UK) |
| **Pages** | 15+ (home, elections, news, walls, admin, etc.) |
| **Components** | 50+ (reusable UI system) |

---

## 🚀 Quick Start

### Local Development

```bash
# Clone repository
git clone <repo-url>
cd Choseno

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Run development server
pnpm dev

# Open browser
open http://localhost:3000
```

### Environment Variables

See `.env.example` for required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

---

## 📖 Code Organization

```
src/
├── app/                          # Next.js app directory (routes)
│   ├── page.tsx                 # Home page
│   ├── news/                    # News hub
│   ├── find-my-district/        # District finder
│   ├── wall/[slug]/             # Politician walls
│   ├── elections/               # Elections hub
│   ├── admin/                   # Admin dashboard
│   └── [other-pages]/           # About, auth, profile, etc.
│
├── components/                  # Reusable React components
│   ├── features/                # Feature-specific components
│   ├── primitives/              # Base UI primitives
│   └── [other-categories]/      # Organized by domain
│
├── lib/
│   ├── services/                # 🔑 Service layer (all DB access)
│   │   ├── news.ts              # Article queries
│   │   ├── elections.ts         # Candidate & election queries
│   │   ├── boundaries.ts        # Geographic queries
│   │   ├── profile.ts           # User profile queries
│   │   ├── search.ts            # Full-text search
│   │   └── [others]/            # Domain-specific queries
│   │
│   ├── supabase/                # Supabase client setup
│   ├── utils/                   # Pure helper functions
│   └── contexts/                # Global state (auth, theme)
│
├── styles/                      # Global CSS
└── [config files]
```

**🔑 Key Rule**: All Supabase calls live in `lib/services/`. Pages and components never call `supabase` directly.

---

## 🔄 Data Architecture

### Layered Architecture (Dependency → One Direction)

```
1. Routes & Shells (App.jsx, layouts/)
2. Pages (screens with local state)
3. Components (reusable UI, call services)
4. Services (all DB access via Supabase)
5. Utils (pure helpers)
6. Backend (PostgreSQL, RLS, RPCs)
```

### Key Tables

| Purpose | Tables |
|---------|--------|
| **Users** | profiles, user_locations, user_boundary_memberships |
| **Elections** | elections, election_seats, election_candidates, election_questions |
| **Geography** | map_shapes (PostGIS), countries, boundary_types, shape_containers |
| **Posts & Social** | posts, post_boundaries, comments, post_votes, ratings |
| **News** | news_articles, news_article_politicians, news_article_boundaries |
| **Office Holders** | office_holders, office_holder_wall_claims, office_holder_wall_claim_items |
| **Moderation** | content_reports, moderation_rules |
| **Admin & Config** | site_settings, designations, user_actions |

**See**: [CHOSENO_ARCHITECTURE_GUIDE.md](docs/CHOSENO_ARCHITECTURE_GUIDE.md) for complete table reference.

---

## 🎯 Current Focus (August 2026)

### Recently Completed ✅
- Search bar with full-text indexing
- Enhanced content reporting system
- Multi-platform social sharing
- 4x faster image generation
- Master news cycle with dynamic batches
- Office holder syncs (6 Canadian jurisdictions)
- SEO infrastructure (Analytics, IndexNow, sitemaps)

### In Progress 🔄
- Ontario office holders (~50%)
- Nova Scotia office holders (~30%)
- Nunavut office holders (~10%)

### Planned 📋
- Advanced search filters
- News topic clustering
- Bookmark/save features
- Push notifications
- Content performance analytics

---

## 🧪 Testing & Quality

### Code Quality Standards
- ✅ TypeScript for type safety
- ✅ Layered architecture for maintainability
- ✅ Comprehensive error handling
- ✅ Accessible markup (WCAG 2.1 AA)
- ✅ Mobile-responsive design
- ✅ Row-level security on all tables

### Testing Practices
- Unit tests for utilities
- Integration tests for services
- Manual QA for new features
- Accessibility audits (WCAG)
- Performance monitoring (Vercel Analytics)

---

## 🔐 Security

### Authentication
- Email/password with Supabase Auth
- Session-based (cookies)
- Password reset via email
- MFA ready (infrastructure in place)

### Authorization
- Row-Level Security (RLS) on all tables
- Ghost ID system for anonymity
- Admin-only operations behind RLS policies
- Audit trails for sensitive actions

### Data Privacy
- Soft deletes for user content (immutable history)
- Ghost identity rotation (burn feature)
- No tracking of IP addresses
- GDPR-compliant data handling

**See**: [CHOSENO_ARCHITECTURE_GUIDE.md - Section 5](docs/CHOSENO_ARCHITECTURE_GUIDE.md#5-row-level-security-rls) for RLS details.

---

## 📈 Performance

### Optimization Strategies
- **Request-scoped caching**: React `cache()` for deduped fetches
- **Indexed lookups**: Short-hash slugs with expression indexes
- **Parallel queries**: `Promise.all()` for independent fetches
- **Image optimization**: 4x faster generation via Vercel OG
- **Full-text search**: PostgreSQL GIN indexes on politician/article names
- **Spatial queries**: GIST indexes on PostGIS geometries

### Metrics
- Page load: ~1-2 seconds
- Search: ~50ms (indexed)
- Image generation: 500ms (edge-rendered)
- API response: <200ms (typical)

**See**: [CHOSENO_ARCHITECTURE_GUIDE.md - Section 13](docs/CHOSENO_ARCHITECTURE_GUIDE.md#13-performance-architecture--conventions) for detailed performance guide.

---

## 🛠️ Development

### Common Tasks

#### Add a New Page
1. Create file in `src/app/[route]/page.tsx`
2. Import components from `src/components/`
3. Call services from `src/lib/services/` for data
4. Use `generateMetadata()` for SEO (dynamic routes)

#### Add a New Feature Component
1. Create file in `src/components/features/[Feature].tsx`
2. Use existing primitives from `src/components/primitives/`
3. Call services (don't call `supabase` directly)
4. Add TypeScript interfaces for props

#### Query Database
1. Check if function exists in `src/lib/services/[domain].ts`
2. Use existing function if available
3. Add new function to service file (not in component)
4. Export function and use in pages/components

#### Update Schema
1. Create new migration: `supabase/migrations/[timestamp]_description.sql`
2. Define tables, columns, indexes, RLS policies
3. Run locally: `supabase db push`
4. Update type definitions: `pnpm run types`

---

## 📞 Support

### Questions About Implementation?
→ Check [RECENT_UPDATES_2026_08_17.md](docs/RECENT_UPDATES_2026_08_17.md) for latest features

### Questions About Architecture?
→ Read [CHOSENO_ARCHITECTURE_GUIDE.md](docs/CHOSENO_ARCHITECTURE_GUIDE.md)

### Questions About Layers?
→ See [CODE_LAYERS.md](docs/CODE_LAYERS.md)

### Questions About News?
→ Check [NEWS_GENERATION_GUIDE.md](docs/NEWS_GENERATION_GUIDE.md)

### Questions About Database?
→ See [SCHEMA_TABLE_INDEX.md](docs/SCHEMA_TABLE_INDEX.md)

---

## 🎓 Resources

### Internal Documentation
- Design system & component library (in-code)
- Database schema (Supabase dashboard)
- Deployment logs (Vercel dashboard)
- Analytics (Vercel Analytics)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [PostGIS Manual](https://postgis.net/documentation/)

---

## 📜 License

[Add your license here]

---

## 👥 Contributors

Choseno is developed by a dedicated team focused on civic engagement and political transparency.

---

**Last Updated**: August 17, 2026  
**Status**: ✅ Active Development  
**Next Review**: August 24, 2026
