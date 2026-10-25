'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Printer,
  Plus,
  ArrowRight,
  CheckSquare,
  Sparkles,
  Edit3,
  Menu as MenuIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { expandTasksForDateRange } from 'src/utils/task-recurrence';
import { ItemIcon } from 'src/components/base/item-icon';
import {
  FormattedParentNote,
  getPlannerNoteCategory,
} from 'src/components/base/formatted-parent-note';

interface Holiday {
  id: string;
  title: string;
  holiday_date: string;
  category: string;
  is_enabled: boolean;
}

interface ParentNote {
  id: string;
  subject_id: string;
  note_date: string;
  title?: string | null;
  description: string;
}

interface SubjectItem {
  id: string;
  name: string;
  color: string;
}

interface SchoolAssignment {
  id: string;
  title: string;
  due_date: string;
  category: string;
  subject_id?: string | null;
  workflow_status?: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

interface GoogleCalendarEventItem {
  id: string;
  title: string;
  event_date: string;
  color: string;
  is_all_day: boolean;
}

export default function MasterCalendarPage() {
  const router = useRouter();
  const theme = useTheme();
  const supabase = createClient();
  const { schoolName, branding } = useSchoolSettings();

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [schoolAssignments, setSchoolAssignments] = useState<SchoolAssignment[]>([]);
  const [tasksList, setTasksList] = useState<TaskItem[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventItem[]>([]);

  // Filter toggles for printable monthly overview
  const [showHolidays, setShowHolidays] = useState(true);
  const [showSchoolWork, setShowSchoolWork] = useState(true);
  const [showParentNotes, setShowParentNotes] = useState(true);
  const [showSchoolAssignments, setShowSchoolAssignments] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showGoogleCalendars, setShowGoogleCalendars] = useState(true);
  const [layersMenuAnchorEl, setLayersMenuAnchorEl] = useState<null | HTMLElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const [monthlyNotes, setMonthlyNotes] = useState('');
  const printContainerRef = useRef<HTMLDivElement | null>(null);
  const printInnerRef = useRef<HTMLDivElement | null>(null);

  const resetMonthlyPrintAutoFit = useCallback(() => {
    const containerEl = printContainerRef.current;
    const innerEl = printInnerRef.current;
    if (containerEl) {
      containerEl.classList.remove('print-measuring');
    }
    if (innerEl) {
      innerEl.style.transform = '';
      innerEl.style.transformOrigin = '';
      innerEl.style.width = '';
      innerEl.style.height = '';
    }
  }, []);

  const applyMonthlyPrintAutoFit = useCallback(() => {
    const containerEl = printContainerRef.current;
    const innerEl = printInnerRef.current;
    if (!containerEl || !innerEl) return;

    resetMonthlyPrintAutoFit();

    // Printable US Letter Landscape height at 96dpi (8.5in - 0.5in margins = 8.0in -> 760px safe target)
    const TARGET_LANDSCAPE_HEIGHT_PX = 756;
    containerEl.classList.add('print-measuring');

    const contentHeight = innerEl.scrollHeight;
    if (contentHeight > TARGET_LANDSCAPE_HEIGHT_PX) {
      const rawScale = TARGET_LANDSCAPE_HEIGHT_PX / contentHeight;
      const scale = Math.max(0.55, Math.floor(rawScale * 1000) / 1000);
      innerEl.style.width = `${(100 / scale).toFixed(3)}%`;
      innerEl.style.transform = `scale(${scale})`;
      innerEl.style.transformOrigin = 'top left';
      innerEl.style.height = `${Math.floor(TARGET_LANDSCAPE_HEIGHT_PX / scale)}px`;
    }

    containerEl.classList.remove('print-measuring');
  }, [resetMonthlyPrintAutoFit]);

  useEffect(() => {
    const onBeforePrint = () => applyMonthlyPrintAutoFit();
    const onAfterPrint = () => resetMonthlyPrintAutoFit();
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [applyMonthlyPrintAutoFit, resetMonthlyPrintAutoFit]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`school_monthly_notes_${monthKey}`);
      setMonthlyNotes(saved || '');
    }
  }, [monthKey]);

  const handleUpdateMonthlyNotes = (text: string) => {
    setMonthlyNotes(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_monthly_notes_${monthKey}`, text);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  async function loadCalendarData() {
    try {
      // 0. Fetch Subjects
      const { data: subjectData } = await supabase
        .from('subjects')
        .select('id, name, color')
        .order('sort_order', { ascending: true });

      if (subjectData) {
        setSubjects(subjectData as SubjectItem[]);
      }

      // 1. Fetch Holidays
      const { data: holidayData } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_enabled', true);

      if (holidayData) {
        setHolidays(holidayData as Holiday[]);
      }

      // 2. Fetch Parent Notes
      const { data: noteData } = await supabase
        .from('parent_notes')
        .select('*');

      if (noteData) {
        setParentNotes(noteData as ParentNote[]);
      }

      // 3. Fetch School Assignments
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*');

      if (assignData) {
        setSchoolAssignments(assignData as SchoolAssignment[]);
      }

      // 4. Fetch Tasks with due dates & recurring schedules
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*');

      if (taskData) {
        const nowY = new Date().getFullYear();
        const expanded = expandTasksForDateRange(
          taskData,
          `${nowY - 1}-01-01`,
          `${nowY + 1}-12-31`
        );
        setTasksList(
          expanded.map((occ) => ({
            id: occ.occurrenceId,
            title: occ.title,
            due_date: occ.occurrenceDate,
            status: occ.isCompleted ? 'completed' : 'pending',
            priority: occ.priority,
          }))
        );
      }

      // 5. Fetch Enabled Google Calendar Connections & Events
      const { data: connData } = await supabase
        .from('google_calendar_connections')
        .select('id, color')
        .eq('is_enabled', true)
        .eq('show_on_monthly', true);

      if (connData && connData.length > 0) {
        const connIds = connData.map((c) => c.id);
        const { data: gEvtData } = await supabase
          .from('google_calendar_events')
          .select('*')
          .in('connection_id', connIds);

        if (gEvtData) {
          setGoogleEvents(gEvtData as GoogleCalendarEventItem[]);
        }
      } else {
        setGoogleEvents([]);
      }
    } catch {
      toast.error('Error loading calendar data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendarData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Helper to format date YYYY-MM-DD
  const formatDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Get Monday of a given week row (Sunday to Saturday)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diff = date.getDate() - day + 1; // In a Sunday-to-Saturday row, Sunday is index 0 and Monday is +1
    return new Date(date.setDate(diff));
  };

  const handleJumpToWeek = (date: Date) => {
    const monday = getMonday(date);
    const mondayStr = formatDateStr(monday);
    router.push(`/calendar/planner?week=${mondayStr}`);
  };

  const handlePrint = () => {
    applyMonthlyPrintAutoFit();
    window.print();
  };

  // Build Month Grid matrix (7 cols x 5 or 6 rows)
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarRows: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Fill padding days for first week
  for (let i = 0; i < firstDayOfMonth; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      calendarRows.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    calendarRows.push(currentWeek);
  }

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const activeLayersCount = [
    showHolidays,
    showSchoolWork,
    showParentNotes,
    showSchoolAssignments,
    showTasks,
    showGoogleCalendars,
  ].filter(Boolean).length;

  return (
    <Box>
      {/* UNIFIED TOP HEADER & CONTROLS (Hidden during PDF print) */}
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
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            {/* Left: Month Title + Inline Stepper */}
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ minWidth: 185 }}>
                {monthNames[month]} {year}
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
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  sx={{ borderRadius: 1.5, p: 0.6 }}
                >
                  <ChevronLeft size={18} />
                </IconButton>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    const now = new Date();
                    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    px: 1.25,
                    py: 0.3,
                    minWidth: 'auto',
                  }}
                >
                  Today
                </Button>
                <IconButton
                  size="small"
                  onClick={handleNextMonth}
                  title="Next Month"
                  sx={{ borderRadius: 1.5, p: 0.6 }}
                >
                  <ChevronRight size={18} />
                </IconButton>
              </Box>
            </Stack>

            {/* Right: Print Month + 3-Line Layers & View Menu */}
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Button
                variant="contained"
                color="primary"
                onClick={handlePrint}
                startIcon={<Printer size={17} />}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2.25,
                  py: 0.9,
                }}
              >
                Print Month
              </Button>

              <Button
                variant="outlined"
                color="inherit"
                startIcon={<MenuIcon size={17} />}
                onClick={(e) => setLayersMenuAnchorEl(e.currentTarget)}
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
                Layers &amp; View ({activeLayersCount}/6)
              </Button>

              <Menu
                anchorEl={layersMenuAnchorEl}
                open={Boolean(layersMenuAnchorEl)}
                onClose={() => setLayersMenuAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 250,
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
                  Visible Calendar Layers
                </Typography>

                <MenuItem
                  onClick={() => setShowHolidays((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    Holidays
                  </Typography>
                  <Checkbox checked={showHolidays} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <MenuItem
                  onClick={() => setShowSchoolWork((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    School Work
                  </Typography>
                  <Checkbox checked={showSchoolWork} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <MenuItem
                  onClick={() => setShowParentNotes((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    Parent Notes
                  </Typography>
                  <Checkbox checked={showParentNotes} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <MenuItem
                  onClick={() => setShowSchoolAssignments((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    School Assignments
                  </Typography>
                  <Checkbox checked={showSchoolAssignments} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <MenuItem
                  onClick={() => setShowTasks((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    To-Do Tasks
                  </Typography>
                  <Checkbox checked={showTasks} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <MenuItem
                  onClick={() => setShowGoogleCalendars((prev) => !prev)}
                  sx={{ borderRadius: 1.5, py: 0.5, justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" fontWeight={600} color="primary.main">
                    Google Calendars
                  </Typography>
                  <Checkbox checked={showGoogleCalendars} size="small" color="primary" sx={{ p: 0.5 }} />
                </MenuItem>

                <Divider sx={{ my: 0.75 }} />

                <MenuItem
                  onClick={() => {
                    setLayersMenuAnchorEl(null);
                    router.push('/calendar/planner');
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, color: 'primary.main' }}
                >
                  <CalendarIcon size={16} />
                  <Typography variant="body2" fontWeight={700}>
                    Open Weekly Binder Planner →
                  </Typography>
                </MenuItem>
              </Menu>
            </Stack>
          </Stack>
        </Card>
      </Box>

      {/* PRINTABLE MONTHLY CALENDAR CONTAINER */}
      <Box
        ref={printContainerRef}
        className="monthly-print-container"
        sx={{
          bgcolor: 'background.paper',
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 4,
        }}
      >
        <div ref={printInnerRef} className="monthly-print-inner">
        {/* Printable Title Banner */}
        <Box
          className="monthly-print-header"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
          pb={1.5}
          borderBottom="2px solid"
          borderColor="divider"
        >
          <Box>
            <Typography
              variant="h3"
              fontWeight={800}
              color="primary.main"
              letterSpacing={0.5}
              className="monthly-print-title"
            >
              {monthNames[month].toUpperCase()} {year}
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              color="text.secondary"
              className="monthly-print-subtitle"
            >
              {schoolName} — Master School &amp; Family Calendar
            </Typography>
          </Box>
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            className="monthly-print-page-label"
          >
            Page 1 of 1 (Monthly View)
          </Typography>
        </Box>

        {/* Month Grid Table */}
        <Box
          className="monthly-grid-wrapper"
          sx={{ borderTop: '1px solid', borderLeft: '1px solid', borderColor: 'divider' }}
        >
          {/* Header Row: Column for Edit Week + 7 Days */}
          <Grid container className="monthly-grid-header-row" sx={{ bgcolor: 'action.hover' }}>
            <Grid
              item
              xs={1.4}
              className="week-col-head"
              sx={{
                p: 1,
                borderRight: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
                color: 'text.secondary',
              }}
            >
              PLANNER
            </Grid>

            {daysOfWeek.map((dayName) => (
              <Grid
                item
                xs={(12 - 1.4) / 7}
                key={dayName}
                className="day-col-head"
                sx={{
                  p: 1,
                  borderRight: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  letterSpacing: 0.5,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                }}
              >
                {dayName}
              </Grid>
            ))}
          </Grid>

          {/* Calendar Rows */}
          {calendarRows.map((week, wIndex) => {
            const firstValidDate = week.find((d) => d !== null);
            const representativeDate = firstValidDate || new Date(year, month, 1);

            return (
              <Grid container key={`week-row-${wIndex}`} className="monthly-week-row">
                {/* Single Edit Week Button Column on Left (hidden during print) */}
                <Grid
                  item
                  xs={1.4}
                  className="week-col"
                  sx={{
                    minHeight: 85,
                    p: 1,
                    borderRight: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.08)' : 'rgba(12, 116, 228, 0.04)'),
                  }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<Edit3 size={14} />}
                    onClick={() => handleJumpToWeek(representativeDate)}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      py: 0.75,
                      px: 1,
                      borderRadius: 2,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Edit Week
                  </Button>
                </Grid>

                {/* 7 Day Cells */}
                {week.map((dateObj, dIndex) => {
                  if (!dateObj) {
                    return (
                      <Grid
                        item
                        xs={(12 - 1.4) / 7}
                        key={`empty-${wIndex}-${dIndex}`}
                        className="day-col empty-cell"
                        sx={{
                          minHeight: 85,
                          borderRight: '1px solid',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                        }}
                      />
                    );
                  }

                  const dateStr = formatDateStr(dateObj);
                  const dayHolidays = showHolidays ? holidays.filter((h) => h.holiday_date === dateStr) : [];
                  const dayNotes = parentNotes.filter((n) => {
                    if (n.note_date !== dateStr) return false;
                    const cat = getPlannerNoteCategory(n.title, n.description);
                    return cat === 'parent_note' ? showParentNotes : showSchoolWork;
                  });
                  const daySchoolAssignments = showSchoolAssignments
                    ? schoolAssignments.filter(
                        (a) =>
                          a.due_date === dateStr &&
                          a.workflow_status !== 'staged' &&
                          a.workflow_status !== 'ignored'
                      )
                    : [];
                  const dayTasks = showTasks ? tasksList.filter((t) => t.due_date === dateStr) : [];
                  const dayGoogleEvents = showGoogleCalendars ? googleEvents.filter((g) => g.event_date === dateStr) : [];
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  return (
                    <Grid
                      item
                      xs={(12 - 1.4) / 7}
                      key={dateStr}
                      className="day-col"
                      sx={{
                        minHeight: 85,
                        p: 0.75,
                        borderRight: '1px solid',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isWeekend
                          ? (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa')
                          : 'background.paper',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={800}
                          className="date-number"
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: dayHolidays.length > 0 ? '#d32f2f' : 'transparent',
                            color: dayHolidays.length > 0 ? '#ffffff' : 'text.primary',
                          }}
                        >
                          {dateObj.getDate()}
                        </Typography>
                      </Box>

                      <Stack spacing={0.25}>
                        {/* Holidays */}
                        {dayHolidays.map((h) => (
                          <Chip
                            key={h.id}
                            label={h.title}
                            size="small"
                            className="holiday-chip"
                            icon={<ItemIcon name={branding.holidays.icon} size={12} color="#ffffff" />}
                            sx={{
                              bgcolor: branding.holidays.color,
                              color: '#ffffff !important',
                              height: 18,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                            }}
                          />
                        ))}

                        {/* Google Calendar Events */}
                        {dayGoogleEvents.map((g) => (
                          <Chip
                            key={g.id}
                            label={g.title}
                            size="small"
                            icon={<CalendarIcon size={11} color="#ffffff" />}
                            sx={{
                              bgcolor: g.color || '#4285F4',
                              color: '#ffffff !important',
                              height: 18,
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              borderRadius: 1,
                              '& .MuiChip-icon': { color: '#ffffff', ml: 0.5 },
                              '& .MuiChip-label': { px: 0.8 },
                            }}
                          />
                        ))}

                        {/* School Work & Parent Notes */}
                        {dayNotes.map((n) => (
                          <Box key={n.id} className="note-item-text">
                            <FormattedParentNote
                              title={n.title}
                              description={n.description}
                              color={branding.notes.color}
                              iconName={branding.notes.icon}
                              parentNoteColor={branding.parentNotes.color}
                              parentNoteIconName={branding.parentNotes.icon}
                              interactive={false}
                            />
                          </Box>
                        ))}

                        {/* School Assignments */}
                        {daySchoolAssignments.map((a) => {
                          const subj = subjects.find((s) => s.id === a.subject_id);
                          const cleanTitle = a.title.trim();
                          const cleanCat = a.category.trim();
                          const hasSubjectInTitle =
                            subj !== undefined &&
                            cleanTitle.toLowerCase().includes(subj.name.trim().toLowerCase());

                          let formattedAssignmentLabel = cleanTitle;
                          if (subj && !hasSubjectInTitle) {
                            if (cleanTitle.toLowerCase() === cleanCat.toLowerCase()) {
                              formattedAssignmentLabel = `${subj.name} ${cleanTitle}`;
                            } else {
                              formattedAssignmentLabel = `${subj.name}: ${cleanTitle}`;
                            }
                          }

                          const fullText = `[${cleanCat.toUpperCase()}] ${formattedAssignmentLabel}`;

                          return (
                            <Typography
                              key={a.id}
                              variant="caption"
                              display="flex"
                              alignItems="center"
                              gap={0.5}
                              noWrap
                              title={fullText}
                              className="assignment-item-text"
                              sx={{ color: branding.assignments.color, fontWeight: 700, fontSize: '0.68rem' }}
                            >
                              <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} />
                              <span>{fullText}</span>
                            </Typography>
                          );
                        })}

                        {/* Tasks */}
                        {dayTasks.map((t) => (
                          <Typography key={t.id} variant="caption" display="flex" alignItems="center" gap={0.5} noWrap className="task-item-text" sx={{ color: branding.tasks.color, fontWeight: 600, fontSize: '0.66rem' }}>
                            <ItemIcon name={branding.tasks.icon} size={10} color={branding.tasks.color} />
                            <span style={{ textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
                              {t.title}
                            </span>
                          </Typography>
                        ))}
                      </Stack>
                    </Grid>
                  );
                })}
              </Grid>
            );
          })}
        </Box>

        {/* Bottom Monthly Notes & Print Signature Section */}
        <Box
          className="monthly-notes-section"
          mt={3}
          pt={2}
          borderTop="1px solid"
          borderColor="divider"
        >
          <Typography
            variant="subtitle2"
            fontWeight={800}
            mb={1}
            className="monthly-notes-heading"
          >
            Monthly Parent &amp; Teacher Notes (Prints at Bottom of Calendar Page):
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            className="monthly-notes-input no-print"
            placeholder="Type monthly curriculum goals, field trip reminders, or home study focus notes here..."
            value={monthlyNotes}
            onChange={(e) => handleUpdateMonthlyNotes(e.target.value)}
            sx={{
              bgcolor: 'background.default',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.85rem',
              },
            }}
          />
          {/* Clean Print-Only Notes Box (never overflows onto a 2nd page) */}
          <div className="monthly-notes-print-box">
            {monthlyNotes.trim() ? monthlyNotes : ''}
          </div>
        </Box>
        </div>
      </Box>

      {/* PRINT MEDIA STYLES FOR 1-PAGE LANDSCAPE MONTHLY CALENDAR */}
      <style jsx global>{`
        .monthly-notes-print-box {
          display: none;
        }

        /* Pre-print measurement mode (matches US Letter Landscape printable dimensions) */
        .monthly-print-container.print-measuring {
          width: 1002px !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
        .monthly-print-container.print-measuring .monthly-print-inner {
          display: flex !important;
          flex-direction: column !important;
          width: 1002px !important;
          min-height: 756px !important;
          height: auto !important;
        }
        .monthly-print-container.print-measuring .no-print,
        .monthly-print-container.print-measuring .week-col,
        .monthly-print-container.print-measuring .week-col-head {
          display: none !important;
        }
        .monthly-print-container.print-measuring .monthly-print-header {
          margin-bottom: 5px !important;
          padding-bottom: 4px !important;
          flex: 0 0 auto !important;
        }
        .monthly-print-container.print-measuring .monthly-print-title {
          font-size: 18px !important;
          line-height: 1.1 !important;
        }
        .monthly-print-container.print-measuring .monthly-print-subtitle,
        .monthly-print-container.print-measuring .monthly-print-page-label {
          font-size: 10px !important;
          line-height: 1.15 !important;
        }
        .monthly-print-container.print-measuring .monthly-grid-wrapper {
          flex: 1 1 0% !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
        }
        .monthly-print-container.print-measuring .monthly-grid-header-row {
          flex: 0 0 auto !important;
        }
        .monthly-print-container.print-measuring .monthly-week-row {
          flex: 1 1 0% !important;
          min-height: 0 !important;
        }
        .monthly-print-container.print-measuring .day-col-head,
        .monthly-print-container.print-measuring .day-col {
          flex-basis: calc(100% / 7) !important;
          max-width: calc(100% / 7) !important;
        }
        .monthly-print-container.print-measuring .day-col-head {
          padding: 3px 4px !important;
          font-size: 10px !important;
        }
        .monthly-print-container.print-measuring .day-col {
          min-height: 0 !important;
          padding: 3px 5px !important;
        }
        .monthly-print-container.print-measuring .monthly-notes-section {
          margin-top: 6px !important;
          padding-top: 4px !important;
          flex: 0 0 auto !important;
        }
        .monthly-print-container.print-measuring .monthly-notes-heading {
          font-size: 10px !important;
          margin-bottom: 2px !important;
        }
        .monthly-print-container.print-measuring .monthly-notes-print-box {
          display: block !important;
          min-height: 34px !important;
          max-height: 48px !important;
          border: 1px solid #999999 !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          white-space: pre-wrap !important;
          overflow: hidden !important;
        }

        @media print {
          @page {
            size: letter landscape;
            margin: 0.22in 0.28in;
          }

          html, body, main {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          .no-print, header, nav, aside, .MuiDrawer-root, .MuiBackdrop-root, .MuiModal-root {
            display: none !important;
          }

          .monthly-print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: 7.9in !important;
            max-height: 7.9in !important;
            background-color: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .monthly-print-inner {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 0% !important;
            width: 100%;
            height: 100%;
            min-height: 0 !important;
            box-sizing: border-box !important;
          }

          .monthly-print-header {
            margin-bottom: 5px !important;
            padding-bottom: 4px !important;
            border-bottom: 1.5px solid #666666 !important;
            flex: 0 0 auto !important;
          }

          .monthly-print-title {
            font-size: 18px !important;
            line-height: 1.1 !important;
            color: #000000 !important;
          }

          .monthly-print-subtitle,
          .monthly-print-page-label {
            font-size: 10px !important;
            line-height: 1.15 !important;
            color: #333333 !important;
          }

          .monthly-grid-wrapper {
            flex: 1 1 0% !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            border-color: #999999 !important;
          }

          .monthly-grid-header-row {
            flex: 0 0 auto !important;
          }

          .monthly-week-row {
            flex: 1 1 0% !important;
            min-height: 0 !important;
          }

          .week-col, .week-col-head {
            display: none !important;
          }

          .day-col-head,
          .day-col {
            flex-basis: calc(100% / 7) !important;
            max-width: calc(100% / 7) !important;
            border-color: #999999 !important;
          }

          .day-col-head {
            padding: 3px 4px !important;
            font-size: 10px !important;
            background-color: #f2f2f2 !important;
            color: #000000 !important;
          }

          .day-col {
            min-height: 0 !important;
            padding: 3px 5px !important;
            background-color: #ffffff !important;
            overflow: hidden !important;
          }

          .empty-cell {
            background-color: #f7f7f7 !important;
          }

          .date-number {
            color: #000000 !important;
            width: 18px !important;
            height: 18px !important;
            font-size: 10.5px !important;
          }

          .holiday-chip {
            background-color: #333333 !important;
            color: #ffffff !important;
            height: 15px !important;
            font-size: 9px !important;
          }

          .monthly-notes-section {
            margin-top: 6px !important;
            padding-top: 4px !important;
            border-top: 1px solid #999999 !important;
            flex: 0 0 auto !important;
          }

          .monthly-notes-heading {
            font-size: 10px !important;
            margin-bottom: 2px !important;
            color: #000000 !important;
          }

          .monthly-notes-print-box {
            display: block !important;
            min-height: 34px !important;
            max-height: 48px !important;
            border: 1px solid #999999 !important;
            border-radius: 4px !important;
            padding: 4px 8px !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            color: #000000 !important;
            background-color: #ffffff !important;
            white-space: pre-wrap !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </Box>
  );
}
