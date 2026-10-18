---
target: src/app/calendar/planner/page.tsx
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\calendar\\planner\\page.tsx"
target_fingerprint: "sha256:e7c2331c085cf35e05f192ac326bb1b890444594803fdae8e747fa092b9a5b60"
target_path: "C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\calendar\\planner\\page.tsx"
timestamp: 2026-10-18T03-22-45Z
slug: src-app-calendar-planner-page-tsx
---
Method: dual-agent (A: c90503ca-5864-4bb2-9da2-ea045e172c50 · B: 4bfde43c-16aa-412e-b34a-0a3de00607dc)

## Design Critique: Weekly Binder Planner (`src/app/calendar/planner/page.tsx`)

### Design Health
- **Design Specificity & Print-Safety Boundary:**
  - **Sacred 2-Page Print Architecture (`@media print` — Passed & Locked):** The mathematical split between Page 1 (`Subject` + `Monday`–`Wednesday`) and Page 2 (`Subject` + `Thursday`–`Friday` + `1/3` Sidebar), synchronized `HOLIDAYS & TASKS` row (`syncedAllDayMinHeight`), and `10.45in` Letter portrait print calibration are domain-specific, rock-solid, and **must not be altered in `@media print`**.
  - **On-Screen Interactive Workspace (`.no-print` & `@media screen` — Needs Improvement):** On screen, stacking Page 1 and Page 2 vertically (`min-height: 840px` each) while crushing the canvas by `500px` when the Cell Drawer opens creates severe scrolling and data-entry friction.
- **Usability Heuristics:** **24/40** (Acceptable — On-screen data/input workflows have clear room for improvement)
  - Visibility of System Status: 2/4
  - Match Between System and Real World: 4/4
  - User Control and Freedom: 2/4
  - Consistency and Standards: 2/4
  - Error Prevention: 2/4
  - Recognition Rather Than Recall: 3/4
  - Flexibility and Efficiency of Use: 1/4
  - Aesthetic and Minimalist Design: 3/4
  - Help Users Recognize, Diagnose, and Recover from Errors: 2/4
  - Help and Documentation: 3/4
- **Cognitive Load:** **High** (6/8 checklist failures in the on-screen editing controls/drawer)
- **Automated Checks:** **107 raw findings**, which classify into:
  - **19 genuine on-screen UI findings:** 3 `side-tab` warnings (`borderLeft: 4px solid` in `.no-print` panels/drawers at lines `1981`, `2137`, `3132`), 8 sub-12px `design-system-font-size` advisories (`0.68rem` / `0.7rem` in `.no-print` panels/drawers), and 8 hardcoded fallback hex colors (`#0C74E4`, etc. at lines `148–155`).
  - **88 intentional 2-page print-sheet / paper preview styles:** 60 in the WYSIWYG binder preview CSS/JSX and 28 inside `@media print` (`8px`–`11px` print calibration and `#000000` ink overrides).

### What's Working
- **Bulletproof 2-Page Physical Binder Print Architecture (`@media print`, lines `2444–2963`, `4671–4965`):** The Page 1 (Mon–Wed) + Page 2 (Thu–Fri + 1/3 Sidebar) split, `syncedAllDayMinHeight`, and toner-friendly black-and-white print overrides guarantee exact 2-page pagination every week.
- **Curriculum & Supply Chain Intelligence (`weekActivitySupplies`, lines `818–877`, `2913–2950`):** Automatically detects hands-on syllabus activities for the week (including manual `Class #` overrides) and surfaces physical supplies in the Page 2 `Activity Supplies Needed` callout.
- **"Pull Forward Previous Week" & "Promote to Graded" Workflows (lines `3631–3650`, `3990–4139`):** Previews prior-week To-Dos/Priorities/Notes before copying and lets parents promote an ungraded planner note into a graded `UnifiedAssignmentModal` record in one click.

### Priority Issues (100% Print-Safe On-Screen Improvements)

#### 1. [P1] On-Screen Mon–Wed / Thu–Fri Vertical Split & 500px Drawer Crushing
- **Location:** `src/app/calendar/planner/page.tsx:1655` (`pr: openCellModal ? { xs: 0, md: '500px' } : 0`), `lines 2444–2963` (`.print-page`), and `lines 2967–3100` (`openCellModal` header).
- **Why it matters:** On screen, parents planning a subject across Monday–Friday must scroll 850px up and down between Page 1 (Mon–Wed) and Page 2 (Thu–Fri). Worse, clicking any cell adds `padding-right: 500px` to the page container, crushing the planner table horizontally, and the drawer has no `< Prev Day | Next Day >` or `↑ Prev Subject | ↓ Next Subject` navigation.
- **Fix (100% Print-Safe):**
  1. Remove `pr: openCellModal ? { xs: 0, md: '500px' } : 0` so opening the Cell Drawer overlays cleanly without crushing the underlying planner table.
  2. Add `< Prev Day` / `Next Day >` (Mon → Fri) and `↑ Prev Subject` / `↓ Next Subject` stepper buttons (plus keyboard shortcuts) directly in the Cell Drawer header so a parent can step across all 5 days of a subject without closing the drawer or scrolling between Page 1 and Page 2.
  3. Add an optional **On-Screen View Mode toggle** in the `.no-print` toolbar: **`2-Page Print Preview`** (default exact Page 1 + Page 2 sheets) vs. **`Unified 5-Day Screen Grid`** (on-screen Mon–Fri table with Sidebar below, hidden in `@media print` so printing **always** uses the sacred 2-page `.planner-print-root`).
- **Command:** `/impeccable arrange`

#### 2. [P1] Un-debounced Keystroke Supabase Upserts & Static Checkboxes in Page 2 Sidebar
- **Location:** `src/app/calendar/planner/page.tsx:2828–2959` (`TO DO`, `TOP 3 PRIORITY`, `FOR NEXT MONTH`, `NOTES` inputs) and `lines 760–795` (`handleSaveSettings`).
- **Why it matters:** Every single keystroke in the 10 `TO DO` inputs, 3 `TOP 3 PRIORITY` inputs, and 2 textareas immediately fires an async `supabase.from('weekly_planner_settings').upsert(...)` call—typing a 40-character note triggers 40 concurrent database writes with no save indicator and silent error handling. Additionally, `.checkbox-square` is a static `<div>` that cannot be checked off on screen.
- **Fix (100% Print-Safe):**
  1. Update local `plannerSettings` state immediately on keystroke and debounce the Supabase `.upsert()` call (600ms + flush on blur), displaying a `.no-print` save status indicator (`Saving…` / `Saved ✓`) in the top command bar.
  2. Make `.checkbox-square` clickable on screen to toggle completion state while preserving the exact `10px × 10px` print box in `@media print`.
- **Command:** `/impeccable harden`

#### 3. [P1] Cognitive Overload, Accidental Whole-Week Overwrite & Extra Clicks in Cell Editor Drawer
- **Location:** `src/app/calendar/planner/page.tsx:534–545` (`handleCellClick`), `lines 3130–3270` (`Populate Full Week Schedule` inside single-cell drawer), and `lines 3645–3871` (competing assignment forms & unconfirmed note delete).
- **Why it matters:**
  1. Inside a single-day cell drawer (e.g. Wednesday Science), the top dropdown is `"Populate Full Week Schedule (Select Week 1–35)"`, which overwrites the *entire week* (Mon–Fri) and shifts future weeks' base anchors when changed.
  2. When a cell already has 1 note, clicking the cell opens the drawer with the editor collapsed (`isFormOpen = false`), forcing an extra click on a tiny pencil icon just to edit the note.
  3. Section 2 shows both a `"Full Graded / Recurring Modal"` button and a competing `"Quick Add Assignment"` form at the bottom, and clicking the trash icon deletes a note immediately with no confirmation or undo.
- **Fix (100% Print-Safe):**
  1. When clicking a cell that has 1 note, auto-populate and open that note for immediate editing (or provide a 1-click **"Move to Next Day →"** action for sick days/schedule shifts).
  2. Scope the Cell Drawer's syllabus selector to **"This Day Only (Select Class #)"** by default, moving whole-week sequence changes to a secondary toggle/button so users never overwrite Monday–Friday by mistake while editing Wednesday.
  3. Collapse the bottom `"Quick Add Assignment"` form behind a clean toggle button and add undo/confirmation to note deletion.
- **Command:** `/impeccable simplify`

#### 4. [P2] Missing Direct Week Date-Picker & Hidden "Populate Week" Empty-State CTA
- **Location:** `src/app/calendar/planner/page.tsx:1699–1739` (week stepper) and `lines 1820–1860` (`Week Tools` menu).
- **Why it matters:** Jumping from October to a spring week requires clicking `Next Week` 15+ times in a row. When landing on an empty future week (`parentNotes.length === 0`), the primary setup action (`Populate Week Placeholders`) is buried inside the `Week Tools` dropdown menu.
- **Fix (100% Print-Safe):** Add a clickable date/week picker popover on the week range pill (`Oct 18 – 22, 2026`) that snaps to the selected week's Monday, and surface a prominent `.no-print` **`Populate Week`** button whenever the current week has no notes yet.
- **Command:** `/impeccable clarify`

#### 5. [P2] On-Screen `.no-print` Token Drift, `side-tab` Borders & Keyboard Accessibility
- **Location:** `src/app/calendar/planner/page.tsx:1981, 2137, 3132` (`side-tab`), `lines 1991–2347, 2997–3150` (sub-12px chips in `.no-print` panels), `lines 2592, 2770` (unfocusable `.assignment-cell`), and `lines 3062, 3651, 3654` (unlabeled `<IconButton>`s).
- **Why it matters:** Keyboard users cannot focus or open any of the 40 planner cells (`<td>`), close modals with `Escape`, or identify unlabeled icon buttons; `.no-print` panels use `borderLeft: 4px solid` (`side-tab`), `0.68rem` micro-text, and `12px–15px` border radii instead of `DESIGN.md` tokens.
- **Fix (100% Print-Safe):** Replace `borderLeft: 4px solid` on `.no-print` cards with subject color indicator dots (`8px` circle), raise `.no-print` chip/caption text to `0.75rem`, standardize `.no-print` radii to `borderRadius: 1` (`6px`), add `tabIndex={0}` + `onKeyDown` + `aria-label` to `.assignment-cell`, and add `Escape` key closing + `aria-label`s to all modals and icon buttons.
- **Command:** `/impeccable polish`
