# Hyperframes Composition Brief: Choseno

## Objective

Create a short launch-style brag video for Choseno, a civic engagement platform that connects voters directly with their elected officials.

## Output

- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds

## Source Material

- **Project root**: `/Users/vmn2k4/Coding/Choseno`
- **Primary files to reference**: 
  - `README.md` (feature overview)
  - Source website at `src/app/` (Next.js pages)
  - Feature components in `src/components/`
- **Product name**: Choseno
- **Tagline / strongest claim**: "Your representatives are here. Engage directly. Make politics local."
- **Key UI moments to recreate**:
  1. Interactive map showing district boundaries and politician pins
  2. Politician wall/profile card showing constituent engagement
  3. Voter's post landing on the wall
  4. Montage of different politician walls across regions
- **Copy that must appear verbatim**:
  - "Your Representatives Are Here" (hook scene)
  - "Know Your Representatives. Engage. Make Politics Local." (outro)
  - Politician name format: "Name • Title, District" (e.g., "Sarah Chen • MP, Vancouver West")

## Creative Direction

- **Tone preset**: polished
- **Creative direction**: Civic infrastructure. Serious about democracy. Not cynical, not idealistic — pragmatic and purposeful.
- **Interpretation**: Slower pace, longer holds, confident restraint. The video doesn't *try* to be exciting — the idea itself is exciting. Every visual moment earns its place. No hype, no generic motion graphics. Civic and grounded.
- **Angle**: "Direct democracy isn't a dream — it's a map, a profile, and a post." The hook is the direct line between voter and elected official. The video is about *agency* — you find YOUR representative (not just any politician), and you can post questions, ratings, and engagement directly to them. It's accountability made visible.
- **Hook**: A map zooms in tight to a single district. A pin drops. Cut to a name and face. The moment of discovery — you know exactly who represents you, and they're not abstract anymore. Text: "Your Representatives Are Here"
- **Outro / punchline**: A montage of 3-4 different politician walls/profiles showing the scale and diversity of the platform. Final frame: Choseno logo with tagline "Know Your Representatives. Engage. Make Politics Local."
- **Avoid**:
  - Generic SaaS language ("streamline," "connect," "engage" used as corporate buzzwords)
  - Abstract filler visuals (shapes, color washes, generic motion graphics)
  - Unrelated visual redesign (stay true to Choseno's actual site aesthetic)

## Visual Identity

- **Background**: Clean white or very light gray (#FAFAFA or #FFFFFF) — civic, professional, trustworthy.
- **Text**: Dark gray/near-black (#1F2937) for body; deep blue (#1e40af) for CTAs and highlights.
- **Accent**: Deep blue (#1e40af) — used for buttons, highlights, and map interactions. Trust and stability.
- **Display font**: Modern sans-serif (use Choseno's actual header font or clean geometric sans like Inter/Poppins as fallback)
- **Body font**: Clean sans-serif (system font stack for legibility)
- **Visual references from the project**:
  - Interactive Leaflet map with district boundaries and politician pins (hero visual)
  - Politician wall/profile UI (card layout with name, party, recent posts)
  - Post/comment UI (text input field, posted messages in feed)
  - Choseno logo and brand colors
  - Real politician names and districts from the database (use realistic-looking examples)

## Storyboard

Use `brag-plan.md` as the creative contract. Scene summary:

1. **The Hook: "Your Representatives Are Here"** — 2.5s
   - Map zooms in on a single district, district boundary highlights in blue, politician pin drops
   - Politician name and title appear: "Sarah Chen • MP, Vancouver West"
   - Audio: Music fades in gently; SFX: subtle pop/whoosh as pin lands

2. **The Wall: "Engage Directly"** — 3.5s
   - Politician's wall/profile card appears showing: name, party, photo, feed of constituent posts
   - The wall is active, showing existing engagement
   - Audio: Clean card-reveal sound; music continues steadily

3. **The Action: "Your Voice Matters"** — 3s
   - Cursor appears on text input field
   - Voter types: "Will you support the new transit proposal?"
   - Post lands in the wall feed as a new constituent message
   - Audio: Subtle typing (optional); soft success chime as post lands

4. **The Scale: "Politics Made Local"** — 3.5s
   - Montage of 3-4 different politician walls/profiles wipe past, each showing a different politician and region
   - Shows breadth and diversity of platform ecosystem
   - Audio: Smooth transition sounds; music builds slightly

5. **The Outro: "Know Your Representatives"** — 2s
   - Choseno logo on clean background
   - Text below: "Know Your Representatives. Engage. Make Politics Local."
   - Small CTA: "Visit Choseno.com"
   - Audio: Music resolves to final note

**Total**: 14.5s base (will be padded to ~18s via extended holds and transitions)

## Audio

- **Audio role**: Warm, professional support. Upbeat but purposeful forward momentum — not cinematic, not urgent, but optimistic and grounded. Startup infrastructure meets civic integrity.
- **Audio arc**: Music fades in gently during the hook, builds slightly through the wall and action scenes, swells during the montage, and resolves cleanly at the logo.
- **Music**: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM, ~88s total; use first 18s slice)
- **Music treatment**: 
  - Fade in gently under the hook (0s → ~1.5s fade-in)
  - Maintain steady mid-range volume through wall and action
  - Slight build/swell during montage reveal
  - Fade to final note / resolve at logo
- **Music cue guidance**: 
  - **Source**: Bundled preset: `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`
  - **Strong cue window**: 1.60s, 3.70s, 5.80s, 8.96s, 12.65s, 17.91s (strong beats in first 25s)
  - **Target strong moments**:
    - ~1.60s: Pin drops and politician name appears (hook moment)
    - ~5.80s: Wall card fully appears and is active
    - ~8.96s: Post lands on wall (climax moment)
    - ~17.91s: Montage scales up / final politician wall
  - **Beat grid for sequential reveals**: Politician wall cards in montage can snap to beat grid timestamps (≈0.5s apart at 114.84 BPM)
  - **Restraint**: Keep music support subtle and elegant. No aggressive swells, no impacts. The idea carries the weight.
- **Audio-reactive treatment**: Subtle. Use music RMS/bass to make:
  - The map glow or card presence subtly breathe as the beat pulses
  - Politician wall cards slightly brighten/deepen on strong beats
  - Avoid waveforms, particle systems, or heavy pulsing. Keep it sophisticated and minimal.
- **Audio-coupled moments**:
  - Hook (1.60s): Pin drop should sync to music beat + subtle SFX (light pop or chime)
  - Wall appear (5.80s): Card reveal aligns with a music beat or strong cue
  - Post landing (8.96s): Success chime / post-confirmation sound lands on a music moment
  - Montage transitions (12-18s): Each politician card transition can snap to beat grid
  - Logo reveal (final): Music resolves; no additional SFX
- **SFX selection guidance**:
  - Map interactions: **subtle pop/whoosh** as district highlights and pins drop (very light, no aggression — think notification chime, not impact)
  - Card reveal/wall appearance: **soft transition sound** or **announce-style chime** (positive, not scary)
  - Post landing: **gentle success/confirm chime** (like a notification arriving — satisfaction without harshness)
  - Typing sound: **optional and very subtle** if included; prefer omitting for polished restraint
  - Montage transitions: **minimal SFX** or let music carry; if using sounds, keep them consistent and quiet
- **SFX analysis guidance**: Reference `assets/music/sfx-analysis.md` for low-high-frequency-risk sounds; prefer calm, professional tones over bright or sharp SFX. This is civic infrastructure, not a game.
- **Exact SFX choice**: Hyperframes should choose filenames, timestamps, and volume after the visual animation is implemented. Defer to Hyperframes' expertise.
- **Audio files**: 
  - Music: Copy `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` to `composition/assets/music/`
  - SFX: Hyperframes will select and copy into `composition/assets/sfx/` after choosing implementations

## Hyperframes Instructions

- Load the Hyperframes domain skills: `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`.
- `/brag` is its own workflow — do not enter the Hyperframes entry-point intent interview or route into the generic promo/launch-video workflow.
- Prefer native Hyperframes conventions over hardcoded `/brag` templates.

**Requirements**:
- Show at least one real UI element from Choseno: the interactive map with district boundaries and politician pins is the hero visual. Politician walls and post feed are secondary.
- Keep all text readable (especially politician names and district info, and the outro tagline).
- Keep the video within 15-25 seconds (target: 18s).
- Include the planned music layer and SFX accents as described above.
- Treat music cue metadata as optional timing hints — Hyperframes decides exact animation timing based on readability and story pacing. Major reveals may move within ±0.15s of a strong cue; smaller entrances within ±0.10s of a beat.
- Use SFX to support motion and interaction (card sounds for card reveals, chimes for positive moments, light pops for map interactions). Avoid excessive sound density.
- Honor planned music treatment (fade-in, steady support, swell at montage, resolution at logo). Use audio-reactive visuals for subtle, brand-specific motion where appropriate.
- Use local assets for audio and any runtime dependencies.
- Run `hyperframes check` before render — it is the single gate for delivery.

## Notes for Hyperframes Implementer

- **Map recreation**: The interactive map is the strongest visual. Show district boundaries (light gray), highlight one district in blue, and drop a politician pin at the center. This is the centerpiece of Scene 1.
- **Politician wall UI**: Recreate as a clean card showing politician name, party/title, photo, and a feed of constituent posts below. Keep it simple and readable — this is real product UI, not a stylized mockup.
- **Post animation**: When the voter's post lands on the wall, it should feel like a natural arrival (not a jarring insert). A subtle slide or fade-in with a soft success sound will work well.
- **Montage pacing**: In Scene 4, each politician wall should occupy roughly 0.7-1s on screen before the next wipes in. This gives viewers enough time to register the different politicians/regions without feeling rushed.
- **Restraint**: Every motion should feel purposeful. This is polished, civic-minded content — not flashy startup energy.
