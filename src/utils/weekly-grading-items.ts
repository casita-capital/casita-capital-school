import {
  encodePlannerNoteFields,
  extractDailyMarkerFromLine,
  extractVerifiedMetaFromLine,
  extractWeeklySharedDaysFromLine,
  getPlannerNoteCategory,
  isNoteLineCoveredByAssignment,
  PARENT_NOTE_MARKER,
  stripParentNoteMarker,
  stripVerifiedMetaMarker,
  stripWeeklySharedMarker,
} from 'src/components/base/formatted-parent-note';
import {
  GradebookAssignment,
  isAssignmentApiSynced,
  isAssignmentCompletedOrSubmitted,
  isAssignmentScored,
  RecurringAssignmentTemplate,
  ScoringMode,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import { DAY_KEYS, DAY_LABELS, DayKey } from 'src/utils/recurring-planner';

export type WeeklyItemCategory = 'info' | 'verified' | 'graded';
export type InfoSubType = 'header' | 'divider' | 'bullet' | 'parent_note';

export interface PlannerParentNoteRecord {
  id: string;
  subject_id: string;
  note_date: string;
  title?: string | null;
  description: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StructuredSubItem {
  id: string;
  text: string;
  checked: boolean;
  isBullet?: boolean;
  sourceLineIndex?: number;
}

export interface WeeklySourceNoteRef {
  noteId: string;
  dateStr: string;
  dayKey: DayKey;
  lineIndices: number[];
}

export interface StructuredCellLineItem {
  id: string;
  subjectId: string;
  dateStr: string;
  dayKey: DayKey;
  weekdayLabel: string;
  category: WeeklyItemCategory;
  text: string;
  /** Sub-style when category === 'info' */
  infoSubType: InfoSubType;
  /** Completion state when category === 'verified' or 'graded' */
  checked: boolean;
  /** Multi-line grouped sub-items evaluated together with this item block */
  subItems: StructuredSubItem[];
  /** Whether this block is shared across multiple days of the week (evaluated once per week & synced across days) */
  repeatAcrossWeek: boolean;
  /** Verification cadence when repeating across days: 'weekly_shared' (verified once) vs 'daily' (verified each day) */
  repeatCadence?: 'weekly_shared' | 'daily';
  /** Which days of the week this block repeats on when repeatAcrossWeek === true or repeatCadence === 'daily' */
  repeatDays: DayKey[];
  /** Canonical key identifying this block across days of the same week */
  weeklyGroupKey: string;
  /** All note references across the week when consolidated on the Weekly Grading Summary */
  weeklySourceNotes?: WeeklySourceNoteRef[];
  /** Reference to originating parent_notes row & line index (when backed by parent_notes) */
  sourceNoteId?: string;
  sourceLineIndex?: number;
  /** Which line indices in sourceNoteId belong to this item (including subItems) */
  sourceGroupLineIndices?: number[];
  /** Reference to originating school.assignments row (when backed by assignments) */
  assignmentId?: string;
  assignmentRecord?: GradebookAssignment;
  assignmentCategory: string;
  scoringMode: ScoringMode;
  pointsEarned: number | null;
  pointsPossible: number;
  totalProblems: number | null;
  problemsMissed: number | null;
  percentageScore: number | null;
  letterGrade: string | null;
  isApiSynced: boolean;
  /** Who verified this item (full name or initials) and when (ISO timestamp) */
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  /** Optional external course / syllabus activity metadata when integrated into the unified Weekly Grading Summary table */
  isExternalItem?: boolean;
  providerName?: string | null;
  courseSubtitle?: string | null;
  weekNumber?: number | null;
  classNumber?: number | null;
  classTopic?: string | null;
  supplies?: string[];
  openDate?: string | null;
  isSubmitted?: boolean;
  externalStatusLabel?:
    | 'Graded'
    | 'Completed'
    | 'Submitted · Awaiting Grade'
    | 'Completed · Awaiting Grade'
    | 'Due This Week';
}

export function getDayKeyFromIsoDate(dateStr: string): DayKey {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'monday';
  const day = parsed.getDay(); // 0=Sun, 1=Mon...5=Fri
  if (day >= 1 && day <= 5) {
    return DAY_KEYS[day - 1];
  }
  return 'friday';
}

export function getWeekdayLabelFromIsoDate(dateStr: string): string {
  const dk = getDayKeyFromIsoDate(dateStr);
  return DAY_LABELS[dk] || 'Monday';
}

export function getIsoDateForWeekdayInWeek(
  weekMondayStr: string,
  dayKey: DayKey
): string {
  const idx = DAY_KEYS.indexOf(dayKey);
  const offset = idx >= 0 ? idx : 0;
  const d = new Date(`${weekMondayStr}T00:00:00`);
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getMondayForIsoDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + diff);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Computes a canonical weekly group key so blocks like "Memory Work: Unit 1 - Re-Test"
 * or "Novels" or any shared weekly item match across Monday–Friday of the same week.
 */
export function normalizeWeeklyBlockKey(rawText: string): string {
  const clean = stripWeeklySharedMarker(stripParentNoteMarker(rawText))
    .trim()
    .replace(/^###\s*/, '')
    .replace(/^-\s*\[[ xX]\]\s*/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/^[☐☑•*-]\s*/, '')
    .trim();
  if (/^memory\s+work\b/i.test(clean)) {
    return 'memory_work';
  }
  if (/^novels\b/i.test(clean)) {
    return 'novels';
  }
  return clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function formatRepeatDaysShortLabel(days: DayKey[]): string {
  const ordered = DAY_KEYS.filter((dk) => days.includes(dk));
  if (ordered.length === 0) return 'Weekly';
  const shortMap: Record<DayKey, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
  };
  if (
    ordered.length === 4 &&
    ordered[0] === 'monday' &&
    ordered[3] === 'thursday'
  ) {
    return 'Weekly (Mon–Thu)';
  }
  if (
    ordered.length === 5 &&
    ordered[0] === 'monday' &&
    ordered[4] === 'friday'
  ) {
    return 'Weekly (Mon–Fri)';
  }
  return `Weekly (${ordered.map((d) => shortMap[d]).join(', ')})`;
}

function parseDaysCsvToDayKeys(
  daysCsv: string | null,
  fallbackDays: DayKey[]
): DayKey[] {
  if (!daysCsv) return fallbackDays;
  const parts = daysCsv
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is DayKey => DAY_KEYS.includes(p as DayKey));
  return parts.length > 0 ? DAY_KEYS.filter((d) => parts.includes(d)) : fallbackDays;
}

/**
 * Heuristic helper that classifies a raw line of text into 'info', 'verified', or 'graded'
 * when auto-populating or converting plain text lines.
 */
export function inferWeeklyItemCategoryFromLine(rawLine: string): {
  category: WeeklyItemCategory;
  infoSubType: InfoSubType;
  checked: boolean;
  cleanText: string;
  isWeeklySharedMarker: boolean;
  weeklyDaysCsv: string | null;
} {
  const weeklyExtracted = extractWeeklySharedDaysFromLine(rawLine);
  const trimmed = weeklyExtracted.cleanText.trim();
  if (!trimmed) {
    return {
      category: 'info',
      infoSubType: 'bullet',
      checked: false,
      cleanText: '',
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  // 1. Horizontal Divider (--- or --- Section Label)
  if (/^---+(?:\s+(.*))?$/.test(trimmed)) {
    const m = trimmed.match(/^---+(?:\s+(.*))?$/);
    return {
      category: 'info',
      infoSubType: 'divider',
      checked: false,
      cleanText: m?.[1]?.trim() || 'Section Divider',
      isWeeklySharedMarker: false,
      weeklyDaysCsv: null,
    };
  }

  // 2. Explicit Section Header (### Header)
  if (trimmed.startsWith('### ')) {
    return {
      category: 'info',
      infoSubType: 'header',
      checked: false,
      cleanText: trimmed.replace(/^###\s*/, '').trim(),
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  // 3. Check if parent note marker
  if (trimmed.startsWith(PARENT_NOTE_MARKER)) {
    const clean = stripParentNoteMarker(trimmed)
      .replace(/^[-*•]\s*/, '')
      .trim();
    return {
      category: 'info',
      infoSubType: 'parent_note',
      checked: false,
      cleanText: clean,
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  // 4. Check if checkbox item -> Verified
  const isUnchecked =
    trimmed.startsWith('- [ ]') ||
    trimmed.startsWith('[ ]') ||
    trimmed.startsWith('☐');
  const isChecked =
    trimmed.startsWith('- [x]') ||
    trimmed.startsWith('- [X]') ||
    trimmed.startsWith('[x]') ||
    trimmed.startsWith('[X]') ||
    trimmed.startsWith('☑');

  if (isUnchecked || isChecked) {
    const clean = trimmed
      .replace(/^-\s*\[[ xX]\]\s*/, '')
      .replace(/^\[[ xX]\]\s*/, '')
      .replace(/^[☐☑]\s*/, '')
      .trim();

    return {
      category: 'verified',
      infoSubType: 'bullet',
      checked: isChecked,
      cleanText: clean,
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  // 5. Check if explicit bullet item -> Info (bullet)
  const isBullet =
    trimmed.startsWith('•') ||
    (trimmed.startsWith('-') && !trimmed.startsWith('- [')) ||
    trimmed.startsWith('*');

  if (isBullet) {
    const clean = trimmed.replace(/^[-*•]\s*/, '').trim();
    return {
      category: 'info',
      infoSubType: 'bullet',
      checked: false,
      cleanText: clean,
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  // 6. Unprefixed plain line matching section header patterns or ending with colon -> Header
  if (
    /^complete the following\s*:?$/i.test(trimmed) ||
    /^attend\s+class\b/i.test(trimmed) ||
    /^(fable|grammar|novels|class\s+\d+)\s*:$/i.test(trimmed) ||
    (trimmed.endsWith(':') && trimmed.length <= 48)
  ) {
    return {
      category: 'info',
      infoSubType: 'header',
      checked: false,
      cleanText: trimmed,
      isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
      weeklyDaysCsv: weeklyExtracted.daysCsv,
    };
  }

  return {
    category: 'info',
    infoSubType: 'bullet',
    checked: false,
    cleanText: trimmed,
    isWeeklySharedMarker: weeklyExtracted.isWeeklyShared,
    weeklyDaysCsv: weeklyExtracted.daysCsv,
  };
}

/**
 * Normalizes an assessment/assignment title for deduplication across `school.assignments`
 * and `course_syllabus.weeks.linked_assessments` (strips `--DUE...`, `LC 4th Edition`, etc.).
 */
export function normalizeAssessmentTitleForDedup(rawTitle: string): string {
  return rawTitle
    .replace(/--DUE[\s\S]*$/i, '')
    .replace(/^LC 4th Edition\s+/i, '')
    .replace(/\.$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Extracts structured sub-items stored in a GradebookAssignment's instructions/description.
 */
export function extractAssignmentSubItems(a: GradebookAssignment): StructuredSubItem[] {
  const raw = a.instructions || '';
  if (!raw.trim()) return [];
  // Never treat API-synced Moodle weekly section summaries or multi-day syllabus overviews as sub-items of a single day's quiz/assignment
  if (
    isAssignmentApiSynced(a) ||
    /^week\s+\d+\b/im.test(raw) ||
    /^(?:[•*-]\s*)?day\s+[1-5]\s*:?$/im.test(raw)
  ) {
    return [];
  }
  const lines = raw.split('\n');
  const subItems: StructuredSubItem[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const isUnchecked =
      trimmed.startsWith('- [ ]') || trimmed.startsWith('[ ]') || trimmed.startsWith('☐');
    const isChecked =
      trimmed.startsWith('- [x]') ||
      trimmed.startsWith('- [X]') ||
      trimmed.startsWith('[x]') ||
      trimmed.startsWith('[X]') ||
      trimmed.startsWith('☑');
    const isBullet = trimmed.startsWith('•');

    if (isUnchecked || isChecked || isBullet) {
      const clean = trimmed
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•]\s*/, '')
        .trim();
      if (clean) {
        subItems.push({
          id: `assign-sub-${a.id}-${idx}`,
          text: clean,
          checked: isChecked,
          isBullet: isBullet && !isUnchecked && !isChecked,
          sourceLineIndex: idx,
        });
      }
    }
  });

  return subItems;
}

/**
 * Formats an item's subItems into markdown lines for `school.assignments.instructions`.
 */
export function formatSubItemsForAssignmentInstructions(
  subItems: StructuredSubItem[],
  fallbackInstructions?: string | null
): string | null {
  const validSubs = subItems.filter((s) => s.text.trim().length > 0);
  if (validSubs.length === 0) {
    return fallbackInstructions?.trim() || null;
  }
  return validSubs
    .map((s) => {
      const clean = s.text
        .trim()
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•*-]\s*/, '')
        .trim();
      if (s.isBullet) {
        return `• ${clean}`;
      }
      return `${s.checked ? '- [x]' : '- [ ]'} ${clean}`;
    })
    .join('\n');
}

/**
 * Scans all `parent_notes` for a subject across the week to detect which block keys
 * (e.g. `memory_work`, `novels`, or any repeated block) appear on 2+ days of the week.
 */
export function detectRepeatedBlockDaysAcrossWeek(
  weekNotesForSubject: PlannerParentNoteRecord[]
): Map<string, DayKey[]> {
  const daysByKey = new Map<string, Set<DayKey>>();

  const recordKeyOnDay = (key: string, dk: DayKey) => {
    if (!key) return;
    let set = daysByKey.get(key);
    if (!set) {
      set = new Set<DayKey>();
      daysByKey.set(key, set);
    }
    set.add(dk);
  };

  for (const note of weekNotesForSubject) {
    const dk = getDayKeyFromIsoDate(note.note_date);
    const rawLines = note.description ? note.description.split('\n') : [];
    for (const rawLine of rawLines) {
      if (/^\s{2,}/.test(rawLine)) continue;
      const dailyInfo = extractDailyMarkerFromLine(rawLine);
      if (dailyInfo.isDaily) {
        // Explicitly marked as daily verification: never treat as weekly shared
        continue;
      }
      const weeklyInfo = extractWeeklySharedDaysFromLine(rawLine);
      const trimmed = weeklyInfo.cleanText.trim();
      if (!trimmed) continue;

      const stripped = trimmed
        .replace(/^###\s*/, '')
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•*-]\s*/, '')
        .trim();

      if (weeklyInfo.isWeeklyShared) {
        const key = normalizeWeeklyBlockKey(stripped);
        const explicitDays = parseDaysCsvToDayKeys(weeklyInfo.daysCsv, [dk]);
        for (const ed of explicitDays) {
          recordKeyOnDay(key, ed);
        }
      } else if (/^memory\s+work\s*:?$/i.test(stripped)) {
        recordKeyOnDay('memory_work', dk);
      } else if (/^novels\b/i.test(stripped)) {
        recordKeyOnDay('novels', dk);
      }
    }
  }

  const result = new Map<string, DayKey[]>();
  for (const [key, daySet] of daysByKey.entries()) {
    if (daySet.size >= 2 || key === 'memory_work' || key === 'novels') {
      const ordered = DAY_KEYS.filter((d) => daySet.has(d));
      if (ordered.length > 0) {
        result.set(key, ordered);
      }
    }
  }
  return result;
}

/**
 * Parses a cell's `parent_notes` and `school.assignments` into an ordered list of
 * `StructuredCellLineItem` blocks with support for:
 * - Headers & Dividers ("Complete the following:", "Fable:", "Grammar:", "---")
 * - Multi-line grouped items (e.g. "Memory Work" + all its memory work sub-items evaluated as 1 item)
 * - Weekly-shared blocks (`repeatAcrossWeek`) that appear on multiple days of the week on the binder
 *   but are evaluated/graded only ONCE for the week and auto-sync across days when edited.
 */
export function parseCellNotesAndAssignmentsToItems(params: {
  subjectId: string;
  dateStr: string;
  notes: PlannerParentNoteRecord[];
  assignments: GradebookAssignment[];
  subject?: SubjectWithGrading;
  allWeekNotesForSubject?: PlannerParentNoteRecord[];
  allWeekAssignmentsForSubject?: GradebookAssignment[];
}): StructuredCellLineItem[] {
  const {
    subjectId,
    dateStr,
    notes,
    assignments,
    subject,
    allWeekNotesForSubject,
    allWeekAssignmentsForSubject,
  } = params;
  const dayKey = getDayKeyFromIsoDate(dateStr);
  const weekdayLabel = DAY_LABELS[dayKey];
  const items: StructuredCellLineItem[] = [];

  const repeatedBlocksMap = detectRepeatedBlockDaysAcrossWeek(
    allWeekNotesForSubject && allWeekNotesForSubject.length > 0
      ? allWeekNotesForSubject
      : notes
  );

  // Default repeat days for this subject in this week (e.g. Mon-Thu if subject has notes on Mon-Thu)
  const subjectActiveDaysInWeek = (() => {
    const daySet = new Set<DayKey>();
    for (const n of allWeekNotesForSubject || notes) {
      daySet.add(getDayKeyFromIsoDate(n.note_date));
    }
    const ordered = DAY_KEYS.filter((d) => daySet.has(d));
    return ordered.length >= 2 ? ordered : (['monday', 'tuesday', 'wednesday', 'thursday'] as DayKey[]);
  })();

  const activeCellAssignments = assignments.filter(
    (a) => a.workflow_status !== 'staged' && a.workflow_status !== 'ignored'
  );
  const activeWeekAssignments = (allWeekAssignmentsForSubject || activeCellAssignments).filter(
    (a) => a.workflow_status !== 'staged' && a.workflow_status !== 'ignored'
  );
  const activeAssignmentTitles = Array.from(
    new Set([
      ...activeCellAssignments.map((a) => a.title),
      ...activeWeekAssignments
        .filter((a) => a.due_date === dateStr)
        .map((a) => a.title),
    ])
  );

  // Track which assignment IDs have been linked directly to a weekly-shared note block
  const linkedWeeklyAssignmentIds = new Set<string>();

  // 1. Parse ParentNote records for this (subjectId, dateStr)
  for (const note of notes) {
    const isWholeParentNote =
      getPlannerNoteCategory(note.title, note.description) === 'parent_note';
    const cleanTitle = stripParentNoteMarker(note.title).trim();

    if (cleanTitle) {
      items.push({
        id: `note-title-${note.id}`,
        subjectId,
        dateStr,
        dayKey,
        weekdayLabel,
        category: 'info',
        text: cleanTitle,
        infoSubType: isWholeParentNote ? 'parent_note' : 'header',
        checked: false,
        subItems: [],
        repeatAcrossWeek: false,
        repeatDays: [dayKey],
        weeklyGroupKey: normalizeWeeklyBlockKey(cleanTitle),
        sourceNoteId: note.id,
        sourceLineIndex: -1,
        sourceGroupLineIndices: [-1],
        assignmentCategory: 'homework',
        scoringMode: 'points',
        pointsEarned: null,
        pointsPossible: 100,
        totalProblems: null,
        problemsMissed: null,
        percentageScore: null,
        letterGrade: null,
        isApiSynced: false,
      });
    }

    const rawLines = note.description ? note.description.split('\n') : [];
    let i = 0;
    while (i < rawLines.length) {
      const rawLine = rawLines[i];
      const isIndented = /^\s{2,}/.test(rawLine);
      const verifiedMeta = extractVerifiedMetaFromLine(rawLine);
      const weeklyExtracted = extractWeeklySharedDaysFromLine(verifiedMeta.cleanText);
      const trimmed = weeklyExtracted.cleanText.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Case A: Explicit 2-space indented sub-line -> attach to the previous block in this note
      if (isIndented && items.length > 0 && items[items.length - 1].sourceNoteId === note.id) {
        const parentItem = items[items.length - 1];
        const subInferred = inferWeeklyItemCategoryFromLine(trimmed);
        if (subInferred.cleanText) {
          const isCheckboxLine =
            trimmed.startsWith('- [ ]') ||
            trimmed.startsWith('- [x]') ||
            trimmed.startsWith('- [X]') ||
            trimmed.startsWith('[ ]') ||
            trimmed.startsWith('[x]') ||
            trimmed.startsWith('[X]') ||
            trimmed.startsWith('☐') ||
            trimmed.startsWith('☑');
          parentItem.subItems.push({
            id: `note-sub-${note.id}-${i}`,
            text: subInferred.cleanText,
            checked: subInferred.checked,
            isBullet: !isCheckboxLine,
            sourceLineIndex: i,
          });
          parentItem.sourceGroupLineIndices = [
            ...(parentItem.sourceGroupLineIndices || [
              parentItem.sourceLineIndex ?? 0,
            ]),
            i,
          ];
          if (verifiedMeta.verifiedBy && !parentItem.verifiedBy) {
            parentItem.verifiedBy = verifiedMeta.verifiedBy;
          }
          if (verifiedMeta.verifiedAt && !parentItem.verifiedAt) {
            parentItem.verifiedAt = verifiedMeta.verifiedAt;
          }
          const checkSubs = parentItem.subItems.filter((s) => !s.isBullet);
          if (checkSubs.length > 0) {
            parentItem.checked = checkSubs.every((s) => s.checked);
            if (parentItem.checked) {
              if (!parentItem.verifiedBy) {
                parentItem.verifiedBy = note.updated_by || note.created_by || null;
              }
              if (!parentItem.verifiedAt) {
                parentItem.verifiedAt = note.updated_at || note.created_at || null;
              }
            }
          }
        }
        i++;
        continue;
      }

      // Case B: "Memory Work:" or "Memory Work" section -> group all following memory work lines into ONE single evaluable block!
      const strippedForMemory = trimmed
        .replace(/^###\s*/, '')
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•*-]\s*/, '')
        .trim();

      if (/^memory\s+work\b/i.test(strippedForMemory)) {
        const memHeaderIsSectionHdr = trimmed.startsWith('### ');
        const memHeaderIsBullet =
          trimmed.startsWith('•') ||
          (trimmed.startsWith('-') && !trimmed.startsWith('- [')) ||
          trimmed.startsWith('*');
        const memHeaderIsChecked =
          trimmed.startsWith('- [x]') ||
          trimmed.startsWith('- [X]') ||
          trimmed.startsWith('[x]') ||
          trimmed.startsWith('[X]') ||
          trimmed.startsWith('☑');
        let groupTitle = strippedForMemory.replace(/:$/, '').trim() || 'Memory Work';
        const groupSubItems: StructuredSubItem[] = [];
        const groupIndices: number[] = [i];
        let groupVerifiedBy: string | null = verifiedMeta.verifiedBy;
        let groupVerifiedAt: string | null = verifiedMeta.verifiedAt;
        let anyMemSubIsCheckbox = false;
        const hasExplicitIndentedSubs =
          i + 1 < rawLines.length && /^\s{2,}/.test(rawLines[i + 1]);
        let j = i + 1;

        while (j < rawLines.length) {
          const nextRaw = rawLines[j];
          const isNextIndented = /^\s{2,}/.test(nextRaw);
          if (hasExplicitIndentedSubs && !isNextIndented) {
            break;
          }
          const nextVer = extractVerifiedMetaFromLine(nextRaw);
          if (nextVer.verifiedBy && !groupVerifiedBy) groupVerifiedBy = nextVer.verifiedBy;
          if (nextVer.verifiedAt && !groupVerifiedAt) groupVerifiedAt = nextVer.verifiedAt;
          const nextTrimmed = stripWeeklySharedMarker(nextVer.cleanText).trim();
          if (!nextTrimmed) {
            j++;
            continue;
          }
          const nextStripped = nextTrimmed
            .replace(/^###\s*/, '')
            .replace(/^[•*-]\s*/, '')
            .trim();
          if (
            !isNextIndented &&
            (/^---/.test(nextTrimmed) ||
              nextTrimmed.startsWith('### ') ||
              /^(complete the following|fable|grammar|novels|attend class)\s*:?$/i.test(
                nextStripped
              ))
          ) {
            break;
          }

          const nextIsCheckbox =
            nextTrimmed.startsWith('- [ ]') ||
            nextTrimmed.startsWith('- [x]') ||
            nextTrimmed.startsWith('- [X]') ||
            nextTrimmed.startsWith('[ ]') ||
            nextTrimmed.startsWith('[x]') ||
            nextTrimmed.startsWith('[X]') ||
            nextTrimmed.startsWith('☐') ||
            nextTrimmed.startsWith('☑');
          if (nextIsCheckbox) {
            anyMemSubIsCheckbox = true;
          }
          const nextIsBullet =
            nextTrimmed.startsWith('•') ||
            (nextTrimmed.startsWith('-') && !nextTrimmed.startsWith('- [')) ||
            nextTrimmed.startsWith('*');

          if (
            groupSubItems.length === 0 &&
            !isNextIndented &&
            !nextIsCheckbox &&
            !nextIsBullet &&
            /^memory\s+work$/i.test(groupTitle)
          ) {
            groupTitle = `Memory Work: ${nextTrimmed}`;
            groupIndices.push(j);
            j++;
            continue;
          }

          const nextInferred = inferWeeklyItemCategoryFromLine(nextTrimmed);
          if (nextInferred.cleanText) {
            groupSubItems.push({
              id: `note-sub-${note.id}-${j}`,
              text: nextInferred.cleanText,
              checked: nextInferred.checked,
              isBullet: !nextIsCheckbox,
              sourceLineIndex: j,
            });
            groupIndices.push(j);
          }
          j++;
        }

        const dailyExtracted = extractDailyMarkerFromLine(verifiedMeta.cleanText);
        const isExplicitDaily = dailyExtracted.isDaily;
        const detectedDays = repeatedBlocksMap.get('memory_work');
        const isRepeated =
          !isExplicitDaily &&
          (weeklyExtracted.isWeeklyShared ||
            (detectedDays !== undefined && detectedDays.length >= 2));
        const effectiveRepeatDays = weeklyExtracted.isWeeklyShared
          ? parseDaysCsvToDayKeys(weeklyExtracted.daysCsv, subjectActiveDaysInWeek)
          : dailyExtracted.isDaily && dailyExtracted.daysCsv
          ? parseDaysCsvToDayKeys(dailyExtracted.daysCsv, subjectActiveDaysInWeek)
          : detectedDays && detectedDays.length >= 2
          ? detectedDays
          : [dayKey];

        // Check if there is a weekly Graded Assignment for Memory Work in this subject/week
        const matchedWeeklyAssign = activeWeekAssignments.find(
          (a) => normalizeWeeklyBlockKey(a.title) === 'memory_work'
        );
        if (matchedWeeklyAssign) {
          linkedWeeklyAssignmentIds.add(matchedWeeklyAssign.id);
        }

        const memCategory: WeeklyItemCategory = matchedWeeklyAssign
          ? matchedWeeklyAssign.is_graded === false
            ? 'verified'
            : 'graded'
          : memHeaderIsSectionHdr || (memHeaderIsBullet && !anyMemSubIsCheckbox)
          ? 'info'
          : 'verified';

        const checkSubs = groupSubItems.filter((s) => !s.isBullet);
        const allChecked =
          checkSubs.length > 0 ? checkSubs.every((s) => s.checked) : memHeaderIsChecked;

        const memAssignStd =
          matchedWeeklyAssign?.state_standards &&
          typeof matchedWeeklyAssign.state_standards === 'object' &&
          !Array.isArray(matchedWeeklyAssign.state_standards)
            ? (matchedWeeklyAssign.state_standards as Record<string, unknown>)
            : null;
        const memAssignVerBy =
          typeof memAssignStd?.verified_by === 'string' && memAssignStd.verified_by.trim()
            ? memAssignStd.verified_by.trim()
            : null;
        const memAssignVerAt =
          typeof memAssignStd?.verified_at === 'string' && memAssignStd.verified_at.trim()
            ? memAssignStd.verified_at.trim()
            : null;

        const storedMemVerifiedBy =
          groupVerifiedBy ||
          memAssignVerBy ||
          (allChecked ? note.updated_by || note.created_by || null : null);
        const storedMemVerifiedAt =
          groupVerifiedAt ||
          memAssignVerAt ||
          (allChecked
            ? matchedWeeklyAssign?.completed_at ||
              note.updated_at ||
              note.created_at ||
              null
            : null);

        const isMemChecked =
          memCategory === 'info'
            ? false
            : memCategory === 'verified'
            ? allChecked ||
              Boolean(storedMemVerifiedBy || storedMemVerifiedAt) ||
              (matchedWeeklyAssign
                ? isAssignmentCompletedOrSubmitted(matchedWeeklyAssign)
                : false)
            : matchedWeeklyAssign
            ? isAssignmentScored(matchedWeeklyAssign)
            : allChecked;

        items.push({
          id: matchedWeeklyAssign
            ? `assign-${matchedWeeklyAssign.id}-${dayKey}`
            : `note-line-${note.id}-${i}`,
          subjectId,
          dateStr,
          dayKey,
          weekdayLabel,
          category: memCategory,
          text: groupTitle,
          infoSubType:
            memCategory === 'info' && memHeaderIsSectionHdr ? 'header' : 'bullet',
          checked: isMemChecked,
          verifiedBy: storedMemVerifiedBy,
          verifiedAt: storedMemVerifiedAt,
          subItems: groupSubItems,
          repeatAcrossWeek: isRepeated || Boolean(matchedWeeklyAssign),
          repeatCadence: isExplicitDaily ? 'daily' : isRepeated ? 'weekly_shared' : 'daily',
          repeatDays: effectiveRepeatDays,
          weeklyGroupKey: 'memory_work',
          sourceNoteId: note.id,
          sourceLineIndex: i,
          sourceGroupLineIndices: groupIndices,
          assignmentId: matchedWeeklyAssign?.id,
          assignmentRecord: matchedWeeklyAssign,
          assignmentCategory: matchedWeeklyAssign?.category || 'homework',
          scoringMode: matchedWeeklyAssign?.grading_mode || 'points',
          pointsEarned: matchedWeeklyAssign?.points_earned ?? null,
          pointsPossible: matchedWeeklyAssign?.points_possible ?? 100,
          totalProblems: matchedWeeklyAssign?.total_problems ?? 20,
          problemsMissed: matchedWeeklyAssign?.missed_problems ?? null,
          percentageScore: matchedWeeklyAssign?.percentage_score ?? null,
          letterGrade: matchedWeeklyAssign?.letter_grade ?? null,
          isApiSynced: false,
        });

        i = j;
        continue;
      }

      // Case C: "Novels: ..." multi-line reading list -> group subsequent novel lines under this block (preserving Info / Verified / Graded status)
      if (/^novels\b/i.test(strippedForMemory)) {
        const headerIsUnchecked =
          trimmed.startsWith('- [ ]') ||
          trimmed.startsWith('[ ]') ||
          trimmed.startsWith('☐');
        const headerIsChecked =
          trimmed.startsWith('- [x]') ||
          trimmed.startsWith('- [X]') ||
          trimmed.startsWith('[x]') ||
          trimmed.startsWith('[X]') ||
          trimmed.startsWith('☑');
        const headerIsCheckbox = headerIsUnchecked || headerIsChecked;
        const headerIsSectionHdr = trimmed.startsWith('### ');

        const groupSubItems: StructuredSubItem[] = [];
        const groupIndices: number[] = [i];
        let groupVerifiedBy: string | null = verifiedMeta.verifiedBy;
        let groupVerifiedAt: string | null = verifiedMeta.verifiedAt;
        let anySubIsCheckbox = false;

        const firstNovelAfterColon = strippedForMemory
          .replace(/^novels\s*:?\s*/i, '')
          .trim();
        if (firstNovelAfterColon) {
          groupSubItems.push({
            id: `note-sub-${note.id}-${i}-0`,
            text: firstNovelAfterColon,
            checked: headerIsChecked,
            isBullet: !headerIsCheckbox,
            sourceLineIndex: i,
          });
        }

        const hasExplicitIndentedNovelSubs =
          i + 1 < rawLines.length && /^\s{2,}/.test(rawLines[i + 1]);
        let j = i + 1;
        while (j < rawLines.length) {
          const nextRaw = rawLines[j];
          const isIndentedSub = /^\s{2,}/.test(nextRaw);
          if (hasExplicitIndentedNovelSubs && !isIndentedSub) {
            break;
          }
          const nextVer = extractVerifiedMetaFromLine(nextRaw);
          if (nextVer.verifiedBy && !groupVerifiedBy) groupVerifiedBy = nextVer.verifiedBy;
          if (nextVer.verifiedAt && !groupVerifiedAt) groupVerifiedAt = nextVer.verifiedAt;
          const nextTrimmed = stripWeeklySharedMarker(nextVer.cleanText).trim();
          if (!nextTrimmed) {
            j++;
            continue;
          }
          if (!isIndentedSub) {
            const isSpecial =
              nextTrimmed.startsWith('- [') ||
              nextTrimmed.startsWith('[') ||
              nextTrimmed.startsWith('☐') ||
              nextTrimmed.startsWith('☑') ||
              nextTrimmed.startsWith('•') ||
              nextTrimmed.startsWith('### ') ||
              nextTrimmed.startsWith('---') ||
              /^(memory work|complete the following|fable|grammar|attend class)\b/i.test(
                nextTrimmed
              );
            if (isSpecial) break;
          }

          const nextIsCheckbox =
            nextTrimmed.startsWith('- [ ]') ||
            nextTrimmed.startsWith('- [x]') ||
            nextTrimmed.startsWith('- [X]') ||
            nextTrimmed.startsWith('[ ]') ||
            nextTrimmed.startsWith('[x]') ||
            nextTrimmed.startsWith('[X]') ||
            nextTrimmed.startsWith('☐') ||
            nextTrimmed.startsWith('☑');
          if (nextIsCheckbox) {
            anySubIsCheckbox = true;
          }
          const nextInferred = inferWeeklyItemCategoryFromLine(nextTrimmed);

          groupSubItems.push({
            id: `note-sub-${note.id}-${j}`,
            text: nextInferred.cleanText || nextTrimmed.replace(/^[-*•]\s*/, '').trim(),
            checked: nextInferred.checked,
            isBullet: !nextIsCheckbox && !headerIsCheckbox,
            sourceLineIndex: j,
          });
          groupIndices.push(j);
          j++;
        }

        const dailyExtracted = extractDailyMarkerFromLine(verifiedMeta.cleanText);
        const isExplicitDaily = dailyExtracted.isDaily;
        const detectedDays = repeatedBlocksMap.get('novels');
        const isRepeated =
          !isExplicitDaily &&
          (weeklyExtracted.isWeeklyShared ||
            (detectedDays !== undefined && detectedDays.length >= 2));
        const effectiveRepeatDays = weeklyExtracted.isWeeklyShared
          ? parseDaysCsvToDayKeys(weeklyExtracted.daysCsv, subjectActiveDaysInWeek)
          : dailyExtracted.isDaily && dailyExtracted.daysCsv
          ? parseDaysCsvToDayKeys(dailyExtracted.daysCsv, subjectActiveDaysInWeek)
          : detectedDays && detectedDays.length >= 2
          ? detectedDays
          : [dayKey];

        const matchedWeeklyAssign = activeWeekAssignments.find(
          (a) => normalizeWeeklyBlockKey(a.title) === 'novels'
        );
        if (matchedWeeklyAssign) {
          linkedWeeklyAssignmentIds.add(matchedWeeklyAssign.id);
        }

        const novelsCategory: WeeklyItemCategory = matchedWeeklyAssign
          ? matchedWeeklyAssign.is_graded === false
            ? 'verified'
            : 'graded'
          : headerIsCheckbox || anySubIsCheckbox
          ? 'verified'
          : 'info';

        const checkSubs = groupSubItems.filter((s) => !s.isBullet);
        const allSubChecked =
          checkSubs.length > 0 ? checkSubs.every((s) => s.checked) : headerIsChecked;

        const novelsAssignStd =
          matchedWeeklyAssign?.state_standards &&
          typeof matchedWeeklyAssign.state_standards === 'object' &&
          !Array.isArray(matchedWeeklyAssign.state_standards)
            ? (matchedWeeklyAssign.state_standards as Record<string, unknown>)
            : null;
        const novelsAssignVerBy =
          typeof novelsAssignStd?.verified_by === 'string' && novelsAssignStd.verified_by.trim()
            ? novelsAssignStd.verified_by.trim()
            : null;
        const novelsAssignVerAt =
          typeof novelsAssignStd?.verified_at === 'string' && novelsAssignStd.verified_at.trim()
            ? novelsAssignStd.verified_at.trim()
            : null;

        const storedNovelsVerifiedBy =
          groupVerifiedBy ||
          novelsAssignVerBy ||
          (headerIsChecked || allSubChecked
            ? note.updated_by || note.created_by || null
            : null);
        const storedNovelsVerifiedAt =
          groupVerifiedAt ||
          novelsAssignVerAt ||
          (headerIsChecked || allSubChecked
            ? matchedWeeklyAssign?.completed_at ||
              note.updated_at ||
              note.created_at ||
              null
            : null);

        const isNovelsChecked =
          novelsCategory === 'info'
            ? false
            : novelsCategory === 'verified'
            ? headerIsChecked ||
              allSubChecked ||
              Boolean(storedNovelsVerifiedBy || storedNovelsVerifiedAt) ||
              (matchedWeeklyAssign
                ? isAssignmentCompletedOrSubmitted(matchedWeeklyAssign)
                : false)
            : matchedWeeklyAssign
            ? isAssignmentScored(matchedWeeklyAssign)
            : headerIsChecked || allSubChecked;

        items.push({
          id: matchedWeeklyAssign
            ? `assign-${matchedWeeklyAssign.id}-${dayKey}`
            : `note-line-${note.id}-${i}`,
          subjectId,
          dateStr,
          dayKey,
          weekdayLabel,
          category: novelsCategory,
          text: groupSubItems.length > 0 ? 'Novels' : strippedForMemory,
          infoSubType:
            novelsCategory === 'info' && headerIsSectionHdr ? 'header' : 'bullet',
          checked: isNovelsChecked,
          verifiedBy: storedNovelsVerifiedBy,
          verifiedAt: storedNovelsVerifiedAt,
          subItems: groupSubItems,
          repeatAcrossWeek: isRepeated || Boolean(matchedWeeklyAssign),
          repeatCadence: isExplicitDaily ? 'daily' : isRepeated ? 'weekly_shared' : 'daily',
          repeatDays: effectiveRepeatDays,
          weeklyGroupKey: 'novels',
          sourceNoteId: note.id,
          sourceLineIndex: i,
          sourceGroupLineIndices: groupIndices,
          assignmentId: matchedWeeklyAssign?.id,
          assignmentRecord: matchedWeeklyAssign,
          assignmentCategory: matchedWeeklyAssign?.category || 'reading',
          scoringMode: matchedWeeklyAssign?.grading_mode || 'points',
          pointsEarned: matchedWeeklyAssign?.points_earned ?? null,
          pointsPossible: matchedWeeklyAssign?.points_possible ?? 100,
          totalProblems: matchedWeeklyAssign?.total_problems ?? null,
          problemsMissed: matchedWeeklyAssign?.missed_problems ?? null,
          percentageScore: matchedWeeklyAssign?.percentage_score ?? null,
          letterGrade: matchedWeeklyAssign?.letter_grade ?? null,
          isApiSynced: false,
        });

        i = j;
        continue;
      }

      // Skip non-weekly note lines that are already promoted to / covered by an active assignment in this cell
      if (
        !weeklyExtracted.isWeeklyShared &&
        isNoteLineCoveredByAssignment(trimmed, activeAssignmentTitles)
      ) {
        i++;
        continue;
      }

      // Standard single line (or header/divider, or custom [WEEKLY] block)
      const inferred = inferWeeklyItemCategoryFromLine(rawLine);
      if (!inferred.cleanText) {
        i++;
        continue;
      }

      const effectiveSubType: InfoSubType =
        isWholeParentNote && inferred.category === 'info'
          ? 'parent_note'
          : inferred.infoSubType;

      const dailyExtracted = extractDailyMarkerFromLine(rawLine);
      const isExplicitDaily = dailyExtracted.isDaily;
      const blockKey = normalizeWeeklyBlockKey(inferred.cleanText);
      const detectedDays = repeatedBlocksMap.get(blockKey);
      const isRepeated =
        !isExplicitDaily &&
        (inferred.isWeeklySharedMarker ||
          (inferred.infoSubType !== 'header' &&
            inferred.infoSubType !== 'divider' &&
            detectedDays !== undefined &&
            detectedDays.length >= 2));
      const effectiveRepeatDays = inferred.isWeeklySharedMarker
        ? parseDaysCsvToDayKeys(inferred.weeklyDaysCsv, subjectActiveDaysInWeek)
        : dailyExtracted.isDaily && dailyExtracted.daysCsv
        ? parseDaysCsvToDayKeys(dailyExtracted.daysCsv, subjectActiveDaysInWeek)
        : detectedDays && detectedDays.length >= 2
        ? detectedDays
        : [dayKey];

      const matchedWeeklyAssign = isRepeated
        ? activeWeekAssignments.find(
            (a) => normalizeWeeklyBlockKey(a.title) === blockKey
          )
        : undefined;
      if (matchedWeeklyAssign) {
        linkedWeeklyAssignmentIds.add(matchedWeeklyAssign.id);
      }

      const lineAssignStd =
        matchedWeeklyAssign?.state_standards &&
        typeof matchedWeeklyAssign.state_standards === 'object' &&
        !Array.isArray(matchedWeeklyAssign.state_standards)
          ? (matchedWeeklyAssign.state_standards as Record<string, unknown>)
          : null;
      const lineAssignVerBy =
        typeof lineAssignStd?.verified_by === 'string' && lineAssignStd.verified_by.trim()
          ? lineAssignStd.verified_by.trim()
          : null;
      const lineAssignVerAt =
        typeof lineAssignStd?.verified_at === 'string' && lineAssignStd.verified_at.trim()
          ? lineAssignStd.verified_at.trim()
          : null;

      const effectiveLineCategory: WeeklyItemCategory = matchedWeeklyAssign
        ? matchedWeeklyAssign.is_graded === false
          ? 'verified'
          : 'graded'
        : inferred.category;

      const storedLineVerifiedBy =
        verifiedMeta.verifiedBy ||
        lineAssignVerBy ||
        (inferred.checked ? note.updated_by || note.created_by || null : null);
      const storedLineVerifiedAt =
        verifiedMeta.verifiedAt ||
        lineAssignVerAt ||
        (inferred.checked
          ? matchedWeeklyAssign?.completed_at ||
            note.updated_at ||
            note.created_at ||
            null
          : null);

      const isLineChecked =
        effectiveLineCategory === 'info'
          ? false
          : effectiveLineCategory === 'verified'
          ? inferred.checked ||
            Boolean(storedLineVerifiedBy || storedLineVerifiedAt) ||
            (matchedWeeklyAssign
              ? isAssignmentCompletedOrSubmitted(matchedWeeklyAssign)
              : false)
          : matchedWeeklyAssign
          ? isAssignmentScored(matchedWeeklyAssign)
          : inferred.checked;

      items.push({
        id: matchedWeeklyAssign
          ? `assign-${matchedWeeklyAssign.id}-${dayKey}`
          : `note-line-${note.id}-${i}`,
        subjectId,
        dateStr,
        dayKey,
        weekdayLabel,
        category: effectiveLineCategory,
        text: inferred.cleanText,
        infoSubType: effectiveSubType,
        checked: isLineChecked,
        verifiedBy: storedLineVerifiedBy,
        verifiedAt: storedLineVerifiedAt,
        subItems: [],
        repeatAcrossWeek: isRepeated,
        repeatCadence: isExplicitDaily ? 'daily' : isRepeated ? 'weekly_shared' : 'daily',
        repeatDays: effectiveRepeatDays,
        weeklyGroupKey: blockKey,
        sourceNoteId: note.id,
        sourceLineIndex: i,
        sourceGroupLineIndices: [i],
        assignmentId: matchedWeeklyAssign?.id,
        assignmentRecord: matchedWeeklyAssign,
        assignmentCategory: matchedWeeklyAssign?.category || 'homework',
        scoringMode: matchedWeeklyAssign?.grading_mode || 'points',
        pointsEarned: matchedWeeklyAssign?.points_earned ?? null,
        pointsPossible: matchedWeeklyAssign?.points_possible ?? 100,
        totalProblems: matchedWeeklyAssign?.total_problems ?? null,
        problemsMissed: matchedWeeklyAssign?.missed_problems ?? null,
        percentageScore: matchedWeeklyAssign?.percentage_score ?? null,
        letterGrade: matchedWeeklyAssign?.letter_grade ?? null,
        isApiSynced: false,
      });
      i++;
    }
  }

  // 2. Parse GradebookAssignment records for this (subjectId, dateStr) that weren't already linked to a weekly shared block
  for (const a of activeCellAssignments) {
    if (linkedWeeklyAssignmentIds.has(a.id)) continue;

    const apiSynced = isAssignmentApiSynced(a, subject);
    const isCompletionOnly =
      a.is_graded === false || a.grading_mode === 'completion';
    const done = isAssignmentCompletedOrSubmitted(a);
    const category: WeeklyItemCategory = isCompletionOnly ? 'verified' : 'graded';
    const subItems = extractAssignmentSubItems(a);
    const blockKey = normalizeWeeklyBlockKey(a.title);
    const detectedDays = repeatedBlocksMap.get(blockKey);
    const isWeeklySharedAssign =
      detectedDays !== undefined && detectedDays.length >= 2;

    const stdObj =
      a.state_standards &&
      typeof a.state_standards === 'object' &&
      !Array.isArray(a.state_standards)
        ? (a.state_standards as Record<string, unknown>)
        : null;
    const assignVerifiedBy =
      typeof stdObj?.verified_by === 'string' && stdObj.verified_by.trim()
        ? stdObj.verified_by.trim()
        : null;
    const assignVerifiedAt =
      (typeof stdObj?.verified_at === 'string' && stdObj.verified_at.trim()
        ? stdObj.verified_at.trim()
        : null) ||
      (isCompletionOnly && done ? a.completed_at : null) ||
      null;
    const hasStoredVerification = Boolean(assignVerifiedBy || assignVerifiedAt);
    const isAssignDone =
      category === 'verified'
        ? done || hasStoredVerification
        : isAssignmentScored(a);

    items.push({
      id: `assign-${a.id}`,
      subjectId,
      dateStr,
      dayKey,
      weekdayLabel,
      category,
      text: a.title,
      infoSubType: 'bullet',
      checked: isAssignDone,
      verifiedBy: assignVerifiedBy,
      verifiedAt: assignVerifiedAt,
      subItems,
      repeatAcrossWeek: isWeeklySharedAssign,
      repeatDays: isWeeklySharedAssign && detectedDays ? detectedDays : [dayKey],
      weeklyGroupKey: blockKey,
      assignmentId: a.id,
      assignmentRecord: a,
      assignmentCategory: a.category || 'homework',
      scoringMode: a.grading_mode || (isCompletionOnly ? 'completion' : 'points'),
      pointsEarned: a.points_earned,
      pointsPossible: a.points_possible ?? 100,
      totalProblems: a.total_problems,
      problemsMissed: a.missed_problems,
      percentageScore: a.percentage_score,
      letterGrade: a.letter_grade,
      isApiSynced: apiSynced,
    });
  }

  return items;
}

/**
 * Serializes the items of a cell back into normalized `{ title, description, category }` payloads for `school.parent_notes`.
 * Note: For `repeatAcrossWeek` blocks, even if `category === 'graded'`, we keep the block in `parent_notes`
 * on each selected day of the week so it remains visible on every day of the Weekly Binder while only creating
 * 1 assignment in `school.assignments`!
 */
export function serializeCellItemsToNotesPayload(
  items: StructuredCellLineItem[]
): Array<{
  title: string | null;
  description: string;
  category: 'school_work' | 'parent_note';
}> {
  const schoolWorkItems = items.filter(
    (it) =>
      (it.text.trim().length > 0 || it.infoSubType === 'divider') &&
      ((it.category !== 'graded' && !it.assignmentId) || it.repeatAcrossWeek) &&
      !(it.category === 'info' && it.infoSubType === 'parent_note')
  );

  const parentNoteItems = items.filter(
    (it) =>
      it.text.trim().length > 0 &&
      it.category === 'info' &&
      it.infoSubType === 'parent_note'
  );

  const payloads: Array<{
    title: string | null;
    description: string;
    category: 'school_work' | 'parent_note';
  }> = [];

  if (schoolWorkItems.length > 0) {
    let headerTitle: string | null = null;
    const bodyLines: string[] = [];

    schoolWorkItems.forEach((it, idx) => {
      const clean = stripWeeklySharedMarker(it.text).trim();

      if (it.category === 'info' && it.infoSubType === 'divider') {
        const divLabel =
          clean && clean.toLowerCase() !== 'section divider' && clean !== '---'
            ? ` ${clean.replace(/^---+\s*/, '')}`
            : '';
        bodyLines.push(`---${divLabel}`);
        return;
      }

      if (!clean) return;

      const isWeeklyShared =
        it.repeatAcrossWeek &&
        it.repeatCadence !== 'daily' &&
        it.repeatDays &&
        it.repeatDays.length > 0;
      const isExplicitDailyMultiDay =
        it.repeatCadence === 'daily' && it.repeatDays && it.repeatDays.length > 1;

      const schedulePrefix = isWeeklyShared
        ? `[WEEKLY:${DAY_KEYS.filter((d) => it.repeatDays.includes(d)).join(',')}] `
        : isExplicitDailyMultiDay
        ? `[DAILY:${DAY_KEYS.filter((d) => it.repeatDays.includes(d)).join(',')}] `
        : '';

      const storedVerifiedSuffix =
        it.verifiedBy || it.verifiedAt
          ? ` [VERIFIED:${it.verifiedBy || ''}|${it.verifiedAt || ''}]`
          : '';

      if (
        it.category === 'info' &&
        it.infoSubType === 'header' &&
        headerTitle === null &&
        idx === 0 &&
        it.subItems.length === 0 &&
        !it.repeatAcrossWeek &&
        /^attend\s+class\b/i.test(clean)
      ) {
        headerTitle = clean;
      } else if (it.category === 'info' && it.infoSubType === 'header') {
        const cleanHdr = stripVerifiedMetaMarker(clean).replace(/^###\s*/, '');
        bodyLines.push(`${schedulePrefix}### ${cleanHdr}${storedVerifiedSuffix}`);
      } else if (it.category === 'info') {
        const cleanBullet = stripVerifiedMetaMarker(clean).replace(/^[-*•]\s*/, '');
        bodyLines.push(`${schedulePrefix}• ${cleanBullet}${storedVerifiedSuffix}`);
      } else if (it.category === 'verified' || it.category === 'graded') {
        const cleanCheck = stripVerifiedMetaMarker(clean)
          .replace(/^-\s*\[[ xX]\]\s*/, '')
          .replace(/^\[[ xX]\]\s*/, '')
          .replace(/^[☐☑]\s*/, '')
          .trim();
        const verifiedSuffix =
          (it.checked || it.category === 'graded') && (it.verifiedBy || it.verifiedAt)
            ? storedVerifiedSuffix
            : '';
        bodyLines.push(
          `${schedulePrefix}${it.checked ? '- [x]' : '- [ ]'} ${cleanCheck}${verifiedSuffix}`
        );
      }

      // Serialize any grouped multi-line sub-items with 2-space indentation
      if (it.subItems && it.subItems.length > 0) {
        for (const sub of it.subItems) {
          const cleanSub = sub.text
            .trim()
            .replace(/^-\s*\[[ xX]\]\s*/, '')
            .replace(/^\[[ xX]\]\s*/, '')
            .replace(/^[☐☑•*-]\s*/, '')
            .trim();
          if (!cleanSub) continue;
          if (it.category === 'info' || sub.isBullet) {
            bodyLines.push(`  • ${cleanSub}`);
          } else {
            bodyLines.push(`  ${sub.checked ? '- [x]' : '- [ ]'} ${cleanSub}`);
          }
        }
      }
    });

    const encoded = encodePlannerNoteFields(
      headerTitle,
      bodyLines.join('\n'),
      'school_work'
    );
    if (encoded.title || encoded.description) {
      payloads.push({
        title: encoded.title,
        description: encoded.description,
        category: 'school_work',
      });
    }
  }

  if (parentNoteItems.length > 0) {
    const lines: string[] = [];
    for (const it of parentNoteItems) {
      const isWeeklyShared =
        it.repeatAcrossWeek &&
        it.repeatCadence !== 'daily' &&
        it.repeatDays &&
        it.repeatDays.length > 0;
      const isExplicitDailyMultiDay =
        it.repeatCadence === 'daily' && it.repeatDays && it.repeatDays.length > 1;
      const schedulePrefix = isWeeklyShared
        ? `[WEEKLY:${DAY_KEYS.filter((d) => it.repeatDays.includes(d)).join(',')}] `
        : isExplicitDailyMultiDay
        ? `[DAILY:${DAY_KEYS.filter((d) => it.repeatDays.includes(d)).join(',')}] `
        : '';
      lines.push(
        `${schedulePrefix}• ${stripWeeklySharedMarker(it.text).trim().replace(/^[-*•]\s*/, '')}`
      );
      if (it.subItems && it.subItems.length > 0) {
        for (const sub of it.subItems) {
          const cleanSub = sub.text.trim().replace(/^[-*•]\s*/, '');
          if (cleanSub) lines.push(`  • ${cleanSub}`);
        }
      }
    }
    const encoded = encodePlannerNoteFields(null, lines.join('\n'), 'parent_note');
    if (encoded.title || encoded.description) {
      payloads.push({
        title: encoded.title,
        description: encoded.description,
        category: 'parent_note',
      });
    }
  }

  return payloads;
}

/**
 * Consolidates weekly-shared items (`repeatAcrossWeek === true` or repeated `(subjectId, weeklyGroupKey)` across days)
 * into a SINGLE row per week for the Weekly Grading Summary so items like Biblioplan's "Memory Work"
 * only appear ONCE on the gradesheet while staying listed on every day of the Weekly Binder.
 */
export function consolidateSection1WeeklyItems(
  items: StructuredCellLineItem[]
): StructuredCellLineItem[] {
  const result: StructuredCellLineItem[] = [];
  const groupIndexByKey = new Map<string, number>();

  // Count how many times each (subjectId, weeklyGroupKey) appears across the week
  const countBySubjectAndKey = new Map<string, number>();
  for (const item of items) {
    const k = `${item.subjectId}::${item.weeklyGroupKey || normalizeWeeklyBlockKey(item.text)}`;
    countBySubjectAndKey.set(k, (countBySubjectAndKey.get(k) || 0) + 1);
  }

  for (const item of items) {
    const blockKey = item.weeklyGroupKey || normalizeWeeklyBlockKey(item.text);
    const compositeKey = `${item.subjectId}::${blockKey}`;
    const occurrences = countBySubjectAndKey.get(compositeKey) || 1;
    const isSharedWeekly = Boolean(item.repeatAcrossWeek && item.repeatCadence !== 'daily');

    if (!isSharedWeekly) {
      result.push(item);
      continue;
    }

    const existingIdx = groupIndexByKey.get(compositeKey);
    const sourceRef: WeeklySourceNoteRef | null =
      item.sourceNoteId && typeof item.sourceLineIndex === 'number'
        ? {
            noteId: item.sourceNoteId,
            dateStr: item.dateStr,
            dayKey: item.dayKey,
            lineIndices:
              item.sourceGroupLineIndices && item.sourceGroupLineIndices.length > 0
                ? item.sourceGroupLineIndices
                : [item.sourceLineIndex],
          }
        : null;

    if (existingIdx === undefined) {
      const mergedDays = Array.from(
        new Set<DayKey>([...(item.repeatDays || []), item.dayKey])
      );
      const consolidated: StructuredCellLineItem = {
        ...item,
        repeatAcrossWeek: true,
        repeatDays: DAY_KEYS.filter((d) => mergedDays.includes(d)),
        weekdayLabel: formatRepeatDaysShortLabel(mergedDays),
        weeklySourceNotes: sourceRef ? [sourceRef] : [],
      };
      groupIndexByKey.set(compositeKey, result.length);
      result.push(consolidated);
    } else {
      const existing = result[existingIdx];
      const mergedDays = DAY_KEYS.filter(
        (d) =>
          existing.repeatDays.includes(d) ||
          item.repeatDays.includes(d) ||
          d === item.dayKey
      );
      const nextSourceNotes = [...(existing.weeklySourceNotes || [])];
      if (
        sourceRef &&
        !nextSourceNotes.some(
          (r) => r.noteId === sourceRef.noteId && r.dateStr === sourceRef.dateStr
        )
      ) {
        nextSourceNotes.push(sourceRef);
      }

      // Merge subItems checked status (if checked on any day or all days)
      const mergedSubs = (existing.subItems || []).map((es, idx) => {
        const matchingOther = item.subItems?.[idx];
        if (!matchingOther) return es;
        return {
          ...es,
          checked: es.checked || matchingOther.checked,
        };
      });

      result[existingIdx] = {
        ...existing,
        category:
          existing.category === 'graded' || item.category === 'graded'
            ? 'graded'
            : existing.category,
        checked: existing.checked || item.checked,
        verifiedBy: existing.verifiedBy || item.verifiedBy,
        verifiedAt: existing.verifiedAt || item.verifiedAt,
        subItems: mergedSubs.length > 0 ? mergedSubs : item.subItems,
        repeatAcrossWeek: true,
        repeatDays: mergedDays,
        weekdayLabel: formatRepeatDaysShortLabel(mergedDays),
        weeklySourceNotes: nextSourceNotes,
        assignmentId: existing.assignmentId || item.assignmentId,
        assignmentRecord: existing.assignmentRecord || item.assignmentRecord,
        pointsEarned: existing.pointsEarned ?? item.pointsEarned,
        percentageScore: existing.percentageScore ?? item.percentageScore,
        letterGrade: existing.letterGrade ?? item.letterGrade,
      };
    }
  }

  return result;
}

const SYNTHETIC_WEEK_MONDAY = '2026-10-19';

/**
 * Parses a single day's recurring template string (plus optional week templates and
 * `RecurringAssignmentTemplate[]` rules for the subject) into `StructuredCellLineItem[]` blocks
 * using the exact same rules as the Daily Editor Modal (`UnifiedCellItemsEditor`).
 */
export function parseRecurringTemplateDayToItems(params: {
  subjectId: string;
  dayKey: DayKey;
  dayTemplate: string;
  allDaysTemplates?: Partial<Record<DayKey, string>>;
  recurringTemplates?: RecurringAssignmentTemplate[];
}): StructuredCellLineItem[] {
  const { subjectId, dayKey, dayTemplate, allDaysTemplates, recurringTemplates } = params;
  const dateStr = getIsoDateForWeekdayInWeek(SYNTHETIC_WEEK_MONDAY, dayKey);

  const currentNote: PlannerParentNoteRecord[] = dayTemplate.trim()
    ? [
        {
          id: `tpl-note-${dayKey}`,
          subject_id: subjectId,
          note_date: dateStr,
          title: null,
          description: dayTemplate,
        },
      ]
    : [];

  const allWeekNotes: PlannerParentNoteRecord[] = [];
  if (allDaysTemplates) {
    for (const dk of DAY_KEYS) {
      const text = dk === dayKey ? dayTemplate : allDaysTemplates[dk] || '';
      if (text.trim()) {
        allWeekNotes.push({
          id: `tpl-note-${dk}`,
          subject_id: subjectId,
          note_date: getIsoDateForWeekdayInWeek(SYNTHETIC_WEEK_MONDAY, dk),
          title: null,
          description: text,
        });
      }
    }
  } else if (currentNote.length > 0) {
    allWeekNotes.push(currentNote[0]);
  }

  const activeTemplates = (recurringTemplates || []).filter(
    (t) =>
      t.subject_id === subjectId &&
      t.is_active &&
      t.auto_behavior !== 'ignore' &&
      t.linked_weekly_source !== 'syllabus_row'
  );

  const toSyntheticAssignment = (
    tpl: RecurringAssignmentTemplate,
    targetDay: DayKey
  ): GradebookAssignment => ({
    id: `tpl-assign-${tpl.id}`,
    title: tpl.title_template,
    description: tpl.instructions_template || null,
    instructions: tpl.instructions_template || null,
    subject_id: subjectId,
    due_date: getIsoDateForWeekdayInWeek(SYNTHETIC_WEEK_MONDAY, targetDay),
    priority: 'medium',
    category: tpl.assignment_type_slug || 'homework',
    status: 'pending',
    workflow_status: 'not_started',
    is_graded: tpl.grading_mode !== 'completion',
    grading_mode: tpl.grading_mode || 'points',
    points_possible: tpl.points_possible ?? 100,
    points_earned: null,
    total_problems: tpl.total_problems_default ?? null,
    missed_problems: null,
    percentage_score: null,
    letter_grade: null,
    source_type: 'recurring_template',
    recurring_template_id: tpl.id,
  });

  const cellAssignments: GradebookAssignment[] = activeTemplates
    .filter((t) => t.days_of_week.includes(dayKey))
    .map((t) => toSyntheticAssignment(t, dayKey));

  const allWeekAssignments: GradebookAssignment[] = activeTemplates.map((t) =>
    toSyntheticAssignment(t, t.days_of_week[0] || dayKey)
  );

  return parseCellNotesAndAssignmentsToItems({
    subjectId,
    dateStr,
    notes: currentNote,
    assignments: cellAssignments,
    allWeekNotesForSubject: allWeekNotes,
    allWeekAssignmentsForSubject: allWeekAssignments,
  });
}

/**
 * Serializes `StructuredCellLineItem[]` blocks back into a recurring template text string
 * for `dayCfg.template` or `custom_override_text`.
 */
export function serializeItemsToRecurringTemplateText(
  items: StructuredCellLineItem[],
  options?: { includeSingleDayGradedInText?: boolean }
): string {
  const lines: string[] = [];

  for (const it of items) {
    const clean = stripWeeklySharedMarker(it.text).trim();

    if (it.category === 'info' && it.infoSubType === 'divider') {
      const divLabel =
        clean && clean.toLowerCase() !== 'section divider' && clean !== '---'
          ? ` ${clean.replace(/^---+\s*/, '')}`
          : '';
      lines.push(`---${divLabel}`);
      continue;
    }

    if (!clean) continue;

    // For non-weekly Graded blocks, keep in template text if it uses {class_num} (so class counter advances)
    // or if includeSingleDayGradedInText is requested. Weekly-shared Graded blocks always stay in template text
    // on each selected day so they display on the binder across the week.
    if (
      it.category === 'graded' &&
      !it.repeatAcrossWeek &&
      !clean.includes('{class_num}') &&
      !options?.includeSingleDayGradedInText
    ) {
      continue;
    }

    const weeklyPrefix =
      it.repeatAcrossWeek && it.repeatDays && it.repeatDays.length > 0
        ? `[WEEKLY:${DAY_KEYS.filter((d) => it.repeatDays.includes(d)).join(',')}] `
        : '';

    if (it.category === 'info' && it.infoSubType === 'header') {
      const cleanHdr = clean.replace(/^###\s*/, '');
      lines.push(`${weeklyPrefix}### ${cleanHdr}`);
    } else if (it.category === 'info' && it.infoSubType === 'parent_note') {
      lines.push(
        `${weeklyPrefix}${PARENT_NOTE_MARKER} ${clean.replace(/^[-*•]\s*/, '')}`
      );
    } else if (it.category === 'info') {
      lines.push(`${weeklyPrefix}• ${clean.replace(/^[-*•]\s*/, '')}`);
    } else {
      const cleanCheck = clean
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(/^[☐☑•*-]\s*/, '')
        .trim();
      lines.push(`${weeklyPrefix}- [ ] ${cleanCheck}`);
    }

    if (it.subItems && it.subItems.length > 0) {
      for (const sub of it.subItems) {
        const cleanSub = sub.text
          .trim()
          .replace(/^-\s*\[[ xX]\]\s*/, '')
          .replace(/^\[[ xX]\]\s*/, '')
          .replace(/^[☐☑•*-]\s*/, '')
          .trim();
        if (!cleanSub) continue;
        if (it.category === 'info' || sub.isBullet) {
          lines.push(`  • ${cleanSub}`);
        } else {
          lines.push(`  - [ ] ${cleanSub}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Given the updated `StructuredCellLineItem[]` on `editedDayKey` and the current `days` map
 * of a `SubjectRecurringConfig`, synchronizes any `repeatAcrossWeek` blocks across all
 * selected weekdays (`item.repeatDays`) and removes them from unselected weekdays.
 */
export function syncWeeklySharedBlocksAcrossTemplateDays(params: {
  subjectId: string;
  editedDayKey: DayKey;
  editedItems: StructuredCellLineItem[];
  currentDays: Record<
    DayKey,
    {
      enabled: boolean;
      attend_class: boolean;
      attend_class_label: string;
      fast_facts: boolean;
      fast_facts_label: string;
      template: string;
    }
  >;
  recurringTemplates?: RecurringAssignmentTemplate[];
}): Record<
  DayKey,
  {
    enabled: boolean;
    attend_class: boolean;
    attend_class_label: string;
    fast_facts: boolean;
    fast_facts_label: string;
    template: string;
  }
> {
  const { subjectId, editedDayKey, editedItems, currentDays, recurringTemplates } = params;
  const nextDays = { ...currentDays };

  // 1. Update editedDayKey's template directly
  nextDays[editedDayKey] = {
    ...nextDays[editedDayKey],
    template: serializeItemsToRecurringTemplateText(editedItems),
  };

  // 2. Collect all weekly-shared blocks from editedItems
  const sharedItems = editedItems.filter(
    (it) => it.repeatAcrossWeek && it.text.trim().length > 0
  );
  if (sharedItems.length === 0) {
    return nextDays;
  }

  const allDaysTemplatesSnapshot: Record<DayKey, string> = {
    monday: nextDays.monday.template,
    tuesday: nextDays.tuesday.template,
    wednesday: nextDays.wednesday.template,
    thursday: nextDays.thursday.template,
    friday: nextDays.friday.template,
  };

  for (const dk of DAY_KEYS) {
    if (dk === editedDayKey) continue;

    const otherDayItems = parseRecurringTemplateDayToItems({
      subjectId,
      dayKey: dk,
      dayTemplate: nextDays[dk].template,
      allDaysTemplates: allDaysTemplatesSnapshot,
      recurringTemplates,
    });

    let modified = false;
    let updatedOtherItems = [...otherDayItems];

    for (const shared of sharedItems) {
      const groupKey = shared.weeklyGroupKey || normalizeWeeklyBlockKey(shared.text);
      const shouldBeOnDay = shared.repeatDays.includes(dk);
      const existingIdx = updatedOtherItems.findIndex(
        (other) =>
          (other.weeklyGroupKey || normalizeWeeklyBlockKey(other.text)) === groupKey
      );

      if (shouldBeOnDay) {
        const syncedBlock: StructuredCellLineItem = {
          ...shared,
          id: existingIdx >= 0 ? updatedOtherItems[existingIdx].id : `${shared.id}-${dk}`,
          dayKey: dk,
          weekdayLabel: DAY_LABELS[dk],
        };
        if (existingIdx >= 0) {
          updatedOtherItems[existingIdx] = syncedBlock;
        } else {
          updatedOtherItems.push(syncedBlock);
        }
        modified = true;
      } else if (existingIdx >= 0) {
        updatedOtherItems = updatedOtherItems.filter((_, idx) => idx !== existingIdx);
        modified = true;
      }
    }

    if (modified) {
      nextDays[dk] = {
        ...nextDays[dk],
        enabled:
          nextDays[dk].enabled ||
          sharedItems.some((s) => s.repeatDays.includes(dk)),
        template: serializeItemsToRecurringTemplateText(updatedOtherItems),
      };
    }
  }

  return nextDays;
}
