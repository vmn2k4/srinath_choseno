# Choseno Mobile — Design System

> **Update (2026-09-18): the mobile app no longer mirrors the website's look.** The web
> palette (pale olive on maroon-black, translucent glass cards, cool-grey text, condensed
> Big Shoulders headlines) read muted and low-contrast on a phone and made every card pay for
> a backdrop blur. The app now uses **"Midnight Pulse"** (`ChosenoPalette.pulse`): near-black
> ink canvas, solid stepped surfaces, an electric-violet→orchid brand gradient
> (`ChosenoGradients`), a mint accent, Plus Jakarta Sans headlines and Inter body. Every
> text/background pair is asserted ≥ WCAG AA in `test/core/theme/theme_config_test.dart`. The
> web palette is kept as `ChosenoPalette.civicOriginal` for reference/a future switcher. The
> token *names*, the one-rule ("no literals outside `theme_config.dart`") and the component
> rules below still apply; the color table further down documents the ORIGINAL web port, not
> the values in use — read `theme_config.dart` for those.
>
> Feel rules that go with it: every tappable surface uses `Pressable` (springy press scale),
> loading states show `Skeleton*` shapes rather than a lone spinner, list items enter with
> `FadeSlideIn`, and taps/tab changes fire `AppHaptics`.

The mobile app's original visual identity was the website's, ported. Every
color, font, and shape value below is a direct port of the parent repo's
[DESIGN.md](../DESIGN.md) and `src/app/globals.css` (verified against the live source
2026-09-17). For which *screens* to build and their data/RPC mapping, see
[docs/FLUTTER_MOBILE_APP_GUIDE.md](../docs/FLUTTER_MOBILE_APP_GUIDE.md) in the parent repo —
this document is about how things should *look*, not what exists.

## The one rule that matters

**Every color, font, radius, and spacing value comes from
[`lib/core/theme/theme_config.dart`](lib/core/theme/theme_config.dart) — nothing else.**
No `Color(0xFF...)` literal, no raw `TextStyle(fontFamily: 'Public Sans')`, no hand-picked
`EdgeInsets.all(17)` in screen or widget code. If a value doesn't have a token yet, add one
to `theme_config.dart` — don't inline it at the call site. This is the mobile restatement of
the website's DESIGN.md rule #1 ("every color is a semantic CSS variable, never a raw
value") — same philosophy, `ThemeExtension` instead of a CSS custom property.

Concretely:
- **Colors** → `ChosenoTheme.of(context).primary` (etc.) — never a literal `Color`.
- **Fonts** → `ChosenoTypography.display(...)` / `ChosenoTypography.body(...)` — never
  `GoogleFonts.xyz()` called directly outside `theme_config.dart`, and never a hardcoded
  `fontFamily` string.
- **Radii** → `ChosenoRadii.card` / `.sm` / `.full`.
- **Spacing** → `ChosenoSpacing.xs` / `.sm` / `.md` / `.lg` / `.xl` / `.xxl`.
- **Shadows** → `ChosenoShadows.elevatedMd(palette)` / `.elevatedLg(...)` / `.elevatedXl(...)`.

`lib/core/theme/app_theme.dart` is the only file allowed to turn these tokens into a
Flutter `ThemeData` — every widget reaches the tokens through `Theme.of(context)` (via the
`ChosenoTheme.of(context)` convenience accessor), never by importing `theme_config.dart`'s
palette constant directly inside a screen.

## Colors

Ported 1:1 from the website's default **"civic-original"** theme (`src/app/globals.css`'s
`@theme` block). Field names in `ChosenoPalette` match the CSS custom-property names exactly
(`primary` ↔ `--color-primary`, `surfaceHover` ↔ `--color-surface-hover`, etc.) so porting a
new value is a mechanical lookup, not a judgment call.

| Token | Hex | Role |
|---|---|---|
| `background` | `#14080E` | Page canvas |
| `surface` | `#201A24` | Container background, one step up from the page |
| `surfaceHover` / `surfaceActive` | `#322B37` / `#443C4C` | Interactive surface states |
| `surfaceElevated` | `#49475B` @ 35% | Glass-card fill (see Elevation below) |
| `border` / `borderLight` | `#3C3543` / cool-steel @ 25% | Hairline dividers, glass-card edges |
| `textMain` | `#F4F5F0` | Primary text |
| `textSecondary` / `textTertiary` / `textMuted` | vanilla-custard / muted-olive / cool-steel | Brightness ladder, high → low emphasis |
| `textDark` / `textDarker` | `#49475B` / `#2F2D3D` | Barely-visible decorative icon tint |
| `primary` / `primaryHover` / `primaryLight` / `primaryLighter` | vanilla-custard `#E9EB9E` and its ramp | Brand accent — CTAs, active nav, primary highlights |
| `accent` / `accentHover` | muted-olive `#ACC196` | Secondary brand tone |
| `danger` / `warning` / `caution` / `success` (+ light variants) | Tailwind rose/amber/orange/emerald 500-ish | Semantic states — constant regardless of which palette is active |
| `textOnPrimary` | `#020617` (slate-950) | Text drawn on a filled primary/warning surface — never reuse `textDarker` for this |
| `overlay` / `overlayHeavy` | black @ 25% / 95% | Scrims |
| `glassHighlight` | `#F8F9E2` (≈ primary mixed 30% into white) | Specular top-edge highlight on glass surfaces |

**Only the default palette is ported.** The website ships 13 admin-switchable themes (six
dark, six light, plus civic-original — see the parent DESIGN.md's Theming section); this app
implements `ChosenoPalette.civicOriginal` only. Porting another one later is additive, not a
restructure: copy the relevant `[data-theme="..."]` block from `src/app/globals.css`, fill in
a new `ChosenoPalette` constant the same shape as `civicOriginal`, and wire a picker that
swaps which palette `AppTheme.build()` is called with — no widget code changes, since every
widget already reads colors through the palette object, never a literal.

## Typography

- **Display** — "Big Shoulders Display" on web; the `google_fonts` package exposes the same
  variable family under `GoogleFonts.bigShoulders()` (it consolidates the width-axis cuts —
  Display, Text, Inline, Stencil — into one method rather than one per width). Headlines
  only, via `ChosenoTypography.display(...)`.
- **Body** — "Public Sans" via `GoogleFonts.publicSans()`, wrapped as
  `ChosenoTypography.body(...)`. Everything that isn't a headline: body copy, labels,
  buttons, form fields.

Both load over the network via `google_fonts` (with on-device caching after first load)
rather than bundling the website's self-hosted `.woff2` files — same visual typeface, no
binary font assets to keep in sync in this repo. If the app ever needs guaranteed offline
first-launch rendering, revisit this by vendoring the font files as Flutter assets instead;
not a concern for the current build.

## Shape & spacing

- **Radii**: `24px` cards (`ChosenoRadii.card`), `8px` small controls (`.sm`), fully round for
  pills/avatars only, never a card (`.full`) — ported directly from the website's Shapes
  section.
- **Spacing**: only `16px` (`ChosenoSpacing.md`) has a named web equivalent (DESIGN.md's
  Spacing section defines just that one value). The rest of the scale (`xs`=4, `sm`=8,
  `lg`=24, `xl`=32, `xxl`=48) is a standard 8pt-grid extension around it — a mobile-specific
  addition, not a web value that was overlooked, since a touch UI needs a fuller spacing
  scale than the web's single named token.

## Elevation & glassmorphism

The website's four-level `elevation-N` system (DESIGN.md's Elevation & Glassmorphism
section) is approximated, not reproduced exactly — CSS's `backdrop-filter: blur() saturate()`
plus an inset specular highlight has no pixel-identical Flutter equivalent. The port:

1. **Blur** → `BackdropFilter(filter: ImageFilter.blur(...))` inside `AppCard`
   (`lib/core/widgets/app_card.dart`) — `AppCardVariant.hero` uses a stronger blur (closer to
   web's elevation-3/4) than `AppCardVariant.row` (web's elevation-1, cheap/repeated).
2. **Saturation boost** — not currently ported (Flutter has no direct `saturate()` filter
   composable with a blur as cheaply as CSS does). Revisit with a `ColorFilter` matrix if the
   flat blur reads noticeably different from the web once real content is behind it.
3. **Specular top-edge highlight** → approximated as a short top-aligned gradient
   (`glassHighlight` fading to transparent) inside `AppCard`'s decoration, standing in for
   CSS's `inset 0 1px 0` box-shadow layer, which `BoxDecoration` can't express directly.
4. **Shadows** → `ChosenoShadows.elevatedMd/Lg/Xl` (`theme_config.dart`) — neutral, offset,
   never a colored glow, matching the website's explicit "shadows are always neutral and
   offset" rule.

`AppCardVariant.dashed` (empty states / drop targets) skips the blur entirely and draws a
dashed border instead — matches the website's `Card` `dashed` variant, which is also a flat,
non-glass surface.

## Shared component library (`lib/core/widgets/`)

One file per component, one barrel export (`widgets.dart`) — mirrors the website's single
import point at `src/components/ui/index.js` (DESIGN.md's Components section: "change a
component here and it changes everywhere it's used"). A screen imports
`package:choseno_mobile/core/widgets/widgets.dart`, never an individual widget file, and
never hand-rolls a substitute.

| Widget | Ports | Notes |
|---|---|---|
| `AppCard` | `Card.jsx` | Variants: `standard`, `hero`, `row`, `dashed` — see Elevation above |
| `AppButton` | `Button.jsx` | Variants: `primary`, `outline`, `text`, `icon` (+ `.icon()` constructor); `AppButtonTone`: `primary`/`danger`/`success`/`defaultTone` |
| `AppBadge` | `Badge.jsx` | Every status/role pill — `AppBadgeTone` for semantic color, `AppBadgeSize` (`xs2`/`xs`/`sm`) for the tight-inline-space cases the website added a "2xs" size for (see the parent repo's `Badge.tsx` — the Community Support panel's "Leading"/"Tied" badges) |
| `AppTextField` | `Input.jsx` | Solid/opaque, never glassy — form controls prioritize clarity over atmosphere, same as web |
| `LoadingIndicator` | `Spinner.jsx` | Themed to the active palette's `primary`, not Flutter's default indicator color |

Still unported (add when the screen that needs it is built — see
`docs/FLUTTER_MOBILE_APP_GUIDE.md` §5 in the parent repo for the full shared-widget list):
`Modal`, `EmptyState`, `PageHeader`, `Select`, `ContainerScroll`, and the elections-domain
widgets (`AnswerValueWidget`, `PostCardWidget`, `VideoRecorderWidget`, `BioLinksRow`, etc.).

## Layout conventions

Not yet enforced by any shared layout widget (no screen exists yet that needs it) — noted
here so the first dashboard-style screen (Feed) establishes the right pattern instead of
inventing one ad hoc. The website's convention (DESIGN.md's Layout section): dashboard-style
pages use the full viewport width with a fixed horizontal gutter, never a centered
`max-width` column; only single-column reading/input surfaces (auth, onboarding, a long
questionnaire, any modal) get a fixed comfortable width. `sign_in_screen.dart` already
follows the single-column half of this rule (`ConstrainedBox(maxWidth: 420)`) — the
full-width dashboard half has no port yet since no dashboard screen exists.

## What's deliberately not addressed yet

- **Dark/light mode**: the app is dark-only right now (matching the website's default
  theme, which is dark). The website has six light palettes; this app has no light-mode
  equivalent and no `MediaQuery.platformBrightnessOf` handling yet.
- **Accessibility scaling**: `docs/FLUTTER_MOBILE_APP_GUIDE.md`'s §8 native-UX section
  (parent repo) recommends respecting system text-size/reduced-motion settings — not yet
  implemented in `theme_config.dart`/`app_theme.dart`.
- **Animation/motion tokens**: the website has no dedicated motion-token system to port
  (per its own DESIGN.md); this app has none either. Revisit only if/when the parent guide's
  §8 native-motion recommendations (haptics, swipe gestures, etc.) are implemented.
