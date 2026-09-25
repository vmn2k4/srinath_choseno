# Choseno Mobile

Flutter companion app to the Choseno website. Start here:

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Clean Architecture layering (`core`/`domain`/
  `data`/`presentation`), what each folder is for, and how to add a new feature.
- **[DESIGN.md](DESIGN.md)** — the visual design system (colors, fonts, spacing, the shared
  component library) and the one rule that matters: everything reads from
  `lib/core/theme/theme_config.dart`, nothing is hardcoded at the call site.
- **[../docs/FLUTTER_MOBILE_APP_GUIDE.md](../docs/FLUTTER_MOBILE_APP_GUIDE.md)** (parent
  repo) — the full screen-by-screen build plan this app implements: every screen, its
  website source, and its exact data/RPC mapping.

## Getting started

```bash
cp .env.example .env   # fill in your Supabase project's URL + anon key
flutter pub get
flutter run
```

## Status

The Auth feature (sign in / sign up / sign out) is fully built end-to-end as the reference
implementation for every layer — see ARCHITECTURE.md's "Worked example" section. Everything
else in the Flutter guide's screen inventory is not yet built; add it following
ARCHITECTURE.md's "How to add the next feature" steps.
