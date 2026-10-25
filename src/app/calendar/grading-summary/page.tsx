'use client';

import React, { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Award,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Info,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RouterLink } from 'src/components/base/router-link';
import { stripVerifiedMetaMarker } from 'src/components/base/formatted-parent-note';
import {
  ApiGradeOverrideWarningModal,
  UnifiedAssignmentModal,
  UnifiedAssignmentModalInitialValues,
} from 'src/components/assignments/unified-assignment-modal';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { getCachedActiveUserName, resolveAndSyncActiveUser } from 'src/utils/active-user';
import {
  AssignmentTypeConfig,
  computeAssignmentMetrics,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  GradebookAssignment,
  isAssignmentApiSynced,
  isAssignmentCompletedOrSubmitted,
  isAssignmentScored,
  isSubjectApiSynced,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  ScoringMode,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  getActiveCourseSyllabus,
  getOfficialCourseSubtitle,
  parseRecurringConfig,
  parseSubjectOverrides,
  resolveSubjectCountersForWeek,
  resolveSyllabusDaySupplies,
  WeeklySubjectOverrides,
} from 'src/utils/recurring-planner';
import {
  consolidateSection1WeeklyItems,
  formatSubItemsForAssignmentInstructions,
  getDayKeyFromIsoDate,
  getIsoDateForWeekdayInWeek,
  getWeekdayLabelFromIsoDate,
  normalizeAssessmentTitleForDedup,
  parseCellNotesAndAssignmentsToItems,
  PlannerParentNoteRecord,
  StructuredCellLineItem,
  WeeklyItemCategory,
} from 'src/utils/weekly-grading-items';

type SummaryFilterMode = 'all' | 'needs_action' | 'graded' | 'verified' | 'external';
type SummaryGroupByMode = 'subject' | 'day' | 'none';

interface ExternalDueThisWeekItem {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  courseSubtitle: string | null;
  providerName: string;
  categoryLabel: string;
  weekNumber: number | null;
  classNumber?: number | null;
  classTopic?: string | null;
  weekdayLabel?: string | null;
  supplies?: string[];
  openDate: string | null;
  dueDate: string;
  isScored: boolean;
  isCompleted: boolean;
  isSubmitted: boolean;
  scoreDisplay: string | null;
  statusLabel:
    | 'Graded'
    | 'Submitted · Awaiting Grade'
    | 'Completed · Awaiting Grade'
    | 'Completed'
    | 'Due This Week';
  assignmentRecord?: GradebookAssignment;
}

interface InlineGradeDraft {
  mode: ScoringMode;
  pointsEarned: string;
  pointsPossible: string;
  problemsMissed: string;
  totalProblems: string;
  saving?: boolean;
}

function formatIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Roll forward to the upcoming Monday starting on Saturday (day === 6 -> +2, day === 0 -> +1)
  const diff = day === 6 ? 2 : day === 0 ? 1 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return formatIsoDate(monday);
}

function getMondayForDateStr(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return getCurrentWeekMonday();
  }
  const day = parsed.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Roll forward to the upcoming Monday starting on Saturday (day === 6 -> +2, day === 0 -> +1)
  const diff = day === 6 ? 2 : day === 0 ? 1 : 1 - day;
  const monday = new Date(parsed);
  monday.setDate(parsed.getDate() + diff);
  return formatIsoDate(monday);
}

function formatHumanDate(isoStr: string | null | undefined, includeWeekday = true): string {
  if (!isoStr) return '—';
  const d = new Date(`${isoStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString(
    'en-US',
    includeWeekday
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' }
  );
}

function getUserInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'PU';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function formatVerifiedTimeShort(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function WeeklyGradingSummaryContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const weekParam = searchParams.get('week');
  const initialWeek = weekParam ? getMondayForDateStr(weekParam) : getCurrentWeekMonday();
  const [weekStartDate, setWeekStartDate] = useState<string>(initialWeek);

  useEffect(() => {
    const targetWeek = weekParam ? getMondayForDateStr(weekParam) : getCurrentWeekMonday();
    setWeekStartDate((prev) => (prev !== targetWeek ? targetWeek : prev));
  }, [weekParam]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithGrading[]>([]);
  const [parentNotes, setParentNotes] = useState<PlannerParentNoteRecord[]>([]);
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([]);
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeConfig[]>(
    DEFAULT_ASSIGNMENT_TYPES
  );
  const [subjectOverrides, setSubjectOverrides] = useState<WeeklySubjectOverrides>({});

  // Filter & Grouping Controls for Section 1
  const [filterMode, setFilterMode] = useState<SummaryFilterMode>('all');
  const [groupByMode, setGroupByMode] = useState<SummaryGroupByMode>('subject');

  // Inline Score Drafts keyed by assignment ID
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, InlineGradeDraft>>({});

  // Unified Assignment Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<GradebookAssignment | null>(null);
  const [modalInitialValues, setModalInitialValues] = useState<
    UnifiedAssignmentModalInitialValues | undefined
  >(undefined);
  const [apiWarningAssignment, setApiWarningAssignment] = useState<GradebookAssignment | null>(
    null
  );

  // Compute Monday–Sunday dates for the selected week
  const { mondayStr, fridayStr, sundayStr, weekDates, weekRangeLabel } = useMemo(() => {
    const mon = new Date(`${weekStartDate}T00:00:00`);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const days: Array<{
      dateStr: string;
      dayKey: DayKey;
      dayLabel: string;
      shortDate: string;
    }> = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const ds = formatIsoDate(d);
      const dk = DAY_KEYS[i];
      days.push({
        dateStr: ds,
        dayKey: dk,
        dayLabel: DAY_LABELS[dk],
        shortDate: `${d.getMonth() + 1}/${d.getDate()}`,
      });
    }

    const monStr = mon.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const friStr = fri.toLocaleDateString('en-US', {
      month: mon.getMonth() === fri.getMonth() ? undefined : 'short',
      day: 'numeric',
    });
    const label = `${monStr} – ${friStr}, ${fri.getFullYear()}`;

    return {
      mondayStr: formatIsoDate(mon),
      fridayStr: formatIsoDate(fri),
      sundayStr: formatIsoDate(sun),
      weekDates: days,
      weekRangeLabel: label,
    };
  }, [weekStartDate]);

  const loadSummaryData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      void resolveAndSyncActiveUser(supabase);
      const [subRes, notesRes, assignRes, typesRes, settingsRes] = await Promise.all([
        supabase.schema('school').from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase
          .schema('school')
          .from('parent_notes')
          .select('*')
          .gte('note_date', mondayStr)
          .lte('note_date', sundayStr)
          .order('note_date', { ascending: true }),
        supabase
          .schema('school')
          .from('assignments')
          .select('*')
          .order('due_date', { ascending: true }),
        supabase
          .schema('school')
          .from('assignment_types')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .schema('school')
          .from('weekly_planner_settings')
          .select('subject_overrides')
          .eq('week_start_date', mondayStr)
          .maybeSingle(),
      ]);

      if (subRes.error) throw new Error(subRes.error.message);
      if (notesRes.error) throw new Error(notesRes.error.message);
      if (assignRes.error) throw new Error(assignRes.error.message);

      const loadedSubjects = (subRes.data || []) as SubjectWithGrading[];
      setSubjects(loadedSubjects);
      setParentNotes((notesRes.data || []) as PlannerParentNoteRecord[]);

      const loadedAssignments = (assignRes.data || []) as GradebookAssignment[];
      setAssignments(loadedAssignments);

      if (typesRes.data && typesRes.data.length > 0) {
        setAssignmentTypes(typesRes.data as AssignmentTypeConfig[]);
      }

      if (settingsRes.data?.subject_overrides) {
        setSubjectOverrides(parseSubjectOverrides(settingsRes.data.subject_overrides));
      } else {
        setSubjectOverrides({});
      }

      // Initialize inline grade drafts for assignments due this week
      const drafts: Record<string, InlineGradeDraft> = {};
      for (const a of loadedAssignments) {
        if (a.due_date >= mondayStr && a.due_date <= sundayStr) {
          drafts[a.id] = {
            mode: a.grading_mode || 'points',
            pointsEarned: a.points_earned != null ? String(a.points_earned) : '',
            pointsPossible: a.points_possible != null ? String(a.points_possible) : '100',
            problemsMissed: a.missed_problems != null ? String(a.missed_problems) : '',
            totalProblems: a.total_problems != null ? String(a.total_problems) : '20',
          };
        }
      }
      setInlineDrafts(drafts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load weekly grading summary');
    } finally {
      setLoading(false);
    }
  }, [supabase, mondayStr, sundayStr]);

  useEffect(() => {
    void loadSummaryData();
  }, [loadSummaryData]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectWithGrading>();
    for (const s of subjects) map.set(s.id, s);
    return map;
  }, [subjects]);

  const typeMap = useMemo(() => {
    const map = new Map<string, AssignmentTypeConfig>();
    for (const t of assignmentTypes) map.set(t.slug, t);
    return map;
  }, [assignmentTypes]);

  // Navigate weeks
  const handleSelectWeek = (targetMon: string) => {
    setWeekStartDate(targetMon);
    router.replace(`/calendar/grading-summary?week=${targetMon}`);
  };

  const handleStepWeek = (deltaDays: number) => {
    const d = new Date(`${weekStartDate}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    handleSelectWeek(formatIsoDate(d));
  };

  // Identify which subjects are External Providers
  const externalSubjectIds = useMemo(() => {
    const set = new Set<string>();
    for (const sub of subjects) {
      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
      const isExternal =
        cfg.instructor_info?.provider_type === 'external' ||
        isSubjectApiSynced(sub) ||
        cfg.course_syllabus?.source_type === 'api_sync';
      if (isExternal) {
        set.add(sub.id);
      }
    }
    return set;
  }, [subjects]);

  // Build External Course Assignments & Activities Strictly Due This Week (integrated into the unified table)
  const externalDueThisWeekItems = useMemo(() => {
    const items: ExternalDueThisWeekItem[] = [];
    const seenKeys = new Set<string>();

    const addDaysToIso = (baseIso: string, offsetDays: number): string => {
      const d = new Date(`${baseIso}T00:00:00`);
      d.setDate(d.getDate() + offsetDays);
      return formatIsoDate(d);
    };

    const getWeekdayLabelFromDate = (dateStr: string): string | null => {
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    };

    for (const sub of subjects) {
      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
      const activeSyl = getActiveCourseSyllabus(cfg);
      const hasSyllabusActivities = Boolean(
        activeSyl?.days?.some((d) => Boolean(d.activity))
      );
      const isExternal = externalSubjectIds.has(sub.id);

      const subAssignments = assignments.filter(
        (a) =>
          a.subject_id === sub.id &&
          a.workflow_status !== 'staged' &&
          a.workflow_status !== 'ignored'
      );
      const hasActivityAssignments = subAssignments.some((a) => a.category === 'activity');

      if (!isExternal && !hasSyllabusActivities && !hasActivityAssignments) continue;

      const policy = parseSubjectGradingPolicy(sub);
      const override = subjectOverrides[sub.id];
      const counters = resolveSubjectCountersForWeek(cfg, mondayStr, override);
      const currentWeekNum = counters.week_num;
      const courseSubtitle = getOfficialCourseSubtitle(cfg);
      const providerName =
        cfg.instructor_info?.outside_entity_name ||
        (isSubjectApiSynced(sub)
          ? 'Memoria Academy'
          : sub.name.toLowerCase().includes('science')
          ? 'Science Shepherd'
          : cfg.instructor_info?.teacher_name || 'Syllabus Activity');

      const classDayByNumber = new Map<
        number,
        { dayKey: DayKey; dueDate: string; weekdayLabel: string }
      >();
      if (cfg.mode === 'template' && activeSyl?.days?.length) {
        let runningCls = counters.class_num;
        DAY_KEYS.forEach((dk, idx) => {
          const dayCfg = cfg.days[dk];
          if (dayCfg?.enabled && dayCfg.template.includes('{class_num}')) {
            classDayByNumber.set(runningCls, {
              dayKey: dk,
              dueDate: addDaysToIso(mondayStr, idx),
              weekdayLabel: DAY_LABELS[dk],
            });
            runningCls += 1;
          }
        });
      }

      // Track all CMIDs and normalized titles that already exist in school.assignments for this subject
      // (even if their scheduled due_date in school.assignments was moved to another day/week)
      const existingSubjectCmids = new Set<number>();
      const existingSubjectNormTitles = new Set<string>();
      for (const existingAssign of subAssignments) {
        const exMm = parseAssignmentMoodleMeta(existingAssign.state_standards);
        if (typeof exMm?.moodle_cmid === 'number') {
          existingSubjectCmids.add(exMm.moodle_cmid);
        }
        existingSubjectNormTitles.add(
          normalizeAssessmentTitleForDedup(existingAssign.title)
        );
      }

      for (const a of subAssignments) {
        const isActivityItem = a.category === 'activity';
        if (!isExternal && !isActivityItem && !isAssignmentApiSynced(a, sub)) continue;

        // Strictly only items due this particular week!
        const dueInWeek = a.due_date >= mondayStr && a.due_date <= sundayStr;
        if (!dueInWeek) continue;

        const normTitle = normalizeAssessmentTitleForDedup(a.title);
        const key = `${sub.id}::${normTitle}::${a.due_date}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const mm = parseAssignmentMoodleMeta(a.state_standards);
        const typeInfo = typeMap.get(a.category);
        const hasScore = isAssignmentScored(a);
        const isCompleted = isAssignmentCompletedOrSubmitted(a, mm);
        const isSubmitted =
          a.workflow_status === 'submitted' || Boolean(mm?.api_submitted_at);
        const scoreDisplay =
          typeof a.percentage_score === 'number'
            ? formatClassGradeDisplay(a.percentage_score, a.letter_grade || '', policy)
            : typeof a.points_earned === 'number'
            ? `${a.points_earned}/${a.points_possible ?? 100}`
            : null;

        const statusLabel: ExternalDueThisWeekItem['statusLabel'] = hasScore
          ? 'Graded'
          : isCompleted
          ? a.is_graded === false || isActivityItem
            ? 'Completed'
            : isSubmitted
            ? 'Submitted · Awaiting Grade'
            : 'Completed · Awaiting Grade'
          : 'Due This Week';

        const resolvedClassNum =
          mm?.class_number ??
          (isActivityItem ? a.syllabus_day_number : null) ??
          null;
        const matchedSylDay =
          resolvedClassNum !== null
            ? activeSyl?.days.find((d) => d.day_number === resolvedClassNum)
            : activeSyl?.days.find(
                (d) =>
                  d.activity &&
                  a.title.toLowerCase().includes(d.activity.toLowerCase())
              );

        const supplies =
          mm?.supplies && mm.supplies.length > 0
            ? mm.supplies
            : matchedSylDay
            ? resolveSyllabusDaySupplies(matchedSylDay)
            : [];

        items.push({
          id: a.id,
          title: a.title,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color,
          courseSubtitle,
          providerName,
          categoryLabel:
            isActivityItem
              ? 'Activity'
              : mm?.moodle_category || typeInfo?.name || a.category,
          weekNumber:
            mm?.week_number ??
            matchedSylDay?.week_number ??
            (isActivityItem ? currentWeekNum : a.syllabus_day_number ?? currentWeekNum),
          classNumber: resolvedClassNum ?? matchedSylDay?.day_number ?? null,
          classTopic: mm?.class_topic ?? matchedSylDay?.topic ?? null,
          weekdayLabel:
            (mm?.weekday ? DAY_LABELS[mm.weekday] : null) ||
            getWeekdayLabelFromDate(a.due_date),
          supplies: supplies.length > 0 ? supplies : undefined,
          openDate: a.assigned_date || mm?.official_portal_open_date || null,
          dueDate: a.due_date,
          isScored: hasScore,
          isCompleted,
          isSubmitted,
          scoreDisplay,
          statusLabel,
          assignmentRecord: a,
        });
      }

      // Include any syllabus Activities scheduled on this week's classes
      if (hasSyllabusActivities && activeSyl?.days) {
        for (const [clsNum, schedInfo] of classDayByNumber.entries()) {
          if (schedInfo.dueDate < mondayStr || schedInfo.dueDate > sundayStr) continue;
          const sylDay = activeSyl.days.find((d) => d.day_number === clsNum);
          if (!sylDay || !sylDay.activity) continue;

          const actTitle = `Activity: ${sylDay.activity}`;
          const normActTitle = normalizeAssessmentTitleForDedup(actTitle);
          const key = `${sub.id}::${normActTitle}::${schedInfo.dueDate}`;
          if (seenKeys.has(key) || existingSubjectNormTitles.has(normActTitle)) continue;
          seenKeys.add(key);

          const supplies = resolveSyllabusDaySupplies(sylDay);
          items.push({
            id: `syl-act-${sub.id}-${sylDay.day_number}`,
            title: actTitle,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            courseSubtitle,
            providerName,
            categoryLabel: 'Activity',
            weekNumber: sylDay.week_number ?? currentWeekNum,
            classNumber: sylDay.day_number,
            classTopic: sylDay.topic,
            weekdayLabel: schedInfo.weekdayLabel,
            supplies: supplies.length > 0 ? supplies : undefined,
            openDate: mondayStr,
            dueDate: schedInfo.dueDate,
            isScored: false,
            isCompleted: false,
            isSubmitted: false,
            scoreDisplay: null,
            statusLabel: 'Due This Week',
          });
        }
      }

      // Also check API syllabus weeks for any linked assessments strictly due this week that aren't already in school.assignments
      const allApiWeeks = cfg.course_syllabus?.weeks || [];
      for (const apiWeek of allApiWeeks) {
        for (const assess of apiWeek.linked_assessments) {
          if (!assess.due_date) continue;
          if (assess.due_date < mondayStr || assess.due_date > sundayStr) continue;

          const cleanTitle = assess.name
            .replace(/--DUE[\s\S]*$/i, '')
            .replace(/^LC 4th Edition\s+/i, '')
            .trim();
          const normTitle = normalizeAssessmentTitleForDedup(cleanTitle);

          // Skip if this assessment already exists in school.assignments by CMID or normalized title
          if (
            (typeof assess.cmid === 'number' && existingSubjectCmids.has(assess.cmid)) ||
            existingSubjectNormTitles.has(normTitle)
          ) {
            continue;
          }

          const key = `${sub.id}::${normTitle}::${assess.due_date}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const hasScore =
            typeof assess.grade_raw === 'number' && !Number.isNaN(assess.grade_raw);
          const isSubmitted = assess.status_label === 'submitted';
          const isCompleted = hasScore || isSubmitted;
          const pct =
            hasScore && assess.grade_max > 0 && assess.grade_raw !== null
              ? Number(((assess.grade_raw / assess.grade_max) * 100).toFixed(1))
              : null;

          items.push({
            id: `api-${sub.id}-${assess.cmid}`,
            title: cleanTitle,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            courseSubtitle,
            providerName,
            categoryLabel: assess.moodle_category || 'Quiz / Assessment',
            weekNumber: apiWeek.week_number,
            openDate: assess.open_date,
            dueDate: assess.due_date,
            weekdayLabel: getWeekdayLabelFromDate(assess.due_date),
            isScored: hasScore,
            isCompleted,
            isSubmitted,
            scoreDisplay: pct !== null ? `${pct}%` : null,
            statusLabel: hasScore
              ? 'Graded'
              : isSubmitted
              ? 'Submitted · Awaiting Grade'
              : 'Due This Week',
          });
        }
      }
    }

    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [subjects, externalSubjectIds, assignments, subjectOverrides, mondayStr, sundayStr, typeMap]);

  const supplyItemsDueThisWeek = useMemo(
    () => externalDueThisWeekItems.filter((it) => it.supplies && it.supplies.length > 0),
    [externalDueThisWeekItems]
  );

  // Build Unified Weekly Items: Internal Graded + Parent-Verified + External Course Assignments & Activities Due This Week
  const section1Items = useMemo(() => {
    const allItems: StructuredCellLineItem[] = [];

    for (const sub of subjects) {
      const isExtSub = externalSubjectIds.has(sub.id);
      const subNotes = parentNotes.filter((n) => n.subject_id === sub.id);
      const subAssignsDueThisWeek = assignments.filter(
        (a) =>
          a.subject_id === sub.id &&
          a.due_date >= mondayStr &&
          a.due_date <= sundayStr &&
          a.workflow_status !== 'staged' &&
          a.workflow_status !== 'ignored'
      );

      // Group by unique dates present in notes or assignments
      const datesSet = new Set<string>();
      for (const wd of weekDates) datesSet.add(wd.dateStr);
      for (const n of subNotes) datesSet.add(n.note_date);
      for (const a of subAssignsDueThisWeek) datesSet.add(a.due_date);

      const sortedDates = Array.from(datesSet).sort();

      for (const dStr of sortedDates) {
        const dayNotes = subNotes.filter((n) => n.note_date === dStr);
        // External course assignments & syllabus lab activities are merged below from externalDueThisWeekItems with full provider/class/supply metadata
        const dayAssigns = subAssignsDueThisWeek.filter((a) => {
          if (a.due_date !== dStr) return false;
          if (isExtSub || a.category === 'activity' || isAssignmentApiSynced(a, sub)) {
            return false;
          }
          return true;
        });

        const parsed = parseCellNotesAndAssignmentsToItems({
          subjectId: sub.id,
          dateStr: dStr,
          notes: dayNotes,
          assignments: dayAssigns,
          subject: sub,
          allWeekNotesForSubject: subNotes,
          allWeekAssignmentsForSubject: subAssignsDueThisWeek,
        });

        // Only include 'graded' and 'verified' items on the Weekly Grading Summary
        for (const item of parsed) {
          if (item.category === 'graded' || item.category === 'verified') {
            allItems.push(item);
          }
        }
      }
    }

    const consolidatedInternal = consolidateSection1WeeklyItems(allItems);

    // Convert externalDueThisWeekItems into StructuredCellLineItem rows and append to the unified list
    const externalMapped: StructuredCellLineItem[] = externalDueThisWeekItems.map((ext) => {
      const a = ext.assignmentRecord;
      const sub = subjectMap.get(ext.subjectId);
      const isActivity = ext.categoryLabel.toLowerCase() === 'activity';
      const isCompletionOnly =
        isActivity || a?.is_graded === false || a?.grading_mode === 'completion';
      const category: WeeklyItemCategory = isCompletionOnly ? 'verified' : 'graded';
      const isDone = ext.isCompleted || ext.isScored;

      const stdObj =
        a?.state_standards &&
        typeof a.state_standards === 'object' &&
        !Array.isArray(a.state_standards)
          ? (a.state_standards as Record<string, unknown>)
          : null;
      const verifiedBy =
        typeof stdObj?.verified_by === 'string' && stdObj.verified_by.trim()
          ? stdObj.verified_by.trim()
          : null;
      const verifiedAt =
        (typeof stdObj?.verified_at === 'string' && stdObj.verified_at.trim()
          ? stdObj.verified_at.trim()
          : null) ||
        a?.completed_at ||
        null;

      const parsedPct =
        a?.percentage_score ??
        (ext.scoreDisplay && ext.scoreDisplay.endsWith('%')
          ? Number.parseFloat(ext.scoreDisplay)
          : null);

      return {
        id: a ? `assign-${a.id}` : `ext-${ext.id}`,
        subjectId: ext.subjectId,
        dateStr: ext.dueDate,
        dayKey: getDayKeyFromIsoDate(ext.dueDate),
        weekdayLabel: ext.weekdayLabel || getWeekdayLabelFromIsoDate(ext.dueDate),
        category,
        text: ext.title,
        infoSubType: 'bullet',
        checked: isDone,
        verifiedBy: isDone ? verifiedBy : null,
        verifiedAt: isDone ? verifiedAt : null,
        subItems: [],
        repeatAcrossWeek: false,
        repeatDays: [getDayKeyFromIsoDate(ext.dueDate)],
        weeklyGroupKey: ext.title.toLowerCase(),
        assignmentId: a?.id,
        assignmentRecord: a,
        assignmentCategory: isActivity ? 'activity' : a?.category || ext.categoryLabel.toLowerCase(),
        scoringMode: a?.grading_mode || (isCompletionOnly ? 'completion' : 'points'),
        pointsEarned: a?.points_earned ?? null,
        pointsPossible: a?.points_possible ?? 100,
        totalProblems: a?.total_problems ?? 20,
        problemsMissed: a?.missed_problems ?? null,
        percentageScore: parsedPct !== null && !Number.isNaN(parsedPct) ? parsedPct : null,
        letterGrade: a?.letter_grade ?? null,
        isApiSynced: Boolean(
          (a && isAssignmentApiSynced(a, sub)) || ext.id.startsWith('api-')
        ),
        isExternalItem: true,
        providerName: ext.providerName,
        courseSubtitle: ext.courseSubtitle,
        weekNumber: ext.weekNumber,
        classNumber: ext.classNumber,
        classTopic: ext.classTopic,
        supplies: ext.supplies,
        openDate: ext.openDate,
        isSubmitted: ext.isSubmitted,
        externalStatusLabel: ext.statusLabel,
      };
    });

    const combined = [...consolidatedInternal, ...externalMapped];
    const deduped: StructuredCellLineItem[] = [];
    const seenAssignIds = new Set<string>();
    const seenSubjectTitleKeys = new Set<string>();

    for (const item of combined) {
      if (item.assignmentId) {
        if (seenAssignIds.has(item.assignmentId)) continue;
        seenAssignIds.add(item.assignmentId);
      }
      const normKey = `${item.subjectId}::${normalizeAssessmentTitleForDedup(item.text)}::${
        item.repeatAcrossWeek ? 'weekly' : item.dateStr
      }`;
      if (seenSubjectTitleKeys.has(normKey)) continue;
      seenSubjectTitleKeys.add(normKey);
      deduped.push(item);
    }

    return deduped;
  }, [
    subjects,
    externalSubjectIds,
    parentNotes,
    assignments,
    mondayStr,
    sundayStr,
    weekDates,
    externalDueThisWeekItems,
    subjectMap,
  ]);

  const filteredSection1Items = useMemo(() => {
    return section1Items.filter((item) => {
      if (filterMode === 'external') return Boolean(item.isExternalItem);
      if (filterMode === 'graded') return item.category === 'graded';
      if (filterMode === 'verified') return item.category === 'verified';
      if (filterMode === 'needs_action') {
        if (item.category === 'verified') return !item.checked;
        return item.percentageScore === null && !item.checked;
      }
      return true;
    });
  }, [section1Items, filterMode]);

  // Toggle Verified / Completed state on a Weekly Grading Summary item (logs user initials & timestamp)
  const handleToggleSection1ItemVerified = async (item: StructuredCellLineItem) => {
    const nextChecked = !item.checked;
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();

    if (item.assignmentId && item.assignmentRecord) {
      const nextStatus = nextChecked ? 'completed' : 'pending';
      const nextWorkflow = nextChecked ? 'completed' : 'not_started';
      const nextCompletedAt = nextChecked ? nowIso : null;
      const existingStd =
        item.assignmentRecord.state_standards &&
        typeof item.assignmentRecord.state_standards === 'object' &&
        !Array.isArray(item.assignmentRecord.state_standards)
          ? (item.assignmentRecord.state_standards as Record<string, Json | undefined>)
          : {};
      const nextStateStandards: Record<string, Json | undefined> = {
        ...existingStd,
        verified_by: nextChecked ? activeUserName : null,
        verified_at: nextChecked ? nowIso : null,
      };

      try {
        const { error } = await supabase
          .schema('school')
          .from('assignments')
          .update({
            status: nextStatus,
            workflow_status: nextWorkflow,
            completed_at: nextCompletedAt,
            state_standards: nextStateStandards as Json,
          })
          .eq('id', item.assignmentId);

        if (error) throw error;

        setAssignments((prev) =>
          prev.map((a) =>
            a.id === item.assignmentId
              ? {
                  ...a,
                  status: nextStatus,
                  workflow_status: nextWorkflow,
                  completed_at: nextCompletedAt,
                  state_standards: nextStateStandards as Json,
                }
              : a
          )
        );
        toast.success(
          nextChecked
            ? `Verified "${item.text}" (${getUserInitials(activeUserName)})`
            : `Marked "${item.text}" pending`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status');
      }
      return;
    }

    // Uncreated external item (e.g. syllabus Lab Activity due this week) -> create assignment record on verify
    if (item.isExternalItem && !item.assignmentId && !item.sourceNoteId) {
      try {
        const isActivity = item.assignmentCategory.toLowerCase() === 'activity';
        const nextStateStandards: Record<string, Json> = {
          verified_by: activeUserName,
          verified_at: nowIso,
        };
        const { data: inserted, error } = await supabase
          .schema('school')
          .from('assignments')
          .insert({
            subject_id: item.subjectId,
            title: item.text,
            category: isActivity ? 'activity' : item.assignmentCategory.toLowerCase(),
            due_date: item.dateStr,
            assigned_date: item.openDate || item.dateStr,
            status: 'completed',
            workflow_status: 'completed',
            completed_at: nowIso,
            is_graded: !isActivity && item.category === 'graded',
            grading_mode: isActivity || item.category === 'verified' ? 'completion' : 'points',
            points_possible: isActivity || item.category === 'verified' ? 0 : 100,
            syllabus_day_number: item.classNumber ?? item.weekNumber ?? null,
            state_standards: nextStateStandards as Json,
          })
          .select('*')
          .single();

        if (error) throw error;
        if (inserted) {
          setAssignments((prev) => [...prev, inserted as GradebookAssignment]);
        }
        toast.success(`Verified "${item.text}" (${getUserInitials(activeUserName)})`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to verify item');
      }
      return;
    }

    const sourceRefsToToggle =
      item.weeklySourceNotes && item.weeklySourceNotes.length > 0
        ? item.weeklySourceNotes
        : item.sourceNoteId &&
          typeof item.sourceLineIndex === 'number' &&
          item.sourceLineIndex >= 0
        ? [
            {
              noteId: item.sourceNoteId,
              dateStr: item.dateStr,
              dayKey: item.dayKey,
              lineIndices:
                item.sourceGroupLineIndices &&
                item.sourceGroupLineIndices.length > 0
                  ? item.sourceGroupLineIndices
                  : [item.sourceLineIndex],
            },
          ]
        : [];

    if (sourceRefsToToggle.length > 0) {
      const updatedNotesById = new Map<string, string>();
      const verifiedSuffix = nextChecked
        ? ` [VERIFIED:${activeUserName}|${nowIso}]`
        : '';

      for (const ref of sourceRefsToToggle) {
        const targetNote = parentNotes.find((n) => n.id === ref.noteId);
        if (!targetNote) continue;

        const baseDesc = updatedNotesById.get(targetNote.id) ?? targetNote.description;
        const lines = baseDesc.split('\n');
        const targetIndices = ref.lineIndices.filter(
          (idx) => idx >= 0 && idx < lines.length
        );
        if (targetIndices.length === 0) continue;

        let taggedPrimaryLine = false;
        for (const lineIdx of targetIndices) {
          const rawLine = lines[lineIdx];
          const line = stripVerifiedMetaMarker(rawLine);
          const trimmedLine = line.trim();
          const isHeaderLine =
            targetIndices.length > 1 &&
            lineIdx === targetIndices[0] &&
            !trimmedLine.includes('- [') &&
            !trimmedLine.includes('[ ]') &&
            !trimmedLine.includes('[x]') &&
            !trimmedLine.includes('[X]') &&
            !trimmedLine.includes('☐') &&
            !trimmedLine.includes('☑');
          if (isHeaderLine) {
            lines[lineIdx] = `${line}${ !taggedPrimaryLine ? verifiedSuffix : '' }`;
            taggedPrimaryLine = true;
            continue;
          }

          const leadingIndent = line.match(/^\s*/)?.[0] || '';
          let updatedLine = line;
          if (nextChecked) {
            if (line.includes('- [ ]')) updatedLine = line.replace('- [ ]', '- [x]');
            else if (line.includes('[ ]')) updatedLine = line.replace('[ ]', '[x]');
            else if (line.includes('☐')) updatedLine = line.replace('☐', '☑');
            else if (targetIndices.length === 1) {
              updatedLine = `${leadingIndent}- [x] ${trimmedLine.replace(/^[-*•]\s*/, '')}`;
            }
          } else {
            if (line.includes('- [x]') || line.includes('- [X]')) {
              updatedLine = line.replace(/- \[[xX]\]/, '- [ ]');
            } else if (line.includes('[x]') || line.includes('[X]')) {
              updatedLine = line.replace(/\[[xX]\]/, '[ ]');
            } else if (line.includes('☑')) {
              updatedLine = line.replace('☑', '☐');
            } else if (targetIndices.length === 1) {
              updatedLine = `${leadingIndent}- [ ] ${trimmedLine.replace(/^[-*•]\s*/, '')}`;
            }
          }
          if (!taggedPrimaryLine) {
            updatedLine = `${updatedLine}${verifiedSuffix}`;
            taggedPrimaryLine = true;
          }
          lines[lineIdx] = updatedLine;
        }

        updatedNotesById.set(targetNote.id, lines.join('\n'));
      }

      if (updatedNotesById.size === 0) return;

      setParentNotes((prev) =>
        prev.map((n) =>
          updatedNotesById.has(n.id)
            ? {
                ...n,
                description: updatedNotesById.get(n.id)!,
                updated_by: activeUserName,
                updated_at: nowIso,
              }
            : n
        )
      );

      try {
        await Promise.all(
          Array.from(updatedNotesById.entries()).map(([noteId, newDescription]) =>
            supabase
              .schema('school')
              .from('parent_notes')
              .update({
                description: newDescription,
                updated_by: activeUserName,
                updated_at: nowIso,
              })
              .eq('id', noteId)
          )
        );
        toast.success(
          nextChecked
            ? item.repeatAcrossWeek
              ? `Verified across week (${getUserInitials(activeUserName)})!`
              : `Verified (${getUserInitials(activeUserName)})!`
            : 'Verification unchecked'
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update verification');
      }
    }
  };

  // Convert a Verified binder note line/group into a Graded assignment (or vice versa) directly from Section 1
  const handleConvertItemCategory = async (
    item: StructuredCellLineItem,
    targetCategory: WeeklyItemCategory
  ) => {
    if (targetCategory === item.category) return;

    try {
      // Converting a Parent Note line or Multi-Line Group ('verified') -> 'graded' Assignment
      if (!item.assignmentId && targetCategory === 'graded') {
        const formattedSubInstructions = formatSubItemsForAssignmentInstructions(
          item.subItems || []
        );
        const targetDueDate =
          item.repeatAcrossWeek && item.repeatDays.length > 0
            ? getIsoDateForWeekdayInWeek(
                mondayStr,
                item.repeatDays[item.repeatDays.length - 1]
              )
            : item.dateStr;

        // 1. Create ONE single graded assignment in school.assignments (even for a weekly-shared block!)
        const { data: inserted, error: insertErr } = await supabase
          .schema('school')
          .from('assignments')
          .insert({
            subject_id: item.subjectId,
            title: item.text,
            description: formattedSubInstructions || item.text,
            instructions: formattedSubInstructions,
            due_date: targetDueDate,
            assigned_date: mondayStr,
            category: item.assignmentCategory || 'homework',
            is_graded: true,
            grading_mode: 'points',
            points_possible: 100,
            status: item.checked ? 'completed' : 'pending',
            workflow_status: item.checked ? 'completed' : 'not_started',
          })
          .select('*')
          .single();

        if (insertErr) throw insertErr;

        // 2. For single-day items, remove the line(s) from parent_notes so it isn't duplicated.
        // For `repeatAcrossWeek` blocks (like Biblioplan Memory Work), keep the block in `parent_notes`
        // so it continues to display on Mon/Tue/Wed/Thu on the Weekly Binder while linked to this 1 weekly assignment!
        if (
          !item.repeatAcrossWeek &&
          item.sourceNoteId &&
          typeof item.sourceLineIndex === 'number' &&
          item.sourceLineIndex >= 0
        ) {
          const targetNote = parentNotes.find((n) => n.id === item.sourceNoteId);
          if (targetNote) {
            const removeSet = new Set<number>(
              item.sourceGroupLineIndices && item.sourceGroupLineIndices.length > 0
                ? item.sourceGroupLineIndices
                : [item.sourceLineIndex]
            );
            const lines = targetNote.description
              .split('\n')
              .filter((_, idx) => !removeSet.has(idx));
            const nextDesc = lines.join('\n').trim();
            if (!nextDesc && !targetNote.title) {
              await supabase.schema('school').from('parent_notes').delete().eq('id', targetNote.id);
              setParentNotes((prev) => prev.filter((n) => n.id !== targetNote.id));
            } else {
              await supabase
                .schema('school')
                .from('parent_notes')
                .update({ description: nextDesc })
                .eq('id', targetNote.id);
              setParentNotes((prev) =>
                prev.map((n) => (n.id === targetNote.id ? { ...n, description: nextDesc } : n))
              );
            }
          }
        }

        if (inserted) {
          const newAssign = inserted as GradebookAssignment;
          setAssignments((prev) => [...prev, newAssign]);
          setInlineDrafts((prev) => ({
            ...prev,
            [newAssign.id]: {
              mode: 'points',
              pointsEarned: '',
              pointsPossible: '100',
              problemsMissed: '',
              totalProblems: '20',
            },
          }));
        }
        toast.success(`Converted "${item.text}" to a Graded Assignment`);
        return;
      }

      // Converting a Note line ('verified') -> 'info' (removes checkbox so it's just informational)
      if (!item.assignmentId && targetCategory === 'info') {
        if (item.sourceNoteId && typeof item.sourceLineIndex === 'number' && item.sourceLineIndex >= 0) {
          const targetNote = parentNotes.find((n) => n.id === item.sourceNoteId);
          if (targetNote) {
            const lines = targetNote.description.split('\n');
            lines[item.sourceLineIndex] = `• ${item.text}`;
            const nextDesc = lines.join('\n');
            await supabase
              .schema('school')
              .from('parent_notes')
              .update({ description: nextDesc })
              .eq('id', targetNote.id);
            setParentNotes((prev) =>
              prev.map((n) => (n.id === targetNote.id ? { ...n, description: nextDesc } : n))
            );
            toast.success(`Changed "${item.text}" to Informational (hidden from grading sheet)`);
          }
        }
        return;
      }

      // Converting an Assignment ('graded' <-> 'verified')
      if (item.assignmentId && item.assignmentRecord) {
        if (targetCategory === 'verified') {
          const { error } = await supabase
            .schema('school')
            .from('assignments')
            .update({
              is_graded: false,
              grading_mode: 'completion',
            })
            .eq('id', item.assignmentId);
          if (error) throw error;
          setAssignments((prev) =>
            prev.map((a) =>
              a.id === item.assignmentId
                ? { ...a, is_graded: false, grading_mode: 'completion' }
                : a
            )
          );
          toast.success(`Changed "${item.text}" to Parent Verified`);
        } else if (targetCategory === 'graded') {
          const { error } = await supabase
            .schema('school')
            .from('assignments')
            .update({
              is_graded: true,
              grading_mode: 'points',
            })
            .eq('id', item.assignmentId);
          if (error) throw error;
          setAssignments((prev) =>
            prev.map((a) =>
              a.id === item.assignmentId ? { ...a, is_graded: true, grading_mode: 'points' } : a
            )
          );
          setInlineDrafts((prev) => ({
            ...prev,
            [item.assignmentId!]: prev[item.assignmentId!] || {
              mode: 'points',
              pointsEarned: '',
              pointsPossible: '100',
              problemsMissed: '',
              totalProblems: '20',
            },
          }));
          toast.success(`Changed "${item.text}" to Graded`);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change item category');
    }
  };

  // Save inline grade directly from the Weekly Grading Summary table
  const handleSaveInlineGrade = async (item: StructuredCellLineItem) => {
    if (!item.assignmentId || !item.assignmentRecord) return;
    const draft = inlineDrafts[item.assignmentId];
    if (!draft) return;

    const sub = subjectMap.get(item.subjectId);
    const policy = parseSubjectGradingPolicy(sub);

    const earnedNum =
      draft.pointsEarned.trim() !== '' ? Number(draft.pointsEarned) : null;
    const possibleNum =
      draft.pointsPossible.trim() !== '' ? Number(draft.pointsPossible) : 100;
    const missedNum =
      draft.problemsMissed.trim() !== '' ? Number(draft.problemsMissed) : null;
    const totalProbNum =
      draft.totalProblems.trim() !== '' ? Number(draft.totalProblems) : null;

    if (draft.mode === 'points' && earnedNum === null) {
      toast.error('Enter points earned to save grade');
      return;
    }
    if (draft.mode === 'problems_calculator' && (missedNum === null || totalProbNum === null)) {
      toast.error('Enter problems missed and total problems');
      return;
    }

    setInlineDrafts((prev) => ({
      ...prev,
      [item.assignmentId!]: { ...draft, saving: true },
    }));

    try {
      const metrics = computeAssignmentMetrics({
        grading_mode: draft.mode,
        points_earned: earnedNum,
        points_possible: possibleNum,
        total_problems: totalProbNum,
        missed_problems: missedNum,
        scale: policy.grading_scale,
      });

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .schema('school')
        .from('assignments')
        .update({
          grading_mode: draft.mode,
          points_earned: metrics.points_earned,
          points_possible: possibleNum,
          total_problems: totalProbNum,
          missed_problems: missedNum,
          percentage_score: metrics.percentage_score,
          letter_grade: metrics.letter_grade,
          status: metrics.percentage_score !== null ? 'completed' : 'pending',
          workflow_status: metrics.percentage_score !== null ? 'completed' : 'not_started',
          completed_at: metrics.percentage_score !== null ? nowIso : null,
        })
        .eq('id', item.assignmentId);

      if (error) throw error;

      setAssignments((prev) =>
        prev.map((a) =>
          a.id === item.assignmentId
            ? {
                ...a,
                grading_mode: draft.mode,
                points_earned: metrics.points_earned,
                points_possible: possibleNum,
                total_problems: totalProbNum,
                missed_problems: missedNum,
                percentage_score: metrics.percentage_score,
                letter_grade: metrics.letter_grade,
                status: metrics.percentage_score !== null ? 'completed' : 'pending',
                workflow_status: metrics.percentage_score !== null ? 'completed' : 'not_started',
                completed_at: metrics.percentage_score !== null ? nowIso : null,
              }
            : a
        )
      );

      toast.success(
        `Saved grade for "${item.text}": ${
          metrics.percentage_score !== null ? `${metrics.percentage_score.toFixed(1)}% (${metrics.letter_grade})` : 'Updated'
        }`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grade');
    } finally {
      setInlineDrafts((prev) => ({
        ...prev,
        [item.assignmentId!]: { ...draft, saving: false },
      }));
    }
  };

  // Toggle External Item Done in Section 2
  const handleToggleExternalItemDone = async (item: ExternalDueThisWeekItem) => {
    try {
      if (item.assignmentRecord) {
        const target = item.assignmentRecord;
        const nextDone = !item.isCompleted;
        const nextStatus = nextDone ? 'completed' : 'pending';
        const nextWorkflow = nextDone ? 'completed' : 'not_started';
        const nextCompletedAt = nextDone ? new Date().toISOString() : null;

        const { error } = await supabase
          .schema('school')
          .from('assignments')
          .update({
            status: nextStatus,
            workflow_status: nextWorkflow,
            completed_at: nextCompletedAt,
          })
          .eq('id', target.id);

        if (error) throw error;

        setAssignments((prev) =>
          prev.map((a) =>
            a.id === target.id
              ? {
                  ...a,
                  status: nextStatus,
                  workflow_status: nextWorkflow,
                  completed_at: nextCompletedAt,
                }
              : a
          )
        );
        toast.success(
          nextDone ? `Marked "${item.title}" complete` : `Marked "${item.title}" pending`
        );
      } else {
        const isActivity = item.categoryLabel.toLowerCase() === 'activity';
        const nowIso = new Date().toISOString();
        const { data: inserted, error } = await supabase
          .schema('school')
          .from('assignments')
          .insert({
            subject_id: item.subjectId,
            title: item.title,
            category: isActivity ? 'activity' : item.categoryLabel.toLowerCase(),
            due_date: item.dueDate,
            assigned_date: item.openDate || item.dueDate,
            status: 'completed',
            workflow_status: 'completed',
            completed_at: nowIso,
            is_graded: !isActivity,
            grading_mode: isActivity ? 'completion' : 'points',
            points_possible: isActivity ? 0 : 100,
            syllabus_day_number: item.classNumber ?? item.weekNumber ?? null,
          })
          .select('*')
          .single();

        if (error) throw error;
        if (inserted) {
          await loadSummaryData();
        }
        toast.success(`Marked "${item.title}" complete`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Summary Counts
  const internalGradedItems = section1Items.filter(
    (it) => it.category === 'graded' && !it.isExternalItem
  );
  const gradedDoneCount = internalGradedItems.filter(
    (it) => it.percentageScore !== null || it.checked
  ).length;

  const allGradedItems = section1Items.filter((it) => it.category === 'graded');

  const verifiedItems = section1Items.filter(
    (it) => it.category === 'verified' && !it.isExternalItem
  );
  const verifiedDoneCount = verifiedItems.filter((it) => it.checked).length;

  const allVerifiedItems = section1Items.filter((it) => it.category === 'verified');

  const externalItemsInTable = section1Items.filter((it) => Boolean(it.isExternalItem));
  const externalDoneCount = externalItemsInTable.filter(
    (it) => it.percentageScore !== null || it.checked
  ).length;

  const totalActionItems = section1Items.length;
  const totalActionDone = section1Items.filter((it) =>
    it.category === 'graded' ? it.percentageScore !== null || it.checked : it.checked
  ).length;

  // Build day groups for "By Day" view (Mon–Fri + any weekend dates that have items due)
  const allDayGroupsForTable = useMemo(() => {
    const map = new Map<
      string,
      { dateStr: string; dayLabel: string; shortDate: string }
    >();
    for (const wd of weekDates) {
      map.set(wd.dateStr, {
        dateStr: wd.dateStr,
        dayLabel: wd.dayLabel,
        shortDate: wd.shortDate,
      });
    }
    for (const it of filteredSection1Items) {
      if (!map.has(it.dateStr)) {
        const d = new Date(`${it.dateStr}T00:00:00`);
        const dayLabel = !Number.isNaN(d.getTime())
          ? d.toLocaleDateString('en-US', { weekday: 'long' })
          : it.weekdayLabel;
        const shortDate = !Number.isNaN(d.getTime())
          ? `${d.getMonth() + 1}/${d.getDate()}`
          : it.dateStr;
        map.set(it.dateStr, { dateStr: it.dateStr, dayLabel, shortDate });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [weekDates, filteredSection1Items]);

  const renderSection1Row = (item: StructuredCellLineItem) => {
    const sub = subjectMap.get(item.subjectId);
    const policy = parseSubjectGradingPolicy(sub);
    const typeInfo = typeMap.get(item.assignmentCategory);
    const isGraded = item.category === 'graded';
    const isScored = item.percentageScore !== null;
    const isRowDone = isGraded ? isScored || item.checked : item.checked;
    const isActivityRow = item.assignmentCategory.toLowerCase() === 'activity';
    const supplyCount = item.supplies?.length ?? 0;
    const draft = item.assignmentId
      ? inlineDrafts[item.assignmentId] || {
          mode: item.scoringMode || 'points',
          pointsEarned: item.pointsEarned != null ? String(item.pointsEarned) : '',
          pointsPossible: String(item.pointsPossible ?? 100),
          problemsMissed: item.problemsMissed != null ? String(item.problemsMissed) : '',
          totalProblems: String(item.totalProblems ?? 20),
        }
      : null;

    return (
      <TableRow
        key={item.id}
        hover
        sx={{
          bgcolor: isRowDone ? alpha(theme.palette.success.main, 0.03) : 'transparent',
        }}
      >
        {/* 1. DONE / VERIFIED CHECKBOX */}
        <TableCell align="center" sx={{ width: 48, px: 1, py: 1 }}>
          <Checkbox
            size="small"
            color="success"
            checked={isRowDone}
            onChange={() => void handleToggleSection1ItemVerified(item)}
            inputProps={{
              'aria-label': `Mark ${item.text} as ${isRowDone ? 'incomplete' : 'completed'}`,
            }}
          />
        </TableCell>

        {/* 2. ITEM / ASSIGNMENT TITLE (& GROUPED SUB-ITEMS / EXTERNAL METADATA) */}
        <TableCell sx={{ py: 1.25, px: 1.5, width: '38%', maxWidth: 380 }}>
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {isActivityRow && (
                <Sparkles size={14} color={theme.palette.success.main} />
              )}
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  textDecoration: isRowDone ? 'line-through' : 'none',
                  color: isRowDone ? 'text.secondary' : 'text.primary',
                }}
              >
                {item.text}
              </Typography>
              {(isGraded || item.isExternalItem) && (
                <Chip
                  size="small"
                  label={typeInfo?.name || item.assignmentCategory}
                  color={isActivityRow ? 'success' : 'default'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
              )}
              {item.isExternalItem && item.checked && !isScored && (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircle2 size={12} />}
                  label={item.isSubmitted ? 'Submitted' : 'Completed'}
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                />
              )}
              {item.weekNumber !== null && item.weekNumber !== undefined && (
                <Chip
                  size="small"
                  label={`Week ${item.weekNumber}`}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
              )}
              {item.classNumber !== null && item.classNumber !== undefined && (
                <Chip
                  size="small"
                  label={`Class ${item.classNumber}`}
                  color="success"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
              )}
              {supplyCount > 0 && (
                <Tooltip
                  title={`Supplies needed: ${item.supplies?.join(', ')}`}
                  placement="top"
                  arrow
                >
                  <Chip
                    size="small"
                    icon={<Package size={12} />}
                    label={`${supplyCount} ${supplyCount === 1 ? 'supply' : 'supplies'}`}
                    color="success"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      bgcolor: alpha(theme.palette.success.main, 0.12),
                      color: 'text.primary',
                    }}
                  />
                </Tooltip>
              )}
              {item.subItems && item.subItems.length > 0 && (
                <Chip
                  size="small"
                  color={isGraded ? 'success' : 'info'}
                  variant="outlined"
                  label={`Grouped (${item.subItems.length} lines)`}
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                />
              )}
              {item.repeatAcrossWeek && (
                <Chip
                  size="small"
                  color="secondary"
                  variant="outlined"
                  label={`↻ ${item.weekdayLabel} • Evaluated Once`}
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                />
              )}
            </Stack>

            {item.classTopic && (
              <Typography variant="caption" color="text.secondary">
                Follows Lesson: {item.classTopic}
              </Typography>
            )}

            {item.subItems && item.subItems.length > 0 && (
              <Box
                sx={{
                  pl: 1.25,
                  py: 0.35,
                  borderLeft: '2px solid',
                  borderColor: 'divider',
                }}
              >
                {item.subItems.map((subItem) => {
                  const subChecked = Boolean(subItem.checked || isRowDone);
                  return (
                    <Typography
                      key={subItem.id}
                      variant="caption"
                      color="text.secondary"
                      component="div"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        lineHeight: 1.35,
                        fontSize: '0.73rem',
                      }}
                    >
                      {subItem.isBullet ? (
                        <span>•</span>
                      ) : (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 11,
                            height: 11,
                            border: '1.4px solid currentColor',
                            borderRadius: '2px',
                            flexShrink: 0,
                          }}
                        >
                          {subChecked && (
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
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
                      )}
                      <span>{subItem.text}</span>
                    </Typography>
                  );
                })}
              </Box>
            )}
          </Stack>
        </TableCell>

        {/* 3. SUBJECT & DAY */}
        <TableCell sx={{ py: 1.25, px: 1, maxWidth: 165 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: sub?.color || 'primary.main',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700} color="text.primary" display="block" noWrap>
                {sub?.name || 'Subject'}
              </Typography>
              {item.isExternalItem && item.providerName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  noWrap
                  sx={{ maxWidth: 140 }}
                >
                  {item.courseSubtitle
                    ? `${item.courseSubtitle} · ${item.providerName}`
                    : item.providerName}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatHumanDate(item.dateStr, true)}
                {item.openDate && item.openDate !== item.dateStr
                  ? ` · Opened ${formatHumanDate(item.openDate, false)}`
                  : ''}
              </Typography>
            </Box>
          </Stack>
        </TableCell>

        {/* 4. ITEM TYPE PILL (Graded vs Verified vs Info quick converter / External badge) */}
        <TableCell sx={{ py: 1.25, px: 1, whiteSpace: 'nowrap' }}>
          {item.isApiSynced ? (
            <Chip
              size="small"
              icon={<ExternalLink size={12} />}
              color="info"
              variant="outlined"
              label="External · API Sync'd"
              sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }}
            />
          ) : (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ToggleButtonGroup
                size="small"
                exclusive
                value={item.category}
                onChange={(_, nextVal: WeeklyItemCategory | null) => {
                  if (nextVal) {
                    void handleConvertItemCategory(item, nextVal);
                  }
                }}
                sx={{
                  height: 24,
                  '& .MuiToggleButton-root': {
                    px: 1,
                    py: 0,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'none',
                  },
                }}
              >
                {!item.isExternalItem && (
                  <ToggleButton
                    value="info"
                    title="Switch to Informational (hide from grading sheet)"
                  >
                    Info
                  </ToggleButton>
                )}
                <ToggleButton
                  value="verified"
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.info.main, 0.14),
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
                      bgcolor: alpha(theme.palette.primary.main, 0.14),
                      color: 'primary.main',
                    },
                  }}
                >
                  Graded
                </ToggleButton>
              </ToggleButtonGroup>
              {item.isExternalItem && (
                <Chip
                  size="small"
                  label="External"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              )}
            </Stack>
          )}
        </TableCell>

        {/* 5. DIRECT GRADE INPUT OR PARENT VERIFICATION CONTROL */}
        <TableCell align="right" sx={{ py: 1, px: 1.5, whiteSpace: 'nowrap' }}>
          {!isGraded ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
              {/* Logged User Initials & Verification Timestamp just to the left of the green Verified button */}
              {item.checked && (
                <Tooltip
                  title={`Verified by ${item.verifiedBy || getCachedActiveUserName()}${
                    item.verifiedAt
                      ? ` on ${new Date(item.verifiedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}`
                      : ''
                  }`}
                  arrow
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.73rem',
                      color: 'success.dark',
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      border: '1px solid',
                      borderColor: alpha(theme.palette.success.main, 0.3),
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getUserInitials(item.verifiedBy || getCachedActiveUserName())}
                    {item.verifiedAt ? ` · ${formatVerifiedTimeShort(item.verifiedAt)}` : ''}
                  </Typography>
                </Tooltip>
              )}

              <Button
                size="small"
                variant={item.checked ? 'contained' : 'outlined'}
                color={item.checked ? 'success' : 'info'}
                startIcon={item.checked ? <CheckCircle2 size={14} /> : <Check size={14} />}
                onClick={() => void handleToggleSection1ItemVerified(item)}
                sx={{
                  height: 28,
                  px: 1.5,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1,
                }}
              >
                {item.checked ? 'Verified ✓' : 'Verify Check'}
              </Button>
            </Stack>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              alignItems="center"
              sx={{ flexWrap: 'nowrap' }}
            >
              {/* Current Calculated Score Chip if Scored */}
              {isScored && item.percentageScore !== null && (
                <Chip
                  size="small"
                  color="success"
                  label={formatClassGradeDisplay(
                    item.percentageScore,
                    item.letterGrade || '',
                    policy
                  )}
                  sx={{
                    height: 24,
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              )}

              {/* External status badge when API-synced or awaiting grade */}
              {!isScored && item.isExternalItem && item.externalStatusLabel && (
                <Chip
                  size="small"
                  icon={item.checked ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  color={item.checked ? 'success' : 'warning'}
                  variant="outlined"
                  label={item.externalStatusLabel}
                  sx={{ height: 24, fontWeight: 700, fontSize: '0.72rem' }}
                />
              )}

              {/* Direct Inline Inputs for Non-API Graded Item */}
              {!item.isApiSynced && item.assignmentId && draft && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip
                    size="small"
                    label={draft.mode === 'problems_calculator' ? 'Probs' : 'Pts'}
                    variant="outlined"
                    onClick={() => {
                      const nextMode: ScoringMode =
                        draft.mode === 'points' ? 'problems_calculator' : 'points';
                      setInlineDrafts((prev) => ({
                        ...prev,
                        [item.assignmentId!]: { ...draft, mode: nextMode },
                      }));
                    }}
                    sx={{
                      height: 24,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  />

                  {draft.mode === 'problems_calculator' ? (
                    <>
                      <TextField
                        size="small"
                        placeholder="Missed"
                        title="Problems missed"
                        value={draft.problemsMissed}
                        onChange={(e) =>
                          setInlineDrafts((prev) => ({
                            ...prev,
                            [item.assignmentId!]: {
                              ...draft,
                              problemsMissed: e.target.value,
                            },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleSaveInlineGrade(item);
                          }
                        }}
                        sx={{
                          width: 54,
                          '& .MuiInputBase-input': {
                            py: 0.4,
                            px: 0.65,
                            fontSize: '0.78rem',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        /
                      </Typography>
                      <TextField
                        size="small"
                        placeholder="Total"
                        title="Total problems"
                        value={draft.totalProblems}
                        onChange={(e) =>
                          setInlineDrafts((prev) => ({
                            ...prev,
                            [item.assignmentId!]: {
                              ...draft,
                              totalProblems: e.target.value,
                            },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleSaveInlineGrade(item);
                          }
                        }}
                        sx={{
                          width: 50,
                          '& .MuiInputBase-input': {
                            py: 0.4,
                            px: 0.65,
                            fontSize: '0.78rem',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <TextField
                        size="small"
                        placeholder="Score"
                        value={draft.pointsEarned}
                        onChange={(e) =>
                          setInlineDrafts((prev) => ({
                            ...prev,
                            [item.assignmentId!]: {
                              ...draft,
                              pointsEarned: e.target.value,
                            },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleSaveInlineGrade(item);
                          }
                        }}
                        sx={{
                          width: 56,
                          '& .MuiInputBase-input': {
                            py: 0.4,
                            px: 0.65,
                            fontSize: '0.78rem',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        /
                      </Typography>
                      <TextField
                        size="small"
                        placeholder="100"
                        value={draft.pointsPossible}
                        onChange={(e) =>
                          setInlineDrafts((prev) => ({
                            ...prev,
                            [item.assignmentId!]: {
                              ...draft,
                              pointsPossible: e.target.value,
                            },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleSaveInlineGrade(item);
                          }
                        }}
                        sx={{
                          width: 50,
                          '& .MuiInputBase-input': {
                            py: 0.4,
                            px: 0.65,
                            fontSize: '0.78rem',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                    </>
                  )}

                  <Tooltip title="Save Grade (or press Enter)">
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={Boolean(draft.saving)}
                        onClick={() => void handleSaveInlineGrade(item)}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 0.5,
                        }}
                      >
                        <Save size={14} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              )}

              {(item.assignmentRecord || item.isExternalItem) && (
                <Tooltip
                  title={
                    item.assignmentRecord
                      ? 'Open Full Grade & Assignment Details'
                      : 'Log Grade or Create Assignment Record'
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (item.assignmentRecord) {
                        const target = item.assignmentRecord;
                        const subObj = target.subject_id
                          ? subjectMap.get(target.subject_id)
                          : undefined;
                        if (isAssignmentApiSynced(target, subObj)) {
                          setApiWarningAssignment(target);
                          return;
                        }
                        setEditingAssignment(target);
                        setModalInitialValues(undefined);
                      } else {
                        setEditingAssignment(null);
                        setModalInitialValues({
                          subject_id: item.subjectId,
                          title: item.text,
                          due_date: item.dateStr,
                          assigned_date: item.openDate || item.dateStr,
                          category: item.assignmentCategory.toLowerCase(),
                          is_graded: true,
                          syllabus_day_number: item.classNumber ?? null,
                        });
                      }
                      setModalOpen(true);
                    }}
                  >
                    <Edit3 size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
        </TableCell>
      </TableRow>
    );
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width="100%" height={96} sx={{ mb: 3, borderRadius: 1 }} />
        <Skeleton variant="rounded" width="100%" height={360} sx={{ mb: 3, borderRadius: 1 }} />
        <Skeleton variant="rounded" width="100%" height={260} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Box>
      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={() => void loadSummaryData()}
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {/* Top Header & Week Navigation Bar */}
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          spacing={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                display: 'flex',
              }}
            >
              <ClipboardCheck size={22} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h4" fontWeight={800}>
                  Weekly Grading Summary
                </Typography>
                <Chip
                  size="small"
                  color={
                    totalActionItems > 0 && totalActionDone === totalActionItems
                      ? 'success'
                      : 'primary'
                  }
                  label={`${totalActionDone} of ${totalActionItems} Completed`}
                  sx={{ fontWeight: 700, height: 22, fontSize: '0.75rem' }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Enter grades, verify parent-checked work, and review external requirements due this week
              </Typography>
            </Box>
          </Stack>

          {/* Week Selector & Quick Actions (matches Weekly Binder Planner M–F date dropdown) */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 0.25,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <IconButton
                size="small"
                onClick={() => handleStepWeek(-7)}
                title="Previous Week"
                aria-label="Previous Week"
                sx={{ borderRadius: 1, p: 0.45 }}
              >
                <ChevronLeft size={16} />
              </IconButton>

              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  const inputEl = datePickerRef.current;
                  if (!inputEl) return;
                  if (typeof inputEl.showPicker === 'function') {
                    inputEl.showPicker();
                  } else {
                    inputEl.focus();
                    inputEl.click();
                  }
                }}
                title="Click to jump to any week"
                aria-label={`Jump to week, currently ${weekRangeLabel}`}
                startIcon={<CalendarIcon size={13} />}
                sx={{
                  px: 1,
                  py: 0.25,
                  minWidth: 0,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  borderRadius: 1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {weekRangeLabel}
              </Button>

              <input
                ref={datePickerRef}
                type="date"
                value={weekStartDate}
                aria-label="Select week date"
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectWeek(getMondayForDateStr(e.target.value));
                  }
                }}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: 1,
                  height: 1,
                  pointerEvents: 'none',
                }}
              />

              <IconButton
                size="small"
                onClick={() => handleStepWeek(7)}
                title="Next Week"
                aria-label="Next Week"
                sx={{ borderRadius: 1, p: 0.45 }}
              >
                <ChevronRight size={16} />
              </IconButton>
            </Box>

            {weekStartDate !== getCurrentWeekMonday() && (
              <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={() => handleSelectWeek(getCurrentWeekMonday())}
                title="Jump back to current week"
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: 1,
                  py: 0.4,
                  px: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Today
              </Button>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            <Button
              component={RouterLink}
              href={`/calendar/planner?week=${weekStartDate}`}
              size="small"
              variant="outlined"
              startIcon={<Printer size={15} />}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
            >
              Weekly Binder
            </Button>
          </Stack>
        </Stack>

        {/* Summary KPI Strip */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.15),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  GRADED ASSIGNMENTS (INTERNAL)
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {gradedDoneCount} / {internalGradedItems.length} Graded
                </Typography>
              </Box>
              <Chip
                size="small"
                color={gradedDoneCount === internalGradedItems.length ? 'success' : 'warning'}
                label={
                  internalGradedItems.length - gradedDoneCount === 0
                    ? 'All Scored'
                    : `${internalGradedItems.length - gradedDoneCount} Need Score`
                }
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.info.main, 0.05),
                border: '1px solid',
                borderColor: alpha(theme.palette.info.main, 0.15),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  PARENT VERIFICATIONS (CHECKLIST)
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {verifiedDoneCount} / {verifiedItems.length} Verified
                </Typography>
              </Box>
              <Chip
                size="small"
                color={verifiedDoneCount === verifiedItems.length ? 'success' : 'info'}
                label={
                  verifiedItems.length - verifiedDoneCount === 0
                    ? 'All Verified'
                    : `${verifiedItems.length - verifiedDoneCount} To Check`
                }
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.success.main, 0.05),
                border: '1px solid',
                borderColor: alpha(theme.palette.success.main, 0.15),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  EXTERNAL DUE THIS WEEK
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {externalDoneCount} / {externalItemsInTable.length} Completed
                </Typography>
              </Box>
              <Chip
                size="small"
                color={
                  externalDoneCount === externalItemsInTable.length ? 'success' : 'warning'
                }
                label={
                  externalItemsInTable.length - externalDoneCount === 0
                    ? 'All Done'
                    : `${externalItemsInTable.length - externalDoneCount} Remaining`
                }
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* UNIFIED WEEKLY GRADING SUMMARY TABLE: Internal Graded, Parent-Verified & External Course Assignments/Activities */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                display: 'flex',
              }}
            >
              <Award size={18} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5">
                  Graded, Parent-Verified &amp; External Work Due This Week
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${section1Items.length} items`}
                  sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Enter scores directly for graded assignments, verify parent-checked work, and track external course requirements &amp; lab activities due during {weekRangeLabel}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filterMode}
              onChange={(_, val: SummaryFilterMode | null) => {
                if (val) setFilterMode(val);
              }}
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.25,
                  py: 0.4,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                },
              }}
            >
              <ToggleButton value="all">All ({section1Items.length})</ToggleButton>
              <ToggleButton value="needs_action">
                Needs Action (
                {
                  section1Items.filter((it) =>
                    it.category === 'verified'
                      ? !it.checked
                      : it.percentageScore === null && !it.checked
                  ).length
                }
                )
              </ToggleButton>
              <ToggleButton value="graded">Graded ({allGradedItems.length})</ToggleButton>
              <ToggleButton value="verified">Verified ({allVerifiedItems.length})</ToggleButton>
              <ToggleButton value="external">External ({externalItemsInTable.length})</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              size="small"
              exclusive
              value={groupByMode}
              onChange={(_, val: SummaryGroupByMode | null) => {
                if (val) setGroupByMode(val);
              }}
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.25,
                  py: 0.4,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                },
              }}
            >
              <ToggleButton value="subject">By Subject</ToggleButton>
              <ToggleButton value="day">By Day</ToggleButton>
              <ToggleButton value="none">Flat</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>

        {/* Parent Supply Sourcing Checklist for This Week's Lab Activities */}
        {supplyItemsDueThisWeek.length > 0 && (
          <Box
            sx={{
              px: 2.5,
              py: 2,
              bgcolor: alpha(theme.palette.success.main, 0.06),
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.2),
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Package size={16} color={theme.palette.success.main} />
                <Typography variant="subtitle2" fontWeight={700} color="success.main">
                  Parent Supply Sourcing Checklist for This Week&apos;s Activities
                </Typography>
              </Stack>

              <Stack
                divider={<Divider sx={{ borderColor: alpha(theme.palette.success.main, 0.16) }} />}
                spacing={1.25}
              >
                {supplyItemsDueThisWeek.map((actItem) => (
                  <Stack
                    key={`supply-banner-${actItem.id}`}
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    spacing={1}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight={600}>
                        {actItem.subjectName}
                        {actItem.classNumber ? ` · Class ${actItem.classNumber}` : ''} —{' '}
                        {actItem.title}
                      </Typography>
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label={
                          actItem.weekdayLabel
                            ? `${actItem.weekdayLabel}, ${formatHumanDate(actItem.dueDate, false)}`
                            : formatHumanDate(actItem.dueDate, true)
                        }
                        sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                      />
                    </Stack>

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {actItem.supplies?.map((supply, sIdx) => (
                        <Chip
                          key={`${actItem.id}-supply-${sIdx}`}
                          size="small"
                          label={supply}
                          sx={{
                            height: 22,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.success.main, 0.12),
                            color: 'text.primary',
                          }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                <TableCell
                  align="center"
                  sx={{
                    width: 56,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  DONE
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ITEM / ASSIGNMENT
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  SUBJECT &amp; DAY
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  TRACKING TYPE
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  GRADE ENTRY / PARENT VERIFY
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSection1Items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No graded, parent-verified, or external items match the current filter for this week ({weekRangeLabel}).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : groupByMode === 'subject' ? (
                subjects.map((sub) => {
                  const subItems = filteredSection1Items.filter((it) => it.subjectId === sub.id);
                  if (subItems.length === 0) return null;
                  const subDone = subItems.filter((it) =>
                    it.category === 'graded'
                      ? it.percentageScore !== null || it.checked
                      : it.checked
                  ).length;
                  return (
                    <Fragment key={`group-sub-${sub.id}`}>
                      <TableRow sx={{ bgcolor: alpha(sub.color || theme.palette.primary.main, 0.06) }}>
                        <TableCell colSpan={5} sx={{ py: 0.75, px: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: sub.color,
                                }}
                              />
                              <Typography variant="subtitle2" fontWeight={800}>
                                {sub.name}
                              </Typography>
                            </Stack>
                            <Chip
                              size="small"
                              color={subDone === subItems.length ? 'success' : 'default'}
                              variant="outlined"
                              label={`${subDone} / ${subItems.length} complete`}
                              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                      {subItems.map(renderSection1Row)}
                    </Fragment>
                  );
                })
              ) : groupByMode === 'day' ? (
                allDayGroupsForTable.map((wd) => {
                  const dayItems = filteredSection1Items.filter((it) => it.dateStr === wd.dateStr);
                  if (dayItems.length === 0) return null;
                  return (
                    <Fragment key={`group-day-${wd.dateStr}`}>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                        <TableCell colSpan={5} sx={{ py: 0.75, px: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2" fontWeight={800}>
                              {wd.dayLabel} ({wd.shortDate})
                            </Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${dayItems.length} items`}
                              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                      {dayItems.map(renderSection1Row)}
                    </Fragment>
                  );
                })
              ) : (
                filteredSection1Items.map(renderSection1Row)
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Unified Assignment Modal */}
      <UnifiedAssignmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAssignment(null);
          setModalInitialValues(undefined);
        }}
        onSaved={async () => {
          await loadSummaryData();
        }}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        editingAssignment={editingAssignment}
        initialValues={modalInitialValues}
      />

      {/* API Override Warning Modal */}
      <ApiGradeOverrideWarningModal
        open={Boolean(apiWarningAssignment)}
        onClose={() => setApiWarningAssignment(null)}
        assignment={apiWarningAssignment}
        subject={
          apiWarningAssignment?.subject_id
            ? subjectMap.get(apiWarningAssignment.subject_id) || null
            : null
        }
        onUpdated={() => {
          void loadSummaryData();
        }}
        onOpenFullEditor={(target) => {
          setApiWarningAssignment(null);
          setEditingAssignment(target);
          setModalInitialValues(undefined);
          setModalOpen(true);
        }}
      />
    </Box>
  );
}

export default function WeeklyGradingSummaryPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      }
    >
      <WeeklyGradingSummaryContent />
    </Suspense>
  );
}
