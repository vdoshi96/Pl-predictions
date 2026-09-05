---
name: Dranx Prediction League
description: Compact football comparisons on warm paper with purple identity and a playful shared-rank podium.
colors:
  background: "#f5f3ee"
  surface: "#fffefa"
  surface-subtle: "#efebf0"
  foreground: "#302036"
  muted: "#6b6071"
  border: "#ded9df"
  brand: "#37003c"
  brand-ink: "#37003c"
  brand-soft: "#eae5ed"
  accent: "#d6ff78"
  accent-yellow: "#e4ffa3"
  accent-pressed: "#c3ef64"
  accent-ink: "#26002d"
  accent-blue: "#a34daf"
  accent-lilac: "#85418e"
  brand-pressed: "#e8d9eb"
  danger: "#a32b32"
  danger-soft: "#fde8e8"
  warning: "#8a5a00"
  warning-soft: "#fff2cc"
  mint: "#ddffef"
  mint-ink: "#075d42"
  sky-soft: "#dffcff"
  background-dark: "#17131a"
  surface-dark: "#211b25"
  surface-subtle-dark: "#342939"
  foreground-dark: "#f0eaf2"
  muted-dark: "#bcb0c2"
  border-dark: "#453a4a"
  brand-ink-dark: "#e7c7eb"
  brand-soft-dark: "#342939"
  accent-blue-dark: "#ce9cd6"
  brand-pressed-dark: "#47204f"
  danger-dark: "#ff9ba0"
  danger-soft-dark: "#3d1216"
  warning-dark: "#ffd60a"
  warning-soft-dark: "#3a2c05"
  mint-dark: "#12382d"
  mint-ink-dark: "#8fffc9"
  sky-soft-dark: "#0d353a"
typography:
  headline:
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  headline-wide:
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "0.875rem"
    lineHeight: "1.5rem"
  label:
    fontSize: "0.75rem"
    lineHeight: "1.25rem"
    fontWeight: 600
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-yellow}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
  badge-neutral:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Dranx Prediction League

## Overview

**Creative North Star: "Calm football comparisons"**

Dranx presents a friends' competition through compact headings, readable comparison rows, and warm surfaces. Purple carries identity; lime marks primary actions and selected highlights. Local club badges connect the interface to the competition.

The podium adds restrained playfulness through outlined animal icons. Names, scores, and occupied ranks remain the authoritative information. This record describes the approved implementation; source components and global styles govern behavior when an illustrative snippet omits application logic.

**Key Characteristics:**

- Warm paper with purple text and restrained lime accents.
- Compact headers and dense, readable comparison rows.
- Equal visual treatment for every participant at the same podium rank.
- Responsive layouts with explicit labels and visible action states.

## Colors

The palette pairs warm neutral surfaces with purple identity and a small set of semantic status colors. The frontmatter records light values and explicit dark overrides; unchanged tokens carry across themes.

### Primary

**Purple brand** anchors the logo, the first-place podium header, and selected controls. **Purple ink** is the theme-aware text counterpart. Use the ink token for text on ordinary surfaces; the brand fill remains dark in both themes.

### Secondary

**Lime accent** fills primary buttons and selection highlights. Its yellow and pressed variants provide interaction states. **Lilac accent** marks active navigation and selected borders. The legacy accent-blue name identifies the purple focus color; preserve the source name.

### Neutral

**Warm paper** surrounds **surface** panels. **Subtle surface** and **soft brand** group supporting information. **Foreground**, **muted**, and **border** separate primary content, supporting copy, and row boundaries.

### Semantic colors

Mint, warning, and danger pairs communicate successful, cautionary, and failed states. Comparison-gap chips have a separate signed scale with near, slight, and far bands in each theme. Preserve their arrows and numerical differences; color is additional information.

**The semantic pair Rule.** Use each status foreground with its matching surface, and retain a text label or numerical cue.

The sidecar's synthesized tonal ramps support preview swatches; they are not additional application colors.

The application follows the operating system's color preference. The light-preview scope is reserved for intentional light examples; it does not replace theme-aware application surfaces.

## Typography

Body copy uses the installed Avenir Next stack, with Segoe UI, Helvetica, Arial, and sans-serif fallbacks. Page headings inherit that stack. The frontmatter records their size and weight, without promoting a system font into a distinctive display identity.

Page titles use the compact headline size and increase at the small breakpoint. Supporting descriptions use the body role with generous line spacing. Section headings commonly use bold base or extra-large text; metadata and badges use small labels. Numerical columns and scores use tabular numerals where alignment matters. Monospace appears in compact position labels and paste-entry fields.

**The comparison hierarchy Rule.** Keep club or participant names prominent, supporting facts quieter, and scores aligned. Let long names wrap instead of concealing them.

Decorative uppercase eyebrows are not a heading pattern. Functional table column labels remain part of the comparison interface.

## Layout

The public page shell uses `min(100% - 2rem, 72rem)` and centers itself. Its minimum supported viewport is 320px. The header contains a compact brand row and a separate row of five navigation links.

The season comparison uses a flexible table column beside a 19rem supporting column, with a 2rem gap. Below 900px, it becomes one column. At that breakpoint, podium columns become stacked rank groups. Each mobile group has a 4.5rem rank rail; every tied participant remains visible.

Card padding increases from the 16px spacing step to the 24px step at 640px. Smaller gaps use the 8px and 12px steps. Under 480px, navigation spacing and podium decoration contract to preserve content width.

Comparison tables retain row boundaries. On mobile, Group avg. appears as a labeled inline value beneath the club name. The entry comparison leads with per-club scoring. Stage 3 uses an ordinary full-page review with all 20 clubs and seven picks, separate edit actions, and one final submission action.

Bottom actions and mobile selector sheets account for the device safe area. A selector becomes a fixed bottom sheet on narrow screens and an anchored dropdown from 640px. Constrain wide matrices within their own scroll region; preserve the page's reflow.

## Elevation & Depth

Most surfaces are flat, with thin borders and tonal grouping. Shared buttons use a small ambient shadow. Popovers, dialogs, and selected floating regions use stronger elevation to distinguish temporary layers. The panel shadow is a soft purple-tinted spread in light mode and a black spread in dark mode; its exact values live in the sidecar.

Dropdowns and dialogs open over 250ms and close over 150ms. Stage panels use a short vertical offset with opacity and blur. Success feedback has a finite stroke-draw animation. Reduced-motion rules remove or shorten movement, reveal the completed check, and disable smooth scrolling.

**The resting surface Rule.** Use borders and tone for ordinary content; reserve raised layers for controls or transient content that already uses elevation.

## Shapes

Controls and comparison rows use gently rounded corners. Shared buttons use the xl radius; cards use 2xl; compact navigation controls and some inputs use lg. Badges use the full radius. Preserve these distinctions instead of enclosing every region in a card.

Podium tiers have rounded upper corners on desktop and a rounded outer outline on mobile. Their animal containers use a softly shaped silhouette. The original club marks retain their supplied artwork and fit within consistent image bounds.

## Components

### Buttons

Shared buttons have primary, secondary, ghost, and danger variants. Primary is lime; secondary has a surface fill and border; ghost gains a soft brand surface on interaction. The danger variant uses Tailwind red with white text rather than the semantic danger surface pair.

Small and medium buttons have a minimum height of 44px. Large buttons and icon buttons use 48px. Shared controls expose hover, pressed, focus, and disabled states. Their color transitions last 150ms. Disabled buttons reduce opacity and use an unavailable cursor.

### Inputs and selectors

Fields use a surface fill, thin border, and visible focus treatment. Most form fields have a 44px minimum height and xl corners; the leaderboard search uses lg corners. Preserve labels, error text, disabled states, and pending feedback.

Searchable prediction selectors use combobox and listbox semantics, keyboard selection, and a bounded results panel. Keep the Other player path available when catalogue data is loading, empty, or unavailable. The player catalogue remains lazily loaded; this design does not introduce a runtime football feed.

### Badges

Status badges are compact pills with an inset ring. Neutral, accent, success, warning, and danger variants retain readable text. Badges report state; they do not replace a required action control.

### Cards and comparison rows

Cards are bordered surfaces without a default panel shadow. Headers, content, and footers share responsive padding. Footers use a dividing line. Comparison lists join rows inside one rounded outline, preserving data density and column alignment.

### Navigation

Primary navigation names Season table, Leaderboard, Spotlight, Win Streak, and Rules. Active links use a lilac underline and purple ink, with `aria-current="page"`. Links retain a 48px minimum height. The skip link becomes visible on focus.

The owner results desk uses selected workspace controls with `aria-pressed`. Inactive workspaces remain mounted and hidden so switching datasets preserves unsaved drafts. Publication remains a separate reviewed action with its existing validation and attestation gates.

### Podium

Group entries by occupied competition ranks 1, 2, and 3, including every tied entry. Do not allocate only three participant slots. A rank group shares its treatment, and the first-place header carries the strongest brand fill.

Animal icons derive deterministically from the public display name and are hidden from assistive technology. They require no profile setting or additional personal data. Visible names, rank labels, and scores carry meaning independently.

**The equal place Rule.** Give every participant at the same rank the same visual status, without truncating the group.

### Review and action safeguards

The review page exposes the full entry before the irreversible submission. Keep Edit table, Edit picks, pending state, rejection feedback, and focus on the review heading. Preserve the existing browser draft and immutable submission behavior.

Sorting rows have 56px minimum height and retain touch, pointer, and keyboard controls. Theme, reduced-motion, focus, long-name wrapping, and safe-area behavior apply to these interactions as well as read-only views.

### Annotated walkthrough

Walkthrough screenshots use static imports so their content-hashed media URLs change when the image content changes. Preserve this delivery pattern when replacing captures to avoid showing an outdated optimized image. Keep alt text, captions, and numbered markers aligned with the visible controls and full-page review.

## Do's and Don'ts

### Do

- **Do** use theme-aware surface and text pairs.
- **Do** keep names, ranks, status labels, and numerical differences visible independently of color or decoration.
- **Do** include every tied podium participant with equal treatment.
- **Do** preserve full-page review, draft retention, visible focus, and immutable action feedback.
- **Do** reuse the original local club badges and existing decorative animal system.

### Don't

- **Don't** turn a compact heading into a decorative eyebrow stack.
- **Don't** hide comparison facts or middle review rows to make a narrow screen look shorter.
- **Don't** replace working controls with static visual imitations or remove publication safeguards.
- **Don't** turn illustrative participant data, icon choices, or prototype content into persisted product data.

Not canonized: inherited system-font headings are recorded as implementation evidence, not a distinctive display-font rule. One-off decorative values and unused legacy styling do not establish patterns for additional screens.
