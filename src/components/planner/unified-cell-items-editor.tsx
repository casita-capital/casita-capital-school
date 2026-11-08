'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowRightLeft,
  ArrowUpLeft,
  Award,
  Bookmark,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Edit2,
  GripVertical,
  Heading,
  HelpCircle,
  Layers,
  Minus,
  MoreVertical,
  Plus,
  Repeat,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Ungroup,
  Wand2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import {
  InsertSavedBlockOptions,
  SavedScheduleBlocksModal,
} from 'src/components/planner/saved-schedule-blocks-modal';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { getCachedActiveUserName } from 'src/utils/active-user';
import {
  AssignmentTypeConfig,
  computeAssignmentMetrics,
  GradebookAssignment,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  RecurringAssignmentTemplate,
  ScoringMode,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  parseRecurringConfig,
  SavedBlockRepeatMode,
  SavedScheduleBlock,
} from 'src/utils/recurring-planner';
import {
  formatRepeatDaysShortLabel,
  formatSubItemsForAssignmentInstructions,
  getDayKeyFromIsoDate,
  getIsoDateForWeekdayInWeek,
  getMondayForIsoDate,
  InfoSubType,
  normalizeWeeklyBlockKey,
  parseCellNotesAndAssignmentsToItems,
  parseRecurringTemplateDayToItems,
  PlannerParentNoteRecord,
  serializeCellItemsToNotesPayload,
  serializeItemsToRecurringTemplateText,
  StructuredCellLineItem,
  StructuredSubItem,
  WeeklyItemCategory,
} from 'src/utils/weekly-grading-items';

interface MinimalSubject {
  id: string;
  name: string;
  color: string;
  recurring_config?: Json | null;
  grading_config?: Json | null;
}

export interface UnifiedCellItemsEditorProps {
  subject: MinimalSubject;
  dateStr: string;
  notes: PlannerParentNoteRecord[];
  assignments: GradebookAssignment[];
  assignmentTypes: AssignmentTypeConfig[];
  branding: {
    notes: { color: string; icon: string };
    parentNotes: { color: string; icon: string };
  };
  onSaved: () => Promise<void> | void;
  onSilentRefresh?: () => Promise<void> | void;
  onOpenFullAssignmentModal: (a: GradebookAssignment) => void;
  onOpenNewAssignmentModal: () => void;
  onOpenTypesManager: () => void;
  saveTriggerRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSavingChange?: (saving: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideInlineSaveButton?: boolean;
}

type BlockRoleValue = 'header' | 'info' | 'verified' | 'graded';

const SHORT_DAY_PILLS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'F' },
];

function getBlockRoleValue(row: StructuredCellLineItem): BlockRoleValue {
  if (row.category === 'graded') return 'graded';
  if (row.category === 'verified') return 'verified';
  if (row.infoSubType === 'header' || row.infoSubType === 'divider') {
    return 'header';
  }
  return 'info';
}

function createEmptyItemRow(
  subjectId: string,
  dateStr: string,
  category: WeeklyItemCategory = 'verified',
  infoSubType: InfoSubType = 'bullet',
  initialSubItems: StructuredSubItem[] = []
): StructuredCellLineItem {
  const dayKey = getDayKeyFromIsoDate(dateStr);
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId,
    dateStr,
    dayKey,
    weekdayLabel: DAY_LABELS[dayKey],
    category,
    text: '',
    infoSubType,
    checked: false,
    subItems: initialSubItems,
    repeatAcrossWeek: false,
    repeatCadence: 'daily',
    repeatDays: [dayKey],
    weeklyGroupKey: '',
    assignmentCategory: 'homework',
    scoringMode: 'points',
    pointsEarned: null,
    pointsPossible: 100,
    totalProblems: 20,
    problemsMissed: null,
    percentageScore: null,
    letterGrade: null,
    isApiSynced: false,
  };
}

function createEmptySubItem(isBullet = false): StructuredSubItem {
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: '',
    checked: false,
    isBullet,
  };
}

function shiftIsoDateByDays(isoDateStr: string, deltaDays: number): string {
  const d = new Date(`${isoDateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDateStr;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRangeBadge(mondayIso: string): string {
  const mon = new Date(`${mondayIso}T00:00:00`);
  const fri = new Date(`${mondayIso}T00:00:00`);
  if (Number.isNaN(mon.getTime())) return mondayIso;
  fri.setDate(fri.getDate() + 4);
  const monFmt = mon.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const friFmt = fri.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${monFmt} – ${friFmt}`;
}

function formatFullDateDisplay(isoDateStr: string): string {
  const d = new Date(`${isoDateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function convertNumbersToTemplateTokens(rawText: string): string {
  return rawText
    .replace(/\b(Week\s+)\d+/gi, '$1{week}')
    .replace(/\b(Class\s+)\d+/gi, '$1{class_num}')
    .replace(/\b(Lesson\s+)\d+/gi, '$1{lesson}')
    .replace(/\b(Day\s+)\d+/gi, '$1{day}');
}

export function UnifiedCellItemsEditor({
  subject,
  dateStr,
  notes,
  assignments,
  assignmentTypes,
  branding,
  onSaved,
  onSilentRefresh,
  onOpenFullAssignmentModal,
  onOpenNewAssignmentModal,
  onOpenTypesManager,
  saveTriggerRef,
  onSavingChange,
  onDirtyChange,
  hideInlineSaveButton = false,
}: UnifiedCellItemsEditorProps) {
  const theme = useTheme();
  const supabase = createClient();

  const [rows, setRows] = useState<StructuredCellLineItem[]>([]);
  const [initialWeeklyKeys, setInitialWeeklyKeys] = useState<string[]>([]);
  const [removedAssignmentIds, setRemovedAssignmentIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragEnabledRowId, setDragEnabledRowId] = useState<string | null>(null);
  const [pendingUnverifyRow, setPendingUnverifyRow] = useState<StructuredCellLineItem | null>(
    null
  );
  const [formattingGuideOpen, setFormattingGuideOpen] = useState(false);
  const [blockMenuAnchorEl, setBlockMenuAnchorEl] = useState<HTMLElement | null>(
    null
  );
  const [blockMenuRow, setBlockMenuRow] = useState<StructuredCellLineItem | null>(
    null
  );
  const [moveDialogRow, setMoveDialogRow] = useState<StructuredCellLineItem | null>(
    null
  );
  const [moveMode, setMoveMode] = useState<'same_week' | 'other_week'>('same_week');
  const [moveTargetMondayStr, setMoveTargetMondayStr] = useState<string>('');
  const [moveTargetDayKey, setMoveTargetDayKey] = useState<DayKey>('monday');
  const [movingBlockBusy, setMovingBlockBusy] = useState(false);

  const [autoRuleDialogRow, setAutoRuleDialogRow] =
    useState<StructuredCellLineItem | null>(null);
  const [autoRuleText, setAutoRuleText] = useState<string>('');
  const [autoRuleRole, setAutoRuleRole] = useState<BlockRoleValue>('verified');
  const [autoRuleHeaderSubType, setAutoRuleHeaderSubType] = useState<
    'header' | 'divider'
  >('header');
  const [autoRuleDays, setAutoRuleDays] = useState<DayKey[]>(['monday']);
  const [autoRuleCadence, setAutoRuleCadence] = useState<'daily' | 'weekly_once'>(
    'daily'
  );
  const [autoRuleAssignCategory, setAutoRuleAssignCategory] =
    useState<string>('homework');
  const [autoRuleScoringMode, setAutoRuleScoringMode] =
    useState<ScoringMode>('points');
  const [autoRulePointsPossible, setAutoRulePointsPossible] = useState<number>(100);
  const [autoRuleTotalProblems, setAutoRuleTotalProblems] = useState<number>(20);
  const [savingAutoRule, setSavingAutoRule] = useState(false);

  const [savedBlocksModalOpen, setSavedBlocksModalOpen] = useState(false);
  const [initialSavedBlockDraft, setInitialSavedBlockDraft] =
    useState<Partial<SavedScheduleBlock> | null>(null);
  const [savedBlocksCount, setSavedBlocksCount] = useState<number>(() => {
    const cfg = parseRecurringConfig(subject.recurring_config, subject.name);
    return cfg.saved_blocks?.length ?? 0;
  });

  useEffect(() => {
    const cfg = parseRecurringConfig(subject.recurring_config, subject.name);
    setSavedBlocksCount(cfg.saved_blocks?.length ?? 0);
  }, [subject.id, subject.name, subject.recurring_config]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const skipNextPropsResetRef = useRef(false);

  const currentDayKey = getDayKeyFromIsoDate(dateStr);
  const weekMondayStr = getMondayForIsoDate(dateStr);

  // Determine which weekdays this subject is active on during this week (defaults to Mon–Thu if notes exist on Mon–Thu, else Mon–Fri)
  const defaultSubjectRepeatDays = React.useMemo((): DayKey[] => {
    const subjectWeekNotes = notes.filter((n) => n.subject_id === subject.id);
    const activeSet = new Set<DayKey>();
    for (const n of subjectWeekNotes) {
      activeSet.add(getDayKeyFromIsoDate(n.note_date));
    }
    activeSet.add(currentDayKey);
    const ordered = DAY_KEYS.filter((d) => activeSet.has(d));
    return ordered.length >= 2
      ? ordered
      : (['monday', 'tuesday', 'wednesday', 'thursday'] as DayKey[]);
  }, [notes, subject.id, currentDayKey]);

  // Re-initialize rows whenever subject.id, dateStr, notes, or assignments change
  useEffect(() => {
    if (skipNextPropsResetRef.current) {
      skipNextPropsResetRef.current = false;
      return;
    }
    const subjectWeekNotes = notes.filter((n) => n.subject_id === subject.id);
    const subjectWeekAssigns = assignments.filter(
      (a) => a.subject_id === subject.id
    );
    const cellNotes = subjectWeekNotes.filter((n) => n.note_date === dateStr);
    const cellAssigns = subjectWeekAssigns.filter((a) => a.due_date === dateStr);

    const parsed = parseCellNotesAndAssignmentsToItems({
      subjectId: subject.id,
      dateStr,
      notes: cellNotes,
      assignments: cellAssigns,
      subject: subject as SubjectWithGrading,
      allWeekNotesForSubject: subjectWeekNotes,
      allWeekAssignmentsForSubject: subjectWeekAssigns,
    });

    if (parsed.length === 0) {
      setRows([createEmptyItemRow(subject.id, dateStr, 'verified', 'bullet')]);
      setInitialWeeklyKeys([]);
    } else {
      setRows(parsed);
      setInitialWeeklyKeys(
        parsed
          .filter(
            (r) =>
              (r.repeatAcrossWeek ||
                (r.repeatCadence === 'daily' &&
                  r.repeatDays &&
                  r.repeatDays.length > 1)) &&
              r.weeklyGroupKey
          )
          .map((r) => r.weeklyGroupKey)
      );
    }
    setRemovedAssignmentIds([]);
    setIsDirty(false);
  }, [subject.id, dateStr, notes, assignments]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (focusRowId && inputRefs.current[focusRowId]) {
      inputRefs.current[focusRowId]?.focus();
      setFocusRowId(null);
    }
  }, [focusRowId, rows]);

  const handleUpdateRow = (
    rowId: string,
    patch: Partial<StructuredCellLineItem>
  ) => {
    setIsDirty(true);
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    );
  };

  const handleToggleRepeatAcrossWeek = (row: StructuredCellLineItem) => {
    if (!row.repeatAcrossWeek) {
      const nextDays = Array.from(
        new Set<DayKey>([...defaultSubjectRepeatDays, currentDayKey])
      );
      handleUpdateRow(row.id, {
        repeatAcrossWeek: true,
        repeatCadence: 'weekly_shared',
        repeatDays: DAY_KEYS.filter((d) => nextDays.includes(d)),
        weeklyGroupKey:
          row.weeklyGroupKey || normalizeWeeklyBlockKey(row.text || row.id),
      });
    } else {
      handleUpdateRow(row.id, {
        repeatAcrossWeek: false,
        repeatCadence: 'daily',
        repeatDays: [currentDayKey],
      });
    }
  };

  const handleSetRepeatCadence = (
    row: StructuredCellLineItem,
    targetCadence: 'weekly_shared' | 'daily' | 'single_day'
  ) => {
    if (targetCadence === 'single_day') {
      handleUpdateRow(row.id, {
        repeatAcrossWeek: false,
        repeatCadence: 'daily',
        repeatDays: [currentDayKey],
      });
      return;
    }

    const currentMultiDays =
      row.repeatDays && row.repeatDays.length > 1
        ? row.repeatDays
        : Array.from(new Set<DayKey>([...defaultSubjectRepeatDays, currentDayKey]));

    if (targetCadence === 'weekly_shared') {
      handleUpdateRow(row.id, {
        repeatAcrossWeek: true,
        repeatCadence: 'weekly_shared',
        repeatDays: DAY_KEYS.filter((d) => currentMultiDays.includes(d)),
        weeklyGroupKey:
          row.weeklyGroupKey || normalizeWeeklyBlockKey(row.text || row.id),
      });
    } else {
      // targetCadence === 'daily'
      handleUpdateRow(row.id, {
        repeatAcrossWeek: false,
        repeatCadence: 'daily',
        repeatDays: DAY_KEYS.filter((d) => currentMultiDays.includes(d)),
        weeklyGroupKey:
          row.weeklyGroupKey || normalizeWeeklyBlockKey(row.text || row.id),
      });
    }
  };

  const handleToggleRepeatWeekday = (
    row: StructuredCellLineItem,
    dayKey: DayKey
  ) => {
    const currentDays = row.repeatDays || [currentDayKey];
    const exists = currentDays.includes(dayKey);
    const nextDays = exists
      ? currentDays.filter((d) => d !== dayKey)
      : [...currentDays, dayKey];
    if (nextDays.length === 0) {
      handleUpdateRow(row.id, {
        repeatAcrossWeek: false,
        repeatCadence: 'daily',
        repeatDays: [currentDayKey],
      });
      return;
    }
    const filteredDays = DAY_KEYS.filter((d) => nextDays.includes(d));
    handleUpdateRow(row.id, {
      repeatAcrossWeek: row.repeatCadence === 'weekly_shared' && filteredDays.length > 1,
      repeatDays: filteredDays,
    });
  };

  const handleInsertRowAfter = (
    index: number,
    category: WeeklyItemCategory = 'verified',
    infoSubType: InfoSubType = 'bullet',
    withInitialSubItem = false
  ) => {
    setIsDirty(true);
    const initialSubs = withInitialSubItem
      ? [createEmptySubItem(category === 'info')]
      : [];
    const newRow = createEmptyItemRow(
      subject.id,
      dateStr,
      category,
      infoSubType,
      initialSubs
    );
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newRow);
      return next;
    });
    setFocusRowId(newRow.id);
  };

  const handleDeleteRow = (row: StructuredCellLineItem, index: number) => {
    setIsDirty(true);
    if (row.assignmentId) {
      setRemovedAssignmentIds((prev) => [...prev, row.assignmentId!]);
    }
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyItemRow(subject.id, dateStr, 'verified', 'bullet')];
      }
      const next = prev.filter((r) => r.id !== row.id);
      const prevRow = next[Math.max(0, index - 1)];
      if (prevRow) {
        setFocusRowId(prevRow.id);
      }
      return next;
    });
  };

  const handleAddSubItem = (rowId: string, afterSubIdx?: number) => {
    setIsDirty(true);
    const newSub = createEmptySubItem(false);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const nextSubs = [...(r.subItems || [])];
        if (typeof afterSubIdx === 'number' && afterSubIdx >= 0) {
          nextSubs.splice(afterSubIdx + 1, 0, newSub);
        } else {
          nextSubs.push(newSub);
        }
        return { ...r, subItems: nextSubs };
      })
    );
    setFocusRowId(newSub.id);
  };

  const handleUpdateSubItem = (
    rowId: string,
    subId: string,
    patch: Partial<StructuredSubItem>
  ) => {
    setIsDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const nextSubs = (r.subItems || []).map((s) =>
          s.id === subId ? { ...s, ...patch } : s
        );
        const checkSubs = nextSubs.filter((s) => !s.isBullet);
        const nextChecked =
          checkSubs.length > 0 ? checkSubs.every((s) => s.checked) : r.checked;
        return { ...r, subItems: nextSubs, checked: nextChecked };
      })
    );
  };

  const handleDeleteSubItem = (rowId: string, subId: string) => {
    setIsDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          subItems: (r.subItems || []).filter((s) => s.id !== subId),
        };
      })
    );
  };

  const handlePasteSubItems = (
    e: React.ClipboardEvent<HTMLDivElement>,
    rowId: string,
    subIdx: number,
    defaultIsBullet: boolean
  ) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted || (!pasted.includes('\n') && !pasted.includes('\r'))) {
      return;
    }
    const rawLines = pasted
      .split(/\r?\n/)
      .map((l) => l.replace(/^(\s*[-*•]\s*(\[[ xX]\]\s*)?)/, '').trim())
      .filter((l) => l.length > 0);
    if (rawLines.length <= 1) return;

    e.preventDefault();
    setIsDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const nextSubs = [...(r.subItems || [])];
        const current = nextSubs[subIdx];
        if (!current) return r;
        if (!current.text.trim()) {
          nextSubs[subIdx] = { ...current, text: rawLines[0] };
          const extras: StructuredSubItem[] = rawLines.slice(1).map((line) => ({
            ...createEmptySubItem(current.isBullet ?? defaultIsBullet),
            text: line,
          }));
          nextSubs.splice(subIdx + 1, 0, ...extras);
        } else {
          const extras: StructuredSubItem[] = rawLines.map((line) => ({
            ...createEmptySubItem(current.isBullet ?? defaultIsBullet),
            text: line,
          }));
          nextSubs.splice(subIdx + 1, 0, ...extras);
        }
        return { ...r, subItems: nextSubs };
      })
    );
    toast.success(`Pasted ${rawLines.length} lines underneath this block!`);
  };

  const handleInsertSavedBlock = (
    block: SavedScheduleBlock,
    options: InsertSavedBlockOptions
  ) => {
    setIsDirty(true);
    const effectiveDays: DayKey[] =
      options.repeatMode === 'single_day'
        ? [currentDayKey]
        : DAY_KEYS.filter(
            (d) => options.repeatDays.includes(d) || d === currentDayKey
          );
    const isMultiDay =
      options.repeatMode !== 'single_day' && effectiveDays.length > 1;
    const repeatAcrossWeek =
      options.repeatMode === 'weekly_shared' && isMultiDay;
    const repeatCadence: 'weekly_shared' | 'daily' =
      options.repeatMode === 'weekly_shared' ? 'weekly_shared' : 'daily';

    const category: WeeklyItemCategory =
      block.role === 'graded'
        ? 'graded'
        : block.role === 'verified'
        ? 'verified'
        : 'info';
    const infoSubType: InfoSubType =
      block.role === 'header' ? 'header' : 'bullet';

    const cleanSubItems = (block.subItems || []).filter(
      (s) => s.text.trim().length > 0
    );

    if (options.insertStyle === 'separate_rows' && cleanSubItems.length > 0) {
      const headerRow: StructuredCellLineItem = {
        ...createEmptyItemRow(
          subject.id,
          dateStr,
          block.role === 'graded' ? 'info' : category,
          block.role === 'verified' || block.role === 'header' ? 'header' : infoSubType,
          []
        ),
        text: block.title,
        repeatAcrossWeek,
        repeatCadence,
        repeatDays: effectiveDays,
        weeklyGroupKey: normalizeWeeklyBlockKey(block.title),
      };

      const childRows: StructuredCellLineItem[] = cleanSubItems.map((sub) => {
        const rowCat: WeeklyItemCategory = sub.isBullet ? 'info' : 'verified';
        return {
          ...createEmptyItemRow(subject.id, dateStr, rowCat, 'bullet', []),
          text: sub.text,
          checked: false,
          repeatAcrossWeek,
          repeatCadence,
          repeatDays: effectiveDays,
          weeklyGroupKey: normalizeWeeklyBlockKey(sub.text),
        };
      });

      const insertedRows = [headerRow, ...childRows];
      setRows((prev) => {
        const isSingleBlank =
          prev.length === 1 &&
          !prev[0].text.trim() &&
          (prev[0].subItems || []).length === 0;
        return isSingleBlank ? insertedRows : [...prev, ...insertedRows];
      });
      setFocusRowId(headerRow.id);
    } else {
      const mappedSubs: StructuredSubItem[] = cleanSubItems.map((sub) => ({
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: sub.text,
        checked: false,
        isBullet: Boolean(sub.isBullet),
      }));

      const newBlockRow: StructuredCellLineItem = {
        ...createEmptyItemRow(
          subject.id,
          dateStr,
          category,
          infoSubType,
          mappedSubs
        ),
        text: block.title,
        checked: false,
        repeatAcrossWeek,
        repeatCadence,
        repeatDays: effectiveDays,
        weeklyGroupKey: normalizeWeeklyBlockKey(block.title),
        assignmentCategory: block.assignmentCategory || 'homework',
        scoringMode: block.scoringMode || 'points',
        pointsPossible: block.pointsPossible || 100,
        totalProblems: block.totalProblems || 20,
      };

      setRows((prev) => {
        const isSingleBlank =
          prev.length === 1 &&
          !prev[0].text.trim() &&
          (prev[0].subItems || []).length === 0;
        if (isSingleBlank) {
          return [newBlockRow];
        }
        // If there is already a placeholder row with the same header title and no sub-items, replace it in place
        const targetKey = normalizeWeeklyBlockKey(block.title);
        const emptyHeaderIdx = prev.findIndex(
          (r) =>
            normalizeWeeklyBlockKey(r.text) === targetKey &&
            (r.subItems || []).filter((s) => s.text.trim().length > 0).length ===
              0
        );
        if (emptyHeaderIdx >= 0) {
          const next = [...prev];
          next[emptyHeaderIdx] = {
            ...newBlockRow,
            id: prev[emptyHeaderIdx].id,
            assignmentId: prev[emptyHeaderIdx].assignmentId,
          };
          return next;
        }
        return [...prev, newBlockRow];
      });
      setFocusRowId(newBlockRow.id);
    }

    const cadenceSummary =
      options.repeatMode === 'single_day'
        ? `for ${DAY_LABELS[currentDayKey]}`
        : options.repeatMode === 'weekly_shared'
        ? `across ${formatRepeatDaysShortLabel(effectiveDays)} (Verified 1x/Wk)`
        : `across ${formatRepeatDaysShortLabel(effectiveDays)} (Verified Daily)`;

    toast.success(
      `Pulled "${block.name}" (${cleanSubItems.length} row${cleanSubItems.length === 1 ? '' : 's'}) into schedule ${cadenceSummary} — click Save Changes when ready.`
    );
  };

  const handleOpenSaveRowToLibrary = (row: StructuredCellLineItem) => {
    handleCloseBlockMenu();
    const role = getBlockRoleValue(row);
    const existingSubs = (row.subItems || []).filter(
      (s) => s.text.trim().length > 0
    );

    let draftSubs = existingSubs.map((s) => ({
      id: s.id,
      text: s.text.trim(),
      isBullet: Boolean(s.isBullet),
    }));

    // If the user clicked on a Header or parent row that has 0 sub-items, check if there are standalone rows immediately below it
    if (draftSubs.length === 0) {
      const rowIdx = rows.findIndex((r) => r.id === row.id);
      if (rowIdx >= 0 && rowIdx < rows.length - 1) {
        const collectedBelow: Array<{
          id: string;
          text: string;
          isBullet: boolean;
        }> = [];
        for (let i = rowIdx + 1; i < rows.length; i += 1) {
          const nextR = rows[i];
          if (
            nextR.category === 'graded' ||
            (nextR.category === 'info' &&
              (nextR.infoSubType === 'header' || nextR.infoSubType === 'divider'))
          ) {
            break;
          }
          if (nextR.text.trim()) {
            collectedBelow.push({
              id: nextR.id,
              text: nextR.text.trim(),
              isBullet: nextR.category === 'info',
            });
          }
          for (const ns of nextR.subItems || []) {
            if (ns.text.trim()) {
              collectedBelow.push({
                id: ns.id,
                text: ns.text.trim(),
                isBullet: Boolean(ns.isBullet),
              });
            }
          }
        }
        if (collectedBelow.length > 0) {
          draftSubs = collectedBelow;
        }
      }
    }

    const repeatMode: SavedBlockRepeatMode =
      row.repeatAcrossWeek && row.repeatCadence !== 'daily'
        ? 'weekly_shared'
        : 'daily_repeat';
    const repeatDays =
      row.repeatDays && row.repeatDays.length > 1
        ? DAY_KEYS.filter((d) => row.repeatDays.includes(d))
        : defaultSubjectRepeatDays;

    const cleanTitle = row.text.trim() || 'Memory Work';
    setInitialSavedBlockDraft({
      name: `${cleanTitle} — Set ${savedBlocksCount + 1}`,
      title: cleanTitle,
      role: role === 'graded' ? 'graded' : role === 'header' ? 'header' : role === 'info' ? 'info' : 'verified',
      subItems: draftSubs,
      defaultRepeatMode: repeatMode,
      defaultRepeatDays: repeatDays,
      insertStyle: 'grouped',
      assignmentCategory: row.assignmentCategory || 'homework',
      scoringMode:
        row.scoringMode === 'problems_calculator'
          ? 'problems_calculator'
          : 'points',
      pointsPossible: row.pointsPossible || 100,
      totalProblems: row.totalProblems || 20,
    });
    setSavedBlocksModalOpen(true);
  };

  const handleMergeIntoAbove = (index: number) => {
    if (index <= 0) return;
    setIsDirty(true);
    const currentRow = rows[index];
    if (currentRow.assignmentId) {
      setRemovedAssignmentIds((prev) => [...prev, currentRow.assignmentId!]);
    }
    setRows((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const targetAbove = prev[index - 1];
      const mergingRow = prev[index];
      const newSubsFromMerging: StructuredSubItem[] = [];
      if (mergingRow.text.trim()) {
        newSubsFromMerging.push({
          id: `sub-merged-${mergingRow.id}`,
          text: mergingRow.text.trim(),
          checked: mergingRow.checked,
          isBullet: mergingRow.category === 'info',
        });
      }
      if (mergingRow.subItems && mergingRow.subItems.length > 0) {
        newSubsFromMerging.push(...mergingRow.subItems);
      }
      const nextTargetCategory: WeeklyItemCategory =
        targetAbove.category === 'info' &&
        targetAbove.infoSubType === 'header' &&
        mergingRow.category !== 'info'
          ? mergingRow.category
          : targetAbove.category;

      const updatedAbove: StructuredCellLineItem = {
        ...targetAbove,
        category: nextTargetCategory,
        infoSubType:
          nextTargetCategory === 'info' ? targetAbove.infoSubType : 'bullet',
        subItems: [...(targetAbove.subItems || []), ...newSubsFromMerging],
      };

      const next = [...prev];
      next[index - 1] = updatedAbove;
      next.splice(index, 1);
      return next;
    });
  };

  const handleUngroupSubItem = (rowIndex: number, subItem: StructuredSubItem) => {
    const parentRow = rows[rowIndex];
    if (!parentRow) return;
    setIsDirty(true);
    const standaloneRow: StructuredCellLineItem = {
      ...createEmptyItemRow(
        subject.id,
        dateStr,
        parentRow.category === 'graded' ? 'verified' : parentRow.category,
        'bullet'
      ),
      text: subItem.text,
      checked: subItem.checked,
    };

    setRows((prev) => {
      const next = [...prev];
      const updatedParent: StructuredCellLineItem = {
        ...next[rowIndex],
        subItems: (next[rowIndex].subItems || []).filter(
          (s) => s.id !== subItem.id
        ),
      };
      next[rowIndex] = updatedParent;
      next.splice(rowIndex + 1, 0, standaloneRow);
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();
    const policy = parseSubjectGradingPolicy(subject as SubjectWithGrading);

    try {
      const subjectWeekNotes = notes.filter((n) => n.subject_id === subject.id);
      const subjectWeekAssigns = assignments.filter(
        (a) => a.subject_id === subject.id
      );
      const currentCellNotes = subjectWeekNotes.filter(
        (n) => n.note_date === dateStr
      );

      const assignmentIdsToDelete = new Set<string>(removedAssignmentIds);
      for (const r of rows) {
        if (r.category === 'info') {
          if (r.assignmentId) {
            assignmentIdsToDelete.add(r.assignmentId);
          }
          if (r.repeatAcrossWeek && r.text.trim()) {
            const bKey =
              r.weeklyGroupKey || normalizeWeeklyBlockKey(r.text.trim());
            for (const wa of subjectWeekAssigns) {
              if (normalizeWeeklyBlockKey(wa.title) === bKey) {
                assignmentIdsToDelete.add(wa.id);
              }
            }
          }
        }
      }

      if (assignmentIdsToDelete.size > 0) {
        const ids = Array.from(assignmentIdsToDelete);
        const { error: delErr } = await supabase
          .from('assignments')
          .delete()
          .in('id', ids);
        if (delErr) throw delErr;
      }

      // 2. Upsert/Create/Update Graded (and assignment-backed Verified) rows.
      // For `repeatAcrossWeek` blocks, ensure ONLY ONE `school.assignments` row exists across the whole week!
      const activeGradedOrAssignRows = rows.filter(
        (r) =>
          r.text.trim().length > 0 &&
          (r.category === 'graded' ||
            (r.category === 'verified' && Boolean(r.assignmentId)))
      );

      for (const r of activeGradedOrAssignRows) {
        const isGradedCat = r.category === 'graded';
        const effectiveMode: ScoringMode = isGradedCat
          ? r.scoringMode === 'completion'
            ? 'points'
            : r.scoringMode
          : 'completion';

        const metrics = isGradedCat
          ? computeAssignmentMetrics({
              grading_mode: effectiveMode,
              points_earned: r.pointsEarned,
              points_possible: r.pointsPossible || 100,
              total_problems: r.totalProblems,
              missed_problems: r.problemsMissed,
              scale: policy.grading_scale,
            })
          : {
              points_earned: null,
              percentage_score: null,
              letter_grade: null,
            };

        const hasStoredVer = Boolean(
          r.verifiedBy || r.verifiedAt || (r.category === 'verified' && r.checked)
        );
        const isDone = isGradedCat
          ? metrics.percentage_score !== null
          : r.checked || hasStoredVer;
        const formattedSubInstructions = formatSubItemsForAssignmentInstructions(
          r.subItems || [],
          r.assignmentRecord?.instructions
        );

        const blockKey =
          r.weeklyGroupKey || normalizeWeeklyBlockKey(r.text.trim());
        const matchedExistingWeeklyAssign = r.repeatAcrossWeek
          ? subjectWeekAssigns.find(
              (a) =>
                !assignmentIdsToDelete.has(a.id) &&
                (a.id === r.assignmentId ||
                  normalizeWeeklyBlockKey(a.title) === blockKey)
            )
          : undefined;

        const targetAssignId =
          matchedExistingWeeklyAssign?.id ||
          (r.assignmentId && !assignmentIdsToDelete.has(r.assignmentId)
            ? r.assignmentId
            : undefined);

        // For a weekly-shared graded assignment, set its due date to the last selected day of the week (e.g. Thu for M-Th)
        const targetDueDate =
          r.repeatAcrossWeek && r.repeatDays.length > 0
            ? getIsoDateForWeekdayInWeek(
                weekMondayStr,
                r.repeatDays[r.repeatDays.length - 1]
              )
            : dateStr;

        const existingAssign = matchedExistingWeeklyAssign || r.assignmentRecord;
        const existingStd =
          existingAssign?.state_standards &&
          typeof existingAssign.state_standards === 'object' &&
          !Array.isArray(existingAssign.state_standards)
            ? (existingAssign.state_standards as Record<string, unknown>)
            : {};
        const existingMm = parseAssignmentMoodleMeta(existingAssign?.state_standards);
        const isInternalAssignment =
          !r.isApiSynced && typeof existingMm?.moodle_cmid !== 'number';
        const nextStateStandards: Json = {
          ...existingStd,
          ...(isInternalAssignment
            ? {
                moodle_meta: {
                  ...(existingMm || {}),
                  is_internal_grade: true,
                },
              }
            : {}),
          ...(hasStoredVer
            ? {
                verified_by: r.verifiedBy || activeUserName,
                verified_at: r.verifiedAt || nowIso,
              }
            : {
                verified_by: null,
                verified_at: null,
              }),
        } as Json;

        if (targetAssignId) {
          const { error: updErr } = await supabase
            .from('assignments')
            .update({
              title: r.text.trim(),
              description:
                formattedSubInstructions ||
                r.assignmentRecord?.description ||
                r.text.trim(),
              instructions: formattedSubInstructions,
              due_date: targetDueDate,
              category: r.assignmentCategory || 'homework',
              is_graded: isGradedCat,
              grading_mode: effectiveMode,
              points_earned: metrics.points_earned,
              points_possible: r.pointsPossible || 100,
              total_problems: r.totalProblems,
              missed_problems: r.problemsMissed,
              percentage_score: metrics.percentage_score,
              letter_grade: metrics.letter_grade,
              status: isDone ? 'completed' : 'pending',
              workflow_status: isDone ? 'completed' : 'not_started',
              completed_at: isDone ? r.verifiedAt || nowIso : null,
              state_standards: nextStateStandards,
            })
            .eq('id', targetAssignId);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from('assignments').insert({
            subject_id: subject.id,
            title: r.text.trim(),
            description: formattedSubInstructions || r.text.trim(),
            instructions: formattedSubInstructions,
            due_date: targetDueDate,
            assigned_date: weekMondayStr,
            category: r.assignmentCategory || 'homework',
            is_graded: isGradedCat,
            grading_mode: effectiveMode,
            points_earned: metrics.points_earned,
            points_possible: r.pointsPossible || 100,
            total_problems: r.totalProblems,
            missed_problems: r.problemsMissed,
            percentage_score: metrics.percentage_score,
            letter_grade: metrics.letter_grade,
            status: isDone ? 'completed' : 'pending',
            workflow_status: isDone ? 'completed' : 'not_started',
            completed_at: isDone ? r.verifiedAt || nowIso : null,
            state_standards: nextStateStandards,
          });
          if (insErr) throw insErr;
        }
      }

      // 3. Serialize current day's items into `parent_notes` for (subject.id, dateStr)
      const currentDayRowsForNotes = rows
        .filter(
          (r) =>
            !r.repeatAcrossWeek || r.repeatDays.includes(currentDayKey)
        )
        .map((r) => ({
          ...r,
          weeklyGroupKey:
            r.weeklyGroupKey || normalizeWeeklyBlockKey(r.text.trim()),
          assignmentId: r.category === 'info' ? undefined : r.assignmentId,
        }));
      const notePayloads = serializeCellItemsToNotesPayload(
        currentDayRowsForNotes
      );

      if (currentCellNotes.length > 0) {
        const existingIds = currentCellNotes.map((n) => n.id);
        const { error: delNotesErr } = await supabase
          .from('parent_notes')
          .delete()
          .in('id', existingIds);
        if (delNotesErr) throw delNotesErr;
      }

      if (notePayloads.length > 0) {
        const toInsert = notePayloads.map((p) => ({
          subject_id: subject.id,
          note_date: dateStr,
          title: p.title,
          description: p.description,
          created_by: activeUserName,
          updated_by: activeUserName,
          updated_at: nowIso,
        }));
        const { error: insNotesErr } = await supabase
          .from('parent_notes')
          .insert(toInsert);
        if (insNotesErr) throw insNotesErr;
      }

      // 4. Auto-propagate any repeating blocks (weekly-shared OR multi-day daily) to the remaining days of this week!
      const activeRepeatingRows = rows.filter(
        (r) =>
          r.text.trim().length > 0 &&
          (r.repeatAcrossWeek ||
            (r.repeatCadence === 'daily' && r.repeatDays && r.repeatDays.length > 1))
      );
      const hasWeeklySyncWork =
        activeRepeatingRows.length > 0 || initialWeeklyKeys.length > 0;

      let syncedDaysCount = 0;
      if (hasWeeklySyncWork) {
        const currentRepeatingKeyMap = new Map<string, StructuredCellLineItem>();
        for (const sr of activeRepeatingRows) {
          const k = sr.weeklyGroupKey || normalizeWeeklyBlockKey(sr.text.trim());
          currentRepeatingKeyMap.set(k, {
            ...sr,
            weeklyGroupKey: k,
          });
        }

        // Keys that were repeating when the modal opened OR are now repeating
        const allTrackedKeys = new Set<string>([
          ...initialWeeklyKeys,
          ...Array.from(currentRepeatingKeyMap.keys()),
        ]);

        for (const otherDayKey of DAY_KEYS) {
          if (otherDayKey === currentDayKey) continue;
          const otherDateStr = getIsoDateForWeekdayInWeek(
            weekMondayStr,
            otherDayKey
          );
          const otherDayNotes = subjectWeekNotes.filter(
            (n) => n.note_date === otherDateStr
          );
          const otherDayAssigns = subjectWeekAssigns.filter(
            (a) => a.due_date === otherDateStr
          );

          const otherParsed = parseCellNotesAndAssignmentsToItems({
            subjectId: subject.id,
            dateStr: otherDateStr,
            notes: otherDayNotes,
            assignments: otherDayAssigns,
            subject: subject as SubjectWithGrading,
            allWeekNotesForSubject: subjectWeekNotes,
            allWeekAssignmentsForSubject: subjectWeekAssigns,
          });

          // Keep only note-backed items (or repeating items) when rebuilding otherDateStr's parent_notes
          const nextOtherItems: StructuredCellLineItem[] = [];
          const handledKeysOnOtherDay = new Set<string>();
          let modifiedOtherDay = false;

          for (const existingItem of otherParsed) {
            // Non-weekly standalone graded assignments live in school.assignments, not parent_notes
            if (
              existingItem.assignmentId &&
              !existingItem.repeatAcrossWeek &&
              !existingItem.sourceNoteId
            ) {
              continue;
            }

            const itemKey =
              existingItem.weeklyGroupKey ||
              normalizeWeeklyBlockKey(existingItem.text);

            if (allTrackedKeys.has(itemKey)) {
              const updatedItem = currentRepeatingKeyMap.get(itemKey);
              if (
                updatedItem &&
                (updatedItem.repeatAcrossWeek ||
                  (updatedItem.repeatCadence === 'daily' &&
                    updatedItem.repeatDays &&
                    updatedItem.repeatDays.length > 1)) &&
                updatedItem.repeatDays.includes(otherDayKey)
              ) {
                // If it is weekly-shared, copy checked state as well.
                // If it is daily verification, KEEP existingItem's checked state and verification info!
                const isWeekly =
                  updatedItem.repeatAcrossWeek && updatedItem.repeatCadence !== 'daily';
                nextOtherItems.push({
                  ...existingItem,
                  category: updatedItem.category,
                  text: updatedItem.text,
                  infoSubType: updatedItem.infoSubType,
                  checked: isWeekly ? updatedItem.checked : existingItem.checked,
                  verifiedBy: isWeekly ? updatedItem.verifiedBy : existingItem.verifiedBy,
                  verifiedAt: isWeekly ? updatedItem.verifiedAt : existingItem.verifiedAt,
                  subItems: updatedItem.subItems.map((s, idx) => ({
                    ...s,
                    checked: isWeekly
                      ? s.checked
                      : existingItem.subItems?.[idx]?.checked ?? false,
                  })),
                  repeatAcrossWeek: isWeekly,
                  repeatCadence: updatedItem.repeatCadence,
                  repeatDays: updatedItem.repeatDays,
                  weeklyGroupKey: itemKey,
                });
                handledKeysOnOtherDay.add(itemKey);
                modifiedOtherDay = true;
              } else {
                // This day was unchecked from repeatDays or switched to single-day
                modifiedOtherDay = true;
              }
            } else {
              nextOtherItems.push(existingItem);
            }
          }

          // Append any newly repeating block that targets otherDayKey and wasn't already on otherDateStr
          for (const [k, sharedRow] of currentRepeatingKeyMap.entries()) {
            if (
              !handledKeysOnOtherDay.has(k) &&
              sharedRow.repeatDays.includes(otherDayKey)
            ) {
              const isWeekly =
                sharedRow.repeatAcrossWeek && sharedRow.repeatCadence !== 'daily';
              nextOtherItems.push({
                ...sharedRow,
                id: `synced-${otherDayKey}-${k}`,
                dateStr: otherDateStr,
                dayKey: otherDayKey,
                weekdayLabel: DAY_LABELS[otherDayKey],
                checked: isWeekly ? sharedRow.checked : false,
                verifiedBy: isWeekly ? sharedRow.verifiedBy : null,
                verifiedAt: isWeekly ? sharedRow.verifiedAt : null,
                subItems: sharedRow.subItems.map((s) => ({
                  ...s,
                  checked: isWeekly ? s.checked : false,
                })),
                repeatAcrossWeek: isWeekly,
                repeatCadence: sharedRow.repeatCadence,
              });
              modifiedOtherDay = true;
            }
          }

          if (modifiedOtherDay) {
            syncedDaysCount += 1;
            const otherPayloads =
              serializeCellItemsToNotesPayload(nextOtherItems);

            if (otherDayNotes.length > 0) {
              const delIds = otherDayNotes.map((n) => n.id);
              const { error: delOtherErr } = await supabase
                .from('parent_notes')
                .delete()
                .in('id', delIds);
              if (delOtherErr) throw delOtherErr;
            }

            if (otherPayloads.length > 0) {
              const toInsOther = otherPayloads.map((p) => ({
                subject_id: subject.id,
                note_date: otherDateStr,
                title: p.title,
                description: p.description,
                created_by: activeUserName,
                updated_by: activeUserName,
                updated_at: nowIso,
              }));
              const { error: insOtherErr } = await supabase
                .from('parent_notes')
                .insert(toInsOther);
              if (insOtherErr) throw insOtherErr;
            }
          }
        }
      }

      toast.success(
        syncedDaysCount > 0
          ? `Saved & synced shared weekly blocks across ${syncedDaysCount + 1} days!`
          : 'Saved day items!'
      );
      setIsDirty(false);
      onDirtyChange?.(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save day items');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (saveTriggerRef) {
      saveTriggerRef.current = handleSaveAll;
    }
  });

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const handleOpenBlockMenu = (
    event: React.MouseEvent<HTMLElement>,
    row: StructuredCellLineItem
  ) => {
    event.stopPropagation();
    setBlockMenuAnchorEl(event.currentTarget);
    setBlockMenuRow(row);
  };

  const handleCloseBlockMenu = () => {
    setBlockMenuAnchorEl(null);
    setBlockMenuRow(null);
  };

  const handleOpenMoveBlockDialog = (row: StructuredCellLineItem) => {
    handleCloseBlockMenu();
    const fallbackDay =
      DAY_KEYS.find((d) => d !== currentDayKey) || ('monday' as DayKey);
    setMoveDialogRow(row);
    setMoveMode('same_week');
    setMoveTargetMondayStr(weekMondayStr);
    setMoveTargetDayKey(fallbackDay);
  };

  const handleExecuteMoveBlock = async (
    row: StructuredCellLineItem,
    targetDateStr: string
  ) => {
    if (targetDateStr === dateStr) {
      toast.error('This block is already on that date.');
      return;
    }
    const isRowDivider =
      row.category === 'info' && row.infoSubType === 'divider';
    if (!isRowDivider && !row.text.trim()) {
      toast.error('Please enter text for this block before moving it.');
      return;
    }

    setMovingBlockBusy(true);
    handleCloseBlockMenu();
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();
    const policy = parseSubjectGradingPolicy(subject as SubjectWithGrading);
    const targetDayKey = getDayKeyFromIsoDate(targetDateStr);
    const targetWeekMondayStr = getMondayForIsoDate(targetDateStr);

    try {
      const isGradedOrAssign =
        row.category === 'graded' ||
        (row.category === 'verified' && Boolean(row.assignmentId));

      if (isGradedOrAssign) {
        const isGradedCat = row.category === 'graded';
        const effectiveMode: ScoringMode = isGradedCat
          ? row.scoringMode === 'completion'
            ? 'points'
            : row.scoringMode
          : 'completion';

        const metrics = isGradedCat
          ? computeAssignmentMetrics({
              grading_mode: effectiveMode,
              points_earned: row.pointsEarned,
              points_possible: row.pointsPossible || 100,
              total_problems: row.totalProblems,
              missed_problems: row.problemsMissed,
              scale: policy.grading_scale,
            })
          : {
              points_earned: null,
              percentage_score: null,
              letter_grade: null,
            };

        const hasStoredVer = Boolean(
          row.verifiedBy ||
            row.verifiedAt ||
            (row.category === 'verified' && row.checked)
        );
        const isDone = isGradedCat
          ? metrics.percentage_score !== null
          : row.checked || hasStoredVer;
        const formattedSubInstructions = formatSubItemsForAssignmentInstructions(
          row.subItems || [],
          row.assignmentRecord?.instructions
        );

        const existingAssign = row.assignmentRecord;
        const existingStd =
          existingAssign?.state_standards &&
          typeof existingAssign.state_standards === 'object' &&
          !Array.isArray(existingAssign.state_standards)
            ? (existingAssign.state_standards as Record<string, unknown>)
            : {};
        const existingMm = parseAssignmentMoodleMeta(
          existingAssign?.state_standards
        );
        const isInternalAssignment =
          !row.isApiSynced && typeof existingMm?.moodle_cmid !== 'number';
        const nextStateStandards: Json = {
          ...existingStd,
          ...(isInternalAssignment
            ? {
                moodle_meta: {
                  ...(existingMm || {}),
                  is_internal_grade: true,
                },
              }
            : {}),
          ...(hasStoredVer
            ? {
                verified_by: row.verifiedBy || activeUserName,
                verified_at: row.verifiedAt || nowIso,
              }
            : {
                verified_by: null,
                verified_at: null,
              }),
        } as Json;

        if (row.assignmentId) {
          const { error: updErr } = await supabase
            .from('assignments')
            .update({
              title: row.text.trim(),
              description:
                formattedSubInstructions ||
                row.assignmentRecord?.description ||
                row.text.trim(),
              instructions: formattedSubInstructions,
              due_date: targetDateStr,
              category: row.assignmentCategory || 'homework',
              is_graded: isGradedCat,
              grading_mode: effectiveMode,
              points_earned: metrics.points_earned,
              points_possible: row.pointsPossible || 100,
              total_problems: row.totalProblems,
              missed_problems: row.problemsMissed,
              percentage_score: metrics.percentage_score,
              letter_grade: metrics.letter_grade,
              status: isDone ? 'completed' : 'pending',
              workflow_status: isDone ? 'completed' : 'not_started',
              completed_at: isDone ? row.verifiedAt || nowIso : null,
              state_standards: nextStateStandards,
            })
            .eq('id', row.assignmentId);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from('assignments').insert({
            subject_id: subject.id,
            title: row.text.trim(),
            description: formattedSubInstructions || row.text.trim(),
            instructions: formattedSubInstructions,
            due_date: targetDateStr,
            assigned_date: targetWeekMondayStr,
            category: row.assignmentCategory || 'homework',
            is_graded: isGradedCat,
            grading_mode: effectiveMode,
            points_earned: metrics.points_earned,
            points_possible: row.pointsPossible || 100,
            total_problems: row.totalProblems,
            missed_problems: row.problemsMissed,
            percentage_score: metrics.percentage_score,
            letter_grade: metrics.letter_grade,
            status: isDone ? 'completed' : 'pending',
            workflow_status: isDone ? 'completed' : 'not_started',
            completed_at: isDone ? row.verifiedAt || nowIso : null,
            state_standards: nextStateStandards,
          });
          if (insErr) throw insErr;
        }
      } else {
        // Note-backed block: fetch existing notes/assignments on targetDateStr and append
        const [targetNotesRes, targetAssignsRes] = await Promise.all([
          supabase
            .from('parent_notes')
            .select('*')
            .eq('subject_id', subject.id)
            .eq('note_date', targetDateStr),
          supabase
            .from('assignments')
            .select('*')
            .eq('subject_id', subject.id)
            .eq('due_date', targetDateStr),
        ]);

        if (targetNotesRes.error) throw targetNotesRes.error;
        if (targetAssignsRes.error) throw targetAssignsRes.error;

        const targetNotesList = (targetNotesRes.data ||
          []) as PlannerParentNoteRecord[];
        const targetAssignsList = (targetAssignsRes.data ||
          []) as GradebookAssignment[];

        const existingTargetItems = parseCellNotesAndAssignmentsToItems({
          subjectId: subject.id,
          dateStr: targetDateStr,
          notes: targetNotesList,
          assignments: targetAssignsList,
          subject: subject as SubjectWithGrading,
          allWeekNotesForSubject: targetNotesList,
          allWeekAssignmentsForSubject: targetAssignsList,
        });

        const movedItem: StructuredCellLineItem = {
          ...row,
          id: `moved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dateStr: targetDateStr,
          dayKey: targetDayKey,
          weekdayLabel: DAY_LABELS[targetDayKey],
          repeatAcrossWeek: false,
          repeatCadence: 'daily',
          repeatDays: [targetDayKey],
          weeklyGroupKey: '',
        };

        const nextTargetItems = [...existingTargetItems, movedItem];
        const targetNotePayloads = serializeCellItemsToNotesPayload(
          nextTargetItems.map((it) => ({
            ...it,
            weeklyGroupKey:
              it.weeklyGroupKey || normalizeWeeklyBlockKey(it.text.trim()),
            assignmentId: it.category === 'info' ? undefined : it.assignmentId,
          }))
        );

        const { error: delTargetErr } = await supabase
          .from('parent_notes')
          .delete()
          .eq('subject_id', subject.id)
          .eq('note_date', targetDateStr);
        if (delTargetErr) throw delTargetErr;

        if (targetNotePayloads.length > 0) {
          const toInsertTarget = targetNotePayloads.map((p) => ({
            subject_id: subject.id,
            note_date: targetDateStr,
            title: p.title,
            description: p.description,
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          }));
          const { error: insTargetErr } = await supabase
            .from('parent_notes')
            .insert(toInsertTarget);
          if (insTargetErr) throw insTargetErr;
        }
      }

      // Remove the moved block from the current day's cell (subject.id, dateStr)
      const remainingRows = rows.filter((r) => r.id !== row.id);
      const currentDayRowsForNotes = remainingRows
        .filter(
          (r) => !r.repeatAcrossWeek || r.repeatDays.includes(currentDayKey)
        )
        .map((r) => ({
          ...r,
          weeklyGroupKey:
            r.weeklyGroupKey || normalizeWeeklyBlockKey(r.text.trim()),
          assignmentId: r.category === 'info' ? undefined : r.assignmentId,
        }));
      const sourceNotePayloads = serializeCellItemsToNotesPayload(
        currentDayRowsForNotes
      );

      const { error: delSourceErr } = await supabase
        .from('parent_notes')
        .delete()
        .eq('subject_id', subject.id)
        .eq('note_date', dateStr);
      if (delSourceErr) throw delSourceErr;

      if (sourceNotePayloads.length > 0) {
        const toInsertSource = sourceNotePayloads.map((p) => ({
          subject_id: subject.id,
          note_date: dateStr,
          title: p.title,
          description: p.description,
          created_by: activeUserName,
          updated_by: activeUserName,
          updated_at: nowIso,
        }));
        const { error: insSourceErr } = await supabase
          .from('parent_notes')
          .insert(toInsertSource);
        if (insSourceErr) throw insSourceErr;
      }

      const nextUiRows =
        remainingRows.length > 0
          ? remainingRows
          : [createEmptyItemRow(subject.id, dateStr, 'verified', 'bullet')];
      setRows(nextUiRows);
      setMoveDialogRow(null);

      toast.success(
        `Moved block to ${DAY_LABELS[targetDayKey]} (${formatFullDateDisplay(targetDateStr)})`
      );

      if (onSilentRefresh) {
        skipNextPropsResetRef.current = true;
        await onSilentRefresh();
      } else {
        await onSaved();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to move block'
      );
    } finally {
      setMovingBlockBusy(false);
    }
  };

  const handleOpenAddToAutoRulesDialog = (row: StructuredCellLineItem) => {
    handleCloseBlockMenu();
    const role = getBlockRoleValue(row);
    const initialDays =
      row.repeatDays && row.repeatDays.length > 0
        ? DAY_KEYS.filter((d) => row.repeatDays.includes(d))
        : [currentDayKey];

    setAutoRuleDialogRow(row);
    setAutoRuleRole(role);
    setAutoRuleHeaderSubType(
      row.infoSubType === 'divider' ? 'divider' : 'header'
    );
    setAutoRuleText(
      row.infoSubType === 'divider' ? '---' : row.text.trim()
    );
    setAutoRuleDays(initialDays.length > 0 ? initialDays : [currentDayKey]);
    setAutoRuleCadence(
      row.repeatAcrossWeek && row.repeatCadence !== 'daily'
        ? 'weekly_once'
        : 'daily'
    );
    setAutoRuleAssignCategory(row.assignmentCategory || 'homework');
    setAutoRuleScoringMode(
      row.scoringMode === 'completion' ? 'points' : row.scoringMode
    );
    setAutoRulePointsPossible(row.pointsPossible || 100);
    setAutoRuleTotalProblems(row.totalProblems || 20);
  };

  const handleExecuteAddToAutomationRules = async () => {
    if (!autoRuleDialogRow) return;
    const isDividerRule =
      autoRuleRole === 'header' && autoRuleHeaderSubType === 'divider';
    const trimmedText = isDividerRule ? '---' : autoRuleText.trim();
    if (!trimmedText) {
      toast.error('Please enter template text for the automation rule.');
      return;
    }
    const orderedDays = DAY_KEYS.filter((d) => autoRuleDays.includes(d));
    if (orderedDays.length === 0) {
      toast.error('Select at least one day of the week.');
      return;
    }

    setSavingAutoRule(true);
    try {
      const [subRes, tplRes] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, recurring_config')
          .eq('id', subject.id)
          .maybeSingle(),
        supabase
          .from('recurring_assignment_templates')
          .select('*')
          .eq('subject_id', subject.id)
          .order('created_at', { ascending: true }),
      ]);

      if (subRes.error) throw subRes.error;
      if (tplRes.error) throw tplRes.error;

      const recConfig = parseRecurringConfig(
        subRes.data?.recurring_config ?? subject.recurring_config
      );
      recConfig.enabled = true;

      const existingTemplates: RecurringAssignmentTemplate[] = (
        tplRes.data || []
      ).map((r) => ({
        id: r.id,
        subject_id: r.subject_id,
        title_template: r.title_template,
        instructions_template: r.instructions_template,
        assignment_type_slug: r.assignment_type_slug,
        grading_mode: r.grading_mode,
        points_possible: Number(r.points_possible),
        total_problems_default: r.total_problems_default,
        days_of_week: Array.isArray(r.days_of_week)
          ? r.days_of_week.filter(
              (d): d is DayKey =>
                typeof d === 'string' && DAY_KEYS.includes(d as DayKey)
            )
          : ['friday'],
        linked_weekly_source: r.linked_weekly_source,
        auto_behavior: r.auto_behavior,
        estimated_minutes: r.estimated_minutes,
        is_active: r.is_active,
      }));

      const isWeeklyShared =
        (autoRuleRole === 'verified' || autoRuleRole === 'graded') &&
        orderedDays.length > 1 &&
        autoRuleCadence === 'weekly_once';
      const effectiveCategory: WeeklyItemCategory =
        autoRuleRole === 'graded'
          ? 'graded'
          : autoRuleRole === 'verified'
            ? 'verified'
            : 'info';
      const effectiveInfoSubType: InfoSubType =
        autoRuleRole === 'header' ? autoRuleHeaderSubType : 'bullet';
      const groupKey = normalizeWeeklyBlockKey(trimmedText);
      const clonedSubItems: StructuredSubItem[] = (
        autoRuleDialogRow.subItems || []
      )
        .filter((s) => s.text.trim().length > 0)
        .map((s) => ({
          ...s,
          checked: false,
        }));

      for (const dk of orderedDays) {
        const currentDayCfg = recConfig.days[dk] || {
          enabled: false,
          attend_class: false,
          attend_class_label: 'Attend Class',
          fast_facts: false,
          fast_facts_label: '- [ ] Fast Facts',
          template: '',
        };
        const existingDayItems = parseRecurringTemplateDayToItems({
          subjectId: subject.id,
          dayKey: dk,
          dayTemplate: currentDayCfg.template || '',
          recurringTemplates: existingTemplates,
        });

        const newDayItem: StructuredCellLineItem = {
          ...createEmptyItemRow(
            subject.id,
            `template-${dk}`,
            effectiveCategory,
            effectiveInfoSubType,
            clonedSubItems
          ),
          dayKey: dk,
          weekdayLabel: DAY_LABELS[dk],
          text: trimmedText,
          repeatAcrossWeek: isWeeklyShared,
          repeatCadence: isWeeklyShared ? 'weekly_shared' : 'daily',
          repeatDays: orderedDays,
          weeklyGroupKey: isWeeklyShared ? groupKey : '',
          assignmentCategory: autoRuleAssignCategory,
          scoringMode: autoRuleScoringMode,
          pointsPossible: autoRulePointsPossible,
          totalProblems: autoRuleTotalProblems,
        };

        const existingMatchIdx = existingDayItems.findIndex(
          (it) =>
            it.category === effectiveCategory &&
            it.infoSubType === effectiveInfoSubType &&
            normalizeWeeklyBlockKey(it.text) === groupKey
        );

        const nextDayItems =
          existingMatchIdx >= 0
            ? existingDayItems.map((it, i) =>
                i === existingMatchIdx ? newDayItem : it
              )
            : [...existingDayItems, newDayItem];

        const serializedTemplate = serializeItemsToRecurringTemplateText(
          nextDayItems
        );
        recConfig.days[dk] = {
          ...currentDayCfg,
          enabled: true,
          template: serializedTemplate,
        };

        // If this subject uses API Auto-Populate rules, also append to custom_additional_lines for this weekday
        if (
          recConfig.course_syllabus?.source_type === 'api_sync' &&
          recConfig.course_syllabus.api_auto_populate?.weekday_rules?.[dk]
        ) {
          const wkRule =
            recConfig.course_syllabus.api_auto_populate.weekday_rules[dk];
          wkRule.enabled = true;
          const singleItemText = serializeItemsToRecurringTemplateText([
            newDayItem,
          ]).trim();
          const currentCustom = (wkRule.custom_additional_lines || '').trim();
          if (
            singleItemText &&
            !currentCustom
              .toLowerCase()
              .includes(trimmedText.toLowerCase())
          ) {
            wkRule.custom_additional_lines = currentCustom
              ? `${currentCustom}\n${singleItemText}`
              : singleItemText;
          }
        }
      }

      if (autoRuleRole === 'graded') {
        const targetScheduledDays: DayKey[] = isWeeklyShared
          ? [orderedDays[orderedDays.length - 1]]
          : orderedDays;
        const subInstructions = formatSubItemsForAssignmentInstructions(
          clonedSubItems,
          null
        );
        const existingMatchedTpl = existingTemplates.find(
          (t) => normalizeWeeklyBlockKey(t.title_template) === groupKey
        );

        if (existingMatchedTpl) {
          const { error: updTplErr } = await supabase
            .from('recurring_assignment_templates')
            .update({
              title_template: trimmedText,
              instructions_template: subInstructions,
              assignment_type_slug: autoRuleAssignCategory || 'homework',
              grading_mode: autoRuleScoringMode,
              points_possible: autoRulePointsPossible || 100,
              total_problems_default:
                autoRuleScoringMode === 'problems_calculator'
                  ? autoRuleTotalProblems || 20
                  : null,
              days_of_week: targetScheduledDays,
              linked_weekly_source: isWeeklyShared
                ? 'shared_weekly_goal'
                : null,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMatchedTpl.id);
          if (updTplErr) throw updTplErr;
        } else {
          const { error: insTplErr } = await supabase
            .from('recurring_assignment_templates')
            .insert({
              subject_id: subject.id,
              title_template: trimmedText,
              instructions_template: subInstructions,
              assignment_type_slug: autoRuleAssignCategory || 'homework',
              grading_mode: autoRuleScoringMode,
              points_possible: autoRulePointsPossible || 100,
              total_problems_default:
                autoRuleScoringMode === 'problems_calculator'
                  ? autoRuleTotalProblems || 20
                  : null,
              days_of_week: targetScheduledDays,
              linked_weekly_source: isWeeklyShared
                ? 'shared_weekly_goal'
                : null,
              auto_behavior: 'auto_create',
              is_active: true,
            });
          if (insTplErr) throw insTplErr;
        }
      }

      const { error: saveSubErr } = await supabase
        .from('subjects')
        .update({
          recurring_config: recConfig as unknown as Json,
        })
        .eq('id', subject.id);
      if (saveSubErr) throw saveSubErr;

      // Also sync to course_syllabi if an entry exists for this subject
      if (recConfig.course_syllabus) {
        await supabase
          .from('course_syllabi')
          .update({
            api_auto_populate:
              (recConfig.course_syllabus.api_auto_populate as unknown as Json) ??
              null,
            updated_at: new Date().toISOString(),
          })
          .eq('subject_id', subject.id);
      }

      const daysLabel = formatRepeatDaysShortLabel(orderedDays);
      toast.success(
        `Added to ${subject.name} automation rules (${daysLabel}) moving forward!`
      );
      setAutoRuleDialogRow(null);

      if (onSilentRefresh) {
        skipNextPropsResetRef.current = true;
        await onSilentRefresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to update subject automation rules'
      );
    } finally {
      setSavingAutoRule(false);
    }
  };

  const previewPayloads = serializeCellItemsToNotesPayload(
    rows
      .filter((r) => !r.repeatAcrossWeek)
      .map((r) => (r.category === 'info' ? { ...r, assignmentId: undefined } : r))
  );
  const previewWeeklyNotePayloads = serializeCellItemsToNotesPayload(
    rows
      .filter((r) => r.repeatAcrossWeek && r.category !== 'graded')
      .map((r) => (r.category === 'info' ? { ...r, assignmentId: undefined } : r))
  );
  const previewGradedRows = rows.filter(
    (r) => r.text.trim().length > 0 && r.category === 'graded'
  );

  return (
    <Box>
      {/* Header Legend & Quick Tools */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        mb={1.5}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800} color="primary.main">
            Day Blocks ({rows.filter((r) => r.text.trim().length > 0 || r.infoSubType === 'divider').length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Use <strong>Header</strong> for section titles, <strong>Info</strong> for notes, or <strong>Verified</strong> / <strong>Graded</strong> for assignments. Turn on <strong>Repeat All Week</strong> for items like Memory Work or Novels that show each day but are graded/verified once per week.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            color="info"
            startIcon={<HelpCircle size={13} />}
            onClick={() => setFormattingGuideOpen(true)}
            sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1, textTransform: 'none' }}
          >
            Formatting Guide
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<Sliders size={13} />}
            onClick={onOpenTypesManager}
            sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1, textTransform: 'none' }}
          >
            Types
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<Sparkles size={13} />}
            onClick={onOpenNewAssignmentModal}
            sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1, textTransform: 'none' }}
          >
            Advanced Modal
          </Button>
        </Stack>
      </Stack>

      {/* Side-by-Side Layout: Left = Item Blocks Editor, Right = Sticky Realtime Binder Square Preview */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2.5}
        alignItems="flex-start"
      >
        {/* LEFT COLUMN: Interactive Item Blocks + Multi-Line Sub-Items + Weekly Repeat Sync */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Stack spacing={1.25} mb={2}>
            {rows.map((row, idx) => {
              const roleValue = getBlockRoleValue(row);
              const isHeaderOrDivider = roleValue === 'header';
              const isInfo = roleValue === 'info';
              const isVerified = roleValue === 'verified';
              const isGraded = roleValue === 'graded';
              const subItems = row.subItems || [];
              const isGrouped = subItems.length > 0;
              const isDraggingThis = draggedRowId === row.id;
              const isDragOverThis = dragOverRowId === row.id && draggedRowId !== row.id;

              return (
                <Paper
                  key={row.id}
                  variant="outlined"
                  draggable={dragEnabledRowId === row.id || isDraggingThis}
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      !target.closest(
                        'input, textarea, button, a, [role="button"], .MuiSelect-root'
                      )
                    ) {
                      setDragEnabledRowId(row.id);
                    } else {
                      setDragEnabledRowId(null);
                    }
                  }}
                  onDragStart={(e) => {
                    setDraggedRowId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', row.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedRowId && draggedRowId !== row.id) {
                      setDragOverRowId(row.id);
                      setIsDirty(true);
                      setRows((prev) => {
                        const fromIndex = prev.findIndex((r) => r.id === draggedRowId);
                        const toIndex = prev.findIndex((r) => r.id === row.id);
                        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
                          return prev;
                        }
                        const next = [...prev];
                        const [moved] = next.splice(fromIndex, 1);
                        next.splice(toIndex, 0, moved);
                        return next;
                      });
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggedRowId(null);
                    setDragOverRowId(null);
                    setDragEnabledRowId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedRowId(null);
                    setDragOverRowId(null);
                    setDragEnabledRowId(null);
                  }}
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    opacity: isDraggingThis ? 0.55 : 1,
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                    borderStyle: isDragOverThis ? 'dashed' : 'solid',
                    borderWidth: isDragOverThis ? 2 : 1,
                    borderColor: isDragOverThis
                      ? 'primary.main'
                      : isGraded
                      ? alpha(theme.palette.success.main, 0.45)
                      : isVerified
                      ? alpha(theme.palette.info.main, 0.45)
                      : isHeaderOrDivider
                      ? alpha(theme.palette.warning.main, 0.45)
                      : 'divider',
                    bgcolor: isGraded
                      ? alpha(theme.palette.success.main, 0.03)
                      : isVerified
                      ? alpha(theme.palette.info.main, 0.02)
                      : isHeaderOrDivider
                      ? alpha(theme.palette.warning.main, 0.03)
                      : 'background.paper',
                  }}
                >
                  <Stack spacing={1}>
                    {/* Primary Block Row: Drag Handle + Status Control + Title/Header Input + 4-Way Role Selector + Delete */}
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {/* Drag Handle to Sort Day Blocks */}
                      <Tooltip title="Drag to reorder block">
                        <Box
                          onMouseEnter={() => setDragEnabledRowId(row.id)}
                          onMouseDown={() => setDragEnabledRowId(row.id)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.disabled',
                            cursor: isDraggingThis ? 'grabbing' : 'grab',
                            px: 0.25,
                            py: 0.5,
                            borderRadius: 0.5,
                            flexShrink: 0,
                            '&:hover': {
                              color: 'text.secondary',
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <GripVertical size={15} />
                        </Box>
                      </Tooltip>

                      {/* Left Indicator / Checkbox */}
                      {isVerified || isGraded ? (
                        <Checkbox
                          size="small"
                          color={isGraded ? 'success' : 'info'}
                          checked={row.checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            if (!nextChecked && isVerified && row.checked) {
                              setPendingUnverifyRow(row);
                              return;
                            }
                            const activeUserName = getCachedActiveUserName();
                            const nowIso = new Date().toISOString();
                            const updatedSubs = (row.subItems || []).map((s) =>
                              s.isBullet ? s : { ...s, checked: nextChecked }
                            );
                            handleUpdateRow(row.id, {
                              checked: nextChecked,
                              verifiedBy: nextChecked
                                ? row.verifiedBy || activeUserName
                                : row.verifiedBy,
                              verifiedAt: nextChecked
                                ? row.verifiedAt || nowIso
                                : row.verifiedAt,
                              subItems: updatedSubs,
                            });
                          }}
                          sx={{ p: 0.5 }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color:
                              row.infoSubType === 'parent_note'
                                ? branding.parentNotes.color
                                : branding.notes.color,
                            fontWeight: 900,
                            fontSize: '0.82rem',
                            flexShrink: 0,
                          }}
                        >
                          {row.infoSubType === 'divider'
                            ? '—'
                            : isHeaderOrDivider
                            ? 'H'
                            : '•'}
                        </Box>
                      )}

                      {/* Main Block Title / Header Input */}
                      <TextField
                        fullWidth
                        size="small"
                        inputRef={(el: HTMLInputElement | null) => {
                          inputRefs.current[row.id] = el;
                        }}
                        placeholder={
                          isGraded
                            ? isGrouped
                              ? 'Grouped Assignment Title (e.g. Memory Work: Unit 1 - Re-Test)...'
                              : 'Graded assignment title (e.g. Week 8, Class 22: Matter and How It’s Made)...'
                            : isVerified
                            ? isGrouped
                              ? 'Grouped Verification Title (e.g. Memory Work, Daily Exercises)...'
                              : 'Parent-verified item (e.g. Finish Cool History Questions)...'
                            : row.infoSubType === 'divider'
                            ? 'Optional divider label (or leave as Section Divider)...'
                            : isHeaderOrDivider
                            ? 'Section header (e.g. Complete the following:, Fable:, Grammar:, Attend Class)...'
                            : 'Informational note (e.g. Read Genesis Ch. 43 & 44)...'
                        }
                        value={row.text}
                        onChange={(e) =>
                          handleUpdateRow(row.id, { text: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.shiftKey) {
                            e.preventDefault();
                            handleAddSubItem(row.id);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInsertRowAfter(idx, 'verified', 'bullet');
                          } else if (
                            e.key === 'Backspace' &&
                            row.text === '' &&
                            subItems.length === 0 &&
                            rows.length > 1
                          ) {
                            e.preventDefault();
                            handleDeleteRow(row, idx);
                          }
                        }}
                        sx={{
                          '& .MuiInputBase-input': {
                            py: 0.65,
                            px: 1,
                            fontSize: '0.84rem',
                            fontWeight: isHeaderOrDivider || isGrouped ? 700 : 500,
                          },
                        }}
                      />

                      {/* 4-Way Role Selector: Header / Info / Verified / Graded */}
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={roleValue}
                        onChange={(_, nextRole: BlockRoleValue | null) => {
                          if (!nextRole) return;
                          const activeUserName = getCachedActiveUserName();
                          const nowIso = new Date().toISOString();
                          const preservedVerBy =
                            row.verifiedBy ||
                            (row.category === 'verified' && row.checked
                              ? activeUserName
                              : null);
                          const preservedVerAt =
                            row.verifiedAt ||
                            (row.category === 'verified' && row.checked ? nowIso : null);
                          const hasStoredVer = Boolean(preservedVerBy || preservedVerAt);

                          if (nextRole === 'header') {
                            handleUpdateRow(row.id, {
                              category: 'info',
                              infoSubType:
                                row.infoSubType === 'divider' ? 'divider' : 'header',
                              checked: false,
                              verifiedBy: preservedVerBy,
                              verifiedAt: preservedVerAt,
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: true,
                                checked: false,
                              })),
                            });
                          } else if (nextRole === 'info') {
                            handleUpdateRow(row.id, {
                              category: 'info',
                              infoSubType:
                                row.infoSubType === 'parent_note'
                                  ? 'parent_note'
                                  : 'bullet',
                              checked: false,
                              verifiedBy: preservedVerBy,
                              verifiedAt: preservedVerAt,
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: true,
                                checked: false,
                              })),
                            });
                          } else if (nextRole === 'verified') {
                            handleUpdateRow(row.id, {
                              category: 'verified',
                              infoSubType: 'bullet',
                              checked: hasStoredVer,
                              verifiedBy: preservedVerBy,
                              verifiedAt: preservedVerAt,
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: false,
                                checked: hasStoredVer ? true : s.checked,
                              })),
                            });
                          } else if (nextRole === 'graded') {
                            const rangeMatch = row.text.match(/#(\d+)\s*[-–]\s*(\d+)/);
                            const inferredTotal = rangeMatch
                              ? Math.max(
                                  1,
                                  Number.parseInt(rangeMatch[2], 10) -
                                    Number.parseInt(rangeMatch[1], 10) +
                                    1
                                )
                              : row.totalProblems;
                            const isAlreadyScored =
                              row.percentageScore !== null ||
                              row.pointsEarned !== null ||
                              row.problemsMissed !== null;
                            handleUpdateRow(row.id, {
                              category: 'graded',
                              infoSubType: 'bullet',
                              checked: isAlreadyScored,
                              verifiedBy: preservedVerBy,
                              verifiedAt: preservedVerAt,
                              scoringMode:
                                rangeMatch && row.pointsEarned === null && row.problemsMissed === null
                                  ? 'problems_calculator'
                                  : row.scoringMode,
                              totalProblems: inferredTotal ?? row.totalProblems,
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: false,
                                checked: isAlreadyScored ? s.checked : false,
                              })),
                            });
                          }
                        }}
                        sx={{
                          flexShrink: 0,
                          height: 30,
                          '& .MuiToggleButton-root': {
                            px: 0.9,
                            py: 0,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'none',
                          },
                        }}
                      >
                        <ToggleButton
                          value="header"
                          sx={{
                            '&.Mui-selected': {
                              bgcolor: alpha(theme.palette.warning.main, 0.16),
                              color: 'warning.dark',
                            },
                          }}
                        >
                          Header
                        </ToggleButton>
                        <ToggleButton value="info">Info</ToggleButton>
                        <ToggleButton
                          value="verified"
                          sx={{
                            '&.Mui-selected': {
                              bgcolor: alpha(theme.palette.info.main, 0.15),
                              color: 'info.main',
                            },
                          }}
                        >
                          Verified
                        </ToggleButton>
                        <ToggleButton
                          value="graded"
                          sx={{
                            '&.Mui-selected': {
                              bgcolor: alpha(theme.palette.success.main, 0.15),
                              color: 'success.dark',
                            },
                          }}
                        >
                          Graded
                        </ToggleButton>
                      </ToggleButtonGroup>

                      <Tooltip title="Block options (Move to another day/week or Add to automation rules)">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenBlockMenu(e, row)}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: 'primary.main',
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                            },
                          }}
                        >
                          <MoreVertical size={15} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Remove block">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRow(row, idx)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {/* Action Strip for Grouping / Sub-Lines / Repeat Across Week / Header Style */}
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ pl: 4.5 }}
                    >
                      {isHeaderOrDivider && (
                        <>
                          <Chip
                            size="small"
                            icon={<Heading size={12} />}
                            label="Section Header"
                            color={row.infoSubType === 'header' ? 'warning' : 'default'}
                            variant={row.infoSubType === 'header' ? 'filled' : 'outlined'}
                            onClick={() =>
                              handleUpdateRow(row.id, { infoSubType: 'header' })
                            }
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          />
                          <Chip
                            size="small"
                            icon={<Minus size={12} />}
                            label="Horizontal Divider Line"
                            color={row.infoSubType === 'divider' ? 'warning' : 'default'}
                            variant={row.infoSubType === 'divider' ? 'filled' : 'outlined'}
                            onClick={() =>
                              handleUpdateRow(row.id, {
                                infoSubType: 'divider',
                                text: row.text || 'Section Divider',
                              })
                            }
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          />
                        </>
                      )}

                      {row.infoSubType !== 'divider' && (
                        <>
                          <Button
                            size="small"
                            variant="text"
                            color={isGraded ? 'success' : isVerified ? 'info' : 'inherit'}
                            startIcon={<CornerDownRight size={12} />}
                            onClick={() => handleAddSubItem(row.id)}
                            sx={{
                              py: 0,
                              px: 0.75,
                              minHeight: 22,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'none',
                            }}
                          >
                            + Add Sub-Line to Group
                          </Button>

                          {idx > 0 && !isHeaderOrDivider && (
                            <Tooltip title="Merge this item into the block above so they are evaluated together as a single grouped item">
                              <Button
                                size="small"
                                variant="text"
                                color="secondary"
                                startIcon={<ArrowUpLeft size={12} />}
                                onClick={() => handleMergeIntoAbove(idx)}
                                sx={{
                                  py: 0,
                                  px: 0.75,
                                  minHeight: 22,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                }}
                              >
                                Group into Above ↑
                              </Button>
                            </Tooltip>
                          )}

                          {/* Frequency & Verification Cadence Toggles */}
                          <Tooltip
                            title={
                              row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                ? 'Shared across selected days and evaluated ONCE per week. Click to switch to single-day.'
                                : 'Show on each selected day, sync edits across days, and grade/verify it only ONCE for the week'
                            }
                          >
                            <Chip
                              size="small"
                              icon={<Repeat size={11} />}
                              label={
                                row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                  ? `${formatRepeatDaysShortLabel(row.repeatDays)} • Verified Once`
                                  : 'Repeat • Verified Once / Week'
                              }
                              color={
                                row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                  ? 'secondary'
                                  : 'default'
                              }
                              variant={
                                row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                  ? 'filled'
                                  : 'outlined'
                              }
                              onClick={() =>
                                handleSetRepeatCadence(
                                  row,
                                  row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                    ? 'single_day'
                                    : 'weekly_shared'
                                )
                              }
                              sx={{
                                height: 22,
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            />
                          </Tooltip>

                          <Tooltip
                            title={
                              !row.repeatAcrossWeek &&
                              row.repeatCadence === 'daily' &&
                              row.repeatDays &&
                              row.repeatDays.length > 1
                                ? 'Repeats on each selected day, but verified/checked independently EVERY DAY. Click to make it for this day only.'
                                : 'Show on each selected day (e.g. Mon–Thu), with an independent check/verification required EVERY DAY.'
                            }
                          >
                            <Chip
                              size="small"
                              icon={<Calendar size={11} />}
                              label={
                                !row.repeatAcrossWeek &&
                                row.repeatCadence === 'daily' &&
                                row.repeatDays &&
                                row.repeatDays.length > 1
                                  ? `${formatRepeatDaysShortLabel(row.repeatDays)} • Verified Daily`
                                  : 'Repeat • Verified Daily'
                              }
                              color={
                                !row.repeatAcrossWeek &&
                                row.repeatCadence === 'daily' &&
                                row.repeatDays &&
                                row.repeatDays.length > 1
                                  ? 'info'
                                  : 'default'
                              }
                              variant={
                                !row.repeatAcrossWeek &&
                                row.repeatCadence === 'daily' &&
                                row.repeatDays &&
                                row.repeatDays.length > 1
                                  ? 'filled'
                                  : 'outlined'
                              }
                              onClick={() =>
                                handleSetRepeatCadence(
                                  row,
                                  !row.repeatAcrossWeek &&
                                    row.repeatCadence === 'daily' &&
                                    row.repeatDays &&
                                    row.repeatDays.length > 1
                                    ? 'single_day'
                                    : 'daily'
                                )
                              }
                              sx={{
                                height: 22,
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            />
                          </Tooltip>

                          {isInfo && (
                            <Chip
                              size="small"
                              label={
                                row.infoSubType === 'parent_note'
                                  ? 'Parent Note (Purple)'
                                  : 'School Note Bullet'
                              }
                              color={
                                row.infoSubType === 'parent_note'
                                  ? 'secondary'
                                  : 'default'
                              }
                              variant="outlined"
                              onClick={() =>
                                handleUpdateRow(row.id, {
                                  infoSubType:
                                    row.infoSubType === 'parent_note'
                                      ? 'bullet'
                                      : 'parent_note',
                                })
                              }
                              sx={{
                                height: 20,
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            />
                          )}

                          {isGrouped && (
                            <Chip
                              size="small"
                              icon={<Layers size={11} />}
                              color={
                                isGraded
                                  ? 'success'
                                  : isVerified
                                  ? 'info'
                                  : 'default'
                              }
                              label={`Grouped (${subItems.length} lines)`}
                              sx={{
                                height: 20,
                                fontSize: '0.66rem',
                                fontWeight: 700,
                              }}
                            />
                          )}
                        </>
                      )}
                    </Stack>

                    {/* Repeat Day Selector Strip (shown when Weekly Shared OR Daily Repeating is ON) */}
                    {(row.repeatAcrossWeek ||
                      (row.repeatCadence === 'daily' &&
                        row.repeatDays &&
                        row.repeatDays.length > 1)) &&
                      row.infoSubType !== 'divider' && (
                      <Box
                        sx={{
                          ml: 4.5,
                          px: 1.25,
                          py: 0.6,
                          borderRadius: 1,
                          bgcolor: alpha(
                            row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                              ? theme.palette.secondary.main
                              : theme.palette.info.main,
                            0.06
                          ),
                          border: '1px solid',
                          borderColor: alpha(
                            row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                              ? theme.palette.secondary.main
                              : theme.palette.info.main,
                            0.25
                          ),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color={
                              row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                ? 'secondary.main'
                                : 'info.main'
                            }
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                              ? 'Show & Verify Once on Days:'
                              : 'Show & Verify Daily on Days:'}
                          </Typography>
                          {SHORT_DAY_PILLS.map((dp) => {
                            const selected = (row.repeatDays || []).includes(dp.key);
                            return (
                              <Chip
                                key={dp.key}
                                size="small"
                                label={dp.label}
                                color={
                                  selected
                                    ? row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                                      ? 'secondary'
                                      : 'info'
                                    : 'default'
                                }
                                variant={selected ? 'filled' : 'outlined'}
                                onClick={() => handleToggleRepeatWeekday(row, dp.key)}
                                sx={{
                                  height: 20,
                                  minWidth: 28,
                                  fontSize: '0.67rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              />
                            );
                          })}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.68rem' }}
                        >
                          {row.repeatAcrossWeek && row.repeatCadence !== 'daily'
                            ? '↻ 1 Shared Check across week'
                            : '☵ Independent Daily Check each day'}
                        </Typography>
                      </Box>
                    )}

                    {/* Nested Multi-Line Sub-Items List (Evaluated together as part of this parent block!) */}
                    {subItems.length > 0 && (
                      <Box
                        sx={{
                          ml: 4.5,
                          pl: 1.25,
                          py: 0.5,
                          borderLeft: '2px solid',
                          borderColor: isGraded
                            ? alpha(theme.palette.success.main, 0.4)
                            : isVerified
                            ? alpha(theme.palette.info.main, 0.4)
                            : 'divider',
                        }}
                      >
                        <Stack spacing={0.6}>
                          {subItems.map((sub, subIdx) => (
                            <Stack
                              key={sub.id}
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              {!sub.isBullet ? (
                                <Checkbox
                                  size="small"
                                  color={isGraded ? 'success' : 'info'}
                                  checked={sub.checked}
                                  onChange={(e) =>
                                    handleUpdateSubItem(row.id, sub.id, {
                                      checked: e.target.checked,
                                      isBullet: false,
                                    })
                                  }
                                  sx={{ p: 0.25 }}
                                />
                              ) : (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    width: 18,
                                    textAlign: 'center',
                                    fontWeight: 900,
                                    color: 'text.secondary',
                                  }}
                                >
                                  •
                                </Typography>
                              )}

                              <Tooltip
                                title={
                                  sub.isBullet
                                    ? 'Informational bullet (click to switch to checkable box ☐)'
                                    : 'Checkable sub-box (click to switch to informational bullet •)'
                                }
                              >
                                <Chip
                                  size="small"
                                  label={sub.isBullet ? '•' : '☐'}
                                  variant="outlined"
                                  color={sub.isBullet ? 'default' : 'info'}
                                  onClick={() =>
                                    handleUpdateSubItem(row.id, sub.id, {
                                      isBullet: !sub.isBullet,
                                    })
                                  }
                                  sx={{
                                    height: 20,
                                    minWidth: 24,
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    '& .MuiChip-label': { px: 0.5 },
                                  }}
                                />
                              </Tooltip>

                              <TextField
                                fullWidth
                                size="small"
                                inputRef={(el: HTMLInputElement | null) => {
                                  inputRefs.current[sub.id] = el;
                                }}
                                placeholder="Sub-item in this group (press Enter for next sub-line, or paste multiple lines)..."
                                value={sub.text}
                                onChange={(e) =>
                                  handleUpdateSubItem(row.id, sub.id, {
                                    text: e.target.value,
                                  })
                                }
                                onPaste={(e) =>
                                  handlePasteSubItems(
                                    e,
                                    row.id,
                                    subIdx,
                                    row.category === 'info' &&
                                      row.infoSubType !== 'header'
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubItem(row.id, subIdx);
                                  } else if (
                                    e.key === 'Backspace' &&
                                    sub.text === ''
                                  ) {
                                    e.preventDefault();
                                    handleDeleteSubItem(row.id, sub.id);
                                  }
                                }}
                                sx={{
                                  '& .MuiInputBase-input': {
                                    py: 0.4,
                                    px: 0.85,
                                    fontSize: '0.79rem',
                                  },
                                }}
                              />

                              <Tooltip title="Ungroup into its own separate item row">
                                <IconButton
                                  size="small"
                                  onClick={() => handleUngroupSubItem(idx, sub)}
                                  sx={{ p: 0.35 }}
                                >
                                  <Ungroup size={13} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Remove sub-line">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteSubItem(row.id, sub.id)}
                                  sx={{ p: 0.35 }}
                                >
                                  <Trash2 size={13} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Contextual Sub-Controls for 'graded' blocks (Single score for the whole block!) */}
                    {isGraded && (
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ pl: 4.5, pt: 0.25 }}
                      >
                        <TextField
                          select
                          size="small"
                          label="Type"
                          value={row.assignmentCategory || 'homework'}
                          onChange={(e) =>
                            handleUpdateRow(row.id, {
                              assignmentCategory: e.target.value,
                            })
                          }
                          sx={{
                            minWidth: 125,
                            '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                          }}
                        >
                          {assignmentTypes.length > 0 ? (
                            assignmentTypes.map((t) => (
                              <MenuItem key={t.slug} value={t.slug}>
                                {t.name}
                              </MenuItem>
                            ))
                          ) : (
                            <MenuItem value="homework">Homework</MenuItem>
                          )}
                        </TextField>

                        <TextField
                          select
                          size="small"
                          label="Scoring"
                          value={
                            row.scoringMode === 'problems_calculator'
                              ? 'problems_calculator'
                              : 'points'
                          }
                          onChange={(e) =>
                            handleUpdateRow(row.id, {
                              scoringMode: e.target.value as ScoringMode,
                            })
                          }
                          sx={{
                            minWidth: 110,
                            '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                          }}
                        >
                          <MenuItem value="points">Points</MenuItem>
                          <MenuItem value="problems_calculator">Problems</MenuItem>
                        </TextField>

                        {row.scoringMode === 'problems_calculator' ? (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TextField
                              size="small"
                              placeholder="Missed"
                              label="Missed"
                              type="number"
                              value={
                                row.problemsMissed != null
                                  ? String(row.problemsMissed)
                                  : ''
                              }
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  problemsMissed:
                                    e.target.value.trim() !== ''
                                      ? Number(e.target.value)
                                      : null,
                                })
                              }
                              sx={{
                                width: 74,
                                '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              of
                            </Typography>
                            <TextField
                              size="small"
                              placeholder="Total"
                              label="Total"
                              type="number"
                              value={
                                row.totalProblems != null
                                  ? String(row.totalProblems)
                                  : '20'
                              }
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  totalProblems:
                                    e.target.value.trim() !== ''
                                      ? Number(e.target.value)
                                      : 20,
                                })
                              }
                              sx={{
                                width: 68,
                                '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                              }}
                            />
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TextField
                              size="small"
                              placeholder="Score"
                              label="Earned"
                              type="number"
                              value={
                                row.pointsEarned != null
                                  ? String(row.pointsEarned)
                                  : ''
                              }
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  pointsEarned:
                                    e.target.value.trim() !== ''
                                      ? Number(e.target.value)
                                      : null,
                                })
                              }
                              sx={{
                                width: 74,
                                '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              /
                            </Typography>
                            <TextField
                              size="small"
                              placeholder="100"
                              label="Possible"
                              type="number"
                              value={String(row.pointsPossible || 100)}
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  pointsPossible: Number(e.target.value) || 100,
                                })
                              }
                              sx={{
                                width: 68,
                                '& .MuiInputBase-input': { py: 0.45, fontSize: '0.75rem' },
                              }}
                            />
                          </Stack>
                        )}

                        {row.assignmentRecord && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<Edit2 size={12} />}
                            onClick={() => onOpenFullAssignmentModal(row.assignmentRecord!)}
                            sx={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'none',
                            }}
                          >
                            Full Options
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          {/* Quick Add Buttons + Save Bar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
          >
            <Stack direction="row" spacing={0.85} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                color="info"
                startIcon={<Plus size={14} />}
                onClick={() =>
                  handleInsertRowAfter(rows.length - 1, 'verified', 'bullet', false)
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1,
                  textTransform: 'none',
                }}
              >
                + Verified Item
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<Plus size={14} />}
                onClick={() =>
                  handleInsertRowAfter(rows.length - 1, 'graded', 'bullet', false)
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1,
                  textTransform: 'none',
                }}
              >
                + Graded Assignment
              </Button>
              <Tooltip title="Pull in or create a commonly used schedule block (e.g. a 6-week Memory Work set with 6–8 rows underneath the header)">
                <Button
                  size="small"
                  variant={savedBlocksCount > 0 ? 'contained' : 'outlined'}
                  color="primary"
                  startIcon={<Bookmark size={14} />}
                  onClick={() => {
                    setInitialSavedBlockDraft(null);
                    setSavedBlocksModalOpen(true);
                  }}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.73rem',
                    borderRadius: 1,
                    textTransform: 'none',
                    ...(savedBlocksCount > 0
                      ? {
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: 'primary.main',
                          boxShadow: 'none',
                          border: '1px solid',
                          borderColor: alpha(theme.palette.primary.main, 0.4),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.2),
                            boxShadow: 'none',
                          },
                        }
                      : {}),
                  }}
                >
                  {savedBlocksCount > 0
                    ? `+ Saved Block (${savedBlocksCount})`
                    : '+ Saved Block'}
                </Button>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<Layers size={14} />}
                onClick={() =>
                  handleInsertRowAfter(rows.length - 1, 'graded', 'bullet', true)
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1,
                  textTransform: 'none',
                }}
              >
                + Multi-Line Group
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<Heading size={14} />}
                onClick={() =>
                  handleInsertRowAfter(rows.length - 1, 'info', 'header', false)
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1,
                  textTransform: 'none',
                }}
              >
                + Header / Divider
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<Plus size={14} />}
                onClick={() =>
                  handleInsertRowAfter(rows.length - 1, 'info', 'bullet', false)
                }
                sx={{
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1,
                  textTransform: 'none',
                }}
              >
                + Info Note
              </Button>
            </Stack>

            {!hideInlineSaveButton && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Save size={16} />}
                disabled={saving}
                onClick={() => void handleSaveAll()}
                sx={{ fontWeight: 800, borderRadius: 1, textTransform: 'none', px: 2.5 }}
              >
                {saving ? 'Saving...' : 'Save Day Items'}
              </Button>
            )}
          </Stack>
        </Box>

        {/* RIGHT COLUMN: Sticky Realtime Weekly Binder Square Preview */}
        <Box
          sx={{
            width: { xs: '100%', md: 310 },
            flexShrink: 0,
            position: { md: 'sticky' },
            top: 0,
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: 'background.paper',
              borderTop: `3px solid ${subject.color || theme.palette.primary.main}`,
              minHeight: 180,
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={1.25}
              pb={0.75}
              sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Typography
                variant="caption"
                fontWeight={800}
                color="text.secondary"
                sx={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Live Binder Preview
              </Typography>
              <Chip
                size="small"
                label={DAY_LABELS[currentDayKey]}
                variant="outlined"
                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
              />
            </Stack>

            {previewPayloads.length === 0 &&
            previewWeeklyNotePayloads.length === 0 &&
            previewGradedRows.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontStyle: 'italic', display: 'block', py: 3, textAlign: 'center' }}
              >
                Start typing an item on the left to preview how this square will look on the Weekly Binder.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {previewPayloads.map((p, pIdx) => (
                  <FormattedParentNote
                    key={`preview-note-${pIdx}`}
                    title={p.title}
                    description={p.description}
                    color={branding.notes.color}
                    iconName={branding.notes.icon}
                    parentNoteColor={branding.parentNotes.color}
                    parentNoteIconName={branding.parentNotes.icon}
                    interactive={false}
                  />
                ))}
                {previewWeeklyNotePayloads.map((p, pIdx) => (
                  <Box key={`preview-weekly-note-${pIdx}`}>
                    <FormattedParentNote
                      title={p.title}
                      description={p.description}
                      color={branding.notes.color}
                      iconName={branding.notes.icon}
                      parentNoteColor={branding.parentNotes.color}
                      parentNoteIconName={branding.parentNotes.icon}
                      interactive={false}
                    />
                  </Box>
                ))}
                {previewGradedRows.map((gr) => {
                  const grSubItems = (gr.subItems || []).filter(
                    (s) => s.text.trim().length > 0
                  );
                  return (
                    <Box
                      key={`preview-graded-${gr.id}`}
                      sx={{
                        color: 'success.main',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        pt:
                          previewPayloads.length > 0 ||
                          previewWeeklyNotePayloads.length > 0
                            ? 0.5
                            : 0,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Award size={13} />
                        <span style={{ wordBreak: 'break-word' }}>
                          [{(gr.assignmentCategory || 'homework').toUpperCase()}] {gr.text}
                        </span>
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={gr.repeatAcrossWeek ? 'Weekly Graded' : 'Graded'}
                          sx={{
                            height: 18,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            ml: 'auto',
                          }}
                        />
                      </Stack>
                      {grSubItems.length > 0 && (
                        <Box
                          sx={{
                            pl: 2.25,
                            mt: 0.35,
                            fontWeight: 500,
                            fontSize: '0.69rem',
                            color: 'text.primary',
                          }}
                        >
                          {grSubItems.map((sub) => (
                            <Box
                              key={sub.id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.6,
                                lineHeight: 1.35,
                              }}
                            >
                              <Box
                                component="span"
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 10,
                                  height: 10,
                                  border: '1.35px solid currentColor',
                                  borderRadius: '2px',
                                  flexShrink: 0,
                                }}
                              >
                                {sub.checked && (
                                  <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                                    <path
                                      d="M2 5.2L4.1 7.3L8.2 2.7"
                                      stroke="currentColor"
                                      strokeWidth="1.9"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </Box>
                              <span>{sub.text}</span>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>

          {/* Bottom-Right Card: Smart Text & Formatting Quick Reference */}
          <Paper
            variant="outlined"
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.03),
              borderColor: alpha(theme.palette.info.main, 0.25),
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={1}
              pb={0.5}
              sx={{ borderBottom: '1px solid', borderColor: alpha(theme.palette.info.main, 0.2) }}
            >
              <Stack direction="row" spacing={0.6} alignItems="center">
                <HelpCircle size={13} color={theme.palette.info.main} />
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="info.main"
                  sx={{ letterSpacing: '0.03em', textTransform: 'uppercase' }}
                >
                  Editor Shortcuts &amp; Sub-Lines
                </Typography>
              </Stack>
              <Button
                size="small"
                variant="text"
                color="info"
                onClick={() => setFormattingGuideOpen(true)}
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 0,
                  px: 0.75,
                  minWidth: 0,
                }}
              >
                Full Guide →
              </Button>
            </Stack>

            <Stack spacing={0.65} sx={{ fontSize: '0.71rem', color: 'text.secondary' }}>
              <Box sx={{ lineHeight: 1.35 }}>
                <Typography component="span" variant="caption" fontWeight={700} color="text.primary" sx={{ fontSize: '0.71rem' }}>
                  • Trailing colon (<code>:</code>) on Checkboxes:
                </Typography>{' '}
                Renders the checkbox text in <strong>bold</strong> on the binder.
              </Box>
              <Box sx={{ lineHeight: 1.35 }}>
                • <strong><code>Enter</code></strong> inside a main block title inserts a new block directly below it.
              </Box>
              <Box sx={{ lineHeight: 1.35 }}>
                • <strong><code>Shift + Enter</code></strong> (or clicking the <code>+Sub</code> button) adds an indented sub-line under the current block.
              </Box>
              <Box sx={{ lineHeight: 1.35 }}>
                • <strong><code>Backspace</code></strong> on an empty block (with no sub-lines) deletes that row.
              </Box>
              <Box sx={{ lineHeight: 1.35 }}>
                <Typography component="span" variant="caption" fontWeight={700} color="text.primary" sx={{ fontSize: '0.71rem' }}>
                  • Sub-line • / ☐ toggle:
                </Typography>{' '}
                Click the <code>•</code> or <code>☐</code> button on the left of any sub-line to switch it between an informational bullet and a checkable sub-box.
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Stack>

      {/* Formatting & Smart Text Rules Modal */}
      <Dialog
        open={formattingGuideOpen}
        onClose={() => setFormattingGuideOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpCircle size={18} color={theme.palette.info.main} />
            Formatting &amp; Smart Text Rules Guide
          </Box>
          <IconButton
            size="small"
            onClick={() => setFormattingGuideOpen(false)}
            aria-label="Close formatting guide"
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Alert severity="info" variant="outlined" sx={{ py: 0.75 }}>
              The planner automatically formats certain punctuation, prefixes, and keywords so your Weekly Binder and Weekly Grading Summary stay clean and consistent.
            </Alert>

            {/* Section 1: Visual Formatting Triggers */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main" gutterBottom>
                1. Visual Formatting &amp; Punctuation Triggers
              </Typography>
              <Stack spacing={1}>
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Trailing Colon (<code>:</code>) on Verified / Checkbox Items → Bold Text
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Any checkbox item whose text ends with a colon (e.g. <code>Free on-line Videos &amp; Write 3 Fun Facts for each:</code>) automatically renders in <strong>bold</strong> (weight 700) on the binder. Removing the colon renders it in standard weight (500).
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Section Headers (<code>### </code> or Plain Text Ending in <code>:</code> ≤ 48 chars)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Selecting the <strong>Header</strong> role (or typing a plain unprefixed line ending with <code>:</code> up to 48 characters, such as <code>Complete the following:</code>, <code>Fable:</code>, or <code>Grammar:</code>) renders an extra-bold section heading with no bullet or checkbox.
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Horizontal Dividers (<code>---</code> or <code>--- Section Label</code>)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Using a <strong>Header → Divider</strong> block (or typing <code>---</code> in classic text mode) draws a horizontal divider line across the cell with an optional uppercase label.
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Parent Notes vs. School Work Colors (<code>[PARENT_NOTE]</code>)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Switching an <strong>Info</strong> row from <em>School Work Note</em> to <em>Parent Note</em> (or prefixing a line with <code>[PARENT_NOTE]</code>) changes the text color and icon from School Work amber to Parent Note purple.
                  </Typography>
                </Paper>
              </Stack>
            </Box>

            <Divider />

            {/* Section 2: Special Keywords & Grouping Rules */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main" gutterBottom>
                2. Special Keywords &amp; Auto-Grouping Rules
              </Typography>
              <Stack spacing={1}>
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    <code>Memory Work</code> Blocks
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    • Automatically strips any trailing colon (so <code>Memory Work:</code> becomes <code>Memory Work</code> and is not bolded on the binder).<br />
                    • Automatically groups following memory work lines under a single parent block.<br />
                    • When present on 2+ days of the same week, defaults to <strong>Repeat All Week (1x/Wk)</strong> so it shows on each day of the binder but is verified/graded once on the Weekly Grading Summary.
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    <code>Novels</code> Blocks
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    • Automatically groups following novel titles as indented sub-items under <code>Novels</code>.<br />
                    • Defaults to <strong>Repeat All Week</strong> when present on 2+ days of the week.
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    <code>Attend Class</code> as the First Block
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    If the first item in a cell is a <strong>Header</strong> starting with <code>Attend Class</code> (with no sub-items), it is promoted to the cell&apos;s top title banner with the subject icon and extra-bold styling.
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    Duplicate Suppression with Graded Assignments
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    If a cell has both a plain note line and a <strong>Graded Assignment</strong> with the same title (or matching <code>Week X, Class Y</code>, <code>Memory Work</code>, or <code>Week X, TEST</code>), the duplicate note line is automatically hidden on the binder so it only displays once.
                  </Typography>
                </Paper>
              </Stack>
            </Box>

            <Divider />

            {/* Section 3: Keyboard Shortcuts & Multi-Line Sub-Items */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main" gutterBottom>
                3. Editor Shortcuts &amp; Sub-Lines
              </Typography>
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  • <strong><code>Enter</code></strong> inside a main block title inserts a new block directly below it.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • <strong><code>Shift + Enter</code></strong> (or clicking the <code>+Sub</code> button) adds an indented sub-line under the current block.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • <strong><code>Backspace</code></strong> on an empty block (with no sub-lines) deletes that row.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • <strong>Sub-line • / ☐ toggle:</strong> Click the <code>•</code> or <code>☐</code> button on the left of any sub-line to switch it between an informational bullet and a checkable sub-box.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setFormattingGuideOpen(false)}
            sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
          >
            Got It
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge Verification Record Warning Dialog */}
      <Dialog
        open={Boolean(pendingUnverifyRow)}
        onClose={() => setPendingUnverifyRow(null)}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Remove Verification Record?
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning" variant="outlined">
              Un-verifying this item will purge the stored verification record when saved.
            </Alert>
            {pendingUnverifyRow && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.success.main, 0.06),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.success.main, 0.25),
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {pendingUnverifyRow.text || 'Verified Item'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Verified by:</strong>{' '}
                  {pendingUnverifyRow.verifiedBy || getCachedActiveUserName()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Timestamp:</strong>{' '}
                  {pendingUnverifyRow.verifiedAt
                    ? new Date(pendingUnverifyRow.verifiedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Recorded'}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setPendingUnverifyRow(null)}
          >
            Keep Verified
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const target = pendingUnverifyRow;
              setPendingUnverifyRow(null);
              if (target) {
                const updatedSubs = (target.subItems || []).map((s) =>
                  s.isBullet ? s : { ...s, checked: false }
                );
                handleUpdateRow(target.id, {
                  checked: false,
                  verifiedBy: null,
                  verifiedAt: null,
                  subItems: updatedSubs,
                });
              }
            }}
          >
            Purge Verification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block Options Menu */}
      <Menu
        anchorEl={blockMenuAnchorEl}
        open={Boolean(blockMenuAnchorEl && blockMenuRow)}
        onClose={handleCloseBlockMenu}
        sx={{ zIndex: 1500 }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 270,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 6,
              py: 0.5,
            },
          },
        }}
      >
        <Box sx={{ px: 1.5, pt: 0.75, pb: 1 }}>
          <Typography
            variant="caption"
            fontWeight={800}
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              mb: 0.75,
            }}
          >
            Quick Move (This Week)
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {SHORT_DAY_PILLS.map((dp) => {
              const isCurrent = dp.key === currentDayKey;
              const targetIso = getIsoDateForWeekdayInWeek(weekMondayStr, dp.key);
              return (
                <Tooltip
                  key={dp.key}
                  title={
                    isCurrent
                      ? `Already on ${DAY_LABELS[dp.key]}`
                      : `Move to ${DAY_LABELS[dp.key]} (${targetIso})`
                  }
                >
                  <span>
                    <Button
                      size="small"
                      variant={isCurrent ? 'contained' : 'outlined'}
                      disabled={isCurrent || movingBlockBusy}
                      onClick={() => {
                        if (blockMenuRow) {
                          void handleExecuteMoveBlock(blockMenuRow, targetIso);
                        }
                      }}
                      sx={{
                        minWidth: 38,
                        px: 0.75,
                        py: 0.25,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: 1,
                        textTransform: 'none',
                      }}
                    >
                      {dp.label}
                    </Button>
                  </span>
                </Tooltip>
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            if (blockMenuRow) {
              handleOpenMoveBlockDialog(blockMenuRow);
            }
          }}
          sx={{ py: 1, gap: 1.25 }}
        >
          <ArrowRightLeft size={16} color={theme.palette.primary.main} />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
              Move to Another Day or Week…
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Pick any weekday in this week or another week
            </Typography>
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (blockMenuRow) {
              handleOpenSaveRowToLibrary(blockMenuRow);
            }
          }}
          sx={{ py: 1, gap: 1.25 }}
        >
          <Bookmark size={16} color={theme.palette.info.main} />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
              Save to Commonly Used Blocks…
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Save this block &amp; its rows for on-demand insertion (not auto-inserted)
            </Typography>
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (blockMenuRow) {
              handleOpenAddToAutoRulesDialog(blockMenuRow);
            }
          }}
          sx={{ py: 1, gap: 1.25 }}
        >
          <Wand2 size={16} color={theme.palette.secondary.main} />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
              Add to Automation Rules Moving Forward…
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Save block to {subject.name} recurring weekly layout
            </Typography>
          </Box>
        </MenuItem>
      </Menu>

      {/* Move Block to Another Day or Week Dialog */}
      <Dialog
        open={Boolean(moveDialogRow)}
        onClose={() => {
          if (!movingBlockBusy) setMoveDialogRow(null);
        }}
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <ArrowRightLeft size={18} color={theme.palette.primary.main} />
          Move Activity Block
        </DialogTitle>
        <DialogContent dividers>
          {moveDialogRow && (
            <Stack spacing={2}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="primary.main"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Block to Move ({subject.name})
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
                  {moveDialogRow.infoSubType === 'divider'
                    ? '--- (Section Divider)'
                    : moveDialogRow.text || 'Untitled Block'}
                </Typography>
                {moveDialogRow.subItems && moveDialogRow.subItems.length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    +{moveDialogRow.subItems.length} sub-line
                    {moveDialogRow.subItems.length === 1 ? '' : 's'} included
                  </Typography>
                )}
              </Paper>

              <Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75 }}
                >
                  Destination Scope
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={moveMode}
                  onChange={(_, val: 'same_week' | 'other_week' | null) => {
                    if (!val) return;
                    setMoveMode(val);
                    if (val === 'same_week') {
                      setMoveTargetMondayStr(weekMondayStr);
                      if (moveTargetDayKey === currentDayKey) {
                        const fallback =
                          DAY_KEYS.find((d) => d !== currentDayKey) || 'monday';
                        setMoveTargetDayKey(fallback);
                      }
                    } else if (moveTargetMondayStr === weekMondayStr) {
                      setMoveTargetMondayStr(shiftIsoDateByDays(weekMondayStr, 7));
                    }
                  }}
                >
                  <ToggleButton
                    value="same_week"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Different Day in This Week ({formatWeekRangeBadge(weekMondayStr)})
                  </ToggleButton>
                  <ToggleButton
                    value="other_week"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Different Week Altogether
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {moveMode === 'other_week' && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.background.default, 0.6),
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    1. Select Target Week
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mb: 1.5 }}
                  >
                    {[
                      { label: 'Previous Week', delta: -7 },
                      { label: 'Next Week', delta: 7 },
                      { label: '+2 Weeks', delta: 14 },
                      { label: '+3 Weeks', delta: 21 },
                      { label: '+4 Weeks', delta: 28 },
                    ].map((preset) => {
                      const targetMon = shiftIsoDateByDays(
                        weekMondayStr,
                        preset.delta
                      );
                      const isSelected = moveTargetMondayStr === targetMon;
                      return (
                        <Chip
                          key={preset.label}
                          size="small"
                          label={preset.label}
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          onClick={() => setMoveTargetMondayStr(targetMon)}
                          sx={{ fontWeight: 700, cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setMoveTargetMondayStr((prev) =>
                            shiftIsoDateByDays(prev || weekMondayStr, -7)
                          )
                        }
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <ChevronLeft size={16} />
                      </IconButton>
                      <Box sx={{ textAlign: 'center', minWidth: 165 }}>
                        <Typography variant="body2" fontWeight={800}>
                          {formatWeekRangeBadge(
                            moveTargetMondayStr || weekMondayStr
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {moveTargetMondayStr === weekMondayStr
                            ? 'Current Week'
                            : 'Target Week'}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setMoveTargetMondayStr((prev) =>
                            shiftIsoDateByDays(prev || weekMondayStr, 7)
                          )
                        }
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <ChevronRight size={16} />
                      </IconButton>
                    </Stack>

                    <TextField
                      type="date"
                      size="small"
                      label="Or pick any date"
                      value={getIsoDateForWeekdayInWeek(
                        moveTargetMondayStr || weekMondayStr,
                        moveTargetDayKey
                      )}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setMoveTargetMondayStr(getMondayForIsoDate(val));
                        setMoveTargetDayKey(getDayKeyFromIsoDate(val));
                      }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: '100%', sm: 175 } }}
                    />
                  </Stack>
                </Paper>
              )}

              <Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75 }}
                >
                  {moveMode === 'other_week'
                    ? '2. Select Day of the Week'
                    : 'Select Day of the Week'}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {DAY_KEYS.map((dk) => {
                    const effectiveMon =
                      moveMode === 'same_week'
                        ? weekMondayStr
                        : moveTargetMondayStr || weekMondayStr;
                    const dayIso = getIsoDateForWeekdayInWeek(effectiveMon, dk);
                    const isSameAsOrigin = dayIso === dateStr;
                    const isSelected = moveTargetDayKey === dk && !isSameAsOrigin;
                    const shortDate = new Date(
                      `${dayIso}T00:00:00`
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                    return (
                      <Button
                        key={dk}
                        variant={isSelected ? 'contained' : 'outlined'}
                        color={isSelected ? 'primary' : 'inherit'}
                        disabled={isSameAsOrigin}
                        onClick={() => setMoveTargetDayKey(dk)}
                        sx={{
                          flex: '1 1 85px',
                          py: 1,
                          px: 1,
                          borderRadius: 1,
                          textTransform: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.25,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                        }}
                      >
                        <Typography variant="body2" fontWeight={800}>
                          {DAY_LABELS[dk]}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.68rem',
                            opacity: isSelected ? 0.9 : 0.7,
                          }}
                        >
                          {isSameAsOrigin ? `${shortDate} (Current)` : shortDate}
                        </Typography>
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              {(() => {
                const effectiveMon =
                  moveMode === 'same_week'
                    ? weekMondayStr
                    : moveTargetMondayStr || weekMondayStr;
                const destIso = getIsoDateForWeekdayInWeek(
                  effectiveMon,
                  moveTargetDayKey
                );
                const isSame = destIso === dateStr;
                return (
                  <Alert
                    severity={isSame ? 'warning' : 'info'}
                    variant="outlined"
                    sx={{ py: 0.75 }}
                  >
                    {isSame ? (
                      'Please choose a different destination date than the current day.'
                    ) : (
                      <>
                        Moving from{' '}
                        <strong>{formatFullDateDisplay(dateStr)}</strong> to{' '}
                        <strong>{formatFullDateDisplay(destIso)}</strong>.
                      </>
                    )}
                  </Alert>
                );
              })()}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            variant="outlined"
            color="inherit"
            disabled={movingBlockBusy}
            onClick={() => setMoveDialogRow(null)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={
              movingBlockBusy ||
              !moveDialogRow ||
              getIsoDateForWeekdayInWeek(
                moveMode === 'same_week'
                  ? weekMondayStr
                  : moveTargetMondayStr || weekMondayStr,
                moveTargetDayKey
              ) === dateStr
            }
            onClick={() => {
              if (!moveDialogRow) return;
              const effectiveMon =
                moveMode === 'same_week'
                  ? weekMondayStr
                  : moveTargetMondayStr || weekMondayStr;
              const destIso = getIsoDateForWeekdayInWeek(
                effectiveMon,
                moveTargetDayKey
              );
              void handleExecuteMoveBlock(moveDialogRow, destIso);
            }}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
          >
            {movingBlockBusy ? 'Moving Block…' : 'Move Block'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Block to Subject Automation Rules Moving Forward Dialog */}
      <Dialog
        open={Boolean(autoRuleDialogRow)}
        onClose={() => {
          if (!savingAutoRule) setAutoRuleDialogRow(null);
        }}
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Wand2 size={18} color={theme.palette.secondary.main} />
          Add to {subject.name} Automation Rules
        </DialogTitle>
        <DialogContent dividers>
          {autoRuleDialogRow && (
            <Stack spacing={2}>
              <Alert severity="info" variant="outlined" sx={{ py: 0.75 }}>
                This adds the block to <strong>{subject.name}&apos;s</strong>{' '}
                recurring automation layout so future weeks automatically
                include it when populated.
              </Alert>

              {/* 1. Block Role */}
              <Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75 }}
                >
                  Block Role in Automation Layout
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={autoRuleRole}
                  onChange={(_, val: BlockRoleValue | null) => {
                    if (val) setAutoRuleRole(val);
                  }}
                >
                  <ToggleButton
                    value="header"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Header / Divider
                  </ToggleButton>
                  <ToggleButton
                    value="info"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Info Bullet
                  </ToggleButton>
                  <ToggleButton
                    value="verified"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Verified Checkbox
                  </ToggleButton>
                  <ToggleButton
                    value="graded"
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Graded Assignment
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {autoRuleRole === 'header' && (
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    icon={<Heading size={12} />}
                    label="Section Header"
                    color={
                      autoRuleHeaderSubType === 'header' ? 'warning' : 'default'
                    }
                    variant={
                      autoRuleHeaderSubType === 'header' ? 'filled' : 'outlined'
                    }
                    onClick={() => setAutoRuleHeaderSubType('header')}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                  <Chip
                    size="small"
                    icon={<Minus size={12} />}
                    label="Horizontal Divider (---)"
                    color={
                      autoRuleHeaderSubType === 'divider'
                        ? 'warning'
                        : 'default'
                    }
                    variant={
                      autoRuleHeaderSubType === 'divider'
                        ? 'filled'
                        : 'outlined'
                    }
                    onClick={() => setAutoRuleHeaderSubType('divider')}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                </Stack>
              )}

              {/* 2. Template Text + Dynamic Variable Tokens */}
              {!(
                autoRuleRole === 'header' && autoRuleHeaderSubType === 'divider'
              ) && (
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.75 }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      Rule Text / Template Line
                    </Typography>
                    {/\b(Week|Class|Lesson|Day)\s+\d+/i.test(autoRuleText) && (
                      <Button
                        size="small"
                        variant="text"
                        color="secondary"
                        startIcon={<Sparkles size={13} />}
                        onClick={() =>
                          setAutoRuleText((prev) =>
                            convertNumbersToTemplateTokens(prev)
                          )
                        }
                        sx={{
                          py: 0,
                          px: 0.75,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'none',
                        }}
                      >
                        Convert Numbers to Dynamic {'{week}'} / {'{lesson}'}
                      </Button>
                    )}
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    value={autoRuleText}
                    onChange={(e) => setAutoRuleText(e.target.value)}
                    placeholder="e.g., Week {week}, Class {class_num} or Memory Work"
                  />
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 0.75 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.68rem', mr: 0.5 }}
                    >
                      Insert token:
                    </Typography>
                    {[
                      '{week}',
                      '{class_num}',
                      '{lesson}',
                      '{prev_lesson}',
                      '{day}',
                      '{topic}',
                    ].map((tok) => (
                      <Chip
                        key={tok}
                        size="small"
                        label={tok}
                        variant="outlined"
                        onClick={() =>
                          setAutoRuleText((prev) =>
                            prev ? `${prev} ${tok}` : tok
                          )
                        }
                        sx={{
                          height: 20,
                          fontSize: '0.66rem',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Sub-items preview if present */}
              {autoRuleDialogRow.subItems &&
                autoRuleDialogRow.subItems.filter(
                  (s) => s.text.trim().length > 0
                ).length > 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      Included Sub-Lines (
                      {
                        autoRuleDialogRow.subItems.filter(
                          (s) => s.text.trim().length > 0
                        ).length
                      }
                      )
                    </Typography>
                    <Stack spacing={0.35}>
                      {autoRuleDialogRow.subItems
                        .filter((s) => s.text.trim().length > 0)
                        .map((sub) => (
                          <Typography
                            key={sub.id}
                            variant="caption"
                            color="text.primary"
                            sx={{ pl: 1, fontFamily: 'monospace' }}
                          >
                            {sub.isBullet ? '•' : '☐'} {sub.text}
                          </Typography>
                        ))}
                    </Stack>
                  </Paper>
                )}

              {/* 3. Target Days of the Week */}
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.75 }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    Apply to Days of the Week
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      size="small"
                      label={`Only ${DAY_LABELS[currentDayKey]}`}
                      variant="outlined"
                      onClick={() => setAutoRuleDays([currentDayKey])}
                      sx={{ height: 20, fontSize: '0.66rem', cursor: 'pointer' }}
                    />
                    <Chip
                      size="small"
                      label="Mon–Thu"
                      variant="outlined"
                      onClick={() =>
                        setAutoRuleDays([
                          'monday',
                          'tuesday',
                          'wednesday',
                          'thursday',
                        ])
                      }
                      sx={{ height: 20, fontSize: '0.66rem', cursor: 'pointer' }}
                    />
                    <Chip
                      size="small"
                      label="Mon–Fri"
                      variant="outlined"
                      onClick={() => setAutoRuleDays([...DAY_KEYS])}
                      sx={{ height: 20, fontSize: '0.66rem', cursor: 'pointer' }}
                    />
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.75}>
                  {DAY_KEYS.map((dk) => {
                    const selected = autoRuleDays.includes(dk);
                    return (
                      <Button
                        key={dk}
                        size="small"
                        variant={selected ? 'contained' : 'outlined'}
                        color={selected ? 'secondary' : 'inherit'}
                        onClick={() => {
                          setAutoRuleDays((prev) => {
                            if (prev.includes(dk)) {
                              return prev.length > 1
                                ? prev.filter((d) => d !== dk)
                                : prev;
                            }
                            return DAY_KEYS.filter(
                              (d) => d === dk || prev.includes(d)
                            );
                          });
                        }}
                        sx={{
                          flex: 1,
                          py: 0.6,
                          fontWeight: 700,
                          textTransform: 'none',
                          borderRadius: 1,
                        }}
                      >
                        {DAY_LABELS[dk].slice(0, 3)}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              {/* 4. Multi-day Cadence (Daily vs Weekly Shared) */}
              {(autoRuleRole === 'verified' || autoRuleRole === 'graded') &&
                autoRuleDays.length > 1 && (
                  <Box>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.75 }}
                    >
                      Multi-Day Verification / Grading Cadence
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      size="small"
                      value={autoRuleCadence}
                      onChange={(
                        _,
                        val: 'daily' | 'weekly_once' | null
                      ) => {
                        if (val) setAutoRuleCadence(val);
                      }}
                    >
                      <ToggleButton
                        value="daily"
                        sx={{ fontWeight: 700, textTransform: 'none' }}
                      >
                        Verified / Graded Daily (Each Selected Day)
                      </ToggleButton>
                      <ToggleButton
                        value="weekly_once"
                        sx={{ fontWeight: 700, textTransform: 'none' }}
                      >
                        Shared Weekly Goal (Verified / Graded 1x / Week)
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                )}

              {/* 5. Graded Assignment Settings if role === 'graded' */}
              {autoRuleRole === 'graded' && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.success.main, 0.04),
                    borderColor: alpha(theme.palette.success.main, 0.25),
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={800}
                    color="success.dark"
                    sx={{
                      display: 'block',
                      mb: 1,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Recurring Graded Assignment Settings
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                  >
                    <TextField
                      select
                      size="small"
                      label="Category"
                      value={autoRuleAssignCategory}
                      onChange={(e) =>
                        setAutoRuleAssignCategory(e.target.value)
                      }
                      sx={{ flex: 1 }}
                    >
                      {assignmentTypes.map((t) => (
                        <MenuItem key={t.slug} value={t.slug}>
                          {t.name}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Scoring Mode"
                      value={autoRuleScoringMode}
                      onChange={(e) =>
                        setAutoRuleScoringMode(e.target.value as ScoringMode)
                      }
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="points">Points (X / Max)</MenuItem>
                      <MenuItem value="problems_calculator">Problems Missed</MenuItem>
                    </TextField>

                    {autoRuleScoringMode === 'problems_calculator' ? (
                      <TextField
                        type="number"
                        size="small"
                        label="Total Problems"
                        value={autoRuleTotalProblems}
                        onChange={(e) =>
                          setAutoRuleTotalProblems(
                            Math.max(1, Number(e.target.value) || 20)
                          )
                        }
                        sx={{ width: { xs: '100%', sm: 130 } }}
                      />
                    ) : (
                      <TextField
                        type="number"
                        size="small"
                        label="Max Points"
                        value={autoRulePointsPossible}
                        onChange={(e) =>
                          setAutoRulePointsPossible(
                            Math.max(1, Number(e.target.value) || 100)
                          )
                        }
                        sx={{ width: { xs: '100%', sm: 120 } }}
                      />
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            variant="outlined"
            color="inherit"
            disabled={savingAutoRule}
            onClick={() => setAutoRuleDialogRow(null)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={savingAutoRule}
            onClick={() => void handleExecuteAddToAutomationRules()}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
          >
            {savingAutoRule
              ? 'Saving Automation Rule…'
              : 'Add to Automation Rules'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Saved / Commonly Used Schedule Blocks Library & Builder Modal */}
      <SavedScheduleBlocksModal
        open={savedBlocksModalOpen}
        onClose={() => {
          setSavedBlocksModalOpen(false);
          setInitialSavedBlockDraft(null);
        }}
        subject={subject}
        currentDayKey={currentDayKey}
        defaultRepeatDays={defaultSubjectRepeatDays}
        assignmentTypes={assignmentTypes}
        onInsertBlock={(block, options) => {
          handleInsertSavedBlock(block, options);
        }}
        onSavedBlocksUpdated={(_, updatedBlocks) => {
          setSavedBlocksCount(updatedBlocks.length);
          if (onSilentRefresh) {
            skipNextPropsResetRef.current = true;
            void onSilentRefresh();
          }
        }}
        initialDraftBlock={initialSavedBlockDraft}
      />
    </Box>
  );
}
