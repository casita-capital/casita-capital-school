---
target: "src/app/assignments/page.tsx, src/app/gradebook/page.tsx, src/components/assignments/"
timestamp: "2026-10-18T05:13:00Z"
mode: "operate"
heuristics_total: 38
heuristics_max: 40
cognitive_load_failures: 0
cli_warnings: 0
cli_advisories: 66
cli_onscreen_advisories: 0
browser_inspected: false
previous_snapshot: "2026-10-18T04-08-30Z__src-app-assignments-and-gradebook.md"
---

# Post-Remediation Critique Snapshot: Assignments & Gradebook (`/assignments` & `/gradebook`)

## Score Trend (`23/40` → `38/40`)

| Metric | Baseline (`04:08:30Z`) | Post-Remediation (`05:13:00Z`) | Delta |
|---|---:|---:|---:|
| **Nielsen Heuristics Total** | `23 / 40` | **`38 / 40`** | **`+15`** |
| **Cognitive Load Failures** | `5 / 8` | **`0 / 8`** | **`-5`** |
| **On-Screen CLI Advisories** | `66` | **`0`** | **`-66`** |
| **Print-Sheet Paper Advisories** | `67` | **`66`** (intentional white-paper Report Card / Transcript rules) | `-1` |

## Summary of Remediations Verified

1. **Unified `GRADE & SCORE` Column in `/assignments` (`A1`)**:
   - Merged `GRADE` and `SCORE INPUT` into 1 unified column (`GRADE & SCORE`), displaying single-row inline inputs (`[Total/Missed]` or `[Earned/Max]`) with `Enter`-to-save on ungraded items, and a crisp read-only Grade Badge + `Edit Score` trigger on already-graded items.
2. **Streamlined 6-Column Expanded Course Grade Card Table in `/gradebook` (`A2`)**:
   - Reduced the expanded course table from 8 columns to 6 concise single-row columns (`ASSIGNMENT / ITEM`, `DUE DATE`, `WEIGHT`, `RANGE`, `GRADE`, `SCORE / ACTIONS`) with `whiteSpace: 'nowrap'` and `tabular-nums`.
   - Kept explicit, scannable columns for both `WEIGHT` (with `Contrib: X.XX%` sub-caption) and `RANGE` (`0–100`), while folding `Feedback` cleanly beneath the Assignment title when present.
3. **Single-Row Human-Readable Dates Across All Tables (`A3.1`)**:
   - Added `formatCompactDate` (`'Fri, Oct 18'`) with `whiteSpace: 'nowrap'` across all assignment tables, recurring rule tables, expanded gradebook course tables, daily attendance logs, and itemized report card tables.
4. **Keyboard Ergonomics & 2-Step Delete Safety (`A3.2`)**:
   - Added `Enter`-to-save on all inline score inputs (`Total`, `Missed`, `Earned`, `Possible`).
   - Added `Escape`-to-close and `role="dialog" aria-modal="true"` across all 6 modals (`UnifiedAssignmentModal`, `QuickGradeAssignmentModal`, `ApiGradeOverrideWarningModal`, `AssignmentTypesManagerModal`, `ClassGradingPolicyModal`, and the Term Override modal) as well as header dropdowns.
   - Replaced immediate single-click deletions with a 2-step inline `Confirm?` prompt + 5-second **Undo** toast that restores deleted assignments or recurring rules.
5. **Wired Report Card Date Filter, Batch Approval & `DESIGN.md` Token Alignment (`A3.3`)**:
   - Wired `reportDateFilterMode` (`all_term`, `this_week`, `this_month`, `custom_range`) to `reportFilteredAssignments` and `reportSubjectSummaries` in `/gradebook`.
   - Added batch `"Approve All as Graded ({count})"` button in Tab 3 (`imported_pending`) of `/assignments`.
   - Replaced bare loading spinners with structured `<Skeleton>` placeholders and resolved **100% (66 → 0)** of on-screen `DESIGN.md` token advisories (`0.75rem` font floor, `borderRadius: 1` / `6px`, `#1b5698` primary blue, `8px` subject dots).
