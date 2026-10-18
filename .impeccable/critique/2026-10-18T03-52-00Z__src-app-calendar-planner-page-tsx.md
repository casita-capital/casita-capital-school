---
date: 2026-10-18T03:52:00Z
target: src/app/calendar/planner/page.tsx
mode: operate
heuristics_score: 39
cognitive_load_failures: 0
p0: 0
p1: 0
p2: 0
p3: 2
cli_findings: 101
browser_findings: 0
---

# Design Critique (Post-Remediation): Weekly Binder Planner (`src/app/calendar/planner/page.tsx`)

## Design Trend vs. Previous Snapshot (`2026-10-18T03-22-45Z__src-app-calendar-planner-page-tsx.md`)
- **Nielsen Heuristics Score**: **24 / 40 → 39 / 40 (+15 points)**
- **Cognitive Load Failures**: **6 / 8 → 0 / 8 (-6 failures)**
- **Priority Issues**: **P0: 0 → 0 | P1: 3 → 0 | P2: 2 → 0 | P3: 0 → 2**
- **On-Screen `.no-print` CLI Detector Findings**: **19 findings (3 `side-tab` warnings, 16 advisories) → 0 findings (0 warnings, 0 advisories)**
- **Sacred 2-Page Print Layout (`@media print` & `.planner-print-root`)**: **100% preserved with zero regression** (`101` intentional print-sheet preview/monochrome print CSS rules untouched).

---

## What Was Remediated

1. **[P1 Resolved] On-Screen View Mode Switcher + Uncrushed Canvas + In-Drawer Steppers**:
   - Kept the **2-Page Binder** view as the default on-screen view, added **`Page 1` / `Page 2`** smooth-scroll jump buttons, a **`Side-by-Side`** 2-page spread toggle (`spread-mode`), and a screen-only **`5-Day Grid`** unified Mon–Fri table (`className="no-print"`) while `@media print` always prints the exact 2-page `.planner-print-root` binder layout.
   - Removed `pr: openCellModal ? { xs: 0, md: '500px' } : 0` so opening the Cell Drawer never crushes the binder table columns.
   - Added `< Prev Day | Next Day >` and `↑ Prev Subject | ↓ Next Subject` steppers inside the Cell Drawer header with `.active-cell-screen` focus highlighting on the active cell.
2. **[P1 Resolved] Debounced Page 2 Sidebar Auto-Save (`600ms` + Flush on Blur)**:
   - Replaced keystroke-level Supabase `.upsert()` spam on the 13 Page 2 sidebar inputs (`todos`, `priorities`, `for_next_month`, `notes`) with `handleQueueSettingsSave` (`600ms` debounce) + `flushPendingSettingsSave` on `onBlur` and week navigation, paired with a live `Saving… / Saved ✓` chip in the command bar.
3. **[P1 Resolved] Streamlined Cell Editor Drawer**:
   - Clicking a cell with 1 existing note (`squareNotes.length === 1`) now opens directly in edit mode, skipping the extra click on the small pencil icon.
   - Scoped the Cell Drawer syllabus dropdown to **`Populate This Day Only (${selectedDate}) — Select Class`** by default, tucking **`Adjust Full-Week Syllabus Schedule (Mon–Fri)…`** behind a progressive-disclosure toggle (`showFullWeekSyllabusInCell`).
   - Collapsed **`Quick Add Assignment`** behind a toggle button (`showQuickAddAssignment`), and added two-step inline delete confirmation (`Confirm Delete`) plus a 5-second **Undo** toast that restores deleted notes.
4. **[P2 Resolved] Direct Week/Date Picker & Prominent `Populate Week` CTA**:
   - Made the week range pill (`Oct 18 – 22, 2026`) a clickable native date picker button (`handleJumpToPickedDate`) that snaps any picked date to its Monday (`getMondayForDateStr`).
   - Surfaced a prominent **`Populate Week`** button in the top command bar whenever `parentNotes.length === 0`.
5. **[P2 Resolved] Keyboard Accessibility & `DESIGN.md` Token Alignment**:
   - Added `tabIndex={0}`, `role="button"`, `aria-label`, and `Enter`/`Space` keyboard handlers to all `.assignment-cell` elements, `Escape` dismissal for modals/drawers, and `aria-label` attributes on icon buttons and sidebar inputs.
   - Updated `DEFAULT_SUBJECTS` to `DESIGN.md` classical academy palette tokens, replaced all 3 `borderLeft: 4px solid` (`side-tab` warnings) with `8px` circular subject indicator dots, enforced `borderRadius: 1` (`6px`) and the `0.75rem` (`12px`) font floor across all `.no-print` chrome, and replaced the bare loading spinner with a structured `<Skeleton>` layout.

---

## Updated Heuristic Scores (39 / 40)

| # | Heuristic | Baseline | Post-Fix | Notes |
|---|-----------|:--------:|:--------:|-------|
| 1 | Visibility of System Status | 2/4 | **4/4** | Structured `<Skeleton>`, live `Saving… / Saved ✓` chip, `.active-cell-screen` cell highlight. |
| 2 | Match Between System and Real World | 4/4 | **4/4** | Physical 2-page binder fidelity + flexible screen views (`2-Page`, `Side-by-Side`, `5-Day Grid`). |
| 3 | User Control and Freedom | 2/4 | **4/4** | `Escape` dismissal, in-drawer Day/Subject steppers, two-step delete + 5s `Undo` toast. |
| 4 | Consistency and Standards | 2/4 | **4/4** | 0 `.no-print` CLI detector warnings/advisories; full `DESIGN.md` token alignment. |
| 5 | Error Prevention | 2/4 | **4/4** | Day-scoped syllabus default in Cell Drawer; auto-flush of pending sidebar edits before week changes. |
| 6 | Recognition Rather Than Recall | 3/4 | **4/4** | Unified 5-Day & Side-by-Side views eliminate Mon–Wed vs. Thu–Fri recall friction. |
| 7 | Flexibility and Efficiency of Use | 1/4 | **4/4** | Direct week date picker, single-note auto-edit, cell steppers, keyboard navigation, top-bar `Populate Week`. |
| 8 | Aesthetic and Minimalist Design | 3/4 | **4/4** | Uncrushed canvas, progressive disclosure in Cell Drawer, `8px` subject color dots. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 2/4 | **3/4** | Retryable `Save error` chip + `Undo` note restore toast (minor P3: initial load error still uses toast). |
| 10 | Help and Documentation | 3/4 | **4/4** | Clear view switcher tooltips, helper text on full-week overrides, live note & pull-forward previews. |
