---
name: check-loop
description: Codex reviews your plans, research and code.
colors:
  ground: "#0a0a0a"
  surface: "#141414"
  panel: "rgba(10, 10, 10, .9)"
  panel-hi: "rgba(22, 22, 22, .94)"
  paper: "#cacccc"
  muted: "rgba(202, 204, 204, .78)"
  faint: "rgba(202, 204, 204, .62)"
  line: "rgba(121, 129, 134, .34)"
  line-strong: "#a8adb0"
  steel: "#798186"
  warm: "#c9c2b4"
  accent: "#ff3d8b"
  pink-hi: "#ff9fc8"
  green: "#00e676"
typography:
  logo:
    fontFamily: "Champagne Limousines, Inter, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: ".04em"
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 4.6vw, 4.8rem)"
    fontWeight: 800
    lineHeight: .95
    letterSpacing: "-.05em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-.01em"
  body:
    fontFamily: "Inconsolata, ui-monospace, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Departure Mono, ui-monospace, SF Mono, Menlo, monospace"
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
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
  copy-button-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ground}"
  panel-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    padding: "{spacing.cell}"
  panel-card-hover:
    backgroundColor: "{colors.panel-hi}"
  ghost-button:
    backgroundColor: "rgba(10, 10, 10, .72)"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
  command-line:
    backgroundColor: "rgba(5, 5, 5, .7)"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    padding: "8px 12px"
---

# Design System: check-loop

## Overview

**Creative North Star: "Neon After Hours"**

A flat black room lit by one neon sign. The glitching, pink-tubed wordmark is the sign; everything else is a quiet console: hairline-ruled panels, monospace body text, pixel-mono labels, and square corners. Full-screen slides snap past an ambient grid, each sharing one frame (label and heading left, lede right, equal-height panels below) so paging through feels like flipping between screens on the same terminal.

Density is high but calm. Text sits in soft grey, never pure white; contrast comes from weight (Inter ExtraBold headings) rather than color. Motion is restrained: a short reveal on slide entry and a stepped glitch on the wordmark, both off under reduced motion.

**Key Characteristics:**
- Flat near-black ground, no gradients behind content, no rounded corners anywhere.
- 1px hairline grids (`gap: 1px` over a line-colored background) instead of cards with shadows.
- Three type voices: Inter ExtraBold lowercase headings, Inconsolata body, Departure Mono uppercase labels.
- Pink is a signal, green is a pass, grey is everything else.

## Colors

One hot accent and one confirming green on a monochrome steel-grey ladder.

### Primary
- **Signal Pink** (`accent`): the verdict color. Deny/block outcomes, the active rail item, slide progress, copy actions, selected tabs, the square bullet before section labels.
- **Neon Blush** (`pink-hi`): reserved; currently unused after heading accents went solid.

### Secondary
- **Pass Green** (`green`): allowed/passing outcomes, the end of the flow pipe, enabled settings, the success callout rail.

### Neutral
- **After-Hours Black** (`ground`): page background and the knock-out fill behind the neon letters.
- **Panel Smoke** (`panel`, `panel-hi`): translucent panel fills over the ambient grid; `panel-hi` on hover.
- **Console Paper** (`paper`): headings and primary text. **Muted / Faint** are the same grey at 78% and 62% for body and meta.
- **Steel** (`steel`), **Hairline** (`line`): icons at rest, comments in code, every border and divider.
- **Warm Stone** (`warm`): secondary emphasis in code keywords, settings defaults, fix headings, footer link hover.

### Named Rules
**The Signal-Only Rule.** Pink marks state, verdict, or action. It is never decoration. The sanctioned identity exceptions are the wordmark outline and solid pink on a heading's emphasized word; nothing else gets pink because it "needs color".

**The No-White Rule.** The brightest text is `paper` (#cacccc). Never pure #fff.

## Typography

**Display Font:** Inter ExtraBold (with system-ui)
**Body Font:** Inconsolata (with ui-monospace, Menlo)
**Label/Mono Font:** Departure Mono (with SF Mono, Menlo)
**Logo:** Champagne Limousines Bold, used only in the wordmark.

**Character:** A heavy, tightly tracked grotesk shouting in lowercase over a typewriter-mono body; the pixel mono labels read like status-line readouts.

### Hierarchy
- **Display** (800, clamp(2.6–4.8rem), 0.95, -.05em, lowercase): slide `h2` only; one emphasized word may be solid Signal Pink.
- **Title** (800, 1.1875–1.25rem, 1.2): feature card titles and install step titles.
- **Body** (400, 1rem, 1.45): paragraphs and ledes (ledes up to 1.1875rem, max 62ch). Code at 14.5px/1.55.
- **Label** (400, ~.8125–.9375rem, .08em, uppercase): section labels, `h3`, table headers, tabs, buttons, meta.

### Named Rules
**The Lowercase Shout Rule.** Display headings are always lowercase, ExtraBold, negatively tracked. Labels are always uppercase mono. Never mix the two voices in one element.

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
- **Style:** hairline box, muted mono text, a 5px square dot (pink first, green second, steel otherwise).

### Cards / Containers
- **Corner Style:** square.
- **Background:** `panel`, `panel-hi` on hover.
- **Border:** shared hairline grid; callouts add a 2px green (or pink for warnings) left rail.
- **Internal Padding:** `spacing.cell`.

### Navigation
- **Rail:** vertical stack of 58px squares with stroke icons and tiny slide numbers; active item gets pink icon, faint pink fill, and a 2px pink left bar; hover pops an uppercase mono tooltip.
- **Tabs:** mono text with a 1px underline; selected is pink.

### Neon Wordmark (signature)
The logo flies from center stage into the header on scroll. It is an SVG image with a 1px pink drop-shadow outline, wrapped in the page's only `h1`, and runs a stepped jitter/skew glitch every 3.4s while at rest.

### Code Window
Hairline frame, top bar with dim dots and a copy action, mono pre text. Syntax roles: steel comments, pink operators, green success, warm keywords. Single commands use a 2px pink left rail instead of a window.

## Do's and Don'ts

### Do:
- **Do** separate content with 1px hairlines and grid gaps.
- **Do** reserve pink for verdicts, active state, and actions (The Signal-Only Rule).
- **Do** keep headings lowercase Inter 800 and labels uppercase Departure Mono.
- **Do** keep every slide inside the shared frame so panels line up between slides.
- **Do** disable reveal, glitch, and snap under `prefers-reduced-motion`.

### Don't:
- **Don't** round corners or add drop shadows.
- **Don't** use pure white text or a non-black background.
- **Don't** add a pointer-following glow or disc on the black ground (removed deliberately).
- **Don't** introduce new accent hues beyond pink and green for UI state.
