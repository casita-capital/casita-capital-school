'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  alpha,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Printer,
  Plus,
  Edit2,
  Trash2,
  CheckSquare,
  Sparkles,
  Save,
  Settings,
  FileText,
  X,
  RotateCcw,
  Sliders,
  Repeat,
  Copy,
  Menu as MenuIcon,
  Calendar as CalendarIcon,
  Columns,
  LayoutGrid,
  BookOpen,
  Check,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { getCachedActiveUserName, resolveAndSyncActiveUser } from 'src/utils/active-user';
import { expandTasksForDateRange } from 'src/utils/task-recurrence';
import { ItemIcon } from 'src/components/base/item-icon';
import {
  FormattedParentNote,
  PlannerNoteCategory,
  encodePlannerNoteFields,
  getPlannerNoteCategory,
  stripParentNoteMarker,
} from 'src/components/base/formatted-parent-note';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  MathSyllabusDay,
  SubjectWeekOverride,
  WeeklySubjectOverrides,
  generateSubjectWeekNotesStructured,
  getActiveCourseSyllabus,
  getApiSyllabusWeekStartDay,
  getOfficialCourseSubtitle,
  getPreviousWeekdaysBeforeStartDay,
  getSubjectCourseSyllabi,
  parseRecurringConfig,
  parseSubjectOverrides,
  resolveApiSyllabusWeekForWeekday,
  resolveSubjectCountersForWeek,
  resolveSyllabusDaySupplies,
} from 'src/utils/recurring-planner';
import {
  AssignmentTypeConfig,
  GeneratedRecurringAssignmentCandidate,
  GradebookAssignment,
  isAssignmentApiSynced,
  parseAssignmentMoodleMeta,
  RecurringAssignmentTemplate,
  SubjectWithGrading,
  generateWeekAssignmentsFromTemplatesAndPolicy,
} from 'src/utils/gradebook-calculator';
import {
  ApiGradeOverrideWarningModal,
  revertApiAssignmentOverride,
  UnifiedAssignmentModal,
} from 'src/components/assignments/unified-assignment-modal';
import { AssignmentTypesManagerModal } from 'src/components/assignments/grading-policy-modals';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  link?: string | null;
  recurring_config?: Json | null;
  grading_config?: Json | null;
}

interface ParentNote {
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

type AssignmentCategory = string;
type AssignmentPriority = 'low' | 'medium' | 'high';
type ScreenViewMode = 'binder_2page' | 'binder_spread' | 'five_day';

interface SchoolAssignment extends GradebookAssignment {
  priority: AssignmentPriority;
}

interface Holiday {
  id: string;
  title: string;
  holiday_date: string;
}

interface Habit {
  id: string;
  title: string;
  sort_order: number;
}

interface PlannerTask {
  id: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed';
}

interface WeeklySettings {
  id?: string;
  week_start_date: string;
  todos: string[];
  priorities: string[];
  for_next_month: string;
  notes: string;
  subject_overrides: WeeklySubjectOverrides;
}

const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-1', name: 'Math', sort_order: 1, color: '#1b5698' },
  { id: 'sub-2', name: 'Reading', sort_order: 2, color: '#0d735c' },
  { id: 'sub-3', name: 'Language Arts', sort_order: 3, color: '#b8422e' },
  { id: 'sub-4', name: 'Science', sort_order: 4, color: '#1e6f3d' },
  { id: 'sub-5', name: 'History', sort_order: 5, color: '#6c43b8' },
  { id: 'sub-6', name: 'Spelling', sort_order: 6, color: '#b85d0c' },
  { id: 'sub-7', name: 'Bible', sort_order: 7, color: '#2e4a8f' },
  { id: 'sub-8', name: 'P.E. / Art', sort_order: 8, color: '#9c2d7c' },
];

const DEFAULT_HABITS: Habit[] = [
  { id: 'hab-1', title: 'Vitamin 1', sort_order: 1 },
  { id: 'hab-2', title: 'Vitamin 2', sort_order: 2 },
  { id: 'hab-3', title: 'Vitamin 3', sort_order: 3 },
  { id: 'hab-4', title: 'Vitamin 4', sort_order: 4 },
  { id: 'hab-5', title: 'Vitamin 5', sort_order: 5 },
  { id: 'hab-6', title: 'Vitamin 6', sort_order: 6 },
  { id: 'hab-7', title: 'Vitamin 7', sort_order: 7 },
];

function formatDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayForDateStr(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return getCurrentWeekMonday();
  }
  const day = parsed.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(parsed);
  monday.setDate(parsed.getDate() + diff);
  return formatDateStr(monday);
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return formatDateStr(monday);
}

function isAssignmentCategory(val: string): val is AssignmentCategory {
  return Boolean(val && val.trim().length > 0);
}

function isAssignmentPriority(val: string): val is AssignmentPriority {
  return ['low', 'medium', 'high'].includes(val);
}

function PlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const supabase = createClient();
  const { branding } = useSchoolSettings();
  const activeUserName = getCachedActiveUserName();

  const weekParam = searchParams.get('week');
  const initialWeek = weekParam || getCurrentWeekMonday();
  const [weekStartDate, setWeekStartDate] = useState<string>(initialWeek);

  // Sync if URL search param changes; when navigating to /calendar/planner without ?week=, always load current week
  useEffect(() => {
    const targetWeek = weekParam || getCurrentWeekMonday();
    setWeekStartDate((prev) => (prev !== targetWeek ? targetWeek : prev));
  }, [weekParam]);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [syllabusDays, setSyllabusDays] = useState<MathSyllabusDay[]>([]);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [schoolAssignments, setSchoolAssignments] = useState<SchoolAssignment[]>([]);
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeConfig[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringAssignmentTemplate[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [tasksList, setTasksList] = useState<PlannerTask[]>([]);
  const [googleEvents, setGoogleEvents] = useState<{ id: string; title: string; event_date: string; color: string }[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [plannerSettings, setPlannerSettings] = useState<WeeklySettings>({
    week_start_date: initialWeek,
    todos: ['', '', '', '', '', '', '', '', '', ''],
    priorities: ['', '', ''],
    for_next_month: '',
    notes: '',
    subject_overrides: {},
  });

  // On-Screen View Mode & Page Jump / Date Picker Refs (never affects @media print)
  const [screenViewMode, setScreenViewMode] = useState<ScreenViewMode>('binder_2page');
  const datePickerInputRef = useRef<HTMLInputElement | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const page1Ref = useRef<HTMLDivElement | null>(null);
  const page2Ref = useRef<HTMLDivElement | null>(null);
  const page1InnerRef = useRef<HTMLDivElement | null>(null);
  const page2InnerRef = useRef<HTMLDivElement | null>(null);

  // Debounced Sidebar Save State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const pendingSettingsRef = useRef<WeeklySettings | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Week Counters & Populate / Reset Controls State
  const [showCountersPanel, setShowCountersPanel] = useState(false);
  const [populatingWeek, setPopulatingWeek] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resettingWeek, setResettingWeek] = useState(false);
  const [toolsMenuAnchorEl, setToolsMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Populate & Pull Forward Previous Week Modal State
  const [openPopulateModal, setOpenPopulateModal] = useState(false);
  const [populateModalMode, setPopulateModalMode] = useState<'populate_and_pull' | 'pull_only'>('populate_and_pull');
  const [populateOverwriteExisting, setPopulateOverwriteExisting] = useState(false);
  const [loadingPrevWeekSettings, setLoadingPrevWeekSettings] = useState(false);
  const [prevWeekDateStr, setPrevWeekDateStr] = useState<string>('');
  const [prevWeekSettings, setPrevWeekSettings] = useState<WeeklySettings | null>(null);
  const [pullTodos, setPullTodos] = useState(true);
  const [pullPriorities, setPullPriorities] = useState(true);
  const [pullForNextMonth, setPullForNextMonth] = useState(true);
  const [pullNotes, setPullNotes] = useState(true);

  // Modal State for adding/editing School Work, Parent Notes, or School Assignment in a cell
  const [openCellModal, setOpenCellModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [cellNoteCategory, setCellNoteCategory] = useState<PlannerNoteCategory>('school_work');
  const [cellNoteHeader, setCellNoteHeader] = useState('');
  const [cellNoteDesc, setCellNoteDesc] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [showFullWeekSyllabusInCell, setShowFullWeekSyllabusInCell] = useState(false);
  const [showQuickAddAssignment, setShowQuickAddAssignment] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  // New School Assignment input inside cell modal
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentCategory, setAssignmentCategory] = useState<AssignmentCategory>('homework');
  const [assignmentPriority, setAssignmentPriority] = useState<AssignmentPriority>('medium');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Unified Assignment & Grade Modal + Types Manager state
  const [openUnifiedModal, setOpenUnifiedModal] = useState(false);
  const [unifiedEditAssignment, setUnifiedEditAssignment] = useState<GradebookAssignment | null>(null);
  const [apiWarningAssignment, setApiWarningAssignment] = useState<GradebookAssignment | null>(null);
  const [unifiedPromotedNote, setUnifiedPromotedNote] = useState<{
    id: string;
    title?: string | null;
    description: string;
    subject_id: string;
    note_date: string;
  } | null>(null);
  const [openTypesManagerModal, setOpenTypesManagerModal] = useState(false);

  const handleOpenAssignmentFromPlanner = (
    a: GradebookAssignment,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }
    const sub = a.subject_id ? subjects.find((s) => s.id === a.subject_id) : undefined;
    if (isAssignmentApiSynced(a, sub as SubjectWithGrading | undefined)) {
      setApiWarningAssignment(a);
      return;
    }
    setUnifiedPromotedNote(null);
    setUnifiedEditAssignment(a);
    setOpenUnifiedModal(true);
  };

  const getWeekDates = (monDateStr: string) => {
    const monday = new Date(monDateStr + 'T00:00:00');
    const dates: { dateStr: string; dayName: string; dayKey: DayKey; formatted: string }[] = [];
    const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const monthDayStr = `${d.getMonth() + 1}/${d.getDate()}`;
      dates.push({
        dateStr,
        dayName: dayNames[i],
        dayKey: DAY_KEYS[i],
        formatted: monthDayStr,
      });
    }
    return dates;
  };

  const weekDates = getWeekDates(weekStartDate);

  const syllabusMap = useMemo(() => {
    const map = new Map<number, MathSyllabusDay>();
    for (const item of syllabusDays) {
      map.set(item.day_number, item);
    }
    return map;
  }, [syllabusDays]);

  async function loadPlannerData(monStr: string) {
    setLoading(true);
    try {
      void resolveAndSyncActiveUser(supabase);
      // 1. Fetch Subjects
      const { data: subData } = await supabase
        .from('subjects')
        .select('*')
        .order('sort_order', { ascending: true });

      if (subData && subData.length > 0) {
        setSubjects(subData as Subject[]);
      } else {
        setSubjects(DEFAULT_SUBJECTS);
      }

      // 1b. Fetch Math Syllabus
      const { data: sylData } = await supabase
        .from('math_syllabus')
        .select('*')
        .order('day_number', { ascending: true });

      if (sylData) {
        setSyllabusDays(sylData as MathSyllabusDay[]);
      }

      // 1c. Fetch Assignment Types & Recurring Assignment Templates
      const [typesRes, tplRes] = await Promise.all([
        supabase.from('assignment_types').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('recurring_assignment_templates')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);
      if (typesRes.data) setAssignmentTypes(typesRes.data as AssignmentTypeConfig[]);
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
          days_of_week: Array.isArray(row.days_of_week)
            ? (row.days_of_week.filter(
                (d): d is DayKey => typeof d === 'string' && DAY_KEYS.includes(d as DayKey)
              ))
            : ['friday'],
          linked_weekly_source: row.linked_weekly_source,
          auto_behavior: row.auto_behavior,
          estimated_minutes: row.estimated_minutes,
          is_active: row.is_active,
        }));
        setRecurringTemplates(mappedTemplates);
      }

      // 2. Fetch Habits
      const { data: habitData } = await supabase
        .from('habits')
        .select('*')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true });

      if (habitData && habitData.length > 0) {
        setHabits(habitData as Habit[]);
      } else {
        setHabits(DEFAULT_HABITS);
      }

      const startDate = monStr;
      const endDateObj = new Date(monStr + 'T00:00:00');
      endDateObj.setDate(endDateObj.getDate() + 6);
      const endDate = formatDateStr(endDateObj);

      // 3. Fetch Parent Notes for this week
      const { data: noteData } = await supabase
        .from('parent_notes')
        .select('*')
        .gte('note_date', startDate)
        .lte('note_date', endDate);

      if (noteData) setParentNotes(noteData as ParentNote[]);

      // 4. Fetch School Assignments for this week
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*')
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      if (assignData) setSchoolAssignments(assignData as SchoolAssignment[]);

      // 5. Fetch Holidays
      const { data: holData } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_enabled', true);

      if (holData) setHolidays(holData as Holiday[]);

      // 6. Fetch Tasks (including recurring tasks) for this week
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*');

      if (taskData) {
        const expanded = expandTasksForDateRange(taskData, startDate, endDate);
        setTasksList(
          expanded.map((occ) => ({
            id: occ.occurrenceId,
            title: occ.title,
            due_date: occ.occurrenceDate,
            status: occ.isCompleted ? 'completed' : 'pending',
          }))
        );
      }

      // 7. Fetch Weekly Planner Settings
      const { data: settingsData } = await supabase
        .from('weekly_planner_settings')
        .select('*')
        .eq('week_start_date', monStr)
        .maybeSingle();

      if (settingsData) {
        setPlannerSettings({
          id: settingsData.id,
          week_start_date: settingsData.week_start_date,
          todos: (settingsData.todos as string[]) || ['', '', '', '', '', '', '', '', '', ''],
          priorities: (settingsData.priorities as string[]) || ['', '', ''],
          for_next_month: settingsData.for_next_month || '',
          notes: settingsData.notes || '',
          subject_overrides: parseSubjectOverrides(settingsData.subject_overrides),
        });
      } else {
        setPlannerSettings({
          week_start_date: monStr,
          todos: ['', '', '', '', '', '', '', '', '', ''],
          priorities: ['', '', ''],
          for_next_month: '',
          notes: '',
          subject_overrides: {},
        });
      }

      // 8. Fetch Google Calendar Events enabled for Weekly Planner
      const { data: connData } = await supabase
        .from('google_calendar_connections')
        .select('id, color')
        .eq('is_enabled', true)
        .eq('show_on_weekly', true);

      if (connData && connData.length > 0) {
        const connIds = connData.map((c) => c.id);
        const { data: gEvtData } = await supabase
          .from('google_calendar_events')
          .select('*')
          .in('connection_id', connIds)
          .gte('event_date', startDate)
          .lte('event_date', endDate);

        if (gEvtData) {
          setGoogleEvents(gEvtData as { id: string; title: string; event_date: string; color: string }[]);
        }
      } else {
        setGoogleEvents([]);
      }
    } catch {
      toast.error('Error loading planner data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlannerData(weekStartDate);
  }, [weekStartDate]);

  // Close active drawer/modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmResetOpen) {
          setConfirmResetOpen(false);
        } else if (openPopulateModal) {
          setOpenPopulateModal(false);
        } else if (openCellModal) {
          setOpenCellModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmResetOpen, openPopulateModal, openCellModal]);

  const persistSettingsToDb = useCallback(
    async (newSettings: WeeklySettings) => {
      const targetWeek = newSettings.week_start_date || weekStartDate;
      setSaveStatus('saving');
      try {
        const payload: {
          id?: string;
          week_start_date: string;
          todos: string[];
          priorities: string[];
          for_next_month: string;
          notes: string;
          subject_overrides: Json;
        } = {
          week_start_date: targetWeek,
          todos: newSettings.todos,
          priorities: newSettings.priorities,
          for_next_month: newSettings.for_next_month,
          notes: newSettings.notes,
          subject_overrides: JSON.parse(JSON.stringify(newSettings.subject_overrides || {})) as Json,
        };

        if (newSettings.id) {
          payload.id = newSettings.id;
        }

        const { data, error } = await supabase
          .from('weekly_planner_settings')
          .upsert(payload, { onConflict: 'week_start_date' })
          .select('id')
          .single();

        if (error) {
          console.error('Error saving weekly planner settings:', error.message);
          setSaveStatus('error');
        } else {
          if (data && data.id) {
            setPlannerSettings((prev) => ({ ...prev, id: data.id }));
          }
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to save settings:', err);
        setSaveStatus('error');
      }
    },
    [supabase, weekStartDate]
  );

  const flushPendingSettingsSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingSettingsRef.current) {
      const toFlush = pendingSettingsRef.current;
      pendingSettingsRef.current = null;
      await persistSettingsToDb(toFlush);
    }
  }, [persistSettingsToDb]);

  const handleQueueSettingsSave = (newSettings: WeeklySettings) => {
    setPlannerSettings(newSettings);
    pendingSettingsRef.current = newSettings;
    setSaveStatus('saving');
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const latest = pendingSettingsRef.current;
      pendingSettingsRef.current = null;
      if (latest) {
        void persistSettingsToDb(latest);
      }
    }, 600);
  };

  const handleSaveSettings = async (newSettings: WeeklySettings) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSettingsRef.current = null;
    setPlannerSettings(newSettings);
    await persistSettingsToDb(newSettings);
  };

  const handlePrevWeek = async () => {
    await flushPendingSettingsSave();
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    const newStr = formatDateStr(cur);
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
  };

  const handleNextWeek = async () => {
    await flushPendingSettingsSave();
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    const newStr = formatDateStr(cur);
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
  };

  const handleCurrentWeek = async () => {
    await flushPendingSettingsSave();
    const currentMon = getCurrentWeekMonday();
    setWeekStartDate(currentMon);
    router.replace(`/calendar/planner?week=${currentMon}`);
  };

  const handleJumpToPickedDate = async (pickedDateStr: string) => {
    if (!pickedDateStr) return;
    await flushPendingSettingsSave();
    const targetMon = getMondayForDateStr(pickedDateStr);
    setWeekStartDate(targetMon);
    router.replace(`/calendar/planner?week=${targetMon}`);
  };

  const handleOpenCellEditor = (subject: Subject, dateStr: string) => {
    setSelectedSubject(subject);
    setSelectedDate(dateStr);
    setConfirmDeleteNoteId(null);
    setShowFullWeekSyllabusInCell(false);
    setShowQuickAddAssignment(false);

    const squareNotes = parentNotes.filter(
      (n) => n.subject_id === subject.id && n.note_date === dateStr
    );

    if (squareNotes.length === 1) {
      const singleNote = squareNotes[0];
      const detectedCat = getPlannerNoteCategory(singleNote.title, singleNote.description);
      setEditingNoteId(singleNote.id);
      setCellNoteCategory(detectedCat);
      setCellNoteHeader(stripParentNoteMarker(singleNote.title));
      setCellNoteDesc(stripParentNoteMarker(singleNote.description));
      setIsFormOpen(true);
    } else {
      setEditingNoteId(null);
      setCellNoteCategory('school_work');
      setCellNoteHeader('');
      setCellNoteDesc('');
      setIsFormOpen(squareNotes.length === 0);
    }

    setAssignmentTitle('');
    setAssignmentCategory('homework');
    setAssignmentPriority('medium');
    setOpenCellModal(true);
  };

  const handleStepCellDay = (delta: -1 | 1) => {
    if (!selectedSubject || !selectedDate) return;
    const curIdx = weekDates.findIndex((wd) => wd.dateStr === selectedDate);
    if (curIdx < 0) return;
    const nextIdx = (curIdx + delta + weekDates.length) % weekDates.length;
    handleOpenCellEditor(selectedSubject, weekDates[nextIdx].dateStr);
  };

  const handleStepCellSubject = (delta: -1 | 1) => {
    if (!selectedSubject || !selectedDate) return;
    const activeSubList = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
    const curIdx = activeSubList.findIndex((s) => s.id === selectedSubject.id);
    if (curIdx < 0) return;
    const nextIdx = (curIdx + delta + activeSubList.length) % activeSubList.length;
    handleOpenCellEditor(activeSubList[nextIdx], selectedDate);
  };

  const handleStartEditNote = (note: ParentNote) => {
    const detectedCat = getPlannerNoteCategory(note.title, note.description);
    setEditingNoteId(note.id);
    setCellNoteCategory(detectedCat);
    setCellNoteHeader(stripParentNoteMarker(note.title));
    setCellNoteDesc(stripParentNoteMarker(note.description));
    setIsFormOpen(true);
  };

  const handleAddNewNoteForm = (category: PlannerNoteCategory = 'school_work') => {
    setEditingNoteId(null);
    setCellNoteCategory(category);
    setCellNoteHeader('');
    setCellNoteDesc('');
    setIsFormOpen(true);
  };

  const handleSaveCellNote = async () => {
    if (!selectedSubject || !selectedDate) return;
    if (!cellNoteHeader.trim() && !cellNoteDesc.trim()) {
      toast.error('Please enter a header or body content');
      return;
    }

    setSavingNote(true);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();
    const encoded = encodePlannerNoteFields(cellNoteHeader, cellNoteDesc, cellNoteCategory);
    const labelText = cellNoteCategory === 'parent_note' ? 'Parent note' : 'School work';

    try {
      if (editingNoteId) {
        const { error } = await supabase
          .from('parent_notes')
          .update({
            title: encoded.title,
            description: encoded.description,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', editingNoteId);

        if (error) {
          toast.error(`Error updating ${labelText.toLowerCase()}: ${error.message}`);
          return;
        }

        setParentNotes((prev) =>
          prev.map((n) =>
            n.id === editingNoteId
              ? {
                  ...n,
                  title: encoded.title,
                  description: encoded.description,
                  updated_by: activeUserName,
                  updated_at: nowIso,
                }
              : n
          )
        );
        toast.success(`${labelText} updated!`);
      } else {
        const { data, error } = await supabase
          .from('parent_notes')
          .insert({
            subject_id: selectedSubject.id,
            note_date: selectedDate,
            title: encoded.title,
            description: encoded.description,
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Error adding ${labelText.toLowerCase()}: ${error.message}`);
          return;
        } else if (data) {
          setParentNotes((prev) => [...prev, data as ParentNote]);
          toast.success(`${labelText} added!`);
        }
      }

      setEditingNoteId(null);
      setCellNoteHeader('');
      setCellNoteDesc('');
      setIsFormOpen(false);
    } catch {
      toast.error(`Error saving ${labelText.toLowerCase()}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteSingleParentNote = async (noteId: string) => {
    setSavingNote(true);
    setConfirmDeleteNoteId(null);
    const target = parentNotes.find((n) => n.id === noteId);
    const labelText =
      target && getPlannerNoteCategory(target.title, target.description) === 'parent_note'
        ? 'Parent note'
        : 'School work';
    try {
      const { error } = await supabase.from('parent_notes').delete().eq('id', noteId);
      if (error) {
        toast.error(`Error deleting ${labelText.toLowerCase()}: ${error.message}`);
      } else {
        setParentNotes((prev) => prev.filter((n) => n.id !== noteId));
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          setCellNoteHeader('');
          setCellNoteDesc('');
          setIsFormOpen(false);
        }
        toast.success(
          (t) => (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Typography variant="body2" fontWeight={600}>
                {labelText} deleted
              </Typography>
              {target && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    toast.dismiss(t.id);
                    const { data: restored } = await supabase
                      .from('parent_notes')
                      .insert({
                        subject_id: target.subject_id,
                        note_date: target.note_date,
                        title: target.title ?? null,
                        description: target.description,
                        created_by: target.created_by || activeUserName,
                        updated_by: activeUserName,
                        updated_at: new Date().toISOString(),
                      })
                      .select('*')
                      .single();
                    if (restored) {
                      setParentNotes((prev) => [...prev, restored as ParentNote]);
                      toast.success(`${labelText} restored!`);
                    }
                  }}
                  sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Undo
                </Button>
              )}
            </Stack>
          ),
          { duration: 5000 }
        );
      }
    } catch {
      toast.error(`Failed to delete ${labelText.toLowerCase()}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleToggleParentNoteCheckbox = async (
    noteId: string,
    lineIndex: number,
    newChecked: boolean
  ) => {
    const note = parentNotes.find((n) => n.id === noteId);
    if (!note) return;

    const lines = note.description.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    let updatedLine = line;

    if (newChecked) {
      if (line.includes('- [ ]')) updatedLine = line.replace('- [ ]', '- [x]');
      else if (line.includes('[ ]')) updatedLine = line.replace('[ ]', '[x]');
      else if (line.includes('☐')) updatedLine = line.replace('☐', '☑');
      else updatedLine = `- [x] ${line}`;
    } else {
      if (line.includes('- [x]') || line.includes('- [X]')) updatedLine = line.replace(/- \[[xX]\]/, '- [ ]');
      else if (line.includes('[x]') || line.includes('[X]')) updatedLine = line.replace(/\[[xX]\]/, '[ ]');
      else if (line.includes('☑')) updatedLine = line.replace('☑', '☐');
      else updatedLine = `- [ ] ${line}`;
    }

    lines[lineIndex] = updatedLine;
    const newDescription = lines.join('\n');

    setParentNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, description: newDescription } : n))
    );

    try {
      await supabase
        .from('parent_notes')
        .update({ description: newDescription, updated_at: new Date().toISOString() })
        .eq('id', noteId);
    } catch {
      // Ignore background update error
    }
  };

  const handleInsertFormatting = (type: 'bullet' | 'checkbox') => {
    if (type === 'bullet') {
      setCellNoteDesc((prev) => (prev ? `${prev}\n• ` : '• '));
    } else if (type === 'checkbox') {
      setCellNoteDesc((prev) => (prev ? `${prev}\n- [ ] ` : '- [ ] '));
    }
  };

  const handleCreateCellAssignment = async () => {
    if (!selectedSubject || !selectedDate || !assignmentTitle.trim()) {
      toast.error('Please enter an assignment title');
      return;
    }

    setSavingAssignment(true);
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          title: assignmentTitle.trim(),
          subject_id: selectedSubject.id,
          due_date: selectedDate,
          category: assignmentCategory,
          priority: assignmentPriority,
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error creating assignment: ${error.message}`);
      } else if (data) {
        setSchoolAssignments((prev) => [...prev, data as SchoolAssignment]);
        toast.success('School assignment added!');
        setAssignmentTitle('');
        setShowQuickAddAssignment(false);
      }
    } catch {
      toast.error('Error creating assignment');
    } finally {
      setSavingAssignment(false);
    }
  };

  const weekActivitySupplies = useMemo(() => {
    const entries: Array<{
      id: string;
      subjectId: string;
      subjectName: string;
      subjectColor: string;
      dayKey: DayKey;
      weekdayLabel: string;
      dateStr: string;
      weekNumber: number;
      classNumber: number | null;
      activityName: string;
      supplies: string[];
    }> = [];
    const seen = new Set<string>();

    for (const sub of subjects) {
      const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
      const activeSyl = getActiveCourseSyllabus(cfg);
      const override = plannerSettings.subject_overrides[sub.id];
      const counters = resolveSubjectCountersForWeek(cfg, weekStartDate, override);

      if (cfg.mode === 'template' && activeSyl && Array.isArray(activeSyl.days) && activeSyl.days.length > 0) {
        let runningClass = counters.class_num;
        for (const dayInfo of weekDates) {
          const dayCfg = cfg.days[dayInfo.dayKey];
          if (!dayCfg || !dayCfg.enabled || !dayCfg.template.includes('{class_num}')) continue;

          // Check if a parent note on this cell manually picked a specific Class #
          const cellNotes = parentNotes.filter(
            (n) => n.subject_id === sub.id && n.note_date === dayInfo.dateStr
          );
          let effectiveClassNum = runningClass;
          if (cellNotes.length > 0) {
            const matchCls = cellNotes[0].description.match(/Class\s+(\d+)/i);
            if (matchCls) {
              const parsedCls = parseInt(matchCls[1], 10);
              if (!Number.isNaN(parsedCls) && parsedCls > 0) {
                effectiveClassNum = parsedCls;
              }
            }
          }
          runningClass += 1;

          const sylDay = activeSyl.days.find((d) => d.day_number === effectiveClassNum);
          if (!sylDay || !sylDay.activity) continue;

          const supplies = resolveSyllabusDaySupplies(sylDay);
          if (supplies.length === 0) continue;

          const key = `${sub.id}::${dayInfo.dateStr}::${sylDay.activity.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);

          entries.push({
            id: `wk-sup-${sub.id}-${dayInfo.dayKey}-${effectiveClassNum}`,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color || '#2e7d32',
            dayKey: dayInfo.dayKey,
            weekdayLabel: DAY_LABELS[dayInfo.dayKey],
            dateStr: dayInfo.dateStr,
            weekNumber: sylDay.week_number ?? counters.week_num,
            classNumber: sylDay.day_number,
            activityName: sylDay.activity,
            supplies,
          });
        }
      }

      // Also check any Activity assignments scheduled this week that might have custom/overridden dates (e.g., holiday shifts)
      const subActivityAssigns = schoolAssignments.filter(
        (a) =>
          a.subject_id === sub.id &&
          a.category === 'activity' &&
          a.due_date >= (weekDates[0]?.dateStr || weekStartDate) &&
          a.due_date <= (weekDates[weekDates.length - 1]?.dateStr || weekStartDate)
      );
      for (const actAssign of subActivityAssigns) {
        const mm = parseAssignmentMoodleMeta(actAssign.state_standards);
        const dayInfo = weekDates.find((wd) => wd.dateStr === actAssign.due_date);
        if (!dayInfo) continue;

        const cleanActName =
          mm?.activity_name || actAssign.title.replace(/^Activity:\s*/i, '').trim();
        const key = `${sub.id}::${dayInfo.dateStr}::${cleanActName.toLowerCase()}`;
        if (seen.has(key)) continue;

        const sylDay = activeSyl?.days.find(
          (d) =>
            (mm?.class_number && d.day_number === mm.class_number) ||
            (actAssign.syllabus_day_number && d.day_number === actAssign.syllabus_day_number) ||
            (d.activity && d.activity.toLowerCase() === cleanActName.toLowerCase())
        );
        const supplies =
          mm?.supplies && mm.supplies.length > 0
            ? mm.supplies
            : sylDay
            ? resolveSyllabusDaySupplies(sylDay)
            : [];
        if (supplies.length === 0) continue;

        seen.add(key);
        entries.push({
          id: `assign-sup-${actAssign.id}`,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color || '#2e7d32',
          dayKey: dayInfo.dayKey,
          weekdayLabel: DAY_LABELS[dayInfo.dayKey],
          dateStr: dayInfo.dateStr,
          weekNumber: mm?.week_number ?? sylDay?.week_number ?? counters.week_num,
          classNumber: mm?.class_number ?? actAssign.syllabus_day_number ?? sylDay?.day_number ?? null,
          activityName: cleanActName,
          supplies,
        });
      }
    }

    return entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [subjects, plannerSettings.subject_overrides, weekStartDate, weekDates, parentNotes, schoolAssignments]);

  const syncSubjectWeekNotesInPlanner = async (
    subjectId: string,
    cfgToUse: ReturnType<typeof parseRecurringConfig>,
    resolvedCounters: ReturnType<typeof resolveSubjectCountersForWeek>
  ) => {
    if (!cfgToUse.enabled) return;

    const generatedByDay = generateSubjectWeekNotesStructured(
      cfgToUse,
      resolvedCounters,
      syllabusMap
    );
    const nowIso = new Date().toISOString();
    const toInsert: Array<{
      subject_id: string;
      note_date: string;
      title: string | null;
      description: string;
      created_by: string;
      updated_by: string;
      updated_at: string;
    }> = [];
    const toUpdate: Array<{
      id: string;
      title: string | null;
      description: string;
      updated_by: string;
      updated_at: string;
    }> = [];

    for (const dayInfo of weekDates) {
      const dayNote = generatedByDay[dayInfo.dayKey];
      const hasTitle = Boolean(dayNote.title && dayNote.title.trim());
      const hasDesc = Boolean(dayNote.description && dayNote.description.trim());
      if (!hasTitle && !hasDesc) continue;

      const existingNotes = parentNotes.filter(
        (n) => n.subject_id === subjectId && n.note_date === dayInfo.dateStr
      );

      if (existingNotes.length === 0) {
        toInsert.push({
          subject_id: subjectId,
          note_date: dayInfo.dateStr,
          title: dayNote.title,
          description: dayNote.description,
          created_by: activeUserName,
          updated_by: activeUserName,
          updated_at: nowIso,
        });
      } else {
        toUpdate.push({
          id: existingNotes[0].id,
          title: dayNote.title,
          description: dayNote.description,
          updated_by: activeUserName,
          updated_at: nowIso,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: insertedData } = await supabase
        .from('parent_notes')
        .insert(toInsert)
        .select('*');
      if (insertedData) {
        setParentNotes((prev) => [...prev, ...(insertedData as ParentNote[])]);
      }
    }

    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        await supabase
          .from('parent_notes')
          .update({
            title: item.title,
            description: item.description,
            updated_by: item.updated_by,
            updated_at: item.updated_at,
          })
          .eq('id', item.id);
      }
      setParentNotes((prev) =>
        prev.map((n) => {
          const match = toUpdate.find((u) => u.id === n.id);
          return match
            ? {
                ...n,
                title: match.title,
                description: match.description,
                updated_at: match.updated_at,
              }
            : n;
        })
      );
    }
  };

  const handleSwitchActiveSyllabus = async (subjectId: string, nextSyllabusId: string) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;

    const cfg = parseRecurringConfig(targetSub.recurring_config, targetSub.name);
    const syllabi = getSubjectCourseSyllabi(cfg);
    const nextSyl = syllabi.find((s) => s.id === nextSyllabusId);
    if (!nextSyl) return;

    const nextCfg = {
      ...cfg,
      active_syllabus_id: nextSyllabusId,
      course_syllabus: nextSyl,
      course_syllabi: syllabi,
    };
    const jsonCfg = JSON.parse(JSON.stringify(nextCfg)) as Json;
    await supabase.from('subjects').update({ recurring_config: jsonCfg }).eq('id', subjectId);
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, recurring_config: jsonCfg } : s))
    );

    const override = plannerSettings.subject_overrides[subjectId];
    const resolved = resolveSubjectCountersForWeek(nextCfg, weekStartDate, override);
    await syncSubjectWeekNotesInPlanner(subjectId, nextCfg, resolved);
    toast.success(`Switched ${targetSub.name} syllabus to "${nextSyl.course_title}" & updated this week!`);
  };

  const handleUpdateSubjectOverride = async (
    subjectId: string,
    patch: Partial<SubjectWeekOverride>,
    shiftFutureWeeks = false
  ) => {
    const existing = plannerSettings.subject_overrides[subjectId] || {};
    const updatedOverride: SubjectWeekOverride = {
      ...existing,
      ...patch,
    };
    const nextOverrides: WeeklySubjectOverrides = {
      ...plannerSettings.subject_overrides,
      [subjectId]: updatedOverride,
    };

    const nextSettings: WeeklySettings = {
      ...plannerSettings,
      subject_overrides: nextOverrides,
    };
    await handleSaveSettings(nextSettings);

    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;

    const cfg = parseRecurringConfig(targetSub.recurring_config, targetSub.name);
    const resolved = resolveSubjectCountersForWeek(cfg, weekStartDate, updatedOverride);

    let effectiveCfg = cfg;

    // Optional: also update the subject's base anchor to this week so future weeks continue from this number!
    if (shiftFutureWeeks) {
      const nextCfg = {
        ...cfg,
        base_week_date: weekStartDate,
        base_week_num: resolved.week_num,
        base_class_num: resolved.class_num,
        base_lesson_num: resolved.lesson_num,
        math_config: cfg.math_config
          ? {
              ...cfg.math_config,
              base_tuesday_day: resolved.tuesday_math_day ?? cfg.math_config.base_tuesday_day,
              base_thursday_day: resolved.thursday_math_day ?? cfg.math_config.base_thursday_day,
            }
          : undefined,
      };
      effectiveCfg = nextCfg;
      const jsonCfg = JSON.parse(JSON.stringify(nextCfg)) as Json;
      await supabase.from('subjects').update({ recurring_config: jsonCfg }).eq('id', subjectId);
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? { ...s, recurring_config: jsonCfg } : s))
      );
    }

    // Automatically populate / update this subject's weekly schedule notes for the selected Week / Class
    await syncSubjectWeekNotesInPlanner(subjectId, effectiveCfg, resolved);

    // Automatically synchronize this week's recurring assignments (e.g. Spelling Test, Math Workbook HW, or Syllabus Activity)
    const subjectTemplates = recurringTemplates.filter((t) => t.subject_id === subjectId);
    const generatedForWeek = generateWeekAssignmentsFromTemplatesAndPolicy({
      subject: targetSub as SubjectWithGrading,
      recurringConfig: effectiveCfg,
      counters: resolved,
      weekDates,
      syllabusMap,
      templates: subjectTemplates,
    });

    if (generatedForWeek.length > 0) {
      const updatedSchoolAssignments = [...schoolAssignments];
      for (const cand of generatedForWeek) {
        const existingOnDateIdx = updatedSchoolAssignments.findIndex(
          (a) =>
            a.subject_id === subjectId &&
            a.due_date === cand.due_date &&
            (a.category === cand.category ||
              a.source_type === 'recurring_template' ||
              a.recurring_template_id === cand.recurring_template_id)
        );
        if (existingOnDateIdx >= 0) {
          const existingItem = updatedSchoolAssignments[existingOnDateIdx];
          if (existingItem.percentage_score === null) {
            const { data: updatedRow } = await supabase
              .from('assignments')
              .update({
                title: cand.title,
                description: cand.description,
                instructions: cand.instructions,
                syllabus_day_number: cand.syllabus_day_number,
                state_standards: cand.state_standards,
              })
              .eq('id', existingItem.id)
              .select('*')
              .single();
            if (updatedRow) {
              updatedSchoolAssignments[existingOnDateIdx] = updatedRow as SchoolAssignment;
            }
          }
        } else {
          const { data: insertedRow } = await supabase
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
              state_standards: cand.state_standards,
              term_name: 'Full Year 2026-2027',
              academic_year: '2026-2027',
            })
            .select('*')
            .single();
          if (insertedRow) {
            updatedSchoolAssignments.push(insertedRow as SchoolAssignment);
          }
        }
      }
      setSchoolAssignments(updatedSchoolAssignments);
    }

    toast.success(`${targetSub.name} topics, activities & supplies populated for this week!`);
  };

  // ---------------------------------------------------------------------------
  // POPULATE WEEK, PULL FORWARD PREVIOUS WEEK & RESET WEEK HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenPopulateOrPullModal = async (
    mode: 'populate_and_pull' | 'pull_only',
    overwriteExisting = false
  ) => {
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    const prevMonStr = formatDateStr(cur);

    setPopulateModalMode(mode);
    setPopulateOverwriteExisting(overwriteExisting);
    setPrevWeekDateStr(prevMonStr);
    setOpenPopulateModal(true);
    setLoadingPrevWeekSettings(true);

    try {
      const { data } = await supabase
        .from('weekly_planner_settings')
        .select('*')
        .eq('week_start_date', prevMonStr)
        .maybeSingle();

      if (data) {
        const fetched: WeeklySettings = {
          id: data.id,
          week_start_date: data.week_start_date,
          todos: (data.todos as string[]) || ['', '', '', '', '', '', '', '', '', ''],
          priorities: (data.priorities as string[]) || ['', '', ''],
          for_next_month: data.for_next_month || '',
          notes: data.notes || '',
          subject_overrides: parseSubjectOverrides(data.subject_overrides),
        };
        setPrevWeekSettings(fetched);

        const hasTodos = fetched.todos.some((t) => t.trim().length > 0);
        const hasPriorities = fetched.priorities.some((p) => p.trim().length > 0);
        const hasNextMonth = fetched.for_next_month.trim().length > 0;
        const hasNotes = fetched.notes.trim().length > 0;

        setPullTodos(hasTodos);
        setPullPriorities(hasPriorities);
        setPullForNextMonth(hasNextMonth);
        setPullNotes(hasNotes);
      } else {
        setPrevWeekSettings(null);
        setPullTodos(false);
        setPullPriorities(false);
        setPullForNextMonth(false);
        setPullNotes(false);
      }
    } catch {
      setPrevWeekSettings(null);
    } finally {
      setLoadingPrevWeekSettings(false);
    }
  };

  const applySelectedPullForwardFields = async (): Promise<boolean> => {
    if (!prevWeekSettings) return false;
    const anySelected = pullTodos || pullPriorities || pullForNextMonth || pullNotes;
    if (!anySelected) return false;

    const nextSettings: WeeklySettings = {
      ...plannerSettings,
      todos: pullTodos ? [...prevWeekSettings.todos] : plannerSettings.todos,
      priorities: pullPriorities ? [...prevWeekSettings.priorities] : plannerSettings.priorities,
      for_next_month: pullForNextMonth
        ? prevWeekSettings.for_next_month
        : plannerSettings.for_next_month,
      notes: pullNotes ? prevWeekSettings.notes : plannerSettings.notes,
    };

    await handleSaveSettings(nextSettings);
    return true;
  };

  const handleConfirmPullForwardOnly = async () => {
    setPopulatingWeek(true);
    try {
      const pulled = await applySelectedPullForwardFields();
      if (pulled) {
        toast.success(`Pulled forward selected sidebar sections from week of ${prevWeekDateStr}!`);
      } else {
        toast('No fields selected to pull forward.', { icon: 'ℹ️' });
      }
      setOpenPopulateModal(false);
    } finally {
      setPopulatingWeek(false);
    }
  };

  const handlePopulateWeek = async (overwriteExisting = false, alsoPullForward = false) => {
    setPopulatingWeek(true);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();

    try {
      let pulledSidebar = false;
      if (alsoPullForward) {
        pulledSidebar = await applySelectedPullForwardFields();
      }

      const toInsert: {
        subject_id: string;
        note_date: string;
        title: string | null;
        description: string;
        created_by: string;
        updated_by: string;
        updated_at: string;
      }[] = [];

      const toUpdate: {
        id: string;
        title: string | null;
        description: string;
        updated_by: string;
        updated_at: string;
      }[] = [];

      const assignmentsToInsert: GeneratedRecurringAssignmentCandidate[] = [];

      // Refresh recurring templates and all existing subject assignments so rules are always up-to-date
      const [freshTplRes, allAssignsRes] = await Promise.all([
        supabase
          .from('recurring_assignment_templates')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase.from('assignments').select('id, subject_id, title, due_date, state_standards'),
      ]);

      const activeTemplates: RecurringAssignmentTemplate[] = freshTplRes.data
        ? freshTplRes.data.map((row) => ({
            id: row.id,
            subject_id: row.subject_id,
            title_template: row.title_template,
            instructions_template: row.instructions_template,
            assignment_type_slug: row.assignment_type_slug,
            grading_mode: row.grading_mode,
            points_possible: Number(row.points_possible),
            total_problems_default: row.total_problems_default,
            days_of_week: Array.isArray(row.days_of_week)
              ? row.days_of_week.filter(
                  (d): d is DayKey => typeof d === 'string' && DAY_KEYS.includes(d as DayKey)
                )
              : ['friday'],
            linked_weekly_source: row.linked_weekly_source,
            auto_behavior: row.auto_behavior,
            estimated_minutes: row.estimated_minutes,
            is_active: row.is_active,
          }))
        : recurringTemplates;

      if (freshTplRes.data) {
        setRecurringTemplates(activeTemplates);
      }

      const allKnownAssignments = allAssignsRes.data || schoolAssignments;

      for (const subject of subjects) {
        const cfg = parseRecurringConfig(subject.recurring_config, subject.name);
        const override = plannerSettings.subject_overrides[subject.id];
        const counters = resolveSubjectCountersForWeek(cfg, weekStartDate, override);

        if (cfg.enabled) {
          const generatedByDay = generateSubjectWeekNotesStructured(cfg, counters, syllabusMap);

          for (const dayInfo of weekDates) {
            const dayNote = generatedByDay[dayInfo.dayKey];
            const hasTitle = Boolean(dayNote.title && dayNote.title.trim());
            const hasDesc = Boolean(dayNote.description && dayNote.description.trim());
            if (!hasTitle && !hasDesc) continue;

            const existingNotes = parentNotes.filter(
              (n) => n.subject_id === subject.id && n.note_date === dayInfo.dateStr
            );

            if (existingNotes.length === 0) {
              toInsert.push({
                subject_id: subject.id,
                note_date: dayInfo.dateStr,
                title: dayNote.title,
                description: dayNote.description,
                created_by: activeUserName,
                updated_by: activeUserName,
                updated_at: nowIso,
              });
            } else if (overwriteExisting) {
              toUpdate.push({
                id: existingNotes[0].id,
                title: dayNote.title,
                description: dayNote.description,
                updated_by: activeUserName,
                updated_at: nowIso,
              });
            }
          }
        }

        // Also evaluate recurring assignment templates & participation policies for this subject
        const subjectTemplates = activeTemplates.filter((t) => t.subject_id === subject.id);
        const generatedAssigns = generateWeekAssignmentsFromTemplatesAndPolicy({
          subject: subject as SubjectWithGrading,
          recurringConfig: cfg,
          counters,
          weekDates,
          syllabusMap,
          templates: subjectTemplates,
        });
        for (const ga of generatedAssigns) {
          const alreadyExistsOnDate = allKnownAssignments.some(
            (existing) =>
              existing.subject_id === ga.subject_id &&
              existing.due_date === ga.due_date &&
              existing.title.toLowerCase() === ga.title.toLowerCase()
          );
          if (alreadyExistsOnDate) continue;

          // Check if an API-synced or syllabus-staged assessment with this exact title already exists
          const existingByTitle =
            ga.source_type === 'syllabus_staged'
              ? allKnownAssignments.find(
                  (existing) =>
                    existing.subject_id === ga.subject_id &&
                    existing.title.toLowerCase() === ga.title.toLowerCase()
                )
              : undefined;

          if (!existingByTitle) {
            assignmentsToInsert.push(ga);
          }
        }
      }

      if (toInsert.length === 0 && toUpdate.length === 0 && assignmentsToInsert.length === 0) {
        if (pulledSidebar) {
          toast.success(
            `Pulled forward previous week's sidebar sections (subject cells already had notes).`
          );
        } else {
          toast(
            'All recurring cells and graded assignments for this week are already populated.',
            { icon: 'ℹ️' }
          );
        }
        setOpenPopulateModal(false);
        return;
      }

      if (toInsert.length > 0) {
        const { data: insertedData, error: insertErr } = await supabase
          .from('parent_notes')
          .insert(toInsert)
          .select('*');

        if (insertErr) {
          toast.error(`Error populating week: ${insertErr.message}`);
          return;
        }
        if (insertedData) {
          setParentNotes((prev) => [...prev, ...(insertedData as ParentNote[])]);
        }
      }

      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          await supabase
            .from('parent_notes')
            .update({
              title: item.title,
              description: item.description,
              updated_by: item.updated_by,
              updated_at: item.updated_at,
            })
            .eq('id', item.id);
        }
        setParentNotes((prev) =>
          prev.map((n) => {
            const match = toUpdate.find((u) => u.id === n.id);
            return match
              ? { ...n, title: match.title, description: match.description, updated_at: match.updated_at }
              : n;
          })
        );
      }

      let createdAssignmentsCount = 0;
      let stagedAssignmentsCount = 0;
      if (assignmentsToInsert.length > 0) {
        const insertPayloads = assignmentsToInsert.map((cand) => ({
          subject_id: cand.subject_id,
          title: cand.title,
          description: cand.description,
          instructions: cand.instructions,
          due_date: cand.due_date,
          assigned_date: cand.assigned_date,
          category: cand.category,
          grading_mode: cand.grading_mode,
          points_possible: cand.points_possible,
          points_earned: cand.points_earned ?? null,
          percentage_score: cand.percentage_score ?? null,
          letter_grade: cand.letter_grade ?? null,
          total_problems: cand.total_problems,
          estimated_minutes: cand.estimated_minutes,
          workflow_status: cand.workflow_status,
          status: cand.status,
          is_graded: true,
          source_type: cand.source_type,
          recurring_template_id: cand.recurring_template_id,
          syllabus_day_number: cand.syllabus_day_number,
          teacher_comments: cand.teacher_comments ?? null,
          state_standards: cand.state_standards,
          term_name: 'Full Year 2026-2027',
          academic_year: '2026-2027',
        }));

        const { data: insertedAssigns } = await supabase
          .from('assignments')
          .insert(insertPayloads)
          .select('*');
        if (insertedAssigns) {
          setSchoolAssignments((prev) => [...prev, ...(insertedAssigns as SchoolAssignment[])]);
          createdAssignmentsCount = insertedAssigns.filter((a) => a.workflow_status !== 'staged').length;
          stagedAssignmentsCount = insertedAssigns.filter((a) => a.workflow_status === 'staged').length;
        }
      }

      const assignSummary =
        createdAssignmentsCount > 0 || stagedAssignmentsCount > 0
          ? ` (+${createdAssignmentsCount} graded, +${stagedAssignmentsCount} queued in staging)`
          : '';

      toast.success(
        pulledSidebar
          ? `Populated ${toInsert.length + toUpdate.length} placeholders${assignSummary} & pulled forward sidebar!`
          : `Populated ${toInsert.length + toUpdate.length} placeholders${assignSummary} for ${weekStartDate}!`
      );
      setOpenPopulateModal(false);
    } catch {
      toast.error('Failed to populate week placeholders');
    } finally {
      setPopulatingWeek(false);
    }
  };

  const handleResetWeek = async () => {
    setResettingWeek(true);
    try {
      const startDate = weekDates[0].dateStr;
      const endDate = weekDates[weekDates.length - 1].dateStr;

      const { error } = await supabase
        .from('parent_notes')
        .delete()
        .gte('note_date', startDate)
        .lte('note_date', endDate);

      if (error) {
        toast.error(`Failed to reset week: ${error.message}`);
      } else {
        setParentNotes([]);
        // Also clear overrides for this week so counters reset to standard iteration
        await handleSaveSettings({
          ...plannerSettings,
          subject_overrides: {},
        });
        toast.success(`Reset all notes and counters for the week of ${weekStartDate}!`);
        setConfirmResetOpen(false);
      }
    } catch {
      toast.error('Error resetting week');
    } finally {
      setResettingWeek(false);
    }
  };

  const resetPrintAutoFit = useCallback(() => {
    const rootEl = printRootRef.current;
    if (rootEl) {
      rootEl.classList.remove('print-measuring');
    }
    const densityClasses = [
      'print-density-compact',
      'print-density-tight',
      'print-density-ultra',
    ];
    for (const pageEl of [page1Ref.current, page2Ref.current]) {
      if (!pageEl) continue;
      pageEl.classList.remove(...densityClasses);
    }
    for (const innerEl of [page1InnerRef.current, page2InnerRef.current]) {
      if (!innerEl) continue;
      innerEl.style.transform = '';
      innerEl.style.transformOrigin = '';
      innerEl.style.width = '';
      innerEl.style.height = '';
    }
  }, []);

  const applyPrintAutoFit = useCallback(() => {
    const rootEl = printRootRef.current;
    if (!rootEl) return;

    resetPrintAutoFit();

    // Safe printable height in CSS pixels for US Letter portrait (9.75in = 936px at 96dpi)
    const TARGET_PRINT_HEIGHT_PX = 936;
    const densityTiers = [
      'print-density-compact',
      'print-density-tight',
      'print-density-ultra',
    ];

    rootEl.classList.add('print-measuring');

    const pages: Array<{
      pageEl: HTMLDivElement | null;
      innerEl: HTMLDivElement | null;
    }> = [
      { pageEl: page1Ref.current, innerEl: page1InnerRef.current },
      { pageEl: page2Ref.current, innerEl: page2InnerRef.current },
    ];

    for (const { pageEl, innerEl } of pages) {
      if (!pageEl || !innerEl) continue;

      let contentHeight = innerEl.scrollHeight;

      if (contentHeight > TARGET_PRINT_HEIGHT_PX) {
        for (const tierClass of densityTiers) {
          pageEl.classList.remove(...densityTiers);
          pageEl.classList.add(tierClass);
          contentHeight = innerEl.scrollHeight;
          if (contentHeight <= TARGET_PRINT_HEIGHT_PX) {
            break;
          }
        }
      }

      if (contentHeight > TARGET_PRINT_HEIGHT_PX) {
        const rawScale = TARGET_PRINT_HEIGHT_PX / contentHeight;
        const scale = Math.max(0.5, Math.floor(rawScale * 1000) / 1000);
        innerEl.style.width = `${(100 / scale).toFixed(3)}%`;
        innerEl.style.transform = `scale(${scale})`;
        innerEl.style.transformOrigin = 'top left';
        const unscaledHeight = Math.max(
          innerEl.scrollHeight,
          Math.floor(TARGET_PRINT_HEIGHT_PX / scale)
        );
        const finalScale = Math.min(
          scale,
          Math.max(0.5, Math.floor((TARGET_PRINT_HEIGHT_PX / unscaledHeight) * 1000) / 1000)
        );
        innerEl.style.width = `${(100 / finalScale).toFixed(3)}%`;
        innerEl.style.transform = `scale(${finalScale})`;
        innerEl.style.height = `${Math.floor(TARGET_PRINT_HEIGHT_PX / finalScale)}px`;
      }
    }

    rootEl.classList.remove('print-measuring');
  }, [resetPrintAutoFit]);

  useEffect(() => {
    const handleBeforePrint = () => {
      applyPrintAutoFit();
    };
    const handleAfterPrint = () => {
      resetPrintAutoFit();
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [applyPrintAutoFit, resetPrintAutoFit]);

  const handlePrint = () => {
    applyPrintAutoFit();
    window.print();
  };

  if (loading) {
    return (
      <Stack spacing={3} className="no-print" sx={{ py: 1 }}>
        <Card elevation={0} sx={{ p: 2.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="text" width={180} height={40} />
              <Skeleton variant="rounded" width={210} height={36} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rounded" width={140} height={28} sx={{ borderRadius: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1.25}>
              <Skeleton variant="rounded" width={135} height={38} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rounded" width={125} height={38} sx={{ borderRadius: 1 }} />
            </Stack>
          </Stack>
        </Card>
        <Card elevation={0} sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Skeleton variant="rounded" width="100%" height={52} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rounded" width="100%" height={680} sx={{ borderRadius: 1 }} />
        </Card>
      </Stack>
    );
  }

  const displaySubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
  const displayHabits = habits.length > 0 ? habits : DEFAULT_HABITS;

  const page1Days = weekDates.slice(0, 3); // Mon, Tue, Wed
  const page2Days = weekDates.slice(3, 5); // Thu, Fri

  // Synchronize All-Day row height across Page 1 & Page 2 so binder pages mirror each other
  const maxAllDayItemCount = Math.max(
    ...weekDates.map((d) => {
      const hCount = holidays.filter((h) => h.holiday_date === d.dateStr).length;
      const tCount = tasksList.filter((t) => t.due_date === d.dateStr).length;
      const gCount = googleEvents.filter((g) => g.event_date === d.dateStr).length;
      return hCount + tCount + gCount;
    }),
    0
  );
  const syncedAllDayMinHeight =
    maxAllDayItemCount === 0
      ? '16px'
      : maxAllDayItemCount === 1
      ? '20px'
      : `${maxAllDayItemCount * 13 + 4}px`;

  const formatWeekRangeLabel = () => {
    const mon = new Date(weekStartDate + 'T00:00:00');
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const monStr = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const friStr = fri.toLocaleDateString('en-US', {
      month: mon.getMonth() === fri.getMonth() ? undefined : 'short',
      day: 'numeric',
    });
    return `${monStr} – ${friStr}, ${fri.getFullYear()}`;
  };

  const getWeekSequenceSummary = () => {
    const mathSub = displaySubjects.find((s) => {
      const c = parseRecurringConfig(s.recurring_config, s.name);
      return c.enabled && c.mode === 'math_syllabus';
    });
    const firstEnabledSub = displaySubjects.find((s) => {
      const c = parseRecurringConfig(s.recurring_config, s.name);
      return c.enabled;
    });

    const parts: string[] = [];
    if (firstEnabledSub) {
      const cfg = parseRecurringConfig(firstEnabledSub.recurring_config, firstEnabledSub.name);
      const res = resolveSubjectCountersForWeek(
        cfg,
        weekStartDate,
        plannerSettings.subject_overrides[firstEnabledSub.id]
      );
      parts.push(`Week ${res.week_num}`);
    }
    if (mathSub) {
      const cfg = parseRecurringConfig(mathSub.recurring_config, mathSub.name);
      const res = resolveSubjectCountersForWeek(
        cfg,
        weekStartDate,
        plannerSettings.subject_overrides[mathSub.id]
      );
      if (res.tuesday_math_day !== null && res.thursday_math_day !== null) {
        parts.push(`Math Days ${res.tuesday_math_day}–${res.thursday_math_day}`);
      } else if (res.tuesday_math_day !== null) {
        parts.push(`Math Day ${res.tuesday_math_day}`);
      } else if (res.thursday_math_day !== null) {
        parts.push(`Math Day ${res.thursday_math_day}`);
      }
    }
    return parts.join(' · ') || `Week of ${weekStartDate}`;
  };

  return (
    <Box
      sx={{
        overflowX: 'auto',
        maxWidth: '100%',
      }}
    >
      {/* UNIFIED HEADER & WEEK COMMAND BAR (Hidden during PDF print) */}
      <Box className="no-print" mb={3}>
        <Card
          elevation={0}
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.25, sm: 1.5 },
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            spacing={1.25}
             sx={{ flexWrap: 'nowrap' }}
          >
            {/* Left: Title + Inline Week Stepper / Date Picker + Sequence Status Pill */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap={{ xs: 'wrap', md: 'nowrap' }}
              useFlexGap
              sx={{ minWidth: 0 }}
            >
              <Typography
                variant="h5"
                fontWeight={600}
                letterSpacing="-0.02em"
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: { xs: '1.15rem', lg: '1.3rem' } }}
              >
                Weekly Binder
              </Typography>

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
                  onClick={handlePrevWeek}
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
                    const inputEl = datePickerInputRef.current;
                    if (!inputEl) return;
                    if (typeof inputEl.showPicker === 'function') {
                      inputEl.showPicker();
                    } else {
                      inputEl.focus();
                      inputEl.click();
                    }
                  }}
                  title="Click to jump to any week"
                  aria-label={`Jump to week, currently ${formatWeekRangeLabel()}`}
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
                  {formatWeekRangeLabel()}
                </Button>

                <input
                  ref={datePickerInputRef}
                  type="date"
                  value={weekStartDate}
                  aria-label="Select week date"
                  onChange={(e) => {
                    if (e.target.value) {
                      void handleJumpToPickedDate(e.target.value);
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
                  onClick={handleNextWeek}
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
                  onClick={handleCurrentWeek}
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

              <Chip
                label={getWeekSequenceSummary()}
                size="small"
                variant="outlined"
                onClick={() => setShowCountersPanel((prev) => !prev)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderRadius: 1,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  bgcolor: showCountersPanel ? 'action.selected' : 'transparent',
                }}
              />

              {saveStatus !== 'idle' && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={saveStatus === 'error' ? 'error' : saveStatus === 'saved' ? 'success' : 'default'}
                  icon={saveStatus === 'saved' ? <Check size={12} /> : undefined}
                  label={
                    saveStatus === 'saving'
                      ? 'Saving…'
                      : saveStatus === 'saved'
                      ? 'Saved'
                      : 'Retry save'
                  }
                  onClick={
                    saveStatus === 'error'
                      ? () => void persistSettingsToDb(plannerSettings)
                      : undefined
                  }
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                    height: 24,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                />
              )}
            </Stack>

            {/* Right: Screen View Mode Toggle + Populate (when empty) + Print Binder + Week Tools */}
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap={{ xs: 'wrap', md: 'nowrap' }}
              useFlexGap
              sx={{ flexShrink: 0 }}
            >
              {/* Screen-Only Layout Switcher (Print Binder always prints the exact 2-page binder) */}
              <Box
                role="group"
                aria-label="On-screen view mode"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 0.25,
                  gap: 0.25,
                  flexShrink: 0,
                }}
              >
                <Button
                  size="small"
                  variant={screenViewMode === 'binder_2page' ? 'contained' : 'text'}
                  color={screenViewMode === 'binder_2page' ? 'primary' : 'inherit'}
                  startIcon={<BookOpen size={13} />}
                  onClick={() => setScreenViewMode('binder_2page')}
                  title="2-Page Binder View (Default)"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                    py: 0.35,
                    px: 0.85,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  2-Page
                </Button>
                <Button
                  size="small"
                  variant={screenViewMode === 'binder_spread' ? 'contained' : 'text'}
                  color={screenViewMode === 'binder_spread' ? 'primary' : 'inherit'}
                  startIcon={<Columns size={13} />}
                  onClick={() => setScreenViewMode('binder_spread')}
                  title="Side-by-Side 2-Page Spread"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                    py: 0.35,
                    px: 0.85,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    display: { xs: 'none', lg: 'inline-flex' },
                  }}
                >
                  Spread
                </Button>
                <Button
                  size="small"
                  variant={screenViewMode === 'five_day' ? 'contained' : 'text'}
                  color={screenViewMode === 'five_day' ? 'primary' : 'inherit'}
                  startIcon={<LayoutGrid size={13} />}
                  onClick={() => setScreenViewMode('five_day')}
                  title="Unified 5-Day Mon–Fri Grid (Screen Only)"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    borderRadius: 1,
                    py: 0.35,
                    px: 0.85,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  5-Day
                </Button>
              </Box>

              {parentNotes.length === 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<Sparkles size={14} />}
                  disabled={populatingWeek}
                  onClick={() => handleOpenPopulateOrPullModal('populate_and_pull', false)}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderRadius: 1,
                    px: 1.15,
                    py: 0.55,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {populatingWeek ? 'Populating…' : 'Populate'}
                </Button>
              )}

              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<Printer size={15} />}
                onClick={handlePrint}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  borderRadius: 1,
                  px: 1.35,
                  py: 0.55,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Print Binder
              </Button>

              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<MenuIcon size={15} />}
                onClick={(e) => setToolsMenuAnchorEl(e.currentTarget)}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  borderRadius: 1,
                  px: 1.15,
                  py: 0.55,
                  minWidth: 0,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                Week Tools
              </Button>

              <Menu
                anchorEl={toolsMenuAnchorEl}
                open={Boolean(toolsMenuAnchorEl)}
                onClose={() => setToolsMenuAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 325,
                    width: 'max-content',
                    borderRadius: 1,
                    p: 0.75,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 8,
                  },
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ px: 1.5, py: 0.75, display: 'block', textTransform: 'none' }}
                >
                  Week Actions ({formatWeekRangeLabel()})
                </Typography>

                <MenuItem
                  disabled={populatingWeek}
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    handleOpenPopulateOrPullModal('populate_and_pull', false);
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <Sparkles size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    {populatingWeek ? 'Populating' : 'Populate Week Placeholders'}
                  </Typography>
                </MenuItem>

                <MenuItem
                  disabled={populatingWeek}
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    handleOpenPopulateOrPullModal('pull_only', false);
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <Copy size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    Pull Forward Previous Week&apos;s Sidebar
                  </Typography>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    setShowCountersPanel((prev) => !prev);
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <Sliders size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    {showCountersPanel ? 'Hide Week # & Math Days' : 'Adjust Week # & Math Days'}
                  </Typography>
                </MenuItem>

                <Divider sx={{ my: 0.75 }} />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ px: 1.5, py: 0.75, display: 'block', textTransform: 'none' }}
                >
                  Curriculum Setup
                </Typography>

                <MenuItem
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    router.push('/automations');
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <Repeat size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Automations &amp; Syllabi →
                  </Typography>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    router.push('/subjects-habits');
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <Settings size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Subjects &amp; Habit Trackers →
                  </Typography>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    router.push('/audit-log');
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
                >
                  <History size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Audit Log &amp; Change History →
                  </Typography>
                </MenuItem>

                <Divider sx={{ my: 0.75 }} />

                <MenuItem
                  disabled={parentNotes.length === 0}
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    setConfirmResetOpen(true);
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.5, color: 'error.main' }}
                >
                  <RotateCcw size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Reset Week Notes
                  </Typography>
                </MenuItem>
              </Menu>
            </Stack>
          </Stack>

          {/* Expandable Panel: Adjust Week Counters & Math Syllabus Days */}
          {showCountersPanel && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1}
                  mb={2}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Week Sequence &amp; Math Syllabus Days ({formatWeekRangeLabel()})
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                      Skipped or repeating a week or Math class? Adjust the numbers below and click <strong>Sync / Overwrite Placeholders</strong> to update this week&apos;s grid.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<Repeat size={15} />}
                      disabled={populatingWeek}
                      onClick={() => handleOpenPopulateOrPullModal('populate_and_pull', true)}
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
                    >
                      Sync / Overwrite Placeholders…
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => setShowCountersPanel(false)}
                      title="Close panel"
                      aria-label="Close week sequence panel"
                    >
                      <X size={18} />
                    </IconButton>
                  </Stack>
                </Stack>

                <Grid container spacing={2}>
                  {displaySubjects.map((sub) => {
                    const cfg = parseRecurringConfig(sub.recurring_config, sub.name);
                    if (!cfg.enabled) return null;

                    const override = plannerSettings.subject_overrides[sub.id];
                    const resolved = resolveSubjectCountersForWeek(cfg, weekStartDate, override);

                    if (cfg.mode === 'math_syllabus') {
                      const tueDay = resolved.tuesday_math_day;
                      const thuDay = resolved.thursday_math_day;
                      const tueSyl = tueDay ? syllabusMap.get(tueDay) : undefined;
                      const thuSyl = thuDay ? syllabusMap.get(thuDay) : undefined;

                      return (
                        <Grid item xs={12} md={6} key={sub.id}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  component="span"
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: sub.color || '#1b5698',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="subtitle2" fontWeight={700}>
                                  {sub.name} — Syllabus Day Selector
                                </Typography>
                              </Stack>
                              <Chip
                                size="small"
                                label="Tue & Thu Classes"
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1 }}
                              />
                            </Stack>

                            <Grid container spacing={1.5}>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  select
                                  SelectProps={{ native: true }}
                                  fullWidth
                                  size="small"
                                  label="Tuesday Math Class (Mon HW)"
                                  value={tueDay === null ? 0 : tueDay}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const newTue = val === 0 ? null : val;
                                    const nextThu = newTue !== null ? Math.min(64, newTue + 1) : thuDay;
                                    handleUpdateSubjectOverride(
                                      sub.id,
                                      {
                                        tuesday_math_day: newTue,
                                        thursday_math_day: nextThu,
                                      },
                                      true
                                    );
                                  }}
                                >
                                  <option value={0}>No Class / Skipped</option>
                                  {syllabusDays.map((sd) => (
                                    <option key={sd.day_number} value={sd.day_number}>
                                      Day {sd.day_number}: {sd.workbook || 'Review'} ({sd.topic.slice(0, 26)})
                                    </option>
                                  ))}
                                </TextField>
                                {tueSyl && (
                                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ fontSize: '0.75rem' }}>
                                    Mon HW: <strong>{tueSyl.workbook}</strong>
                                  </Typography>
                                )}
                              </Grid>

                              <Grid item xs={12} sm={6}>
                                <TextField
                                  select
                                  SelectProps={{ native: true }}
                                  fullWidth
                                  size="small"
                                  label="Thursday Math Class (Wed HW)"
                                  value={thuDay === null ? 0 : thuDay}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const newThu = val === 0 ? null : val;
                                    handleUpdateSubjectOverride(
                                      sub.id,
                                      {
                                        tuesday_math_day: tueDay,
                                        thursday_math_day: newThu,
                                      },
                                      true
                                    );
                                  }}
                                >
                                  <option value={0}>No Class / Skipped</option>
                                  {syllabusDays.map((sd) => (
                                    <option key={sd.day_number} value={sd.day_number}>
                                      Day {sd.day_number}: {sd.workbook || 'Review'} ({sd.topic.slice(0, 26)})
                                    </option>
                                  ))}
                                </TextField>
                                {thuSyl && (
                                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ fontSize: '0.75rem' }}>
                                    Wed HW: <strong>{thuSyl.workbook}</strong>
                                  </Typography>
                                )}
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>
                      );
                    }

                    // Check which tokens this subject uses or if it is API-synced / Class-syllabus backed
                    const officialCourseName = getOfficialCourseSubtitle(cfg);
                    const subjectSyllabi = getSubjectCourseSyllabi(cfg);
                    const activeSyllabus = getActiveCourseSyllabus(cfg);
                    const apiWeeks =
                      activeSyllabus?.source_type === 'api_sync' &&
                      Array.isArray(activeSyllabus?.weeks)
                        ? activeSyllabus.weeks
                        : [];
                    const selectedApiWeek =
                      apiWeeks.length > 0
                        ? apiWeeks.find((w) => w.week_number === resolved.week_num)
                        : undefined;
                    const syllabusStartDay =
                      apiWeeks.length > 0
                        ? getApiSyllabusWeekStartDay(activeSyllabus?.api_auto_populate)
                        : 'monday';
                    const spansTwoSyllabusWeeks =
                      apiWeeks.length > 0 && syllabusStartDay !== 'monday';
                    const previousWeekdaysBeforeStart = spansTwoSyllabusWeeks
                      ? getPreviousWeekdaysBeforeStartDay(
                          syllabusStartDay,
                          activeSyllabus?.api_auto_populate
                        )
                      : [];
                    const prevSyllabusWeekNum = Math.max(1, resolved.week_num - 1);
                    const prevApiWeek = spansTwoSyllabusWeeks
                      ? apiWeeks.find((w) => w.week_number === prevSyllabusWeekNum)
                      : undefined;
                    const formatApiSourceShortLabel = (src?: string): string => {
                      switch (src) {
                        case 'day_1':
                          return 'Day 1';
                        case 'day_2':
                          return 'Day 2';
                        case 'day_3':
                          return 'Day 3';
                        case 'day_4':
                          return 'Day 4';
                        case 'day_5':
                          return 'Day 5';
                        case 'day_4_and_5':
                          return 'Days 4 & 5';
                        case 'full_week':
                          return 'Full Week';
                        default:
                          return src || '';
                      }
                    };
                    const classSyllabusDays =
                      cfg.mode === 'template' &&
                      activeSyllabus &&
                      Array.isArray(activeSyllabus.days) &&
                      activeSyllabus.days.length > 0
                        ? activeSyllabus.days
                        : [];
                    const hasClassSyllabus = classSyllabusDays.length > 0;

                    // Group classSyllabusDays by week_number for the Week dropdown
                    const classSyllabusWeeks: Array<{
                      weekNum: number;
                      firstClassNum: number;
                      lastClassNum: number;
                      unit: string;
                      firstTopic: string;
                    }> = [];
                    if (hasClassSyllabus) {
                      const weekMap = new Map<number, MathSyllabusDay[]>();
                      classSyllabusDays.forEach((d, idx) => {
                        const wk = d.week_number ?? Math.ceil((idx + 1) / 3);
                        const arr = weekMap.get(wk) || [];
                        arr.push(d);
                        weekMap.set(wk, arr);
                      });
                      Array.from(weekMap.entries())
                        .sort((a, b) => a[0] - b[0])
                        .forEach(([wkNum, daysInWk]) => {
                          classSyllabusWeeks.push({
                            weekNum: wkNum,
                            firstClassNum: daysInWk[0].day_number,
                            lastClassNum: daysInWk[daysInWk.length - 1].day_number,
                            unit: daysInWk[0].unit || '',
                            firstTopic: daysInWk[0].topic || '',
                          });
                        });
                    }

                    const allTemplates = DAY_KEYS.map((dk) => cfg.days[dk].template).join(' ');
                    const usesWeek = allTemplates.includes('{week}') || apiWeeks.length > 0;
                    const usesClassNum = allTemplates.includes('{class_num}');
                    const usesLesson =
                      allTemplates.includes('{lesson}') || allTemplates.includes('{prev_lesson}');

                    return (
                      <Grid
                        item
                        xs={12}
                        sm={6}
                        md={hasClassSyllabus || spansTwoSyllabusWeeks ? 6 : 3}
                        key={sub.id}
                      >
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            height: '100%',
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            mb={1.25}
                            spacing={1}
                          >
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  component="span"
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: sub.color || '#1b5698',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                  {sub.name}
                                  {hasClassSyllabus ? ' — Syllabus Week & Class Selector' : ''}
                                </Typography>
                              </Stack>
                              {officialCourseName && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontStyle: 'italic',
                                    color: 'text.secondary',
                                    fontSize: '0.75rem',
                                    display: 'block',
                                    mt: 0.15,
                                  }}
                                >
                                  {officialCourseName}
                                </Typography>
                              )}
                            </Box>
                            {hasClassSyllabus && (
                              <Chip
                                size="small"
                                label={`${classSyllabusWeeks.length} Wks · ${classSyllabusDays.length} Classes`}
                                color="success"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1 }}
                              />
                            )}
                            {spansTwoSyllabusWeeks && (
                              <Chip
                                size="small"
                                label={`Starts ${DAY_LABELS[syllabusStartDay]} · Spans 2 Wks`}
                                color="warning"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1 }}
                              />
                            )}
                          </Stack>

                          <Stack spacing={1.25}>
                            {subjectSyllabi.length > 1 && (
                              <TextField
                                select
                                size="small"
                                label="Active Science / Subject Syllabus"
                                value={activeSyllabus?.id || subjectSyllabi[0].id || ''}
                                onChange={(e) => handleSwitchActiveSyllabus(sub.id, e.target.value)}
                                fullWidth
                                SelectProps={{ native: true }}
                              >
                                {subjectSyllabi.map((syl, idx) => (
                                  <option key={syl.id || idx} value={syl.id || `syllabus-${idx + 1}`}>
                                    {syl.course_title} ({syl.days.length} classes)
                                  </option>
                                ))}
                              </TextField>
                            )}

                            {apiWeeks.length > 0 ? (
                              <Box>
                                <TextField
                                  select
                                  size="small"
                                  label={
                                    spansTwoSyllabusWeeks
                                      ? `Syllabus Week # (Starts ${DAY_LABELS[syllabusStartDay]}; earlier days from prev week)`
                                      : 'API Syllabus Week #'
                                  }
                                  value={resolved.week_num}
                                  onChange={(e) => {
                                    const nextWeekNum = Math.max(
                                      1,
                                      parseInt(e.target.value, 10) || 1
                                    );
                                    const patch: Partial<SubjectWeekOverride> = {
                                      week_num: nextWeekNum,
                                      lesson_num: nextWeekNum,
                                    };
                                    if (usesClassNum) {
                                      patch.class_num = (nextWeekNum - 1) * 3 + 1;
                                    }
                                    handleUpdateSubjectOverride(sub.id, patch, true);
                                  }}
                                  fullWidth
                                  SelectProps={{ native: true }}
                                >
                                  {apiWeeks.map((wk) => {
                                    const prevWk = Math.max(1, wk.week_number - 1);
                                    const spanSuffix = spansTwoSyllabusWeeks
                                      ? wk.week_number > 1
                                        ? ` — Starts ${DAY_LABELS[syllabusStartDay]} (Prev days from Week ${prevWk})`
                                        : ` — Starts ${DAY_LABELS[syllabusStartDay]}`
                                      : '';
                                    return (
                                      <option key={wk.week_number} value={wk.week_number}>
                                        Week {wk.week_number}
                                        {spanSuffix}
                                        {wk.section_title && wk.section_title !== `Week ${wk.week_number}`
                                          ? ` (${wk.section_title})`
                                          : ''}
                                        {wk.linked_assessments.length > 0
                                          ? ` • ${wk.linked_assessments[0].name}`
                                          : ''}
                                      </option>
                                    );
                                  })}
                                </TextField>
                                {spansTwoSyllabusWeeks && (
                                  <Box
                                    sx={{
                                      mt: 1,
                                      p: 1,
                                      borderRadius: 0.75,
                                      bgcolor: alpha(theme.palette.warning.main, 0.08),
                                      border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      color="text.primary"
                                      display="block"
                                      sx={{ fontSize: '0.73rem', lineHeight: 1.35 }}
                                    >
                                      Syllabus week starts on {DAY_LABELS[syllabusStartDay]}:
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                      sx={{ fontSize: '0.72rem', lineHeight: 1.35, mt: 0.25 }}
                                    >
                                      Selecting <strong>Week {resolved.week_num}</strong> starts{' '}
                                      <strong>Week {resolved.week_num} (Day 1)</strong> on{' '}
                                      <strong>{DAY_LABELS[syllabusStartDay]}</strong>, while the previous days (
                                      <strong>
                                        {previousWeekdaysBeforeStart
                                          .map((dk) => DAY_LABELS[dk])
                                          .join(', ')}
                                      </strong>
                                      ) come from the previous week in the syllabus (
                                      <strong>Week {prevSyllabusWeekNum}</strong>).
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      spacing={0.5}
                                      flexWrap="wrap"
                                      useFlexGap
                                      sx={{ mt: 0.75 }}
                                    >
                                      {DAY_KEYS.map((dk) => {
                                        const rule =
                                          activeSyllabus?.api_auto_populate?.weekday_rules?.[dk];
                                        if (!rule || !rule.enabled || rule.api_source === 'none') {
                                          return null;
                                        }
                                        const resolvedDay = resolveApiSyllabusWeekForWeekday(
                                          apiWeeks,
                                          resolved.week_num,
                                          dk,
                                          activeSyllabus?.api_auto_populate
                                        );
                                        return (
                                          <Chip
                                            key={dk}
                                            size="small"
                                            label={`${DAY_LABELS[dk].slice(0, 3)}: Wk ${resolvedDay.weekNumber} (${formatApiSourceShortLabel(rule.api_source)})`}
                                            color={
                                              resolvedDay.isFromPreviousWeek ? 'default' : 'primary'
                                            }
                                            variant={
                                              resolvedDay.isFromPreviousWeek ? 'outlined' : 'filled'
                                            }
                                            sx={{
                                              height: 20,
                                              fontSize: '0.68rem',
                                              fontWeight: 700,
                                              borderRadius: 0.75,
                                            }}
                                          />
                                        );
                                      })}
                                    </Stack>
                                  </Box>
                                )}
                                {spansTwoSyllabusWeeks &&
                                  prevApiWeek &&
                                  prevApiWeek.linked_assessments.length > 0 && (
                                    <Typography
                                      variant="caption"
                                      color="secondary.main"
                                      fontWeight={700}
                                      display="block"
                                      mt={0.5}
                                      sx={{ fontSize: '0.75rem' }}
                                    >
                                      Completing Wk {prevSyllabusWeekNum} Quiz/Assn:{' '}
                                      {prevApiWeek.linked_assessments.map((a) => a.name).join(', ')}
                                    </Typography>
                                  )}
                                {!spansTwoSyllabusWeeks &&
                                  selectedApiWeek &&
                                  selectedApiWeek.linked_assessments.length > 0 && (
                                    <Typography
                                      variant="caption"
                                      color="secondary.main"
                                      fontWeight={700}
                                      display="block"
                                      mt={0.5}
                                      sx={{ fontSize: '0.75rem' }}
                                    >
                                      Quiz/Assn:{' '}
                                      {selectedApiWeek.linked_assessments
                                        .map((a) => a.name)
                                        .join(', ')}
                                    </Typography>
                                  )}
                              </Box>
                            ) : hasClassSyllabus ? (
                              <Box>
                                <Grid container spacing={1.5}>
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      select
                                      size="small"
                                      label="Select Syllabus Week #"
                                      value={resolved.week_num}
                                      onChange={(e) => {
                                        const nextWeekNum = Math.max(
                                          1,
                                          parseInt(e.target.value, 10) || 1
                                        );
                                        const matchedWk = classSyllabusWeeks.find(
                                          (w) => w.weekNum === nextWeekNum
                                        );
                                        const nextClassNum = matchedWk
                                          ? matchedWk.firstClassNum
                                          : (nextWeekNum - 1) * 3 + 1;
                                        handleUpdateSubjectOverride(
                                          sub.id,
                                          {
                                            week_num: nextWeekNum,
                                            class_num: nextClassNum,
                                          },
                                          true
                                        );
                                      }}
                                      fullWidth
                                      SelectProps={{ native: true }}
                                    >
                                      {classSyllabusWeeks.map((wk) => (
                                        <option key={wk.weekNum} value={wk.weekNum}>
                                          Week {wk.weekNum} (Classes {wk.firstClassNum}–{wk.lastClassNum})
                                          {wk.unit ? ` — ${wk.unit}` : ''}
                                        </option>
                                      ))}
                                    </TextField>
                                  </Grid>

                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      select
                                      size="small"
                                      label="Select Starting Class # (Mon)"
                                      value={resolved.class_num}
                                      onChange={(e) => {
                                        const nextClass = Math.max(
                                          1,
                                          parseInt(e.target.value, 10) || 1
                                        );
                                        const matchedDay = classSyllabusDays.find(
                                          (d) => d.day_number === nextClass
                                        );
                                        const nextWeek =
                                          matchedDay?.week_number ?? Math.ceil(nextClass / 3);
                                        handleUpdateSubjectOverride(
                                          sub.id,
                                          {
                                            week_num: nextWeek,
                                            class_num: nextClass,
                                          },
                                          true
                                        );
                                      }}
                                      fullWidth
                                      SelectProps={{ native: true }}
                                    >
                                      {classSyllabusDays.map((cd) => (
                                        <option key={cd.day_number} value={cd.day_number}>
                                          Class {cd.day_number} (Wk {cd.week_number ?? Math.ceil(cd.day_number / 3)}):{' '}
                                          {cd.topic.slice(0, 44)}
                                        </option>
                                      ))}
                                    </TextField>
                                  </Grid>
                                </Grid>

                                {/* Live Mon/Tue/Wed Topic Preview */}
                                <Box
                                  mt={1.25}
                                  p={1}
                                  sx={{
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                  }}
                                >
                                  {[0, 1, 2].map((offset) => {
                                    const cNum = resolved.class_num + offset;
                                    const cDay = classSyllabusDays.find((d) => d.day_number === cNum);
                                    const dayLabel = offset === 0 ? 'Mon' : offset === 1 ? 'Tue' : 'Wed';
                                    if (!cDay) return null;
                                    return (
                                      <Typography
                                        key={cNum}
                                        variant="caption"
                                        display="block"
                                        color="text.secondary"
                                        sx={{ fontSize: '0.75rem', lineHeight: 1.35 }}
                                      >
                                        <strong>
                                          {dayLabel} (Class {cNum}):
                                        </strong>{' '}
                                        {cDay.topic}
                                        {cDay.activity ? ` • [Activity: ${cDay.activity}]` : ''}
                                      </Typography>
                                    );
                                  })}
                                </Box>
                              </Box>
                            ) : (
                              <>
                                {(usesWeek || (!usesClassNum && !usesLesson)) && (
                                  <TextField
                                    size="small"
                                    type="number"
                                    label="Week #"
                                    value={resolved.week_num}
                                    onChange={(e) => {
                                      const nextWeekNum = Math.max(
                                        1,
                                        parseInt(e.target.value, 10) || 1
                                      );
                                      const patch: Partial<SubjectWeekOverride> = {
                                        week_num: nextWeekNum,
                                      };
                                      if (usesClassNum) {
                                        patch.class_num = (nextWeekNum - 1) * 3 + 1;
                                      }
                                      handleUpdateSubjectOverride(sub.id, patch, true);
                                    }}
                                    fullWidth
                                  />
                                )}
                                {usesClassNum && (
                                  <TextField
                                    size="small"
                                    type="number"
                                    label="Mon Starting Class #"
                                    value={resolved.class_num}
                                    onChange={(e) => {
                                      const nextClass = Math.max(
                                        1,
                                        parseInt(e.target.value, 10) || 1
                                      );
                                      handleUpdateSubjectOverride(
                                        sub.id,
                                        { class_num: nextClass },
                                        true
                                      );
                                    }}
                                    helperText={`Mon=${resolved.class_num}, Tue=${resolved.class_num + 1}, Wed=${resolved.class_num + 2}`}
                                    fullWidth
                                  />
                                )}
                                {usesLesson && (
                                  <TextField
                                    size="small"
                                    type="number"
                                    label="Lesson #"
                                    value={resolved.lesson_num}
                                    onChange={(e) => {
                                      const nextLesson = Math.max(
                                        1,
                                        parseInt(e.target.value, 10) || 1
                                      );
                                      handleUpdateSubjectOverride(
                                        sub.id,
                                        { lesson_num: nextLesson },
                                        true
                                      );
                                    }}
                                    helperText={`Quiz Lesson: ${Math.max(1, resolved.lesson_num - 1)}`}
                                    fullWidth
                                  />
                                )}
                              </>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            </>
          )}
        </Card>
      </Box>

      {/* PRINTABLE 2-PAGE BINDER PLANNER WRAPPER (Always used by @media print) */}
      <Box
        ref={printRootRef}
        className={`planner-print-root ${screenViewMode === 'binder_spread' ? 'spread-mode' : ''} ${
          screenViewMode === 'five_day' ? 'screen-hidden-print-only' : ''
        }`}
      >
        {/* ========================================================================= */}
        {/* PAGE 1: MONDAY, TUESDAY, WEDNESDAY (3 COLUMNS x 8 SUBJECT ROWS)          */}
        {/* ========================================================================= */}
        <Box ref={page1Ref} className="print-page page-break">
          <div ref={page1InnerRef} className="print-page-inner">
          {/* Header Bar: WEEKLY Assignments in Raleway & Sacramento Fonts */}
          <Box className="planner-header">
            <Typography
              component="span"
              sx={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 400,
                fontSize: '24px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#151821',
                lineHeight: 1,
              }}
            >
              WEEKLY
            </Typography>
            <Typography
              component="span"
              sx={{
                fontFamily: "'Sacramento', cursive",
                fontWeight: 400,
                fontSize: '44px',
                color: '#151821',
                lineHeight: 1,
                ml: 1.5,
                mt: '-4px',
              }}
            >
              Assignments
            </Typography>
          </Box>

          {/* Page 1 Grid (SUBJECT + 3 Days: Mon, Tue, Wed) */}
          <table className="planner-table">
            <thead>
              <tr>
                <th className="subject-header-col">SUBJECT</th>
                {page1Days.map((d) => (
                  <th key={d.dateStr} className="day-header-col">
                    {d.dayName} [{d.formatted}]
                  </th>
                ))}
              </tr>
              {/* DEDICATED ALL-DAY EVENTS ROW FOR HOLIDAYS & DAILY TASKS */}
              <tr className="all-day-events-row" style={{ height: syncedAllDayMinHeight }}>
                <td className="all-day-label-cell">
                  HOLIDAYS &amp; TASKS
                </td>
                {page1Days.map((d) => {
                  const dayHolidays = holidays.filter((h) => h.holiday_date === d.dateStr);
                  const dayTasks = tasksList.filter((t) => t.due_date === d.dateStr);
                  const dayGoogleEvents = googleEvents.filter((g) => g.event_date === d.dateStr);
                  const hasEvents = dayHolidays.length > 0 || dayTasks.length > 0 || dayGoogleEvents.length > 0;

                  return (
                    <td key={d.dateStr} className="all-day-events-cell" style={{ height: syncedAllDayMinHeight }}>
                      <div className="all-day-items-wrapper" style={{ minHeight: syncedAllDayMinHeight }}>
                        {dayHolidays.map((h) => (
                          <div key={h.id} className="holiday-banner-top" style={{ backgroundColor: branding.holidays.color }} title={h.title}>
                            <ItemIcon name={branding.holidays.icon} size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                            <span className="banner-text">{h.title}</span>
                          </div>
                        ))}
                        {dayGoogleEvents.map((g) => (
                          <div key={g.id} className="task-banner-top" style={{ backgroundColor: g.color || '#4285F4' }} title={g.title}>
                            <ItemIcon name="Calendar" size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                            <span className="banner-text">{g.title}</span>
                          </div>
                        ))}
                        {dayTasks.map((t) => (
                          <div key={t.id} className="task-banner-top" style={{ backgroundColor: branding.tasks.color }} title={t.title}>
                            <ItemIcon name={branding.tasks.icon} size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                            <span className="banner-text">{t.status === 'completed' ? '✓' : '☐'} {t.title}</span>
                          </div>
                        ))}
                        {!hasEvents && <div className="all-day-empty">—</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>

              {displaySubjects.map((subject) => {
                const subCfg = parseRecurringConfig(subject.recurring_config, subject.name);
                const officialSubtitle = getOfficialCourseSubtitle(subCfg);
                return (
                  <tr key={subject.id}>
                    <td className="subject-name-cell">
                      <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2, color: '#0f172a' }}>
                        {subject.name}
                      </Typography>
                      {officialSubtitle && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontStyle: 'italic',
                            fontWeight: 500,
                            fontSize: '0.66rem',
                            color: '#475569',
                            lineHeight: 1.15,
                            mt: 0.25,
                          }}
                        >
                          {officialSubtitle}
                        </Typography>
                      )}
                      {subject.link && (
                        <Typography
                          component="a"
                          href={subject.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="no-print"
                          sx={{
                            display: 'inline-block',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: '#0284c7',
                            textDecoration: 'none',
                            mt: 0.35,
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {subject.link.includes('zoom.us')
                            ? 'Zoom Link ↗'
                            : subject.link.includes('adobeconnect.com')
                            ? 'Live Classroom ↗'
                            : 'Class Link ↗'}
                        </Typography>
                      )}
                    </td>
                    {page1Days.map((d) => {
                      const cellSchoolAssignments = schoolAssignments.filter(
                        (a) =>
                          a.subject_id === subject.id &&
                          a.due_date === d.dateStr &&
                          a.workflow_status !== 'staged'
                      );
                      const isSelectedCell =
                        openCellModal &&
                        selectedSubject?.id === subject.id &&
                        selectedDate === d.dateStr;

                      return (
                        <td
                          key={d.dateStr}
                          className={`assignment-cell ${isSelectedCell ? 'active-cell-screen' : ''}`}
                          tabIndex={0}
                          role="button"
                          aria-label={`${subject.name}, ${d.dayName} ${d.formatted}`}
                          onClick={() => handleOpenCellEditor(subject, d.dateStr)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenCellEditor(subject, d.dateStr);
                            }
                          }}
                        >
                          {(() => {
                            const squareNotes = parentNotes.filter(
                              (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                            );
                            if (squareNotes.length === 0) return null;
                            return squareNotes.map((noteItem) => (
                              <Box key={noteItem.id} className="parent-note-item" sx={{ mb: 1 }}>
                                <FormattedParentNote
                                  noteId={noteItem.id}
                                  title={noteItem.title}
                                  description={noteItem.description}
                                  color={branding.notes.color}
                                  iconName={branding.notes.icon}
                                  parentNoteColor={branding.parentNotes.color}
                                  parentNoteIconName={branding.parentNotes.icon}
                                  onToggleCheckbox={handleToggleParentNoteCheckbox}
                                />
                              </Box>
                            ));
                          })()}
                          {cellSchoolAssignments.map((a) => (
                            <div
                              key={a.id}
                              className="school-assignment-item"
                              style={{ color: branding.assignments.color, cursor: 'pointer' }}
                              onClick={(e) => handleOpenAssignmentFromPlanner(a, e)}
                              title="Click to grade or edit assignment"
                            >
                              <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} style={{ marginRight: 4, display: 'inline' }} />
                              [{a.category.toUpperCase()}] {a.title}
                              {typeof a.percentage_score === 'number'
                                ? ` • ${a.percentage_score.toFixed(0)}%`
                                : ''}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Box>

        {/* ========================================================================= */}
        {/* PAGE 2: THURSDAY, FRIDAY + RIGHT SIDEBAR (TO-DO, PRIORITIES, HABITS, NOTES) */}
        {/* ========================================================================= */}
        <Box ref={page2Ref} className="print-page">
          <div ref={page2InnerRef} className="print-page-inner">
          {/* Header Bar */}
          <Box className="planner-header">
            <Typography variant="body1" fontWeight={700} className="week-header-text">
              WEEK OF: {weekStartDate}
            </Typography>
          </Box>

          <Box className="page2-container">
            {/* Page 2 Grid (SUBJECT + 2 Days: Thursday, Friday) */}
            <Box className="page2-table-wrapper">
              <table className="planner-table">
                <thead>
                  <tr>
                    <th className="subject-header-col">SUBJECT</th>
                    {page2Days.map((d, idx) => (
                      <th key={d.dateStr} className={`day-header-col ${idx === page2Days.length - 1 ? 'friday-col' : ''}`}>
                        {d.dayName} [{d.formatted}]
                      </th>
                    ))}
                  </tr>
                  {/* DEDICATED ALL-DAY EVENTS ROW FOR HOLIDAYS & DAILY TASKS */}
                  <tr className="all-day-events-row" style={{ height: syncedAllDayMinHeight }}>
                    <td className="all-day-label-cell">
                      HOLIDAYS &amp; TASKS
                    </td>
                    {page2Days.map((d) => {
                      const dayHolidays = holidays.filter((h) => h.holiday_date === d.dateStr);
                      const dayTasks = tasksList.filter((t) => t.due_date === d.dateStr);
                      const dayGoogleEvents = googleEvents.filter((g) => g.event_date === d.dateStr);
                      const hasEvents = dayHolidays.length > 0 || dayTasks.length > 0 || dayGoogleEvents.length > 0;

                      return (
                        <td key={d.dateStr} className="all-day-events-cell" style={{ height: syncedAllDayMinHeight }}>
                          <div className="all-day-items-wrapper" style={{ minHeight: syncedAllDayMinHeight }}>
                            {dayHolidays.map((h) => (
                              <div key={h.id} className="holiday-banner-top" style={{ backgroundColor: branding.holidays.color }} title={h.title}>
                                <ItemIcon name={branding.holidays.icon} size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                                <span className="banner-text">{h.title}</span>
                              </div>
                            ))}
                            {dayGoogleEvents.map((g) => (
                              <div key={g.id} className="task-banner-top" style={{ backgroundColor: g.color || '#4285F4' }} title={g.title}>
                                <ItemIcon name="Calendar" size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                                <span className="banner-text">{g.title}</span>
                              </div>
                            ))}
                            {dayTasks.map((t) => (
                              <div key={t.id} className="task-banner-top" style={{ backgroundColor: branding.tasks.color }} title={t.title}>
                                <ItemIcon name={branding.tasks.icon} size={10} color="#ffffff" style={{ marginRight: 3, flexShrink: 0 }} />
                                <span className="banner-text">{t.status === 'completed' ? '✓' : '☐'} {t.title}</span>
                              </div>
                            ))}
                            {!hasEvents && <div className="all-day-empty">—</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>

                  {displaySubjects.map((subject) => {
                    const subCfg = parseRecurringConfig(subject.recurring_config, subject.name);
                    const officialSubtitle = getOfficialCourseSubtitle(subCfg);
                    return (
                      <tr key={subject.id}>
                        <td className="subject-name-cell">
                          <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2, color: '#0f172a' }}>
                            {subject.name}
                          </Typography>
                          {officialSubtitle && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                fontStyle: 'italic',
                                fontWeight: 500,
                                fontSize: '0.66rem',
                                color: '#475569',
                                lineHeight: 1.15,
                                mt: 0.25,
                              }}
                            >
                              {officialSubtitle}
                            </Typography>
                          )}
                          {subject.link && (
                            <Typography
                              component="a"
                              href={subject.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="no-print"
                              sx={{
                                display: 'inline-block',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: '#0284c7',
                                textDecoration: 'none',
                                mt: 0.35,
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {subject.link.includes('zoom.us')
                                ? 'Zoom Link ↗'
                                : subject.link.includes('adobeconnect.com')
                                ? 'Live Classroom ↗'
                                : 'Class Link ↗'}
                            </Typography>
                          )}
                        </td>
                        {page2Days.map((d) => {
                          const cellSchoolAssignments = schoolAssignments.filter(
                            (a) =>
                              a.subject_id === subject.id &&
                              a.due_date === d.dateStr &&
                              a.workflow_status !== 'staged'
                          );
                          const isSelectedCell =
                            openCellModal &&
                            selectedSubject?.id === subject.id &&
                            selectedDate === d.dateStr;

                          return (
                            <td
                              key={d.dateStr}
                              className={`assignment-cell ${isSelectedCell ? 'active-cell-screen' : ''}`}
                              tabIndex={0}
                              role="button"
                              aria-label={`${subject.name}, ${d.dayName} ${d.formatted}`}
                              onClick={() => handleOpenCellEditor(subject, d.dateStr)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleOpenCellEditor(subject, d.dateStr);
                                }
                              }}
                            >
                              {(() => {
                                const squareNotes = parentNotes.filter(
                                  (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                                );
                                if (squareNotes.length === 0) return null;
                                return squareNotes.map((noteItem) => (
                                  <Box key={noteItem.id} className="parent-note-item" sx={{ mb: 1 }}>
                                    <FormattedParentNote
                                      noteId={noteItem.id}
                                      title={noteItem.title}
                                      description={noteItem.description}
                                      color={branding.notes.color}
                                      iconName={branding.notes.icon}
                                      parentNoteColor={branding.parentNotes.color}
                                      parentNoteIconName={branding.parentNotes.icon}
                                      onToggleCheckbox={handleToggleParentNoteCheckbox}
                                    />
                                  </Box>
                                ));
                              })()}
                              {cellSchoolAssignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="school-assignment-item"
                                  style={{ color: branding.assignments.color, cursor: 'pointer' }}
                                  onClick={(e) => handleOpenAssignmentFromPlanner(a, e)}
                                  title="Click to grade or edit assignment"
                                >
                                  <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} style={{ marginRight: 4, display: 'inline' }} />
                                  [{a.category.toUpperCase()}] {a.title}
                                  {typeof a.percentage_score === 'number'
                                    ? ` • ${a.percentage_score.toFixed(0)}%`
                                    : ''}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>

            {/* Right Sidebar Column (To-Do, Top 3 Priorities, Habits, Next Month, Notes) */}
            <Box className="sidebar-column">
              {/* TO DO Section */}
              <Box className="sidebar-section">
                <div className="sidebar-header-badge">TO DO</div>
                <div className="todo-list">
                  {plannerSettings.todos.map((todoText, idx) => (
                    <div key={idx} className="todo-item">
                      <div className="checkbox-square" />
                      <input
                        type="text"
                        className="sidebar-input"
                        aria-label={`To-Do item ${idx + 1}`}
                        value={todoText}
                        onChange={(e) => {
                          const updated = [...plannerSettings.todos];
                          updated[idx] = e.target.value;
                          handleQueueSettingsSave({ ...plannerSettings, todos: updated });
                        }}
                        onBlur={() => void flushPendingSettingsSave()}
                      />
                    </div>
                  ))}
                </div>
              </Box>

              {/* TOP 3 PRIORITY Section */}
              <Box className="sidebar-section">
                <div className="sidebar-header-badge">TOP 3 PRIORITY</div>
                <div className="todo-list">
                  {plannerSettings.priorities.map((pText, idx) => (
                    <div key={idx} className="todo-item">
                      <div className="checkbox-square" />
                      <input
                        type="text"
                        className="sidebar-input"
                        aria-label={`Top priority ${idx + 1}`}
                        value={pText}
                        onChange={(e) => {
                          const updated = [...plannerSettings.priorities];
                          updated[idx] = e.target.value;
                          handleQueueSettingsSave({ ...plannerSettings, priorities: updated });
                        }}
                        onBlur={() => void flushPendingSettingsSave()}
                      />
                    </div>
                  ))}
                </div>
              </Box>

              {/* HABITS Tracker Section */}
              <Box className="sidebar-section">
                <div className="sidebar-header-badge">HABITS</div>
                <table className="habits-table">
                  <thead>
                    <tr>
                      <th className="habit-name-head"></th>
                      <th>S</th>
                      <th>M</th>
                      <th>T</th>
                      <th>W</th>
                      <th>T</th>
                      <th>F</th>
                      <th>S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayHabits.map((habit) => (
                      <tr key={habit.id}>
                        <td className="habit-title-cell">{habit.title}</td>
                        {Array.from({ length: 7 }).map((_, bIdx) => (
                          <td key={bIdx} className="bubble-cell">
                            <div className="bubble-circle" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>

              {/* FOR NEXT MONTH Section */}
              <Box className="sidebar-section sidebar-section-grow">
                <div className="sidebar-header-badge">FOR NEXT MONTH</div>
                <textarea
                  className="sidebar-textarea sidebar-textarea-next-month"
                  aria-label="For next month notes"
                  value={plannerSettings.for_next_month}
                  onChange={(e) =>
                    handleQueueSettingsSave({ ...plannerSettings, for_next_month: e.target.value })
                  }
                  onBlur={() => void flushPendingSettingsSave()}
                  rows={4}
                />
              </Box>

              {/* NOTES Section (shows Activity Supplies Needed above the Notes text box) */}
              <Box className="sidebar-section sidebar-section-grow">
                <div className="sidebar-header-badge">NOTES</div>
                {weekActivitySupplies.length > 0 && (
                  <Box
                    className="activity-supplies-box"
                    sx={{
                      px: 0.75,
                      py: 0.6,
                      mb: 0.5,
                      borderBottom: '1px dashed rgba(0, 0, 0, 0.25)',
                      bgcolor: 'rgba(46, 125, 50, 0.06)',
                      fontSize: '0.66rem',
                      lineHeight: 1.3,
                      color: '#111',
                    }}
                  >
                    <div
                      className="activity-supplies-title"
                      style={{
                        fontWeight: 800,
                        fontSize: '0.64rem',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: '#1b5e20',
                        marginBottom: 3,
                      }}
                    >
                      Activity Supplies Needed
                    </div>
                    {weekActivitySupplies.map((supEntry) => (
                      <div key={supEntry.id} className="activity-supplies-item" style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 700 }}>
                          • {supEntry.weekdayLabel.slice(0, 3)}
                          {supEntry.classNumber ? ` (Class ${supEntry.classNumber})` : ''} —{' '}
                          {supEntry.activityName}:
                        </div>
                        <div style={{ paddingLeft: 8, color: '#222' }}>
                          {supEntry.supplies.join(', ')}
                        </div>
                      </div>
                    ))}
                  </Box>
                )}
                <textarea
                  className="sidebar-textarea sidebar-textarea-notes"
                  aria-label="Weekly notes"
                  value={plannerSettings.notes.replace(/\n*\[Activity Supplies\][\s\S]*$/i, '').trim()}
                  onChange={(e) =>
                    handleQueueSettingsSave({ ...plannerSettings, notes: e.target.value })
                  }
                  onBlur={() => void flushPendingSettingsSave()}
                  rows={weekActivitySupplies.length > 0 ? 4 : 6}
                />
              </Box>
            </Box>
          </Box>
          </div>
        </Box>
      </Box>

      {/* SCREEN-ONLY UNIFIED 5-DAY (MON-FRI) GRID VIEW (Hidden when printing) */}
      {screenViewMode === 'five_day' && (
        <Box className="no-print planner-print-root">
          <Box className="print-page" sx={{ minHeight: 'auto', mb: 3 }}>
            <Box className="planner-header" sx={{ justifyContent: 'space-between !important', px: '16px !important' }}>
              <Box display="flex" alignItems="center">
                <Typography
                  component="span"
                  sx={{
                    fontFamily: "'Raleway', sans-serif",
                    fontWeight: 400,
                    fontSize: '20px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#151821',
                    lineHeight: 1,
                  }}
                >
                  WEEKLY
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: "'Sacramento', cursive",
                    fontWeight: 400,
                    fontSize: '36px',
                    color: '#151821',
                    lineHeight: 1,
                    ml: 1.5,
                    mt: '-4px',
                  }}
                >
                  Assignments
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} className="week-header-text">
                WEEK OF: {weekStartDate} (MON–FRI UNIFIED VIEW)
              </Typography>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <table className="planner-table" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th className="subject-header-col">SUBJECT</th>
                    {weekDates.map((d, idx) => (
                      <th
                        key={d.dateStr}
                        className={`day-header-col ${idx === weekDates.length - 1 ? 'friday-col' : ''}`}
                      >
                        {d.dayName} [{d.formatted}]
                      </th>
                    ))}
                  </tr>
                  <tr className="all-day-events-row" style={{ height: syncedAllDayMinHeight }}>
                    <td className="all-day-label-cell">HOLIDAYS &amp; TASKS</td>
                    {weekDates.map((d) => {
                      const dayHolidays = holidays.filter((h) => h.holiday_date === d.dateStr);
                      const dayTasks = tasksList.filter((t) => t.due_date === d.dateStr);
                      const dayGoogleEvents = googleEvents.filter((g) => g.event_date === d.dateStr);
                      const hasEvents =
                        dayHolidays.length > 0 || dayTasks.length > 0 || dayGoogleEvents.length > 0;

                      return (
                        <td
                          key={d.dateStr}
                          className="all-day-events-cell"
                          style={{ height: syncedAllDayMinHeight }}
                        >
                          <div
                            className="all-day-items-wrapper"
                            style={{ minHeight: syncedAllDayMinHeight }}
                          >
                            {dayHolidays.map((h) => (
                              <div
                                key={h.id}
                                className="holiday-banner-top"
                                style={{ backgroundColor: branding.holidays.color }}
                                title={h.title}
                              >
                                <ItemIcon
                                  name={branding.holidays.icon}
                                  size={10}
                                  color="#ffffff"
                                  style={{ marginRight: 3, flexShrink: 0 }}
                                />
                                <span className="banner-text">{h.title}</span>
                              </div>
                            ))}
                            {dayGoogleEvents.map((g) => (
                              <div
                                key={g.id}
                                className="task-banner-top"
                                style={{ backgroundColor: g.color || '#4285F4' }}
                                title={g.title}
                              >
                                <ItemIcon
                                  name="Calendar"
                                  size={10}
                                  color="#ffffff"
                                  style={{ marginRight: 3, flexShrink: 0 }}
                                />
                                <span className="banner-text">{g.title}</span>
                              </div>
                            ))}
                            {dayTasks.map((t) => (
                              <div
                                key={t.id}
                                className="task-banner-top"
                                style={{ backgroundColor: branding.tasks.color }}
                                title={t.title}
                              >
                                <ItemIcon
                                  name={branding.tasks.icon}
                                  size={10}
                                  color="#ffffff"
                                  style={{ marginRight: 3, flexShrink: 0 }}
                                />
                                <span className="banner-text">
                                  {t.status === 'completed' ? '✓' : '☐'} {t.title}
                                </span>
                              </div>
                            ))}
                            {!hasEvents && <div className="all-day-empty">—</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displaySubjects.map((subject) => {
                    const subCfg = parseRecurringConfig(subject.recurring_config, subject.name);
                    const officialSubtitle = getOfficialCourseSubtitle(subCfg);
                    return (
                      <tr key={subject.id}>
                        <td className="subject-name-cell">
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ lineHeight: 1.2, color: '#0f172a' }}
                          >
                            {subject.name}
                          </Typography>
                          {officialSubtitle && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                fontStyle: 'italic',
                                fontWeight: 500,
                                fontSize: '0.66rem',
                                color: '#475569',
                                lineHeight: 1.15,
                                mt: 0.25,
                              }}
                            >
                              {officialSubtitle}
                            </Typography>
                          )}
                          {subject.link && (
                            <Typography
                              component="a"
                              href={subject.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="no-print"
                              sx={{
                                display: 'inline-block',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: '#0284c7',
                                textDecoration: 'none',
                                mt: 0.35,
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {subject.link.includes('zoom.us')
                                ? 'Zoom Link ↗'
                                : subject.link.includes('adobeconnect.com')
                                ? 'Live Classroom ↗'
                                : 'Class Link ↗'}
                            </Typography>
                          )}
                        </td>
                        {weekDates.map((d) => {
                          const cellSchoolAssignments = schoolAssignments.filter(
                            (a) =>
                              a.subject_id === subject.id &&
                              a.due_date === d.dateStr &&
                              a.workflow_status !== 'staged'
                          );
                          const isSelectedCell =
                            openCellModal &&
                            selectedSubject?.id === subject.id &&
                            selectedDate === d.dateStr;

                          return (
                            <td
                              key={d.dateStr}
                              className={`assignment-cell ${isSelectedCell ? 'active-cell-screen' : ''}`}
                              tabIndex={0}
                              role="button"
                              aria-label={`${subject.name}, ${d.dayName} ${d.formatted}`}
                              onClick={() => handleOpenCellEditor(subject, d.dateStr)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleOpenCellEditor(subject, d.dateStr);
                                }
                              }}
                            >
                              {(() => {
                                const squareNotes = parentNotes.filter(
                                  (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                                );
                                if (squareNotes.length === 0) return null;
                                return squareNotes.map((noteItem) => (
                                  <Box key={noteItem.id} className="parent-note-item" sx={{ mb: 1 }}>
                                    <FormattedParentNote
                                      noteId={noteItem.id}
                                      title={noteItem.title}
                                      description={noteItem.description}
                                      color={branding.notes.color}
                                      iconName={branding.notes.icon}
                                      parentNoteColor={branding.parentNotes.color}
                                      parentNoteIconName={branding.parentNotes.icon}
                                      onToggleCheckbox={handleToggleParentNoteCheckbox}
                                    />
                                  </Box>
                                ));
                              })()}
                              {cellSchoolAssignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="school-assignment-item"
                                  style={{ color: branding.assignments.color, cursor: 'pointer' }}
                                  onClick={(e) => handleOpenAssignmentFromPlanner(a, e)}
                                  title="Click to grade or edit assignment"
                                >
                                  <ItemIcon
                                    name={branding.assignments.icon}
                                    size={11}
                                    color={branding.assignments.color}
                                    style={{ marginRight: 4, display: 'inline' }}
                                  />
                                  [{a.category.toUpperCase()}] {a.title}
                                  {typeof a.percentage_score === 'number'
                                    ? ` • ${a.percentage_score.toFixed(0)}%`
                                    : ''}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>

            {/* Bottom Binder Sidebar Strip in 5-Day Grid Mode */}
            <Grid container spacing={2.5} sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Grid item xs={12} sm={6} md={3}>
                <div className="sidebar-header-badge">TO DO</div>
                <div className="todo-list">
                  {plannerSettings.todos.map((todoText, idx) => (
                    <div key={idx} className="todo-item">
                      <div className="checkbox-square" />
                      <input
                        type="text"
                        className="sidebar-input"
                        aria-label={`To-Do item ${idx + 1}`}
                        value={todoText}
                        onChange={(e) => {
                          const updated = [...plannerSettings.todos];
                          updated[idx] = e.target.value;
                          handleQueueSettingsSave({ ...plannerSettings, todos: updated });
                        }}
                        onBlur={() => void flushPendingSettingsSave()}
                      />
                    </div>
                  ))}
                </div>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box mb={2}>
                  <div className="sidebar-header-badge">TOP 3 PRIORITY</div>
                  <div className="todo-list">
                    {plannerSettings.priorities.map((pText, idx) => (
                      <div key={idx} className="todo-item">
                        <div className="checkbox-square" />
                        <input
                          type="text"
                          className="sidebar-input"
                          aria-label={`Top priority ${idx + 1}`}
                          value={pText}
                          onChange={(e) => {
                            const updated = [...plannerSettings.priorities];
                            updated[idx] = e.target.value;
                            handleQueueSettingsSave({ ...plannerSettings, priorities: updated });
                          }}
                          onBlur={() => void flushPendingSettingsSave()}
                        />
                      </div>
                    ))}
                  </div>
                </Box>
                <Box>
                  <div className="sidebar-header-badge">HABITS</div>
                  <table className="habits-table">
                    <thead>
                      <tr>
                        <th className="habit-name-head"></th>
                        <th>S</th>
                        <th>M</th>
                        <th>T</th>
                        <th>W</th>
                        <th>T</th>
                        <th>F</th>
                        <th>S</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayHabits.map((habit) => (
                        <tr key={habit.id}>
                          <td className="habit-title-cell">{habit.title}</td>
                          {Array.from({ length: 7 }).map((_, bIdx) => (
                            <td key={bIdx} className="bubble-cell">
                              <div className="bubble-circle" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <div className="sidebar-header-badge">FOR NEXT MONTH</div>
                <textarea
                  className="sidebar-textarea sidebar-textarea-next-month"
                  aria-label="For next month notes"
                  value={plannerSettings.for_next_month}
                  onChange={(e) =>
                    handleQueueSettingsSave({ ...plannerSettings, for_next_month: e.target.value })
                  }
                  onBlur={() => void flushPendingSettingsSave()}
                  rows={6}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <div className="sidebar-header-badge">NOTES</div>
                {weekActivitySupplies.length > 0 && (
                  <Box
                    sx={{
                      px: 0.75,
                      py: 0.6,
                      mb: 0.5,
                      borderBottom: '1px dashed rgba(0, 0, 0, 0.25)',
                      bgcolor: 'rgba(46, 125, 50, 0.06)',
                      fontSize: '0.66rem',
                      lineHeight: 1.3,
                      color: '#111',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.64rem',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: '#1b5e20',
                        marginBottom: 3,
                      }}
                    >
                      Activity Supplies Needed
                    </div>
                    {weekActivitySupplies.map((supEntry) => (
                      <div key={supEntry.id} style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 700 }}>
                          • {supEntry.weekdayLabel.slice(0, 3)}
                          {supEntry.classNumber ? ` (Class ${supEntry.classNumber})` : ''} —{' '}
                          {supEntry.activityName}:
                        </div>
                        <div style={{ paddingLeft: 8, color: '#222' }}>
                          {supEntry.supplies.join(', ')}
                        </div>
                      </div>
                    ))}
                  </Box>
                )}
                <textarea
                  className="sidebar-textarea sidebar-textarea-notes"
                  aria-label="Weekly notes"
                  value={plannerSettings.notes.replace(/\n*\[Activity Supplies\][\s\S]*$/i, '').trim()}
                  onChange={(e) =>
                    handleQueueSettingsSave({ ...plannerSettings, notes: e.target.value })
                  }
                  onBlur={() => void flushPendingSettingsSave()}
                  rows={weekActivitySupplies.length > 0 ? 4 : 6}
                />
              </Grid>
            </Grid>
          </Box>
        </Box>
      )}

      {/* CELL PARENT NOTES & ASSIGNMENT EDITOR SIDE PANEL (React 19 safe, no MUI Modal/Slide ref access) */}
      {openCellModal && (
        <Box
          className="no-print"
          sx={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: { xs: '100%', sm: 460, md: 500 },
            zIndex: 1300,
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Drawer Header with Subject & Day Steppers */}
          <Box
            px={3}
            py={1.75}
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <Box
              display="flex"
              alignItems="flex-start"
              justifyContent="space-between"
              gap={1}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: selectedSubject?.color || 'primary.main',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="h6" fontWeight={700} fontSize="1.125rem" color="text.primary" noWrap>
                    {selectedSubject?.name}
                  </Typography>
                  {selectedSubject?.link && (
                    <Chip
                      label={
                        selectedSubject.link.includes('zoom.us')
                          ? 'Zoom Link ↗'
                          : selectedSubject.link.includes('adobeconnect.com')
                          ? 'Live Classroom ↗'
                          : 'Class Link ↗'
                      }
                      size="small"
                      color="info"
                      variant="outlined"
                      component="a"
                      href={selectedSubject.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.25}>
                  {weekDates.find((wd) => wd.dateStr === selectedDate)?.dayName || ''} · {selectedDate}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center">
                {!isFormOpen && (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleAddNewNoteForm('school_work')}
                      startIcon={<Plus size={15} />}
                      sx={{
                        fontWeight: 700,
                        px: 1.25,
                        borderRadius: 1,
                        textTransform: 'none',
                        bgcolor: branding.notes.color,
                        color: '#ffffff',
                        '&:hover': { bgcolor: branding.notes.color, opacity: 0.9 },
                      }}
                    >
                      School Work
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleAddNewNoteForm('parent_note')}
                      startIcon={<ItemIcon name={branding.parentNotes.icon} size={14} color="#ffffff" />}
                      sx={{
                        fontWeight: 700,
                        px: 1.25,
                        borderRadius: 1,
                        textTransform: 'none',
                        bgcolor: branding.parentNotes.color,
                        color: '#ffffff',
                        '&:hover': { bgcolor: branding.parentNotes.color, opacity: 0.9 },
                      }}
                    >
                      Parent Note
                    </Button>
                  </>
                )}
                <IconButton
                  size="small"
                  aria-label="Close cell panel"
                  onClick={() => setOpenCellModal(false)}
                >
                  <X size={20} />
                </IconButton>
              </Stack>
            </Box>

            {/* Quick Day & Subject Steppers (no need to close drawer to move across the week or down subjects) */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              mt={1.25}
              pt={1.25}
              sx={{ borderTop: '1px dashed', borderColor: 'divider' }}
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={weekDates.findIndex((wd) => wd.dateStr === selectedDate) <= 0}
                  onClick={() => handleStepCellDay(-1)}
                  startIcon={<ChevronLeft size={14} />}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1 }}
                >
                  Prev Day
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={
                    weekDates.findIndex((wd) => wd.dateStr === selectedDate) >=
                    weekDates.length - 1
                  }
                  onClick={() => handleStepCellDay(1)}
                  endIcon={<ChevronRight size={14} />}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1 }}
                >
                  Next Day
                </Button>
              </Stack>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={
                    !selectedSubject ||
                    subjects.findIndex((s) => s.id === selectedSubject.id) <= 0
                  }
                  onClick={() => handleStepCellSubject(-1)}
                  startIcon={<ChevronUp size={14} />}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1 }}
                >
                  Prev Subject
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={
                    !selectedSubject ||
                    subjects.findIndex((s) => s.id === selectedSubject.id) >=
                      subjects.length - 1
                  }
                  onClick={() => handleStepCellSubject(1)}
                  endIcon={<ChevronDown size={14} />}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1 }}
                >
                  Next Subject
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Drawer Body Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {/* Quick API Syllabus Week Selector (with 2-Week Span notice when Day 1 starts mid-week) */}
            {selectedSubject &&
              (() => {
                const subCfg = parseRecurringConfig(
                  selectedSubject.recurring_config,
                  selectedSubject.name
                );
                const activeSyl = getActiveCourseSyllabus(subCfg);
                const apiWeeks =
                  activeSyl?.source_type === 'api_sync' && Array.isArray(activeSyl?.weeks)
                    ? activeSyl.weeks
                    : [];
                if (apiWeeks.length === 0) return null;

                const subOverride = plannerSettings.subject_overrides[selectedSubject.id];
                const subResolved = resolveSubjectCountersForWeek(
                  subCfg,
                  weekStartDate,
                  subOverride
                );
                const syllabusStartDay = getApiSyllabusWeekStartDay(activeSyl?.api_auto_populate);
                const spansTwoWeeks = syllabusStartDay !== 'monday';
                const prevWeekdays = spansTwoWeeks
                  ? getPreviousWeekdaysBeforeStartDay(
                      syllabusStartDay,
                      activeSyl?.api_auto_populate
                    )
                  : [];
                const cellDayKey =
                  weekDates.find((wd) => wd.dateStr === selectedDate)?.dayKey || 'monday';
                const resolvedForCell = resolveApiSyllabusWeekForWeekday(
                  apiWeeks,
                  subResolved.week_num,
                  cellDayKey,
                  activeSyl?.api_auto_populate
                );

                return (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      mb: 2.5,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={1.25}
                      flexWrap="wrap"
                      gap={1}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: selectedSubject.color || 'primary.main',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="subtitle2" fontWeight={700}>
                          {selectedSubject.name} — Syllabus Week Selector
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        color={resolvedForCell.isFromPreviousWeek ? 'warning' : 'primary'}
                        variant="outlined"
                        label={
                          spansTwoWeeks
                            ? `${DAY_LABELS[cellDayKey]} pulls from Week ${resolvedForCell.weekNumber}${
                                resolvedForCell.isFromPreviousWeek ? ' (Prev Wk)' : ' (New Wk Day 1)'
                              }`
                            : `Week ${resolvedForCell.weekNumber}`
                        }
                        sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: 1 }}
                      />
                    </Stack>

                    <TextField
                      select
                      size="small"
                      label={
                        spansTwoWeeks
                          ? `Selected Binder Syllabus Week (Starts ${DAY_LABELS[syllabusStartDay]})`
                          : 'Selected Binder Syllabus Week'
                      }
                      value={subResolved.week_num}
                      onChange={(e) => {
                        const nextWeekNum = Math.max(1, parseInt(e.target.value, 10) || 1);
                        handleUpdateSubjectOverride(
                          selectedSubject.id,
                          {
                            week_num: nextWeekNum,
                            lesson_num: nextWeekNum,
                          },
                          true
                        );
                      }}
                      fullWidth
                      SelectProps={{ native: true }}
                      sx={{ bgcolor: 'background.paper' }}
                    >
                      {apiWeeks.map((wk) => {
                        const prevWk = Math.max(1, wk.week_number - 1);
                        const spanLabel = spansTwoWeeks
                          ? wk.week_number > 1
                            ? ` — Starts ${DAY_LABELS[syllabusStartDay]} (Prev days from Week ${prevWk})`
                            : ` — Starts ${DAY_LABELS[syllabusStartDay]}`
                          : '';
                        return (
                          <option key={wk.week_number} value={wk.week_number}>
                            Week {wk.week_number}
                            {spanLabel}
                            {wk.section_title && wk.section_title !== `Week ${wk.week_number}`
                              ? ` (${wk.section_title})`
                              : ''}
                          </option>
                        );
                      })}
                    </TextField>

                    {spansTwoWeeks && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 1, fontSize: '0.74rem', lineHeight: 1.4 }}
                      >
                        <strong>Note:</strong> This class starts its syllabus week on{' '}
                        <strong>{DAY_LABELS[syllabusStartDay]} (Day 1)</strong>. When{' '}
                        <strong>Week {subResolved.week_num}</strong> is selected for this binder
                        week,{' '}
                        <strong>
                          {prevWeekdays.map((dk) => DAY_LABELS[dk]).join(', ')}
                        </strong>{' '}
                        automatically pull from{' '}
                        <strong>Week {Math.max(1, subResolved.week_num - 1)}</strong> (the previous
                        week in the syllabus), and <strong>{DAY_LABELS[syllabusStartDay]}</strong>{' '}
                        starts <strong>Week {subResolved.week_num}</strong>.
                      </Typography>
                    )}
                  </Paper>
                );
              })()}

            {/* Quick Syllabus Day / Class Selector for Class-Based Syllabi (Scoped to This Day by default) */}
            {selectedSubject &&
              (() => {
                const subCfg = parseRecurringConfig(
                  selectedSubject.recurring_config,
                  selectedSubject.name
                );
                const activeSyl = getActiveCourseSyllabus(subCfg);
                const allSyllabi = getSubjectCourseSyllabi(subCfg);
                const classDays =
                  subCfg.mode === 'template' &&
                  activeSyl &&
                  Array.isArray(activeSyl.days) &&
                  activeSyl.days.length > 0
                    ? activeSyl.days
                    : [];
                if (classDays.length === 0) return null;

                const subOverride = plannerSettings.subject_overrides[selectedSubject.id];
                const subResolved = resolveSubjectCountersForWeek(
                  subCfg,
                  weekStartDate,
                  subOverride
                );
                const dayIndexInWeek = Math.max(
                  0,
                  weekDates.findIndex((wd) => wd.dateStr === selectedDate)
                );
                const defaultCellClassNum = subResolved.class_num + Math.min(2, dayIndexInWeek);

                const weekOptionsMap = new Map<
                  number,
                  { firstClass: number; lastClass: number; unit: string }
                >();
                classDays.forEach((cd, idx) => {
                  const wk = cd.week_number ?? Math.ceil((idx + 1) / 3);
                  const existing = weekOptionsMap.get(wk);
                  if (!existing) {
                    weekOptionsMap.set(wk, {
                      firstClass: cd.day_number,
                      lastClass: cd.day_number,
                      unit: cd.unit || '',
                    });
                  } else {
                    existing.lastClass = cd.day_number;
                  }
                });

                const currentSelectedDayObj = classDays.find(
                  (d) => d.day_number === defaultCellClassNum
                );
                const currentDaySupplies = currentSelectedDayObj
                  ? resolveSyllabusDaySupplies(currentSelectedDayObj)
                  : [];

                return (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      mb: 2.5,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={1.25}
                      flexWrap="wrap"
                      gap={1}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: selectedSubject.color || 'success.main',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="subtitle2" fontWeight={700}>
                          {activeSyl?.course_title || `${selectedSubject.name} Syllabus`}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={`Week ${subResolved.week_num} · Class ${defaultCellClassNum}`}
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
                    </Stack>

                    <Stack spacing={1.25}>
                      {/* Primary Cell Action: Populate This Day Only */}
                      <TextField
                        select
                        size="small"
                        label={`Populate This Day Only (${selectedDate}) — Select Class`}
                        value={defaultCellClassNum}
                        onChange={async (e) => {
                          const chosenClassNum = Math.max(1, parseInt(e.target.value, 10) || 1);
                          const chosenDay = classDays.find(
                            (d) => d.day_number === chosenClassNum
                          );
                          if (!chosenDay || !selectedDate) return;
                          const wkNum =
                            chosenDay.week_number ?? Math.ceil(chosenDay.day_number / 3);
                          const lines = [
                            `- [ ] Week ${wkNum}, Class ${chosenDay.day_number}: ${chosenDay.topic}`,
                          ];
                          if (chosenDay.activity) {
                            lines.push(`- [ ] Activity: ${chosenDay.activity}`);
                          }
                          const newDesc = lines.join('\n');
                          setCellNoteDesc(newDesc);

                          const existingCellNotes = parentNotes.filter(
                            (n) =>
                              n.subject_id === selectedSubject.id &&
                              n.note_date === selectedDate
                          );
                          const nowIso = new Date().toISOString();
                          if (existingCellNotes.length > 0) {
                            const targetId = existingCellNotes[0].id;
                            await supabase
                              .from('parent_notes')
                              .update({
                                description: newDesc,
                                updated_by: activeUserName,
                                updated_at: nowIso,
                              })
                              .eq('id', targetId);
                            setParentNotes((prev) =>
                              prev.map((n) =>
                                n.id === targetId
                                  ? { ...n, description: newDesc, updated_at: nowIso }
                                  : n
                              )
                            );
                          } else {
                            const { data: inserted } = await supabase
                              .from('parent_notes')
                              .insert({
                                subject_id: selectedSubject.id,
                                note_date: selectedDate,
                                title: null,
                                description: newDesc,
                                created_by: activeUserName,
                                updated_by: activeUserName,
                                updated_at: nowIso,
                              })
                              .select('*')
                              .single();
                            if (inserted) {
                              setParentNotes((prev) => [...prev, inserted as ParentNote]);
                            }
                          }

                          // If this class has an Activity, also link/create the Activity assignment on the SAME day of the week (selectedDate)
                          if (chosenDay.activity) {
                            const actSupplies = resolveSyllabusDaySupplies(chosenDay);
                            const matchedDayObj = weekDates.find((wd) => wd.dateStr === selectedDate);
                            const weekdayKey: DayKey = matchedDayObj?.dayKey || 'monday';
                            const actTitle = `Activity: ${chosenDay.activity}`;
                            const actDesc = `Week ${wkNum}, Class ${chosenDay.day_number}: ${chosenDay.topic} — Hands-on Activity: ${chosenDay.activity}`;
                            const actInstructions =
                              actSupplies.length > 0
                                ? `Supplies Needed: ${actSupplies.join(', ')}`
                                : chosenDay.materials || null;
                            const actMeta = {
                              moodle_category: 'Activity',
                              week_number: wkNum,
                              class_number: chosenDay.day_number,
                              class_topic: chosenDay.topic,
                              activity_name: chosenDay.activity,
                              supplies: actSupplies,
                              weekday: weekdayKey,
                              official_portal_open_date: weekStartDate,
                              official_portal_due_date: selectedDate,
                            };

                            const existingAct = schoolAssignments.find(
                              (a) =>
                                a.subject_id === selectedSubject.id &&
                                a.due_date === selectedDate &&
                                a.category === 'activity'
                            );
                            if (existingAct) {
                              const { data: updatedAct } = await supabase
                                .from('assignments')
                                .update({
                                  title: actTitle,
                                  description: actDesc,
                                  instructions: actInstructions,
                                  syllabus_day_number: chosenDay.day_number,
                                  state_standards: JSON.parse(JSON.stringify(actMeta)) as Json,
                                })
                                .eq('id', existingAct.id)
                                .select('*')
                                .single();
                              if (updatedAct) {
                                setSchoolAssignments((prev) =>
                                  prev.map((a) =>
                                    a.id === existingAct.id ? (updatedAct as SchoolAssignment) : a
                                  )
                                );
                              }
                            } else {
                              const { data: insertedAct } = await supabase
                                .from('assignments')
                                .insert({
                                  subject_id: selectedSubject.id,
                                  title: actTitle,
                                  description: actDesc,
                                  instructions: actInstructions,
                                  due_date: selectedDate,
                                  assigned_date: weekStartDate,
                                  category: 'activity',
                                  grading_mode: 'completion',
                                  points_possible: 100,
                                  estimated_minutes: 30,
                                  workflow_status: 'active',
                                  status: 'pending',
                                  is_graded: true,
                                  source_type: 'recurring_template',
                                  syllabus_day_number: chosenDay.day_number,
                                  state_standards: JSON.parse(JSON.stringify(actMeta)) as Json,
                                  term_name: 'Full Year 2026-2027',
                                  academic_year: '2026-2027',
                                })
                                .select('*')
                                .single();
                              if (insertedAct) {
                                setSchoolAssignments((prev) => [
                                  ...prev,
                                  insertedAct as SchoolAssignment,
                                ]);
                              }
                            }
                          }

                          toast.success(
                            chosenDay.activity
                              ? `Populated Class ${chosenDay.day_number} + Activity (${chosenDay.activity}) on ${selectedDate}!`
                              : `Populated Class ${chosenDay.day_number} into ${selectedSubject.name} (${selectedDate})!`
                          );
                        }}
                        fullWidth
                        SelectProps={{ native: true }}
                      >
                        {classDays.map((cd) => (
                          <option key={cd.day_number} value={cd.day_number}>
                            Class {cd.day_number} (Wk {cd.week_number ?? Math.ceil(cd.day_number / 3)}):{' '}
                            {cd.topic.slice(0, 44)}
                            {cd.activity ? ` ★ [${cd.activity.slice(0, 24)}]` : ''}
                          </option>
                        ))}
                      </TextField>

                      {currentSelectedDayObj?.activity && (
                        <Box
                          sx={{
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'success.light',
                          }}
                        >
                          <Typography variant="caption" fontWeight={700} color="success.main" display="block">
                            Linked Activity (Same Weekday): {currentSelectedDayObj.activity}
                          </Typography>
                          {currentDaySupplies.length > 0 && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              <strong>Supplies Needed:</strong> {currentDaySupplies.join(', ')}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Secondary Progressive-Disclosure Toggle: Full-Week Schedule Override */}
                      <Box>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setShowFullWeekSyllabusInCell((prev) => !prev)}
                          endIcon={
                            showFullWeekSyllabusInCell ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )
                          }
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            p: 0,
                          }}
                        >
                          {showFullWeekSyllabusInCell
                            ? 'Hide Full-Week Syllabus Override'
                            : 'Adjust Full-Week Syllabus Schedule (Mon–Fri)…'}
                        </Button>

                        {showFullWeekSyllabusInCell && (
                          <Stack spacing={1.25} mt={1.25}>
                            {allSyllabi.length > 1 && (
                              <TextField
                                select
                                size="small"
                                label="Active Syllabus"
                                value={activeSyl?.id || allSyllabi[0].id || ''}
                                onChange={(e) =>
                                  handleSwitchActiveSyllabus(selectedSubject.id, e.target.value)
                                }
                                fullWidth
                                SelectProps={{ native: true }}
                              >
                                {allSyllabi.map((s, idx) => (
                                  <option key={s.id || idx} value={s.id || `syllabus-${idx + 1}`}>
                                    {s.course_title} ({s.days.length} classes)
                                  </option>
                                ))}
                              </TextField>
                            )}

                            <TextField
                              select
                              size="small"
                              label="Populate Full Week Schedule (Select Week 1–35)"
                              value={subResolved.week_num}
                              onChange={(e) => {
                                const nextWk = Math.max(1, parseInt(e.target.value, 10) || 1);
                                const wkMeta = weekOptionsMap.get(nextWk);
                                const firstCls = wkMeta ? wkMeta.firstClass : (nextWk - 1) * 3 + 1;
                                handleUpdateSubjectOverride(
                                  selectedSubject.id,
                                  { week_num: nextWk, class_num: firstCls },
                                  true
                                );
                              }}
                              fullWidth
                              SelectProps={{ native: true }}
                              helperText="Changes the week counter and refreshes all Mon/Wed/Fri cells for this subject."
                            >
                              {Array.from(weekOptionsMap.entries())
                                .sort((a, b) => a[0] - b[0])
                                .map(([wkNum, meta]) => (
                                  <option key={wkNum} value={wkNum}>
                                    Week {wkNum} (Classes {meta.firstClass}–{meta.lastClass})
                                    {meta.unit ? ` — ${meta.unit}` : ''}
                                  </option>
                                ))}
                            </TextField>
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })()}

            {/* Section 1: School Work & Parent Notes List / Form */}
            <Box mb={3}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1.5}
                flexWrap="wrap"
                gap={1}
              >
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" display="flex" alignItems="center" gap={1}>
                  <FileText size={18} />
                  School Work &amp; Parent Notes
                </Typography>

                {/* When auto-editing a single note, allow adding a second item or viewing all notes */}
                {isFormOpen && editingNoteId && (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddNewNoteForm('school_work')}
                      startIcon={<Plus size={13} />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        py: 0.25,
                        px: 1,
                        borderRadius: 1,
                      }}
                    >
                      Add 2nd Note
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<Sparkles size={13} />}
                      onClick={() => {
                        const targetNote = parentNotes.find((n) => n.id === editingNoteId);
                        if (!targetNote) return;
                        setUnifiedEditAssignment(null);
                        setUnifiedPromotedNote({
                          id: targetNote.id,
                          title: stripParentNoteMarker(targetNote.title),
                          description: stripParentNoteMarker(targetNote.description),
                          subject_id: targetNote.subject_id,
                          note_date: targetNote.note_date,
                        });
                        setOpenUnifiedModal(true);
                      }}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        py: 0.25,
                        px: 1,
                        borderRadius: 1,
                      }}
                    >
                      Promote to Graded
                    </Button>
                  </Stack>
                )}
              </Box>

              {/* IF FORM IS OPEN (creating new item or editing an existing item) */}
              {isFormOpen ? (
                <Box p={2.5} sx={{ bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    {editingNoteId
                      ? cellNoteCategory === 'parent_note'
                        ? 'Edit Parent Note'
                        : 'Edit School Work'
                      : cellNoteCategory === 'parent_note'
                      ? 'Add New Parent Note'
                      : 'Add New School Work'}
                  </Typography>

                  <Stack spacing={2}>
                    {/* Category Selector: School Work (Orange) vs Parent Note (Purple) */}
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.75}>
                        Item Category:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant={cellNoteCategory === 'school_work' ? 'contained' : 'outlined'}
                          onClick={() => setCellNoteCategory('school_work')}
                          startIcon={
                            <ItemIcon
                              name={branding.notes.icon}
                              size={14}
                              color={cellNoteCategory === 'school_work' ? '#ffffff' : branding.notes.color}
                            />
                          }
                          sx={{
                            flex: 1,
                            fontWeight: 700,
                            borderRadius: 1,
                            textTransform: 'none',
                            bgcolor: cellNoteCategory === 'school_work' ? branding.notes.color : 'transparent',
                            borderColor: branding.notes.color,
                            color: cellNoteCategory === 'school_work' ? '#ffffff' : branding.notes.color,
                            '&:hover': {
                              bgcolor: cellNoteCategory === 'school_work' ? branding.notes.color : 'action.hover',
                              borderColor: branding.notes.color,
                            },
                          }}
                        >
                          School Work
                        </Button>
                        <Button
                          size="small"
                          variant={cellNoteCategory === 'parent_note' ? 'contained' : 'outlined'}
                          onClick={() => setCellNoteCategory('parent_note')}
                          startIcon={
                            <ItemIcon
                              name={branding.parentNotes.icon}
                              size={14}
                              color={cellNoteCategory === 'parent_note' ? '#ffffff' : branding.parentNotes.color}
                            />
                          }
                          sx={{
                            flex: 1,
                            fontWeight: 700,
                            borderRadius: 1,
                            textTransform: 'none',
                            bgcolor: cellNoteCategory === 'parent_note' ? branding.parentNotes.color : 'transparent',
                            borderColor: branding.parentNotes.color,
                            color: cellNoteCategory === 'parent_note' ? '#ffffff' : branding.parentNotes.color,
                            '&:hover': {
                              bgcolor: cellNoteCategory === 'parent_note' ? branding.parentNotes.color : 'action.hover',
                              borderColor: branding.parentNotes.color,
                            },
                          }}
                        >
                          Parent Note (Syllabus)
                        </Button>
                      </Stack>
                    </Box>

                    {/* Header (Always Bold) */}
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        cellNoteCategory === 'parent_note'
                          ? 'Parent Note Header (Optional, Bold)'
                          : 'School Work Header (Always Bold)'
                      }
                      placeholder={
                        cellNoteCategory === 'parent_note'
                          ? 'e.g. Syllabus Adjustment, Skip Problems 11-15'
                          : 'e.g. Attend Class, Reading Assignment, Science Kit'
                      }
                      value={cellNoteHeader}
                      onChange={(e) => setCellNoteHeader(e.target.value)}
                      helperText="This title line will always display in bold font at the top of the item."
                    />

                    {/* Formatting Buttons for Body */}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Body Options:
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleInsertFormatting('bullet')}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: '0.78rem', borderRadius: 1 }}
                      >
                        • Bullet List
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => handleInsertFormatting('checkbox')}
                        startIcon={<CheckSquare size={14} />}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: '0.78rem', borderRadius: 1 }}
                      >
                        + Checkbox Item
                      </Button>
                    </Stack>

                    {/* Body */}
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label={
                        cellNoteCategory === 'parent_note'
                          ? 'Parent Note about the Syllabus'
                          : 'School Work Body (Bullets & Checkboxes)'
                      }
                      placeholder={
                        cellNoteCategory === 'parent_note'
                          ? 'e.g. Teacher moved Day 14 to Thursday; only complete odd numbers on p. 22.'
                          : 'e.g. • Read Chapters 4-5\n- [ ] Complete practice problems 1-10\n- [ ] Sign workbook page'
                      }
                      value={cellNoteDesc}
                      onChange={(e) => setCellNoteDesc(e.target.value)}
                    />

                    {/* Live Student Planner Preview */}
                    {(cellNoteHeader.trim() || cellNoteDesc.trim()) && (
                      <Box p={2} sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.75}>
                          Student Planner Preview:
                        </Typography>
                        {(() => {
                          const previewEncoded = encodePlannerNoteFields(
                            cellNoteHeader,
                            cellNoteDesc,
                            cellNoteCategory
                          );
                          return (
                            <FormattedParentNote
                              title={previewEncoded.title}
                              description={previewEncoded.description}
                              color={branding.notes.color}
                              iconName={branding.notes.icon}
                              parentNoteColor={branding.parentNotes.color}
                              parentNoteIconName={branding.parentNotes.icon}
                              interactive={false}
                            />
                          );
                        })()}
                      </Box>
                    )}

                    {/* Action buttons inside form */}
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" pt={1} flexWrap="wrap" useFlexGap>
                      <Box>
                        {editingNoteId && (
                          confirmDeleteNoteId === editingNoteId ? (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleDeleteSingleParentNote(editingNoteId)}
                                startIcon={<Trash2 size={14} />}
                                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', borderRadius: 1 }}
                              >
                                Confirm Delete
                              </Button>
                              <Button
                                size="small"
                                color="inherit"
                                onClick={() => setConfirmDeleteNoteId(null)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                              >
                                Keep
                              </Button>
                            </Stack>
                          ) : (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setConfirmDeleteNoteId(editingNoteId)}
                              startIcon={<Trash2 size={14} />}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1 }}
                            >
                              Delete Note
                            </Button>
                          )
                        )}
                      </Box>

                      <Stack direction="row" spacing={1.25} alignItems="center">
                        {parentNotes.filter((n) => n.subject_id === selectedSubject?.id && n.note_date === selectedDate).length > 1 && (
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => {
                              setEditingNoteId(null);
                              setCellNoteHeader('');
                              setCellNoteDesc('');
                              setIsFormOpen(false);
                              setConfirmDeleteNoteId(null);
                            }}
                            sx={{ textTransform: 'none' }}
                          >
                            All Notes ({parentNotes.filter((n) => n.subject_id === selectedSubject?.id && n.note_date === selectedDate).length})
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleSaveCellNote}
                          disabled={savingNote || (!cellNoteHeader.trim() && !cellNoteDesc.trim())}
                          startIcon={<Save size={16} />}
                          sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}
                        >
                          {savingNote
                            ? 'Saving...'
                            : editingNoteId
                            ? cellNoteCategory === 'parent_note'
                              ? 'Update Parent Note'
                              : 'Update School Work'
                            : cellNoteCategory === 'parent_note'
                            ? 'Save Parent Note'
                            : 'Save School Work'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                /* LIST VIEW OF EXISTING SCHOOL WORK & PARENT NOTES ON THIS SQUARE */
                <Stack spacing={2}>
                  {(() => {
                    const squareNotes = parentNotes.filter(
                      (n) => n.subject_id === selectedSubject?.id && n.note_date === selectedDate
                    );

                    return squareNotes.map((n, idx) => {
                      const itemCat = getPlannerNoteCategory(n.title, n.description);
                      const isPNote = itemCat === 'parent_note';
                      return (
                        <Card key={n.id} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <ItemIcon
                                name={isPNote ? branding.parentNotes.icon : branding.notes.icon}
                                size={13}
                                color={isPNote ? branding.parentNotes.color : branding.notes.color}
                              />
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                sx={{ color: isPNote ? branding.parentNotes.color : branding.notes.color }}
                              >
                                {isPNote ? 'Parent Note' : 'School Work'} #{idx + 1}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<Sparkles size={13} />}
                                onClick={() => {
                                  setUnifiedEditAssignment(null);
                                  setUnifiedPromotedNote({
                                    id: n.id,
                                    title: stripParentNoteMarker(n.title),
                                    description: stripParentNoteMarker(n.description),
                                    subject_id: n.subject_id,
                                    note_date: n.note_date,
                                  });
                                  setOpenUnifiedModal(true);
                                }}
                                sx={{ fontWeight: 700, fontSize: '0.75rem', py: 0.25, borderRadius: 1, textTransform: 'none' }}
                              >
                                Promote to Graded
                              </Button>
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label="Edit note"
                                onClick={() => handleStartEditNote(n)}
                              >
                                <Edit2 size={16} />
                              </IconButton>
                              {confirmDeleteNoteId === n.id ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={() => handleDeleteSingleParentNote(n.id)}
                                  sx={{ fontWeight: 700, fontSize: '0.75rem', py: 0.25, borderRadius: 1, textTransform: 'none' }}
                                >
                                  Confirm
                                </Button>
                              ) : (
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label="Delete note"
                                  onClick={() => setConfirmDeleteNoteId(n.id)}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              )}
                            </Stack>
                          </Box>

                          <FormattedParentNote
                            noteId={n.id}
                            title={n.title}
                            description={n.description}
                            color={branding.notes.color}
                            iconName={branding.notes.icon}
                            parentNoteColor={branding.parentNotes.color}
                            parentNoteIconName={branding.parentNotes.icon}
                            interactive={false}
                          />
                        </Card>
                      );
                    });
                  })()}

                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      onClick={() => handleAddNewNoteForm('school_work')}
                      startIcon={<ItemIcon name={branding.notes.icon} size={15} color={branding.notes.color} />}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 1,
                        textTransform: 'none',
                        borderColor: branding.notes.color,
                        color: branding.notes.color,
                        '&:hover': {
                          borderColor: branding.notes.color,
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      + Add School Work
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleAddNewNoteForm('parent_note')}
                      startIcon={<ItemIcon name={branding.parentNotes.icon} size={15} color={branding.parentNotes.color} />}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 1,
                        textTransform: 'none',
                        borderColor: branding.parentNotes.color,
                        color: branding.parentNotes.color,
                        '&:hover': {
                          borderColor: branding.parentNotes.color,
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      + Add Parent Note
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Section 2: School Assignments */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
              <Typography variant="subtitle2" fontWeight={700} color="success.main" display="flex" alignItems="center" gap={1}>
                <FileText size={18} />
                School Assignments &amp; Grades
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<Sliders size={14} />}
                  onClick={() => setOpenTypesManagerModal(true)}
                  sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1, textTransform: 'none' }}
                >
                  Assignment Types
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<Plus size={14} />}
                  onClick={() => {
                    setUnifiedEditAssignment(null);
                    setUnifiedPromotedNote(null);
                    setOpenUnifiedModal(true);
                  }}
                  sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1, textTransform: 'none' }}
                >
                  New Graded / Recurring
                </Button>
              </Stack>
            </Box>

            {/* Existing Assignments on this cell */}
            {(() => {
              const cellAssigns = schoolAssignments.filter(
                (a) => a.subject_id === selectedSubject?.id && a.due_date === selectedDate
              );
              if (cellAssigns.length === 0) return null;
              return (
                <Stack spacing={1} mb={2}>
                  {cellAssigns.map((ca) => (
                    <Paper
                      key={ca.id}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                          <Chip
                            label={ca.category}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                          />
                          <Typography variant="body2" fontWeight={700}>
                            {ca.title}
                          </Typography>
                          {ca.percentage_score != null && (
                            <Chip
                              label={`${ca.percentage_score.toFixed(1)}%`}
                              size="small"
                              color="success"
                              sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
                            />
                          )}
                        </Stack>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit2 size={13} />}
                        onClick={() => handleOpenAssignmentFromPlanner(ca)}
                        sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1, textTransform: 'none', flexShrink: 0 }}
                      >
                        Grade / Edit
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              );
            })()}

            {/* Progressive-Disclosure Quick Add Assignment Form */}
            <Box>
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => setShowQuickAddAssignment((prev) => !prev)}
                startIcon={showQuickAddAssignment ? <ChevronUp size={15} /> : <Plus size={15} />}
                sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: 1, textTransform: 'none' }}
              >
                {showQuickAddAssignment ? 'Hide Quick Add Assignment' : 'Quick Add Assignment'}
              </Button>

              {showQuickAddAssignment && (
                <Stack spacing={2} pt={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Quick Add Assignment Title"
                    placeholder="e.g. Math Worksheet 4B, History Essay"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      size="small"
                      label="Assignment Type"
                      value={assignmentCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isAssignmentCategory(val)) setAssignmentCategory(val);
                      }}
                      sx={{ flex: 1 }}
                    >
                      {assignmentTypes.length > 0 ? (
                        assignmentTypes.map((t) => (
                          <option key={t.slug} value={t.slug}>
                            {t.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="homework">Homework</option>
                          <option value="project">Project</option>
                          <option value="test">Test</option>
                          <option value="quiz">Quiz</option>
                          <option value="reading">Reading</option>
                          <option value="paper">Paper</option>
                        </>
                      )}
                    </TextField>
                    <TextField
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      size="small"
                      label="Priority"
                      value={assignmentPriority}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isAssignmentPriority(val)) setAssignmentPriority(val);
                      }}
                      sx={{ flex: 1 }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </TextField>
                  </Stack>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleCreateCellAssignment}
                    disabled={savingAssignment || !assignmentTitle.trim()}
                    startIcon={<Plus size={16} />}
                    sx={{ fontWeight: 700, alignSelf: 'flex-start', borderRadius: 1, textTransform: 'none' }}
                  >
                    {savingAssignment ? 'Adding...' : 'Add Assignment'}
                  </Button>
                </Stack>
              )}
            </Box>
          </Box>

          {/* Drawer Footer */}
          <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpenCellModal(false)} variant="outlined" color="inherit" sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none' }}>
              Close Panel
            </Button>
          </Box>
        </Box>
      )}

      {/* POPULATE PLACEHOLDERS & PULL FORWARD PREVIOUS WEEK MODAL (React 19 safe) */}
      {openPopulateModal && (
        <Box
          className="no-print"
          onClick={() => setOpenPopulateModal(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              px={3}
              py={2}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                {populateModalMode === 'populate_and_pull' ? (
                  <Sparkles size={20} color={theme.palette.primary.main} />
                ) : (
                  <Copy size={20} color={theme.palette.primary.main} />
                )}
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {populateModalMode === 'populate_and_pull'
                      ? populateOverwriteExisting
                        ? 'Sync / Overwrite Week Placeholders'
                        : 'Populate Week Placeholders'
                      : "Pull Forward Previous Week's Sidebar"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Target Week: <strong>{formatWeekRangeLabel()}</strong> · Previous Week: <strong>{prevWeekDateStr}</strong>
                  </Typography>
                </Box>
              </Stack>
              <IconButton
                size="small"
                aria-label="Close populate modal"
                onClick={() => setOpenPopulateModal(false)}
              >
                <X size={18} />
              </IconButton>
            </Box>

            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              {populateModalMode === 'populate_and_pull' && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Subject Placeholders &amp; Recurring Graded Assignments ({getWeekSequenceSummary()})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {populateOverwriteExisting
                      ? 'Existing recurring subject notes in this week will be refreshed with the selected Week # and Math Days, and any missing recurring graded assignments for this week will be generated.'
                      : 'Empty subject cells in this week will be populated from your active subject recurring rules, and any recurring graded assignments for this week will be generated automatically.'}
                  </Typography>
                </Paper>
              )}

              <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                Pull Forward Sidebar Sections from Previous Week ({prevWeekDateStr})
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Check the sections below that you want to copy forward from last week into this week&apos;s right-page binder sidebar. Review the preview of each section before confirming:
              </Typography>

              {loadingPrevWeekSettings ? (
                <Box display="flex" alignItems="center" gap={1.5} py={3} justifyContent="center">
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Loading previous week&apos;s sidebar content…
                  </Typography>
                </Box>
              ) : !prevWeekSettings ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No saved sidebar items (To-Do, Top 3, For Next Month, or Notes) were found for the previous week ({prevWeekDateStr}).
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.5}>
                  {/* 1. To-Do List Preview */}
                  {(() => {
                    const nonEmptyTodos = prevWeekSettings.todos.filter((t) => t.trim().length > 0);
                    return (
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={pullTodos}
                              disabled={nonEmptyTodos.length === 0}
                              onChange={(e) => setPullTodos(e.target.checked)}
                            />
                          }
                          label={
                            <Typography variant="subtitle2" fontWeight={700}>
                              To-Do List ({nonEmptyTodos.length} item{nonEmptyTodos.length === 1 ? '' : 's'})
                            </Typography>
                          }
                        />
                        <Box sx={{ pl: 3.5 }}>
                          {nonEmptyTodos.length > 0 ? (
                            <Stack spacing={0.25}>
                              {nonEmptyTodos.map((item, idx) => (
                                <Typography key={idx} variant="caption" color="text.secondary">
                                  ☐ {item}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              (Empty in previous week)
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })()}

                  {/* 2. Top 3 Priorities Preview */}
                  {(() => {
                    const nonEmptyPriorities = prevWeekSettings.priorities.filter(
                      (p) => p.trim().length > 0
                    );
                    return (
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={pullPriorities}
                              disabled={nonEmptyPriorities.length === 0}
                              onChange={(e) => setPullPriorities(e.target.checked)}
                            />
                          }
                          label={
                            <Typography variant="subtitle2" fontWeight={700}>
                              Top 3 Priorities ({nonEmptyPriorities.length} item{nonEmptyPriorities.length === 1 ? '' : 's'})
                            </Typography>
                          }
                        />
                        <Box sx={{ pl: 3.5 }}>
                          {nonEmptyPriorities.length > 0 ? (
                            <Stack spacing={0.25}>
                              {nonEmptyPriorities.map((item, idx) => (
                                <Typography key={idx} variant="caption" color="text.secondary">
                                  {idx + 1}. {item}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              (Empty in previous week)
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })()}

                  {/* 3. For Next Month Preview */}
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={pullForNextMonth}
                          disabled={!prevWeekSettings.for_next_month.trim()}
                          onChange={(e) => setPullForNextMonth(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="subtitle2" fontWeight={700}>
                          For Next Month
                        </Typography>
                      }
                    />
                    <Box sx={{ pl: 3.5 }}>
                      {prevWeekSettings.for_next_month.trim() ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-wrap', display: 'block' }}
                        >
                          {prevWeekSettings.for_next_month}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          (Empty in previous week)
                        </Typography>
                      )}
                    </Box>
                  </Paper>

                  {/* 4. Notes Preview */}
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={pullNotes}
                          disabled={!prevWeekSettings.notes.trim()}
                          onChange={(e) => setPullNotes(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="subtitle2" fontWeight={700}>
                          Notes
                        </Typography>
                      }
                    />
                    <Box sx={{ pl: 3.5 }}>
                      {prevWeekSettings.notes.trim() ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-wrap', display: 'block' }}
                        >
                          {prevWeekSettings.notes}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          (Empty in previous week)
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Stack>
              )}
            </Box>

            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
                display: 'flex',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: 1.25,
              }}
            >
              <Button
                onClick={() => setOpenPopulateModal(false)}
                color="inherit"
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1 }}
              >
                Cancel
              </Button>

              {populateModalMode === 'populate_and_pull' ? (
                <>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={populatingWeek}
                    onClick={() => handlePopulateWeek(populateOverwriteExisting, false)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
                  >
                    Populate Placeholders Only
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={populatingWeek}
                    startIcon={<Sparkles size={16} />}
                    onClick={() => handlePopulateWeek(populateOverwriteExisting, true)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
                  >
                    {populatingWeek
                      ? 'Populating…'
                      : pullTodos || pullPriorities || pullForNextMonth || pullNotes
                      ? 'Populate & Pull Selected Forward'
                      : 'Populate Week Placeholders'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={
                    populatingWeek ||
                    (!pullTodos && !pullPriorities && !pullForNextMonth && !pullNotes)
                  }
                  startIcon={<Copy size={16} />}
                  onClick={handleConfirmPullForwardOnly}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
                >
                  {populatingWeek ? 'Pulling Forward…' : 'Pull Selected Fields Forward'}
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      )}

      {/* RESET WEEK CONFIRMATION MODAL (React 19 safe) */}
      {confirmResetOpen && (
        <Box
          className="no-print"
          onClick={() => setConfirmResetOpen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{ width: '100%', maxWidth: 440, borderRadius: 1, overflow: 'hidden' }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700}>
                Reset Week ({weekStartDate})?
              </Typography>
            </Box>
            <Box p={3}>
              <Typography variant="body2" color="text.secondary">
                This will clear all School Work, Parent Notes, and custom week counter overrides for the week of <strong>{weekStartDate}</strong> ({weekDates[0]?.dateStr} to {weekDates[weekDates.length - 1]?.dateStr}).
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1.5}>
                After resetting, you can click <strong>Populate Week Placeholders</strong> to generate fresh placeholders from your subject recurring rules.
              </Typography>
            </Box>
            <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => setConfirmResetOpen(false)} color="inherit" sx={{ textTransform: 'none', borderRadius: 1 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleResetWeek}
                disabled={resettingWeek}
                startIcon={<RotateCcw size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
              >
                {resettingWeek ? 'Resetting...' : 'Reset Week'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* UNIFIED ASSIGNMENT & GRADE MODAL */}
      <UnifiedAssignmentModal
        open={openUnifiedModal}
        onClose={() => {
          setOpenUnifiedModal(false);
          setUnifiedEditAssignment(null);
          setUnifiedPromotedNote(null);
        }}
        subjects={subjects as SubjectWithGrading[]}
        assignmentTypes={assignmentTypes}
        editingAssignment={unifiedEditAssignment}
        initialValues={
          unifiedPromotedNote
            ? {
                subject_id: unifiedPromotedNote.subject_id,
                title: unifiedPromotedNote.title || unifiedPromotedNote.description.split('\n')[0] || 'Graded Assignment',
                description: unifiedPromotedNote.description,
                due_date: unifiedPromotedNote.note_date,
                assigned_date: unifiedPromotedNote.note_date,
                source_type: 'planner_promoted',
                linked_note_id: unifiedPromotedNote.id,
              }
            : {
                subject_id: selectedSubject?.id || undefined,
                due_date: selectedDate || weekStartDate,
                assigned_date: selectedDate || weekStartDate,
              }
        }
        onOpenManageTypes={() => setOpenTypesManagerModal(true)}
        onSaved={(savedAssignment, savedTemplate) => {
          if (savedAssignment) {
            setSchoolAssignments((prev) => {
              const exists = prev.some((a) => a.id === savedAssignment.id);
              return exists
                ? prev.map((a) => (a.id === savedAssignment.id ? (savedAssignment as SchoolAssignment) : a))
                : [...prev, savedAssignment as SchoolAssignment];
            });
          }
          if (savedTemplate) {
            setRecurringTemplates((prev) => {
              const exists = prev.some((t) => t.id === savedTemplate.id);
              return exists ? prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t)) : [...prev, savedTemplate];
            });
            loadPlannerData(weekStartDate);
          }
        }}
      />

      <ApiGradeOverrideWarningModal
        open={Boolean(apiWarningAssignment)}
        assignment={apiWarningAssignment}
        subject={
          apiWarningAssignment?.subject_id
            ? (subjects.find((s) => s.id === apiWarningAssignment.subject_id) as
                | SubjectWithGrading
                | undefined) || null
            : null
        }
        onClose={() => setApiWarningAssignment(null)}
        onUpdated={(updated) => {
          setSchoolAssignments((prev) =>
            prev.map((item) =>
              item.id === updated.id ? (updated as SchoolAssignment) : item
            )
          );
        }}
        onOpenFullEditor={(target) => {
          setUnifiedPromotedNote(null);
          setUnifiedEditAssignment(target);
          setApiWarningAssignment(null);
          setOpenUnifiedModal(true);
        }}
      />

      {/* ASSIGNMENT TYPES MANAGER MODAL */}
      <AssignmentTypesManagerModal
        open={openTypesManagerModal}
        onClose={() => setOpenTypesManagerModal(false)}
        assignmentTypes={assignmentTypes}
        onUpdated={setAssignmentTypes}
      />

      {/* CSS STYLES FOR PRINTING & BINDER LAYOUT */}
      <style jsx global>{`
        /* Screen & Print Base Layout */
        .planner-print-root {
          font-family: Arial, sans-serif;
          color: #000000;
        }

        @media screen {
          .planner-print-root.screen-hidden-print-only {
            display: none !important;
          }

          .assignment-cell.active-cell-screen {
            outline: 2px solid #1b5698;
            outline-offset: -2px;
            background-color: #f0f6ff;
          }

          .assignment-cell:focus-visible {
            outline: 2px solid #1b5698;
            outline-offset: -2px;
          }
        }

        @media screen and (min-width: 1200px) {
          .planner-print-root.spread-mode {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 20px;
            align-items: start;
          }
        }

        .print-page {
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          min-height: 840px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .print-page-inner {
          display: flex;
          flex-direction: column;
          flex: 1;
          width: 100%;
          min-height: 0;
          box-sizing: border-box;
        }

        .planner-header {
          height: 52px !important;
          min-height: 52px !important;
          max-height: 52px !important;
          border: 1px solid #cccccc;
          padding: 0 12px;
          margin-bottom: 16px;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }

        .week-header-text {
          font-size: 14px;
          font-weight: bold;
          color: #000000;
          white-space: nowrap;
        }

        .planner-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          flex: 1;
          height: 100%;
        }

        .planner-table tbody tr {
          height: 1%;
        }

        .planner-table th,
        .planner-table td {
          border: 1px solid #cccccc;
          padding: 8px;
          vertical-align: top;
        }

        .subject-header-col {
          width: 135px !important;
          min-width: 135px !important;
          max-width: 135px !important;
          background-color: #f9f9f9;
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
        }

        .day-header-col {
          background-color: #fcecdb;
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          padding: 10px;
          white-space: nowrap;
        }

        .friday-col {
          background-color: #e2f0d9;
        }

        .subject-name-cell {
          width: 135px !important;
          min-width: 135px !important;
          max-width: 135px !important;
          background-color: #fafafa;
          font-weight: bold;
          font-size: 13px;
        }

        .assignment-cell {
          min-height: 48px;
          height: auto;
          cursor: pointer;
          font-size: 11.5px;
          line-height: 1.35;
          transition: background-color 0.15s ease;
        }

        .assignment-cell:hover {
          background-color: #f5f8ff;
        }

        .all-day-events-row {
          background-color: #f7f9fc;
        }

        .all-day-label-cell {
          width: 135px !important;
          min-width: 135px !important;
          max-width: 135px !important;
          background-color: #edf2f7;
          text-align: center;
          font-size: 8.5px;
          font-weight: 800;
          padding: 1px 4px !important;
          color: #2b6cb0;
          vertical-align: middle !important;
          line-height: 1.1;
        }

        .all-day-events-cell {
          padding: 1px 4px !important;
          vertical-align: middle !important;
          font-size: 9px;
          background-color: #f7f9fc;
        }

        .all-day-items-wrapper {
          display: flex;
          flex-wrap: wrap;
          gap: 2px 4px;
          align-items: center;
          width: 100%;
        }

        .holiday-banner-top {
          background-color: #d32f2f;
          color: #ffffff;
          font-weight: bold;
          font-size: 8.5px;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 0;
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          line-height: 1.15;
          box-sizing: border-box;
        }

        .task-banner-top {
          background-color: #2e7d32;
          color: #ffffff;
          font-weight: bold;
          font-size: 8.5px;
          padding: 1px 4px;
          border-radius: 3px;
          margin-bottom: 0;
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          line-height: 1.15;
          box-sizing: border-box;
        }

        .banner-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .all-day-empty {
          color: #a0aec0;
          font-size: 8.5px;
          text-align: center;
          width: 100%;
          line-height: 1;
        }

        .parent-note-item {
          color: #1a1a1a;
          font-weight: 600;
          font-size: 11px;
          line-height: 1.3;
          margin-bottom: 2px;
          word-break: break-word;
        }

        .school-assignment-item {
          color: #0C74E4;
          font-weight: 700;
          font-size: 10.5px;
          margin-bottom: 2px;
          word-break: break-word;
        }

        /* Page 2 Equalized Grid & Compact Sidebar Styling */
        .page2-container {
          display: flex;
          width: 100%;
          gap: 0px;
          box-sizing: border-box;
          flex: 1;
          height: 100%;
        }

        .page2-table-wrapper {
          width: calc(135px + ((100% - 135px) * (2 / 3)));
          flex-shrink: 0;
          box-sizing: border-box;
          padding-right: 8px;
          display: flex;
          flex-direction: column;
        }

        .sidebar-column {
          width: calc((100% - 135px) * (1 / 3));
          flex-shrink: 0;
          box-sizing: border-box;
          padding-left: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .sidebar-section {
          margin-bottom: 8px;
        }

        .sidebar-header-badge {
          background-color: #fff2cc;
          text-align: center;
          font-weight: bold;
          font-size: 11px;
          padding: 2px 4px;
          margin-bottom: 4px;
          border-radius: 3px;
          letter-spacing: 0.5px;
        }

        .todo-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .todo-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .checkbox-square {
          width: 12px;
          height: 12px;
          border: 1px solid #777777;
          flex-shrink: 0;
        }

        .sidebar-input {
          width: 100%;
          border: none;
          border-bottom: 1px solid #dddddd;
          font-size: 11px;
          outline: none;
          background: transparent;
          color: #000000 !important;
        }

        .sidebar-textarea {
          width: 100%;
          border: 1px solid #cccccc;
          border-radius: 4px;
          font-size: 11px;
          padding: 6px;
          outline: none;
          resize: none;
          background: transparent;
          color: #000000 !important;
          box-sizing: border-box;
        }

        .sidebar-textarea-next-month {
          height: 105px !important;
        }

        .sidebar-textarea-notes {
          height: 140px !important;
        }

        .habits-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .habits-table th,
        .habits-table td {
          padding: 2px 1px;
          text-align: center;
        }

        .habit-title-cell {
          text-align: left;
          font-size: 10px;
          width: 42%;
        }

        .bubble-cell {
          width: 8.2%;
        }

        .bubble-circle {
          width: 10px;
          height: 10px;
          border: 1px solid #555555;
          border-radius: 50%;
          margin: 0 auto;
        }

        /* PRE-PRINT MEASUREMENT STATE (Matches @media print width & typography to measure natural height) */
        .planner-print-root.print-measuring {
          display: block !important;
          width: 762px !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .planner-print-root.print-measuring .print-page {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 762px !important;
          min-height: 0 !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        .planner-print-root.print-measuring .print-page-inner {
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .planner-print-root.print-measuring .no-print {
          display: none !important;
        }

        .planner-print-root.print-measuring .planner-header {
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          margin-bottom: 4px !important;
          padding: 0 6px !important;
          flex: 0 0 28px !important;
        }

        .planner-print-root.print-measuring .planner-header span:first-of-type {
          font-size: 16px !important;
        }

        .planner-print-root.print-measuring .planner-header span:last-of-type {
          font-size: 28px !important;
        }

        .planner-print-root.print-measuring .week-header-text {
          font-size: 11.5px !important;
        }

        .planner-print-root.print-measuring .planner-table {
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
        }

        .planner-print-root.print-measuring .planner-table tbody tr {
          height: auto !important;
        }

        .planner-print-root.print-measuring .planner-table th,
        .planner-print-root.print-measuring .planner-table td {
          padding: 2px 3.5px !important;
        }

        .planner-print-root.print-measuring .subject-header-col,
        .planner-print-root.print-measuring .subject-name-cell,
        .planner-print-root.print-measuring .all-day-label-cell {
          width: 108px !important;
          min-width: 108px !important;
          max-width: 108px !important;
        }

        .planner-print-root.print-measuring .day-header-col,
        .planner-print-root.print-measuring .subject-header-col {
          padding: 2.5px 4px !important;
          font-size: 9.5px !important;
          line-height: 1.15 !important;
        }

        .planner-print-root.print-measuring .subject-name-cell {
          font-size: 10px !important;
          padding: 2px 3.5px !important;
          line-height: 1.15 !important;
        }

        .planner-print-root.print-measuring .subject-name-cell p {
          font-size: 10px !important;
          line-height: 1.15 !important;
        }

        .planner-print-root.print-measuring .subject-name-cell span {
          font-size: 8px !important;
          line-height: 1.1 !important;
          margin-top: 1px !important;
        }

        .planner-print-root.print-measuring .assignment-cell {
          min-height: 22px !important;
          height: auto !important;
          padding: 2px 3.5px !important;
          font-size: 9.5px !important;
          line-height: 1.18 !important;
        }

        .planner-print-root.print-measuring .all-day-events-row,
        .planner-print-root.print-measuring .all-day-events-cell,
        .planner-print-root.print-measuring .all-day-items-wrapper {
          height: auto !important;
          min-height: 13px !important;
        }

        .planner-print-root.print-measuring .parent-note-item,
        .planner-print-root.print-measuring .formatted-parent-note-block,
        .planner-print-root.print-measuring .formatted-parent-note-block .note-header-title,
        .planner-print-root.print-measuring .formatted-parent-note-block .note-checkbox-icon,
        .planner-print-root.print-measuring .school-assignment-item {
          font-size: 9.5px !important;
          line-height: 1.18 !important;
          margin-bottom: 1px !important;
          padding-bottom: 0 !important;
        }

        .planner-print-root.print-measuring .formatted-parent-note-block > div {
          margin-top: 0.5px !important;
          margin-bottom: 0.5px !important;
          line-height: 1.18 !important;
        }

        .planner-print-root.print-measuring .page2-container {
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
          display: flex !important;
          align-items: stretch !important;
        }

        .planner-print-root.print-measuring .page2-table-wrapper {
          width: calc(108px + ((100% - 108px) * (2 / 3))) !important;
          padding-right: 6px !important;
          height: auto !important;
          min-height: 0 !important;
        }

        .planner-print-root.print-measuring .sidebar-column {
          width: calc((100% - 108px) * (1 / 3)) !important;
          padding-left: 6px !important;
          height: auto !important;
          min-height: 0 !important;
          justify-content: flex-start !important;
        }

        .planner-print-root.print-measuring .sidebar-section {
          margin-bottom: 3px !important;
          flex-shrink: 0 !important;
        }

        .planner-print-root.print-measuring .sidebar-section.sidebar-section-grow {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
        }

        .planner-print-root.print-measuring .sidebar-header-badge {
          font-size: 9px !important;
          padding: 1px 3px !important;
          margin-bottom: 2px !important;
        }

        .planner-print-root.print-measuring .todo-list {
          gap: 1.5px !important;
        }

        .planner-print-root.print-measuring .todo-item {
          gap: 4px !important;
          min-height: 12px !important;
        }

        .planner-print-root.print-measuring .checkbox-square {
          width: 9px !important;
          height: 9px !important;
        }

        .planner-print-root.print-measuring .sidebar-input {
          font-size: 9.5px !important;
          height: 13px !important;
          line-height: 13px !important;
          padding: 0 1px !important;
        }

        .planner-print-root.print-measuring .sidebar-textarea-next-month {
          flex: 1 1 0% !important;
          height: auto !important;
          min-height: 36px !important;
          font-size: 9.5px !important;
          padding: 3px !important;
        }

        .planner-print-root.print-measuring .sidebar-textarea-notes {
          flex: 1 1 0% !important;
          height: auto !important;
          min-height: 42px !important;
          font-size: 9.5px !important;
          padding: 3px !important;
        }

        .planner-print-root.print-measuring .activity-supplies-box {
          padding: 2px 4px !important;
          margin-bottom: 2px !important;
          font-size: 8.5px !important;
          line-height: 1.15 !important;
        }

        .planner-print-root.print-measuring .activity-supplies-title {
          font-size: 8px !important;
          margin-bottom: 1px !important;
        }

        .planner-print-root.print-measuring .activity-supplies-item {
          margin-bottom: 1.5px !important;
        }

        .planner-print-root.print-measuring .habits-table {
          font-size: 9px !important;
        }

        .planner-print-root.print-measuring .habits-table th,
        .planner-print-root.print-measuring .habits-table td {
          padding: 1px 0 !important;
          line-height: 1.1 !important;
        }

        .planner-print-root.print-measuring .habit-title-cell {
          font-size: 9px !important;
        }

        .planner-print-root.print-measuring .bubble-circle {
          width: 7.5px !important;
          height: 7.5px !important;
        }

        /* PROGRESSIVE PRINT DENSITY TIERS FOR DENSE WEEKS */
        .print-page.print-density-compact .planner-header {
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          margin-bottom: 3px !important;
          flex: 0 0 24px !important;
        }
        .print-page.print-density-compact .planner-table th,
        .print-page.print-density-compact .planner-table td {
          padding: 1.5px 3px !important;
        }
        .print-page.print-density-compact .assignment-cell,
        .print-page.print-density-compact .parent-note-item,
        .print-page.print-density-compact .formatted-parent-note-block,
        .print-page.print-density-compact .formatted-parent-note-block .note-header-title,
        .print-page.print-density-compact .formatted-parent-note-block .note-checkbox-icon,
        .print-page.print-density-compact .school-assignment-item {
          font-size: 8.8px !important;
          line-height: 1.13 !important;
        }
        .print-page.print-density-compact .formatted-parent-note-block > div {
          line-height: 1.13 !important;
          margin-top: 0 !important;
          margin-bottom: 0.5px !important;
        }

        .print-page.print-density-tight .planner-header {
          height: 22px !important;
          min-height: 22px !important;
          max-height: 22px !important;
          margin-bottom: 2px !important;
          flex: 0 0 22px !important;
        }
        .print-page.print-density-tight .planner-table th,
        .print-page.print-density-tight .planner-table td {
          padding: 1px 2.5px !important;
        }
        .print-page.print-density-tight .subject-name-cell,
        .print-page.print-density-tight .subject-name-cell p {
          font-size: 9px !important;
          line-height: 1.1 !important;
        }
        .print-page.print-density-tight .assignment-cell,
        .print-page.print-density-tight .parent-note-item,
        .print-page.print-density-tight .formatted-parent-note-block,
        .print-page.print-density-tight .formatted-parent-note-block .note-header-title,
        .print-page.print-density-tight .formatted-parent-note-block .note-checkbox-icon,
        .print-page.print-density-tight .school-assignment-item {
          font-size: 8.2px !important;
          line-height: 1.09 !important;
        }
        .print-page.print-density-tight .formatted-parent-note-block > div {
          line-height: 1.09 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .print-page.print-density-tight .todo-list {
          gap: 1px !important;
        }
        .print-page.print-density-tight .sidebar-input {
          height: 11.5px !important;
          line-height: 11.5px !important;
          font-size: 8.8px !important;
        }
        .print-page.print-density-tight .activity-supplies-box {
          font-size: 8px !important;
          line-height: 1.1 !important;
          padding: 1.5px 3px !important;
        }

        .print-page.print-density-ultra .planner-header {
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          margin-bottom: 2px !important;
          flex: 0 0 20px !important;
        }
        .print-page.print-density-ultra .planner-table th,
        .print-page.print-density-ultra .planner-table td {
          padding: 1px 2px !important;
        }
        .print-page.print-density-ultra .subject-name-cell,
        .print-page.print-density-ultra .subject-name-cell p {
          font-size: 8.5px !important;
          line-height: 1.05 !important;
        }
        .print-page.print-density-ultra .assignment-cell,
        .print-page.print-density-ultra .parent-note-item,
        .print-page.print-density-ultra .formatted-parent-note-block,
        .print-page.print-density-ultra .formatted-parent-note-block .note-header-title,
        .print-page.print-density-ultra .formatted-parent-note-block .note-checkbox-icon,
        .print-page.print-density-ultra .school-assignment-item {
          font-size: 7.6px !important;
          line-height: 1.05 !important;
        }
        .print-page.print-density-ultra .formatted-parent-note-block > div {
          line-height: 1.05 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .print-page.print-density-ultra .todo-list {
          gap: 0.5px !important;
        }
        .print-page.print-density-ultra .sidebar-input {
          height: 10.5px !important;
          line-height: 10.5px !important;
          font-size: 8.2px !important;
        }
        .print-page.print-density-ultra .activity-supplies-box {
          font-size: 7.5px !important;
          line-height: 1.05 !important;
          padding: 1px 2px !important;
        }

        /* PRINT STYLING FOR 2-PAGE PORTRAIT BINDER PDF */
        @media print {
          @page {
            size: letter portrait;
            margin: 0.25in 0.28in;
          }

          html, body, div, main, section, article, .planner-print-root {
            padding-right: 0 !important;
            margin-right: 0 !important;
            overflow: visible !important;
          }

          .no-print, header, nav, aside, .MuiDrawer-root, .MuiBackdrop-root, .MuiModal-root {
            display: none !important;
          }

          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 9.5px !important;
          }

          .planner-print-root {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-page {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            height: 9.8in !important;
            max-height: 9.8in !important;
            display: flex !important;
            flex-direction: column !important;
            break-after: page !important;
            page-break-after: always !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .print-page:last-of-type,
          .print-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          .print-page-inner {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            width: 100%;
            height: 100%;
            min-height: 0 !important;
            box-sizing: border-box !important;
          }

          .planner-header {
            height: 28px !important;
            min-height: 28px !important;
            max-height: 28px !important;
            margin-bottom: 4px !important;
            padding: 0 6px !important;
            flex: 0 0 28px !important;
          }

          .planner-header span:first-of-type {
            font-size: 16px !important;
          }

          .planner-header span:last-of-type {
            font-size: 28px !important;
          }

          .week-header-text {
            font-size: 11.5px !important;
          }

          .planner-table {
            flex: 1 1 0% !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
          }

          .planner-table tbody tr {
            height: auto !important;
          }

          .planner-table th,
          .planner-table td {
            padding: 2px 3.5px !important;
          }

          .subject-header-col,
          .subject-name-cell,
          .all-day-label-cell {
            width: 108px !important;
            min-width: 108px !important;
            max-width: 108px !important;
          }

          .day-header-col {
            padding: 2.5px 4px !important;
            font-size: 9.5px !important;
            line-height: 1.15 !important;
          }

          .subject-header-col {
            padding: 2.5px 4px !important;
            font-size: 9.5px !important;
            line-height: 1.15 !important;
          }

          .subject-name-cell {
            font-size: 10px !important;
            padding: 2px 3.5px !important;
            line-height: 1.15 !important;
          }

          .subject-name-cell p {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .subject-name-cell span {
            font-size: 8px !important;
            line-height: 1.1 !important;
            margin-top: 1px !important;
          }

          .assignment-cell {
            min-height: 22px !important;
            height: auto !important;
            padding: 2px 3.5px !important;
            font-size: 9.5px !important;
            line-height: 1.18 !important;
          }

          .all-day-events-row {
            background-color: #f7f9fc !important;
            height: auto !important;
            min-height: 13px !important;
          }

          .all-day-label-cell {
            font-size: 7.5px !important;
            padding: 1px 2px !important;
            vertical-align: middle !important;
            height: auto !important;
          }

          .all-day-events-cell {
            padding: 1px 3px !important;
            vertical-align: middle !important;
            height: auto !important;
          }

          .all-day-items-wrapper {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 1px 3px !important;
            align-items: center !important;
            width: 100% !important;
            height: auto !important;
            min-height: 12px !important;
          }

          .holiday-banner-top {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1.5px solid #000000 !important;
            font-weight: 800 !important;
            font-size: 7.5px !important;
            padding: 0.5px 3px !important;
            margin-bottom: 0 !important;
            line-height: 1.1 !important;
            display: inline-flex !important;
            align-items: center !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .task-banner-top {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #333333 !important;
            font-weight: 700 !important;
            font-size: 7.5px !important;
            padding: 0.5px 3px !important;
            margin-bottom: 0 !important;
            line-height: 1.1 !important;
            display: inline-flex !important;
            align-items: center !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .all-day-empty {
            color: #777777 !important;
            font-size: 7.5px !important;
            text-align: center !important;
            width: 100% !important;
            line-height: 1 !important;
          }

          .banner-text {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .page2-container {
            flex: 1 1 0% !important;
            height: auto !important;
            min-height: 0 !important;
            display: flex !important;
            align-items: stretch !important;
          }

          .page2-table-wrapper {
            width: calc(108px + ((100% - 108px) * (2 / 3))) !important;
            padding-right: 6px !important;
            display: flex !important;
            flex-direction: column !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .sidebar-column {
            width: calc((100% - 108px) * (1 / 3)) !important;
            padding-left: 6px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .parent-note-item {
            margin-bottom: 1px !important;
            font-size: 9.5px !important;
            line-height: 1.18 !important;
          }

          .formatted-parent-note-block {
            font-size: 9.5px !important;
            line-height: 1.18 !important;
            margin-bottom: 1px !important;
            padding-bottom: 0 !important;
          }

          .formatted-parent-note-block .note-header-title {
            font-size: 9.5px !important;
            line-height: 1.15 !important;
          }

          .formatted-parent-note-block .note-checkbox-icon {
            font-size: 9.5px !important;
            line-height: 1.1 !important;
            padding-top: 0 !important;
          }

          .formatted-parent-note-block > div {
            margin-top: 0.5px !important;
            margin-bottom: 0.5px !important;
            line-height: 1.18 !important;
          }

          .school-assignment-item {
            margin-bottom: 1px !important;
            font-size: 9.5px !important;
            line-height: 1.18 !important;
            color: #000000 !important;
            font-weight: 700 !important;
          }

          .sidebar-section {
            margin-bottom: 3px !important;
            flex-shrink: 0 !important;
          }

          .sidebar-section.sidebar-section-grow {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            min-height: 0 !important;
            margin-bottom: 3px !important;
          }

          .sidebar-section.sidebar-section-grow:last-child {
            margin-bottom: 0 !important;
            flex: 1.2 1 0% !important;
          }

          .sidebar-header-badge {
            font-size: 9px !important;
            padding: 1px 3px !important;
            margin-bottom: 2px !important;
            flex-shrink: 0 !important;
          }

          .sidebar-textarea-next-month {
            flex: 1 1 0% !important;
            height: auto !important;
            min-height: 36px !important;
            font-size: 9.5px !important;
          }

          .sidebar-textarea-notes {
            flex: 1 1 0% !important;
            height: auto !important;
            min-height: 42px !important;
            font-size: 9.5px !important;
          }

          .activity-supplies-box {
            padding: 2px 4px !important;
            margin-bottom: 2px !important;
            font-size: 8.5px !important;
            line-height: 1.15 !important;
            flex-shrink: 0 !important;
          }

          .activity-supplies-title {
            font-size: 8px !important;
            margin-bottom: 1px !important;
          }

          .activity-supplies-item {
            margin-bottom: 1.5px !important;
          }

          .todo-list {
            gap: 1.5px !important;
          }

          .todo-item {
            gap: 4px !important;
            min-height: 12px !important;
          }

          .checkbox-square {
            width: 9px !important;
            height: 9px !important;
          }

          .sidebar-input {
            font-size: 9.5px !important;
            height: 13px !important;
            line-height: 13px !important;
            padding: 0 1px !important;
            border-bottom: 1px solid #999999 !important;
          }

          .sidebar-textarea {
            font-size: 9.5px !important;
            line-height: 1.2 !important;
            border: 1px solid #999999 !important;
            padding: 3px !important;
          }

          .habits-table {
            font-size: 9px !important;
          }

          .habits-table th,
          .habits-table td {
            padding: 1px 0 !important;
            line-height: 1.1 !important;
          }

          .habit-title-cell {
            font-size: 9px !important;
          }

          .bubble-circle {
            width: 7.5px !important;
            height: 7.5px !important;
          }
        }
      `}</style>
    </Box>
  );
}

export default function WeeklyPlannerCreatorPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
