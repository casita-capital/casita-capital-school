---
target: "src/app/subjects-habits/page.tsx, src/app/automations/page.tsx"
timestamp: "2026-10-18T05:18:00Z"
mode: "operate"
heuristics_total: 21
heuristics_max: 40
cognitive_load_failures: 4
cli_warnings: 1
cli_advisories: 65
browser_inspected: false
previous_snapshot: null
---

# Critique Snapshot: Subjects & Habits (`src/app/subjects-habits/page.tsx`) & Automations (`src/app/automations/page.tsx`)

## 1. Holistic Overview & System Role
`src/app/subjects-habits/page.tsx` is the master registry for School Subjects (controlling the exact row sequence on the 2-page Weekly Binder Planner, Daily Timeline, and Class Gradebook) and Daily Habit Trackers (rendered in the Page 2 sidebar of the Weekly Binder). `src/app/automations/page.tsx` is the companion curriculum configuration surface for recurring weekly schedules and course syllabi.

## 2. Cognitive Load Checklist (`4 / 8` Failures)
- **Single focus**: PASS
- **Chunking**: **FAIL** — Each subject row in `src/app/subjects-habits/page.tsx:917-1101` renders up to 7 separate inline `<Chip>` components (`Outside Entity`, `Teacher`, `Email`, `Phone`, `Contact Notes`, `Zoom Link`) inside a `flexWrap="wrap"` container, causing rows with full teacher details to wrap onto 2–3 uneven lines.
- **Grouping**: **FAIL** — Subject rows in `/subjects-habits` lack a direct link/action to open that subject's **Syllabus & Automation Rules** (`/automations?subject=...`) or **Grading Policy** (`/gradebook`), forcing parents to hunt across three routes.
- **Visual hierarchy**: **FAIL** — Long free-text `teacher_contact_notes` and email/phone details are styled as full bordered `<Chip>` components competing visually with the primary Subject Name and Instruction Designation.
- **One thing at a time**: PASS
- **Minimal choices**: **FAIL** — Color selection uses a raw OS `<input type="color">` defaulting to off-palette `#0C74E4` with no curated Classical Academy ink swatches (`DESIGN.md`).
- **Working memory**: PASS
- **Progressive disclosure**: PASS

## 3. Nielsen's 10 Heuristics (`21 / 40`)
1. **Visibility of System Status**: `2 / 4` (Bare `<CircularProgress />` spinner; subject rows lack numeric rank `#1`, `#2` showing their Weekly Binder order).
2. **Match Between System & Real World**: `3 / 4` (Co-op presets like `Memoria Academy` and `Amanda Holliday Math` fit well; default `#0C74E4` hex violates Classical Academy palette).
3. **User Control and Freedom**: `1 / 4` (Single-click permanent deletion of Subjects and Habits with no confirmation or Undo toast; modals lack `Escape`-to-close and `X` close buttons).
4. **Consistency and Standards**: `2 / 4` (`borderRadius: 2 | 2.5 | 3` instead of `6px` / `borderRadius: 1`; 14 font-size advisories in `/subjects-habits` and 51 in `/automations`; `4px` left border warning in `/automations:1171`).
5. **Error Prevention**: `1 / 4` (`Delete Subject` sits immediately below `Move Down` in the row menu and executes instant DB deletion on single click).
6. **Recognition Rather Than Recall**: `3 / 4` (Presets aid recall; curated color swatches are missing).
7. **Flexibility and Efficiency of Use**: `2 / 4` (Sequential `for...of` DB update loops on reorder instead of `Promise.all`; no `Enter`-to-save on Habit/Subject forms).
8. **Aesthetic and Minimalist Design**: `2 / 4` ("Chip soup" wrapping onto 2–3 lines per subject row).
9. **Help Users Recognize, Diagnose, & Recover from Errors**: `2 / 4` (No inline `<Alert severity="error">` with `Retry` button on load failure).
10. **Help and Documentation**: `3 / 4` (Clear subtitles and URL sanitization).

## 4. Priority Issues (`P0`–`P2`)
- **P0 (Critical Safety)**: Unprotected single-click `Delete Subject` and `Delete Habit` in the 3-line menu with no 2-step confirmation and no Undo toast (`src/app/subjects-habits/page.tsx:308-320, 467-479, 1247-1265, 1444-1462`).
- **P1 (Major Layout & Single-Row Rule)**: Multi-row "chip soup" wrapping on Subject rows (`src/app/subjects-habits/page.tsx:891-1140`) when teacher email, phone, and contact notes are populated.
- **P1 (Accessibility & Keyboard UX)**: Custom Edit Subject and Edit Habit modals (`lines 1470-1831`) lack `role="dialog"`, `aria-modal="true"`, `Escape`-to-close, and header `X` close buttons; `"Taught Internally"` vs `"Outside Entity"` `<Paper>` cards (`lines 1553-1635`) are not keyboard-focusable; `<input type="color">` lacks `aria-label`.
- **P2 (Design System Drift & CLI Warnings)**: 14 font-size advisories + `#0C74E4` + off-scale radii in `src/app/subjects-habits/page.tsx`, plus 1 `side-tab` warning (`borderLeft: '4px solid ...'`) and 51 font-size advisories in `src/app/automations/page.tsx`.
- **P2 (Performance & Cross-Navigation)**: Sequential `for...of` Supabase calls on subject/habit reorder (`lines 353, 385, 497, 529`) instead of `Promise.all`, and no quick link from a subject row to its Syllabus/Automation setup.
