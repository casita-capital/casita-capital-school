'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
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
  ArrowUpLeft,
  Award,
  CornerDownRight,
  Edit2,
  GripVertical,
  Heading,
  Layers,
  Minus,
  Plus,
  Repeat,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Ungroup,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { getCachedActiveUserName } from 'src/utils/active-user';
import {
  AssignmentTypeConfig,
  computeAssignmentMetrics,
  GradebookAssignment,
  parseSubjectGradingPolicy,
  ScoringMode,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import { DAY_KEYS, DAY_LABELS, DayKey } from 'src/utils/recurring-planner';
import {
  formatRepeatDaysShortLabel,
  formatSubItemsForAssignmentInstructions,
  getDayKeyFromIsoDate,
  getIsoDateForWeekdayInWeek,
  getMondayForIsoDate,
  InfoSubType,
  normalizeWeeklyBlockKey,
  parseCellNotesAndAssignmentsToItems,
  PlannerParentNoteRecord,
  serializeCellItemsToNotesPayload,
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

export function UnifiedCellItemsEditor({
  subject,
  dateStr,
  notes,
  assignments,
  assignmentTypes,
  branding,
  onSaved,
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
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  // Re-initialize rows whenever subject, dateStr, notes, or assignments change
  useEffect(() => {
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
          .filter((r) => r.repeatAcrossWeek && r.weeklyGroupKey)
          .map((r) => r.weeklyGroupKey)
      );
    }
    setRemovedAssignmentIds([]);
    setIsDirty(false);
  }, [subject, dateStr, notes, assignments]);

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
        repeatDays: DAY_KEYS.filter((d) => nextDays.includes(d)),
        weeklyGroupKey:
          row.weeklyGroupKey || normalizeWeeklyBlockKey(row.text || row.id),
      });
    } else {
      handleUpdateRow(row.id, {
        repeatAcrossWeek: false,
        repeatDays: [currentDayKey],
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
        repeatDays: [currentDayKey],
      });
      return;
    }
    handleUpdateRow(row.id, {
      repeatAcrossWeek: true,
      repeatDays: DAY_KEYS.filter((d) => nextDays.includes(d)),
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

        const isDone = r.checked || metrics.percentage_score !== null;
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
              completed_at: isDone ? nowIso : null,
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
            completed_at: isDone ? nowIso : null,
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

      // 4. Auto-propagate any `repeatAcrossWeek` blocks (or previously weekly-shared blocks) to the remaining days of this week!
      const activeSharedRows = rows.filter(
        (r) => r.repeatAcrossWeek && r.text.trim().length > 0
      );
      const hasWeeklySyncWork =
        activeSharedRows.length > 0 || initialWeeklyKeys.length > 0;

      let syncedDaysCount = 0;
      if (hasWeeklySyncWork) {
        const currentSharedKeyMap = new Map<string, StructuredCellLineItem>();
        for (const sr of activeSharedRows) {
          const k = sr.weeklyGroupKey || normalizeWeeklyBlockKey(sr.text.trim());
          currentSharedKeyMap.set(k, {
            ...sr,
            weeklyGroupKey: k,
          });
        }

        // Keys that were weekly-shared when the modal opened OR are now weekly-shared
        const allTrackedKeys = new Set<string>([
          ...initialWeeklyKeys,
          ...Array.from(currentSharedKeyMap.keys()),
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

          // Keep only note-backed items (or weekly shared items) when rebuilding otherDateStr's parent_notes
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
              const updatedShared = currentSharedKeyMap.get(itemKey);
              if (
                updatedShared &&
                updatedShared.repeatAcrossWeek &&
                updatedShared.repeatDays.includes(otherDayKey)
              ) {
                // Replace in-place with the updated block from the edited day!
                nextOtherItems.push({
                  ...existingItem,
                  category: updatedShared.category,
                  text: updatedShared.text,
                  infoSubType: updatedShared.infoSubType,
                  checked: updatedShared.checked,
                  subItems: updatedShared.subItems.map((s) => ({ ...s })),
                  repeatAcrossWeek: true,
                  repeatDays: updatedShared.repeatDays,
                  weeklyGroupKey: itemKey,
                });
                handledKeysOnOtherDay.add(itemKey);
                modifiedOtherDay = true;
              } else {
                // This day was unchecked from repeatDays or the shared block was removed/switched to single-day
                modifiedOtherDay = true;
              }
            } else {
              nextOtherItems.push(existingItem);
            }
          }

          // Append any newly shared block that targets `otherDayKey` and wasn't already on `otherDateStr`
          for (const [k, sharedRow] of currentSharedKeyMap.entries()) {
            if (
              !handledKeysOnOtherDay.has(k) &&
              sharedRow.repeatDays.includes(otherDayKey)
            ) {
              nextOtherItems.push({
                ...sharedRow,
                id: `synced-${otherDayKey}-${k}`,
                dateStr: otherDateStr,
                dayKey: otherDayKey,
                weekdayLabel: DAY_LABELS[otherDayKey],
                subItems: sharedRow.subItems.map((s) => ({ ...s })),
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
                            const updatedSubs = (row.subItems || []).map((s) =>
                              s.isBullet ? s : { ...s, checked: nextChecked }
                            );
                            handleUpdateRow(row.id, {
                              checked: nextChecked,
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
                          if (nextRole === 'header') {
                            handleUpdateRow(row.id, {
                              category: 'info',
                              infoSubType:
                                row.infoSubType === 'divider' ? 'divider' : 'header',
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
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: false,
                              })),
                            });
                          } else if (nextRole === 'graded') {
                            handleUpdateRow(row.id, {
                              category: 'graded',
                              infoSubType: 'bullet',
                              subItems: (row.subItems || []).map((s) => ({
                                ...s,
                                isBullet: false,
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
                      {isHeaderOrDivider ? (
                        <>
                          <Chip
                            size="small"
                            icon={<Heading size={12} />}
                            label="Section Header (e.g. Complete the following:)"
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
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.68rem', ml: 0.5 }}
                          >
                            Clarifies binder layout • Not graded
                          </Typography>
                        </>
                      ) : (
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

                          {idx > 0 && (
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

                          {/* 1-Click Toggle to Repeat Across Week (1 Weekly Grade/Check) */}
                          <Tooltip
                            title={
                              row.repeatAcrossWeek
                                ? 'This block is shared across the selected days of this week and evaluated once on the Weekly Grading Summary. Click to make it for this day only.'
                                : 'Show this block on each selected day of the week on the binder, sync edits across days, and grade/verify it only ONCE for the week'
                            }
                          >
                            <Chip
                              size="small"
                              icon={<Repeat size={11} />}
                              label={
                                row.repeatAcrossWeek
                                  ? `${formatRepeatDaysShortLabel(row.repeatDays)} • Graded/Verified Once`
                                  : 'Repeat All Week (1 Weekly Check/Grade)'
                              }
                              color={row.repeatAcrossWeek ? 'secondary' : 'default'}
                              variant={row.repeatAcrossWeek ? 'filled' : 'outlined'}
                              onClick={() => handleToggleRepeatAcrossWeek(row)}
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

                    {/* Weekly Repeat Day Selector Strip (shown when Repeat Across Week is ON) */}
                    {row.repeatAcrossWeek && !isHeaderOrDivider && (
                      <Box
                        sx={{
                          ml: 4.5,
                          px: 1.25,
                          py: 0.6,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.secondary.main, 0.06),
                          border: '1px solid',
                          borderColor: alpha(theme.palette.secondary.main, 0.25),
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
                            color="secondary.main"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            Show on Days:
                          </Typography>
                          {SHORT_DAY_PILLS.map((dp) => {
                            const selected = (row.repeatDays || []).includes(dp.key);
                            return (
                              <Chip
                                key={dp.key}
                                size="small"
                                label={dp.label}
                                color={selected ? 'secondary' : 'default'}
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
                          Edits auto-sync to selected days • Shown once on Weekly Grading Summary
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
                              {isVerified || isGraded ? (
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

                              <TextField
                                fullWidth
                                size="small"
                                inputRef={(el: HTMLInputElement | null) => {
                                  inputRefs.current[sub.id] = el;
                                }}
                                placeholder="Sub-item in this group (press Enter for next sub-line)..."
                                value={sub.text}
                                onChange={(e) =>
                                  handleUpdateSubItem(row.id, sub.id, {
                                    text: e.target.value,
                                  })
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
        </Box>
      </Stack>
    </Box>
  );
}
