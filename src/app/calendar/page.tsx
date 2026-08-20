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

  // Filter toggles for printable monthly overview
  const [showHolidays, setShowHolidays] = useState(true);
  const [showParentNotes, setShowParentNotes] = useState(true);
  const [showSchoolAssignments, setShowSchoolAssignments] = useState(true);
  const [showTasks, setShowTasks] = useState(true);

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
    const diff = day === 0 ? 1 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  const handleJumpToWeek = (d: Date) => {
    const monday = getMonday(d);
    const weekStr = formatDateStr(monday);
    router.push(`/calendar/planner?week=${weekStr}`);
  };

  // Build calendar matrix (Sunday to Saturday)
  const firstDayOfMonth = new Date(year, month, 1);
  const startingDay = firstDayOfMonth.getDay(); // 0 for Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(year, month, i));
  }
  // Fill remaining days of last week row to complete 7-day row
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  // Chunk calendarDays into week rows of 7 days
  const weekRows: (Date | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weekRows.push(calendarDays.slice(i, i + 7));
  }

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

  return (
    <Box>
      <Box className="no-print">
        <PageHeading
          heading="Master Calendar & Monthly Overview"
          caption="Browse school months, view holidays, parent notes, school assignments & tasks, or print monthly overviews."
          actions={
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Printer size={18} />}
                onClick={handlePrint}
                sx={{ fontWeight: 600 }}
              >
                Print Monthly Overview
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CalendarIcon size={18} />}
                onClick={() => handleJumpToWeek(new Date(year, month, 14))}
                sx={{ fontWeight: 600 }}
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
            </Stack>
          </Stack>
        </Card>
      </Box>

      {/* PRINTABLE MONTHLY CALENDAR CONTAINER */}
      <Box
        className="monthly-print-container"
        sx={{
          '@media print': {
            '@page': {
              size: 'letter portrait',
              margin: '0.3in',
            },
            body: {
              backgroundColor: '#ffffff !important',
              color: '#000000 !important',
            },
          },
        }}
      >
        <Card elevation={8} sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }} className="calendar-print-card">
          <Box p={2} borderBottom="1px solid" borderColor="divider" display="flex" justifyContent="space-between" alignItems="center" className="calendar-header-box">
            <Typography variant="h4" fontWeight={700}>
              {monthNames[month]} {year} — Monthly School Overview
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {schoolName}
            </Typography>
          </Box>

          {/* Calendar Grid Header */}
          <Grid container sx={{ bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Grid item xs={1.4} className="week-col" sx={{ py: 1.5, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'primary.main' }}>
              WEEK
            </Grid>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, idx) => (
              <Grid
                item
                xs={(12 - 1.4) / 7}
                key={day}
                className="day-col day-header-cell"
                sx={{
                  py: 1.2,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: idx === 0 || idx === 6 ? 'text.secondary' : 'primary.main',
                }}
              >
                {day}
              </Grid>
            ))}
          </Grid>

          {/* Calendar Week Rows */}
          {weekRows.map((week, wIndex) => {
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

                        {/* Parent Notes */}
                        {dayNotes.map((n) => (
                          <Typography key={n.id} variant="caption" display="flex" alignItems="center" gap={0.5} noWrap className="note-item-text" sx={{ color: branding.notes.color, fontWeight: 700, fontSize: '0.68rem' }}>
                            <ItemIcon name={branding.notes.icon} size={11} color={branding.notes.color} />
                            <span>{n.description}</span>
                          </Typography>
                        ))}

                        {/* School Assignments */}
                        {daySchoolAssignments.map((a) => (
                          <Typography key={a.id} variant="caption" display="flex" alignItems="center" gap={0.5} noWrap className="assignment-item-text" sx={{ color: branding.assignments.color, fontWeight: 700, fontSize: '0.68rem' }}>
                            <ItemIcon name={branding.assignments.icon} size={11} color={branding.assignments.color} />
                            <span>[{a.category.toUpperCase()}] {a.title}</span>
                          </Typography>
                        ))}

                        {/* To-Do Tasks */}
                        {dayTasks.map((t) => (
                          <Typography key={t.id} variant="caption" display="flex" alignItems="center" gap={0.5} noWrap className="task-item-text" sx={{ color: branding.tasks.color, fontWeight: 700, fontSize: '0.68rem' }}>
                            <ItemIcon name={branding.tasks.icon} size={11} color={branding.tasks.color} />
                            <span>{t.status === 'completed' ? '✓' : '☐'} {t.title}</span>
                          </Typography>
                        ))}
                      </Stack>
                    </Grid>
                  );
                })}
              </Grid>
            );
          })}
        </Card>

        {/* BOTTOM HALF NOTES SECTION FOR MONTHLY OVERVIEW PRINT */}
        <Card elevation={8} sx={{ borderRadius: 3, p: 3, minHeight: 260 }} className="notes-print-card">
          {/* Screen Header & Editable Textarea */}
          <Box className="notes-screen-header">
            <Typography variant="h5" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
              <Sparkles size={20} color={theme.palette.primary.main} />
              Monthly Parent &amp; Teacher Notes
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Write monthly goals, curriculum milestones, exam dates, or notes below.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={5}
              placeholder="Type monthly goals, curriculum milestones, exam dates, or parent notes here..."
              value={monthlyNotes}
              onChange={(e) => handleUpdateMonthlyNotes(e.target.value)}
              sx={{
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>

          {/* Print View: Clean "Notes" Header & Typed Content */}
          <Box className="notes-print-content">
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1, color: '#000000' }}>
              Notes
            </Typography>
            <Typography variant="body1" sx={{ color: '#000000', whiteSpace: 'pre-wrap', minHeight: 140, fontSize: '13px' }}>
              {monthlyNotes || ''}
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* Global CSS for Print Mode */}
      <style jsx global>{`
        .notes-print-content {
          display: none;
        }

        @media print {
          .no-print, header, nav, aside {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            background-color: #ffffff !important;
          }

          /* Full Portrait Page Flex Container */
          .monthly-print-container {
            display: flex !important;
            flex-direction: column !important;
            height: 10.1in !important;
            justify-content: space-between !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          /* Hide Week Column in Print */
          .week-col {
            display: none !important;
          }

          /* Expand 7 Day Columns to 100% Width */
          .day-col {
            flex-basis: 14.2857% !important;
            max-width: 14.2857% !important;
            min-height: 70px !important;
            border: 1px solid #999999 !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          .day-header-cell {
            background-color: #f0f0f0 !important;
            color: #000000 !important;
            font-weight: 800 !important;
            border-bottom: 2px solid #000000 !important;
          }

          .calendar-print-card {
            flex-shrink: 0 !important;
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            margin-bottom: 8px !important;
            background-color: #ffffff !important;
          }

          /* High-Contrast Black & White Printable Colors */
          .date-number {
            background-color: transparent !important;
            color: #000000 !important;
            font-weight: 800 !important;
          }

          .holiday-chip {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1.5px solid #000000 !important;
            font-weight: 800 !important;
          }

          .note-item-text, .assignment-item-text, .task-item-text {
            color: #000000 !important;
            font-weight: 700 !important;
          }

          /* Printable Notes Card */
          .notes-print-card {
            flex: 1 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            padding: 16px !important;
            background-color: #ffffff !important;
          }

          .notes-screen-header {
            display: none !important;
          }

          .notes-print-content {
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
            height: 100% !important;
          }
        }
      `}</style>
    </Box>
  );
}
