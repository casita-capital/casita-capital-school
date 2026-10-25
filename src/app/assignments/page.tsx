'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  alpha,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
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
  Plus,
  Trash2,
  Edit2,
  Search,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  FileText,
  Bookmark,
  GraduationCap,
  Sliders,
  Repeat,
  Lock,
  RotateCcw,
  ChevronDown,
  Settings,
  BookOpen,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  DAY_KEYS,
  DayKey,
  MathSyllabusDay,
  parseRecurringConfig,
  resolveSubjectCountersForWeek,
} from 'src/utils/recurring-planner';
import { normalizeAssessmentTitleForDedup } from 'src/utils/weekly-grading-items';
import {
  AssignmentTypeConfig,
  AutoBehaviorMode,
  computeAssignmentMetrics,
  DEFAULT_ASSIGNMENT_TYPES,
  formatClassGradeDisplay,
  generateWeekAssignmentsFromTemplatesAndPolicy,
  getLocalTodayDateString,
  GradebookAssignment,
  isAssignmentApiSynced,
  isAssignmentAwaitingManualGrade,
  isAssignmentCompletedOrSubmitted,
  isAssignmentPendingApiGrade,
  isAssignmentUpcoming,
  MoodleAssignmentMetadata,
  parseAssignmentMoodleMeta,
  parseSubjectGradingPolicy,
  RecurringAssignmentTemplate,
  ScoringMode,
  SubjectGradingPolicy,
  SubjectWithGrading,
} from 'src/utils/gradebook-calculator';
import {
  ApiGradeOverrideWarningModal,
  QuickGradeAssignmentModal,
  revertApiAssignmentOverride,
  UnifiedAssignmentModal,
  UnifiedAssignmentModalInitialValues,
} from 'src/components/assignments/unified-assignment-modal';
import {
  AssignmentTypesManagerModal,
  ClassGradingPolicyModal,
} from 'src/components/assignments/grading-policy-modals';

type PrimaryAssignmentsTab = 'assignments' | 'recurring' | 'imported_pending';
type SortField = 'due_date' | 'category' | 'subject';
type SortOrder = 'asc' | 'desc';
type GroupByOption = 'none' | 'subject' | 'category';
type StatusTabFilter =
  | 'all'
  | 'needs_grading'
  | 'pending_grades'
  | 'graded'
  | 'upcoming';

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

function formatCompactDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
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

function AssignmentsPageContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activePrimaryTab, setActivePrimaryTab] =
    useState<PrimaryAssignmentsTab>('assignments');
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  const [assignments, setAssignments] = useState<GradebookAssignment[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithGrading[]>([]);
  const [assignmentTypes, setAssignmentTypes] =
    useState<AssignmentTypeConfig[]>(DEFAULT_ASSIGNMENT_TYPES);
  const [recurringTemplates, setRecurringTemplates] = useState<
    RecurringAssignmentTemplate[]
  >([]);
  const [syllabusDays, setSyllabusDays] = useState<MathSyllabusDay[]>([]);

  // Filters & Sorting for All Assignments Tab
  const [statusTab, setStatusTab] = useState<StatusTabFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [visibleRowLimit, setVisibleRowLimit] = useState<number>(50);

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
  const [editingInlineScoreIds, setEditingInlineScoreIds] = useState<
    Record<string, boolean>
  >({});
  const [savingInlineId, setSavingInlineId] = useState<string | null>(null);
  const [revertingOverrideId, setRevertingOverrideId] = useState<string | null>(null);
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState<
    string | null
  >(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<
    string | null
  >(null);
  const [approvingAllStaged, setApprovingAllStaged] = useState<boolean>(false);

  // Recurring & Syllabus Importer State
  const [syllabusStageSubjectId, setSyllabusStageSubjectId] = useState<string>('');
  const [stagingWeekMonday, setStagingWeekMonday] = useState<string>(
    getCurrentWeekMonday()
  );
  const [syncingRecurringWeek, setSyncingRecurringWeek] = useState<boolean>(false);

  // Unified & Quick Grade Modals State
  const [openModal, setOpenModal] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<GradebookAssignment | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<RecurringAssignmentTemplate | null>(null);
  const [quickGradeAssignment, setQuickGradeAssignment] =
    useState<GradebookAssignment | null>(null);
  const [apiWarningAssignment, setApiWarningAssignment] =
    useState<GradebookAssignment | null>(null);
  const [modalInitialValues, setModalInitialValues] = useState<
    UnifiedAssignmentModalInitialValues | undefined
  >(undefined);
  const [openTypesModal, setOpenTypesModal] = useState(false);
  const [openPolicyModal, setOpenPolicyModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToolsMenuOpen(false);
        setConfirmDeleteAssignmentId(null);
        setConfirmDeleteTemplateId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadData() {
    try {
      const [subRes, typeRes, assignRes, tplRes, sylRes] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('assignment_types')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase.from('assignments').select('*').order('due_date', { ascending: true }),
        supabase
          .from('recurring_assignment_templates')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('math_syllabus')
          .select('*')
          .order('day_number', { ascending: true }),
      ]);

      if (subRes.data) {
        const subs = subRes.data as unknown as SubjectWithGrading[];
        setSubjects(subs);
        if (subs.length > 0) {
          setSyllabusStageSubjectId((prev) => prev || subs[0].id);
        }
      }

      if (typeRes.data && typeRes.data.length > 0) {
        setAssignmentTypes(typeRes.data as unknown as AssignmentTypeConfig[]);
      }

      if (assignRes.error) {
        toast.error(`Failed to load assignments: ${assignRes.error.message}`);
      } else if (assignRes.data) {
        const loaded = assignRes.data as unknown as GradebookAssignment[];
        setAssignments(loaded);
        const drafts: Record<
          string,
          {
            total_problems: string;
            missed_problems: string;
            points_earned: string;
            points_possible: string;
          }
        > = {};
        for (const a of loaded) {
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
        const mappedTemplates: RecurringAssignmentTemplate[] = tplRes.data.map(
          (row) => ({
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
          })
        );
        setRecurringTemplates(mappedTemplates);
      }

      if (sylRes.data) {
        setSyllabusDays(sylRes.data as MathSyllabusDay[]);
      }
    } catch {
      toast.error('Error fetching assignments data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setVisibleRowLimit(50);
  }, [statusTab, categoryFilter, subjectFilter, searchQuery, activePrimaryTab, groupBy]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'recurring') {
      setActivePrimaryTab('recurring');
    } else if (tabParam === 'imported_pending' || tabParam === 'staging') {
      setActivePrimaryTab('imported_pending');
    } else if (tabParam === 'assignments') {
      setActivePrimaryTab('assignments');
    }

    const statusParam = searchParams.get('status');
    if (
      statusParam === 'needs_grading' ||
      statusParam === 'pending_grades' ||
      statusParam === 'graded' ||
      statusParam === 'upcoming' ||
      statusParam === 'all'
    ) {
      setStatusTab(statusParam);
    }

    const subParam = searchParams.get('subject');
    if (subParam) {
      setSubjectFilter(subParam);
      setSyllabusStageSubjectId(subParam);
    }
  }, [searchParams]);

  const todayStr = useMemo(() => getLocalTodayDateString(), []);

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectWithGrading>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const defaultGradingPolicy = useMemo(
    () =>
      parseSubjectGradingPolicy({
        id: '',
        name: '',
        sort_order: 0,
        color: '#1b5698',
      }),
    []
  );

  const subjectPolicyMap = useMemo(() => {
    const map = new Map<string, SubjectGradingPolicy>();
    for (const s of subjects) {
      map.set(s.id, parseSubjectGradingPolicy(s));
    }
    return map;
  }, [subjects]);

  const typeMap = useMemo(() => {
    const map = new Map<string, AssignmentTypeConfig>();
    assignmentTypes.forEach((t) => map.set(t.slug, t));
    return map;
  }, [assignmentTypes]);

  const assignmentMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        moodleMeta: MoodleAssignmentMetadata | null;
        isApiSynced: boolean;
        isOverridden: boolean;
        needsGrading: boolean;
        pendingApiGrade: boolean;
        isUpcoming: boolean;
      }
    >();
    for (const a of assignments) {
      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
      const moodleMeta = parseAssignmentMoodleMeta(a.state_standards);
      const isApiSynced = isAssignmentApiSynced(a, sub);
      const isOverridden = Boolean(moodleMeta?.manual_override);
      const needsGrading = isAssignmentAwaitingManualGrade(a, sub, todayStr);
      const pendingApiGrade = isAssignmentPendingApiGrade(a, sub, todayStr);
      const isUpcoming = isAssignmentUpcoming(a, todayStr);
      map.set(a.id, {
        moodleMeta,
        isApiSynced,
        isOverridden,
        needsGrading,
        pendingApiGrade,
        isUpcoming,
      });
    }
    return map;
  }, [assignments, subjectMap, todayStr]);

  const syllabusMap = useMemo(() => {
    const map = new Map<number, MathSyllabusDay>();
    for (const d of syllabusDays) map.set(d.day_number, d);
    return map;
  }, [syllabusDays]);

  const syllabusWeekOptions = useMemo(() => {
    const currentMonStr = getCurrentWeekMonday();
    let baseWeekDate = '2026-10-12';
    let baseWeekNum = 6;
    let maxWeeks = 34;

    for (const s of subjects) {
      const cfg = parseRecurringConfig(s.recurring_config, s.name);
      if (cfg.course_syllabus?.weeks && cfg.course_syllabus.weeks.length > 0) {
        baseWeekDate = cfg.base_week_date || '2026-10-12';
        baseWeekNum = cfg.base_week_num || 6;
        const maxSylWeek = Math.max(
          ...cfg.course_syllabus.weeks.map((w) => w.week_number),
          34
        );
        maxWeeks = Math.max(maxWeeks, maxSylWeek);
        break;
      }
    }

    const formatWeekRange = (mon: Date, fri: Date): string => {
      const monMonth = mon.toLocaleDateString('en-US', { month: 'short' });
      const friMonth = fri.toLocaleDateString('en-US', { month: 'short' });
      return mon.getMonth() === fri.getMonth()
        ? `${monMonth} ${mon.getDate()}–${fri.getDate()}, ${fri.getFullYear()}`
        : `${monMonth} ${mon.getDate()} – ${friMonth} ${fri.getDate()}, ${fri.getFullYear()}`;
    };

    const baseMon = new Date(baseWeekDate + 'T00:00:00');
    const options: Array<{
      weekNum: number;
      mondayDate: string;
      label: string;
      isCurrentWeek: boolean;
    }> = [];

    for (let w = 1; w <= maxWeeks; w++) {
      const diffWeeks = w - baseWeekNum;
      const mon = new Date(baseMon);
      mon.setDate(baseMon.getDate() + diffWeeks * 7);
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);

      const yyyy = mon.getFullYear();
      const mm = String(mon.getMonth() + 1).padStart(2, '0');
      const dd = String(mon.getDate()).padStart(2, '0');
      const mondayStr = `${yyyy}-${mm}-${dd}`;

      const isCurrent = mondayStr === currentMonStr;
      options.push({
        weekNum: w,
        mondayDate: mondayStr,
        label: `Week ${w}: ${formatWeekRange(mon, fri)}`,
        isCurrentWeek: isCurrent,
      });
    }

    if (!options.some((o) => o.mondayDate === currentMonStr)) {
      const curMon = new Date(currentMonStr + 'T00:00:00');
      const diffMs = curMon.getTime() - baseMon.getTime();
      const diffW = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
      const estWeek = baseWeekNum + diffW;
      const curFri = new Date(curMon);
      curFri.setDate(curMon.getDate() + 4);
      options.push({
        weekNum: estWeek,
        mondayDate: currentMonStr,
        label: `${estWeek >= 1 ? `Week ${estWeek}: ` : ''}${formatWeekRange(curMon, curFri)}`,
        isCurrentWeek: true,
      });
      options.sort((a, b) => a.mondayDate.localeCompare(b.mondayDate));
    }

    return options;
  }, [subjects]);

  const stagedAssignments = useMemo(
    () => assignments.filter((a) => a.workflow_status === 'staged'),
    [assignments]
  );

  const selectedSubjectSyllabusRows = useMemo(() => {
    const sub = subjectMap.get(syllabusStageSubjectId);
    if (!sub) return [];
    const rec = parseRecurringConfig(sub.recurring_config, sub.name);
    if (rec.mode === 'math_syllabus' || sub.name.toLowerCase().includes('math')) {
      return syllabusDays;
    }
    return rec.course_syllabus?.days || [];
  }, [syllabusStageSubjectId, subjectMap, syllabusDays]);

  const handleOpenCreateModal = (
    mode: 'single' | 'recurring_template' = 'single'
  ) => {
    setEditingAssignment(null);
    setEditingTemplate(null);
    setModalInitialValues({
      subject_id: subjectFilter !== 'all' ? subjectFilter : subjects[0]?.id || '',
      entry_mode: mode,
    });
    setOpenModal(true);
  };

  const handleOpenEditModal = (a: GradebookAssignment) => {
    const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
    if (isAssignmentApiSynced(a, sub)) {
      setApiWarningAssignment(a);
      return;
    }
    setEditingTemplate(null);
    setEditingAssignment(a);
    setModalInitialValues(undefined);
    setOpenModal(true);
  };

  const handleOpenQuickGradeModal = (a: GradebookAssignment) => {
    const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
    if (isAssignmentApiSynced(a, sub)) {
      setApiWarningAssignment(a);
      return;
    }
    setQuickGradeAssignment(a);
  };

  const handleToggleStatus = async (a: GradebookAssignment) => {
    const meta = assignmentMetaMap.get(a.id);
    const currentlyDone = isAssignmentCompletedOrSubmitted(
      a,
      meta?.moodleMeta ?? null
    );
    const newStatus = currentlyDone ? 'pending' : 'completed';
    const newWorkflow = newStatus === 'completed' ? 'completed' : 'not_started';
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus, workflow_status: newWorkflow })
        .eq('id', a.id);

      if (error) {
        toast.error(`Failed to update status: ${error.message}`);
      } else {
        setAssignments((prev) =>
          prev.map((item) =>
            item.id === a.id
              ? { ...item, status: newStatus, workflow_status: newWorkflow }
              : item
          )
        );
        toast.success(
          newStatus === 'completed' ? 'Assignment completed!' : 'Marked pending'
        );
      }
    } catch {
      toast.error('Error updating status');
    }
  };

  const handleDeleteAssignment = async (target: GradebookAssignment) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', target.id);
      if (error) {
        toast.error(`Failed to delete assignment: ${error.message}`);
      } else {
        setConfirmDeleteAssignmentId(null);
        setAssignments((prev) => prev.filter((a) => a.id !== target.id));
        toast(
          (t) => (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" fontWeight={600}>
                Deleted &ldquo;{target.title}&rdquo;
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={async () => {
                  toast.dismiss(t.id);
                  const { data: restored, error: restoreErr } = await supabase
                    .from('assignments')
                    .insert(target as unknown as Record<string, unknown>)
                    .select('*')
                    .single();
                  if (!restoreErr && restored) {
                    const restoredObj = restored as unknown as GradebookAssignment;
                    setAssignments((prev) => [restoredObj, ...prev]);
                    toast.success('Assignment restored');
                  } else {
                    toast.error('Could not restore assignment');
                  }
                }}
                sx={{ fontWeight: 700, textTransform: 'none', py: 0.25 }}
              >
                Undo
              </Button>
            </Stack>
          ),
          { duration: 5000 }
        );
      }
    } catch {
      toast.error('Error deleting assignment');
    }
  };

  const handleDeleteRecurringTemplate = async (
    tpl: RecurringAssignmentTemplate
  ) => {
    try {
      const { error } = await supabase
        .from('recurring_assignment_templates')
        .delete()
        .eq('id', tpl.id);
      if (error) {
        toast.error(`Failed to remove rule: ${error.message}`);
        return;
      }
      setConfirmDeleteTemplateId(null);
      setRecurringTemplates((prev) => prev.filter((item) => item.id !== tpl.id));
      toast(
        (t) => (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              Removed recurring rule &ldquo;{tpl.title_template}&rdquo;
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={async () => {
                toast.dismiss(t.id);
                const { data: restored, error: restoreErr } = await supabase
                  .from('recurring_assignment_templates')
                  .insert({
                    id: tpl.id,
                    subject_id: tpl.subject_id,
                    title_template: tpl.title_template,
                    instructions_template: tpl.instructions_template,
                    assignment_type_slug: tpl.assignment_type_slug,
                    grading_mode: tpl.grading_mode,
                    points_possible: tpl.points_possible,
                    total_problems_default: tpl.total_problems_default,
                    days_of_week: tpl.days_of_week as unknown as Json,
                    linked_weekly_source: tpl.linked_weekly_source,
                    auto_behavior: tpl.auto_behavior,
                    estimated_minutes: tpl.estimated_minutes,
                    is_active: tpl.is_active,
                  })
                  .select('*')
                  .single();
                if (!restoreErr && restored) {
                  setRecurringTemplates((prev) => [...prev, tpl]);
                  toast.success('Recurring rule restored');
                }
              }}
              sx={{ fontWeight: 700, textTransform: 'none', py: 0.25 }}
            >
              Undo
            </Button>
          </Stack>
        ),
        { duration: 5000 }
      );
    } catch {
      toast.error('Error removing recurring rule');
    }
  };

  // Inline Quick Score Save (Math/Spelling Total/Missed OR Points Earned/Possible)
  const handleSaveInlineScore = async (assignment: GradebookAssignment) => {
    const draft = inlineDrafts[assignment.id];
    if (!draft) return;

    const sub = assignment.subject_id
      ? subjectMap.get(assignment.subject_id)
      : undefined;
    const policy = sub
      ? parseSubjectGradingPolicy(sub)
      : parseSubjectGradingPolicy({
          id: '',
          name: '',
          sort_order: 0,
          color: '#1b5698',
        });

    const typeInfo = typeMap.get(assignment.category);
    const mode: ScoringMode =
      assignment.grading_mode || typeInfo?.scoring_mode || 'points';
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
          ? 'Enter both Total and Missed to calculate % score'
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
          [updated.id]: false,
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

  const handleBatchApproveAllStaged = async () => {
    if (stagedAssignments.length === 0) return;
    setApprovingAllStaged(true);
    try {
      const ids = stagedAssignments.map((a) => a.id);
      const { error } = await supabase
        .from('assignments')
        .update({ workflow_status: 'not_started', is_graded: true })
        .in('id', ids);
      if (error) {
        toast.error(`Failed to approve staged assignments: ${error.message}`);
        return;
      }
      setAssignments((prev) =>
        prev.map((a) =>
          ids.includes(a.id)
            ? { ...a, workflow_status: 'not_started', is_graded: true }
            : a
        )
      );
      toast.success(`Approved ${ids.length} pending assignment(s) as graded!`);
    } catch {
      toast.error('Error approving all pending assignments');
    } finally {
      setApprovingAllStaged(false);
    }
  };

  // Imported Pending Assignments (Staging) Approval & Dismissal Handlers
  const handleUpdateStagedDecision = async (
    assignment: GradebookAssignment,
    decision: 'approve_graded' | 'weekly_only' | 'delete'
  ) => {
    try {
      if (decision === 'delete') {
        await supabase.from('assignments').delete().eq('id', assignment.id);
        setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
        toast.success('Removed from pending imports');
        return;
      }

      const payload =
        decision === 'approve_graded'
          ? { workflow_status: 'not_started' as const, is_graded: true }
          : { workflow_status: 'ignored' as const, is_graded: false };

      const { data, error } = await supabase
        .from('assignments')
        .update(payload)
        .eq('id', assignment.id)
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to update pending item: ${error.message}`);
        return;
      }

      if (data) {
        const updated = data as unknown as GradebookAssignment;
        setAssignments((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
        toast.success(
          decision === 'approve_graded'
            ? 'Approved as Graded Assignment'
            : 'Marked as Weekly Planner Only (Ungraded)'
        );
      }
    } catch {
      toast.error('Error updating pending assignment');
    }
  };

  // Update 3-State Auto-Behavior on a Recurring Assignment Template
  const handleChangeTemplateAutoBehavior = async (
    tpl: RecurringAssignmentTemplate,
    nextBehavior: AutoBehaviorMode
  ) => {
    try {
      const { error } = await supabase
        .from('recurring_assignment_templates')
        .update({
          auto_behavior: nextBehavior,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tpl.id);

      if (error) {
        toast.error(`Failed to update auto behavior: ${error.message}`);
        return;
      }

      setRecurringTemplates((prev) =>
        prev.map((item) =>
          item.id === tpl.id ? { ...item, auto_behavior: nextBehavior } : item
        )
      );
      toast.success(`Updated rule to "${nextBehavior.replace(/_/g, ' ')}"`);
    } catch {
      toast.error('Error updating recurring template');
    }
  };

  // Populate / Sync Recurring Assignments & Participation for Target Week
  const handleSyncRecurringAssignmentsForWeek = async () => {
    setSyncingRecurringWeek(true);
    try {
      const monday = new Date(stagingWeekMonday + 'T00:00:00');
      const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      const weekDates: Array<{
        dateStr: string;
        dayKey: DayKey;
        dayName: string;
      }> = [];

      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        weekDates.push({
          dateStr: `${yyyy}-${mm}-${dd}`,
          dayKey: DAY_KEYS[i],
          dayName: dayNames[i],
        });
      }

      let createdCount = 0;
      let stagedCount = 0;

      for (const sub of subjects) {
        const recCfg = parseRecurringConfig(sub.recurring_config, sub.name);
        const counters = resolveSubjectCountersForWeek(
          recCfg,
          stagingWeekMonday,
          undefined
        );
        const candidates = generateWeekAssignmentsFromTemplatesAndPolicy({
          subject: sub,
          recurringConfig: recCfg,
          counters,
          weekDates,
          syllabusMap,
          templates: recurringTemplates,
        });

        for (const cand of candidates) {
          const candMeta = parseAssignmentMoodleMeta(cand.state_standards);
          const candCmid = candMeta?.moodle_cmid;
          const existingMatch = assignments.find((existing) => {
            if (existing.subject_id !== cand.subject_id) return false;
            if (
              existing.due_date === cand.due_date &&
              normalizeAssessmentTitleForDedup(existing.title) ===
                normalizeAssessmentTitleForDedup(cand.title)
            ) {
              return true;
            }
            if (cand.source_type === 'syllabus_staged' || typeof candCmid === 'number') {
              const exMeta = parseAssignmentMoodleMeta(existing.state_standards);
              if (
                typeof candCmid === 'number' &&
                typeof exMeta?.moodle_cmid === 'number' &&
                exMeta.moodle_cmid === candCmid
              ) {
                return true;
              }
              if (
                normalizeAssessmentTitleForDedup(existing.title) ===
                normalizeAssessmentTitleForDedup(cand.title)
              ) {
                return true;
              }
            }
            return false;
          });

          if (existingMatch) {
            if (
              existingMatch.due_date !== cand.due_date &&
              existingMatch.percentage_score == null &&
              existingMatch.status !== 'completed' &&
              existingMatch.workflow_status !== 'completed'
            ) {
              const exMetaObj = parseAssignmentMoodleMeta(existingMatch.state_standards);
              const mergedStandards: Json | null = candMeta
                ? ({
                    ...(exMetaObj ?? {}),
                    ...candMeta,
                  } as unknown as Json)
                : (existingMatch.state_standards ?? null);
              const { data: updatedRow } = await supabase
                .from('assignments')
                .update({
                  due_date: cand.due_date,
                  assigned_date: cand.assigned_date,
                  syllabus_day_number: cand.syllabus_day_number,
                  state_standards: mergedStandards,
                })
                .eq('id', existingMatch.id)
                .select('*')
                .single();
              if (updatedRow) {
                const updatedTyped = updatedRow as unknown as GradebookAssignment;
                setAssignments((prev) =>
                  prev.map((a) => (a.id === updatedTyped.id ? updatedTyped : a))
                );
              }
            }
            continue;
          }

          const { data } = await supabase
            .from('assignments')
            .insert({
              subject_id: cand.subject_id,
              title: cand.title,
              description: cand.description,
              instructions: cand.instructions,
              due_date: cand.due_date,
              assigned_date: cand.assigned_date,
              category: cand.category,
              grading_mode: cand.grading_mode,
              points_possible: cand.points_possible,
              total_problems: cand.total_problems,
              estimated_minutes: cand.estimated_minutes,
              workflow_status: cand.workflow_status,
              status: cand.status,
              is_graded: true,
              source_type: cand.source_type,
              recurring_template_id: cand.recurring_template_id,
              syllabus_day_number: cand.syllabus_day_number,
              state_standards: cand.state_standards ?? null,
              term_name: 'Semester 1 (Fall)',
              academic_year: '2026-2027',
            })
            .select('*')
            .single();

          if (data) {
            const added = data as unknown as GradebookAssignment;
            setAssignments((prev) => [added, ...prev]);
            setInlineDrafts((prev) => ({
              ...prev,
              [added.id]: {
                total_problems:
                  typeof added.total_problems === 'number'
                    ? String(added.total_problems)
                    : '',
                missed_problems: '',
                points_earned: '',
                points_possible: String(added.points_possible ?? 100),
              },
            }));
            if (cand.workflow_status === 'staged') stagedCount++;
            else createdCount++;
          }
        }
      }

      if (createdCount === 0 && stagedCount === 0) {
        toast(
          'All active recurring assignments for that week are already generated.',
          {
            icon: 'ℹ️',
          }
        );
      } else {
        toast.success(
          `Generated ${createdCount} assignment(s) and queued ${stagedCount} item(s) for approval`
        );
      }
    } catch {
      toast.error('Failed to sync recurring assignments for week');
    } finally {
      setSyncingRecurringWeek(false);
    }
  };

  // Unified single-row Grade & Score Column renderer (combines Grade display + inline score inputs on ungraded/editing rows)
  const renderUnifiedGradeAndScoreCell = (
    a: GradebookAssignment,
    sub: SubjectWithGrading | undefined,
    policy: SubjectGradingPolicy
  ) => {
    const typeInfo = typeMap.get(a.category);
    const mode: ScoringMode =
      a.grading_mode || typeInfo?.scoring_mode || 'points';
    const meta = assignmentMetaMap.get(a.id);
    const moodleMeta = meta?.moodleMeta ?? null;
    const isApiSynced = meta ? meta.isApiSynced : isAssignmentApiSynced(a, sub);
    const isOverridden = Boolean(meta?.isOverridden);
    const isScored = typeof a.percentage_score === 'number';
    const isEditingInline = Boolean(editingInlineScoreIds[a.id]);

    if (a.is_graded === false) {
      return (
        <Chip
          size="small"
          label="Ungraded / Review"
          variant="outlined"
          sx={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}
        />
      );
    }

    if (isApiSynced) {
      const isCompletedOrSubmitted = isAssignmentCompletedOrSubmitted(
        a,
        moodleMeta
      );
      const isSubmittedState =
        a.workflow_status === 'submitted' ||
        Boolean(moodleMeta?.api_submitted_at);
      const gradeBadge = isScored ? (
        <Typography
          variant="subtitle2"
          fontWeight={800}
          onClick={() => handleOpenQuickGradeModal(a)}
          sx={{
            color: isOverridden
              ? 'error.main'
              : (a.percentage_score ?? 0) >= 90
              ? 'success.dark'
              : (a.percentage_score ?? 0) >= 80
              ? 'primary.main'
              : 'warning.dark',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {formatClassGradeDisplay(
            a.percentage_score ?? null,
            a.letter_grade || '',
            policy
          )}
        </Typography>
      ) : isCompletedOrSubmitted ? (
        <Chip
          size="small"
          color="success"
          variant="outlined"
          icon={<CheckCircle2 size={12} />}
          label={
            isSubmittedState
              ? 'Submitted · Pending Grade'
              : 'Completed · Pending Grade'
          }
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            height: 22,
            whiteSpace: 'nowrap',
          }}
        />
      ) : (
        <Chip
          size="small"
          color="info"
          variant="outlined"
          label="Pending API"
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            height: 22,
            whiteSpace: 'nowrap',
          }}
        />
      );

      if (isOverridden) {
        return (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {gradeBadge}
            <Chip
              size="small"
              icon={<ShieldAlert size={12} />}
              label="OVERRIDE"
              color="error"
              sx={{
                height: 22,
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            />
            <Tooltip title="Restore Original API Value">
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
                  px: 0.85,
                  whiteSpace: 'nowrap',
                }}
              >
                Revert
              </Button>
            </Tooltip>
          </Stack>
        );
      }

      return (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {gradeBadge}
          <Chip
            size="small"
            icon={<Lock size={11} />}
            label="API Synced"
            color="info"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
          />
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setApiWarningAssignment(a)}
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
            Override
          </Button>
        </Stack>
      );
    }

    // Manual assignment that is ALREADY scored and NOT in inline-edit mode: show crisp single-row grade + click-to-edit
    if (isScored && !isEditingInline) {
      const detailLabel =
        mode === 'problems_calculator' &&
        typeof a.total_problems === 'number' &&
        typeof a.missed_problems === 'number'
          ? `${Math.max(0, a.total_problems - a.missed_problems)}/${a.total_problems}`
          : typeof a.points_earned === 'number'
          ? `${Number(a.points_earned.toFixed(1))}/${a.points_possible ?? 100}`
          : moodleMeta?.range_formatted || '';

      return (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ whiteSpace: 'nowrap' }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={800}
            onClick={() => handleOpenQuickGradeModal(a)}
            sx={{
              color:
                (a.percentage_score ?? 0) >= 90
                  ? 'success.dark'
                  : (a.percentage_score ?? 0) >= 80
                  ? 'primary.main'
                  : 'warning.dark',
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {formatClassGradeDisplay(
              a.percentage_score ?? null,
              a.letter_grade || '',
              policy
            )}
          </Typography>
          {detailLabel && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
            >
              ({detailLabel})
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() =>
              setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: true }))
            }
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.75rem',
              borderColor: 'divider',
              py: 0.2,
              px: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Edit Score
          </Button>
        </Stack>
      );
    }

    // Ungraded manual assignment OR actively editing inline score
    const draft = inlineDrafts[a.id] || {
      total_problems:
        typeof a.total_problems === 'number' ? String(a.total_problems) : '',
      missed_problems:
        typeof a.missed_problems === 'number' ? String(a.missed_problems) : '',
      points_earned:
        typeof a.points_earned === 'number' ? String(a.points_earned) : '',
      points_possible: String(a.points_possible ?? 100),
    };

    const compactInputSx = {
      width: 64,
      height: 30,
      px: 0.85,
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      color: 'text.primary',
      fontSize: '0.75rem',
      fontWeight: 600,
      fontFamily: 'inherit',
      fontVariantNumeric: 'tabular-nums',
      outline: 'none',
      '&:focus': {
        borderColor: 'primary.main',
      },
    } as const;

    if (mode === 'problems_calculator') {
      return (
        <Stack
          direction="row"
          spacing={0.65}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ whiteSpace: 'nowrap' }}
        >
          <Box
            component="input"
            type="number"
            aria-label={`Total problems for ${a.title}`}
            title="Total Problems (Press Enter to save)"
            placeholder="Total"
            value={draft.total_problems}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setInlineDrafts((prev) => ({
                ...prev,
                [a.id]: { ...draft, total_problems: e.target.value },
              }))
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveInlineScore(a);
              }
            }}
            sx={compactInputSx}
          />
          <Box
            component="input"
            type="number"
            aria-label={`Missed problems for ${a.title}`}
            title="Missed Problems (Press Enter to save)"
            placeholder="Missed"
            value={draft.missed_problems}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setInlineDrafts((prev) => ({
                ...prev,
                [a.id]: { ...draft, missed_problems: e.target.value },
              }))
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveInlineScore(a);
              }
            }}
            sx={compactInputSx}
          />
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={savingInlineId === a.id}
            onClick={() => handleSaveInlineScore(a)}
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.75rem',
              minWidth: 52,
              height: 30,
              px: 1,
            }}
          >
            {savingInlineId === a.id ? '...' : 'Save'}
          </Button>
          {isEditingInline && (
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() =>
                setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: false }))
              }
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                minWidth: 0,
                px: 0.75,
              }}
            >
              Cancel
            </Button>
          )}
        </Stack>
      );
    }

    return (
      <Stack
        direction="row"
        spacing={0.65}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ whiteSpace: 'nowrap' }}
      >
        <Box
          component="input"
          type="number"
          aria-label={`Points earned for ${a.title}`}
          title="Points Earned (Press Enter to save)"
          placeholder="Earned"
          value={draft.points_earned}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInlineDrafts((prev) => ({
              ...prev,
              [a.id]: { ...draft, points_earned: e.target.value },
            }))
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSaveInlineScore(a);
            }
          }}
          sx={compactInputSx}
        />
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          /
        </Typography>
        <Box
          component="input"
          type="number"
          aria-label={`Points possible for ${a.title}`}
          title="Points Possible (Press Enter to save)"
          placeholder="Max"
          value={draft.points_possible}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInlineDrafts((prev) => ({
              ...prev,
              [a.id]: { ...draft, points_possible: e.target.value },
            }))
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSaveInlineScore(a);
            }
          }}
          sx={compactInputSx}
        />
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={savingInlineId === a.id}
          onClick={() => handleSaveInlineScore(a)}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.75rem',
            minWidth: 52,
            height: 30,
            px: 1,
          }}
        >
          {savingInlineId === a.id ? '...' : 'Save'}
        </Button>
        {isEditingInline && (
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() =>
              setEditingInlineScoreIds((prev) => ({ ...prev, [a.id]: false }))
            }
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              minWidth: 0,
              px: 0.75,
            }}
          >
            Cancel
          </Button>
        )}
      </Stack>
    );
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const statusCounts = useMemo(() => {
    let all = 0;
    let needsGrading = 0;
    let pendingGrades = 0;
    let graded = 0;
    let upcoming = 0;
    for (const a of assignments) {
      if (a.workflow_status === 'ignored' || a.workflow_status === 'staged')
        continue;
      all += 1;
      const meta = assignmentMetaMap.get(a.id);
      if (meta?.needsGrading) needsGrading += 1;
      if (meta?.pendingApiGrade) pendingGrades += 1;
      if (typeof a.percentage_score === 'number') graded += 1;
      if (meta?.isUpcoming) upcoming += 1;
    }
    return { all, needsGrading, pendingGrades, graded, upcoming };
  }, [assignments, assignmentMetaMap]);

  const filteredAssignments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const seenCmidBySubject = new Set<string>();
    return assignments.filter((a) => {
      if (a.workflow_status === 'ignored' || a.workflow_status === 'staged') {
        return false;
      }
      const meta = assignmentMetaMap.get(a.id);
      const cmid = meta?.moodleMeta?.moodle_cmid;
      if (typeof cmid === 'number' && a.subject_id) {
        const cmidKey = `${a.subject_id}:${cmid}`;
        if (seenCmidBySubject.has(cmidKey)) {
          return false;
        }
        seenCmidBySubject.add(cmidKey);
      }

      if (statusTab === 'needs_grading' && !meta?.needsGrading) {
        return false;
      }
      if (statusTab === 'pending_grades' && !meta?.pendingApiGrade) {
        return false;
      }
      if (statusTab === 'graded' && typeof a.percentage_score !== 'number') {
        return false;
      }
      if (statusTab === 'upcoming' && !meta?.isUpcoming) {
        return false;
      }

      if (subjectFilter !== 'all' && a.subject_id !== subjectFilter) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;

      if (!query) return true;
      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
      const matchesTitle = a.title.toLowerCase().includes(query);
      const matchesDesc = (a.description || '').toLowerCase().includes(query);
      const subName = sub?.name || '';
      const matchesSub = subName.toLowerCase().includes(query);
      return matchesTitle || matchesDesc || matchesSub;
    });
  }, [
    assignments,
    assignmentMetaMap,
    statusTab,
    subjectFilter,
    categoryFilter,
    searchQuery,
    subjectMap,
  ]);

  const sortedAssignments = useMemo(() => {
    return [...filteredAssignments].sort((a, b) => {
      if (sortField === 'due_date') {
        return sortOrder === 'asc'
          ? a.due_date.localeCompare(b.due_date)
          : b.due_date.localeCompare(a.due_date);
      }

      if (sortField === 'category') {
        return sortOrder === 'asc'
          ? a.category.localeCompare(b.category)
          : b.category.localeCompare(a.category);
      }

      if (sortField === 'subject') {
        const nameA = a.subject_id
          ? subjectMap.get(a.subject_id)?.name || ''
          : '';
        const nameB = b.subject_id
          ? subjectMap.get(b.subject_id)?.name || ''
          : '';
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      return 0;
    });
  }, [filteredAssignments, sortField, sortOrder, subjectMap]);

  const visibleSortedAssignments = useMemo(
    () => sortedAssignments.slice(0, visibleRowLimit),
    [sortedAssignments, visibleRowLimit]
  );

  const renderGroupedTables = () => {
    if (groupBy === 'none') {
      return renderTableRows(visibleSortedAssignments);
    }

    const groups = new Map<string, GradebookAssignment[]>();

    visibleSortedAssignments.forEach((a) => {
      let key = 'Unassigned';
      if (groupBy === 'subject') {
        key = a.subject_id
          ? subjectMap.get(a.subject_id)?.name || 'General Subject'
          : 'General Subject';
      } else if (groupBy === 'category') {
        key = typeMap.get(a.category)?.name || a.category.toUpperCase();
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(a);
    });

    return Array.from(groups.entries()).map(([groupName, groupItems]) => (
      <Box key={groupName} sx={{ mb: 3 }}>
        <Box
          sx={{
            py: 1,
            px: 2,
            bgcolor: 'action.selected',
            borderBottom: '2px solid',
            borderColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Bookmark size={16} color={theme.palette.primary.main} />
          <Typography variant="subtitle2" fontWeight={800} color="primary.main">
            {groupName} ({groupItems.length})
          </Typography>
        </Box>
        <Table sx={{ minWidth: 650 }}>
          <TableBody>{renderTableRows(groupItems, false)}</TableBody>
        </Table>
      </Box>
    ));
  };

  const renderTableRows = (
    items: GradebookAssignment[],
    showTableHeadIfFlat = true
  ) => {
    if (items.length === 0 && showTableHeadIfFlat) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
            <Box textAlign="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <FileText size={28} />
              </Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                No School Assignments Match Filter
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}
              >
                Create single or recurring graded assignments, math problem sets, spelling tests, and projects linked directly to your Gradebook and Weekly Planner.
              </Typography>
              <Stack direction="row" spacing={1.5} justifyContent="center">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleOpenCreateModal('single')}
                  startIcon={<Plus size={18} />}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Create Assignment
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => handleOpenCreateModal('recurring_template')}
                  startIcon={<Repeat size={18} />}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Create Recurring Assignment Rule
                </Button>
              </Stack>
            </Box>
          </TableCell>
        </TableRow>
      );
    }

    return items.map((a) => {
      const sub = a.subject_id ? subjectMap.get(a.subject_id) : undefined;
      const typeInfo = typeMap.get(a.category);
      const meta = assignmentMetaMap.get(a.id);
      const moodleMeta = meta?.moodleMeta ?? null;
      const isCompleted = isAssignmentCompletedOrSubmitted(a, moodleMeta);
      const isSubmittedState =
        a.workflow_status === 'submitted' ||
        Boolean(moodleMeta?.api_submitted_at);
      const isOverridden = Boolean(meta?.isOverridden);
      const policy =
        (a.subject_id ? subjectPolicyMap.get(a.subject_id) : undefined) ||
        defaultGradingPolicy;
      const isConfirmingDelete = confirmDeleteAssignmentId === a.id;

      return (
        <TableRow
          key={a.id}
          hover
          sx={{
            opacity: isCompleted ? 0.88 : 1,
            bgcolor: isOverridden
              ? alpha(theme.palette.warning.main, 0.05)
              : isCompleted
              ? 'action.hover'
              : 'transparent',
          }}
        >
          {/* 1. DONE CHECKBOX */}
          <TableCell align="center" sx={{ width: 56, whiteSpace: 'nowrap' }}>
            <Checkbox
              checked={isCompleted}
              onChange={() => handleToggleStatus(a)}
              color="success"
              inputProps={{
                'aria-label': `Mark ${a.title} as ${
                  isCompleted ? 'pending' : 'completed'
                }`,
              }}
            />
          </TableCell>

          {/* 2. ASSIGNMENT TITLE & METADATA */}
          <TableCell sx={{ minWidth: 220 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      textDecoration: isCompleted ? 'line-through' : 'none',
                    }}
                  >
                    {a.title}
                  </Typography>
                  {isCompleted && typeof a.percentage_score !== 'number' && (
                    <Chip
                      icon={<CheckCircle2 size={12} />}
                      label={isSubmittedState ? 'Submitted' : 'Completed'}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                    />
                  )}
                  {moodleMeta?.syllabus_day_number && !moodleMeta?.week_number && (
                    <Chip
                      label={`Day ${moodleMeta.syllabus_day_number}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                    />
                  )}
                  {moodleMeta?.week_number && (
                    <Chip
                      label={`Week ${moodleMeta.week_number}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                    />
                  )}
                  {isOverridden && (
                    <Chip
                      label="MANUAL OVERRIDE"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.warning.main, 0.14),
                        color: 'warning.dark',
                        border: '1px solid',
                        borderColor: 'warning.main',
                      }}
                    />
                  )}
                  {(a.is_graded === false ||
                    (moodleMeta?.is_ungraded_bucket &&
                      typeof a.percentage_score === 'number')) && (
                    <Chip
                      label="0% Weight (Ungraded)"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                    />
                  )}
                </Stack>
                {a.description && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {a.description}
                  </Typography>
                )}
                {moodleMeta &&
                  (moodleMeta.weight_formatted ||
                    moodleMeta.contribution_formatted) && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', fontSize: '0.75rem' }}
                    >
                      {moodleMeta.weight_formatted
                        ? `Wt: ${moodleMeta.weight_formatted}`
                        : ''}
                      {moodleMeta.contribution_formatted
                        ? ` • Contrib: ${moodleMeta.contribution_formatted}`
                        : ''}
                    </Typography>
                  )}
                {a.teacher_comments && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'info.main',
                      fontWeight: 600,
                      mt: 0.25,
                    }}
                  >
                    Feedback: {a.teacher_comments}
                  </Typography>
                )}
              </Box>
            </Stack>
          </TableCell>

          {/* 3. UNIFIED CLASS & TYPE COLUMN */}
          <TableCell sx={{ width: 175, whiteSpace: 'nowrap' }}>
            <Stack spacing={0.5} alignItems="flex-start">
              {sub ? (
                <Stack direction="row" spacing={0.75} alignItems="center">
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
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {sub.name}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  General
                </Typography>
              )}
              <Chip
                size="small"
                label={typeInfo?.name || a.category.toUpperCase()}
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderColor: typeInfo?.color || 'divider',
                  color: typeInfo?.color || 'text.secondary',
                }}
              />
            </Stack>
          </TableCell>

          {/* 4. OPEN / DUE DATES (Single-Row Human-Readable) */}
          <TableCell sx={{ width: 165, whiteSpace: 'nowrap' }}>
            <Stack spacing={0.35} alignItems="flex-start">
              {a.assigned_date && a.assigned_date !== a.due_date && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Opens {formatCompactDate(a.assigned_date)}
                </Typography>
              )}
              <Chip
                icon={<CalendarIcon size={12} />}
                label={
                  a.assigned_date && a.assigned_date !== a.due_date
                    ? `Due ${formatCompactDate(a.due_date)}`
                    : formatCompactDate(a.due_date)
                }
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              />
            </Stack>
          </TableCell>

          {/* 5. UNIFIED GRADE & SCORE COLUMN */}
          <TableCell
            align="right"
            sx={{ minWidth: 260, whiteSpace: 'nowrap' }}
          >
            {renderUnifiedGradeAndScoreCell(a, sub, policy)}
          </TableCell>

          {/* 6. ACTIONS (WITH 2-STEP DELETE CONFIRM) */}
          <TableCell
            align="right"
            sx={{ width: 110, whiteSpace: 'nowrap' }}
          >
            {isConfirmingDelete ? (
              <Stack
                direction="row"
                spacing={0.5}
                justifyContent="flex-end"
                alignItems="center"
              >
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => handleDeleteAssignment(a)}
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    py: 0.2,
                    px: 0.85,
                    minWidth: 0,
                  }}
                >
                  Confirm
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  onClick={() => setConfirmDeleteAssignmentId(null)}
                  sx={{
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    py: 0.2,
                    px: 0.6,
                    minWidth: 0,
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Edit Assignment Details">
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label={`Edit ${a.title}`}
                    onClick={() => handleOpenEditModal(a)}
                  >
                    <Edit2 size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Assignment">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${a.title}`}
                    onClick={() => setConfirmDeleteAssignmentId(a.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
    }
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  if (loading) {
    return (
      <Stack spacing={2.5} sx={{ py: 2 }}>
        <Skeleton variant="rounded" height={68} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }

  return (
    <Box
      onClick={() => {
        if (toolsMenuOpen) setToolsMenuOpen(false);
      }}
    >
      <PageHeading
        heading="School Assignments Manager"
        caption="Create, edit, and grade assignments, configure recurring weekly rules, and review imported pending assignments."
        actions={
          <Stack direction="row" spacing={1.25} alignItems="center">
            {/* Consolidated Assignment Tools Dropdown Menu */}
            <Box
              sx={{ position: 'relative' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<Settings size={15} />}
                endIcon={<ChevronDown size={14} />}
                onClick={() => setToolsMenuOpen((prev) => !prev)}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: 'divider',
                  height: 36,
                }}
              >
                Assignment Tools
              </Button>

              {toolsMenuOpen && (
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
                      startIcon={<Repeat size={15} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        handleOpenCreateModal('recurring_template');
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
                      New Recurring Assignment Rule
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Layers size={15} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setOpenTypesModal(true);
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
                      Edit Assignment Types
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<Sliders size={15} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setOpenPolicyModal(true);
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
                      Class Grading Rules
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      color="inherit"
                      startIcon={<BookOpen size={15} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        setActivePrimaryTab('imported_pending');
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
                      Import Pending Syllabus Assignments
                    </Button>
                    <Divider sx={{ my: 0.5 }} />
                    <Button
                      fullWidth
                      size="small"
                      color="primary"
                      startIcon={<GraduationCap size={15} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        router.push('/gradebook');
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        py: 0.85,
                      }}
                    >
                      Open Gradebook &amp; Reports
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Box>

            {/* Primary + New Assignment Button (Only button outside the menu) */}
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Plus size={18} />}
              onClick={() => handleOpenCreateModal('single')}
              sx={{ fontWeight: 700, textTransform: 'none', height: 36, px: 2 }}
            >
              New Assignment
            </Button>
          </Stack>
        }
      />

      {/* OVERALL PAGE TABS: 1. All Assignments | 2. Recurring Assignment Rules | 3. Imported Pending Assignments */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={0.5} flexWrap="wrap" px={1}>
          {(
            [
              {
                value: 'assignments',
                label:
                  statusCounts.needsGrading > 0
                    ? `All Assignments (${statusCounts.needsGrading} to grade)`
                    : 'All Assignments',
                icon: <FileText size={16} />,
              },
              {
                value: 'recurring',
                label: `Recurring Assignment Rules (${recurringTemplates.length})`,
                icon: <Repeat size={16} />,
              },
              {
                value: 'imported_pending',
                label:
                  stagedAssignments.length > 0
                    ? `Imported Pending Assignments (${stagedAssignments.length})`
                    : 'Imported Pending Assignments',
                icon: <BookOpen size={16} />,
              },
            ] as const
          ).map((tab) => {
            const isSelected = activePrimaryTab === tab.value;
            return (
              <Button
                key={tab.value}
                startIcon={tab.icon}
                onClick={() => setActivePrimaryTab(tab.value)}
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  textTransform: 'none',
                  px: 2,
                  py: 1.35,
                  borderRadius: 0,
                  borderBottom: '2px solid',
                  borderColor: isSelected ? 'primary.main' : 'transparent',
                  color: isSelected ? 'primary.main' : 'text.secondary',
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </Stack>
      </Card>

      {/* =====================================================================
          PRIMARY TAB 1: ALL ASSIGNMENTS
          ===================================================================== */}
      {activePrimaryTab === 'assignments' && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            mb: 4,
          }}
        >
          {/* Status Sub-Tabs (Elevated Segmented Control with Semantic Count Badges) */}
          <Box
            sx={{
              px: 2.25,
              py: 1.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              alignItems: { lg: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 0.5,
                p: 0.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.14),
              }}
            >
              {(
                [
                  {
                    value: 'all' as const,
                    label: 'All',
                    count: statusCounts.all,
                    badgeBg: alpha(theme.palette.text.primary, 0.1),
                    badgeColor: theme.palette.text.primary,
                  },
                  {
                    value: 'needs_grading' as const,
                    label: 'Needs Grading',
                    count: statusCounts.needsGrading,
                    badgeBg: alpha(theme.palette.warning.main, 0.18),
                    badgeColor: theme.palette.warning.dark,
                  },
                  {
                    value: 'pending_grades' as const,
                    label: 'Pending Grades',
                    count: statusCounts.pendingGrades,
                    badgeBg: alpha(theme.palette.info.main, 0.18),
                    badgeColor: theme.palette.info.dark,
                  },
                  {
                    value: 'graded' as const,
                    label: 'Graded',
                    count: statusCounts.graded,
                    badgeBg: alpha(theme.palette.success.main, 0.18),
                    badgeColor: theme.palette.success.dark,
                  },
                  {
                    value: 'upcoming' as const,
                    label: 'Upcoming',
                    count: statusCounts.upcoming,
                    badgeBg: alpha(theme.palette.primary.main, 0.15),
                    badgeColor: theme.palette.primary.main,
                  },
                ]
              ).map((tab) => {
                const active = statusTab === tab.value;
                return (
                  <Button
                    key={tab.value}
                    size="small"
                    onClick={() => setStatusTab(tab.value)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: active ? 800 : 600,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      px: 1.5,
                      py: 0.65,
                      borderRadius: 1,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active ? 'background.paper' : 'transparent',
                      boxShadow: active
                        ? '0 2px 6px rgba(15, 23, 42, 0.1)'
                        : 'none',
                      '&:hover': {
                        bgcolor: active
                          ? 'background.paper'
                          : alpha(theme.palette.background.paper, 0.6),
                      },
                    }}
                  >
                    <Stack direction="row" spacing={0.85} alignItems="center">
                      <span>{tab.label}</span>
                      <Box
                        component="span"
                        sx={{
                          px: 0.8,
                          py: 0.1,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          bgcolor: active
                            ? tab.badgeBg
                            : alpha(theme.palette.text.primary, 0.08),
                          color: active ? tab.badgeColor : 'text.secondary',
                        }}
                      >
                        {tab.count}
                      </Box>
                    </Stack>
                  </Button>
                );
              })}
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              alignItems="center"
            >
              <TextField
                select
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                size="small"
                label="Filter Class"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                sx={{ minWidth: 165 }}
              >
                <option value="all">All Classes</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </TextField>

              <TextField
                size="small"
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', sm: 210 } }}
              />

              <TextField
                select
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                size="small"
                label="Group By"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
                sx={{ minWidth: 170 }}
              >
                <option value="none">No Grouping</option>
                <option value="subject">Group by Subject</option>
                <option value="category">Group by Assignment Type</option>
              </TextField>
            </Stack>
          </Box>

          {/* Distinct Recessed Assignment Type Pill/Tag Filter Strip */}
          <Box
            sx={{
              px: 2.25,
              py: 1.1,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: alpha(theme.palette.text.primary, 0.035),
              borderBottom: '2px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={0.6}
              alignItems="center"
              sx={{
                mr: 0.75,
                pr: 1.25,
                borderRight: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            >
              <Layers size={13} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                }}
              >
                Type Filter
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="All Types"
                clickable
                onClick={() => setCategoryFilter('all')}
                sx={{
                  height: 25,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontWeight: categoryFilter === 'all' ? 800 : 600,
                  bgcolor:
                    categoryFilter === 'all'
                      ? theme.palette.text.primary
                      : 'background.paper',
                  color:
                    categoryFilter === 'all'
                      ? theme.palette.background.paper
                      : 'text.secondary',
                  border: '1px solid',
                  borderColor:
                    categoryFilter === 'all'
                      ? theme.palette.text.primary
                      : 'divider',
                  '&:hover': {
                    bgcolor:
                      categoryFilter === 'all'
                        ? theme.palette.text.primary
                        : alpha(theme.palette.text.primary, 0.06),
                  },
                }}
              />
              {assignmentTypes.map((t) => {
                const isSelected = categoryFilter === t.slug;
                const dotColor = t.color || theme.palette.primary.main;
                return (
                  <Chip
                    key={t.slug}
                    size="small"
                    clickable
                    onClick={() =>
                      setCategoryFilter(isSelected ? 'all' : t.slug)
                    }
                    icon={
                      <Box
                        component="span"
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: isSelected ? '#ffffff' : dotColor,
                          ml: '8px !important',
                          mr: '-2px !important',
                        }}
                      />
                    }
                    label={t.name}
                    sx={{
                      height: 25,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 800 : 600,
                      bgcolor: isSelected ? dotColor : 'background.paper',
                      color: isSelected ? '#ffffff' : 'text.primary',
                      border: '1px solid',
                      borderColor: isSelected
                        ? dotColor
                        : alpha(dotColor, 0.35),
                      boxShadow: isSelected
                        ? `0 2px 6px ${alpha(dotColor, 0.35)}`
                        : 'none',
                      '&:hover': {
                        bgcolor: isSelected
                          ? dotColor
                          : alpha(dotColor, 0.08),
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          {(statusTab === 'needs_grading' ||
            statusTab === 'pending_grades' ||
            statusTab === 'upcoming') && (
            <Box
              sx={{
                px: 2.25,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor:
                  statusTab === 'needs_grading'
                    ? alpha(theme.palette.warning.main, 0.08)
                    : statusTab === 'pending_grades'
                    ? alpha(theme.palette.info.main, 0.08)
                    : alpha(theme.palette.primary.main, 0.06),
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                color={
                  statusTab === 'needs_grading'
                    ? 'warning.dark'
                    : statusTab === 'pending_grades'
                    ? 'info.dark'
                    : 'primary.main'
                }
              >
                {statusTab === 'needs_grading'
                  ? `Showing manual-entry assignments (Math, Spelling, Biblioplan, Science, etc.) whose open/assigned or due date has arrived (on or before ${formatCompactDate(
                      todayStr
                    )}) and need parent grading. Future assignments appear under Upcoming.`
                  : statusTab === 'pending_grades'
                  ? `Showing API-synced assignments (Classical Studies, Composition & Grammar, Latin) whose open/assigned or due date has arrived (on or before ${formatCompactDate(
                      todayStr
                    )}) and are awaiting portal grade sync.`
                  : `Showing future assignments whose open/assigned date and due date are both after ${formatCompactDate(
                      todayStr
                    )}. Past or currently open assignments never appear here.`}
              </Typography>
            </Box>
          )}

          {/* STREAMLINED 6-COLUMN ASSIGNMENTS TABLE */}
          <TableContainer component={Box}>
            <Table sx={{ minWidth: 680 }}>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell
                    sx={{
                      width: 56,
                      textAlign: 'center',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    DONE
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    ASSIGNMENT
                  </TableCell>

                  <TableCell
                    onClick={() => handleToggleSort('subject')}
                    sx={{
                      fontWeight: 700,
                      width: 175,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <span>CLASS &amp; TYPE</span>
                      {renderSortIcon('subject')}
                    </Stack>
                  </TableCell>

                  <TableCell
                    onClick={() => handleToggleSort('due_date')}
                    sx={{
                      fontWeight: 700,
                      width: 165,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <span>OPEN / DUE</span>
                      {renderSortIcon('due_date')}
                    </Stack>
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      minWidth: 260,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    GRADE &amp; SCORE
                  </TableCell>

                  <TableCell
                    sx={{
                      fontWeight: 700,
                      width: 110,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupBy === 'none'
                  ? renderTableRows(visibleSortedAssignments)
                  : null}
              </TableBody>
            </Table>

            {groupBy !== 'none' && renderGroupedTables()}

            {sortedAssignments.length > visibleRowLimit && (
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.text.primary, 0.015),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Showing {visibleSortedAssignments.length} of {sortedAssignments.length}{' '}
                  assignments
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => setVisibleRowLimit((prev) => prev + 50)}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Show Next 50
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => setVisibleRowLimit(sortedAssignments.length)}
                    sx={{ fontWeight: 600, textTransform: 'none' }}
                  >
                    Show All ({sortedAssignments.length})
                  </Button>
                </Stack>
              </Box>
            )}
          </TableContainer>
        </Card>
      )}

      {/* =====================================================================
          PRIMARY TAB 2: RECURRING ASSIGNMENT RULES
          ===================================================================== */}
      {activePrimaryTab === 'recurring' && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            mb: 4,
          }}
        >
          <Box
            sx={{
              p: 2.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Recurring Graded Assignment Rules
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configure weekly tests, quizzes, and problem sets that automatically populate on your Weekly Planner and Gradebook.
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              flexWrap="wrap"
            >
              <TextField
                select
                SelectProps={{ native: true }}
                size="small"
                label="Target Syllabus Week"
                InputLabelProps={{ shrink: true }}
                value={stagingWeekMonday}
                onChange={(e) => setStagingWeekMonday(e.target.value)}
                sx={{ minWidth: 250 }}
              >
                {syllabusWeekOptions.map((opt) => (
                  <option key={opt.mondayDate} value={opt.mondayDate}>
                    {opt.label}
                    {opt.isCurrentWeek ? ' (Current Week)' : ''}
                  </option>
                ))}
              </TextField>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={
                  syncingRecurringWeek ? (
                    <CircularProgress size={14} />
                  ) : (
                    <Sparkles size={15} />
                  )
                }
                disabled={syncingRecurringWeek}
                onClick={handleSyncRecurringAssignmentsForWeek}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                Generate for Week
              </Button>
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<Plus size={15} />}
                onClick={() => handleOpenCreateModal('recurring_template')}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                New Recurring Rule
              </Button>
            </Stack>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    CLASS
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    RECURRING RULE
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    TYPE &amp; SCORING
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    SCHEDULED DAYS
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    AUTO-BEHAVIOR
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recurringTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No recurring assignment rules configured yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recurringTemplates.map((tpl) => {
                    const sub = subjectMap.get(tpl.subject_id);
                    const typeInfo = typeMap.get(tpl.assignment_type_slug);
                    const isConfirmingTplDelete =
                      confirmDeleteTemplateId === tpl.id;
                    return (
                      <TableRow key={tpl.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: sub?.color || '#1b5698',
                              }}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              {sub?.name || 'Subject'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {tpl.title_template}
                          </Typography>
                          {tpl.instructions_template && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {tpl.instructions_template}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              label={typeInfo?.name || tpl.assignment_type_slug}
                              sx={{
                                height: 20,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {tpl.grading_mode === 'problems_calculator'
                                ? `${tpl.total_problems_default || 20} probs`
                                : `${tpl.points_possible} pts`}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" spacing={0.5} flexWrap="nowrap">
                            {tpl.days_of_week.map((d) => (
                              <Chip
                                key={d}
                                size="small"
                                label={d.slice(0, 3).toUpperCase()}
                                sx={{
                                  height: 20,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={tpl.auto_behavior}
                            onChange={(_, val) => {
                              if (val) {
                                handleChangeTemplateAutoBehavior(
                                  tpl,
                                  val as AutoBehaviorMode
                                );
                              }
                            }}
                          >
                            <ToggleButton
                              value="auto_create"
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                py: 0.25,
                              }}
                            >
                              Auto-Create
                            </ToggleButton>
                            <ToggleButton
                              value="queue_for_approval"
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                py: 0.25,
                              }}
                            >
                              Pending Review
                            </ToggleButton>
                            <ToggleButton
                              value="ignore"
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                py: 0.25,
                              }}
                            >
                              Ignore
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {isConfirmingTplDelete ? (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="flex-end"
                            >
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleDeleteRecurringTemplate(tpl)}
                                sx={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  py: 0.2,
                                  px: 0.85,
                                  minWidth: 0,
                                }}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                onClick={() => setConfirmDeleteTemplateId(null)}
                                sx={{
                                  fontSize: '0.75rem',
                                  textTransform: 'none',
                                  py: 0.2,
                                  px: 0.6,
                                  minWidth: 0,
                                }}
                              >
                                Cancel
                              </Button>
                            </Stack>
                          ) : (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="flex-end"
                            >
                              <IconButton
                                size="small"
                                aria-label={`Edit rule ${tpl.title_template}`}
                                onClick={() => {
                                  setEditingAssignment(null);
                                  setEditingTemplate(tpl);
                                  setModalInitialValues(undefined);
                                  setOpenModal(true);
                                }}
                              >
                                <Edit2 size={14} />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Delete rule ${tpl.title_template}`}
                                onClick={() => setConfirmDeleteTemplateId(tpl.id)}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* =====================================================================
          PRIMARY TAB 3: IMPORTED PENDING ASSIGNMENTS
          ===================================================================== */}
      {activePrimaryTab === 'imported_pending' && (
        <Stack spacing={3} sx={{ mb: 4 }}>
          {/* PART A: IMPORTED PENDING ASSIGNMENTS QUEUE */}
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
                p: 2.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Imported Pending Assignments ({stagedAssignments.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Review assignments imported from syllabi or weekly rules before they count toward class grades.
                </Typography>
              </Box>
              {stagedAssignments.length > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={approvingAllStaged}
                  startIcon={
                    approvingAllStaged ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )
                  }
                  onClick={handleBatchApproveAllStaged}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Approve All as Graded ({stagedAssignments.length})
                </Button>
              )}
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: alpha(theme.palette.text.primary, 0.02) }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      PENDING ASSIGNMENT
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      CLASS &amp; TYPE
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      DUE DATE
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      DECISION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stagedAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          No imported pending assignments are waiting for review.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    stagedAssignments.map((st) => {
                      const sub = st.subject_id
                        ? subjectMap.get(st.subject_id)
                        : undefined;
                      const typeInfo = typeMap.get(st.category);
                      return (
                        <TableRow key={st.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {st.title}
                            </Typography>
                            {st.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {st.description}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              {sub && (
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  alignItems="center"
                                >
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      bgcolor: sub.color,
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                  >
                                    {sub.name}
                                  </Typography>
                                </Stack>
                              )}
                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  typeInfo?.name || st.category.toUpperCase()
                                }
                                sx={{ height: 20, fontSize: '0.75rem' }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatCompactDate(st.due_date)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="flex-end"
                            >
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() =>
                                  handleUpdateStagedDecision(
                                    st,
                                    'approve_graded'
                                  )
                                }
                                sx={{ fontWeight: 600, textTransform: 'none' }}
                              >
                                Approve as Graded
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                  setEditingTemplate(null);
                                  setEditingAssignment(st);
                                  setModalInitialValues(undefined);
                                  setOpenModal(true);
                                }}
                                sx={{ fontWeight: 600, textTransform: 'none' }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() =>
                                  handleUpdateStagedDecision(st, 'weekly_only')
                                }
                                sx={{ fontWeight: 600, textTransform: 'none' }}
                              >
                                Weekly Only
                              </Button>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Remove pending assignment ${st.title}`}
                                onClick={() =>
                                  handleUpdateStagedDecision(st, 'delete')
                                }
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {/* PART B: IMPORT FROM COURSE SYLLABUS */}
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
                p: 2.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Import from Course Syllabus
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Promote specific syllabus lessons, tests, or workbook pages into Graded Assignments.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField
                  select
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  label="Course Syllabus"
                  value={syllabusStageSubjectId}
                  onChange={(e) => setSyllabusStageSubjectId(e.target.value)}
                  sx={{ minWidth: 210 }}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => router.push('/automations?tab=syllabus')}
                  sx={{ fontWeight: 600, textTransform: 'none' }}
                >
                  Manage Syllabi
                </Button>
              </Stack>
            </Box>

            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        width: 90,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      DAY
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      TOPIC
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      WORKBOOK / HOMEWORK
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      NOTES
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedSubjectSyllabusRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No day-by-day syllabus rows uploaded for this class yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedSubjectSyllabusRows.map((row) => {
                      const sub = subjectMap.get(syllabusStageSubjectId);
                      const isMath =
                        sub?.name.toLowerCase().includes('math') ?? false;
                      const existingLinked = assignments.find(
                        (a) =>
                          a.subject_id === syllabusStageSubjectId &&
                          a.syllabus_day_number === row.day_number
                      );
                      return (
                        <TableRow key={row.day_number} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              Day {row.day_number}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {row.topic || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {row.workbook || row.textbook || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {row.notes || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {existingLinked ? (
                              <Chip
                                size="small"
                                color="success"
                                variant="outlined"
                                label={
                                  existingLinked.workflow_status === 'staged'
                                    ? 'Pending Review'
                                    : 'In Assignments'
                                }
                                onClick={() => {
                                  setEditingTemplate(null);
                                  setEditingAssignment(existingLinked);
                                  setModalInitialValues(undefined);
                                  setOpenModal(true);
                                }}
                                sx={{ fontWeight: 600, cursor: 'pointer' }}
                              />
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setEditingAssignment(null);
                                  setEditingTemplate(null);
                                  setModalInitialValues({
                                    subject_id: syllabusStageSubjectId,
                                    title: `${sub?.name || 'Course'} Day ${
                                      row.day_number
                                    }: ${
                                      row.workbook || row.topic || 'Assignment'
                                    }`,
                                    description: [
                                      row.topic && `Topic: ${row.topic}`,
                                      row.workbook &&
                                        `Workbook: ${row.workbook}`,
                                      row.textbook &&
                                        `Textbook: ${row.textbook}`,
                                      row.notes && `Notes: ${row.notes}`,
                                    ]
                                      .filter(Boolean)
                                      .join(' • '),
                                    category: isMath
                                      ? 'math_problem_set'
                                      : 'homework',
                                    grading_mode: isMath
                                      ? 'problems_calculator'
                                      : 'points',
                                    source_type: 'syllabus_staged',
                                    syllabus_day_number: row.day_number,
                                  });
                                  setOpenModal(true);
                                }}
                                sx={{ fontWeight: 600, textTransform: 'none' }}
                              >
                                + Turn into Assignment
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Stack>
      )}

      {/* SIMPLE "ENTER GRADE" QUICK MODAL */}
      <QuickGradeAssignmentModal
        open={Boolean(quickGradeAssignment)}
        onClose={() => setQuickGradeAssignment(null)}
        assignment={quickGradeAssignment}
        subject={
          quickGradeAssignment?.subject_id
            ? subjectMap.get(quickGradeAssignment.subject_id) || null
            : null
        }
        assignmentTypes={assignmentTypes}
        onSaved={(updated) => {
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
        onEditAssignment={(target) => {
          setQuickGradeAssignment(null);
          setEditingTemplate(null);
          setEditingAssignment(target);
          setModalInitialValues(undefined);
          setOpenModal(true);
        }}
      />

      {/* FULL UNIFIED ASSIGNMENT & RECURRING RULE MODAL */}
      <UnifiedAssignmentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        editingAssignment={editingAssignment}
        editingTemplate={editingTemplate}
        initialValues={modalInitialValues}
        onOpenManageTypes={() => setOpenTypesModal(true)}
        onSaved={(savedAssignment, savedTemplate) => {
          if (savedAssignment) {
            setAssignments((prev) => {
              const exists = prev.some((a) => a.id === savedAssignment.id);
              return exists
                ? prev.map((a) =>
                    a.id === savedAssignment.id ? savedAssignment : a
                  )
                : [...prev, savedAssignment];
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
                points_possible: String(
                  savedAssignment.points_possible ?? 100
                ),
              },
            }));
          }
          if (savedTemplate) {
            setRecurringTemplates((prev) => {
              const exists = prev.some((t) => t.id === savedTemplate.id);
              return exists
                ? prev.map((t) =>
                    t.id === savedTemplate.id ? savedTemplate : t
                  )
                : [...prev, savedTemplate];
            });
            loadData();
          }
        }}
      />

      <ApiGradeOverrideWarningModal
        open={Boolean(apiWarningAssignment)}
        assignment={apiWarningAssignment}
        subject={
          apiWarningAssignment?.subject_id
            ? subjectMap.get(apiWarningAssignment.subject_id) || null
            : null
        }
        onClose={() => setApiWarningAssignment(null)}
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
          setModalInitialValues(undefined);
          setApiWarningAssignment(null);
          setOpenModal(true);
        }}
      />

      <AssignmentTypesManagerModal
        open={openTypesModal}
        onClose={() => setOpenTypesModal(false)}
        assignmentTypes={assignmentTypes}
        onUpdated={(nextTypes) => setAssignmentTypes(nextTypes)}
      />

      <ClassGradingPolicyModal
        open={openPolicyModal}
        onClose={() => setOpenPolicyModal(false)}
        subjects={subjects}
        assignmentTypes={assignmentTypes}
        onSaved={(updatedSub) => {
          setSubjects((prev) =>
            prev.map((s) => (s.id === updatedSub.id ? updatedSub : s))
          );
        }}
      />
    </Box>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense
      fallback={
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="50vh"
        >
          <CircularProgress />
        </Box>
      }
    >
      <AssignmentsPageContent />
    </Suspense>
  );
}
