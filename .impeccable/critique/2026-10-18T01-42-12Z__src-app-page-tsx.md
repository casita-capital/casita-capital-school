---
target: src/app/page.tsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\page.tsx"
target_fingerprint: "sha256:5f06e3e8b3841a51d93989622176bdb224ad585ac7edd422f831eccbbf697dd4"
target_path: "C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\page.tsx"
timestamp: 2026-10-18T01-42-12Z
slug: src-app-page-tsx
---
Method: dual-agent (A: faf72c7a-5502-49fe-b651-f004ce6ffd04 · B: 6205b71d-b5cc-4a6a-863b-26938af6e71d)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Silent `catch` block (`src/app/page.tsx:241`) swallows DB errors and shows false "All past-due assignments are graded!" empty state; no toast/confirmation after saving a grade. |
| 2 | Match System / Real World | 2 | Raw ISO dates (`2026-10-18`) used throughout tables and headers (`lines 827, 921, 1414, 1434`) instead of human-friendly dates ("Fri, Oct 18"); hardcoded `"Internal (Mom)"` (`line 1055`). |
| 3 | User Control and Freedom | 2 | No undo after saving a grade removes an item from the Past-Due queue; no filtering, sorting, or search on any of the 3 dashboard tables. |
| 4 | Consistency and Standards | 2 | Redundant "Open Weekly Binder" CTA appears 3x in first viewport; sidebar hardcodes blue `rgba(12, 116, 228)` (`sidebar.tsx:58`) ignoring theme preset; `caption` (`0.85rem` uppercase) is larger than `body2` (`0.8rem`) while inline chips drop to `0.65rem` (`10.4px`). |
| 5 | Error Prevention | 2 | Silent fallback to hardcoded `'blake.womble@gmail.com'` (`page.tsx:176, 204, 213, 244`) masks auth/session issues; raw double-casts (`as unknown as ...`) without runtime guards. |
| 6 | Recognition Rather Than Recall | 3 | Strong inline context in tables (subject color dot, provider name, supply chips, GPA badge); weakened by hiding `/today` behind a secondary top-right header button (`Daily Timeline`). |
| 7 | Flexibility and Efficiency | 1 | Zero batch/inline grading in Past-Due table (must open/save full modal per row); no keyboard shortcuts; `setupExpanded` in sidebar resets to `true` on every load. |
| 8 | Aesthetic and Minimalist Design | 2 | Two huge static promotional cards for "Weekly Binder Planner" and "Assignments & Tasks" waste the top viewport; supplies are duplicated in both the checklist banner and the 7-column bottom table. |
| 9 | Error Recovery | 1 | `try/catch` in `loadDashboardData` (`page.tsx:241-246`) silently catches all Supabase fetch errors with zero user-facing message or retry button. |
| 10 | Help and Documentation | 2 | Section subtitles explain each card's data source, but render in jarring ALL-CAPS `caption` text; no tooltips on GPA calculation (weighted vs unweighted) or `graded_count / total_assignments`. |
| **Total** | | **19/40** | **Poor (47.5% — Significant UX and hierarchy cleanup needed)** |

#### Design Specificity Verdict

**LLM assessment**: Domain-aware in data modeling, but structurally and visually bound to a generic MUI SaaS admin template. The operational data (the **Parent Supply Sourcing Checklist**, external co-op providers like *Memoria Academy* and *Science Shepherd* vs. parent instruction, syllabus `Week N` / `Class N` counter resolution, and live GPA calculation) is genuinely tailored to a family homeschool planner. However, the presentation relies on stock `vertical-shells-dark` admin conventions (Inter everywhere, 11 Pantone accent swatches in the header dropdown, identical `borderRadius: 2.5` bordered boxes) and wastes the top 220px of the screen on two giant static promo cards advertising tabs that are already in the left sidebar.

**Deterministic scan**: `impeccable detect --json` across the live DOM (`http://localhost:3002`) and source files (`src/app/page.tsx`, `src/layouts/sidebar.tsx`, `src/layouts/header.tsx`, `src/layouts/index.tsx`) flagged **4 live DOM findings** across 3 rules plus **9 source-level legibility/nesting hits**:
- **`undersized-ui-text` (1 live DOM hit + 9 source locations)**: Functional UI text drops below the 11px (`0.6875rem`) legibility floor in `src/components/base/logo.tsx:48` (`0.68rem` / `10.88px` on `"School & Calendar"`), `src/layouts/sidebar.tsx:110, 140` (`0.68rem` section headers), and 6 chip styles in `src/app/page.tsx:1248, 1259, 1333, 1342, 1382, 1395` (`0.65rem`–`0.68rem`, i.e., `10.4px`–`10.88px`).
- **`dark-glow` (1 hit)**: `src/components/base/logo.tsx:26` applies a hardcoded blue chromatic glow (`boxShadow: '0 4px 12px rgba(12, 116, 228, 0.3)'`) on a dark surface, which also ignores the active theme color preset.
- **`nested-cards` (2 false positives on `/login` OutlinedInputs + 1 real nested card in `src/app/page.tsx:1196-1273`)**: The detector flagged `MuiOutlinedInput-root` inside `/login` as nested cards (false positive), but `src/app/page.tsx:1197-1272` genuinely nests bordered `background.paper` cards (`lines 1218-1225`) containing bordered `Chip` pills inside the outer "Parent Supply Sourcing Checklist" container inside the parent `Card` (`line 1135`).

**Visual overlays**: No reliable user-visible overlay is available (browser mutation tool unavailable in subagent environment; skipped live-server presentation and `detect.js` overlay injection; headless Puppeteer DOM evaluation via `impeccable detect --json http://localhost:3002` was executed as the deterministic fallback).

#### Overall Impression

The dashboard has rich, genuinely helpful homeschool logic under the hood, but its visual hierarchy is upside down: static navigation billboards sit above the fold while urgent daily grading and weekly prep are pushed down into cramped, all-caps/micro-text tables. Removing the redundant navigation cards, fixing the inverted typography scale (`caption` vs `body2` vs `0.65rem` chips), and standardizing on your `src/theme/` tokens will transform this from a cluttered template into a crisp daily command center.

#### What's Working

1. **Proactive Parent Supply Sourcing Checklist (`src/app/page.tsx:1196-1273`)**: Extracting required physical supplies from the current week's syllabus lessons and surfacing them grouped by class and weekday directly prevents the classic homeschool failure mode of discovering Tuesday morning that a science lab needs household supplies.
2. **Live Cross-Widget Reactivity on Grade Entry (`src/app/page.tsx:269-324, 1489-1510`)**: Grading a past-due assignment in `UnifiedAssignmentModal` updates local `assignments` state in place (`lines 1500-1506`), immediately removing the overdue row from the left table, incrementing `graded_count`, recalculating the subject percentage, and updating the overall GPA badge in the right table without a page reload.
3. **Print-Aware Shell Architecture (`src/layouts/index.tsx:139-146`, ` src/layouts/sidebar.tsx:165`, `src/layouts/header.tsx:178`)**: Consistent `.no-print` rules on the `Drawer` and `AppBar` paired with `@media print` resets treat physical paper output (Weekly Binder) as a first-class workflow.

#### Priority Issues

1. **[P1] Static Navigation Promo Cards Waste the Primary Viewport & Duplicate CTAs**
   - **What**: `src/app/page.tsx:664-774` renders two giant 6-column promo cards ("Weekly Binder Planner" and "Assignments & Tasks") with static marketing descriptions and full-width buttons that duplicate the header button (`line 629`) and left sidebar (`src/router/index.ts:13-35`). "Open Weekly Binder" appears 3 times in the first viewport.
   - **Why it matters**: In Operate mode, users open the dashboard to run today's school day and clear overdue grades—not to read descriptions of tabs they use every day. It pushes all live operational data below the fold and contributes to 4/8 Cognitive Load checklist failures.
   - **Fix**: Remove the two static promo cards (`lines 664-774`) entirely, keep quick-action buttons in the compact Greeting Header (`lines 608-660`), and bring the Past-Due Grading and Class Grades Summary tables straight to the top of the dashboard.
   - **Suggested command**: `/impeccable distill`

2. **[P1] Broken Typography Scale: Global Uppercase `caption` (`0.85rem`) vs. `0.65rem` Micro-Chips**
   - **What**: `src/theme/base/create-typography.ts:12-25` sets `body2` to `0.8rem` (`12.8px`) and `caption` to `0.85rem` (`13.6px`) with `textTransform: 'uppercase'`. Meanwhile, `src/app/page.tsx` (`lines 1248, 1259, 1333, 1342, 1382, 1395`), `src/layouts/sidebar.tsx` (`lines 110, 140`), and `src/components/base/logo.tsx` (`line 48`) hardcode `0.65rem`–`0.68rem` (`10.4px`–`10.88px`), triggering `undersized-ui-text`.
   - **Why it matters**: Multi-word helper descriptions (`src/app/page.tsx:826, 1007, 1179`) render in loud ALL CAPS larger than the actual table row titles (`body2`), while badge/chip labels drop below the 11px legibility floor.
   - **Fix**: In `src/theme/base/create-typography.ts`, remove `textTransform: 'uppercase'` from `caption` (keep uppercase on `overline`), set `caption` to `0.75rem` (`12px`), and set `body2` to `0.875rem` (`14px`). Raise all `0.65rem`–`0.68rem` chip/label overrides in `page.tsx`, `sidebar.tsx`, and `logo.tsx` to at least `0.75rem` (`12px`), and format raw ISO dates (`2026-10-18`) as human-readable dates (`Fri, Oct 18`).
   - **Suggested command**: `/impeccable typeset`

3. **[P1] Silent Error Swallowing & Hardcoded Identity/Term Fallbacks Mask System State**
   - **What**: `src/app/page.tsx` silently swallows all Supabase errors in `loadDashboardData` (`catch` at line 241), falls back to a hardcoded `'Blake Womble'` / `'blake.womble@gmail.com'` profile (`lines 176, 204, 212, 243`), hardcodes `'Internal (Mom)'` (`line 1055`), and hardcodes `'Full Year 2026-2027'` (`line 297`).
   - **Why it matters**: If a Supabase fetch fails or times out, `assignments` stays `[]` and the UI displays a green checkmark proclaiming *"All past-due assignments are graded!"*—a false-positive state that hides missing data.
   - **Fix**: Add an explicit `error` state in `src/app/page.tsx` with a retryable `<Alert severity="error">` banner when queries fail, validate Supabase payloads with type guards instead of `as unknown as` chains, and derive default instructor/term labels from `useSchoolSettings()`.
   - **Suggested command**: `/impeccable harden`

4. **[P2] Duplicated Supply Data, Triple-Nested Containers & Cramped 7-Column Bottom Table**
   - **What**: In the bottom "External Course Assignments & Activities Scheduled This Week" card (`src/app/page.tsx:1135-1486`), required supplies are rendered twice: inside the bordered sub-cards of the "Parent Supply Sourcing Checklist" banner (`lines 1196-1273`, flagged for `nested-cards`) and again in column 4 (`SUPPLIES NEEDED`, `lines 1385-1407`) of a 7-column table.
   - **Why it matters**: Nesting bordered paper cards inside a tinted banner inside a bordered card creates visual clutter, and repeating the exact same green supply chips in a 7-column table forces horizontal cramping.
   - **Fix**: Flatten the Supply Sourcing Checklist items using dividers or clean row spacing instead of nested bordered cards, and remove the redundant `SUPPLIES NEEDED` and `OPENS` columns from the bottom table (reducing it from 7 columns to 5 clean columns with a compact supply icon indicator on rows).
   - **Suggested command**: `/impeccable layout`

5. **[P2] Keyboard Accessibility Failures & Theme Token Drift in Layout Shell**
   - **What**:
     1. `src/layouts/header.tsx:229-274` (User Avatar trigger) and `lines 373-406` (11 Color Preset swatches) use `<Box onClick={...}>` (`<div>`) instead of semantic buttons, and the mobile menu `<IconButton>` (`line 198`) lacks an `aria-label`.
     2. `src/layouts/sidebar.tsx:58, 62` and `src/components/base/logo.tsx:21, 26` hardcode Monaco Blue (`#0C74E4` / `rgba(12, 116, 228, ...)` + `dark-glow` shadow) instead of `theme.palette.primary.main`.
     3. `src/app/page.tsx` uses `borderRadius: 2.5` (`15px`) on cards and `borderRadius: 2` (`12px`) on buttons instead of the workspace rule `BORDER_RADIUS = 6px` (`src/theme/utils.ts:27`).
   - **Why it matters**: Keyboard and screen-reader users cannot open the user menu, sign out, or switch themes; non-blue theme presets clash with hardcoded blue in the sidebar and logo; and ad-hoc radii/spacing violate `.agents/AGENTS.md` Rule #3.
   - **Fix**: Replace clickable `<Box>` elements in `header.tsx` with `<ButtonBase>` + `aria-label`s, replace hardcoded blue in `sidebar.tsx` and `logo.tsx` with theme tokens (and remove the `dark-glow` shadow), and align card/button border radii with `src/theme/`.
   - **Suggested command**: `/impeccable polish`

#### Persona Red Flags

**Alex (Impatient Power User)**:
- **One-by-one modal grading bottleneck (`src/app/page.tsx:925-943`)**: Clearing 10 overdue daily assignments in *Past-Due Assignments Needing Grades* requires 10 separate `Enter Grade` -> modal -> score input -> Save cycles with no inline score input or batch action.
- **Wasted above-the-fold real estate (`src/app/page.tsx:664-774`)**: Forced to scroll past two static feature-promo cards for pages already in the sidebar on every visit.
- **Sidebar state reset (`src/layouts/sidebar.tsx:39`)**: `setupExpanded` resets to `true` on every load, keeping all 11 navigation items expanded.

**Sam (Accessibility-Dependent User)**:
- **Unfocusable User Menu & Sign Out (`src/layouts/header.tsx:229-274`)**: The avatar dropdown trigger is a `<Box onClick={handleOpenMenu}>` (`<div>`) with no `tabIndex`, `role="button"`, or keyboard handler—Sam cannot sign out or change theme mode via keyboard.
- **Unfocusable Theme Swatches & Unlabeled Hamburger (`src/layouts/header.tsx:198, 373-406`)**: Mobile nav `<IconButton>` has no `aria-label`, and the 11 color swatches are raw `<div>`s.
- **Sub-11px text & ALL-CAPS captions (`src/app/page.tsx:1248, 1333`, `create-typography.ts:24`)**: `10.4px` chip labels and uppercase sentence captions impair low-vision and dyslexic reading.

**Rachel & Lucas (Homeschool Parent-Teacher & Student)**:
- **Role/Identity mismatch (`src/app/page.tsx:1055`)**: Even when Blake (Dad/Admin) is logged in (`Welcome back, Blake`), the Class Grades Summary table hardcodes `Internal (Mom)` whenever `teacher_name` is empty.
- **Cryptic ISO dates (`src/app/page.tsx:921, 1434`)**: Overdue assignments show `2026-10-12` instead of `"Mon, Oct 12"`, forcing parent and student to mentally map dates to their physical weekly binder days.
- **Hidden "Today" view (`src/layouts/header.tsx:209`, `src/router/index.ts`)**: The live daily schedule (`/today`) is absent from the left sidebar's "Daily Planning" section and tucked away as a secondary header button.

#### Minor Observations

- **Hardcoded Academic Year (`src/app/page.tsx:297-298, 1008`)**: `'Full Year 2026-2027'` is hardcoded in the grade summary filter and subtitle instead of coming from school settings.
- **Color Preset Truncation (`src/layouts/header.tsx:402`)**: `{option.label.split(' ')[0]}` truncates preset names in the theme picker so `"Monaco Blue"` reads as `"Monaco"` and `"Living Coral"` reads as `"Living"`.
- **Dual Internal Scrollbars (`src/app/page.tsx:842, 1023`)**: Both middle tables set `maxHeight: 380` with internal scrollbars inside a scrolling page.

#### Questions to Consider

- "What if opening the Dashboard immediately showed **Today's Schedule & Due Work** instead of two large cards linking to the Weekly Binder and Assignments pages?"
- "What if overdue assignments in **Past-Due Assignments Needing Grades** could be scored inline right inside the table row without opening a modal for each one?"
- "Should we codify your centralized theme in a `DESIGN.md` so every page strictly follows your 6px radius, 8px spacing grid, and a clean typographic hierarchy?"
