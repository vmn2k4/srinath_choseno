---
name: Choseno
description: Anonymous Civic Social Platform
colors:
  # These are the "civic-original" theme's values -- the app's :root default.
  # Choseno now ships 13 switchable themes (admin-controlled, see Theming
  # below); every other theme overrides these same variable names in
  # src/index.css. Never hardcode these hex values in a component --
  # reference the CSS variable / Tailwind token instead.
  primary: "#e9eb9e"
  accent: "#acc196"
  surface: "#201a24"
  background: "#14080e"
  text-main: "#f4f5f0"
  muted: "#799496"
typography:
  display:
    fontFamily: "Big Shoulders Display, sans-serif"
  body:
    fontFamily: "Public Sans, sans-serif"
rounded:
  card: "24px"
  sm: "8px"
  full: "9999px"
spacing:
  md: "16px"
shadow:
  elevated-md: "0 10px 30px -4px rgba(0,0,0,0.45)"
  elevated-lg: "0 14px 40px -6px rgba(0,0,0,0.5)"
  elevated-xl: "0 24px 70px -10px rgba(0,0,0,0.55)"
---

# Design System: Choseno

## Overview

**Creative North Star: "The Civic Sanctuary"**

Choseno combines atmospheric glassmorphism with high-contrast, modern typography and a single confident accent tone to evoke trust, privacy, and community ownership. The look is theme-able (see Theming below) but the *philosophy* never changes: every page is built from the same handful of shared surfaces and components, so switching a theme, or opening any page, feels like the same product — never a different site stitched on top.

## The five rules

Everything below is detail. These five rules are the actual philosophy; if a change violates one of them, it's a regression even if it "looks fine" in isolation.

1. **Every color is a semantic CSS variable, never a raw value.** No hex codes, no raw Tailwind palette classes (`bg-blue-500`, `text-slate-800`) in component code. If a color doesn't have a token yet, add one to `src/index.css`'s `@theme` block — don't inline it.
2. **Every surface goes through the shared glass recipe.** Panels, cards, empty states, modals — all of them render via `Card`, `Modal`, or `EmptyState` from `src/components/ui/`. Nobody hand-rolls a `<div>` with its own one-off `bg-*`/`border-*`/`backdrop-blur-*` combination.
3. **Every button, badge, and action goes through the shared component.** `Button` (including `variant="icon"`) and `Badge` cover every action and status-pill in the app. A raw `<button>` or a colored `<span>` badge is a sign something should have been the shared component instead.
4. **Every dashboard-style page uses the same full-width container.** `w-full max-w-none ... px-4 lg:px-8` (Feed is the reference implementation) — content should use the space the viewport actually gives it. The *only* things allowed to stay narrow are single-column forms, the auth card, onboarding, and modals, where a fixed reading width is a legibility choice, not a layout accident.
5. **The ambient background is one global layer, not a per-page decoration.** It lives once, on `body::before`, pinned to the viewport. No page or component sets its own page-level background — if it needs a background, it's transparent and lets the shared layer show through.

## Theming

Every color in the app is a CSS custom property defined once in `src/index.css`'s `@theme` block (the `civic-original` defaults) plus twelve `[data-theme="..."]` override blocks — six dark palettes that only swap `primary`/`accent`/`text-on-primary`, and six light palettes that also flip the neutral surface/border/text scale. `ThemeContext` (`src/contexts/ThemeContext.jsx`) fetches the site-wide active theme from `site_settings` on load and applies it via `document.documentElement.dataset.theme`; admins switch it from Admin → Theme (`src/pages/Admin/ThemeAdmin.jsx`), and the change is immediate and site-wide.

**Adding a 14th theme is a two-step, CSS-only change:** add its key to the `THEMES` array in `ThemeContext.jsx`, and add its matching `[data-theme="..."]` block in `index.css`. No component should ever special-case a theme name in JS — components only ever read semantic variables (`bg-primary`, `text-text-muted`, etc.), never reach for a specific theme's literal color.

## Colors

Semantic roles, not hex values — every one of these is a CSS variable that changes per theme:

- **`primary` / `primary-hover` / `primary-light` / `primary-lighter`**: the brand accent — CTAs, active nav pills, primary highlights.
- **`accent` / `accent-hover`**: secondary brand tone — secondary buttons, tags, subtle indicators.
- **`danger` / `warning` / `caution` / `success`** (+ `-light` / `-lighter` variants): semantic states, mapped onto Tailwind's built-in rose/amber/orange/emerald ramps. These stay constant across every theme — a warning is amber regardless of which brand color is active, since these carry meaning, not brand identity.
- **`surface` / `surface-hover` / `surface-active` / `surface-elevated`**: container backgrounds, each a step "up" from the page.
- **`background`**: the page canvas color, read by the ambient gradient layer (see below).
- **`text-main` / `text-secondary` / `text-tertiary` / `text-muted` / `text-dark` / `text-darker`**: a full brightness ladder for text, from full-emphasis to barely-visible decorative icon tint.
- **`text-on-primary`**: text drawn on a filled `primary`/`warning`-colored surface (e.g. button labels) — a dedicated token so it's never confused with `text-darker`'s "dim decorative icon" role.
- **`border` / `border-light`**: hairline dividers and glass-card edges.

## Typography

**Display Font:** `Big Shoulders Display` — a condensed, high-contrast civic/signage face for headlines, echoing municipal wayfinding type.
**Body Font:** `Public Sans` — the USWDS/18F government-services typeface, chosen for its civic-institutional pedigree and accessible readability.

## Layout

Dashboard-style pages (Feed, Elections, Admin, Profile, PoliticianWall, ...) use one shared container convention: `w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8`, letting content use the width the viewport actually provides rather than floating in a narrow centered column. Multi-column layouts (Feed's post column + sidebar, Election Seat's candidates + info panel) are `flex` rows inside that same full-width container — never re-capped with their own inner `max-w-*`.

The exception is genuinely single-column reading/input surfaces: the auth card, onboarding flow, a candidate's long-form questionnaire, and every modal. Those stay at a fixed comfortable reading width (`max-w-md`–`max-w-2xl`) on purpose — that's a legibility choice for continuous text and form fields, not a layout inconsistency.

## Ambient background

The radial-gradient backdrop lives on a `position: fixed`, viewport-pinned `body::before` layer (`src/index.css`), not on `body`'s own `background-image`. A background-image directly on `body` sizes itself to the page's full *scrollable content height* — the same gradient looked completely different on a tall page (lots of cards) versus a short one (a single empty state), because the gradient's "circle at top right" was scaling against a different-sized box each time. Pinning it to the viewport with `position: fixed` makes it pixel-identical on every page regardless of content length. Don't move this back onto `body`'s `background-image` — that's the bug, not a stylistic choice.

## Elevation & Glassmorphism

Glassmorphism is the app's one universal surface treatment, applied identically everywhere via `Card`, `Modal`, and `EmptyState` — never recreated ad hoc. It's built as a real physical metaphor, not just "add some blur": four `.elevation-N` utility classes (`src/index.css`) each bundle the three things that actually sell depth —

1. **Z-axis feel via blur.** Higher elevation = more blur, the way a pane of glass further from the background scatters more of what's behind it. `elevation-1` (list rows, empty states — small/repeated, cheapest) → `elevation-2` (standard cards, panels, the nav bar) → `elevation-3` (hero panels, featured cards, floating badges) → `elevation-4` (modals — the surface closest to the viewer).
2. **Light refraction via `backdrop-filter: blur() saturate()`.** Every level pairs its blur with a saturation boost (140%–180%) — the classic frosted-glass trick where colors behind the glass look richer than they really are, which is what makes it read as *glass* bending light rather than just a translucent gray box.
3. **A specular top-edge highlight** (`inset 0 1px 0 var(--color-glass-highlight)`, stacked into the same `box-shadow` as the drop shadow) — a thin bright line simulating light catching the physical edge of the glass. `--color-glass-highlight` is derived from `--color-primary` via `color-mix`, not plain white, so it stays visible instead of vanishing into a white-on-white surface on the light themes.

Pick a level by how close to the viewer a surface should feel — `Card`'s variants and every hand-placed glass surface in the app already map to one (see `Card.jsx`'s comment for the exact mapping). Never reach for a bare `backdrop-blur-*` Tailwind utility on a new surface; add it to the elevation ladder instead so the whole depth system stays coherent as the app grows.

Borders on glass surfaces are always theme-aware (`border-border-light`, never `border-white/*` — a hardcoded white border is invisible-or-wrong on the light themes).

Shadows are always **neutral and offset** (`--shadow-elevated-md/lg/xl` / `--shadow-floating`, defined in `src/index.css`) — a soft black shadow with real y-offset, never a zero-offset brand-colored glow. Colored halos read as decoration, not depth, and (being theme-dependent) are also a common place for a hardcoded color to sneak back in; weight, border, and surface-color shifts carry emphasis instead. Where a filled control's shadow does want a brand tint (e.g. the primary button's), it's built from `color-mix(in srgb, var(--color-primary) N%, transparent)` so it re-tints with the active theme instead of hardcoding one theme's glow color.

**Multi-layering** — the illusion of physical distance between a vibrant background and the glass floating over it — comes from two things working together: the ambient gradient/orb layer sits furthest back (see Ambient background, below; HomePage's orbs additionally drift via scroll-linked parallax in `ParallaxOrb`), and every glass surface's saturate boost lets that color show through richer than a flat background would, instead of just dimming it under a gray blur.

## Shapes

Rounded cards (`24px` border radius) and subtle theme-aware borders (`border-border-light`). Fully round (`9999px`) is reserved for pills, avatars, and circular decorative elements (e.g. the ambient background orbs) — never for cards.

## Components

Single import point: `src/components/ui/index.js`. Change a component here and it changes everywhere it's used — that's the point.

- **`Card`**: the one surface primitive (`default`, `hero`, `composer`, `row`, `dashed` variants) — every glass panel, composer box, list row, and dashed placeholder goes through this.
- **`Button`**: every action, including icon-only actions (`variant="icon"`, with `tone="default|danger|primary|success"`). A raw `<button>` is only acceptable for large custom selection cards (onboarding role picker, candidate-select tabs) where the visual is genuinely bespoke, not a generic action.
- **`Badge`**: every status/role/type pill (election status, candidate status, "you"/"owner" markers, boundary tags).
- **`Modal` / `StoryViewerModal`**: every full-screen overlay. `Modal` owns the scrim + centering; callers only style their own panel content.
- **`RemoveMediaButton`**: the small solid-circle "remove this attachment" affordance on image/video previews.
- **`PageHeader`**: the icon + title + subtitle + action-slot recipe for a page's top intro.
- **`Input` / `Textarea` / `Select` / `Spinner` / `EmptyState` / `ContainerScroll`**: the remaining form and state primitives — always solid/opaque (not glassy), since form controls prioritize clarity over atmosphere.
- **Emphasis text:** solid `--color-primary`, never gradient-clip text — weight and size carry emphasis instead.
