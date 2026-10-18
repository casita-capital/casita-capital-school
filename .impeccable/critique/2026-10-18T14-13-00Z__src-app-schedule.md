---
target: src/app/schedule/page.tsx (with companion src/app/today/page.tsx)
mode: operate
timestamp: 2026-10-18T14:13:00Z
browser_available: false
---

## Scores

| Heuristic | Score | Note |
|---|---|---|
| H1: Visibility of System Status | 2/4 | Zero active drop-target highlight during HTML5 drag; bare `<CircularProgress />` spinner; no persistent fetch error state |
| H2: Match Between System & Real World | 3/4 | 12-hour AM/PM labels and familiar break templates; palette uses jargon "Custom Activities (Uncolored)" |
| H3: User Control & Freedom | 2/4 | Instant unconfirmed delete (`<Trash2>`) with no Undo; no multi-day copy or clear-day action |
| H4: Consistency & Standards | 1/4 | `Card elevation={8}`, `borderRadius: 3`, hardcoded Tailwind grays (`#374151`, `#111827`, `#0C74E4`), 7 sub-`12px` font violations, 2 `any` casts |
| H5: Error Prevention | 1/4 | Inline `<Trash2>` has no confirmation/undo; Edit Modal `End Time` omits `scheduleEndHour:00` (`19:00`); `8px` resize bars crowd 15-min blocks |
| H6: Recognition Rather Than Recall | 3/4 | Visible left palette and inherited subject links; `Class` vs `Homework` toggle is hidden until after drop |
| H7: Flexibility & Efficiency of Use | 1/4 | Mouse drag-and-drop ONLY; no click-to-add, no `+ Add Block` button, no keyboard support, and no Mon–Fri multi-day creation/duplication |
| H8: Aesthetic & Minimalist Design | 2/4 | 48 rows all repeat full `:15/:30/:45 AM/PM` strings; 240 dashed cells + always-visible dark resize bars create visual clutter |
| H9: Help Users Recognize & Recover from Errors | 2/4 | Collision/auto-squeeze toasts work well, but initial fetch failure leaves a blank grid with no `<Alert severity="error">` Retry banner |
| H10: Help & Documentation | 3/4 | Clear helper text in modal and palette, though limited to mouse drag instructions |
| **Total** | **20/40** | **5/8 Cognitive Load failures; 21 CLI findings (1 warning + 20 advisories across `/schedule` & `/today`)** |

## Findings

| # | Severity | Antipattern | Source | Location | Summary |
|---|---|---|---|---|---|
| 1 | P0 | keyboard-touch-lockout | [A] | `src/app/schedule/page.tsx:638` | Schedule blocks can ONLY be created/moved via desktop HTML5 drag-and-drop (`draggable`/`onDrop`); no click-to-add, `+ Add Block` button, or keyboard/tablet support. |
| 2 | P1 | multi-day-efficiency-and-endtime-bug | [A] | `src/app/schedule/page.tsx:166,1133` | No way to apply or copy a block across multiple days (e.g. `Mon–Fri`), requiring 35+ drags for a weekly routine; also `End Time` select omits `scheduleEndHour:00` (`19:00`). |
| 3 | P1 | design-system-and-ts-drift | [both] | `src/app/schedule/page.tsx:81,461,670` | 2 explicit `any` casts (violating `.agents/AGENTS.md`), 12 CLI advisories in `/schedule` (8 on-screen: sub-`12px` fonts `0.58rem`–`0.7rem`, `8px` radius, off-palette colors) + 9 CLI findings in `/today` (including `side-tab` `6px` left border warning and hardcoded `#0C74E4`). |
| 4 | P1 | grid-noise-and-destructive-delete | [A] | `src/app/schedule/page.tsx:780,951` | All 48 rows print full `7:15 AM` strings; resize handles and unconfirmed `<Trash2>` buttons are permanently visible; no active drop-slot highlight during drag; no Undo on delete. |
| 5 | P2 | sticky-palette-overflow-and-print-clipping | [A] | `src/app/schedule/page.tsx:623,1166` | Sticky palette overflows laptop viewports without internal scroll; `@media print` clips 30-min block text and lacks `print-color-adjust: exact`; `/today` shows the red `NOW` line on every weekday tab and ignores homework block tinting. |

## Recommended Commands

- `/impeccable harden` — Add click/keyboard creation (`+ Add Block`, clickable slots/palette), multi-day `Mon–Fri` apply/duplicate, `End Time` boundary fix, and 2-step/Undo delete protection.
- `/impeccable normalize` — Align `/schedule` and companion `/today` with `DESIGN.md` (`0.75rem` floor, `tabular-nums`, `borderRadius: 1`, Classical Academy tokens) and remove all `any` casts.
- `/impeccable polish` — De-noise the 15-minute time rail, add active drag-over slot highlighting, reveal resize/delete controls on hover/focus, and protect single-page print legibility.
