---
date: 2026-10-18T04:08:30Z
target: src/app/assignments/page.tsx, src/app/gradebook/page.tsx, src/components/assignments/
mode: operate
heuristics_score: 23
cognitive_load_failures: 5
p0: 0
p1: 3
p2: 2
p3: 2
cli_findings: 133
browser_findings: 0
---

# Design Critique (Baseline): Assignments & Gradebook (`src/app/assignments/page.tsx`, `src/app/gradebook/page.tsx`)

## 1. Holistic Summary & Relationship Between `/assignments` and `/gradebook`
- **`/assignments` ("School Assignments Manager")** acts as an item-centric operational queue (flat list across classes, recurring assignment rules, and imported syllabus staging).
- **`/gradebook` ("Gradebook & Reports")** acts as a course-centric academic rollup & compliance ledger (class standing rows with expandable Moodle-style category breakdowns, daily attendance/Carnegie hours, and printable Report Cards/Transcripts).
- **Key Friction Points**:
  1. **Multi-row table cell wrapping**: Raw ISO dates (`Opens: 2026-10-12`, `Closes: 2026-10-18`) and missing `whiteSpace: 'nowrap'` across 8 tables in `/assignments` and `/gradebook` cause date columns, grade badges, class names, and action buttons to slide into 2–3 rows.
  2. **Permanent inline `<input>` clutter on graded rows**: In `/assignments`, every single row renders both a `GRADE` column (`Enter Grade` / score badge) AND a separate `SCORE INPUT` column with live `[Total] [Missed] [Save]` input boxes—even when the assignment is already graded—creating a 7-column table with 100+ visible `<input>` boxes.
  3. **Moodle LMS technical complexity in `/gradebook` expanded drawer**: Expanding a class in `/gradebook` renders a 7-column Moodle replica (`Calculated weight`, `Range 0–100`, `Contribution to course total`, `AGGREGATION Σ`) with neon `#2563EB`/`#E11D48` badges, plus ~250 lines of dead staging/recurring state in `/gradebook/page.tsx`.
  4. **Broken Report Card date filter in `/gradebook`**: In `/gradebook` Tab 3 (`activeTab === 'reports'`), the `Report Period` selector (`reportDateFilterMode`, `reportStartDate`, `reportEndDate`) is rendered in the toolbar but never wired to filter the Report Card table.
  5. **Keyboard & Destructive Action Safety**: Pressing `Enter` inside inline score inputs does not save; pressing `Escape` does not close custom `<Box position="fixed">` modals or menus; and clicking `<Trash2>` immediately deletes assignments or recurring rules without confirmation or Undo.

---

## 2. Cognitive Load Checklist (5 Failures / 8 — High Cognitive Load)
- [ ] **1. Single focus**: FAIL (16+ filter/tab targets + 7-column table with permanent `<input>` boxes on every row).
- [ ] **2. Chunking**: FAIL (5 status sub-tabs, 8+ category filter pills, 6-item class menu).
- [x] **3. Grouping**: PASS.
- [ ] **4. Visual hierarchy**: FAIL (Competing `"Enter Grade"` button + `[Earned]/[Max] [Save]` inputs on every row; neon `#2563EB`/`#E11D48` icons in `/gradebook`).
- [x] **5. One thing at a time**: PASS.
- [ ] **6. Minimal choices**: FAIL (>4 visible options in filter strips and overridden API score cells).
- [x] **7. Working memory**: PASS (Real-time percentage/letter grade calculators).
- [ ] **8. Progressive disclosure**: FAIL (Inline score inputs shown permanently on already-graded rows; 8-pill type filter row always expanded).

---

## 3. Nielsen's 10 Usability Heuristics (23 / 40)

| # | Heuristic | Score | Evidence |
|---|-----------|:-----:|----------|
| 1 | Visibility of System Status | 3/4 | Good status counts & live grade calculators; bare initial loading spinners and no dirty indicator on inline inputs. |
| 2 | Match Between System & Real World | 2/4 | Strong homeschool concepts (Carnegie units, Total/Missed calculator), hurt by raw `YYYY-MM-DD` dates and Moodle LMS jargon (`Contribution to course total`). |
| 3 | User Control and Freedom | 2/4 | Great API override revert options, but custom modals/menus ignore `Escape` and deletes have no confirmation/Undo. |
| 4 | Consistency and Standards | 2/4 | Raw `<input>` in `/assignments` vs MUI `<TextField>` in `/gradebook`; mixed `borderRadius: 1.5–3` (`999px` pills); custom header card in `/gradebook` vs `<PageHeading>`. |
| 5 | Error Prevention | 2/4 | `ApiGradeOverrideWarningModal` is great, but `<Trash2>` deletes immediately and `Enter` in inline inputs does nothing. |
| 6 | Recognition Rather Than Recall | 3/4 | Clear status explanations and 1-click planner checklist linking; icon-only buttons in secondary tabs lack labels. |
| 7 | Flexibility and Efficiency of Use | 2/4 | Inline score inputs lack `Enter`-to-save; no `"Approve All"` batch action on Imported Pending Assignments. |
| 8 | Aesthetic and Minimalist Design | 2/4 | 100+ permanent `<input>` boxes in `/assignments`, sub-12px micro-text (`0.6rem`–`0.7rem`), and multi-row wrapping cells. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 2/4 | Transient `toast.error` only; no inline error/retry banner. |
| 10 | Help and Documentation | 3/4 | Helpful inline calculators and Carnegie unit documentation. |

---

## 4. Priority Issues

1. **[P1] Table Columns & Dates Slide into Two Rows Across `/assignments` and `/gradebook`**:
   - Raw ISO dates (`Opens: 2026-10-12`, `Closes: 2026-10-18`) and missing `whiteSpace: 'nowrap'` across all tables cause dates, class names, grades, and action buttons to wrap onto 2–3 rows.
2. **[P1] Permanent Inline Input Wall & Redundant `GRADE` + `SCORE INPUT` Columns in `/assignments`**:
   - Rendering permanent `<input>` boxes on already-graded rows alongside a separate `GRADE` column creates a 7-column table where headers and controls wrap.
3. **[P1] Keyboard Traps (`Enter` to Save, `Escape` on Modals/Menus) & Unconfirmed Immediate Deletes**:
   - Inline score inputs ignore `Enter`; custom `<Box position="fixed">` modals/menus ignore `Escape`; `<Trash2>` immediately deletes assignments/rules without confirmation or Undo.
4. **[P2] `/gradebook` Expanded Drawer Complexity, Unwired Report Card Date Filter & Dead Code**:
   - Expanded class drawer has 7 dense Moodle columns (`Range 0–100`, `Contribution to course total`); Report Card `Report Period` filter (`reportDateFilterMode`) is unwired; ~250 lines of dead staging/recurring code remain in `/gradebook/page.tsx`.
5. **[P2] `DESIGN.md` Token Drift (Sub-12px Micro-Text, Off-Palette Hexes, & Non-Standard Radii)**:
   - 66 on-screen CLI detector advisories (`0.6rem`–`0.7rem` micro-text, `#92400E`/`#F59E0B`/`#2563EB`/`#E11D48`/`#0C74E4` hexes, `999px` and `borderRadius: 2–3` radii).
