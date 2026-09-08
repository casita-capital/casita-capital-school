'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Clock,
  Calendar as CalendarIcon,
  Sparkles,
  Navigation,
  BookOpen,
  Video,
  ExternalLink,
  Edit3,
  X,
} from 'lucide-react';
import { createClient } from 'src/services/supabase/client';
import { useSchoolSettings } from 'src/contexts/school-settings';

interface Subject {
  id: string;
  name: string;
  color: string | null;
  link?: string | null;
}

interface ScheduleBlock {
  id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  start_time: string; // '07:00'
  end_time: string;   // '08:00'
  title: string;
  block_type: 'class' | 'homework' | 'custom';
  subject_id: string | null;
  color: string | null;
  note?: string | null;
  link?: string | null;
}

const DAYS: { id: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
];

const SLOT_HEIGHT = 48; // Height of each 15-minute slot row in px

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTimeDisplay(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const minsStr = String(m).padStart(2, '0');
  return `${displayHour}:${minsStr} ${ampm}`;
}

export default function PublicTodaySchedulePage() {
  const theme = useTheme();
  const supabase = createClient();
  const { schoolName, scheduleStartHour, scheduleEndHour } = useSchoolSettings();
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [selectedDay, setSelectedDay] = useState<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'>('monday');
  const [now, setNow] = useState<Date>(new Date());
  const [autoScrolled, setAutoScrolled] = useState(false);

  // Read-only modal state
  const [viewingBlock, setViewingBlock] = useState<ScheduleBlock | null>(null);

  // Determine today's day of week on mount
  useEffect(() => {
    const todayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, ... 5 = Fri, 6 = Sat
    const dayMap: Record<number, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'> = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
    };

    if (dayMap[todayIndex]) {
      setSelectedDay(dayMap[todayIndex]);
    } else {
      setSelectedDay('monday');
    }
  }, []);

  // Live timer update (every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch schedule blocks and subjects
  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const { data: subData } = await supabase
          .from('subjects')
          .select('*');

        if (subData) {
          setSubjects(subData as Subject[]);
        }

        const { data: blockData } = await supabase
          .from('time_schedule_blocks')
          .select('*');

        if (blockData) {
          setBlocks(blockData as ScheduleBlock[]);
        }
      } catch {
        // Silently handle public fetch errors
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
    const pollInterval = setInterval(fetchSchedule, 60000); // Background refresh every 60s
    return () => clearInterval(pollInterval);
  }, [supabase]);

  // Generate 15-minute time slots
  const timeSlots: string[] = [];
  for (let hour = scheduleStartHour; hour < scheduleEndHour; hour++) {
    for (let min = 0; min < 60; min += 15) {
      timeSlots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }

  // Calculate current time position on the timeline
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = scheduleStartHour * 60;
  const endMinutes = scheduleEndHour * 60;
  const isTimeInRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  const currentTopPx = isTimeInRange
    ? ((currentMinutes - startMinutes) / 15) * SLOT_HEIGHT
    : null;

  // Auto-scroll to current time on load
  useEffect(() => {
    if (!loading && currentTopPx !== null && !autoScrolled && timelineContainerRef.current) {
      timelineContainerRef.current.scrollTo({
        top: Math.max(0, currentTopPx - 150),
        behavior: 'smooth',
      });
      setAutoScrolled(true);
    }
  }, [loading, currentTopPx, autoScrolled]);

  const scrollToCurrentTime = () => {
    if (currentTopPx !== null && timelineContainerRef.current) {
      timelineContainerRef.current.scrollTo({
        top: Math.max(0, currentTopPx - 150),
        behavior: 'smooth',
      });
    }
  };

  const isDarkMode = theme.palette.mode === 'dark';
  const liveTimeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const liveDateFormatted = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 4 } }}>
      <Container maxWidth="lg">
        {/* PUBLIC LIVE HEADER & BRANDING BAR */}
        <Card
          elevation={8}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            background: isDarkMode
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* TOP ROW: Title on Left, Jump to Now Button on Right */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
                <Chip
                  icon={<Sparkles size={14} color="#ffffff" />}
                  label="LIVE TRACKER"
                  size="small"
                  sx={{
                    bgcolor: '#EF4444',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.72rem',
                    letterSpacing: 0.5,
                    px: 0.5,
                  }}
                />
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {liveDateFormatted}
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
                {schoolName} — Daily Schedule
              </Typography>
            </Box>

            {currentTopPx !== null && (
              <Button
                variant="contained"
                color="error"
                startIcon={<Navigation size={18} color="#ffffff" />}
                onClick={scrollToCurrentTime}
                sx={{
                  fontWeight: 900,
                  color: '#ffffff !important',
                  borderRadius: 2.5,
                  textTransform: 'none',
                  px: 2.5,
                  py: 1,
                  fontSize: '0.9rem',
                  letterSpacing: 0.5,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.45)',
                  '&:hover': {
                    bgcolor: '#dc2626',
                    boxShadow: '0 6px 18px rgba(239, 68, 68, 0.6)',
                  },
                }}
              >
                Jump to Now
              </Button>
            )}
          </Stack>

          {/* BOTTOM ROW: Days of Week Selector on Left, Current Time Pill on Right */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
            mt={2}
          >
            {/* DAY OF WEEK SELECTOR PILLS */}
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {DAYS.map((d) => {
                const isSelected = selectedDay === d.id;
                return (
                  <Chip
                    key={d.id}
                    label={d.label}
                    onClick={() => setSelectedDay(d.id)}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 800,
                      px: 1.5,
                      py: 2,
                      fontSize: '0.85rem',
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      bgcolor: isSelected ? '#0C74E4' : 'transparent',
                      color: isSelected ? '#ffffff !important' : 'text.primary',
                      '& .MuiChip-label': {
                        color: isSelected ? '#ffffff !important' : 'text.primary',
                      },
                      '&:hover': { opacity: 0.9 },
                    }}
                  />
                );
              })}
            </Stack>

            {/* CURRENT TIME PILL (Twice as large, in line with Days of Week on the bottom right) */}
            <Paper
              elevation={3}
              sx={{
                px: 3.5,
                py: 1.5,
                borderRadius: 3,
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff',
                border: '2px solid',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexShrink: 0,
                boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(239, 68, 68, 0.15)',
              }}
            >
              <Clock size={32} color="#EF4444" />
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  lineHeight={1}
                  fontWeight={800}
                  sx={{ fontSize: '0.75rem', letterSpacing: 0.8 }}
                >
                  CURRENT TIME
                </Typography>
                <Typography variant="h5" fontWeight={900} lineHeight={1.1} color="text.primary" sx={{ mt: 0.4 }}>
                  {liveTimeFormatted}
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Card>

        {/* SCROLLABLE LIVE TIMELINE CARD */}
        <Card
          elevation={10}
          sx={{
            borderRadius: 3,
            p: { xs: 1.5, sm: 3 },
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" fontWeight={800} display="flex" alignItems="center" gap={1}>
              <CalendarIcon size={20} color={theme.palette.primary.main} />
              {DAYS.find((d) => d.id === selectedDay)?.label} Schedule Timeline
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Click any block for full details • Scrollable timeline
            </Typography>
          </Box>

          {/* TIMELINE CONTAINER WITH OVERFLOW-Y AUTO */}
          <Box
            ref={timelineContainerRef}
            sx={{
              maxHeight: '75vh',
              overflowY: 'auto',
              position: 'relative',
              pr: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: isDarkMode ? '#0f172a' : '#fafafa',
            }}
          >
            <Box position="relative" minWidth={600} pb={4}>
              {/* RED CURRENT TIME INDICATOR LINE */}
              {currentTopPx !== null && selectedDay === (DAYS.find((d) => d.id === selectedDay)?.id) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: `${currentTopPx + 40}px`,
                    left: 0,
                    right: 0,
                    height: '3px',
                    bgcolor: '#EF4444',
                    boxShadow: '0 0 10px rgba(239, 68, 68, 0.9)',
                    zIndex: 30,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 4,
                      top: -12,
                      bgcolor: '#EF4444',
                      color: '#ffffff',
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
                      letterSpacing: 0.5,
                    }}
                  >
                    NOW ({liveTimeFormatted})
                  </Box>
                </Box>
              )}

              {/* TIMELINE HEADER */}
              <Box
                sx={{
                  display: 'flex',
                  borderBottom: 2,
                  borderColor: 'divider',
                  py: 1,
                  px: 2,
                  bgcolor: isDarkMode ? '#1e293b' : '#f1f5f9',
                  position: 'sticky',
                  top: 0,
                  zIndex: 25,
                }}
              >
                <Box width={100} flexShrink={0}>
                  <Typography variant="caption" fontWeight={900} color="text.secondary">
                    TIME
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" fontWeight={900} color="text.secondary">
                    CLASSES, ACTIVITIES &amp; EVENT NOTES
                  </Typography>
                </Box>
              </Box>

              {/* SLOTS & BLOCKS STACK */}
              <Stack spacing={0}>
                {timeSlots.map((slotTime) => {
                  const isHourHeader = slotTime.endsWith(':00');
                  const dayBlocks = blocks.filter((b) => b.day_of_week === selectedDay);
                  const activeBlock = dayBlocks.find((b) => b.start_time === slotTime);

                  const isInMiddleOfBlock = dayBlocks.some((b) => {
                    const bStart = timeToMinutes(b.start_time);
                    const bEnd = timeToMinutes(b.end_time);
                    const slotMin = timeToMinutes(slotTime);
                    return slotMin > bStart && slotMin < bEnd;
                  });

                  const durationSlots = activeBlock
                    ? (timeToMinutes(activeBlock.end_time) - timeToMinutes(activeBlock.start_time)) / 15
                    : 1;

                  const calculatedHeight = durationSlots * SLOT_HEIGHT - 2;

                  const isClassBlock = activeBlock?.block_type === 'class';
                  const currentSub = activeBlock ? subjects.find((s) => s.id === activeBlock.subject_id) : null;
                  const effectiveLink = isClassBlock && activeBlock ? (activeBlock.link || currentSub?.link || null) : null;

                  return (
                    <Box
                      key={slotTime}
                      sx={{
                        display: 'flex',
                        height: SLOT_HEIGHT,
                        borderBottom: '1px dashed',
                        borderColor: isHourHeader ? 'divider' : 'rgba(0,0,0,0.05)',
                        bgcolor: isHourHeader
                          ? isDarkMode
                            ? 'rgba(255,255,255,0.015)'
                            : 'rgba(0,0,0,0.015)'
                          : 'transparent',
                        position: 'relative',
                      }}
                    >
                      {/* Left Time Rail */}
                      <Box
                        width={100}
                        flexShrink={0}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        borderRight={1}
                        borderColor="divider"
                        bgcolor={isHourHeader ? 'action.selected' : 'transparent'}
                      >
                        <Typography
                          variant="caption"
                          fontWeight={isHourHeader ? 900 : 500}
                          color={isHourHeader ? 'primary.main' : 'text.secondary'}
                          sx={{ fontSize: isHourHeader ? '0.78rem' : '0.7rem' }}
                        >
                          {formatTimeDisplay(slotTime)}
                        </Typography>
                      </Box>

                      {/* Main Event Column Cell */}
                      <Box flex={1} position="relative" px={1}>
                        {activeBlock && !isInMiddleOfBlock && (
                          <Paper
                            elevation={4}
                            onClick={() => setViewingBlock(activeBlock)}
                            sx={{
                              position: 'absolute',
                              top: 1,
                              left: 8,
                              right: 8,
                              height: calculatedHeight,
                              zIndex: 10,
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: activeBlock.color || (isDarkMode ? '#374151' : '#f3f4f6'),
                              color: activeBlock.color ? '#ffffff' : 'text.primary',
                              borderLeft: '6px solid',
                              borderColor: activeBlock.color || 'primary.main',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: durationSlots === 1 ? 'center' : 'flex-start',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                                transform: 'translateY(-1px)',
                              },
                            }}
                          >
                            {/* BLOCK HEADER & TITLE */}
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} mb={0.5}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <BookOpen size={16} />
                                <Typography variant="subtitle1" fontWeight={900} sx={{ fontSize: '0.92rem', lineHeight: 1.2 }}>
                                  {activeBlock.title}
                                </Typography>
                              </Stack>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                {/* VERY OBVIOUS CLASS VS HW PILLS */}
                                {activeBlock.block_type === 'class' && (
                                  <Chip
                                    icon={<BookOpen size={13} color="#ffffff" />}
                                    label="CLASS"
                                    size="small"
                                    sx={{
                                      bgcolor: '#0C74E4',
                                      color: '#ffffff !important',
                                      fontWeight: 900,
                                      fontSize: '0.68rem',
                                      letterSpacing: 0.5,
                                      height: 22,
                                      px: 0.5,
                                      boxShadow: '0 2px 6px rgba(12, 116, 228, 0.4)',
                                      '& .MuiChip-label': { color: '#ffffff !important' },
                                    }}
                                  />
                                )}
                                {activeBlock.block_type === 'homework' && (
                                  <Chip
                                    icon={<Edit3 size={13} color="#ffffff" />}
                                    label="HOMEWORK"
                                    size="small"
                                    sx={{
                                      bgcolor: '#D97706',
                                      color: '#ffffff !important',
                                      fontWeight: 900,
                                      fontSize: '0.68rem',
                                      letterSpacing: 0.5,
                                      height: 22,
                                      px: 0.5,
                                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.4)',
                                      '& .MuiChip-label': { color: '#ffffff !important' },
                                    }}
                                  />
                                )}
                                {activeBlock.block_type === 'custom' && (
                                  <Chip
                                    icon={<Sparkles size={13} color="#ffffff" />}
                                    label="ACTIVITY"
                                    size="small"
                                    sx={{
                                      bgcolor: '#8B5CF6',
                                      color: '#ffffff !important',
                                      fontWeight: 900,
                                      fontSize: '0.68rem',
                                      letterSpacing: 0.5,
                                      height: 22,
                                      px: 0.5,
                                      '& .MuiChip-label': { color: '#ffffff !important' },
                                    }}
                                  />
                                )}

                                <Typography
                                  variant="caption"
                                  fontWeight={800}
                                  sx={{
                                    bgcolor: 'rgba(0,0,0,0.2)',
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: 1,
                                    fontSize: '0.72rem',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatTimeDisplay(activeBlock.start_time)} – {formatTimeDisplay(activeBlock.end_time)}
                                </Typography>
                              </Stack>
                            </Stack>

                            {/* CLICKABLE ZOOM CALL / CLASS LINK BUTTON (ONLY ON CLASS BLOCKS) */}
                            {effectiveLink && (
                              <Box mt={0.5} mb={0.5}>
                                <Button
                                  component="a"
                                  href={effectiveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  size="small"
                                  variant="contained"
                                  startIcon={effectiveLink.includes('zoom.us') ? <Video size={16} color="#ffffff" /> : <ExternalLink size={16} color="#ffffff" />}
                                  sx={{
                                    bgcolor: effectiveLink.includes('zoom.us') ? '#2D8CFF' : '#10B981',
                                    color: '#ffffff !important',
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    px: 2,
                                    py: 0.5,
                                    boxShadow: effectiveLink.includes('zoom.us')
                                      ? '0 3px 10px rgba(45, 140, 255, 0.4)'
                                      : '0 3px 10px rgba(16, 185, 129, 0.4)',
                                    '&:hover': {
                                      bgcolor: effectiveLink.includes('zoom.us') ? '#1A7AE8' : '#059669',
                                    },
                                  }}
                                >
                                  {effectiveLink.includes('zoom.us') ? 'Join Zoom Call' : 'Launch Class Link'}
                                </Button>
                              </Box>
                            )}

                            {/* FULL EVENT NOTES & INSTRUCTIONS */}
                            {activeBlock.note && (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.82rem',
                                  fontWeight: 400,
                                  opacity: 0.95,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  mt: 0.5,
                                  p: 1,
                                  bgcolor: 'rgba(0,0,0,0.12)',
                                  borderRadius: 1,
                                }}
                              >
                                {activeBlock.note}
                              </Typography>
                            )}
                          </Paper>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        </Card>
      </Container>

      {/* READ-ONLY CLASS DETAILS MODAL */}
      <Dialog
        open={Boolean(viewingBlock)}
        onClose={() => setViewingBlock(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        {viewingBlock && (() => {
          const isClassBlock = viewingBlock.block_type === 'class';
          const sub = subjects.find((s) => s.id === viewingBlock.subject_id);
          const link = isClassBlock ? (viewingBlock.link || sub?.link || null) : null;
          const blockBg = viewingBlock.color || (isDarkMode ? '#1e293b' : '#0C74E4');

          return (
            <>
              {/* Dialog Header Banner */}
              <Box
                sx={{
                  bgcolor: blockBg,
                  color: '#ffffff',
                  p: 3,
                  position: 'relative',
                }}
              >
                <IconButton
                  onClick={() => setViewingBlock(null)}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    color: '#ffffff',
                    bgcolor: 'rgba(0,0,0,0.2)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.35)' },
                  }}
                >
                  <X size={18} />
                </IconButton>

                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  {viewingBlock.block_type === 'class' && (
                    <Chip
                      icon={<BookOpen size={13} color="#ffffff" />}
                      label="CLASS BLOCK"
                      size="small"
                      sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#ffffff !important', fontWeight: 900 }}
                    />
                  )}
                  {viewingBlock.block_type === 'homework' && (
                    <Chip
                      icon={<Edit3 size={13} color="#ffffff" />}
                      label="HOMEWORK ASSIGNMENT"
                      size="small"
                      sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#ffffff !important', fontWeight: 900 }}
                    />
                  )}
                  {viewingBlock.block_type === 'custom' && (
                    <Chip
                      icon={<Sparkles size={13} color="#ffffff" />}
                      label="SCHEDULED ACTIVITY"
                      size="small"
                      sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#ffffff !important', fontWeight: 900 }}
                    />
                  )}
                </Stack>

                <Typography variant="h4" fontWeight={900} lineHeight={1.2}>
                  {viewingBlock.title}
                </Typography>
              </Box>

              <DialogContent sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  {/* Time & Day Info Box */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} display="block">
                          SCHEDULED TIME RANGE
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={900} display="flex" alignItems="center" gap={1} mt={0.5}>
                          <Clock size={18} color={theme.palette.primary.main} />
                          {formatTimeDisplay(viewingBlock.start_time)} – {formatTimeDisplay(viewingBlock.end_time)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} display="block">
                          DAY OF WEEK
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={900} display="flex" alignItems="center" gap={1} mt={0.5}>
                          <CalendarIcon size={18} color={theme.palette.primary.main} />
                          {DAYS.find((d) => d.id === viewingBlock.day_of_week)?.label || viewingBlock.day_of_week}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Clickable Class / Zoom Link (Only on Class Blocks) */}
                  {link && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" mb={1}>
                        CLASS ONLINE CALL / LINK
                      </Typography>
                      <Button
                        component="a"
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={link.includes('zoom.us') ? <Video size={20} color="#ffffff" /> : <ExternalLink size={20} color="#ffffff" />}
                        sx={{
                          bgcolor: link.includes('zoom.us') ? '#2D8CFF' : '#10B981',
                          color: '#ffffff !important',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          py: 1.2,
                          borderRadius: 2.5,
                          textTransform: 'none',
                          boxShadow: '0 4px 14px rgba(45, 140, 255, 0.4)',
                          '&:hover': {
                            bgcolor: link.includes('zoom.us') ? '#1A7AE8' : '#059669',
                          },
                        }}
                      >
                        {link.includes('zoom.us') ? 'Join Zoom Call Now' : 'Launch Class / Courseware Link'}
                      </Button>
                    </Box>
                  )}

                  {/* Details & Notes */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" mb={1}>
                      CLASS INSTRUCTIONS &amp; NOTES
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: isDarkMode ? '#0f172a' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: 'divider',
                        minHeight: 80,
                      }}
                    >
                      {viewingBlock.note ? (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                          {viewingBlock.note}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          No additional notes or instructions entered for this class.
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                </Stack>
              </DialogContent>

              <DialogActions sx={{ p: 2, px: 3, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={() => setViewingBlock(null)}
                  sx={{ fontWeight: 800, px: 3 }}
                >
                  Close
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
}
