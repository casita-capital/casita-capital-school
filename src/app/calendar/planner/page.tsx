'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Printer,
  Plus,
  Edit2,
  Trash2,
  CheckSquare,
  Sparkles,
  Save,
  BookOpen,
  Settings,
  GripVertical,
  ArrowUp,
  ArrowDown,
  FileText,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { ItemIcon } from 'src/components/base/item-icon';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
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

interface SchoolAssignment {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  category: 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
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

function PlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const supabase = createClient();
  const { branding } = useSchoolSettings();

  const initialWeek = searchParams.get('week') || '2026-09-14';
  const [weekStartDate, setWeekStartDate] = useState<string>(initialWeek);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
  });

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
  const [assignmentCategory, setAssignmentCategory] = useState<'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper'>('homework');
  const [assignmentPriority, setAssignmentPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Modal State for managing Subjects & Habits
  const [openManagerModal, setOpenManagerModal] = useState(false);
  const [managerTab, setManagerTab] = useState<'subjects' | 'habits'>('subjects');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#0C74E4');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [savingManager, setSavingManager] = useState(false);

  const getWeekDates = (monDateStr: string) => {
    const monday = new Date(monDateStr + 'T00:00:00');
    const dates: { dateStr: string; dayName: string; formatted: string }[] = [];
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
        formatted: monthDayStr,
      });
    }
    return dates;
  };

  const weekDates = getWeekDates(weekStartDate);

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
      const endDate = endDateObj.toISOString().split('T')[0];

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
        });
      } else {
        setPlannerSettings({
          week_start_date: monStr,
          todos: ['', '', '', '', '', '', '', '', '', ''],
          priorities: ['', '', ''],
          for_next_month: '',
          notes: '',
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
    const newStr = cur.toISOString().split('T')[0];
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
  };

  const handleNextWeek = async () => {
    await handleSaveSettings(plannerSettings);
    const cur = new Date(weekStartDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 7);
    const newStr = cur.toISOString().split('T')[0];
    setWeekStartDate(newStr);
    router.replace(`/calendar/planner?week=${newStr}`);
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
        // Update existing parent note
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
        // Insert new parent note
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
      } = {
        week_start_date: targetWeek,
        todos: newSettings.todos,
        priorities: newSettings.priorities,
        for_next_month: newSettings.for_next_month,
        notes: newSettings.notes,
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

  const monStr = weekStartDate;

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

  return (
    <Box>
      {/* HEADER & CONTROLS (Hidden during PDF print) */}
      <Box className="no-print" mb={4}>
        <PageHeading
          heading="Weekly Binder Planner Creator"
          caption="Dynamically render 2-page portrait binder layouts for school subjects, parent notes, school assignments, and habits."
          actions={
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Settings size={18} />}
                onClick={() => router.push('/subjects-habits')}
                sx={{ fontWeight: 600 }}
              >
                Define Subjects &amp; Habits
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Printer size={18} />}
                onClick={handlePrint}
                sx={{ fontWeight: 700 }}
              >
                Print 2-Page Binder Planner (PDF)
              </Button>
            </Stack>
          }
        />

        {/* Date Selector Navigation Bar */}
        <Card elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton onClick={handlePrevWeek} color="primary">
                <ChevronLeft size={22} />
              </IconButton>
              <Typography variant="h5" fontWeight={700} sx={{ minWidth: 260, textAlign: 'center' }}>
                WEEK OF: {weekStartDate}
              </Typography>

              <IconButton onClick={handleNextWeek} color="primary">
                <ChevronRight size={22} />
              </IconButton>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Click any grid cell below to add or edit Parent Notes &amp; School Assignments.
            </Typography>
          </Stack>
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
            </thead>
            <tbody>
              {/* DEDICATED ALL-DAY EVENTS ROW FOR HOLIDAYS & DAILY TASKS */}
              <tr className="all-day-events-row">
                <td className="all-day-label-cell">
                  HOLIDAYS &amp; TASKS
                </td>
                {page1Days.map((d) => {
                  const dayHolidays = holidays.filter((h) => h.holiday_date === d.dateStr);
                  const dayTasks = tasksList.filter((t) => t.due_date === d.dateStr);
                  const hasEvents = dayHolidays.length > 0 || dayTasks.length > 0;

                  return (
                    <td key={d.dateStr} className="all-day-events-cell">
                      {dayHolidays.map((h) => (
                        <div key={h.id} className="holiday-banner-top" style={{ backgroundColor: branding.holidays.color }}>
                          <ItemIcon name={branding.holidays.icon} size={11} color="#ffffff" style={{ marginRight: 4, display: 'inline' }} />
                          {h.title}
                        </div>
                      ))}
                      {dayTasks.map((t) => (
                        <div key={t.id} className="task-banner-top" style={{ backgroundColor: branding.tasks.color }}>
                          <ItemIcon name={branding.tasks.icon} size={11} color="#ffffff" style={{ marginRight: 4, display: 'inline' }} />
                          {t.status === 'completed' ? '✓' : '☐'} {t.title}
                        </div>
                      ))}
                      {!hasEvents && <div className="all-day-empty">—</div>}
                    </td>
                  );
                })}
              </tr>

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
                </thead>
                <tbody>
                  {/* DEDICATED ALL-DAY EVENTS ROW FOR HOLIDAYS & DAILY TASKS */}
                  <tr className="all-day-events-row">
                    <td className="all-day-label-cell">
                      HOLIDAYS &amp; TASKS
                    </td>
                    {page2Days.map((d) => {
                      const dayHolidays = holidays.filter((h) => h.holiday_date === d.dateStr);
                      const dayTasks = tasksList.filter((t) => t.due_date === d.dateStr);
                      const dayGoogleEvents = googleEvents.filter((g) => g.event_date === d.dateStr);
                      const hasEvents = dayHolidays.length > 0 || dayTasks.length > 0 || dayGoogleEvents.length > 0;

                      return (
                        <td key={d.dateStr} className="all-day-events-cell">
                          {dayHolidays.map((h) => (
                            <div key={h.id} className="holiday-banner-top" style={{ backgroundColor: branding.holidays.color }}>
                              <ItemIcon name={branding.holidays.icon} size={11} color="#ffffff" style={{ marginRight: 4, display: 'inline' }} />
                              {h.title}
                            </div>
                          ))}
                          {dayGoogleEvents.map((g) => (
                            <div key={g.id} className="task-banner-top" style={{ backgroundColor: g.color || '#4285F4' }}>
                              <ItemIcon name="Calendar" size={11} color="#ffffff" style={{ marginRight: 4, display: 'inline' }} />
                              {g.title}
                            </div>
                          ))}
                          {dayTasks.map((t) => (
                            <div key={t.id} className="task-banner-top" style={{ backgroundColor: branding.tasks.color }}>
                              <ItemIcon name={branding.tasks.icon} size={11} color="#ffffff" style={{ marginRight: 4, display: 'inline' }} />
                              {t.status === 'completed' ? '✓' : '☐'} {t.title}
                            </div>
                          ))}
                          {!hasEvents && <div className="all-day-empty">—</div>}
                        </td>
                      );
                    })}
                  </tr>

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

      {/* CELL PARENT NOTES & ASSIGNMENT EDITOR MODAL */}
      <Dialog open={openCellModal} onClose={() => setOpenCellModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700} display="flex" alignItems="center" justifyContent="space-between">
          <span>{selectedSubject?.name} — {selectedDate}</span>
          {!isFormOpen && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleAddNewNoteForm}
              startIcon={<Plus size={16} />}
              sx={{ fontWeight: 700 }}
            >
              + Add Parent Note
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {/* Section 1: Parent Notes List / Form */}
          <Box mb={3}>
            <Typography variant="subtitle2" fontWeight={700} color="primary.main" mb={1} display="flex" alignItems="center" gap={1}>
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

          <Divider sx={{ my: 2 }} />

          {/* Section 2: School Assignments */}
          <Typography variant="subtitle2" fontWeight={700} color="success.main" mb={1} display="flex" alignItems="center" gap={1}>
            <FileText size={18} />
            Quick Add School Assignment
          </Typography>
          <Stack spacing={2} pt={1}>
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
                size="small"
                label="Category"
                value={assignmentCategory}
                onChange={(e) => setAssignmentCategory(e.target.value as any)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="homework">Homework</MenuItem>
                <MenuItem value="project">Project</MenuItem>
                <MenuItem value="test">Test</MenuItem>
                <MenuItem value="quiz">Quiz</MenuItem>
                <MenuItem value="reading">Reading</MenuItem>
                <MenuItem value="paper">Paper</MenuItem>
              </TextField>
              <TextField
                fullWidth
                select
                size="small"
                label="Priority"
                value={assignmentPriority}
                onChange={(e) => setAssignmentPriority(e.target.value as any)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
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
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCellModal(false)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
          height: 85px;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.4;
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
          font-size: 10px;
          font-weight: 800;
          padding: 6px 4px !important;
          color: #2b6cb0;
          vertical-align: middle !important;
        }

        .all-day-events-cell {
          min-height: 28px;
          padding: 6px 8px !important;
          vertical-align: top;
          font-size: 11px;
          background-color: #f7f9fc;
        }

        .holiday-banner-top {
          background-color: #d32f2f;
          color: #ffffff;
          font-weight: bold;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 3px;
          display: inline-block;
          margin-right: 4px;
        }

        .task-banner-top {
          background-color: #2e7d32;
          color: #ffffff;
          font-weight: bold;
          font-size: 10.5px;
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 3px;
          display: inline-block;
          margin-right: 4px;
        }

        .all-day-empty {
          color: #a0aec0;
          font-size: 11px;
          text-align: center;
        }

        .parent-note-item {
          color: #1a1a1a;
          font-weight: 600;
          font-size: 11.5px;
          margin-bottom: 3px;
          word-break: break-word;
        }

        .school-assignment-item {
          color: #0C74E4;
          font-weight: 700;
          font-size: 11px;
          margin-bottom: 2px;
          word-break: break-word;
        }

        /* Page 2 Equalized Grid & Compact Sidebar Styling */
        .page2-container {
          display: flex;
          width: 100%;
          gap: 0px;
          box-sizing: border-box;
        }

        .page2-table-wrapper {
          width: calc(135px + ((100% - 135px) * (2 / 3)));
          flex-shrink: 0;
          box-sizing: border-box;
          padding-right: 8px;
        }

        .sidebar-column {
          width: calc((100% - 135px) * (1 / 3));
          flex-shrink: 0;
          box-sizing: border-box;
          padding-left: 8px;
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
          .no-print, header, nav, aside {
            display: none !important;
          }

          body {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .print-page {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }

          .page-break {
            break-after: page;
            page-break-after: always;
          }

          .sidebar-input {
            border-bottom: 1px solid #999999 !important;
          }

          .sidebar-textarea {
            border: 1px solid #999999 !important;
          }

          .holiday-banner-top {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1.5px solid #000000 !important;
            font-weight: 800 !important;
          }

          .task-banner-top {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #333333 !important;
            font-weight: 700 !important;
          }

          .school-assignment-item {
            color: #000000 !important;
            font-weight: 700 !important;
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
