---
name: Choseno
description: Anonymous Civic Social Platform
colors:
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

Choseno combines dark atmospheric glassmorphism with high-contrast, modern typography and vibrant accent tones to evoke trust, privacy, and community ownership. 

## Colors

- **Primary Accent** (`#e9eb9e` / Vanilla Custard): Used for CTAs, primary highlights, and active states.
- **Secondary Accent** (`#acc196` / Muted Olive): Used for secondary buttons, boundary tags, and subtle indicators.
- **Cool Steel** (`#799496`): Used for muted text and secondary icons.
- **Surface** (`#201a24` / Deep Purple-Black): Primary container background color.
- **Background** (`#14080e` / Coffee Bean): Page background.

## Typography

**Display Font:** `Big Shoulders Display` — a condensed, high-contrast civic/signage face for headlines, echoing municipal wayfinding type.
**Body Font:** `Public Sans` — the USWDS/18F government-services typeface, chosen for its civic-institutional pedigree and accessible readability.

## Layout

Responsive multi-column grid with glassmorphic elevated containers (`backdrop-blur-md`, `border border-white/10`).

## Elevation & Depth

Glassmorphism and subtle radial gradients deliver visual depth. Flat-by-default cards with elevated hover transforms.

Shadows are always **neutral and offset** (`--shadow-elevated-md/lg/xl`, defined in `src/index.css`) — a soft black shadow with real y-offset, never a zero-offset brand-colored glow. Colored halos read as decoration, not depth, and don't survive on this dark a background; weight, border, and surface-color shifts carry emphasis instead.

## Shapes

Rounded cards (`24px` border radius) and subtle borders (`border-white/10`). Fully round (`9999px`) is reserved for pills, avatars, and circular decorative elements (e.g. the ambient background orbs) — never for cards.

## Components

- **Glass Card:** Elevated surface container with glass backdrop-filter.
- **Buttons:** Vanilla Custard primary CTAs with smooth hover transitions.
- **Emphasis text:** Solid `--color-primary` (Vanilla Custard), never gradient-clip text — weight and size carry emphasis instead.
