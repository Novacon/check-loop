---
name: check-loop
description: Codex reviews your plans, research, and code.
colors:
  ground: "#0a0a0a"
  surface: "#141414"
  panel: "rgba(14, 14, 14, .94)"
  panel-hi: "rgba(26, 26, 26, .96)"
  paper: "#d9d9d9"
  muted: "#b8b8b8"
  faint: "#a4a4a4"
  line: "#595959"
  line-strong: "#a78794"
  steel: "#a4a4a4"
  warm: "#d9d9d9"
  accent: "#eb4f8a"
  accent-ink: "#f26b9c"
  on-accent: "#1e1e1e"
  mauve: "#a78794"
  pink-hi: "#a78794"
  positive: "#d9d9d9"
typography:
  logo:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: ".04em"
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 4.6vw, 4.8rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.04em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.01em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  code:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, monospace"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "clamp(.8125rem, .75rem + .18vw, .9375rem)"
    fontWeight: 400
    letterSpacing: ".08em"
rounded:
  none: "0"
spacing:
  gap: "clamp(14px, 2.2vh, 24px)"
  inline: "clamp(22px, 5.5vw, 75px)"
  block: "clamp(26px, 4.5vh, 75px)"
  cell: "clamp(14px, 2vh, 22px) clamp(14px, 1.4vw, 22px)"
components:
  copy-button:
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
  copy-button-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  panel-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    padding: "{spacing.cell}"
  panel-card-hover:
    backgroundColor: "{colors.panel-hi}"
  ghost-button:
    backgroundColor: "rgba(10, 10, 10, .9)"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
  command-line:
    backgroundColor: "rgba(5, 5, 5, .85)"
    textColor: "{colors.paper}"
    typography: "{typography.code}"
    padding: "8px 12px"
---

# Design System: check-loop

## Overview

**Creative North Star: "Neon After Hours"**

A charcoal room with one pink signal. The white wordmark and its traveling pink stroke are the signature; everything else is a quiet console: hairline-ruled panels, readable sans-serif prose, mono labels, and square corners. Full-screen slides snap past an ambient grid, each sharing one frame (label and heading left, lede right, equal-height panels below) so paging through feels like flipping between screens on the same terminal.

Density is high but calm. Text sits in soft grey, never pure white; contrast comes from weight (IBM Plex Sans Bold headings) rather than color. Motion is restrained: a short reveal on slide entry and a stepped glitch on the wordmark, both off under reduced motion.

**Key Characteristics:**
- Flat charcoal ground, no gradients behind content, and no rounded corners anywhere.
- 1px hairline grids (`gap: 1px` over a line-colored background) instead of cards with shadows.
- Two families: IBM Plex Sans for lowercase headings and prose; IBM Plex Mono for code and uppercase labels.
- Pink marks actions and blocking concerns; light grey marks passing outcomes. Mauve adds secondary accents, not body text.

## Colors

Five sampled swatches: charcoal #262626, grey #595959, pink #eb4f8a, mauve #a78794, and light grey #d9d9d9. The sampled charcoal is too light for the page background: use near-black #0a0a0a with darker panels. Text derivatives maintain readable contrast.

### Primary
- **Signal Pink** (`accent`): sampled #eb4f8a for headings, active rail items, slide progress, fills, and the traveling logo stroke. **Pink Ink** (`accent-ink`, #f26b9c) keeps small pink labels above 4.5:1 on charcoal and hovered panels. Dark `on-accent` text keeps pink fills readable.
- **Dusty Mauve** (`mauve`, `pink-hi`): secondary markers, stronger borders, and the end of section-label sweeps. Keep it out of small body text.

### Secondary
- **Pass Paper** (`positive`): allowed/passing outcomes, the end of the flow pipe, enabled settings, and success callout rails. Labels distinguish these states without relying on hue.

### Neutral
- **After-Hours Charcoal** (`ground`): page background.
- **Panel Smoke** (`panel`, `panel-hi`): translucent panel fills over the ambient grid; `panel-hi` on hover.
- **Console Paper** (`paper`): headings and primary text. **Muted / Faint** are opaque #b8b8b8 and #a4a4a4 for body and metadata.
- **Steel** (`steel`): readable neutral icons and code comments. **Hairline** (`line`): #595959 borders and dividers.
- **Paper Emphasis** (`warm`): neutral emphasis in code keywords, settings defaults, fix headings, and footer link hover.

### Named Rules
**The Signal-Only Rule.** Pink marks state, verdict, or action. It is never decoration. The sanctioned identity exceptions are the traveling logo stroke, section-label sweeps, and solid pink on a heading's emphasized word; nothing else gets pink because it "needs color".

**The No-White Rule.** The brightest UI text is `paper` (#d9d9d9). The white logo artwork is an identity exception. Never pure #fff.

## Typography

**Display Font:** IBM Plex Sans Bold (with system-ui)
**Body Font:** IBM Plex Sans Regular (with system-ui)
**Label/Code Font:** IBM Plex Mono Regular (with SF Mono, Menlo)
**Logo:** Unchanged SVG artwork; font selection does not alter it.

**Character:** Bold, tightly tracked lowercase headings, comfortable sans-serif prose, and precise mono labels. Self-hosted WOFF2 assets, with regular, semibold, and bold sans weights; regular mono only.

### Hierarchy
- **Display** (700, clamp(2.6–4.8rem), 1, -.04em, lowercase): slide `h2` only; one emphasized word may be solid Signal Pink.
- **Title** (600, 1.1875–1.25rem, 1.25): feature card titles and install step titles.
- **Body** (400, 1rem, 1.55): paragraphs and ledes (ledes up to 1.1875rem, max 62ch). Mono code at 14.5px/1.55; commands at 16px/1.5.
- **Label** (400, ~.8125–.9375rem, .08em, uppercase): section labels, `h3`, table headers, tabs, buttons, meta.

### Named Rules
**The Lowercase Shout Rule.** Display headings are always lowercase, bold, and negatively tracked. Labels are always uppercase mono. Never mix the two voices in one element.

## Layout

Full-viewport slides (`min-height: 100svh`) with y-proximity scroll snap on desktop when motion is allowed. Horizontal padding is `inline` (75px cap, 108–176px above 821px); vertical rhythm uses `block` plus 52px clearance for the fixed header. Doc slides cap at 1360px wide and 880px tall; the head is a two-column grid (heading left, lede right) that collapses at 1000px. Panel grids come in 2–5 equal columns, stepping down at 1180, 1000, and 600px. A short-laptop query (≤880px tall) tightens type and padding so each slide still fits one screen. Fixed chrome: header top, credits/progress bottom, a 58px square icon rail at right (hidden ≤820px).

## Elevation & Depth

No shadows. Depth is tonal: translucent smoke panels over a fixed ambient canvas, with `backdrop-filter: blur(12px)` on floating chrome (rail, back-to-top, quick-start rows). Solid ground-colored fades mask content under the fixed header and footer.

### Named Rules
**The Hairline Rule.** Separation is a 1px `line` border or a 1px grid gap, never a shadow or a lifted card.

## Shapes

Hard square corners everywhere (0 radius). Bullets and status markers are small filled squares (5–9px). Accent rails are 2px left borders. Dashed hairlines separate a card's footer config line. Icons are 1.3–1.4px stroke, square caps, miter joins.

## Components

### Buttons
- **Shape:** square, 1px hairline border or borderless inside a row.
- **Copy button:** pink uppercase mono text; hover floods pink with black text.
- **Ghost (back-to-top):** smoke fill with blur, hairline border; hover turns the border pink.
- **Focus:** 1px `paper` outline, 4px offset.

### Chips (badges)
- **Style:** hairline box, muted mono text, a 5px square dot (pink first, mauve second, and steel otherwise).

### Cards / Containers
- **Corner Style:** square.
- **Background:** `panel`, `panel-hi` on hover.
- **Border:** shared hairline grid; callouts add a 2px paper (or pink for warnings) left rail.
- **Internal Padding:** `spacing.cell`.

### Navigation
- **Rail:** vertical stack of 58px squares with stroke icons and tiny slide numbers; active item gets pink icon, faint pink fill, and a 2px pink left bar; hover pops an uppercase mono tooltip.
- **Tabs:** mono text with a 1px underline; selected is pink.

### Neon Wordmark (signature)
The logo flies from center stage into the header on scroll. It is an SVG image with a 1px pink drop-shadow outline, wrapped in the page's only `h1`, and runs a stepped jitter/skew glitch every 3.4s while at rest.

### Code Window
Hairline frame, top bar with dim dots and a copy action, mono pre text. Syntax roles: steel comments, pink operators, paper success, and paper keywords. Single commands use a 2px pink left rail instead of a window.

## Do's and Don'ts

### Do:
- **Do** separate content with 1px hairlines and grid gaps.
- **Do** reserve pink for verdicts, active state, and actions (The Signal-Only Rule).
- **Do** keep headings lowercase IBM Plex Sans 700 and labels uppercase IBM Plex Mono.
- **Do** keep every slide inside the shared frame so panels line up between slides.
- **Do** disable reveal, glitch, and snap under `prefers-reduced-motion`.

### Don't:
- **Don't** round corners or add drop shadows.
- **Don't** use pure white UI text or backgrounds outside the charcoal palette.
- **Don't** add a pointer-following glow or disc on the black ground (removed deliberately).
- **Don't** introduce new UI accent hues beyond pink and mauve. The requested NOVACON-style logo glitch is an identity exception.
