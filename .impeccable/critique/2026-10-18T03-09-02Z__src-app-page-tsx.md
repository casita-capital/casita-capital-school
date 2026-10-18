---
target: src/app/page.tsx
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\page.tsx"
target_fingerprint: "sha256:5a3175b6b57470f379ee5093e63be20551ebf36aad9d171a8abcd800ff48a513"
target_path: "C:\\Dev\\CasitaCapital\\casita-capital-school\\src\\app\\page.tsx"
timestamp: 2026-10-18T03-09-02Z
slug: src-app-page-tsx
---
Method: dual-agent (A: e021cf21-a600-4e86-9762-3e89dcc983fe · B: e66a4d9d-38ea-4b85-a19f-0a16d75b5e75)

## Design Critique: Casita Capital School Dashboard (`src/app/page.tsx` & Layout Shell — Post-Remediation Pass)

### Design Health
- **Design Specificity:** **Passed** — The dashboard and layout shell now embody "The Classical Academy Binder" aesthetic (`DESIGN.md`), combining `Newsreader` editorial serif headings (`h1`–`h5`) with `Inter` (`tabular-nums`) for dense tables, warm archival paper/ink surfaces (`#fcfbf8` Warm Ivory, `#f7f4ee` Parchment Paper, `#26231e` Study Slate, `#171614` Obsidian Ink), a flattened **Parent Supply Sourcing Checklist**, and single-row human-readable dates (`Fri, Oct 18`).
- **Usability Heuristics:** **35/40** (Good — up from **19/40** in the initial baseline pass)
  - Visibility of System Status: 3.5/4
  - Match Between System and Real World: 4/4
  - User Control and Freedom: 3/4
  - Consistency and Standards: 3.5/4
  - Error Prevention: 3.5/4
  - Recognition Rather Than Recall: 4/4
  - Flexibility and Efficiency of Use: 3/4
  - Aesthetic and Minimalist Design: 4/4
  - Help Users Recognize, Diagnose, and Recover from Errors: 3.5/4
  - Help and Documentation: 3/4
- **Cognitive Load:** **Low** (0/8 checklist failures — down from 3/8)
- **Automated Checks:** **0 findings** across `src/app/page.tsx`, `src/layouts/sidebar.tsx`, `src/layouts/header.tsx`, `src/layouts/index.tsx`, `src/components/base/logo.tsx`, and `src/theme/` (down from 13 findings in the initial baseline pass).

### What's Working
- **Authentic "Classical Academy Binder" Editorial System (`DESIGN.md`, `src/theme/`, `src/app/page.tsx`)**: Pairing `Newsreader` serif headers with `Inter` `tabular-nums` data tables, warm parchment/stone surfaces (`#fcfbf8` / `#f7f4ee`), and zero-elevation `1px solid` cards creates a domain-authentic homeschooling command center.
- **Single-Row Scannability & Flattened Supply Checklist (`src/app/page.tsx:820-1565`)**: Removing the 4 redundant promotional navigation cards, flattening the **Parent Supply Sourcing Checklist** (eliminating `nested-cards`), reducing the bottom external schedule table from 7 to 5 columns, and enforcing `whiteSpace: 'nowrap'` on all table headers, due/scheduled dates (`Fri, Oct 18`), class names, counts, and action buttons prevent 2-row wrapping on 13-inch viewports.
- **Full Keyboard & Dynamic Accent Compliance (`src/layouts/header.tsx`, `src/layouts/sidebar.tsx`, `src/components/base/logo.tsx`)**: Replacing hardcoded `#0C74E4` styles with `theme.palette.primary.main`, enforcing the `0.75rem` (`12px`) typography floor, fixing the inverted `caption` scale, and converting custom theme swatches into keyboard-focusable `role="radio"` `<ButtonBase>` controls brought both visual discipline and WCAG keyboard compliance up to standard.

### Priority Issues

#### 1. [P2] Duplicate `/today` CTA with Conflicting Labels in Adjacent Header Bars
- **Location:** `src/layouts/header.tsx:211-228` (`"Daily Timeline"` button linking to `/today`) vs. `src/app/page.tsx:677-695` (`"Today's Schedule"` button linking to `/today`).
- **Why it matters:** On desktop, the global `Header` bar sits directly above the dashboard greeting card (`page.tsx:642`). Both right-aligned action groups display an outlined button with `<Clock size={16} />` linking to `/today`, but one calls it **"Daily Timeline"** and the other calls it **"Today's Schedule"**.
- **Fix:** Remove the duplicate `"Today's Schedule"` button from the dashboard greeting card (or replace it with a distinct dashboard action) and standardize the `/today` label as `"Daily Timeline"`.
- **Command:** `/impeccable polish`

#### 2. [P2] Sequential Modal Friction When Clearing Multiple Overdue Grades
- **Location:** `src/app/page.tsx:948-968` (`Enter Grade` button in `Past-Due Assignments Needing Grades`) & `src/app/page.tsx:1577-1599` (`UnifiedAssignmentModal`).
- **Why it matters:** When a parent grades 5–8 overdue items in a sitting, opening and closing `UnifiedAssignmentModal` one row at a time adds repetitive clicks, and once saved, the row immediately disappears from `pastDueUngradedAssignments` with no quick way to re-open or undo from the toast notification.
- **Fix:** Add a `"Save & Grade Next"` workflow or include an `"Edit"` action button on the `toast.success` notification, and manage focus return when a graded row unmounts.
- **Command:** `/impeccable harden`

#### 3. [P3] Dual Auth & Profile Fetching Spinner Waterfall on Initial Load
- **Location:** `src/layouts/index.tsx:34-56`, `src/layouts/header.tsx:86-125`, and `src/app/page.tsx:211-294`.
- **Why it matters:** On hard refresh, `Layout` shows a full-screen session spinner, then `Header` and `SchoolDashboardPage` independently re-query `supabase.auth.getUser()` and `users` while showing a second `CircularProgress` spinner inside `<main>`.
- **Fix:** Share the authenticated user profile via React context and replace the bare `CircularProgress` with card skeletons matching the 3-card dashboard layout.
- **Command:** `/impeccable polish`

### Persona Red Flags
- **Impatient Power User (Alex):** Flags the duplicate `/today` button in the two stacked top bars and wants a faster multi-row grading flow (`"Save & Grade Next"`) when clearing Friday grading backlogs.
- **Accessibility-Dependent User (Sam):** Notes that when an overdue row is graded and unmounts from `Past-Due Assignments Needing Grades`, keyboard focus should move predictably to the next `Enter Grade` button rather than dropping to `document.body`, and scrollable `<TableContainer sx={{ maxHeight: 400 }}>` regions should expose `tabIndex={0}` + `role="region"` for keyboard scrolling.
- **Homeschool Parent-Instructor (Elena):** Notes that synthetic syllabus rows (`syl-act-...`) in the bottom table show `"Due This Week"` without an `<Edit3 />` grade button because they aren't linked to an `assignments` DB row yet—adding a tooltip or quick-create action would clarify how to record completion.

### Minor Observations
- **Grade Chip Thresholds (`src/app/page.tsx:1166-1172`):** Percentages below `80%` all use `color="warning"`; distinguishing `< 70%` with `color="error"` would make at-risk course grades stand out more clearly.
- **Scrollable Table Header Tint (`src/app/page.tsx:823, 1056, 1332`):** Matching the subtle header background across all three tables further unifies the binder sheet aesthetic.
