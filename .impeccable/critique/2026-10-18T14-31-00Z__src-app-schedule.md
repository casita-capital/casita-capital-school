---
target: src/app/schedule/page.tsx (with companion src/app/today/page.tsx)
mode: operate
timestamp: 2026-10-18T14:31:00Z
browser_available: false
---

## Scores

| Heuristic | Score | Note |
|---|---|---|
| H1: Visibility of System Status | 4/4 | Structural `<Skeleton>` loading states, active `dragOverSlot` highlight, hover/focus `+` slot hints, `<Alert severity="error">` Retry banner, and `(Today)` tab badge + accurate `NOW` line on `/today` |
| H2: Match Between System & Real World | 4/4 | Classical Academy Binder tokens, `"Breaks & Daily Routines"` terminology, Lucide icons, and `"Solid = Class, Tinted = Homework"` legend |
| H3: User Control & Freedom | 4/4 | 5-second Undo `<Snackbar>` on all block deletions + 2-step `Confirm Delete?` / `Cancel` in the modal + explicit modal close buttons |
| H4: Consistency & Standards | 4/4 | Zero `any` casts, `0.75rem` font floor, `tabular-nums` on all time labels, `borderRadius: 1` (`6px`), and identical Class/Homework tinting across `/schedule` and `/today` |
| H5: Error Prevention | 4/4 | `endTimeSlots` includes `scheduleEndHour:00` (`7:00 PM`) and filters `validEndTimeSlots > editStartTime`; per-day collision checks during multi-day creation/duplication |
| H6: Recognition Rather Than Recall | 4/4 | Top-level `Class` vs `Homework` mode toggle in the left palette with live pill preview, plus inline `Hours: 7:00 AM – 7:00 PM` range control |
| H7: Flexibility & Efficiency of Use | 4/4 | 4 ways to schedule (drag-and-drop, click empty slot, click palette item, or `+ Add Block`) + `Mon–Fri`, `M/W/F`, `T/Th` multi-day application |
| H8: Aesthetic & Minimalist Design | 3/4 | Clean Classical Academy time rail (bold `:00` hours, subtle `:30` labels, minimal `:15`/`:45` ticks) and hover/focus-revealed resize & delete controls |
| H9: Help Users Recognize & Recover from Errors | 3/4 | Persistent `<Alert severity="error">` Retry banners on both `/schedule` and `/today` + 5-second Undo toast |
| H10: Help & Documentation | 3/4 | Clear captions and inline guidance for click-to-schedule, multi-day copying, and Class vs. Homework visual encoding |
| **Total** | **37/40** | **Up from 20/40 (+17 points)** |

- **Cognitive Load Failures**: 0/8 (down from 5/8; all 8 items pass)
- **CLI Findings**: 0 warnings, 0 advisories across both `/schedule` and `/today` (down from 21 findings: 1 warning + 20 advisories)

## Findings

| # | Severity | Antipattern | Source | Location | Summary |
|---|---|---|---|---|---|
| 1 | P3 | preset-dropdown-routines | [A] | `src/app/schedule/page.tsx:1958` | Including the 5 `ROUTINE_TEMPLATES` directly inside the modal's preset dropdown (in addition to the clickable palette items) could save typing when opening via `+ Add Block`. |
| 2 | P3 | dynamic-accent-token | [A] | `src/app/today/page.tsx:840` | Using `primary.main` instead of `#1b5698` on the `CLASS` badge chip would adapt automatically when switching Academy Accent Ink presets. |

## Recommended Commands

- `/impeccable polish` — Optional future micro-refinements.
