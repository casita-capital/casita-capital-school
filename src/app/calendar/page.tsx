'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { ItemIcon } from 'src/components/base/item-icon';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';

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

interface SchoolAssignment {
  id: string;
  title: string;
  due_date: string;
  category: string;
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
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // Sept 2026 default
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [schoolAssignments, setSchoolAssignments] = useState<SchoolAssignment[]>([]);
  const [tasksList, setTasksList] = useState<TaskItem[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventItem[]>([]);

  // Filter toggles for printable monthly overview
  const [showHolidays, setShowHolidays] = useState(true);
  const [showParentNotes, setShowParentNotes] = useState(true);
  const [showSchoolAssignments, setShowSchoolAssignments] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showGoogleCalendars, setShowGoogleCalendars] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const [monthlyNotes, setMonthlyNotes] = useState('');

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

      // 4. Fetch Tasks with due dates
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*');

      if (taskData) {
        setTasksList(taskData as TaskItem[]);
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
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const handleJumpToWeek = (date: Date) => {
    const monday = getMonday(date);
    const mondayStr = formatDateStr(monday);
    router.push(`/calendar/planner?week=${mondayStr}`);
  };

  const handlePrint = () => {
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

  return (
    <Box>
      {/* Top Header & Page Controls */}
      <Box className="no-print">
        <PageHeading
          heading={`${monthNames[month]} ${year} — Master School Calendar`}
          caption={`Printable 1-page portrait overview for ${schoolName}. Toggle items, print, or click 'Edit Week' to open the 2-page Weekly Planner.`}
          actions={
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handlePrint}
                startIcon={<Printer size={18} />}
                sx={{ fontWeight: 700 }}
              >
                Print Month Overview
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push('/calendar/planner')}
                startIcon={<CalendarIcon size={18} />}
                sx={{ fontWeight: 700 }}
              >
                Open Weekly Binder Planner &rarr;
              </Button>
            </Stack>
          }
        />

        {/* Filter controls bar */}
        <Card elevation={2} sx={{ mb: 4, p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton onClick={handlePrevMonth} color="primary">
                <ChevronLeft size={22} />
              </IconButton>
              <Typography variant="h4" fontWeight={700} sx={{ minWidth: 200, textAlign: 'center' }}>
                {monthNames[month]} {year}
              </Typography>
              <IconButton onClick={handleNextMonth} color="primary">
                <ChevronRight size={22} />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showHolidays}
                    onChange={(e) => setShowHolidays(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>Holidays</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showParentNotes}
                    onChange={(e) => setShowParentNotes(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>Parent Notes</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showSchoolAssignments}
                    onChange={(e) => setShowSchoolAssignments(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>School Assignments</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showTasks}
                    onChange={(e) => setShowTasks(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>To-Do Tasks</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showGoogleCalendars}
                    onChange={(e) => setShowGoogleCalendars(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={600} color="primary.main">Google Calendars</Typography>}
              />
            </Stack>
          </Stack>
        </Card>
      </Box>

      {/* PRINTABLE MONTHLY CALENDAR CONTAINER */}
      <Box
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
        {/* Printable Title Banner */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
          pb={1.5}
          borderBottom="2px solid"
          borderColor="divider"
        >
          <Box>
            <Typography variant="h3" fontWeight={800} color="primary.main" letterSpacing={0.5}>
              {monthNames[month].toUpperCase()} {year}
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              {schoolName} — Master School &amp; Family Calendar
            </Typography>
          </Box>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Page 1 of 1 (Monthly View)
          </Typography>
        </Box>

        {/* Month Grid Table */}
        <Box sx={{ borderTop: '1px solid', borderLeft: '1px solid', borderColor: 'divider' }}>
          {/* Header Row: Column for Edit Week + 7 Days */}
          <Grid container sx={{ bgcolor: 'action.hover' }}>
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
              <Grid container key={`week-row-${wIndex}`}>
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
                  const dayNotes = showParentNotes ? parentNotes.filter((n) => n.note_date === dateStr) : [];
                  const daySchoolAssignments = showSchoolAssignments ? schoolAssignments.filter((a) => a.due_date === dateStr) : [];
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

                        {/* Parent Notes */}
                        {dayNotes.map((n) => (
                          <Box key={n.id} className="note-item-text" sx={{ color: branding.notes.color }}>
                            <FormattedParentNote
                              description={n.description}
                              color={branding.notes.color}
                              iconName={branding.notes.icon}
                              interactive={false}
                            />
                          </Box>
                        ))}

                        {/* School Assignments */}
                        {daySchoolAssignments.map((a) => (
                          <Typography key={a.id} variant="caption" display="flex" alignItems="center" gap={0.5} noWrap className="assignment-item-text" sx={{ color: branding.assignments.color, fontWeight: 700, fontSize: '0.68rem' }}>
                            <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} />
                            <span>[{a.category.toUpperCase()}] {a.title}</span>
                          </Typography>
                        ))}

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
        <Box mt={3} pt={2} borderTop="1px solid" borderColor="divider">
          <Typography variant="subtitle2" fontWeight={800} mb={1}>
            Monthly Parent &amp; Teacher Notes (Prints at Bottom of Calendar Page):
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
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
        </Box>
      </Box>

      {/* PRINT MEDIA STYLES FOR 1-PAGE PORTRAIT MONTHLY CALENDAR */}
      <style jsx global>{`
        @media print {
          .no-print, header, nav, aside {
            display: none !important;
          }

          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          .monthly-print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            background-color: #ffffff !important;
          }

          .week-col, .week-col-head {
            display: none !important;
          }

          .day-col {
            min-height: 110px !important;
            border-color: #999999 !important;
            background-color: #ffffff !important;
          }

          .empty-cell {
            background-color: #f5f5f5 !important;
          }

          .date-number {
            color: #000000 !important;
          }

          .holiday-chip {
            background-color: #333333 !important;
            color: #ffffff !important;
          }
        }
      `}</style>
    </Box>
  );
}
