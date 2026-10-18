---
target: src/app/subjects-habits/page.tsx (with companion src/app/automations/page.tsx)
mode: operate
timestamp: 2026-10-18T05:51:00Z
browser_available: false
---

## Scores

| Heuristic | Score | Note |
|---|---|---|
| H1: Visibility of System Status | 4/4 | `tabular-nums` rank chips (`#1`, `#2`), structured `<Skeleton>` loading state, inline delete-confirm state, and 5-second Undo `<Snackbar>` |
| H2: Match Between System & Real World | 4/4 | Classical Academy Binder aesthetic, `"Syllabus & Rules"` quick-links, and 8 curated Classical Academy ink swatches |
| H3: User Control & Freedom | 4/4 | 2-step inline delete confirmation (`Confirm Delete?` / `Cancel`) + 5-second Undo toast, plus `Escape`-to-close and header close buttons across all modals |
| H4: Consistency & Standards | 4/4 | Full alignment with `DESIGN.md`: `0.75rem` minimum type floor, `borderRadius: 1` (`6px`), `#1b5698` ink tokens, and `8px` circular subject dots |
| H5: Error Prevention | 4/4 | Non-blocking inline confirmation replaces browser `confirm()`, preventing accidental cascade deletion of subjects, habits, and syllabus rules |
| H6: Recognition Rather Than Recall | 4/4 | Structured 4-column Subject Roster table and 2-column Habit Trackers table with persistent headers, inline Up/Down buttons, and direct `"Syllabus & Rules"` chips |
| H7: Flexibility & Efficiency of Use | 4/4 | Batched `Promise.all` subject reordering, one-click inline Up/Down arrows alongside drag-and-drop, and direct deep-linking to `/automations?subject=${s.id}` |
| H8: Aesthetic & Minimalist Design | 4/4 | Single-row tabular clarity with `whiteSpace: 'nowrap'` on rank, provider, contact/link pills, and action toolbars |
| H9: Help Users Recognize & Recover from Errors | 4/4 | Dismissible `<Alert severity="error">` with inline `Retry` button on both `/subjects-habits` and `/automations` |
| H10: Help & Documentation | 3/4 | Clear empty states, helper text, and modal subtitles; room for a future sample syllabus template preview |
| **Total** | **39/40** | **Up from 21/40 (+18 points)** |

- **Cognitive Load Failures**: 0/8 (down from 4/8; all 8 items pass)
- **CLI Findings**: 0 warnings, 0 advisories (down from 1 warning + 65 advisories)

## Findings

| # | Severity | Antipattern | Source | Location | Summary |
|---|---|---|---|---|---|
| 1 | P3 | help-documentation | [A] | `src/app/automations/page.tsx:520` | Adding a one-click "Insert Sample Classical Syllabus Pattern" helper in the Syllabus Uploader modal could further speed up first-time parent setup. |

## Recommended Commands

- `/impeccable polish` — Optional future micro-refinements as real curriculum syllabi are imported.
