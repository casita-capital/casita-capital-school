'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  GraduationCap,
  LogIn,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RouterLink } from 'src/components/base/router-link';
import {
  UnifiedAssignmentModal,
  UnifiedAssignmentModalInitialValues,
} from 'src/components/assignments/unified-assignment-modal';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { createClient } from 'src/services/supabase/client';
import { resolveAndSyncActiveUser } from 'src/utils/active-user';
import {
  AssignmentTypeConfig,
  calculateSubjectGradeSummary,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  GradebookAssignment,
  isAssignmentCompletedOrSubmitted,
  isAssignmentScored,
  isSubjectApiSynced,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  SubjectTermOverride,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  getActiveCourseSyllabus,
  getOfficialCourseSubtitle,
  parseRecurringConfig,
  resolveSubjectCountersForWeek,
  resolveSyllabusDaySupplies,
} from 'src/utils/recurring-planner';
import { normalizeAssessmentTitleForDedup } from 'src/utils/weekly-grading-items';

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
}

interface InstructionalHourRow {
  id: string;
  subject_id: string;
  minutes: number;
}

interface ExternalWeekItem {
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
  isDueThisWeek: boolean;
  isScored: boolean;
  isCompleted: boolean;
  isSubmitted: boolean;
  submittedAt?: string | null;
  scoreDisplay: string | null;
  statusLabel:
    | 'Graded'
    | 'Submitted · Awaiting Grade'
    | 'Completed · Awaiting Grade'
    | 'Completed'
    | 'Due This Week'
    | 'Open';
  assignmentRecord?: GradebookAssignment;
}

function isRecordArray<T>(val: unknown): val is T[] {
  return Array.isArray(val);
}

function formatIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

function getAcademicYearBounds(now: Date): { academicYear: string; fullTermName: string } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, July (6) starts new academic year
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  const academicYear = `${startYear}-${endYear}`;
  return {
    academicYear,
    fullTermName: `Full Year ${academicYear}`,
  };
}

function getCurrentWeekBounds(): {
  todayStr: string;
  todayHumanLabel: string;
  mondayStr: string;
  fridayStr: string;
  sundayStr: string;
  weekRangeLabel: string;
  academicYear: string;
  fullTermName: string;
} {
  const now = new Date();
  const todayStr = formatIsoDate(now);
  const todayHumanLabel = formatHumanDate(todayStr, true);
  const { academicYear, fullTermName } = getAcademicYearBounds(now);
  const day = now.getDay();
  // Advance to the upcoming week as soon as Saturday arrives (matches Weekly Binder Planner & Grading Summary)
  const diffToMonday = day === 6 ? 2 : day === 0 ? 1 : 1 - day;

  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMonday);

  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const monMonth = mon.toLocaleDateString('en-US', { month: 'short' });
  const friMonth = fri.toLocaleDateString('en-US', { month: 'short' });
  const weekRangeLabel =
    mon.getMonth() === fri.getMonth()
      ? `${monMonth} ${mon.getDate()}–${fri.getDate()}, ${fri.getFullYear()}`
      : `${monMonth} ${mon.getDate()} – ${friMonth} ${fri.getDate()}, ${fri.getFullYear()}`;

  return {
    todayStr,
    todayHumanLabel,
    mondayStr: formatIsoDate(mon),
    fridayStr: formatIsoDate(fri),
    sundayStr: formatIsoDate(sun),
    weekRangeLabel,
    academicYear,
    fullTermName,
  };
}

export default function SchoolDashboardPage() {
  const theme = useTheme();
  const { schoolName } = useSchoolSettings();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithGrading[]>([]);
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([]);
  const [assignmentTypes, setAssignmentTypes] =
    useState<AssignmentTypeConfig[]>(DEFAULT_ASSIGNMENT_TYPES);
  const [termOverrides, setTermOverrides] = useState<SubjectTermOverride[]>([]);
  const [instructionalHours, setInstructionalHours] = useState<InstructionalHourRow[]>([]);

  const [editingAssignment, setEditingAssignment] = useState<GradebookAssignment | null>(null);
  const [modalInitialValues, setModalInitialValues] = useState<
    UnifiedAssignmentModalInitialValues | undefined
  >(undefined);
  const [gradingFromOverdueQueue, setGradingFromOverdueQueue] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    todayStr,
    todayHumanLabel,
    mondayStr,
    sundayStr,
    weekRangeLabel,
    academicYear,
    fullTermName,
  } = useMemo(() => getCurrentWeekBounds(), []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const resolvedUser = await resolveAndSyncActiveUser(supabase);
      if (resolvedUser) {
        setProfile({
          full_name: resolvedUser.fullName,
          email: resolvedUser.email,
          role: resolvedUser.role,
        });
      } else {
        setProfile(null);
      }

      const [subRes, assignRes, typeRes, ovRes, hrRes] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase.from('assignments').select('*').order('due_date', { ascending: true }),
        supabase.from('assignment_types').select('*').order('sort_order', { ascending: true }),
        supabase.from('subject_term_overrides').select('*'),
        supabase.from('instructional_hours').select('id, subject_id, minutes'),
      ]);

      const firstError =
        subRes.error ||
        assignRes.error ||
        typeRes.error ||
        ovRes.error ||
        hrRes.error;
      if (firstError) {
        setLoadError(
          `Unable to load academic records (${firstError.message}). Check your connection and try again.`
        );
      }

      if (isRecordArray<SubjectWithGrading>(subRes.data)) {
        setSubjects(subRes.data);
      }
      if (isRecordArray<GradebookAssignment>(assignRes.data)) {
        setAssignments(assignRes.data);
      }
      if (isRecordArray<AssignmentTypeConfig>(typeRes.data) && typeRes.data.length > 0) {
        setAssignmentTypes(typeRes.data);
      }
      if (isRecordArray<SubjectTermOverride>(ovRes.data)) {
        setTermOverrides(ovRes.data);
      }
      if (isRecordArray<InstructionalHourRow>(hrRes.data)) {
        setInstructionalHours(hrRes.data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected network error while loading dashboard.';
      setLoadError(`Unable to load academic records (${message}).`);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  // 1. Left Column: Past-Due Assignments Without Grades Entered
  const pastDueUngradedAssignments = useMemo(() => {
    return assignments
      .filter((a) => {
        if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') return false;
        if (a.is_graded === false || a.is_exempt) return false;
        if (!a.due_date || a.due_date >= todayStr) return false;

        const mm = parseAssignmentMoodleMeta(a.state_standards);
        if (mm?.is_ungraded_bucket) return false;

        const hasScore =
          typeof a.points_earned === 'number' ||
          typeof a.percentage_score === 'number' ||
          (a.grading_mode === 'problems_calculator' &&
            typeof a.total_problems === 'number' &&
            typeof a.missed_problems === 'number');

        return !hasScore;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [assignments, todayStr]);

  // 2. Right Column: Class Grade Summaries across all subjects
  const subjectSummaries = useMemo(() => {
    return subjects.map((sub) => {
      const override = termOverrides.find(
        (ov) =>
          ov.subject_id === sub.id &&
          (ov.term_name === fullTermName || ov.academic_year === academicYear)
      );
      const loggedMinutes = instructionalHours
        .filter((h) => h.subject_id === sub.id)
        .reduce((acc, h) => acc + h.minutes, 0);

      return calculateSubjectGradeSummary({
        subject: sub,
        assignments,
        assignmentTypes,
        override,
        loggedMinutes,
      });
    });
  }, [subjects, assignments, assignmentTypes, termOverrides, instructionalHours, fullTermName, academicYear]);

  const overallGpa = useMemo(() => {
    let gradedCredits = 0;
    let unweightedSum = 0;
    for (const sum of subjectSummaries) {
      if (sum.effective_percentage !== null || sum.is_overridden) {
        gradedCredits += sum.effective_credits;
        unweightedSum += sum.gpa_unweighted * sum.effective_credits;
      }
    }
    return gradedCredits > 0 ? Number((unweightedSum / gradedCredits).toFixed(2)) : null;
  }, [subjectSummaries]);

  // 3. Bottom Section: External Assignments & Syllabus Activities Scheduled for This Week
  const externalThisWeekItems = useMemo(() => {
    const items: ExternalWeekItem[] = [];
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
      const isExternal =
        cfg.instructor_info?.provider_type === 'external' ||
        isSubjectApiSynced(sub) ||
        cfg.course_syllabus?.source_type === 'api_sync';

      const subAssignments = assignments.filter(
        (a) =>
          a.subject_id === sub.id &&
          a.workflow_status !== 'staged' &&
          a.workflow_status !== 'ignored'
      );
      const hasActivityAssignments = subAssignments.some(
        (a) => a.category === 'activity'
      );

      if (!isExternal && !hasSyllabusActivities && !hasActivityAssignments) continue;

      const policy = parseSubjectGradingPolicy(sub);
      const counters = resolveSubjectCountersForWeek(cfg, mondayStr, undefined);
      const currentWeekNum = counters.week_num;
      const courseSubtitle = getOfficialCourseSubtitle(cfg);
      const providerName =
        cfg.instructor_info?.outside_entity_name ||
        (isSubjectApiSynced(sub)
          ? 'Memoria Academy'
          : sub.name.toLowerCase().includes('science')
          ? 'Science Shepherd'
          : cfg.instructor_info?.teacher_name || 'Syllabus Activity');

      // Map each weekday to its scheduled class day for class-based syllabi
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
        if (!isExternal && !isActivityItem) continue;

        const mm = parseAssignmentMoodleMeta(a.state_standards);
        const dueInWeek = a.due_date >= mondayStr && a.due_date <= sundayStr;
        const matchedSyllabusWeek =
          typeof mm?.week_number === 'number' && mm.week_number === currentWeekNum;
        const effectiveOpenDate =
          a.assigned_date || mm?.official_portal_open_date || null;
        const openedThisWeekForFuture = Boolean(
          effectiveOpenDate &&
            effectiveOpenDate >= mondayStr &&
            effectiveOpenDate <= sundayStr &&
            a.due_date > sundayStr
        );

        if (!dueInWeek && !matchedSyllabusWeek && !openedThisWeekForFuture) continue;

        const normTitle = normalizeAssessmentTitleForDedup(a.title);
        const key = `${sub.id}::${normTitle}::${a.due_date}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

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

        const statusLabel: ExternalWeekItem['statusLabel'] = hasScore
          ? 'Graded'
          : isCompleted
          ? a.is_graded === false || isActivityItem
            ? 'Completed'
            : isSubmitted
            ? 'Submitted · Awaiting Grade'
            : 'Completed · Awaiting Grade'
          : dueInWeek
          ? 'Due This Week'
          : 'Open';

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
          openDate: effectiveOpenDate,
          dueDate: a.due_date,
          isDueThisWeek: dueInWeek,
          isScored: hasScore,
          isCompleted,
          isSubmitted,
          submittedAt: mm?.api_submitted_at || a.completed_at || null,
          scoreDisplay,
          statusLabel,
          assignmentRecord: a,
        });
      }

      // Also include any syllabus Activities scheduled on this week's classes
      if (hasSyllabusActivities && activeSyl?.days) {
        for (const [clsNum, schedInfo] of classDayByNumber.entries()) {
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
            isDueThisWeek: schedInfo.dueDate >= mondayStr && schedInfo.dueDate <= sundayStr,
            isScored: false,
            isCompleted: false,
            isSubmitted: false,
            scoreDisplay: null,
            statusLabel: 'Due This Week',
          });
        }
      }

      // Also check API syllabus weeks for any linked assessments on currentWeekNum not yet in assignments
      const matchedApiWeek = cfg.course_syllabus?.weeks?.find(
        (w) => w.week_number === currentWeekNum
      );
      if (matchedApiWeek && matchedApiWeek.linked_assessments.length > 0) {
        for (const assess of matchedApiWeek.linked_assessments) {
          const cleanTitle = assess.name
            .replace(/--DUE[\s\S]*$/i, '')
            .replace(/^LC 4th Edition\s+/i, '')
            .trim();
          const normTitle = normalizeAssessmentTitleForDedup(cleanTitle);
          if (
            (typeof assess.cmid === 'number' && existingSubjectCmids.has(assess.cmid)) ||
            existingSubjectNormTitles.has(normTitle)
          ) {
            continue;
          }
          const resolvedDueDate = assess.due_date || mondayStr;
          const dueInWeek = resolvedDueDate >= mondayStr && resolvedDueDate <= sundayStr;
          const key = `${sub.id}::${normTitle}::${resolvedDueDate}`;
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
            weekNumber: matchedApiWeek.week_number,
            openDate: assess.open_date,
            dueDate: resolvedDueDate,
            isDueThisWeek: dueInWeek,
            isScored: hasScore,
            isCompleted,
            isSubmitted,
            scoreDisplay: pct !== null ? `${pct}%` : null,
            statusLabel: hasScore
              ? 'Graded'
              : isSubmitted
              ? 'Submitted · Awaiting Grade'
              : dueInWeek
              ? 'Due This Week'
              : 'Open',
          });
        }
      }
    }

    return items.sort((a, b) => {
      if (a.isDueThisWeek !== b.isDueThisWeek) {
        return a.isDueThisWeek ? -1 : 1;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [subjects, assignments, mondayStr, sundayStr, typeMap]);

  const supplyItemsThisWeek = useMemo(
    () => externalThisWeekItems.filter((item) => item.supplies && item.supplies.length > 0),
    [externalThisWeekItems]
  );

  const handleToggleExternalAssignmentDone = async (item: ExternalWeekItem) => {
    try {
      const supabase = createClient();
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
          await loadDashboardData();
        }
        toast.success(`Marked "${item.title}" complete`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update assignment status'
      );
    }
  };

  if (loading) {
    return (
      <Box aria-busy="true" aria-label="Loading school dashboard">
        <Card
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box sx={{ width: '100%', maxWidth: 420 }}>
              <Skeleton variant="text" width="65%" height={36} />
              <Skeleton variant="text" width="85%" height={22} />
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Skeleton variant="rounded" width={140} height={36} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rounded" width={150} height={36} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rounded" width={160} height={36} sx={{ borderRadius: 1 }} />
            </Stack>
          </Stack>
        </Card>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={6}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="text" width="55%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="rounded" width="100%" height={260} sx={{ borderRadius: 1 }} />
            </Card>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="text" width="50%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="rounded" width="100%" height={260} sx={{ borderRadius: 1 }} />
            </Card>
          </Grid>
        </Grid>

        <Card
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Skeleton variant="text" width="45%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={220} sx={{ borderRadius: 1 }} />
        </Card>
      </Box>
    );
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : '';

  return (
    <Box>
      {/* Actionable Error Banner when Supabase queries fail */}
      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={loadDashboardData}
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {/* Editorial Academy Header Bar */}
      <Card
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.85rem' },
                lineHeight: 1.15,
              }}
            >
              {firstName ? `Welcome back, ${firstName}` : schoolName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {todayHumanLabel} · Week of {weekRangeLabel} · Academic Year {academicYear}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {profile ? (
              <>
                <Button
                  component={RouterLink}
                  href="/gradebook"
                  variant="outlined"
                  size="small"
                  startIcon={<GraduationCap size={16} />}
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    borderRadius: 1,
                    px: 2,
                    py: 1,
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  Gradebook &amp; Reports
                </Button>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    borderRadius: 1,
                    px: 2,
                    py: 1,
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  New Calendar Event
                </Button>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<Printer size={16} />}
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    borderRadius: 1,
                    px: 2,
                    py: 1,
                    boxShadow: 'none',
                  }}
                >
                  Open Weekly Binder
                </Button>
              </>
            ) : (
              <Button
                component={RouterLink}
                href="/login"
                variant="contained"
                color="primary"
                startIcon={<LogIn size={18} />}
                sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 1 }}
              >
                Sign In to Start
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {/* Primary Operational Row: Past-Due Needs Grading (Left) & Class Grade Summary (Right) */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left Column: Past-Due Assignments Needing Grades */}
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.warning.main, 0.14),
                    color: 'warning.main',
                    display: 'flex',
                  }}
                >
                  <AlertCircle size={18} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">
                      Past-Due Assignments Needing Grades
                    </Typography>
                    <Chip
                      size="small"
                      label={pastDueUngradedAssignments.length}
                      color={pastDueUngradedAssignments.length > 0 ? 'warning' : 'success'}
                      sx={{
                        height: 22,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Due before {todayHumanLabel} without a recorded score
                  </Typography>
                </Box>
              </Stack>

              <Button
                component={RouterLink}
                href="/gradebook?tab=assignments"
                size="small"
                sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 1 }}
              >
                Gradebook →
              </Button>
            </Box>

            <TableContainer
              tabIndex={0}
              role="region"
              aria-label="Past-Due Assignments Needing Grades"
              sx={{ maxHeight: 400, flex: 1 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1.5,
                      }}
                    >
                      ASSIGNMENT
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1,
                      }}
                    >
                      CLASS
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1,
                      }}
                    >
                      DUE DATE
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1.5,
                      }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pastDueUngradedAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                        <Stack spacing={1} alignItems="center">
                          <CheckCircle2 size={24} color={theme.palette.success.main} />
                          <Typography variant="body2" fontWeight={600}>
                            All past-due assignments are graded!
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            No overdue items are waiting for grade entry.
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pastDueUngradedAssignments.map((a) => {
                      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
                      const typeInfo = typeMap.get(a.category);
                      const mm = parseAssignmentMoodleMeta(a.state_standards);
                      const isDone = isAssignmentCompletedOrSubmitted(a, mm);
                      const isSubmitted =
                        a.workflow_status === 'submitted' || Boolean(mm?.api_submitted_at);
                      return (
                        <TableRow key={a.id} hover>
                          <TableCell sx={{ py: 1.1, px: 1.5, maxWidth: 210 }}>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                                {a.title}
                              </Typography>
                              {isDone && (
                                <Chip
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  icon={<CheckCircle2 size={11} />}
                                  label={
                                    isSubmitted
                                      ? 'Submitted · Needs Grade'
                                      : 'Completed · Needs Grade'
                                  }
                                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                                />
                              )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {typeInfo?.name || a.category}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.1, px: 1, whiteSpace: 'nowrap' }}>
                            {sub ? (
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                sx={{ flexWrap: 'nowrap' }}
                              >
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: sub.color,
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color="text.primary"
                                  noWrap
                                >
                                  {sub.name}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 1.1, px: 1, whiteSpace: 'nowrap' }}>
                            <Tooltip title={a.due_date} placement="top" arrow>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color="error.main"
                                noWrap
                                sx={{
                                  fontVariantNumeric: 'tabular-nums',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                }}
                              >
                                {formatHumanDate(a.due_date, true)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.1, px: 1.5, whiteSpace: 'nowrap' }}>
                            <Button
                              id={`overdue-grade-btn-${a.id}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<Edit3 size={13} />}
                              onClick={() => {
                                setEditingAssignment(a);
                                setModalInitialValues(undefined);
                                setGradingFromOverdueQueue(true);
                                setModalOpen(true);
                              }}
                              sx={{
                                fontWeight: 600,
                                textTransform: 'none',
                                whiteSpace: 'nowrap',
                                borderRadius: 1,
                                py: 0.4,
                                px: 1,
                                fontSize: '0.75rem',
                              }}
                            >
                              Enter Grade
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Right Column: Basic Summary of All Class Grades */}
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
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
                  <GraduationCap size={18} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">
                      Class Grades Summary
                    </Typography>
                    {overallGpa !== null && (
                      <Tooltip title="Cumulative Unweighted GPA across graded courses" placement="top" arrow>
                        <Chip
                          size="small"
                          icon={<Award size={13} />}
                          label={`${overallGpa.toFixed(2)} Unweighted GPA`}
                          color="primary"
                          variant="outlined"
                          sx={{
                            height: 22,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Current standing across all subjects for {academicYear}
                  </Typography>
                </Box>
              </Stack>

              <Button
                component={RouterLink}
                href="/gradebook"
                size="small"
                sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 1 }}
              >
                Full Gradebook →
              </Button>
            </Box>

            <TableContainer
              tabIndex={0}
              role="region"
              aria-label="Class Grades Summary"
              sx={{ maxHeight: 400, flex: 1 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1.5,
                      }}
                    >
                      SUBJECT / CLASS
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1,
                      }}
                    >
                      GRADED
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        px: 1.5,
                      }}
                    >
                      CURRENT GRADE
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjectSummaries.map((sum) => {
                    const sub = subjectMap.get(sum.subject_id);
                    const cfg = sub ? parseRecurringConfig(sub.recurring_config, sub.name) : null;
                    const officialCourse = cfg ? getOfficialCourseSubtitle(cfg) : null;
                    const isExternal = cfg?.instructor_info?.provider_type === 'external';
                    const providerLabel = isExternal
                      ? cfg?.instructor_info?.outside_entity_name || 'External Provider'
                      : cfg?.instructor_info?.teacher_name || 'Parent Instructor';
                    const subtitleLine = officialCourse
                      ? `${officialCourse} · ${providerLabel}`
                      : providerLabel;

                    return (
                      <TableRow key={sum.subject_id} hover>
                        <TableCell sx={{ py: 1, px: 1.5 }}>
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
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {sum.subject_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'block', lineHeight: 1.25, maxWidth: 215 }}
                              >
                                {subtitleLine}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: 1, whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sum.graded_count} / {sum.total_assignments}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1, px: 1.5, whiteSpace: 'nowrap' }}>
                          {sum.effective_percentage !== null || sum.is_overridden ? (
                            <Chip
                              size="small"
                              label={sum.formatted_display}
                              color={
                                (sum.effective_percentage ?? 100) >= 90
                                  ? 'success'
                                  : (sum.effective_percentage ?? 100) >= 80
                                  ? 'primary'
                                  : (sum.effective_percentage ?? 100) >= 70
                                  ? 'warning'
                                  : 'error'
                              }
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              No Grades Yet
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Full-Width Section: External Assignments & Activities Scheduled for This Week */}
      <Card
        elevation={0}
        sx={{
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
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.info.main, 0.12),
                color: 'info.main',
                display: 'flex',
              }}
            >
              <ExternalLink size={18} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h5">
                  External Course Assignments &amp; Activities This Week
                </Typography>
                <Chip
                  size="small"
                  label={weekRangeLabel}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                />
                {externalThisWeekItems.length > 0 && (
                  <Chip
                    size="small"
                    icon={<CheckCircle2 size={12} />}
                    color={
                      externalThisWeekItems.every((it) => it.isCompleted)
                        ? 'success'
                        : 'info'
                    }
                    variant={
                      externalThisWeekItems.every((it) => it.isCompleted)
                        ? 'filled'
                        : 'outlined'
                    }
                    label={`${
                      externalThisWeekItems.filter((it) => it.isCompleted).length
                    } of ${externalThisWeekItems.length} completed`}
                    sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Scheduled assessments, homework, and syllabus lab activities across external providers
              </Typography>
            </Box>
          </Stack>

          <Button
            component={RouterLink}
            href="/automations?tab=syllabus"
            size="small"
            sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 1 }}
          >
            View Syllabi →
          </Button>
        </Box>

        {/* Flattened Parent Supply Sourcing Banner (no nested cards inside cards) */}
        {supplyItemsThisWeek.length > 0 && (
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
                {supplyItemsThisWeek.map((actItem) => (
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
                        {actItem.classNumber ? ` · Class ${actItem.classNumber}` : ''} — {actItem.title}
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

        {/* Streamlined 6-Column External Schedule Table with Completion Tracking */}
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
                  ASSESSMENT / ACTIVITY
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  CLASS &amp; PROVIDER
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  CATEGORY
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  SCHEDULED / DUE
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
                  STATUS / GRADE
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {externalThisWeekItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No external quizzes, tests, assignments, or syllabus activities are scheduled for this week ({weekRangeLabel}).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                externalThisWeekItems.map((item, idx) => {
                  const isActivityRow = item.categoryLabel.toLowerCase() === 'activity';
                  const supplyCount = item.supplies?.length ?? 0;
                  const prevItem = idx > 0 ? externalThisWeekItems[idx - 1] : undefined;
                  const showDueThisWeekHeader = idx === 0 && item.isDueThisWeek;
                  const showFutureOpenedDivider =
                    !item.isDueThisWeek && (idx === 0 || Boolean(prevItem?.isDueThisWeek));
                  const dueThisWeekCount = externalThisWeekItems.filter(
                    (it) => it.isDueThisWeek
                  ).length;
                  const futureOpenedCount = externalThisWeekItems.length - dueThisWeekCount;

                  return (
                    <Fragment key={item.id}>
                      {showDueThisWeekHeader && futureOpenedCount > 0 && (
                        <TableRow
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.04),
                          }}
                        >
                          <TableCell
                            colSpan={6}
                            sx={{
                              py: 0.75,
                              px: 2,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Typography
                                variant="caption"
                                fontWeight={800}
                                color="warning.dark"
                                sx={{
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Due This Week ({dueThisWeekCount})
                              </Typography>
                              <Divider sx={{ flexGrow: 1 }} />
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                      {showFutureOpenedDivider && (
                        <TableRow
                          sx={{
                            bgcolor: alpha(theme.palette.info.main, 0.04),
                          }}
                        >
                          <TableCell
                            colSpan={6}
                            sx={{
                              py: 0.75,
                              px: 2,
                              borderTop: idx > 0 ? '2px solid' : 'none',
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Typography
                                variant="caption"
                                fontWeight={800}
                                color="info.main"
                                sx={{
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Opened · Due in the Future ({futureOpenedCount})
                              </Typography>
                              <Divider sx={{ flexGrow: 1 }} />
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow
                        hover
                        sx={{
                          bgcolor: item.isCompleted
                            ? alpha(theme.palette.success.main, 0.03)
                            : 'transparent',
                        }}
                      >
                      <TableCell align="center" sx={{ py: 1, width: 56 }}>
                        <Checkbox
                          size="small"
                          color="success"
                          checked={item.isCompleted}
                          onChange={() => handleToggleExternalAssignmentDone(item)}
                          inputProps={{
                            'aria-label': `Mark ${item.title} as ${
                              item.isCompleted ? 'incomplete' : 'completed'
                            }`,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            {isActivityRow && (
                              <Sparkles size={14} color={theme.palette.success.main} />
                            )}
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                textDecoration: item.isCompleted ? 'line-through' : 'none',
                                color: item.isCompleted ? 'text.secondary' : 'text.primary',
                              }}
                            >
                              {item.title}
                            </Typography>
                            {item.isCompleted && !item.isScored && (
                              <Chip
                                size="small"
                                color="success"
                                variant="outlined"
                                icon={<CheckCircle2 size={12} />}
                                label={item.isSubmitted ? 'Submitted' : 'Completed'}
                                sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                              />
                            )}
                            {item.weekNumber !== null && (
                              <Chip
                                size="small"
                                label={`Week ${item.weekNumber}`}
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }}
                              />
                            )}
                            {item.classNumber !== null && item.classNumber !== undefined && (
                              <Chip
                                size="small"
                                label={`Class ${item.classNumber}`}
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }}
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
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: alpha(theme.palette.success.main, 0.12),
                                    color: 'text.primary',
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Stack>
                          {item.classTopic && (
                            <Typography variant="caption" color="text.secondary">
                              Follows Lesson: {item.classTopic}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.25, maxWidth: 210 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: item.subjectColor,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="text.primary"
                              display="block"
                              noWrap
                            >
                              {item.subjectName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              noWrap
                              sx={{ maxWidth: 180 }}
                            >
                              {item.courseSubtitle
                                ? `${item.courseSubtitle} · ${item.providerName}`
                                : item.providerName}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                        <Chip
                          size="small"
                          label={item.categoryLabel}
                          color={isActivityRow ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color={isActivityRow ? 'success.main' : 'text.primary'}
                            noWrap
                            sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                          >
                            {item.weekdayLabel
                              ? `${item.weekdayLabel}, ${formatHumanDate(item.dueDate, false)}`
                              : formatHumanDate(item.dueDate, true)}
                          </Typography>
                          {item.openDate && item.openDate !== item.dueDate && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                            >
                              Opens {formatHumanDate(item.openDate, false)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                          sx={{ flexWrap: 'nowrap' }}
                        >
                          {item.isScored && item.scoreDisplay ? (
                            <Chip
                              size="small"
                              color="success"
                              label={item.scoreDisplay}
                              sx={{
                                height: 22,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          ) : item.isCompleted ? (
                            <Chip
                              size="small"
                              icon={<CheckCircle2 size={12} />}
                              color="success"
                              variant="outlined"
                              label={item.statusLabel}
                              sx={{ height: 22, fontWeight: 700, fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              icon={<Clock size={12} />}
                              color={item.statusLabel === 'Due This Week' ? 'warning' : 'info'}
                              variant="outlined"
                              label={item.statusLabel}
                              sx={{ height: 22, fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          )}
                          <Tooltip
                            title={
                              item.assignmentRecord
                                ? 'Edit or Enter Grade'
                                : 'Log Grade or Create Assignment Record'
                            }
                          >
                            <IconButton
                              aria-label={
                                item.assignmentRecord
                                  ? `Enter or edit grade for ${item.title}`
                                  : `Log grade or create assignment record for ${item.title}`
                              }
                              size="small"
                              onClick={() => {
                                setGradingFromOverdueQueue(false);
                                if (item.assignmentRecord) {
                                  setEditingAssignment(item.assignmentRecord);
                                  setModalInitialValues(undefined);
                                } else {
                                  setEditingAssignment(null);
                                  setModalInitialValues({
                                    subject_id: item.subjectId,
                                    title: item.title,
                                    due_date: item.dueDate,
                                    assigned_date: item.openDate || item.dueDate,
                                    category: item.categoryLabel.toLowerCase(),
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
                        </Stack>
                      </TableCell>
                    </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Unified Assignment Modal for Quick Grade Entry from Dashboard */}
      <UnifiedAssignmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAssignment(null);
          setModalInitialValues(undefined);
          setGradingFromOverdueQueue(false);
        }}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        editingAssignment={editingAssignment}
        initialValues={modalInitialValues}
        onSaved={(savedAssignment) => {
          if (savedAssignment) {
            const wasFromOverdue = gradingFromOverdueQueue;
            const remainingOverdue = pastDueUngradedAssignments.filter(
              (item) => item.id !== savedAssignment.id
            );

            setAssignments((prev) => {
              const exists = prev.some((a) => a.id === savedAssignment.id);
              return exists
                ? prev.map((a) => (a.id === savedAssignment.id ? savedAssignment : a))
                : [savedAssignment, ...prev];
            });

            toast.success(
              (t) => (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    Saved &ldquo;{savedAssignment.title}&rdquo;
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      toast.dismiss(t.id);
                      setEditingAssignment(savedAssignment);
                      setModalInitialValues(undefined);
                      setGradingFromOverdueQueue(wasFromOverdue);
                      setModalOpen(true);
                    }}
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      py: 0.25,
                      px: 1,
                      minWidth: 0,
                      borderRadius: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Re-edit
                  </Button>
                  {wasFromOverdue && remainingOverdue.length > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        toast.dismiss(t.id);
                        setEditingAssignment(remainingOverdue[0]);
                        setModalInitialValues(undefined);
                        setGradingFromOverdueQueue(true);
                        setModalOpen(true);
                      }}
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        py: 0.25,
                        px: 1,
                        minWidth: 0,
                        borderRadius: 1,
                        boxShadow: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Grade Next ({remainingOverdue.length}) →
                    </Button>
                  )}
                </Stack>
              ),
              { duration: 5000 }
            );

            if (wasFromOverdue && remainingOverdue.length > 0 && typeof document !== 'undefined') {
              const nextId = `overdue-grade-btn-${remainingOverdue[0].id}`;
              window.requestAnimationFrame(() => {
                const nextBtn = document.getElementById(nextId);
                if (nextBtn) {
                  nextBtn.focus();
                }
              });
            }
          }
          setModalOpen(false);
          setEditingAssignment(null);
          setModalInitialValues(undefined);
          setGradingFromOverdueQueue(false);
        }}
      />
    </Box>
  );
}
