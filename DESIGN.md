---
name: Casita Capital School
description: Warm editorial classical academy planner, gradebook, and weekly binder system for family homeschooling.
colors:
  oxford-blue: "#1b5698"
  academy-pine: "#0d735c"
  terracotta-ink: "#b8422e"
  botanical-sage: "#1e6f3d"
  botanical-sage-preset: "#1e6b43"
  gilded-ochre: "#b85d0c"
  honey-gold: "#967210"
  regent-navy: "#2e4a8f"
  classical-plum: "#6c43b8"
  crimson-seal: "#c43235"
  rose-seal: "#b83b48"
  sienna-clay: "#c2511a"
  mulberry-ink: "#9c2d7c"
  byzantine-violet: "#7e38b7"
  warm-ivory: "#fcfbf8"
  pure-white: "#ffffff"
  parchment-paper: "#f7f4ee"
  warm-stone-border: "#e2dcd0"
  muted-taupe: "#787063"
  scholar-umber: "#3f3a32"
  study-slate: "#26231e"
  obsidian-ink: "#171614"
typography:
  display:
    fontFamily: "var(--font-serif), 'Newsreader', Georgia, 'Times New Roman', serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "var(--font-serif), 'Newsreader', Georgia, 'Times New Roman', serif"
    fontSize: "1.9rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "var(--font-serif), 'Newsreader', Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "var(--font-serif), 'Newsreader', Georgia, 'Times New Roman', serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-serif), 'Newsreader', Georgia, 'Times New Roman', serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "var(--font-sans), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  body-dense:
    fontFamily: "var(--font-sans), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-sans), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.02em"
rounded:
  default: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.oxford-blue}"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.default}"
    padding: "8px 16px"
  button-outlined:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.obsidian-ink}"
    rounded: "{rounded.default}"
    padding: "8px 16px"
  card-surface:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.obsidian-ink}"
    rounded: "{rounded.default}"
    padding: "24px"
---

# Design System: Casita Capital School

## Overview

**Creative North Star: "The Classical Academy Binder"**

Casita Capital School is an **Operate-mode** academic command center built for daily family homeschooling, classical co-op coordination (*Memoria Academy*, *Science Shepherd*, *Amanda Holliday Math*), and physical weekly binder printing. Its visual world replaces cold, neon-accented SaaS admin templates with the tactile warmth of archival paper, fountain-pen ink, and editorial serif headings (`Newsreader`) paired with crisp tabular UI typography (`Inter`).

Every screen is designed for morning scanability: parents and students open the app to see today's schedule, clear overdue grading, check cumulative GPA, and verify physical lab supplies for the week. The interface respects print-first workflows (`.no-print` chrome stripping) and enforces strict structural discipline across light ("Warm Paper") and dark ("Study Slate") modes.

**Key Characteristics:**
- **Editorial Academic Pairing:** `Newsreader` serif for page titles and card headers (`h1`–`h5`), paired with `Inter` (`tabular-nums` on all dates, scores, and GPAs) for high-density tables and controls.
- **Warm Archival Surfaces:** Stone and parchment neutrals (`#fcfbf8` / `#f7f4ee` in light mode; `#171614` / `#26231e` in dark mode) instead of clinical blue-gray slate.
- **Strict 6px / 8px Geometry:** Every card, button, input, and menu item adheres to the centralized `6px` border radius (`BORDER_RADIUS = 6`) and `8px` spatial grid (`SPACING_UNIT = 8`).
- **Operational Directness:** No marketing-style feature promos on operational views; live academic tables and daily timelines always occupy the primary viewport.

## Colors

The palette draws from classical bookbinding inks and archival paper tones, supporting user-selectable accent presets that automatically adapt contrast across Warm Paper (Light) and Study Slate (Dark) modes.

### Primary
- **Oxford Blue** (`#1b5698`): Default primary ink for primary actions, active navigation states, and GPA badges.
- **Academy Pine** (`#0d735c`): Optional botanical ink preset for primary interactive highlights.
- **Terracotta Ink** (`#b8422e`): Warm editorial clay accent preset.

### Secondary
- **Botanical Sage** (`#1e6f3d`): Used for completed grades, A-range standing badges, and the Parent Supply Sourcing Checklist callout.
- **Gilded Ochre** (`#b85d0c`): Used for assignments due this week and ungraded past-due count badges.
- **Crimson Seal** (`#c43235`): Used for overdue dates and destructive or sign-out actions.

### Neutral
- **Warm Ivory** (`#fcfbf8`): Primary elevated card and sheet surface in Light mode (`neutral[25]`).
- **Parchment Paper** (`#f7f4ee`): Default canvas background in Light mode (`neutral[50]`).
- **Warm Stone Border** (`#e2dcd0`): Hairline `1px solid` structural divider in Light mode (`neutral[200]`).
- **Muted Taupe** (`#787063`): Supporting metadata and muted captions (`neutral[500]`).
- **Scholar Umber** (`#3f3a32`): High-contrast secondary body text in Light mode (`neutral[700]`).
- **Study Slate** (`#26231e`): Elevated card surface and borders in Dark mode (`neutral[800]`).
- **Obsidian Ink** (`#171614`): Primary body text in Light mode and canvas background in Dark mode (`neutral[900]`).

### Named Rules
**The Dynamic Accent Rule.** Never hardcode a preset's hex or RGBA value in layout or page components. Always reference `theme.palette.primary.main` (or `alpha(theme.palette.primary.main, ...)`) so switching the Academy Accent Ink updates every active state cohesively.

**The No Dark-Glow Rule.** Never apply colored zero-offset or neon halo shadows on dark surfaces. Use `1px solid` structural borders (`borderColor: 'divider'`) and neutral elevation shadows.

## Typography

**Display Font:** `Newsreader` (with `Georgia, 'Times New Roman', serif` fallback)
**Body Font:** `Inter` (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` fallback)

**Character:** Literary, calm, and authoritative in headings (`Newsreader`), paired with crisp, unpretentious legibility (`Inter`) in dense gradebook tables, time grids, and form controls.

### Hierarchy
- **Display (`h1`–`h3`)** (`600` weight, `1.5rem`–`2.5rem`, `1.15`–`1.25` line-height): Page greeting headers and printable binder titles.
- **Headline (`h4`–`h5`)** (`600` weight, `1.125rem`–`1.35rem`, `1.3`–`1.35` line-height): Primary operational card titles (*Past-Due Assignments Needing Grades*, *Class Grades Summary*).
- **Title (`subtitle1` / `subtitle2` / `h6`)** (`600` weight, `0.875rem`–`0.95rem`, `1.45` line-height): Sub-banners, modal headers, and emphasized row groupings.
- **Body (`body1` / `body2`)** (`400`–`500` weight, `0.875rem`–`0.9375rem`, `1.5`–`1.55` line-height): Assignment titles, syllabus notes, and form inputs.
- **Label (`caption` / `overline`)** (`500`–`700` weight, `0.75rem` / `12px`, `1.45` line-height): Helper descriptions (`caption`, sentence case) and table/sidebar section headers (`overline`, uppercase with `0.06em` letter-spacing).

### Named Rules
**The 12px Floor Rule.** Functional UI text—including chips, table headers, course subtitles, and date badges—must never drop below `0.75rem` (`12px`). Sub-11px micro-text is banned.

**The Sentence-Case Caption Rule.** `variant="caption"` is strictly sentence-case (`textTransform: 'none'`) and smaller (`0.75rem`) than `body2` (`0.875rem`). Reserve `UPPERCASE` exclusively for short 1–3 word `overline` labels and `TableHead` cells.

**The Tabular Numerals Rule.** Every due date, time slot, score ratio (`14 / 18`), percentage, and GPA badge must set `fontVariantNumeric: 'tabular-nums'` and format dates for human reading (`Fri, Oct 18` rather than raw `2026-10-18`).

**The Single-Row Table Cell Rule.** Table column headers (`TableHead` cells), due/scheduled date columns, class/provider badges, graded item ratios (`14 / 18`), status chips, and row action buttons (`Enter Grade`) must always enforce `whiteSpace: 'nowrap'` (and `noWrap` on inner `Typography`) so compact metadata never wraps onto two rows when assignment titles are long.

## Layout

The application uses a persistent left sidebar (`288px` desktop width) and top utility header (`54px` height) framing a fluid operational workspace.
- **Spatial Rhythm:** All padding, gaps, and margins follow the `8px` base unit (`p: 2` = `16px`, `p: 3` = `24px`, `spacing={3}` = `24px`).
- **Print Adaptation:** `.no-print` hides navigation chrome (`Sidebar`, `Header`) during `@media print`, expanding the main content container to `100%` width with zero outer padding for clean 2-page binder spreads.
- **Table Density:** Operational tables are capped at 4–5 columns to prevent horizontal cramping on 13-inch laptops. Secondary metadata (such as supply lists or portal open dates) is progressively disclosed via compact badges, tooltips, or dedicated summary banners.

## Elevation & Depth

Casita Capital School uses **structural hairline borders (`1px solid divider`) and tonal surface layering** rather than heavy drop shadows. Cards sit at `elevation={0}` on the canvas, distinguished by subtle background contrast (`background.paper` over `background.default`). Shadows (`boxShadow: 8`) are reserved strictly for floating overlays (`Menu`, `Dialog`, `Popover`).

### Named Rules
**The Flat-Canvas Card Rule.** Operational cards use `elevation={0}` and `1px solid` borders (`borderColor: 'divider'`). Never nest bordered cards inside other bordered cards; use `<Divider />` and vertical spacing to separate groups inside a card.

## Shapes

Every interactive and container surface uses the centralized `6px` border radius (`borderRadius: 1` in MUI `sx`, which maps to `theme.shape.borderRadius = 6`). Circular shapes (`50%`) are used only for subject color indicator dots (`8px`) and user avatars (`32px`).

## Components

### Buttons
- **Shape:** Gently rounded corners (`6px` radius via `borderRadius: 1`), `textTransform: 'none'`, `fontWeight: 600`.
- **Primary (`contained`):** Solid primary ink background, `boxShadow: 'none'`, `8px 16px` padding.
- **Secondary (`outlined`):** `1px solid` divider border, `text.primary` label, subtle `action.hover` fill on hover.

### Chips
- **Style:** `20px`–`22px` height, `0.75rem` (`12px`) font size, `fontWeight: 600`–`700`, `tabular-nums` for counts and grades.
- **State:** Tinted background (`alpha(color, 0.12)`) or `outlined` stroke for category, week/class counters, and supply tags.

### Cards / Containers
- **Corner Style:** `6px` radius (`borderRadius: 1`).
- **Background:** `background.paper` (`#fcfbf8` in Light, `#26231e` in Dark).
- **Shadow Strategy:** `elevation={0}` with `1px solid` `divider` border.
- **Internal Padding:** `16px` (`p: 2`) on table card headers; `24px` (`p: 3`) on summary headers.

### Navigation
- **Sidebar:** Grouped into **Daily Planning** (always visible: *Dashboard*, *Daily Timeline*, *Weekly Binder Planner*, *Gradebook & Reports*, *Assignments*, *To-Do Tasks*, *Master Calendar*) and **Curriculum & Setup** (collapsible accordion with `localStorage` persistence). Active items use `alpha(theme.palette.primary.main, 0.12)` background and `primary.main` text/icon.

### Signature Component: Parent Supply Sourcing Checklist
- Appears at the top of the weekly external schedule card whenever syllabus activities require physical household or lab materials. Uses a subtle botanical sage wash (`alpha(theme.palette.success.main, 0.06)`), flat divider rows (never nested cards), and `0.75rem` supply chips grouped by class and weekday.

## Do's and Don'ts

### Do:
- **Do** consume colors, typography, `8px` spacing, and `6px` border-radius (`borderRadius: 1`) exclusively from `src/theme/`.
- **Do** format dates in human-readable form (`Fri, Oct 18`) with `fontVariantNumeric: 'tabular-nums'` and `whiteSpace: 'nowrap'`.
- **Do** use semantic interactive elements (`<Button>`, `<ButtonBase>`, `<IconButton aria-label="...">`) with visible `:focus-visible` outlines for all clickable controls.
- **Do** surface explicit `<Alert severity="error">` banners with retry actions whenever Supabase queries fail.

### Don't:
- **Don't** allow table dates, class badges, item counts, headers, or action buttons to wrap onto two rows (`whiteSpace: 'nowrap'` is mandatory on compact columns).
- **Don't** place static promotional navigation cards on operational dashboards when those links already exist in the sidebar and header.
- **Don't** nest bordered cards inside other bordered cards (`nested-cards`).
- **Don't** use `fontSize` below `0.75rem` (`12px`) on any functional text, chip, or badge.
- **Don't** hardcode `#0C74E4` or `rgba(12, 116, 228, ...)` in components; always derive from `theme.palette.primary.main`.
