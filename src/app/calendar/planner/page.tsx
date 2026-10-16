'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
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
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { ItemIcon } from 'src/components/base/item-icon';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import {
  DAY_KEYS,
  DayKey,
  MathSyllabusDay,
  SubjectWeekOverride,
  WeeklySubjectOverrides,
  generateSubjectWeekNotesStructured,
  parseRecurringConfig,
  parseSubjectOverrides,
  resolveSubjectCountersForWeek,
} from 'src/utils/recurring-planner';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  recurring_config?: Json | null;
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

type AssignmentCategory = 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
type AssignmentPriority = 'low' | 'medium' | 'high';

interface SchoolAssignment {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_date: string;
  priority: AssignmentPriority;
  category: AssignmentCategory;
  status: 'pending' | 'in_progress' | 'completed';
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
  { id: 'sub-1', name: 'Math', sort_order: 1, color: '#0C74E4' },
  { id: 'sub-2', name: 'Reading', sort_order: 2, color: '#02876f' },
  { id: 'sub-3', name: 'Language Arts', sort_order: 3, color: '#ea2012' },
  { id: 'sub-4', name: 'Science', sort_order: 4, color: '#018a3c' },
  { id: 'sub-5', name: 'History', sort_order: 5, color: '#894AE0' },
  { id: 'sub-6', name: 'Spelling', sort_order: 6, color: '#D97706' },
  { id: 'sub-7', name: 'Bible', sort_order: 7, color: '#4F46E5' },
  { id: 'sub-8', name: 'P.E. / Art', sort_order: 8, color: '#DB2777' },
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

function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return formatDateStr(monday);
}

function isAssignmentCategory(val: string): val is AssignmentCategory {
  return ['homework', 'project', 'test', 'quiz', 'reading', 'paper'].includes(val);
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

  // Modal State for adding/editing Parent Notes or School Assignment in a cell
  const [openCellModal, setOpenCellModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [cellNoteHeader, setCellNoteHeader] = useState('');
  const [cellNoteDesc, setCellNoteDesc] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // New School Assignment input inside cell modal
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentCategory, setAssignmentCategory] = useState<AssignmentCategory>('homework');
  const [assignmentPriority, setAssignmentPriority] = useState<AssignmentPriority>('medium');
  const [savingAssignment, setSavingAssignment] = useState(false);

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

      // 6. Fetch Tasks for this week
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      if (taskData) setTasksList(taskData as PlannerTask[]);

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

  const handlePrevWeek = async () => {
    await handleSaveSettings(plannerSettings);
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() - 7);
    const newStr = formatDateStr(cur);
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
  };

  const handleNextWeek = async () => {
    await handleSaveSettings(plannerSettings);
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    const newStr = formatDateStr(cur);
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
  };

  const handleCurrentWeek = async () => {
    await handleSaveSettings(plannerSettings);
    const currentMon = getCurrentWeekMonday();
    setWeekStartDate(currentMon);
    router.replace(`/calendar/planner?week=${currentMon}`);
  };

  const handleOpenCellEditor = (subject: Subject, dateStr: string) => {
    setSelectedSubject(subject);
    setSelectedDate(dateStr);

    const squareNotes = parentNotes.filter(
      (n) => n.subject_id === subject.id && n.note_date === dateStr
    );

    setEditingNoteId(null);
    setCellNoteHeader('');
    setCellNoteDesc('');
    setIsFormOpen(squareNotes.length === 0);

    setAssignmentTitle('');
    setAssignmentCategory('homework');
    setAssignmentPriority('medium');
    setOpenCellModal(true);
  };

  const handleStartEditNote = (note: ParentNote) => {
    setEditingNoteId(note.id);
    setCellNoteHeader(note.title || '');
    setCellNoteDesc(note.description || '');
    setIsFormOpen(true);
  };

  const handleAddNewNoteForm = () => {
    setEditingNoteId(null);
    setCellNoteHeader('');
    setCellNoteDesc('');
    setIsFormOpen(true);
  };

  const handleSaveCellNote = async () => {
    if (!selectedSubject || !selectedDate) return;
    if (!cellNoteHeader.trim() && !cellNoteDesc.trim()) {
      toast.error('Please enter a note header or body content');
      return;
    }

    setSavingNote(true);
    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    try {
      if (editingNoteId) {
        const { error } = await supabase
          .from('parent_notes')
          .update({
            title: cellNoteHeader.trim() || null,
            description: cellNoteDesc.trim(),
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', editingNoteId);

        if (error) {
          toast.error(`Error updating parent note: ${error.message}`);
          return;
        }

        setParentNotes((prev) =>
          prev.map((n) =>
            n.id === editingNoteId
              ? {
                  ...n,
                  title: cellNoteHeader.trim() || null,
                  description: cellNoteDesc.trim(),
                  updated_by: activeUserName,
                  updated_at: nowIso,
                }
              : n
          )
        );
        toast.success('Parent note updated!');
      } else {
        const { data, error } = await supabase
          .from('parent_notes')
          .insert({
            subject_id: selectedSubject.id,
            note_date: selectedDate,
            title: cellNoteHeader.trim() || null,
            description: cellNoteDesc.trim(),
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Error adding parent note: ${error.message}`);
          return;
        } else if (data) {
          setParentNotes((prev) => [...prev, data as ParentNote]);
          toast.success('Parent note added!');
        }
      }

      setEditingNoteId(null);
      setCellNoteHeader('');
      setCellNoteDesc('');
      setIsFormOpen(false);
    } catch {
      toast.error('Error saving parent note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteSingleParentNote = async (noteId: string) => {
    setSavingNote(true);
    try {
      const { error } = await supabase.from('parent_notes').delete().eq('id', noteId);
      if (error) {
        toast.error(`Error deleting note: ${error.message}`);
      } else {
        setParentNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success('Parent note deleted!');
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          setCellNoteHeader('');
          setCellNoteDesc('');
          setIsFormOpen(false);
        }
      }
    } catch {
      toast.error('Failed to delete parent note');
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
      }
    } catch {
      toast.error('Error creating assignment');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleSaveSettings = async (newSettings: WeeklySettings) => {
    setPlannerSettings(newSettings);
    const targetWeek = newSettings.week_start_date || weekStartDate;
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
      } else if (data && data.id) {
        setPlannerSettings((prev) => ({ ...prev, id: data.id }));
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
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

    // Optional: also update the subject's base anchor to this week so future weeks continue from this number!
    if (shiftFutureWeeks) {
      const targetSub = subjects.find((s) => s.id === subjectId);
      if (targetSub) {
        const cfg = parseRecurringConfig(targetSub.recurring_config, targetSub.name);
        const resolved = resolveSubjectCountersForWeek(cfg, weekStartDate, updatedOverride);
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
        const jsonCfg = JSON.parse(JSON.stringify(nextCfg)) as Json;
        await supabase.from('subjects').update({ recurring_config: jsonCfg }).eq('id', subjectId);
        setSubjects((prev) =>
          prev.map((s) => (s.id === subjectId ? { ...s, recurring_config: jsonCfg } : s))
        );
        toast.success(`${targetSub.name} sequence updated for this week and subsequent weeks!`);
      }
    }
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
    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
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

      for (const subject of subjects) {
        const cfg = parseRecurringConfig(subject.recurring_config, subject.name);
        if (!cfg.enabled) continue;

        const override = plannerSettings.subject_overrides[subject.id];
        const counters = resolveSubjectCountersForWeek(cfg, weekStartDate, override);
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

      if (toInsert.length === 0 && toUpdate.length === 0) {
        if (pulledSidebar) {
          toast.success(
            `Pulled forward previous week's sidebar sections (subject cells already had notes).`
          );
        } else {
          toast(
            'All recurring cells for this week already have notes. Use "Adjust Week # & Math Days → Sync / Overwrite" or Reset Week if you want to replace them.',
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

      toast.success(
        pulledSidebar
          ? `Populated ${toInsert.length + toUpdate.length} placeholders & pulled forward previous week's sidebar!`
          : `Populated ${toInsert.length + toUpdate.length} subject placeholders for the week of ${weekStartDate}!`
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
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
        transition: 'padding-right 0.3s ease',
        pr: openCellModal ? { xs: 0, md: '500px' } : 0,
        overflowX: 'auto',
        maxWidth: '100%',
      }}
    >
      {/* UNIFIED HEADER & WEEK COMMAND BAR (Hidden during PDF print) */}
      <Box className="no-print" mb={3}>
        <Card
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            {/* Left: Title + Inline Week Stepper + Sequence Status Pill */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mr: 0.5 }}>
                Weekly Binder
              </Typography>

              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 0.4,
                }}
              >
                <IconButton
                  size="small"
                  onClick={handlePrevWeek}
                  title="Previous Week"
                  sx={{ borderRadius: 1.5, p: 0.6 }}
                >
                  <ChevronLeft size={18} />
                </IconButton>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{
                    px: 1.5,
                    minWidth: 155,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatWeekRangeLabel()}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleNextWeek}
                  title="Next Week"
                  sx={{ borderRadius: 1.5, p: 0.6 }}
                >
                  <ChevronRight size={18} />
                </IconButton>
              </Box>

              {weekStartDate !== getCurrentWeekMonday() && (
                <Button
                  variant="outlined"
                  size="small"
                  color="primary"
                  onClick={handleCurrentWeek}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, py: 0.5, px: 1.25 }}
                >
                  This Week
                </Button>
              )}

              <Chip
                label={getWeekSequenceSummary()}
                size="small"
                variant="outlined"
                onClick={() => setShowCountersPanel((prev) => !prev)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                  bgcolor: showCountersPanel ? 'action.selected' : 'transparent',
                }}
              />
            </Stack>

            {/* Right: 1 Primary CTA (Print Binder) + 1 3-Line Menu (Week Tools) */}
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Button
                variant="contained"
                color="primary"
                startIcon={<Printer size={17} />}
                onClick={handlePrint}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2.25,
                  py: 0.9,
                }}
              >
                Print Binder
              </Button>

              <Button
                variant="outlined"
                color="inherit"
                startIcon={<MenuIcon size={17} />}
                onClick={(e) => setToolsMenuAnchorEl(e.currentTarget)}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1.75,
                  py: 0.9,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
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
                    minWidth: 260,
                    borderRadius: 2.5,
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
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5 }}
                >
                  <Sparkles size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    {populatingWeek ? 'Populating…' : 'Populate Week Placeholders…'}
                  </Typography>
                </MenuItem>

                <MenuItem
                  disabled={populatingWeek}
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    handleOpenPopulateOrPullModal('pull_only', false);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5 }}
                >
                  <Copy size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    Pull Forward Previous Week&apos;s Sidebar…
                  </Typography>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    setShowCountersPanel((prev) => !prev);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5 }}
                >
                  <Sliders size={16} color={theme.palette.primary.main} />
                  <Typography variant="body2" fontWeight={600} flexGrow={1}>
                    {showCountersPanel ? 'Hide Week # & Math Days' : 'Adjust Week # & Math Days…'}
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
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5 }}
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
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5 }}
                >
                  <Settings size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Subjects &amp; Habit Trackers →
                  </Typography>
                </MenuItem>

                <Divider sx={{ my: 0.75 }} />

                <MenuItem
                  disabled={parentNotes.length === 0}
                  onClick={() => {
                    setToolsMenuAnchorEl(null);
                    setConfirmResetOpen(true);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.5, color: 'error.main' }}
                >
                  <RotateCcw size={16} />
                  <Typography variant="body2" fontWeight={600}>
                    Reset Week Notes…
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
                    <Typography variant="subtitle1" fontWeight={800}>
                      Week Sequence &amp; Math Syllabus Days ({formatWeekRangeLabel()})
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'none' }}>
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
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      Sync / Overwrite Placeholders…
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => setShowCountersPanel(false)}
                      title="Close panel"
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
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${sub.color || '#0C74E4'}` }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Typography variant="subtitle2" fontWeight={800}>
                                {sub.name} — Syllabus Day Selector
                              </Typography>
                              <Chip
                                size="small"
                                label="Tue & Thu Classes"
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.68rem' }}
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
                                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
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
                                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                                    Wed HW: <strong>{thuSyl.workbook}</strong>
                                  </Typography>
                                )}
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>
                      );
                    }

                    // Check which tokens this subject uses
                    const allTemplates = DAY_KEYS.map((dk) => cfg.days[dk].template).join(' ');
                    const usesWeek = allTemplates.includes('{week}');
                    const usesClassNum = allTemplates.includes('{class_num}');
                    const usesLesson =
                      allTemplates.includes('{lesson}') || allTemplates.includes('{prev_lesson}');

                    return (
                      <Grid item xs={12} sm={6} md={3} key={sub.id}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            height: '100%',
                            borderLeft: `4px solid ${sub.color || '#0C74E4'}`,
                          }}
                        >
                          <Typography variant="subtitle2" fontWeight={800} mb={1.25}>
                            {sub.name}
                          </Typography>
                          <Stack spacing={1.25}>
                            {(usesWeek || (!usesClassNum && !usesLesson)) && (
                              <TextField
                                size="small"
                                type="number"
                                label="Week #"
                                value={resolved.week_num}
                                onChange={(e) => {
                                  const nextWeekNum = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  const patch: Partial<SubjectWeekOverride> = { week_num: nextWeekNum };
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
                                  const nextClass = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  handleUpdateSubjectOverride(sub.id, { class_num: nextClass }, true);
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
                                  const nextLesson = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  handleUpdateSubjectOverride(sub.id, { lesson_num: nextLesson }, true);
                                }}
                                helperText={`Quiz Lesson: ${Math.max(1, resolved.lesson_num - 1)}`}
                                fullWidth
                              />
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

      {/* PRINTABLE 2-PAGE BINDER PLANNER WRAPPER */}
      <Box className="planner-print-root">
        {/* ========================================================================= */}
        {/* PAGE 1: MONDAY, TUESDAY, WEDNESDAY (3 COLUMNS x 8 SUBJECT ROWS)          */}
        {/* ========================================================================= */}
        <Box className="print-page page-break">
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

              {displaySubjects.map((subject) => (
                <tr key={subject.id}>
                  <td className="subject-name-cell">
                    <Typography variant="body2" fontWeight={700}>
                      {subject.name}
                    </Typography>
                  </td>
                  {page1Days.map((d) => {
                    const cellNote = parentNotes.find(
                      (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                    );
                    const cellSchoolAssignments = schoolAssignments.filter(
                      (a) => a.subject_id === subject.id && a.due_date === d.dateStr
                    );

                    return (
                      <td
                        key={d.dateStr}
                        className="assignment-cell"
                        onClick={() => handleOpenCellEditor(subject, d.dateStr)}
                      >
                        {(() => {
                          const squareNotes = parentNotes.filter(
                            (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                          );
                          if (squareNotes.length === 0) return null;
                          return squareNotes.map((noteItem) => (
                            <Box key={noteItem.id} className="parent-note-item" sx={{ color: branding.notes.color, mb: 1 }}>
                              <FormattedParentNote
                                noteId={noteItem.id}
                                title={noteItem.title}
                                description={noteItem.description}
                                color={branding.notes.color}
                                iconName={branding.notes.icon}
                                onToggleCheckbox={handleToggleParentNoteCheckbox}
                              />
                            </Box>
                          ));
                        })()}
                        {cellSchoolAssignments.map((a) => (
                          <div key={a.id} className="school-assignment-item" style={{ color: branding.assignments.color }}>
                            <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} style={{ marginRight: 4, display: 'inline' }} />
                            [{a.category.toUpperCase()}] {a.title}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        {/* ========================================================================= */}
        {/* PAGE 2: THURSDAY, FRIDAY + RIGHT SIDEBAR (TO-DO, PRIORITIES, HABITS, NOTES) */}
        {/* ========================================================================= */}
        <Box className="print-page">
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

                  {displaySubjects.map((subject) => (
                    <tr key={subject.id}>
                      <td className="subject-name-cell">
                        <Typography variant="body2" fontWeight={700}>
                          {subject.name}
                        </Typography>
                      </td>
                      {page2Days.map((d) => {
                        const cellNote = parentNotes.find(
                          (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                        );
                        const cellSchoolAssignments = schoolAssignments.filter(
                          (a) => a.subject_id === subject.id && a.due_date === d.dateStr
                        );

                        return (
                          <td
                            key={d.dateStr}
                            className="assignment-cell"
                            onClick={() => handleOpenCellEditor(subject, d.dateStr)}
                          >
                            {(() => {
                              const squareNotes = parentNotes.filter(
                                (n) => n.subject_id === subject.id && n.note_date === d.dateStr
                              );
                              if (squareNotes.length === 0) return null;
                              return squareNotes.map((noteItem) => (
                                <Box key={noteItem.id} className="parent-note-item" sx={{ color: branding.notes.color, mb: 1 }}>
                                  <FormattedParentNote
                                    noteId={noteItem.id}
                                    title={noteItem.title}
                                    description={noteItem.description}
                                    color={branding.notes.color}
                                    iconName={branding.notes.icon}
                                    onToggleCheckbox={handleToggleParentNoteCheckbox}
                                  />
                                </Box>
                              ));
                            })()}
                            {cellSchoolAssignments.map((a) => (
                              <div key={a.id} className="school-assignment-item" style={{ color: branding.assignments.color }}>
                                <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} style={{ marginRight: 4, display: 'inline' }} />
                                [{a.category.toUpperCase()}] {a.title}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
                        value={todoText}
                        onChange={(e) => {
                          const updated = [...plannerSettings.todos];
                          updated[idx] = e.target.value;
                          handleSaveSettings({ ...plannerSettings, todos: updated });
                        }}
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
                        value={pText}
                        onChange={(e) => {
                          const updated = [...plannerSettings.priorities];
                          updated[idx] = e.target.value;
                          handleSaveSettings({ ...plannerSettings, priorities: updated });
                        }}
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
              <Box className="sidebar-section">
                <div className="sidebar-header-badge">FOR NEXT MONTH</div>
                <textarea
                  className="sidebar-textarea sidebar-textarea-next-month"
                  value={plannerSettings.for_next_month}
                  onChange={(e) =>
                    handleSaveSettings({ ...plannerSettings, for_next_month: e.target.value })
                  }
                  rows={4}
                />
              </Box>

              {/* NOTES Section */}
              <Box className="sidebar-section">
                <div className="sidebar-header-badge">NOTES</div>
                <textarea
                  className="sidebar-textarea sidebar-textarea-notes"
                  value={plannerSettings.notes}
                  onChange={(e) =>
                    handleSaveSettings({ ...plannerSettings, notes: e.target.value })
                  }
                  rows={6}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

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
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Drawer Header */}
          <Box
            px={3}
            py={2}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800} fontSize="1.05rem" color="text.primary">
                {selectedSubject?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {selectedDate}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {!isFormOpen && (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={handleAddNewNoteForm}
                  startIcon={<Plus size={16} />}
                  sx={{ fontWeight: 700, px: 1.5 }}
                >
                  + Note
                </Button>
              )}
              <IconButton size="small" onClick={() => setOpenCellModal(false)}>
                <X size={20} />
              </IconButton>
            </Stack>
          </Box>

          {/* Drawer Body Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {/* Section 1: Parent Notes List / Form */}
            <Box mb={3}>
              <Typography variant="subtitle2" fontWeight={700} color="primary.main" mb={1.5} display="flex" alignItems="center" gap={1}>
                <FileText size={18} />
                Parent Notes &amp; Reminders
              </Typography>

              {/* IF FORM IS OPEN (creating new note or editing an existing note) */}
              {isFormOpen ? (
                <Box p={2.5} sx={{ bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={800} mb={1.5}>
                    {editingNoteId ? 'Edit Parent Note' : 'Add New Parent Note'}
                  </Typography>

                  <Stack spacing={2}>
                    {/* Note Header (Always Bold) */}
                    <TextField
                      fullWidth
                      size="small"
                      label="Note Header (Always Bold)"
                      placeholder="e.g. Reading Assignment, Science Kit, Field Trip"
                      value={cellNoteHeader}
                      onChange={(e) => setCellNoteHeader(e.target.value)}
                      helperText="This title line will always display in bold font at the top of the note."
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
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: '0.78rem' }}
                      >
                        • Bullet List
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => handleInsertFormatting('checkbox')}
                        startIcon={<CheckSquare size={14} />}
                        sx={{ fontWeight: 700, px: 1, py: 0.25, fontSize: '0.78rem' }}
                      >
                        + Checkbox Item
                      </Button>
                    </Stack>

                    {/* Note Body */}
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Note Body (Bullets & Checkboxes)"
                      placeholder="e.g. • Read Chapters 4-5\n- [ ] Complete practice problems 1-10\n- [ ] Sign workbook page"
                      value={cellNoteDesc}
                      onChange={(e) => setCellNoteDesc(e.target.value)}
                    />

                    {/* Live Student Planner Preview */}
                    {(cellNoteHeader.trim() || cellNoteDesc.trim()) && (
                      <Box p={2} sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" mb={0.75}>
                          Student Planner Preview:
                        </Typography>
                        <FormattedParentNote
                          title={cellNoteHeader}
                          description={cellNoteDesc}
                          color={branding.notes.color}
                          iconName={branding.notes.icon}
                          interactive={false}
                        />
                      </Box>
                    )}

                    {/* Action buttons inside form */}
                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" pt={1}>
                      {parentNotes.some((n) => n.subject_id === selectedSubject?.id && n.note_date === selectedDate) && (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => {
                            setEditingNoteId(null);
                            setCellNoteHeader('');
                            setCellNoteDesc('');
                            setIsFormOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveCellNote}
                        disabled={savingNote || (!cellNoteHeader.trim() && !cellNoteDesc.trim())}
                        startIcon={<Save size={16} />}
                        sx={{ fontWeight: 700 }}
                      >
                        {savingNote ? 'Saving Note...' : editingNoteId ? 'Update Note' : 'Save Note'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                /* LIST VIEW OF EXISTING PARENT NOTES ON THIS SQUARE */
                <Stack spacing={2}>
                  {(() => {
                    const squareNotes = parentNotes.filter(
                      (n) => n.subject_id === selectedSubject?.id && n.note_date === selectedDate
                    );

                    return squareNotes.map((n, idx) => (
                      <Card key={n.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1}>
                          <Typography variant="caption" fontWeight={800} color="text.secondary">
                            Parent Note #{idx + 1}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <IconButton size="small" color="primary" onClick={() => handleStartEditNote(n)}>
                              <Edit2 size={16} />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteSingleParentNote(n.id)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Stack>
                        </Box>

                        <FormattedParentNote
                          noteId={n.id}
                          title={n.title}
                          description={n.description}
                          color={branding.notes.color}
                          iconName={branding.notes.icon}
                          interactive={false}
                        />
                      </Card>
                    ));
                  })()}

                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleAddNewNoteForm}
                    startIcon={<Plus size={16} />}
                    sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
                  >
                    + Add Another Parent Note
                  </Button>
                </Stack>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Section 2: School Assignments */}
            <Typography variant="subtitle2" fontWeight={700} color="success.main" mb={1.5} display="flex" alignItems="center" gap={1}>
              <FileText size={18} />
              Quick Add School Assignment
            </Typography>
            <Stack spacing={2} pt={0.5}>
              <TextField
                fullWidth
                size="small"
                label="Assignment Title"
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
                  label="Category"
                  value={assignmentCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isAssignmentCategory(val)) setAssignmentCategory(val);
                  }}
                  sx={{ flex: 1 }}
                >
                  <option value="homework">Homework</option>
                  <option value="project">Project</option>
                  <option value="test">Test</option>
                  <option value="quiz">Quiz</option>
                  <option value="reading">Reading</option>
                  <option value="paper">Paper</option>
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
                variant="outlined"
                color="success"
                onClick={handleCreateCellAssignment}
                disabled={savingAssignment || !assignmentTitle.trim()}
                startIcon={<Plus size={16} />}
                sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
              >
                {savingAssignment ? 'Adding...' : 'Add School Assignment'}
              </Button>
            </Stack>
          </Box>

          {/* Drawer Footer */}
          <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpenCellModal(false)} variant="outlined" color="inherit" sx={{ fontWeight: 700 }}>
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
              borderRadius: 3,
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
                  <Typography variant="h6" fontWeight={800}>
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
              <IconButton size="small" onClick={() => setOpenPopulateModal(false)}>
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
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Subject Placeholders ({getWeekSequenceSummary()})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {populateOverwriteExisting
                      ? 'Existing recurring subject notes in this week will be refreshed with the selected Week # and Math Days.'
                      : 'Empty subject cells in this week will be populated from your active subject recurring rules (with Attend Class labels placed as bold note headers).'}
                  </Typography>
                </Paper>
              )}

              <Typography variant="subtitle2" fontWeight={800} mb={0.5}>
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
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
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
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
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
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
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
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
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
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
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
                sx={{ textTransform: 'none', fontWeight: 600 }}
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
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Populate Placeholders Only
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={populatingWeek}
                    startIcon={<Sparkles size={16} />}
                    onClick={() => handlePopulateWeek(populateOverwriteExisting, true)}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
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
                  sx={{ textTransform: 'none', fontWeight: 700 }}
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
            sx={{ width: '100%', maxWidth: 440, borderRadius: 3, overflow: 'hidden' }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800}>
                Reset Week ({weekStartDate})?
              </Typography>
            </Box>
            <Box p={3}>
              <Typography variant="body2" color="text.secondary">
                This will clear all Parent Notes and custom week counter overrides for the week of <strong>{weekStartDate}</strong> ({weekDates[0]?.dateStr} to {weekDates[weekDates.length - 1]?.dateStr}).
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1.5}>
                After resetting, you can click <strong>Populate Week Placeholders</strong> to generate fresh placeholders from your subject recurring rules.
              </Typography>
            </Box>
            <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => setConfirmResetOpen(false)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleResetWeek}
                disabled={resettingWeek}
                startIcon={<RotateCcw size={16} />}
                sx={{ fontWeight: 700 }}
              >
                {resettingWeek ? 'Resetting...' : 'Reset Week'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* CSS STYLES FOR PRINTING & BINDER LAYOUT */}
      <style jsx global>{`
        /* Screen & Print Base Layout */
        .planner-print-root {
          font-family: Arial, sans-serif;
          color: #000000;
        }

        .print-page {
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          min-height: 840px;
          display: flex;
          flex-direction: column;
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
        }

        .day-header-col {
          background-color: #fcecdb;
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          padding: 10px;
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
          color: #000000;
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
          color: #000000;
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

        /* PRINT STYLING FOR 2-PAGE PORTRAIT BINDER PDF */
        @media print {
          @page {
            size: letter portrait;
            margin: 0.22in 0.28in;
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
            font-size: 10px !important;
          }

          .planner-print-root {
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
            height: 10.45in !important;
            max-height: 10.45in !important;
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

          .planner-header {
            height: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            margin-bottom: 6px !important;
            padding: 0 6px !important;
            flex-shrink: 0 !important;
          }

          .planner-header span:first-of-type {
            font-size: 18px !important;
          }

          .planner-header span:last-of-type {
            font-size: 32px !important;
          }

          .week-header-text {
            font-size: 12px !important;
          }

          .planner-table {
            flex: 1 !important;
            height: 100% !important;
          }

          .planner-table tbody tr {
            height: 1% !important;
          }

          .planner-table th,
          .planner-table td {
            padding: 2px 4px !important;
          }

          .day-header-col {
            padding: 3px 4px !important;
            font-size: 10px !important;
          }

          .subject-header-col {
            padding: 3px 4px !important;
            font-size: 10px !important;
          }

          .subject-name-cell {
            font-size: 11px !important;
            padding: 2px 4px !important;
          }

          .assignment-cell {
            min-height: 28px !important;
            height: auto !important;
            padding: 2px 4px !important;
            font-size: 10.5px !important;
            line-height: 1.25 !important;
          }

          .all-day-events-row {
            background-color: #f7f9fc !important;
          }

          .all-day-label-cell {
            font-size: 8px !important;
            padding: 1px 3px !important;
            vertical-align: middle !important;
          }

          .all-day-events-cell {
            padding: 1px 3px !important;
            vertical-align: middle !important;
          }

          .all-day-items-wrapper {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 1px 3px !important;
            align-items: center !important;
            width: 100% !important;
          }

          .holiday-banner-top {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1.5px solid #000000 !important;
            font-weight: 800 !important;
            font-size: 8px !important;
            padding: 1px 3px !important;
            margin-bottom: 0 !important;
            line-height: 1.15 !important;
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
            font-size: 8px !important;
            padding: 1px 3px !important;
            margin-bottom: 0 !important;
            line-height: 1.15 !important;
            display: inline-flex !important;
            align-items: center !important;
            white-space: nowrap !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .all-day-empty {
            color: #777777 !important;
            font-size: 8px !important;
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
            flex: 1 !important;
            height: 100% !important;
            display: flex !important;
          }

          .page2-table-wrapper {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
          }

          .sidebar-column {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
          }

          .parent-note-item {
            margin-bottom: 1px !important;
            font-size: 10.5px !important;
            line-height: 1.25 !important;
          }

          .formatted-parent-note-block {
            font-size: 10.5px !important;
            margin-bottom: 1px !important;
            padding-bottom: 0 !important;
          }

          .formatted-parent-note-block .note-header-title {
            font-size: 10.5px !important;
          }

          .formatted-parent-note-block .note-checkbox-icon {
            font-size: 10.5px !important;
            padding-top: 0 !important;
          }

          .formatted-parent-note-block > div {
            margin-top: 1px !important;
            margin-bottom: 1px !important;
            line-height: 1.25 !important;
          }

          .school-assignment-item {
            margin-bottom: 1px !important;
            font-size: 10.5px !important;
            line-height: 1.25 !important;
            color: #000000 !important;
            font-weight: 700 !important;
          }

          .sidebar-section {
            margin-bottom: 4px !important;
          }

          .sidebar-header-badge {
            font-size: 10px !important;
            padding: 1px 3px !important;
            margin-bottom: 2px !important;
          }

          .sidebar-textarea-next-month {
            flex: 1 !important;
            min-height: 60px !important;
            font-size: 10px !important;
          }

          .sidebar-textarea-notes {
            flex: 1.2 !important;
            min-height: 75px !important;
            font-size: 10px !important;
          }

          .todo-list {
            gap: 2px !important;
          }

          .todo-item {
            gap: 4px !important;
          }

          .checkbox-square {
            width: 10px !important;
            height: 10px !important;
          }

          .sidebar-input {
            font-size: 10px !important;
            border-bottom: 1px solid #999999 !important;
          }

          .sidebar-textarea {
            font-size: 10px !important;
            border: 1px solid #999999 !important;
            padding: 3px !important;
          }

          .habits-table {
            font-size: 9.5px !important;
          }

          .habits-table th,
          .habits-table td {
            padding: 1px 0 !important;
          }

          .bubble-circle {
            width: 8px !important;
            height: 8px !important;
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
