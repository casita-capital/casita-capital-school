'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
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
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudDownload,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  DAY_KEYS,
  DayKey,
  getOfficialCourseSubtitle,
  parseRecurringConfig,
} from 'src/utils/recurring-planner';
import {
  AssignmentTypeConfig,
  calculateSubjectGradeSummary,
  compareGradebookAssignmentsChronological,
  computeAssignmentMetrics,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  getAssignmentDayNumber,
  getAssignmentWeekNumber,
  GradebookAssignment,
  isAssignmentApiSynced,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  RecurringAssignmentTemplate,
  ScoringMode,
  SubjectGradeSummary,
  SubjectTermOverride,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  ApiGradeOverrideWarningModal,
  revertApiAssignmentOverride,
  UnifiedAssignmentModal,
  UnifiedAssignmentModalInitialValues,
} from 'src/components/assignments/unified-assignment-modal';
import {
  AssignmentTypesManagerModal,
  ClassGradingPolicyModal,
} from 'src/components/assignments/grading-policy-modals';
import { useSchoolSettings } from 'src/contexts/school-settings';

type GradebookTab = 'gradebook' | 'attendance' | 'reports';

interface AttendanceLogRow {
  id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'field_trip' | 'sick' | 'holiday';
  hours_logged: number;
  notes: string;
}

interface InstructionalHourRow {
  id: string;
  subject_id: string;
  log_date: string;
  minutes: number;
  activity_description: string;
  source_assignment_id: string | null;
}

interface StandardizedTestItem {
  id: string;
  test_name: string;
  test_date: string;
  score_summary: string;
}

interface HonorAwardItem {
  id: string;
  title: string;
  year: string;
  description: string;
}

interface HistoricalTranscriptCourse {
  id: string;
  academic_year: string;
  grade_level: string;
  course_title: string;
  broader_discipline: string;
  course_level: 'standard' | 'honors' | 'ap' | 'dual_enrollment';
  letter_grade: string;
  percentage_score: number | null;
  credits_earned: number;
}

interface TranscriptSettingsState {
  id?: string;
  student_legal_name: string;
  date_of_birth: string;
  student_id_number: string;
  anticipated_graduation_date: string;
  current_grade_level: string;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  administrator_name: string;
  administrator_title: string;
  attestation_statement: string;
  standardized_tests: StandardizedTestItem[];
  honors_and_awards: HonorAwardItem[];
  historical_courses: HistoricalTranscriptCourse[];
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatCompactDate(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const clean = isoDate.trim().split('T')[0];
  const parsed = new Date(`${clean}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function parseDaysArray(raw: Json | undefined): DayKey[] {
  if (!Array.isArray(raw)) return ['friday'];
  const valid = raw.filter(
    (d): d is DayKey => typeof d === 'string' && DAY_KEYS.includes(d as DayKey)
  );
  return valid.length > 0 ? valid : ['friday'];
}

function GradebookHubContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { schoolName } = useSchoolSettings();

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<GradebookTab>('gradebook');

  // Core Data State
  const [subjects, setSubjects] = useState<SubjectWithGrading[]>([]);
  const [assignmentTypes, setAssignmentTypes] =
    useState<AssignmentTypeConfig[]>(DEFAULT_ASSIGNMENT_TYPES);
  const [assignments, setAssignments] = useState<GradebookAssignment[]>([]);
  const [, setRecurringTemplates] = useState<RecurringAssignmentTemplate[]>([]);
  const [termOverrides, setTermOverrides] = useState<SubjectTermOverride[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogRow[]>([]);
  const [instructionalHours, setInstructionalHours] = useState<InstructionalHourRow[]>([]);

  // Expandable Class Rows in Default Table + Per-Class Action Menu
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<string[]>([]);
  const [openMenuSubjectId, setOpenMenuSubjectId] = useState<string | null>(null);
  const [globalSetupMenuOpen, setGlobalSetupMenuOpen] = useState<boolean>(false);

  // Academic Term State
  const [selectedTerm, setSelectedTerm] = useState<string>('Semester 1 (Fall)');
  const [selectedAcademicYear] = useState<string>('2026-2027');

  // Inline Quick-Grader Drafts (keyed by assignment ID)
  const [inlineDrafts, setInlineDrafts] = useState<
    Record<
      string,
      {
        total_problems: string;
        missed_problems: string;
        points_earned: string;
        points_possible: string;
      }
    >
  >({});
  const [savingInlineId, setSavingInlineId] = useState<string | null>(null);
  const [editingInlineScoreIds, setEditingInlineScoreIds] = useState<
    Record<string, boolean>
  >({});
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState<
    string | null
  >(null);

  // Unified Assignment Modal State
  const [unifiedModalOpen, setUnifiedModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] =
    useState<GradebookAssignment | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<RecurringAssignmentTemplate | null>(null);
  const [modalInitialValues, setModalInitialValues] = useState<
    UnifiedAssignmentModalInitialValues | undefined
  >(undefined);

  // Prominent API-Synced Grade Override Warning Modal State
  const [apiOverrideWarningAssignment, setApiOverrideWarningAssignment] =
    useState<GradebookAssignment | null>(null);
  const [revertingOverrideId, setRevertingOverrideId] = useState<string | null>(null);

  // Policy & Assignment Types Modals
  const [typesModalOpen, setTypesModalOpen] = useState<boolean>(false);
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);
  const [policyModalSubjectId, setPolicyModalSubjectId] = useState<string | undefined>(
    undefined
  );

  // Manual Term Override Modal State
  const [overrideModalSubject, setOverrideModalSubject] =
    useState<SubjectWithGrading | null>(null);
  const [overridePctInput, setOverridePctInput] = useState<string>('');
  const [overrideLetterInput, setOverrideLetterInput] = useState<string>('');
  const [overrideCreditsInput, setOverrideCreditsInput] = useState<string>('');
  const [overrideObservationsInput, setOverrideObservationsInput] = useState<string>('');
  const [overridePortfolioInput, setOverridePortfolioInput] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState<boolean>(false);

  const [syncingPortalGrades, setSyncingPortalGrades] = useState<boolean>(false);

  // Attendance & Instructional Hours Form State
  const [newAttendanceDate, setNewAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newAttendanceStatus, setNewAttendanceStatus] = useState<
    'present' | 'absent' | 'field_trip' | 'sick' | 'holiday'
  >('present');
  const [newAttendanceHours] = useState<string>('6');
  const [newAttendanceNotes, setNewAttendanceNotes] = useState<string>('');
  const [hourSubjectId, setHourSubjectId] = useState<string>('');
  const [hourDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [hourMinutes, setHourMinutes] = useState<string>('60');
  const [hourActivity, setHourActivity] = useState<string>('');

  // Report Card & Transcript View Controls
  const [reportDocMode, setReportDocMode] = useState<'report_card' | 'transcript'>(
    'report_card'
  );
  const [reportDateFilterMode, setReportDateFilterMode] = useState<
    'all_term' | 'this_week' | 'this_month' | 'custom_range'
  >('all_term');
  const [reportStartDate, setReportStartDate] = useState<string>('2026-08-17');
  const [reportEndDate, setReportEndDate] = useState<string>('2026-12-18');
  const [reportDetailLevel, setReportDetailLevel] = useState<'summary' | 'detailed'>(
    'detailed'
  );
  const [transcriptGrouping, setTranscriptGrouping] = useState<
    'chronological' | 'subject_category'
  >('chronological');
  const [transcriptOrientation, setTranscriptOrientation] = useState<
    'portrait' | 'landscape'
  >('portrait');
  const [transcriptSettings, setTranscriptSettings] = useState<TranscriptSettingsState>({
    student_legal_name: 'Student Name',
    date_of_birth: '',
    student_id_number: 'CCS-2026-001',
    anticipated_graduation_date: 'May 2034',
    current_grade_level: '5th Grade',
    school_name: schoolName || 'Casita Capital School',
    school_address: '',
    school_phone: '',
    school_email: '',
    administrator_name: 'Blake Womble',
    administrator_title: 'Principal / Parent Administrator',
    attestation_statement:
      `I hereby certify that this transcript is a true and accurate official academic record of coursework completed at ${schoolName || 'Casita Capital School'} in compliance with state homeschool statutes.`,
    standardized_tests: [],
    honors_and_awards: [],
    historical_courses: [],
  });
  const [savingTranscript, setSavingTranscript] = useState<boolean>(false);

  const effectiveSchoolName = (
    schoolName ||
    transcriptSettings.school_name ||
    'Casita Capital School'
  ).trim();

  const effectiveAttestationStatement = (
    transcriptSettings.attestation_statement ||
    `I hereby certify that this transcript is a true and accurate official academic record of coursework completed at ${effectiveSchoolName} in compliance with state homeschool statutes.`
  ).replace(/Casita Capital School/gi, effectiveSchoolName);

  useEffect(() => {
    if (schoolName && schoolName.trim().length > 0) {
      setTranscriptSettings((prev) => ({
        ...prev,
        school_name: schoolName.trim(),
      }));
    }
  }, [schoolName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (globalSetupMenuOpen) setGlobalSetupMenuOpen(false);
        if (openMenuSubjectId) setOpenMenuSubjectId(null);
        if (overrideModalSubject && !savingOverride) setOverrideModalSubject(null);
        if (confirmDeleteAssignmentId) setConfirmDeleteAssignmentId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    globalSetupMenuOpen,
    openMenuSubjectId,
    overrideModalSubject,
    savingOverride,
    confirmDeleteAssignmentId,
  ]);

  const [newTestName, setNewTestName] = useState<string>('');
  const [newTestDate] = useState<string>('');
  const [newTestScore, setNewTestScore] = useState<string>('');
  const [newHonorTitle, setNewHonorTitle] = useState<string>('');
  const [newHonorYear, setNewHonorYear] = useState<string>('2026-2027');

  async function loadAllGradebookData() {
    setLoading(true);
    try {
      const [
        subRes,
        typeRes,
        assignRes,
        tplRes,
        ovRes,
        attRes,
        hrRes,
        trRes,
      ] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('assignment_types')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase.from('assignments').select('*').order('due_date', { ascending: false }),
        supabase
          .from('recurring_assignment_templates')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase.from('subject_term_overrides').select('*'),
        supabase
          .from('attendance_logs')
          .select('*')
          .order('attendance_date', { ascending: false }),
        supabase
          .from('instructional_hours')
          .select('*')
          .order('log_date', { ascending: false }),
        supabase.from('transcript_settings').select('*').limit(1).maybeSingle(),
      ]);

      if (subRes.data) {
        const subs = subRes.data as unknown as SubjectWithGrading[];
        setSubjects(subs);
        if (subs.length > 0) {
          setHourSubjectId((prev) => prev || subs[0].id);
        }
      }

      if (typeRes.data && typeRes.data.length > 0) {
        setAssignmentTypes(typeRes.data as unknown as AssignmentTypeConfig[]);
      }

      if (assignRes.data) {
        const loadedAssignments = assignRes.data as unknown as GradebookAssignment[];
        setAssignments(loadedAssignments);
        const drafts: Record<
          string,
          {
            total_problems: string;
            missed_problems: string;
            points_earned: string;
            points_possible: string;
          }
        > = {};
        for (const a of loadedAssignments) {
          drafts[a.id] = {
            total_problems:
              typeof a.total_problems === 'number' ? String(a.total_problems) : '',
            missed_problems:
              typeof a.missed_problems === 'number' ? String(a.missed_problems) : '',
            points_earned:
              typeof a.points_earned === 'number' ? String(a.points_earned) : '',
            points_possible: String(a.points_possible ?? 100),
          };
        }
        setInlineDrafts(drafts);
      }

      if (tplRes.data) {
        const mappedTemplates: RecurringAssignmentTemplate[] = tplRes.data.map((row) => ({
          id: row.id,
          subject_id: row.subject_id,
          title_template: row.title_template,
          instructions_template: row.instructions_template,
          assignment_type_slug: row.assignment_type_slug,
          grading_mode: row.grading_mode,
          points_possible: Number(row.points_possible),
          total_problems_default: row.total_problems_default,
          days_of_week: parseDaysArray(row.days_of_week),
          linked_weekly_source: row.linked_weekly_source,
          auto_behavior: row.auto_behavior,
          estimated_minutes: row.estimated_minutes,
          is_active: row.is_active,
        }));
        setRecurringTemplates(mappedTemplates);
      }

      if (ovRes.data) {
        setTermOverrides(ovRes.data as unknown as SubjectTermOverride[]);
      }

      if (attRes.data) {
        setAttendanceLogs(attRes.data as unknown as AttendanceLogRow[]);
      }

      if (hrRes.data) {
        setInstructionalHours(hrRes.data as unknown as InstructionalHourRow[]);
      }

      if (trRes.data) {
        const tr = trRes.data;
        setTranscriptSettings({
          id: tr.id,
          student_legal_name: tr.student_legal_name || 'Student Name',
          date_of_birth: tr.date_of_birth || '',
          student_id_number: tr.student_id_number || 'CCS-2026-001',
          anticipated_graduation_date: tr.anticipated_graduation_date || 'May 2034',
          current_grade_level: tr.current_grade_level || '5th Grade',
          school_name: schoolName || tr.school_name || 'Casita Capital School',
          school_address: tr.school_address || '',
          school_phone: tr.school_phone || '',
          school_email: tr.school_email || '',
          administrator_name: tr.administrator_name || 'Blake Womble',
          administrator_title:
            tr.administrator_title || 'Principal / Parent Administrator',
          attestation_statement: tr.attestation_statement,
          standardized_tests: Array.isArray(tr.standardized_tests)
            ? (tr.standardized_tests as unknown as StandardizedTestItem[])
            : [],
          honors_and_awards: Array.isArray(tr.honors_and_awards)
            ? (tr.honors_and_awards as unknown as HonorAwardItem[])
            : [],
          historical_courses: Array.isArray(tr.historical_courses)
            ? (tr.historical_courses as unknown as HistoricalTranscriptCourse[])
            : [],
        });
      }
    } catch {
      toast.error('Failed to load gradebook data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllGradebookData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'staging') {
      router.replace('/assignments?tab=imported_pending');
    } else if (tabParam === 'assignments') {
      router.replace('/assignments');
    } else if (tabParam === 'attendance') {
      setActiveTab('attendance');
    } else if (tabParam === 'report_card') {
      setActiveTab('reports');
      setReportDocMode('report_card');
    } else if (tabParam === 'transcript') {
      setActiveTab('reports');
      setReportDocMode('transcript');
    } else if (tabParam === 'policies') {
      setPolicyModalOpen(true);
    }
  }, [searchParams, router]);

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

  // Calculate Subject Grade Summaries
  const subjectSummaries = useMemo(() => {
    const list: SubjectGradeSummary[] = [];
    for (const sub of subjects) {
      const override = termOverrides.find(
        (ov) =>
          ov.subject_id === sub.id &&
          ov.term_name === selectedTerm &&
          ov.academic_year === selectedAcademicYear
      );
      const subLoggedMinutes = instructionalHours
        .filter((h) => h.subject_id === sub.id)
        .reduce((acc, h) => acc + h.minutes, 0);

      const summary = calculateSubjectGradeSummary({
        subject: sub,
        assignments,
        assignmentTypes,
        override,
        loggedMinutes: subLoggedMinutes,
      });
      list.push(summary);
    }
    return list;
  }, [
    subjects,
    assignments,
    assignmentTypes,
    termOverrides,
    instructionalHours,
    selectedTerm,
    selectedAcademicYear,
  ]);

  // Filtered assignments and subject summaries for Report Card period filter
  const reportFilteredAssignments = useMemo(() => {
    if (reportDateFilterMode === 'all_term') {
      return assignments;
    }
    const now = new Date();
    let startStr = reportStartDate;
    let endStr = reportEndDate;

    if (reportDateFilterMode === 'this_week') {
      startStr = getCurrentWeekMonday();
      const mon = new Date(`${startStr}T00:00:00`);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const yyyy = sun.getFullYear();
      const mm = String(sun.getMonth() + 1).padStart(2, '0');
      const dd = String(sun.getDate()).padStart(2, '0');
      endStr = `${yyyy}-${mm}-${dd}`;
    } else if (reportDateFilterMode === 'this_month') {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
      startStr = `${yyyy}-${mm}-01`;
      endStr = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
    }

    return assignments.filter((a) => {
      const d = (a.due_date || '').split('T')[0];
      if (!d) return false;
      if (startStr && d < startStr) return false;
      if (endStr && d > endStr) return false;
      return true;
    });
  }, [assignments, reportDateFilterMode, reportStartDate, reportEndDate]);

  const reportSubjectSummaries = useMemo(() => {
    if (reportDateFilterMode === 'all_term') {
      return subjectSummaries;
    }
    return subjects.map((sub) => {
      const override = termOverrides.find(
        (ov) =>
          ov.subject_id === sub.id &&
          ov.term_name === selectedTerm &&
          ov.academic_year === selectedAcademicYear
      );
      const subLoggedMinutes = instructionalHours
        .filter((h) => h.subject_id === sub.id)
        .reduce((acc, h) => acc + h.minutes, 0);

      return calculateSubjectGradeSummary({
        subject: sub,
        assignments: reportFilteredAssignments,
        assignmentTypes,
        override,
        loggedMinutes: subLoggedMinutes,
      });
    });
  }, [
    reportDateFilterMode,
    subjectSummaries,
    subjects,
    termOverrides,
    selectedTerm,
    selectedAcademicYear,
    instructionalHours,
    reportFilteredAssignments,
    assignmentTypes,
  ]);

  // Overall GPA & Credits Rollup
  const overallMetrics = useMemo(() => {
    let totalCredits = 0;
    let gradedCredits = 0;
    let unweightedPointsSum = 0;
    let weightedPointsSum = 0;
    let totalNeedsGrading = 0;
    let totalPendingGrades = 0;
    let totalStaged = 0;
    let totalGradedCount = 0;

    for (const sum of subjectSummaries) {
      totalCredits += sum.effective_credits;
      totalNeedsGrading += sum.needs_grading_count;
      totalPendingGrades += sum.pending_api_count;
      totalStaged += sum.staged_count;
      totalGradedCount += sum.graded_count;

      if (sum.effective_percentage !== null || sum.is_overridden) {
        gradedCredits += sum.effective_credits;
        unweightedPointsSum += sum.gpa_unweighted * sum.effective_credits;
        weightedPointsSum += sum.gpa_weighted * sum.effective_credits;
      }
    }

    return {
      cumulativeUnweightedGpa:
        gradedCredits > 0
          ? Number((unweightedPointsSum / gradedCredits).toFixed(2))
          : 4.0,
      cumulativeWeightedGpa:
        gradedCredits > 0 ? Number((weightedPointsSum / gradedCredits).toFixed(2)) : 4.0,
      totalCredits: Number(totalCredits.toFixed(2)),
      totalNeedsGrading,
      totalPendingGrades,
      totalStaged,
      totalGradedCount,
    };
  }, [subjectSummaries]);

  const [collapsedGradeCategories, setCollapsedGradeCategories] = useState<
    Record<string, boolean>
  >({});

  const toggleCollapseCategory = (subjectId: string, categoryName: string) => {
    const key = `${subjectId}::${categoryName}`;
    setCollapsedGradeCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleExpandSubject = (subjectId: string) => {
    setExpandedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSyncPortalGrades = async () => {
    setSyncingPortalGrades(true);
    try {
      const res = await fetch('/api/memoria/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_courses' }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        synced_courses?: Array<{ official_course_name: string }>;
      } | null;
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Failed to sync portal grades');
        return;
      }
      await loadAllGradebookData();
      toast.success(
        `Synced grades for ${data.synced_courses?.length || 0} Memoria Academy courses!`
      );
    } catch {
      toast.error('Failed to sync portal grades');
    } finally {
      setSyncingPortalGrades(false);
    }
  };

  // Move Subject Order Up / Down
  const handleMoveSubjectOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= subjects.length) return;
    const reordered = [...subjects];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const withUpdatedSort = reordered.map((s, i) => ({ ...s, sort_order: i + 1 }));
    setSubjects(withUpdatedSort);

    for (const s of withUpdatedSort) {
      await supabase.from('subjects').update({ sort_order: s.sort_order }).eq('id', s.id);
    }
    toast.success('Updated class order');
  };

  // Inline Quick Score Save (Math Total/Missed Problems OR Points Earned/Possible)
  const handleSaveInlineScore = async (assignment: GradebookAssignment) => {
    const draft = inlineDrafts[assignment.id];
    if (!draft) return;

    const sub = assignment.subject_id ? subjectMap.get(assignment.subject_id) : undefined;
    const policy = sub
      ? parseSubjectGradingPolicy(sub)
      : parseSubjectGradingPolicy({ id: '', name: '', sort_order: 0, color: '#1b5698' });

    const mode: ScoringMode = assignment.grading_mode || 'points';
    const parsedTotal =
      draft.total_problems.trim() !== '' ? Number(draft.total_problems) : null;
    const parsedMissed =
      draft.missed_problems.trim() !== '' ? Number(draft.missed_problems) : null;
    const parsedEarned =
      draft.points_earned.trim() !== '' ? Number(draft.points_earned) : null;
    const parsedPossible =
      draft.points_possible.trim() !== ''
        ? Number(draft.points_possible)
        : assignment.points_possible ?? 100;

    const metrics = computeAssignmentMetrics({
      grading_mode: mode,
      total_problems: parsedTotal,
      missed_problems: parsedMissed,
      points_possible: parsedPossible,
      points_earned: parsedEarned,
      percentage_score: assignment.percentage_score,
      workflow_status: 'completed',
      scale: policy.grading_scale,
    });

    if (!metrics.is_scored) {
      toast.error(
        mode === 'problems_calculator'
          ? 'Enter both Total Problems and Missed Problems to calculate % score'
          : 'Enter Points Earned to calculate score'
      );
      return;
    }

    setSavingInlineId(assignment.id);
    const nowIso = new Date().toISOString();
    try {
      const updatePayload = {
        total_problems: parsedTotal,
        missed_problems: parsedMissed,
        points_possible: metrics.points_possible,
        points_earned: metrics.points_earned,
        percentage_score: metrics.percentage_score,
        letter_grade: metrics.letter_grade,
        status: 'completed' as const,
        workflow_status: 'completed' as const,
        completed_at: assignment.completed_at || nowIso,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('assignments')
        .update(updatePayload)
        .eq('id', assignment.id)
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to save score: ${error.message}`);
        return;
      }

      if (data) {
        const updated = data as unknown as GradebookAssignment;
        setAssignments((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setEditingInlineScoreIds((prev) => ({
          ...prev,
          [assignment.id]: false,
        }));
        toast.success(
          `Saved "${updated.title}": ${formatClassGradeDisplay(
            updated.percentage_score ?? null,
            updated.letter_grade || '',
            policy
          )}`
        );
      }
    } catch {
      toast.error('Error saving inline grade');
    } finally {
      setSavingInlineId(null);
    }
  };

  const handleDeleteAssignmentWithUndo = async (assignment: GradebookAssignment) => {
    setConfirmDeleteAssignmentId(null);
    const snapshot = { ...assignment };
    setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignment.id);

    if (error) {
      setAssignments((prev) => [snapshot, ...prev]);
      toast.error(`Failed to delete assignment: ${error.message}`);
      return;
    }

    toast(
      (t) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Deleted &ldquo;{snapshot.title}&rdquo;
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              toast.dismiss(t.id);
              const { data } = await supabase
                .from('assignments')
                .insert(snapshot)
                .select('*')
                .single();
              if (data) {
                const restored = data as unknown as GradebookAssignment;
                setAssignments((prev) => [restored, ...prev]);
                toast.success(`Restored "${restored.title}"`);
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 700, minWidth: 64 }}
          >
            Undo
          </Button>
        </Stack>
      ),
      { duration: 5000 }
    );
  };

  // Save Term Final Grade Override & Teacher Observations
  const handleOpenTermOverrideModal = (sub: SubjectWithGrading) => {
    setOverrideModalSubject(sub);
    const existing = termOverrides.find(
      (ov) =>
        ov.subject_id === sub.id &&
        ov.term_name === selectedTerm &&
        ov.academic_year === selectedAcademicYear
    );
    setOverridePctInput(
      existing && existing.override_percentage !== null
        ? String(existing.override_percentage)
        : ''
    );
    setOverrideLetterInput(existing?.override_letter_grade || '');
    setOverrideCreditsInput(
      existing && existing.override_credits !== null
        ? String(existing.override_credits)
        : ''
    );
    setOverrideObservationsInput(existing?.teacher_observations || '');
    setOverridePortfolioInput(existing?.portfolio_notes || '');
  };

  const handleSaveTermOverride = async () => {
    if (!overrideModalSubject) return;
    setSavingOverride(true);
    try {
      const payload = {
        subject_id: overrideModalSubject.id,
        term_name: selectedTerm,
        academic_year: selectedAcademicYear,
        override_percentage:
          overridePctInput.trim() !== '' ? Number(overridePctInput) : null,
        override_letter_grade: overrideLetterInput.trim() || null,
        override_credits:
          overrideCreditsInput.trim() !== '' ? Number(overrideCreditsInput) : null,
        teacher_observations: overrideObservationsInput.trim(),
        portfolio_notes: overridePortfolioInput.trim(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('subject_term_overrides')
        .upsert(payload, { onConflict: 'subject_id,term_name,academic_year' })
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to save term override: ${error.message}`);
        return;
      }

      if (data) {
        const saved = data as unknown as SubjectTermOverride;
        setTermOverrides((prev) => [
          ...prev.filter(
            (ov) =>
              !(
                ov.subject_id === saved.subject_id &&
                ov.term_name === saved.term_name &&
                ov.academic_year === saved.academic_year
              )
          ),
          saved,
        ]);
        toast.success(`Saved term override & report card notes for ${overrideModalSubject.name}`);
        setOverrideModalSubject(null);
      }
    } catch {
      toast.error('Error saving term override');
    } finally {
      setSavingOverride(false);
    }
  };

  // Attendance & Instructional Hours Handlers
  const handleLogAttendance = async () => {
    if (!newAttendanceDate) return;
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .upsert(
          {
            attendance_date: newAttendanceDate,
            status: newAttendanceStatus,
            hours_logged: Number(newAttendanceHours) || 6,
            notes: newAttendanceNotes.trim(),
          },
          { onConflict: 'attendance_date' }
        )
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to log attendance: ${error.message}`);
        return;
      }

      if (data) {
        const added = data as unknown as AttendanceLogRow;
        setAttendanceLogs((prev) =>
          [
            added,
            ...prev.filter((row) => row.attendance_date !== added.attendance_date),
          ].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
        );
        setNewAttendanceNotes('');
        toast.success(`Logged attendance for ${added.attendance_date}`);
      }
    } catch {
      toast.error('Error logging attendance');
    }
  };

  const handleLogInstructionalHours = async () => {
    if (!hourSubjectId || !hourDate) return;
    try {
      const { data, error } = await supabase
        .from('instructional_hours')
        .insert({
          subject_id: hourSubjectId,
          log_date: hourDate,
          minutes: Math.max(1, Number(hourMinutes) || 60),
          activity_description: hourActivity.trim() || 'Instructional study session',
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to log hours: ${error.message}`);
        return;
      }

      if (data) {
        const added = data as unknown as InstructionalHourRow;
        setInstructionalHours((prev) => [added, ...prev]);
        setHourActivity('');
        toast.success('Instructional hours logged');
      }
    } catch {
      toast.error('Error logging instructional hours');
    }
  };

  // Save Transcript Settings
  const handleSaveTranscriptSettings = async () => {
    setSavingTranscript(true);
    try {
      const payload = {
        ...(transcriptSettings.id ? { id: transcriptSettings.id } : {}),
        student_legal_name: transcriptSettings.student_legal_name,
        date_of_birth: transcriptSettings.date_of_birth,
        student_id_number: transcriptSettings.student_id_number,
        anticipated_graduation_date: transcriptSettings.anticipated_graduation_date,
        current_grade_level: transcriptSettings.current_grade_level,
        school_name: effectiveSchoolName,
        school_address: transcriptSettings.school_address,
        school_phone: transcriptSettings.school_phone,
        school_email: transcriptSettings.school_email,
        administrator_name: transcriptSettings.administrator_name,
        administrator_title: transcriptSettings.administrator_title,
        attestation_statement: effectiveAttestationStatement,
        standardized_tests: transcriptSettings.standardized_tests as unknown as Json,
        honors_and_awards: transcriptSettings.honors_and_awards as unknown as Json,
        historical_courses: transcriptSettings.historical_courses as unknown as Json,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('transcript_settings')
        .upsert(payload)
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to save transcript settings: ${error.message}`);
        return;
      }

      if (data) {
        setTranscriptSettings((prev) => ({ ...prev, id: data.id }));
        toast.success('Official Transcript settings saved');
      }
    } catch {
      toast.error('Error saving transcript settings');
    } finally {
      setSavingTranscript(false);
    }
  };

  // Export CSV for Complete Data Portability
  const handleExportCsv = () => {
    const headers = [
      'Academic Year',
      'Term',
      'Subject',
      'Discipline',
      'Course Level',
      'Assignment Title',
      'Category',
      'Due Date',
      'Completed Date',
      'Workflow Status',
      'Scoring Mode',
      'Total Problems',
      'Missed Problems',
      'Points Earned',
      'Points Possible',
      'Percentage (%)',
      'Letter Grade',
      'Teacher Comments',
    ];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const rows = assignments.map((a) => {
      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
      const policy = sub ? parseSubjectGradingPolicy(sub) : undefined;
      return [
        escapeCsv(a.academic_year || selectedAcademicYear),
        escapeCsv(a.term_name || selectedTerm),
        escapeCsv(sub?.name || 'General'),
        escapeCsv(policy?.broader_discipline || 'General'),
        escapeCsv(policy?.course_level || 'standard'),
        escapeCsv(a.title),
        escapeCsv(a.category),
        escapeCsv(a.due_date),
        escapeCsv(a.completed_at ? a.completed_at.split('T')[0] : ''),
        escapeCsv(a.workflow_status || a.status),
        escapeCsv(a.grading_mode || 'points'),
        escapeCsv(a.total_problems),
        escapeCsv(a.missed_problems),
        escapeCsv(a.points_earned),
        escapeCsv(a.points_possible),
        escapeCsv(a.percentage_score),
        escapeCsv(a.letter_grade),
        escapeCsv(a.teacher_comments),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `casita-capital-school-academic-records-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported complete student academic records to CSV');
  };

  const handleQuickRevertApiOverride = async (
    assignment: GradebookAssignment,
    mode: 'original_api' | 'blank'
  ) => {
    setRevertingOverrideId(assignment.id);
    try {
      const updated = await revertApiAssignmentOverride(assignment, mode);
      if (updated) {
        setAssignments((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
    } finally {
      setRevertingOverrideId(null);
    }
  };

  // Helper to render an inline score editor for an assignment row
  const renderInlineScoreControls = (a: GradebookAssignment, sub?: SubjectWithGrading) => {
    const typeInfo = typeMap.get(a.category);
    const mode: ScoringMode = a.grading_mode || typeInfo?.scoring_mode || 'points';
    const moodleMeta = parseAssignmentMoodleMeta(a.state_standards);
    const isApiSynced = isAssignmentApiSynced(a, sub);
    const isOverridden = Boolean(moodleMeta?.manual_override);
    const hasPct = typeof a.percentage_score === 'number';
    const isEditingInline = Boolean(editingInlineScoreIds[a.id]);

    if (a.is_graded === false) {
      return (
        <Chip
          size="small"
          label="Review Only"
          variant="outlined"
          sx={{ fontSize: '0.75rem', fontWeight: 500 }}
        />
      );
    }

    // API-Synced Grades Protection: Never allow direct inline editing without the warning modal
    if (isApiSynced) {
      if (isOverridden) {
        return (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => setApiOverrideWarningAssignment(a)}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.75rem',
                py: 0.25,
                px: 1,
                whiteSpace: 'nowrap',
              }}
            >
              Edit Override
            </Button>
            <Tooltip title="Remove manual override and restore Original API Value">
              <Button
                size="small"
                variant="outlined"
                color="primary"
                disabled={revertingOverrideId === a.id}
                startIcon={<RotateCcw size={12} />}
                onClick={() => handleQuickRevertApiOverride(a, 'original_api')}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Revert
              </Button>
            </Tooltip>
            <Tooltip title="Remove manual override and clear grade to Blank (Ungraded)">
              <Button
                size="small"
                variant="text"
                color="inherit"
                disabled={revertingOverrideId === a.id}
                onClick={() => handleQuickRevertApiOverride(a, 'blank')}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 0.75,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                Clear
              </Button>
            </Tooltip>
          </Stack>
        );
      }

      return (
        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
          <Chip
            size="small"
            icon={<Lock size={11} />}
            label="API Synced"
            color="info"
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 700 }}
          />
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setApiOverrideWarningAssignment(a)}
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.75rem',
              borderColor: 'divider',
              py: 0.25,
              px: 1,
              whiteSpace: 'nowrap',
            }}
          >
            Override…
          </Button>
        </Stack>
      );
    }

    if (hasPct && !isEditingInline) {
      return (
        <Button
          size="small"
          variant="text"
          color="primary"
          onClick={() =>
            setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: true }))
          }
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.25,
            px: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Edit Score
        </Button>
      );
    }

    const draft = inlineDrafts[a.id] || {
      total_problems:
        typeof a.total_problems === 'number' ? String(a.total_problems) : '',
      missed_problems:
        typeof a.missed_problems === 'number' ? String(a.missed_problems) : '',
      points_earned:
        typeof a.points_earned === 'number' ? String(a.points_earned) : '',
      points_possible: String(a.points_possible ?? 100),
    };

    if (mode === 'problems_calculator') {
      return (
        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
          <TextField
            size="small"
            type="number"
            label="Total"
            placeholder="20"
            InputLabelProps={{ shrink: true }}
            value={draft.total_problems}
            onChange={(e) =>
              setInlineDrafts((prev) => ({
                ...prev,
                [a.id]: { ...draft, total_problems: e.target.value },
              }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveInlineScore(a);
              }
            }}
            sx={{ width: 70 }}
          />
          <TextField
            size="small"
            type="number"
            label="Missed"
            placeholder="1"
            InputLabelProps={{ shrink: true }}
            value={draft.missed_problems}
            onChange={(e) =>
              setInlineDrafts((prev) => ({
                ...prev,
                [a.id]: { ...draft, missed_problems: e.target.value },
              }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveInlineScore(a);
              }
            }}
            sx={{ width: 70 }}
          />
          <Button
            size="small"
            variant="outlined"
            color="primary"
            disabled={savingInlineId === a.id}
            onClick={() => handleSaveInlineScore(a)}
            sx={{ fontWeight: 600, textTransform: 'none', minWidth: 56, fontSize: '0.75rem' }}
          >
            {savingInlineId === a.id ? '...' : 'Save'}
          </Button>
          {isEditingInline && (
            <IconButton
              size="small"
              aria-label="Cancel score edit"
              onClick={() =>
                setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: false }))
              }
            >
              <X size={14} />
            </IconButton>
          )}
        </Stack>
      );
    }

    return (
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
        <TextField
          size="small"
          type="number"
          label="Earned"
          InputLabelProps={{ shrink: true }}
          value={draft.points_earned}
          onChange={(e) =>
            setInlineDrafts((prev) => ({
              ...prev,
              [a.id]: { ...draft, points_earned: e.target.value },
            }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveInlineScore(a);
            }
          }}
          sx={{ width: 74 }}
        />
        <Typography variant="caption" color="text.secondary">
          /
        </Typography>
        <TextField
          size="small"
          type="number"
          label="Possible"
          InputLabelProps={{ shrink: true }}
          value={draft.points_possible}
          onChange={(e) =>
            setInlineDrafts((prev) => ({
              ...prev,
              [a.id]: { ...draft, points_possible: e.target.value },
            }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveInlineScore(a);
            }
          }}
          sx={{ width: 74 }}
        />
        <Button
          size="small"
          variant="outlined"
          color="primary"
          disabled={savingInlineId === a.id}
          onClick={() => handleSaveInlineScore(a)}
          sx={{ fontWeight: 600, textTransform: 'none', minWidth: 56, fontSize: '0.75rem' }}
        >
          {savingInlineId === a.id ? '...' : 'Save'}
        </Button>
        {isEditingInline && (
          <IconButton
            size="small"
            aria-label="Cancel score edit"
            onClick={() =>
              setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: false }))
            }
          >
            <X size={14} />
          </IconButton>
        )}
      </Stack>
    );
  };

  if (loading) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={116} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }

  return (
    <Box
      onClick={() => {
        if (openMenuSubjectId) setOpenMenuSubjectId(null);
        if (globalSetupMenuOpen) setGlobalSetupMenuOpen(false);
        if (confirmDeleteAssignmentId) setConfirmDeleteAssignmentId(null);
      }}
    >
      {/* CLEAN TOP HEADER & NAVIGATION */}
      <Card
        className="no-print"
        elevation={0}
        sx={{
          p: 2.5,
          pb: 0,
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'visible',
          position: 'relative',
          zIndex: globalSetupMenuOpen ? 100 : 20,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          pb={2}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Gradebook &amp; Reports
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`GPA ${overallMetrics.cumulativeUnweightedGpa.toFixed(2)}`}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    fontVariantNumeric: 'tabular-nums',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                  }}
                />
                <Chip
                  size="small"
                  label={`${overallMetrics.totalCredits.toFixed(2)} Credits`}
                  variant="outlined"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                {overallMetrics.totalNeedsGrading > 0 && (
                  <Chip
                    size="small"
                    label={`${overallMetrics.totalNeedsGrading} Need Grading`}
                    onClick={() => router.push('/assignments?status=needs_grading')}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      fontVariantNumeric: 'tabular-nums',
                      bgcolor: alpha(theme.palette.warning.main, 0.12),
                      color: 'warning.dark',
                      cursor: 'pointer',
                    }}
                  />
                )}
                {overallMetrics.totalPendingGrades > 0 && (
                  <Chip
                    size="small"
                    icon={<CloudDownload size={12} />}
                    label={`${overallMetrics.totalPendingGrades} Pending Grades`}
                    onClick={() => router.push('/assignments?status=pending_grades')}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      fontVariantNumeric: 'tabular-nums',
                      bgcolor: alpha(theme.palette.info.main, 0.12),
                      color: 'info.dark',
                      cursor: 'pointer',
                    }}
                  />
                )}
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Current class standing, attendance hours, report cards, and transcripts.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
            <TextField
              select
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              size="small"
              label="Academic Term"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              sx={{ minWidth: 170 }}
            >
              <option value="Semester 1 (Fall)">Semester 1 (Fall)</option>
              <option value="Semester 2 (Spring)">Semester 2 (Spring)</option>
              <option value="Quarter 1">Quarter 1</option>
              <option value="Quarter 2">Quarter 2</option>
              <option value="Quarter 3">Quarter 3</option>
              <option value="Quarter 4">Quarter 4</option>
            </TextField>

            {/* Setup & Structure Dropdown Menu */}
            <Box sx={{ position: 'relative', zIndex: 30 }} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<Settings size={15} />}
                endIcon={<ChevronDown size={14} />}
                onClick={() => {
                  setOpenMenuSubjectId(null);
                  setGlobalSetupMenuOpen((prev) => !prev);
                }}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: 'divider',
                  height: 38,
                  whiteSpace: 'nowrap',
                }}
              >
                Setup &amp; Rules
              </Button>
              {globalSetupMenuOpen && (
                <Paper
                  elevation={0}
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 1350,
                    minWidth: 325,
                    width: 'max-content',
                    p: 0.75,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.16)',
                  }}
                >
                  <Stack spacing={0.25}>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Sliders size={15} />}
                      onClick={() => {
                        setGlobalSetupMenuOpen(false);
                        setPolicyModalSubjectId(subjects[0]?.id);
                        setPolicyModalOpen(true);
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Class Grading &amp; Participation Rules
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Layers size={15} />}
                      onClick={() => {
                        setGlobalSetupMenuOpen(false);
                        setTypesModalOpen(true);
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Assignment Types &amp; Definitions
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Repeat size={15} />}
                      onClick={() => {
                        setGlobalSetupMenuOpen(false);
                        router.push('/assignments?tab=recurring');
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Recurring Assignment Rules
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<BookOpen size={15} />}
                      onClick={() => {
                        setGlobalSetupMenuOpen(false);
                        router.push('/assignments?tab=imported_pending');
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Imported Pending Assignments
                    </Button>
                    <Divider sx={{ my: 0.5 }} />
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Download size={15} />}
                      onClick={() => {
                        setGlobalSetupMenuOpen(false);
                        handleExportCsv();
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Export Academic Records (CSV)
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Box>

            <Button
              variant="outlined"
              color="secondary"
              size="small"
              startIcon={
                syncingPortalGrades ? <CircularProgress size={14} /> : <CloudDownload size={15} />
              }
              disabled={syncingPortalGrades}
              onClick={handleSyncPortalGrades}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                px: 1.75,
                height: 38,
                whiteSpace: 'nowrap',
              }}
            >
              {syncingPortalGrades ? 'Syncing Portal...' : 'Sync Portal Grades'}
            </Button>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingAssignment(null);
                setEditingTemplate(null);
                setModalInitialValues({
                  subject_id: subjects[0]?.id,
                  term_name: selectedTerm,
                  academic_year: selectedAcademicYear,
                });
                setUnifiedModalOpen(true);
              }}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                px: 2,
                height: 38,
                whiteSpace: 'nowrap',
              }}
            >
              Add Assignment
            </Button>
          </Stack>
        </Stack>

        {/* STREAMLINED NAVIGATION TABS */}
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {(
              [
                {
                  value: 'gradebook',
                  label: 'Class Gradebook',
                  icon: <GraduationCap size={16} />,
                },
                {
                  value: 'attendance',
                  label: 'Attendance & Hours',
                  icon: <Clock size={16} />,
                },
                {
                  value: 'reports',
                  label: 'Report Card & Transcript',
                  icon: <Award size={16} />,
                },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.value;
              return (
                <Button
                  key={tab.value}
                  startIcon={tab.icon}
                  onClick={() => setActiveTab(tab.value)}
                  sx={{
                    fontWeight: isSelected ? 700 : 500,
                    textTransform: 'none',
                    px: 2,
                    py: 1.25,
                    borderRadius: 0,
                    borderBottom: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </Stack>

          <Button
            size="small"
            variant="text"
            color="primary"
            startIcon={<FileText size={15} />}
            onClick={() => router.push('/assignments')}
            sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            School Assignments Manager &rarr;
          </Button>
        </Box>
      </Card>

      {/* =====================================================================
          TAB 1 (DEFAULT): CLEAN CLASS GRADEBOOK TABLE WITH MENUS & INLINE DRAWER
          ===================================================================== */}
      {activeTab === 'gradebook' && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'visible',
          }}
        >
          <TableContainer sx={{ overflow: 'visible' }}>
            <Table sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(theme.palette.text.primary, 0.02),
                  }}
                >
                  <TableCell
                    sx={{
                      py: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CLASS / SUBJECT
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CURRENT GRADE
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    STATUS &amp; PROGRESS
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    HOURS &amp; CREDITS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      py: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CLASS STRUCTURE &amp; ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subjectSummaries.map((sum, idx) => {
                  const sub = subjectMap.get(sum.subject_id)!;
                  const subRecCfg = parseRecurringConfig(sub.recurring_config, sub.name);
                  const officialCourseName =
                    getOfficialCourseSubtitle(subRecCfg) ||
                    sum.moodle_report?.official_course_name ||
                    '';
                  const isExpanded = expandedSubjectIds.includes(sum.subject_id);
                  const isMenuOpen = openMenuSubjectId === sum.subject_id;
                  const classAssignments = assignments.filter(
                    (a) =>
                      a.subject_id === sum.subject_id &&
                      a.workflow_status !== 'staged' &&
                      a.workflow_status !== 'ignored'
                  );

                  const gradeColor =
                    sum.effective_percentage === null
                      ? theme.palette.text.secondary
                      : sum.effective_percentage >= 90
                      ? theme.palette.success.dark
                      : sum.effective_percentage >= 80
                      ? theme.palette.primary.main
                      : sum.effective_percentage >= 70
                      ? theme.palette.warning.dark
                      : theme.palette.error.main;

                  const gradeBg =
                    sum.effective_percentage === null
                      ? alpha(theme.palette.text.primary, 0.05)
                      : sum.effective_percentage >= 90
                      ? alpha(theme.palette.success.main, 0.12)
                      : sum.effective_percentage >= 80
                      ? alpha(theme.palette.primary.main, 0.1)
                      : sum.effective_percentage >= 70
                      ? alpha(theme.palette.warning.main, 0.14)
                      : alpha(theme.palette.error.main, 0.12);

                  return (
                    <React.Fragment key={sum.subject_id}>
                      <TableRow
                        hover
                        onClick={() => toggleExpandSubject(sum.subject_id)}
                        sx={{
                          cursor: 'pointer',
                          '& > td': { py: 2 },
                          bgcolor: isExpanded
                            ? alpha(theme.palette.primary.main, 0.02)
                            : 'transparent',
                        }}
                      >
                        {/* CLASS / SUBJECT */}
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <IconButton
                              size="small"
                              aria-label={
                                isExpanded
                                  ? `Collapse ${sum.subject_name}`
                                  : `Expand ${sum.subject_name}`
                              }
                              sx={{ p: 0.25, color: 'text.secondary' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandSubject(sum.subject_id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </IconButton>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: sub.color,
                                flexShrink: 0,
                              }}
                            />
                            <Box>
                              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {sum.subject_name}
                                </Typography>
                                {sum.moodle_report && (
                                  <Chip
                                    icon={<CloudDownload size={11} />}
                                    label="API Sync'd"
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                                  />
                                )}
                              </Stack>
                              {officialCourseName && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    fontStyle: 'italic',
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {officialCourseName}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {sum.policy.broader_discipline}
                                {sum.policy.course_level !== 'standard'
                                  ? ` • ${sum.policy.course_level.toUpperCase()}`
                                  : ''}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>

                        {/* CURRENT GRADE */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                px: 1.25,
                                py: 0.4,
                                borderRadius: 1,
                                bgcolor: gradeBg,
                                color: gradeColor,
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {sum.formatted_display}
                            </Box>
                            {sum.is_overridden && (
                              <Chip
                                size="small"
                                label="Override"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                              />
                            )}
                          </Stack>
                        </TableCell>

                        {/* STATUS & PROGRESS */}
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {sum.is_api_synced ? (
                              sum.pending_api_count > 0 ? (
                                <Chip
                                  size="small"
                                  icon={<CloudDownload size={12} />}
                                  label={`${sum.pending_api_count} Pending Grades`}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: alpha(theme.palette.info.main, 0.12),
                                    color: 'info.dark',
                                  }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="All Synced"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: alpha(theme.palette.success.main, 0.1),
                                    color: 'success.dark',
                                  }}
                                />
                              )
                            ) : sum.needs_grading_count > 0 ? (
                              <Chip
                                size="small"
                                label={`${sum.needs_grading_count} Need Grading`}
                                sx={{
                                  height: 22,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(theme.palette.warning.main, 0.12),
                                  color: 'warning.dark',
                                }}
                              />
                            ) : sum.graded_count > 0 ? (
                              <Chip
                                size="small"
                                label="Up to Date"
                                sx={{
                                  height: 22,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(theme.palette.success.main, 0.1),
                                  color: 'success.dark',
                                }}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="No Graded Items"
                                sx={{
                                  height: 22,
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                                  color: 'text.secondary',
                                }}
                              />
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                            >
                              {sum.graded_count} graded • {sum.points_earned_so_far}/
                              {sum.policy.calculation_basis === 'preset_total_points'
                                ? sum.preset_total_points
                                : sum.points_possible_entered_so_far}{' '}
                              pts
                            </Typography>
                          </Stack>
                          {sum.moodle_report && sum.moodle_report.categories.length > 0 && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={0.5}>
                              {sum.moodle_report.categories
                                .filter((c) => !c.is_ungraded_bucket)
                                .map((cat) => (
                                  <Chip
                                    key={cat.category_name}
                                    size="small"
                                    variant="outlined"
                                    label={`${cat.category_name}: ${
                                      cat.percentage_numeric !== null
                                        ? `${cat.percentage_numeric.toFixed(2)}%`
                                        : '—'
                                    } (${cat.weight_formatted})`}
                                    sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                                  />
                                ))}
                            </Stack>
                          )}
                        </TableCell>

                        {/* HOURS & CREDITS */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {sum.effective_credits.toFixed(2)} cr
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {sum.instructional_hours} hrs logged
                          </Typography>
                        </TableCell>

                        {/* ACTIONS & CLASS MENU */}
                        <TableCell
                          align="right"
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            position: 'relative',
                            zIndex: isMenuOpen ? 50 : 'auto',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={0.75}
                            justifyContent="flex-end"
                            alignItems="center"
                          >
                            <Button
                              size="small"
                              variant={isExpanded ? 'contained' : 'outlined'}
                              color={isExpanded ? 'primary' : 'inherit'}
                              onClick={() => toggleExpandSubject(sum.subject_id)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                borderColor: 'divider',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Assignments (
                              {sum.moodle_report
                                ? Math.max(
                                    classAssignments.length,
                                    sum.moodle_report.items.length
                                  )
                                : classAssignments.length}
                              )
                            </Button>

                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<Plus size={14} />}
                              onClick={() => {
                                setEditingAssignment(null);
                                setEditingTemplate(null);
                                setModalInitialValues({
                                  subject_id: sub.id,
                                  term_name: selectedTerm,
                                  academic_year: selectedAcademicYear,
                                });
                                setUnifiedModalOpen(true);
                              }}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Add
                            </Button>

                            {/* Per-Class Structure & Setup Menu */}
                            <Box sx={{ position: 'relative', zIndex: isMenuOpen ? 60 : 'auto' }}>
                              <Tooltip title="Class Setup & Structure Menu">
                                <IconButton
                                  size="small"
                                  aria-label={`Class setup menu for ${sub.name}`}
                                  onClick={() => {
                                    setGlobalSetupMenuOpen(false);
                                    setOpenMenuSubjectId(
                                      isMenuOpen ? null : sum.subject_id
                                    );
                                  }}
                                  sx={{
                                    border: '1px solid',
                                    borderColor: isMenuOpen ? 'primary.main' : 'divider',
                                    borderRadius: 1,
                                    p: 0.65,
                                  }}
                                >
                                  <MoreHorizontal size={16} />
                                </IconButton>
                              </Tooltip>

                              {isMenuOpen && (
                                <Paper
                                  elevation={0}
                                  sx={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 'calc(100% + 6px)',
                                    zIndex: 1350,
                                    minWidth: 310,
                                    width: 'max-content',
                                    p: 0.75,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18)',
                                    textAlign: 'left',
                                  }}
                                >
                                  <Box px={1.25} py={0.75}>
                                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                                      {sub.name.toUpperCase()} SETUP &amp; STRUCTURE
                                    </Typography>
                                  </Box>
                                  <Stack spacing={0.25}>
                                    <Button
                                      fullWidth
                                      size="small"
                                      color="inherit"
                                      startIcon={<Sliders size={14} />}
                                      onClick={() => {
                                        setOpenMenuSubjectId(null);
                                        setPolicyModalSubjectId(sub.id);
                                        setPolicyModalOpen(true);
                                      }}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        px: 1.25,
                                        py: 0.75,
                                      }}
                                    >
                                      Grading &amp; Participation Policy
                                    </Button>
                                    <Button
                                      fullWidth
                                      size="small"
                                      color="inherit"
                                      startIcon={<Repeat size={14} />}
                                      onClick={() => {
                                        setOpenMenuSubjectId(null);
                                        setEditingAssignment(null);
                                        setEditingTemplate(null);
                                        setModalInitialValues({
                                          subject_id: sub.id,
                                          entry_mode: 'recurring_template',
                                        });
                                        setUnifiedModalOpen(true);
                                      }}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        px: 1.25,
                                        py: 0.75,
                                      }}
                                    >
                                      Add Recurring Graded Rule
                                    </Button>
                                    <Button
                                      fullWidth
                                      size="small"
                                      color="inherit"
                                      startIcon={<Edit3 size={14} />}
                                      onClick={() => {
                                        setOpenMenuSubjectId(null);
                                        handleOpenTermOverrideModal(sub);
                                      }}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        px: 1.25,
                                        py: 0.75,
                                      }}
                                    >
                                      Final Grade Override &amp; Notes
                                    </Button>
                                    <Button
                                      fullWidth
                                      size="small"
                                      color="inherit"
                                      startIcon={<BookOpen size={14} />}
                                      onClick={() => {
                                        setOpenMenuSubjectId(null);
                                        router.push(
                                          `/assignments?tab=imported_pending&subject=${sub.id}`
                                        );
                                      }}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        px: 1.25,
                                        py: 0.75,
                                      }}
                                    >
                                      Import from Course Syllabus
                                    </Button>
                                    <Divider sx={{ my: 0.5 }} />
                                    <Stack direction="row" spacing={0.5} px={0.5}>
                                      <Button
                                        fullWidth
                                        size="small"
                                        color="inherit"
                                        disabled={idx === 0}
                                        startIcon={<ArrowUp size={13} />}
                                        onClick={() => {
                                          setOpenMenuSubjectId(null);
                                          handleMoveSubjectOrder(idx, 'up');
                                        }}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                      >
                                        Move Up
                                      </Button>
                                      <Button
                                        fullWidth
                                        size="small"
                                        color="inherit"
                                        disabled={idx === subjectSummaries.length - 1}
                                        startIcon={<ArrowDown size={13} />}
                                        onClick={() => {
                                          setOpenMenuSubjectId(null);
                                          handleMoveSubjectOrder(idx, 'down');
                                        }}
                                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                      >
                                        Move Down
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                      </TableRow>

                      {/* EXPANDABLE INLINE CLASS ASSIGNMENTS & GRADE CARD */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            sx={{
                              p: 0,
                              bgcolor: alpha(theme.palette.text.primary, 0.015),
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Box sx={{ p: 2.5, pl: { xs: 2, md: 5 } }}>
                              {/* Top Action Bar for Expanded Subject */}
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ sm: 'center' }}
                                spacing={1.5}
                                mb={1.75}
                              >
                                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                                  <Typography variant="subtitle1" fontWeight={800}>
                                    {sum.moodle_report
                                      ? sum.moodle_report.official_course_name
                                      : `${sub.name} Grade Card`}
                                  </Typography>
                                  {sum.moodle_report && (
                                    <Chip
                                      icon={<CloudDownload size={12} />}
                                      label={`Portal Code: ${sum.moodle_report.course_shortname}`}
                                      size="small"
                                      color="info"
                                      variant="outlined"
                                      sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                                    />
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    {sum.moodle_report
                                      ? `All ${sum.moodle_report.items.length} course assessments & categories synced from Memoria Academy`
                                      : `${classAssignments.length} assignments • ${
                                          sum.policy.calculation_basis === 'preset_total_points'
                                            ? `Preset Pool (${sum.policy.preset_total_points} pts)`
                                            : 'Running Ratio'
                                        }`}
                                  </Typography>
                                </Stack>

                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {sum.moodle_report && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<RefreshCw size={13} />}
                                      disabled={syncingPortalGrades}
                                      onClick={handleSyncPortalGrades}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {syncingPortalGrades ? 'Syncing...' : 'Refresh Portal'}
                                    </Button>
                                  )}
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<Sliders size={14} />}
                                    onClick={() => {
                                      setPolicyModalSubjectId(sub.id);
                                      setPolicyModalOpen(true);
                                    }}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      borderColor: 'divider',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Class Grading Policy
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<Plus size={14} />}
                                    onClick={() => {
                                      setEditingAssignment(null);
                                      setEditingTemplate(null);
                                      setModalInitialValues({
                                        subject_id: sub.id,
                                        term_name: selectedTerm,
                                        academic_year: selectedAcademicYear,
                                      });
                                      setUnifiedModalOpen(true);
                                    }}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Add {sub.name} Assignment
                                  </Button>
                                </Stack>
                              </Stack>

                              {!sum.moodle_report && classAssignments.length === 0 ? (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 3,
                                    textAlign: 'center',
                                    borderRadius: 1,
                                    bgcolor: 'background.paper',
                                  }}
                                >
                                  <Typography variant="body2" color="text.secondary" mb={1.5}>
                                    No assignments recorded for {sub.name} yet.
                                  </Typography>
                                  <Stack direction="row" spacing={1} justifyContent="center">
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Plus size={14} />}
                                      onClick={() => {
                                        setEditingAssignment(null);
                                        setEditingTemplate(null);
                                        setModalInitialValues({
                                          subject_id: sub.id,
                                          term_name: selectedTerm,
                                          academic_year: selectedAcademicYear,
                                        });
                                        setUnifiedModalOpen(true);
                                      }}
                                      sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                      Create Assignment
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="inherit"
                                      startIcon={<Repeat size={14} />}
                                      onClick={() => {
                                        setEditingAssignment(null);
                                        setEditingTemplate(null);
                                        setModalInitialValues({
                                          subject_id: sub.id,
                                          entry_mode: 'recurring_template',
                                        });
                                        setUnifiedModalOpen(true);
                                      }}
                                      sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                      Set Up Recurring Rule
                                    </Button>
                                  </Stack>
                                </Paper>
                              ) : (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    bgcolor: 'background.paper',
                                  }}
                                >
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow
                                        sx={{
                                          bgcolor: alpha(theme.palette.text.primary, 0.025),
                                          borderBottom: '2px solid',
                                          borderColor: 'divider',
                                        }}
                                      >
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            width: '38%',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          ASSIGNMENT / ITEM
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          DUE DATE
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          WEIGHT
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          RANGE
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          GRADE
                                        </TableCell>
                                        <TableCell
                                          align="right"
                                          sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            letterSpacing: '0.04em',
                                            py: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          SCORE / ACTIONS
                                        </TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {/* TOP-LEVEL COURSE HEADER ROW */}
                                      <TableRow
                                        sx={{
                                          bgcolor: alpha(theme.palette.text.primary, 0.03),
                                        }}
                                      >
                                        <TableCell colSpan={6} sx={{ py: 1.1 }}>
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <ChevronDown size={15} />
                                            <Typography variant="body2" fontWeight={700}>
                                              {sum.moodle_report
                                                ? sum.moodle_report.official_course_name
                                                : sub.name}
                                            </Typography>
                                          </Stack>
                                        </TableCell>
                                      </TableRow>

                                      {/* TOP COURSE TOTAL AGGREGATION ROW */}
                                      <TableRow
                                        sx={{
                                          bgcolor: 'background.paper',
                                          borderBottom: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      >
                                        <TableCell sx={{ pl: 3.5, py: 1.25 }}>
                                          <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Box
                                              sx={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'text.secondary',
                                                fontWeight: 800,
                                                fontSize: '1.125rem',
                                                flexShrink: 0,
                                              }}
                                            >
                                              &Sigma;
                                            </Box>
                                            <Box>
                                              <Typography
                                                variant="caption"
                                                sx={{
                                                  display: 'block',
                                                  fontSize: '0.75rem',
                                                  fontWeight: 700,
                                                  color: 'text.secondary',
                                                  textTransform: 'uppercase',
                                                  letterSpacing: '0.04em',
                                                  lineHeight: 1.1,
                                                }}
                                              >
                                                AGGREGATION
                                              </Typography>
                                              <Typography variant="body2" fontWeight={700}>
                                                Course total
                                              </Typography>
                                            </Box>
                                          </Stack>
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontVariantNumeric: 'tabular-nums',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <Typography variant="body2" color="text.secondary">
                                            &mdash;
                                          </Typography>
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontVariantNumeric: 'tabular-nums',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <Typography variant="body2" color="text.secondary">
                                            100.00 %
                                          </Typography>
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontVariantNumeric: 'tabular-nums',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <Typography variant="body2" color="text.secondary">
                                            0&ndash;100
                                          </Typography>
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontVariantNumeric: 'tabular-nums',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <Typography variant="body2" fontWeight={700}>
                                            {sum.moodle_report
                                              ? sum.moodle_report.course_total_percentage !== null
                                                ? `${sum.moodle_report.course_total_percentage.toFixed(2)} %`
                                                : '-'
                                              : sum.effective_percentage !== null
                                              ? `${sum.effective_percentage.toFixed(2)} %`
                                              : '-'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} />
                                      </TableRow>

                                      {/* CASE A: API-SYNCED MOODLE GRADE CARD HIERARCHY */}
                                      {sum.moodle_report ? (
                                        <>
                                          {sum.moodle_report.categories.map((cat) => {
                                            const catKey = `${sub.id}::${cat.category_name}`;
                                            const isCatCollapsed = Boolean(
                                              collapsedGradeCategories[catKey]
                                            );
                                            const catItems = sum.moodle_report
                                              ? [...sum.moodle_report.items]
                                                  .filter(
                                                    (it) =>
                                                      it.category_name.toLowerCase() ===
                                                      cat.category_name.toLowerCase()
                                                  )
                                                  .sort((a, b) => {
                                                    const wa =
                                                      typeof a.week_number === 'number'
                                                        ? a.week_number
                                                        : Number.MAX_SAFE_INTEGER;
                                                    const wb =
                                                      typeof b.week_number === 'number'
                                                        ? b.week_number
                                                        : Number.MAX_SAFE_INTEGER;
                                                    if (wa !== wb) return wa - wb;
                                                    const da = a.due_date || '9999-12-31';
                                                    const db = b.due_date || '9999-12-31';
                                                    if (da !== db) return da.localeCompare(db);
                                                    return (
                                                      (a.cmid ?? a.item_id ?? 0) -
                                                      (b.cmid ?? b.item_id ?? 0)
                                                    );
                                                  })
                                              : [];

                                            return (
                                              <React.Fragment key={cat.category_name}>
                                                {/* CATEGORY HEADER ROW */}
                                                <TableRow
                                                  hover
                                                  onClick={() =>
                                                    toggleCollapseCategory(
                                                      sub.id,
                                                      cat.category_name
                                                    )
                                                  }
                                                  sx={{
                                                    cursor: 'pointer',
                                                    bgcolor: alpha(
                                                      theme.palette.text.primary,
                                                      0.03
                                                    ),
                                                  }}
                                                >
                                                  <TableCell colSpan={6} sx={{ pl: 3.5, py: 1.1 }}>
                                                    <Stack
                                                      direction="row"
                                                      spacing={1}
                                                      alignItems="center"
                                                    >
                                                      {isCatCollapsed ? (
                                                        <ChevronRight size={15} />
                                                      ) : (
                                                        <ChevronDown size={15} />
                                                      )}
                                                      <Typography variant="body2" fontWeight={700}>
                                                        {cat.category_name}
                                                      </Typography>
                                                    </Stack>
                                                  </TableCell>
                                                </TableRow>

                                                {/* CATEGORY ITEMS */}
                                                {!isCatCollapsed &&
                                                  catItems.map((item) => {
                                                    const cleanItemTitle = item.item_name
                                                      .replace(/--DUE[\s\S]*$/i, '')
                                                      .trim();
                                                    const matchedAssignment =
                                                      classAssignments.find((ca) => {
                                                        const mm = parseAssignmentMoodleMeta(
                                                          ca.state_standards
                                                        );
                                                        if (
                                                          mm?.moodle_cmid &&
                                                          item.cmid &&
                                                          mm.moodle_cmid === item.cmid
                                                        ) {
                                                          return true;
                                                        }
                                                        return (
                                                          ca.title.toLowerCase() ===
                                                            item.item_name.toLowerCase() ||
                                                          ca.title.toLowerCase() ===
                                                            cleanItemTitle.toLowerCase()
                                                        );
                                                      });

                                                    const matchedMeta = matchedAssignment
                                                      ? parseAssignmentMoodleMeta(
                                                          matchedAssignment.state_standards
                                                        )
                                                      : null;
                                                    const isManualOverride = Boolean(
                                                      matchedMeta?.manual_override
                                                    );

                                                    const isAssignMod =
                                                      item.item_module === 'assign';
                                                    const badgeBg = isAssignMod
                                                      ? theme.palette.primary.main
                                                      : theme.palette.secondary.main;
                                                    const overlineLabel = isAssignMod
                                                      ? 'ASSIGNMENT'
                                                      : 'QUIZ';

                                                    const displayGrade = isManualOverride
                                                      ? matchedAssignment &&
                                                        typeof matchedAssignment.points_earned ===
                                                          'number'
                                                        ? matchedAssignment.points_earned.toFixed(
                                                            2
                                                          )
                                                        : '-'
                                                      : matchedAssignment &&
                                                        typeof matchedAssignment.points_earned ===
                                                          'number'
                                                      ? matchedAssignment.points_earned.toFixed(
                                                          2
                                                        )
                                                      : item.grade_formatted || '-';

                                                    const originalApiLabel =
                                                      matchedMeta?.api_grade_raw !== null &&
                                                      matchedMeta?.api_grade_raw !== undefined
                                                        ? matchedMeta.api_grade_raw.toFixed(2)
                                                        : item.grade_formatted || '—';

                                                    const displayFeedback =
                                                      matchedAssignment?.teacher_comments ||
                                                      item.feedback ||
                                                      '';
                                                    const effectiveDueDate =
                                                      matchedAssignment?.due_date ||
                                                      item.due_date ||
                                                      null;

                                                    return (
                                                      <TableRow
                                                        key={
                                                          item.cmid ||
                                                          item.item_id ||
                                                          item.item_name
                                                        }
                                                        hover
                                                        sx={
                                                          isManualOverride
                                                            ? {
                                                                bgcolor: alpha(
                                                                  theme.palette.warning.main,
                                                                  0.06
                                                                ),
                                                              }
                                                            : undefined
                                                        }
                                                      >
                                                        {/* 1. ASSIGNMENT / ITEM (+ Feedback below title) */}
                                                        <TableCell sx={{ pl: 5.5, py: 1.35 }}>
                                                          <Stack
                                                            direction="row"
                                                            spacing={1.5}
                                                            alignItems="flex-start"
                                                          >
                                                            <Box
                                                              sx={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: 1,
                                                                bgcolor: badgeBg,
                                                                color: '#fff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                mt: 0.25,
                                                              }}
                                                            >
                                                              {isAssignMod ? (
                                                                <FileText size={14} />
                                                              ) : (
                                                                <CheckSquare size={14} />
                                                              )}
                                                            </Box>
                                                            <Box>
                                                              <Typography
                                                                variant="caption"
                                                                sx={{
                                                                  display: 'block',
                                                                  fontSize: '0.75rem',
                                                                  fontWeight: 700,
                                                                  color: 'text.secondary',
                                                                  textTransform: 'uppercase',
                                                                  letterSpacing: '0.04em',
                                                                  lineHeight: 1.2,
                                                                }}
                                                              >
                                                                {overlineLabel}
                                                                {item.week_number
                                                                  ? ` • WEEK ${item.week_number}`
                                                                  : ''}
                                                              </Typography>
                                                              <Stack
                                                                direction="row"
                                                                spacing={0.75}
                                                                alignItems="center"
                                                                flexWrap="wrap"
                                                              >
                                                                <Typography
                                                                  variant="body2"
                                                                  fontWeight={700}
                                                                  sx={{
                                                                    color: 'text.primary',
                                                                  }}
                                                                >
                                                                  {cleanItemTitle || item.item_name}
                                                                </Typography>
                                                                {isManualOverride && (
                                                                  <Chip
                                                                    size="small"
                                                                    icon={
                                                                      <ShieldAlert size={11} />
                                                                    }
                                                                    label="MANUAL OVERRIDE"
                                                                    color="error"
                                                                    sx={{
                                                                      height: 20,
                                                                      fontSize: '0.75rem',
                                                                      fontWeight: 700,
                                                                    }}
                                                                  />
                                                                )}
                                                              </Stack>
                                                              {displayFeedback && (
                                                                <Typography
                                                                  variant="caption"
                                                                  color="text.secondary"
                                                                  sx={{
                                                                    display: 'block',
                                                                    mt: 0.35,
                                                                    fontStyle: 'italic',
                                                                  }}
                                                                >
                                                                  Feedback: {displayFeedback}
                                                                </Typography>
                                                              )}
                                                            </Box>
                                                          </Stack>
                                                        </TableCell>

                                                        {/* 2. DUE DATE (Single Row) */}
                                                        <TableCell
                                                          sx={{
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'nowrap',
                                                          }}
                                                        >
                                                          <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            sx={{ whiteSpace: 'nowrap' }}
                                                          >
                                                            {formatCompactDate(effectiveDueDate)}
                                                          </Typography>
                                                        </TableCell>

                                                        {/* 3. WEIGHT (+ Contribution sub-caption) */}
                                                        <TableCell
                                                          sx={{
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'nowrap',
                                                          }}
                                                        >
                                                          <Typography variant="body2" fontWeight={600}>
                                                            {item.weight_formatted || '0.00 %'}
                                                          </Typography>
                                                          {item.contribution_formatted &&
                                                            item.contribution_formatted !== '-' && (
                                                              <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                  display: 'block',
                                                                  whiteSpace: 'nowrap',
                                                                }}
                                                              >
                                                                Contrib: {item.contribution_formatted}
                                                              </Typography>
                                                            )}
                                                        </TableCell>

                                                        {/* 4. RANGE */}
                                                        <TableCell
                                                          sx={{
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'nowrap',
                                                          }}
                                                        >
                                                          <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                          >
                                                            {item.range_formatted || '0–100'}
                                                          </Typography>
                                                        </TableCell>

                                                        {/* 5. GRADE */}
                                                        <TableCell
                                                          sx={{
                                                            fontVariantNumeric: 'tabular-nums',
                                                            whiteSpace: 'nowrap',
                                                          }}
                                                        >
                                                          <Typography
                                                            variant="body2"
                                                            fontWeight={
                                                              displayGrade !== '-' ? 700 : 400
                                                            }
                                                            color={
                                                              isManualOverride
                                                                ? 'error.main'
                                                                : 'text.primary'
                                                            }
                                                          >
                                                            {displayGrade}
                                                          </Typography>
                                                          {isManualOverride && (
                                                            <Typography
                                                              variant="caption"
                                                              color="text.secondary"
                                                              sx={{
                                                                display: 'block',
                                                                fontSize: '0.75rem',
                                                              }}
                                                            >
                                                              API: {originalApiLabel}
                                                            </Typography>
                                                          )}
                                                        </TableCell>

                                                        {/* 6. SCORE / ACTIONS */}
                                                        <TableCell
                                                          align="right"
                                                          sx={{ whiteSpace: 'nowrap' }}
                                                        >
                                                          {matchedAssignment ? (
                                                            <Stack
                                                              direction="row"
                                                              spacing={0.5}
                                                              justifyContent="flex-end"
                                                              alignItems="center"
                                                            >
                                                              {renderInlineScoreControls(
                                                                matchedAssignment,
                                                                sub
                                                              )}
                                                              <Tooltip title="Warning: API-Synced Grade (Click to view or override)">
                                                                <IconButton
                                                                  size="small"
                                                                  aria-label={`View or override ${cleanItemTitle || item.item_name}`}
                                                                  onClick={() => {
                                                                    setApiOverrideWarningAssignment(
                                                                      matchedAssignment
                                                                    );
                                                                  }}
                                                                >
                                                                  <Edit3 size={14} />
                                                                </IconButton>
                                                              </Tooltip>
                                                            </Stack>
                                                          ) : null}
                                                        </TableCell>
                                                      </TableRow>
                                                    );
                                                  })}

                                                {/* CATEGORY TOTAL AGGREGATION ROW */}
                                                {!isCatCollapsed && (
                                                  <TableRow
                                                    sx={{
                                                      bgcolor: alpha(
                                                        theme.palette.text.primary,
                                                        0.015
                                                      ),
                                                      borderBottom: '1px solid',
                                                      borderColor: 'divider',
                                                    }}
                                                  >
                                                    <TableCell sx={{ pl: 5.5, py: 1.25 }}>
                                                      <Stack
                                                        direction="row"
                                                        spacing={1.5}
                                                        alignItems="center"
                                                      >
                                                        <Box
                                                          sx={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'text.secondary',
                                                            fontWeight: 800,
                                                            fontSize: '1.125rem',
                                                            flexShrink: 0,
                                                          }}
                                                        >
                                                          &Sigma;
                                                        </Box>
                                                        <Box>
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              display: 'block',
                                                              fontSize: '0.75rem',
                                                              fontWeight: 700,
                                                              color: 'text.secondary',
                                                              textTransform: 'uppercase',
                                                              letterSpacing: '0.04em',
                                                              lineHeight: 1.1,
                                                            }}
                                                          >
                                                            AGGREGATION
                                                          </Typography>
                                                          <Typography
                                                            variant="body2"
                                                            fontWeight={700}
                                                          >
                                                            {cat.category_name} total
                                                          </Typography>
                                                        </Box>
                                                      </Stack>
                                                    </TableCell>
                                                    <TableCell
                                                      sx={{
                                                        fontVariantNumeric: 'tabular-nums',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                      >
                                                        &mdash;
                                                      </Typography>
                                                    </TableCell>
                                                    <TableCell
                                                      sx={{
                                                        fontVariantNumeric: 'tabular-nums',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      <Typography variant="body2" fontWeight={600}>
                                                        {cat.weight_formatted}
                                                      </Typography>
                                                    </TableCell>
                                                    <TableCell
                                                      sx={{
                                                        fontVariantNumeric: 'tabular-nums',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                      >
                                                        0&ndash;100
                                                      </Typography>
                                                    </TableCell>
                                                    <TableCell
                                                      sx={{
                                                        fontVariantNumeric: 'tabular-nums',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        fontWeight={
                                                          cat.grade_formatted !== '-' ? 700 : 400
                                                        }
                                                      >
                                                        {cat.grade_formatted || '-'}
                                                      </Typography>
                                                    </TableCell>
                                                    <TableCell
                                                      align="right"
                                                      sx={{ whiteSpace: 'nowrap' }}
                                                    />
                                                  </TableRow>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                        </>
                                      ) : (
                                        /* CASE B: STANDARD / INTERNAL SUBJECT GRADE CARD HIERARCHY */
                                        (() => {
                                          const groupedByCat = new Map<
                                            string,
                                            GradebookAssignment[]
                                          >();
                                          for (const a of classAssignments) {
                                            const mMeta = parseAssignmentMoodleMeta(
                                              a.state_standards
                                            );
                                            const isUngraded =
                                              a.is_graded === false ||
                                              mMeta?.is_ungraded_bucket === true;
                                            const slug = isUngraded
                                              ? '__ungraded_bucket__'
                                              : a.category || 'homework';
                                            const existing = groupedByCat.get(slug) || [];
                                            existing.push(a);
                                            groupedByCat.set(slug, existing);
                                          }

                                          return Array.from(groupedByCat.entries()).map(
                                            ([catSlug, rawItems]) => {
                                              const isUngradedCat =
                                                catSlug === '__ungraded_bucket__';
                                              const items = [...rawItems].sort(
                                                compareGradebookAssignmentsChronological
                                              );

                                              const typeInfo = typeMap.get(catSlug);
                                              const catTitle = isUngradedCat
                                                ? 'Ungraded / Review Items'
                                                : typeInfo?.name || catSlug.replace(/_/g, ' ');
                                              const catKey = `${sub.id}::${catSlug}`;
                                              const isCatCollapsed = Boolean(
                                                collapsedGradeCategories[catKey]
                                              );
                                              const breakdown = sum.category_breakdowns.find(
                                                (b) => b.category_slug === catSlug
                                              );
                                              const catWeight = isUngradedCat
                                                ? 0
                                                : (breakdown?.weight ??
                                                  typeInfo?.default_weight ??
                                                  100);
                                              const itemWeightShare =
                                                !isUngradedCat && items.length > 0
                                                  ? Number((catWeight / items.length).toFixed(2))
                                                  : 0;

                                              return (
                                                <React.Fragment key={catSlug}>
                                                  <TableRow
                                                    hover
                                                    onClick={() =>
                                                      toggleCollapseCategory(sub.id, catSlug)
                                                    }
                                                    sx={{
                                                      cursor: 'pointer',
                                                      bgcolor: alpha(
                                                        theme.palette.text.primary,
                                                        0.03
                                                      ),
                                                    }}
                                                  >
                                                    <TableCell
                                                      colSpan={6}
                                                      sx={{ pl: 3.5, py: 1.1 }}
                                                    >
                                                      <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                      >
                                                        {isCatCollapsed ? (
                                                          <ChevronRight size={15} />
                                                        ) : (
                                                          <ChevronDown size={15} />
                                                        )}
                                                        <Typography
                                                          variant="body2"
                                                          fontWeight={700}
                                                        >
                                                          {catTitle}
                                                        </Typography>
                                                        <Chip
                                                          size="small"
                                                          label={`${items.length} items`}
                                                          variant="outlined"
                                                          sx={{
                                                            height: 20,
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                          }}
                                                        />
                                                        {isUngradedCat && (
                                                          <Chip
                                                            size="small"
                                                            color="warning"
                                                            variant="outlined"
                                                            label="0% Weight"
                                                            sx={{
                                                              height: 20,
                                                              fontSize: '0.75rem',
                                                              fontWeight: 700,
                                                            }}
                                                          />
                                                        )}
                                                      </Stack>
                                                    </TableCell>
                                                  </TableRow>

                                                  {!isCatCollapsed &&
                                                    items.map((a) => {
                                                      const mMeta = parseAssignmentMoodleMeta(
                                                        a.state_standards
                                                      );
                                                      const isQuizOrTest =
                                                        a.category.includes('quiz') ||
                                                        a.category.includes('test');
                                                      const badgeBg = isUngradedCat
                                                        ? theme.palette.text.secondary
                                                        : isQuizOrTest
                                                          ? theme.palette.secondary.main
                                                          : theme.palette.primary.main;
                                                      const hasPct =
                                                        typeof a.percentage_score === 'number';
                                                      const contribVal =
                                                        !isUngradedCat &&
                                                        hasPct &&
                                                        a.percentage_score !== null
                                                          ? `${(
                                                              (a.percentage_score / 100) *
                                                              itemWeightShare
                                                            ).toFixed(2)} %`
                                                          : null;

                                                      return (
                                                        <TableRow key={a.id} hover>
                                                          {/* 1. ASSIGNMENT / ITEM (+ Feedback folded below title) */}
                                                          <TableCell
                                                            sx={{ pl: 5.5, py: 1.35 }}
                                                          >
                                                            <Stack
                                                              direction="row"
                                                              spacing={1.5}
                                                              alignItems="flex-start"
                                                            >
                                                              <Box
                                                                sx={{
                                                                  width: 28,
                                                                  height: 28,
                                                                  borderRadius: 1,
                                                                  bgcolor: badgeBg,
                                                                  color: '#fff',
                                                                  display: 'flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  flexShrink: 0,
                                                                  mt: 0.25,
                                                                }}
                                                              >
                                                                {isQuizOrTest ? (
                                                                  <CheckSquare size={14} />
                                                                ) : (
                                                                  <FileText size={14} />
                                                                )}
                                                              </Box>
                                                              <Box>
                                                                <Typography
                                                                  variant="caption"
                                                                  sx={{
                                                                    display: 'block',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    color: 'text.secondary',
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.04em',
                                                                    lineHeight: 1.2,
                                                                  }}
                                                                >
                                                                  {catTitle}
                                                                  {(() => {
                                                                    const dayNum = getAssignmentDayNumber(a);
                                                                    if (dayNum !== null) {
                                                                      return ` • DAY ${dayNum}`;
                                                                    }
                                                                    const weekNum = getAssignmentWeekNumber(a);
                                                                    if (weekNum !== null) {
                                                                      return ` • WEEK ${weekNum}`;
                                                                    }
                                                                    return '';
                                                                  })()}
                                                                </Typography>
                                                                <Typography
                                                                  variant="body2"
                                                                  fontWeight={700}
                                                                >
                                                                  {a.title}
                                                                </Typography>
                                                                {a.teacher_comments && (
                                                                  <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{
                                                                      display: 'block',
                                                                      mt: 0.35,
                                                                      fontStyle: 'italic',
                                                                    }}
                                                                  >
                                                                    Feedback: {a.teacher_comments}
                                                                  </Typography>
                                                                )}
                                                              </Box>
                                                            </Stack>
                                                          </TableCell>

                                                          {/* 2. DUE DATE (Single Row) */}
                                                          <TableCell
                                                            sx={{
                                                              fontVariantNumeric: 'tabular-nums',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              color="text.secondary"
                                                              sx={{ whiteSpace: 'nowrap' }}
                                                            >
                                                              {formatCompactDate(a.due_date)}
                                                            </Typography>
                                                          </TableCell>

                                                          {/* 3. WEIGHT (+ Contribution sub-caption) */}
                                                          <TableCell
                                                            sx={{
                                                              fontVariantNumeric: 'tabular-nums',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            <Typography variant="body2" fontWeight={600}>
                                                              {itemWeightShare.toFixed(2)} %
                                                            </Typography>
                                                            {contribVal && (
                                                              <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                  display: 'block',
                                                                  whiteSpace: 'nowrap',
                                                                }}
                                                              >
                                                                Contrib: {contribVal}
                                                              </Typography>
                                                            )}
                                                          </TableCell>

                                                          {/* 4. RANGE */}
                                                          <TableCell
                                                            sx={{
                                                              fontVariantNumeric: 'tabular-nums',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              color="text.secondary"
                                                            >
                                                              0&ndash;{a.points_possible ?? 100}
                                                            </Typography>
                                                          </TableCell>

                                                          {/* 5. GRADE */}
                                                          <TableCell
                                                            sx={{
                                                              fontVariantNumeric: 'tabular-nums',
                                                              whiteSpace: 'nowrap',
                                                            }}
                                                          >
                                                            <Stack spacing={0.25}>
                                                              <Typography
                                                                variant="body2"
                                                                fontWeight={hasPct ? 700 : 400}
                                                              >
                                                                {hasPct &&
                                                                a.percentage_score !== null
                                                                  ? `${a.percentage_score.toFixed(2)} %`
                                                                  : '-'}
                                                              </Typography>
                                                              {a.grading_mode ===
                                                                'problems_calculator' &&
                                                                typeof a.total_problems ===
                                                                  'number' &&
                                                                typeof a.missed_problems ===
                                                                  'number' && (
                                                                  <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{ fontSize: '0.75rem' }}
                                                                  >
                                                                    {Math.max(
                                                                      0,
                                                                      a.total_problems -
                                                                        a.missed_problems
                                                                    )}
                                                                    /{a.total_problems} correct
                                                                  </Typography>
                                                                )}
                                                            </Stack>
                                                          </TableCell>

                                                          {/* 6. SCORE / ACTIONS */}
                                                          <TableCell
                                                            align="right"
                                                            sx={{ whiteSpace: 'nowrap' }}
                                                          >
                                                            <Stack
                                                              direction="row"
                                                              spacing={0.5}
                                                              justifyContent="flex-end"
                                                              alignItems="center"
                                                            >
                                                              {renderInlineScoreControls(
                                                                a,
                                                                sub
                                                              )}
                                                              <Tooltip title="Edit Assignment Details">
                                                                <IconButton
                                                                  size="small"
                                                                  aria-label={`Edit ${a.title}`}
                                                                  onClick={() => {
                                                                    setEditingTemplate(null);
                                                                    setEditingAssignment(a);
                                                                    setUnifiedModalOpen(true);
                                                                  }}
                                                                >
                                                                  <Edit3 size={14} />
                                                                </IconButton>
                                                              </Tooltip>
                                                              {confirmDeleteAssignmentId ===
                                                              a.id ? (
                                                                <Button
                                                                  size="small"
                                                                  variant="contained"
                                                                  color="error"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteAssignmentWithUndo(
                                                                      a
                                                                    );
                                                                  }}
                                                                  sx={{
                                                                    textTransform: 'none',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.75rem',
                                                                    minWidth: 72,
                                                                    py: 0.25,
                                                                    px: 1,
                                                                  }}
                                                                >
                                                                  Confirm?
                                                                </Button>
                                                              ) : (
                                                                <Tooltip title="Delete Assignment">
                                                                  <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    aria-label={`Delete ${a.title}`}
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setConfirmDeleteAssignmentId(
                                                                        a.id
                                                                      );
                                                                    }}
                                                                  >
                                                                    <Trash2 size={14} />
                                                                  </IconButton>
                                                                </Tooltip>
                                                              )}
                                                            </Stack>
                                                          </TableCell>
                                                        </TableRow>
                                                      );
                                                    })}

                                                  {!isCatCollapsed && (
                                                    <TableRow
                                                      sx={{
                                                        bgcolor: alpha(
                                                          theme.palette.text.primary,
                                                          0.015
                                                        ),
                                                        borderBottom: '1px solid',
                                                        borderColor: 'divider',
                                                      }}
                                                    >
                                                      <TableCell sx={{ pl: 5.5, py: 1.25 }}>
                                                        <Stack
                                                          direction="row"
                                                          spacing={1.5}
                                                          alignItems="center"
                                                        >
                                                          <Box
                                                            sx={{
                                                              width: 28,
                                                              height: 28,
                                                              borderRadius: 1,
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              color: 'text.secondary',
                                                              fontWeight: 800,
                                                              fontSize: '1.125rem',
                                                              flexShrink: 0,
                                                            }}
                                                          >
                                                            &Sigma;
                                                          </Box>
                                                          <Box>
                                                            <Typography
                                                              variant="caption"
                                                              sx={{
                                                                display: 'block',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                color: 'text.secondary',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.04em',
                                                                lineHeight: 1.1,
                                                              }}
                                                            >
                                                              AGGREGATION
                                                            </Typography>
                                                            <Typography
                                                              variant="body2"
                                                              fontWeight={700}
                                                            >
                                                              {catTitle} total
                                                            </Typography>
                                                          </Box>
                                                        </Stack>
                                                      </TableCell>
                                                      <TableCell
                                                        sx={{
                                                          fontVariantNumeric: 'tabular-nums',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        <Typography
                                                          variant="body2"
                                                          color="text.secondary"
                                                        >
                                                          &mdash;
                                                        </Typography>
                                                      </TableCell>
                                                      <TableCell
                                                        sx={{
                                                          fontVariantNumeric: 'tabular-nums',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        <Typography variant="body2" fontWeight={600}>
                                                          {catWeight.toFixed(2)} %
                                                        </Typography>
                                                      </TableCell>
                                                      <TableCell
                                                        sx={{
                                                          fontVariantNumeric: 'tabular-nums',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        <Typography
                                                          variant="body2"
                                                          color="text.secondary"
                                                        >
                                                          0&ndash;100
                                                        </Typography>
                                                      </TableCell>
                                                      <TableCell
                                                        sx={{
                                                          fontVariantNumeric: 'tabular-nums',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        <Typography
                                                          variant="body2"
                                                          fontWeight={
                                                            breakdown?.average_percentage !==
                                                              null &&
                                                            breakdown?.average_percentage !==
                                                              undefined
                                                              ? 700
                                                              : 400
                                                          }
                                                        >
                                                          {breakdown?.average_percentage !==
                                                            null &&
                                                          breakdown?.average_percentage !==
                                                            undefined
                                                            ? `${breakdown.average_percentage.toFixed(
                                                                2
                                                              )} %`
                                                            : '-'}
                                                        </Typography>
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{ whiteSpace: 'nowrap' }}
                                                      />
                                                    </TableRow>
                                                  )}
                                                </React.Fragment>
                                              );
                                            }
                                          );
                                        })()
                                      )}
                                    </TableBody>
                                  </Table>
                                </Paper>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* =====================================================================
          TAB 2: ATTENDANCE & CARNEGIE HOURS
          ===================================================================== */}
      {activeTab === 'attendance' && (
        <Grid container spacing={3}>
          {/* LEFT: DAILY ATTENDANCE TRACKER */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Daily Attendance Tracker
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  Present Days: {attendanceLogs.filter((l) => l.status === 'present' || l.status === 'field_trip').length} / 180 State Target Days
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (attendanceLogs.filter(
                      (l) => l.status === 'present' || l.status === 'field_trip'
                    ).length /
                      180) *
                      100
                  )}
                  sx={{ mt: 1, height: 6, borderRadius: 1 }}
                />
              </Box>

              <Box sx={{ p: 2.25 }}>
                <Grid container spacing={1.5} alignItems="center" mb={2.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Date"
                      InputLabelProps={{ shrink: true }}
                      value={newAttendanceDate}
                      onChange={(e) => setNewAttendanceDate(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      label="Status"
                      value={newAttendanceStatus}
                      onChange={(e) =>
                        setNewAttendanceStatus(
                          e.target.value as
                            | 'present'
                            | 'absent'
                            | 'field_trip'
                            | 'sick'
                            | 'holiday'
                        )
                      }
                    >
                      <option value="present">Present</option>
                      <option value="field_trip">Field Trip (Present)</option>
                      <option value="absent">Absent</option>
                      <option value="sick">Sick Day</option>
                      <option value="holiday">Holiday</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleLogAttendance}
                      sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      Log Attendance
                    </Button>
                  </Grid>
                </Grid>

                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        DATE
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        STATUS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        HOURS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceLogs.slice(0, 12).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatCompactDate(row.attendance_date)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            size="small"
                            color={
                              row.status === 'present' || row.status === 'field_trip'
                                ? 'success'
                                : 'warning'
                            }
                            variant="outlined"
                            label={row.status.toUpperCase()}
                            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {row.hours_logged} hrs
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Card>
          </Grid>

          {/* RIGHT: CARNEGIE UNIT & INSTRUCTIONAL HOURS TRACKER */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Instructional Hours &amp; Carnegie Units
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  120 Instructional Hours = 1.0 High School Credit (60 Hours = 0.5 Credit).
                </Typography>
              </Box>

              <Box sx={{ p: 2.25 }}>
                <Grid container spacing={1.5} alignItems="center" mb={2.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      label="Class"
                      value={hourSubjectId}
                      onChange={(e) => setHourSubjectId(e.target.value)}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Minutes"
                      value={hourMinutes}
                      onChange={(e) => setHourMinutes(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} sm={5}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      onClick={handleLogInstructionalHours}
                      sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      + Log Class Hours
                    </Button>
                  </Grid>
                </Grid>

                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        CLASS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        HOURS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        CARNEGIE UNIT
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        CREDITS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjectSummaries.map((sum) => (
                      <TableRow key={sum.subject_id}>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {sum.subject_name}
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {sum.instructional_hours} hrs
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {sum.carnegie_credits.toFixed(2)} cr
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {sum.effective_credits.toFixed(2)} cr
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* =====================================================================
          TAB 5: UNIFIED REPORT CARD & HIGH SCHOOL TRANSCRIPT BUILDER
          ===================================================================== */}
      {activeTab === 'reports' && (
        <Stack spacing={3}>
          <Card
            className="no-print"
            elevation={0}
            sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              spacing={2}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={reportDocMode}
                  onChange={(_, val) => {
                    if (val) setReportDocMode(val);
                  }}
                >
                  <ToggleButton value="report_card" sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                    <FileText size={15} style={{ marginRight: 6 }} />
                    Report Card
                  </ToggleButton>
                  <ToggleButton value="transcript" sx={{ fontWeight: 600, textTransform: 'none', px: 2 }}>
                    <Award size={15} style={{ marginRight: 6 }} />
                    High School Transcript
                  </ToggleButton>
                </ToggleButtonGroup>

                {reportDocMode === 'report_card' ? (
                  <>
                    <TextField
                      select
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      label="Report Period"
                      value={reportDateFilterMode}
                      onChange={(e) =>
                        setReportDateFilterMode(
                          e.target.value as
                            | 'all_term'
                            | 'this_week'
                            | 'this_month'
                            | 'custom_range'
                        )
                      }
                      sx={{ minWidth: 185 }}
                    >
                      <option value="all_term">Full Term ({selectedTerm})</option>
                      <option value="this_week">Current Week Snapshot</option>
                      <option value="this_month">Current Month Snapshot</option>
                      <option value="custom_range">Custom Date Range</option>
                    </TextField>

                    {reportDateFilterMode === 'custom_range' && (
                      <>
                        <TextField
                          size="small"
                          type="date"
                          label="Start Date"
                          InputLabelProps={{ shrink: true }}
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                        />
                        <TextField
                          size="small"
                          type="date"
                          label="End Date"
                          InputLabelProps={{ shrink: true }}
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                        />
                      </>
                    )}

                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={reportDetailLevel}
                      onChange={(_, val) => {
                        if (val) setReportDetailLevel(val);
                      }}
                    >
                      <ToggleButton value="summary" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        Summary
                      </ToggleButton>
                      <ToggleButton value="detailed" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        Detailed Itemized
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </>
                ) : (
                  <>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={transcriptGrouping}
                      onChange={(_, val) => {
                        if (val) setTranscriptGrouping(val);
                      }}
                    >
                      <ToggleButton value="chronological" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        By Year
                      </ToggleButton>
                      <ToggleButton value="subject_category" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        By Subject Area
                      </ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={transcriptOrientation}
                      onChange={(_, val) => {
                        if (val) setTranscriptOrientation(val);
                      }}
                    >
                      <ToggleButton value="portrait" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        Portrait
                      </ToggleButton>
                      <ToggleButton value="landscape" sx={{ fontWeight: 600, textTransform: 'none' }}>
                        Landscape
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download size={15} />}
                  onClick={handleExportCsv}
                  sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Export CSV
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<Printer size={15} />}
                  onClick={() => window.print()}
                  sx={{ fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Print / Save PDF
                </Button>
              </Stack>
            </Stack>

            {reportDocMode === 'transcript' && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Student Legal Name"
                      value={transcriptSettings.student_legal_name}
                      onChange={(e) =>
                        setTranscriptSettings({
                          ...transcriptSettings,
                          student_legal_name: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label="Date of Birth"
                      InputLabelProps={{ shrink: true }}
                      value={transcriptSettings.date_of_birth}
                      onChange={(e) =>
                        setTranscriptSettings({
                          ...transcriptSettings,
                          date_of_birth: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Graduation Date"
                      value={transcriptSettings.anticipated_graduation_date}
                      onChange={(e) =>
                        setTranscriptSettings({
                          ...transcriptSettings,
                          anticipated_graduation_date: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="School Address"
                      value={transcriptSettings.school_address}
                      onChange={(e) =>
                        setTranscriptSettings({
                          ...transcriptSettings,
                          school_address: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      disabled={savingTranscript}
                      startIcon={<Save size={15} />}
                      onClick={handleSaveTranscriptSettings}
                      sx={{ fontWeight: 600, textTransform: 'none', height: 40 }}
                    >
                      {savingTranscript ? 'Saving...' : 'Save Header'}
                    </Button>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        placeholder="Test (e.g. SAT, ACT, CLT)"
                        value={newTestName}
                        onChange={(e) => setNewTestName(e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Score (e.g. 1480 / 33)"
                        value={newTestScore}
                        onChange={(e) => setNewTestScore(e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          if (!newTestName.trim() || !newTestScore.trim()) return;
                          setTranscriptSettings((prev) => ({
                            ...prev,
                            standardized_tests: [
                              ...prev.standardized_tests,
                              {
                                id: `test-${Date.now()}`,
                                test_name: newTestName.trim(),
                                test_date: newTestDate || selectedAcademicYear,
                                score_summary: newTestScore.trim(),
                              },
                            ],
                          }));
                          setNewTestName('');
                          setNewTestScore('');
                        }}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                      >
                        + Test
                      </Button>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        placeholder="Honor / Award Title"
                        value={newHonorTitle}
                        onChange={(e) => setNewHonorTitle(e.target.value)}
                        sx={{ flex: 1.5 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Year"
                        value={newHonorYear}
                        onChange={(e) => setNewHonorYear(e.target.value)}
                        sx={{ flex: 0.7 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          if (!newHonorTitle.trim()) return;
                          setTranscriptSettings((prev) => ({
                            ...prev,
                            honors_and_awards: [
                              ...prev.honors_and_awards,
                              {
                                id: `hon-${Date.now()}`,
                                title: newHonorTitle.trim(),
                                year: newHonorYear.trim(),
                                description: '',
                              },
                            ],
                          }));
                          setNewHonorTitle('');
                        }}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                      >
                        + Honor
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Card>

          {reportDocMode === 'report_card' ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#ffffff',
                color: '#000000',
                maxWidth: 960,
                mx: 'auto',
                width: '100%',
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                borderBottom="2px solid #111"
                pb={2}
                mb={3}
              >
                <Box>
                  <Typography variant="h4" fontWeight={800} sx={{ color: '#000' }}>
                    {effectiveSchoolName}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#333' }}>
                    OFFICIAL ACADEMIC PROGRESS REPORT CARD
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#000' }}>
                    Student: {transcriptSettings.student_legal_name}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: '#444' }}>
                    Grade Level: {transcriptSettings.current_grade_level} • Term: {selectedTerm} ({selectedAcademicYear})
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    sx={{ color: '#444', fontVariantNumeric: 'tabular-nums' }}
                  >
                    Term GPA: {overallMetrics.cumulativeUnweightedGpa.toFixed(2)} (Weighted:{' '}
                    {overallMetrics.cumulativeWeightedGpa.toFixed(2)})
                  </Typography>
                </Box>
              </Stack>

              <Table size="small" sx={{ mb: 3 }}>
                <TableHead>
                  <TableRow sx={{ borderBottom: '2px solid #222', bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>CLASS / SUBJECT</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>DISCIPLINE</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>POINTS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>TERM GRADE</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>CREDITS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc' }}>
                      TEACHER OBSERVATIONS &amp; NOTES
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportSubjectSummaries.map((sum) => {
                    const ov = termOverrides.find(
                      (o) =>
                        o.subject_id === sum.subject_id &&
                        o.term_name === selectedTerm
                    );
                    return (
                      <TableRow key={sum.subject_id} sx={{ borderBottom: '1px solid #ddd' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#000', whiteSpace: 'nowrap' }}>
                          {sum.subject_name}
                        </TableCell>
                        <TableCell sx={{ color: '#333', whiteSpace: 'nowrap' }}>
                          {sum.policy.broader_discipline}
                        </TableCell>
                        <TableCell sx={{ color: '#333', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {sum.points_earned_so_far} /{' '}
                          {sum.policy.calculation_basis === 'preset_total_points'
                            ? sum.preset_total_points
                            : sum.points_possible_entered_so_far}{' '}
                          pts
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            color: '#000',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sum.formatted_display}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: '#000',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sum.effective_credits.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ color: '#333', fontSize: '0.78rem' }}>
                          {ov?.teacher_observations ||
                            ov?.portfolio_notes ||
                            'Satisfactory academic progress.'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {reportDetailLevel === 'detailed' && (
                <Box mt={3}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#000', mb: 1.5 }}>
                    ITEMIZED GRADED ASSIGNMENTS ({selectedTerm})
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ borderBottom: '1.5px solid #222', bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>DATE</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>CLASS</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc' }}>ASSIGNMENT</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>CATEGORY</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>SCORE</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc' }}>COMMENTS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportFilteredAssignments
                        .filter(
                          (a) =>
                            a.is_graded !== false &&
                            a.workflow_status !== 'staged' &&
                            a.workflow_status !== 'ignored'
                        )
                        .sort((a, b) => {
                          if (a.subject_id === b.subject_id) {
                            return compareGradebookAssignmentsChronological(a, b);
                          }
                          return a.due_date.localeCompare(b.due_date);
                        })
                        .map((a) => {
                          const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
                          const pol = sub
                            ? parseSubjectGradingPolicy(sub)
                            : parseSubjectGradingPolicy({
                                id: '',
                                name: '',
                                sort_order: 0,
                                color: '#1b5698',
                              });
                          return (
                            <TableRow key={a.id} sx={{ borderBottom: '1px solid #eee' }}>
                              <TableCell sx={{ color: '#333', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {formatCompactDate(a.due_date)}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, color: '#000', whiteSpace: 'nowrap' }}>
                                {sub?.name || 'General'}
                              </TableCell>
                              <TableCell sx={{ color: '#000' }}>{a.title}</TableCell>
                              <TableCell sx={{ color: '#444', whiteSpace: 'nowrap' }}>
                                {typeMap.get(a.category)?.name || a.category}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 700,
                                  color: '#000',
                                  fontVariantNumeric: 'tabular-nums',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {typeof a.percentage_score === 'number'
                                  ? `${formatClassGradeDisplay(
                                      a.percentage_score,
                                      a.letter_grade || '',
                                      pol
                                    )}${
                                      a.grading_mode === 'problems_calculator' &&
                                      typeof a.total_problems === 'number' &&
                                      typeof a.missed_problems === 'number'
                                        ? ` (${
                                            a.total_problems - a.missed_problems
                                          }/${a.total_problems})`
                                        : ''
                                    }`
                                  : 'Pending'}
                              </TableCell>
                              <TableCell sx={{ color: '#444', fontSize: '0.75rem' }}>
                                {a.teacher_comments || '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 4.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#ffffff',
                color: '#000000',
                maxWidth: transcriptOrientation === 'landscape' ? 1120 : 900,
                mx: 'auto',
                width: '100%',
              }}
            >
              {/* DEMOGRAPHIC & ADMINISTRATION HEADER */}
              <Grid
                container
                spacing={2}
                sx={{ borderBottom: '2.5px solid #000', pb: 2, mb: 3 }}
              >
                <Grid item xs={12} sm={6}>
                  <Typography variant="h4" fontWeight={800} sx={{ color: '#000', letterSpacing: '-0.02em' }}>
                    {effectiveSchoolName.toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#222' }}>
                    OFFICIAL ACADEMIC TRANSCRIPT
                  </Typography>
                  {transcriptSettings.school_address && (
                    <Typography variant="caption" display="block" sx={{ color: '#444' }}>
                      {transcriptSettings.school_address}
                    </Typography>
                  )}
                  <Typography variant="caption" display="block" sx={{ color: '#444' }}>
                    Administrator: {transcriptSettings.administrator_name} ({transcriptSettings.administrator_title})
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="body1" fontWeight={700} sx={{ color: '#000' }}>
                    Student Legal Name: {transcriptSettings.student_legal_name}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: '#333' }}>
                    Date of Birth: {transcriptSettings.date_of_birth || 'On File'} • Student ID:{' '}
                    {transcriptSettings.student_id_number}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: '#333' }}>
                    Current Grade: {transcriptSettings.current_grade_level} • Anticipated Graduation:{' '}
                    {transcriptSettings.anticipated_graduation_date}
                  </Typography>
                </Grid>
              </Grid>

              {transcriptGrouping === 'chronological' ? (
                <Box sx={{ mb: 3 }}>
                  <Box
                    sx={{
                      bgcolor: '#f1f5f9',
                      p: 1,
                      px: 1.5,
                      border: '1px solid #cbd5e1',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#000' }}>
                      ACADEMIC YEAR: {selectedAcademicYear} ({transcriptSettings.current_grade_level})
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}
                    >
                      Yearly Credits: {overallMetrics.totalCredits.toFixed(2)} • Yearly GPA:{' '}
                      {overallMetrics.cumulativeUnweightedGpa.toFixed(2)} (Weighted:{' '}
                      {overallMetrics.cumulativeWeightedGpa.toFixed(2)})
                    </Typography>
                  </Box>

                  <Table size="small" sx={{ border: '1px solid #cbd5e1' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>COURSE CODE</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc' }}>COURSE TITLE</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>SUBJECT AREA</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>LEVEL</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>FINAL GRADE</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>CREDITS</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#000', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>GPA PTS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subjectSummaries.map((sum) => (
                        <TableRow key={sum.subject_id}>
                          <TableCell sx={{ fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                            {sum.policy.course_code}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#000' }}>
                            {sum.subject_name}
                          </TableCell>
                          <TableCell sx={{ color: '#333', whiteSpace: 'nowrap' }}>
                            {sum.policy.broader_discipline}
                          </TableCell>
                          <TableCell sx={{ color: '#333', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {sum.policy.course_level}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: '#000',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sum.formatted_display}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: '#000',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sum.effective_credits.toFixed(2)}
                          </TableCell>
                          <TableCell sx={{ color: '#333', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {sum.gpa_weighted.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Stack spacing={2.5} mb={3}>
                  {Array.from(
                    new Set(subjectSummaries.map((s) => s.policy.broader_discipline))
                  ).map((discipline) => {
                    const discCourses = subjectSummaries.filter(
                      (s) => s.policy.broader_discipline === discipline
                    );
                    const discCredits = discCourses.reduce(
                      (acc, c) => acc + c.effective_credits,
                      0
                    );
                    return (
                      <Box key={discipline}>
                        <Box
                          sx={{
                            bgcolor: '#f1f5f9',
                            p: 0.75,
                            px: 1.5,
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#000' }}>
                            SUBJECT AREA: {discipline.toUpperCase()}
                          </Typography>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}
                          >
                            Subject Credits: {discCredits.toFixed(2)}
                          </Typography>
                        </Box>
                        <Table size="small" sx={{ border: '1px solid #cbd5e1' }}>
                          <TableBody>
                            {discCourses.map((sum) => (
                              <TableRow key={sum.subject_id}>
                                <TableCell sx={{ width: 110, fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                                  {sum.policy.course_code}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#000' }}>
                                  {sum.subject_name}
                                </TableCell>
                                <TableCell sx={{ width: 120, color: '#333', whiteSpace: 'nowrap' }}>
                                  {selectedAcademicYear}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    width: 140,
                                    fontWeight: 700,
                                    color: '#000',
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {sum.formatted_display}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    width: 100,
                                    fontWeight: 700,
                                    color: '#000',
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {sum.effective_credits.toFixed(2)} cr
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {/* FOUR-POINT SUMMARY BLOCK & STANDARDIZED TESTS */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ border: '1.5px solid #000', p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#000', mb: 1 }}>
                      FOUR-POINT ACADEMIC SUMMARY
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#444' }}>
                          Yearly Credits:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: '#000', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {overallMetrics.totalCredits.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#444' }}>
                          Yearly GPA:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: '#000', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {overallMetrics.cumulativeUnweightedGpa.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#444' }}>
                          Cumulative Credits:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: '#000', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {overallMetrics.totalCredits.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: '#444' }}>
                          Cumulative GPA (Unweighted / Weighted):
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: '#000', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {overallMetrics.cumulativeUnweightedGpa.toFixed(2)} /{' '}
                          {overallMetrics.cumulativeWeightedGpa.toFixed(2)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ border: '1.5px solid #000', p: 2, height: '100%' }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#000', mb: 1 }}>
                      STANDARDIZED TESTS &amp; ACADEMIC HONORS
                    </Typography>
                    {transcriptSettings.standardized_tests.length === 0 &&
                    transcriptSettings.honors_and_awards.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#555' }}>
                        Grading Scale: A = 90–100 (4.0), B = 80–89 (3.0), C = 70–79 (2.0), D = 60–69 (1.0). Honors +0.5, AP/Dual Enrollment +1.0. 1.0 Carnegie Credit = 120 Instructional Hours.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {transcriptSettings.standardized_tests.map((t) => (
                          <Typography key={t.id} variant="caption" sx={{ color: '#000' }}>
                            • <strong>{t.test_name}:</strong> {t.score_summary} ({t.test_date})
                          </Typography>
                        ))}
                        {transcriptSettings.honors_and_awards.map((h) => (
                          <Typography key={h.id} variant="caption" sx={{ color: '#000' }}>
                            • <strong>Honor ({h.year}):</strong> {h.title}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {/* PARENT / ADMINISTRATOR ATTESTATION & SIGNATURE BLOCK */}
              <Box sx={{ borderTop: '1.5px solid #000', pt: 2, mt: 3 }}>
                <Typography variant="caption" display="block" sx={{ color: '#222', mb: 3 }}>
                  {effectiveAttestationStatement}
                </Typography>
                <Grid container spacing={4}>
                  <Grid item xs={7}>
                    <Box sx={{ borderBottom: '1px solid #000', height: 28 }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#000' }}>
                      Parent / Administrator Signature — {transcriptSettings.administrator_name},{' '}
                      {transcriptSettings.administrator_title}
                    </Typography>
                  </Grid>
                  <Grid item xs={5}>
                    <Box sx={{ borderBottom: '1px solid #000', height: 28 }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#000' }}>
                      Date Signed ({new Date().toISOString().split('T')[0]})
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}
        </Stack>
      )}

      {/* =====================================================================
          SHARED UNIFIED MODALS
          ===================================================================== */}
      <UnifiedAssignmentModal
        open={unifiedModalOpen}
        onClose={() => setUnifiedModalOpen(false)}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        editingAssignment={editingAssignment}
        editingTemplate={editingTemplate}
        initialValues={modalInitialValues}
        onOpenManageTypes={() => setTypesModalOpen(true)}
        onSaved={(savedAssignment, savedTemplate) => {
          if (savedAssignment) {
            setAssignments((prev) => {
              const exists = prev.some((a) => a.id === savedAssignment.id);
              return exists
                ? prev.map((a) => (a.id === savedAssignment.id ? savedAssignment : a))
                : [savedAssignment, ...prev];
            });
            setInlineDrafts((prev) => ({
              ...prev,
              [savedAssignment.id]: {
                total_problems:
                  typeof savedAssignment.total_problems === 'number'
                    ? String(savedAssignment.total_problems)
                    : '',
                missed_problems:
                  typeof savedAssignment.missed_problems === 'number'
                    ? String(savedAssignment.missed_problems)
                    : '',
                points_earned:
                  typeof savedAssignment.points_earned === 'number'
                    ? String(savedAssignment.points_earned)
                    : '',
                points_possible: String(savedAssignment.points_possible ?? 100),
              },
            }));
          }
          if (savedTemplate) {
            setRecurringTemplates((prev) => {
              const exists = prev.some((t) => t.id === savedTemplate.id);
              return exists
                ? prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t))
                : [...prev, savedTemplate];
            });
            loadAllGradebookData();
          }
        }}
      />

      <ApiGradeOverrideWarningModal
        open={Boolean(apiOverrideWarningAssignment)}
        assignment={apiOverrideWarningAssignment}
        subject={
          apiOverrideWarningAssignment?.subject_id
            ? subjectMap.get(apiOverrideWarningAssignment.subject_id) || null
            : null
        }
        onClose={() => setApiOverrideWarningAssignment(null)}
        onUpdated={(updated) => {
          setAssignments((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          setInlineDrafts((prev) => ({
            ...prev,
            [updated.id]: {
              total_problems:
                typeof updated.total_problems === 'number'
                  ? String(updated.total_problems)
                  : '',
              missed_problems:
                typeof updated.missed_problems === 'number'
                  ? String(updated.missed_problems)
                  : '',
              points_earned:
                typeof updated.points_earned === 'number'
                  ? String(updated.points_earned)
                  : '',
              points_possible: String(updated.points_possible ?? 100),
            },
          }));
        }}
        onOpenFullEditor={(target) => {
          setEditingTemplate(null);
          setEditingAssignment(target);
          setApiOverrideWarningAssignment(null);
          setUnifiedModalOpen(true);
        }}
      />

      <AssignmentTypesManagerModal
        open={typesModalOpen}
        onClose={() => setTypesModalOpen(false)}
        assignmentTypes={assignmentTypes}
        onUpdated={(nextTypes) => setAssignmentTypes(nextTypes)}
      />

      <ClassGradingPolicyModal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        subjects={subjects}
        initialSubjectId={policyModalSubjectId}
        assignmentTypes={assignmentTypes}
        onSaved={(updatedSubject) => {
          setSubjects((prev) =>
            prev.map((s) => (s.id === updatedSubject.id ? updatedSubject : s))
          );
        }}
      />

      {/* TERM OVERRIDE & OBSERVATIONS MODAL (React 19 safe) */}
      {overrideModalSubject && (
        <Box
          className="no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-modal-title"
          onClick={() => setOverrideModalSubject(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={0}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              px={3}
              py={2.25}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography id="override-modal-title" variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
                Final Grade Override &amp; Notes ({overrideModalSubject.name})
              </Typography>
              <IconButton size="small" aria-label="Close modal" onClick={() => setOverrideModalSubject(null)}>
                <X size={18} />
              </IconButton>
            </Box>
            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Stack spacing={2.5}>
                <Typography variant="caption" color="text.secondary">
                  Leave override fields blank to use the real-time calculated grade for{' '}
                  <strong>{selectedTerm}</strong>.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Override %"
                      placeholder="Auto"
                      value={overridePctInput}
                      onChange={(e) => setOverridePctInput(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Override Letter"
                      placeholder="Auto (e.g. A)"
                      value={overrideLetterInput}
                      onChange={(e) => setOverrideLetterInput(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Override Credits"
                      placeholder="Auto"
                      value={overrideCreditsInput}
                      onChange={(e) => setOverrideCreditsInput(e.target.value)}
                    />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  label="Teacher Term Observations (Displayed on Report Card)"
                  placeholder="Summarize mastery, work ethic, and highlights for this term..."
                  value={overrideObservationsInput}
                  onChange={(e) => setOverrideObservationsInput(e.target.value)}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  label="Portfolio Review Notes"
                  placeholder="Notes on work samples, projects, and writing portfolio..."
                  value={overridePortfolioInput}
                  onChange={(e) => setOverridePortfolioInput(e.target.value)}
                />
              </Stack>
            </Box>
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}
            >
              <Button
                onClick={() => setOverrideModalSubject(null)}
                color="inherit"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={savingOverride}
                onClick={handleSaveTermOverride}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                {savingOverride ? 'Saving...' : 'Save Override & Notes'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: letter ${transcriptOrientation};
            margin: 0.4in;
          }
          .no-print,
          header,
          nav,
          aside,
          .MuiDrawer-root {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>
    </Box>
  );
}

export default function GradebookPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Skeleton variant="rounded" height={64} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rounded" height={420} sx={{ borderRadius: 1 }} />
        </Box>
      }
    >
      <GradebookHubContent />
    </Suspense>
  );
}

