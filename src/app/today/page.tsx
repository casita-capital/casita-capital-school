'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  Edit3,
  ExternalLink,
  Moon,
  Navigation,
  Sparkles,
  Sun,
  Video,
  X,
} from 'lucide-react';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { useCustomization } from 'src/hooks/use-customization';
import { createClient } from 'src/services/supabase/client';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

interface Subject {
  id: string;
  name: string;
  color: string | null;
  link?: string | null;
}

interface ScheduleBlock {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string; // '07:00'
  end_time: string;   // '08:00'
  title: string;
  block_type: 'class' | 'homework' | 'custom';
  subject_id: string | null;
  color: string | null;
  note?: string | null;
  link?: string | null;
}

const DAYS: { id: DayOfWeek; label: string }[] = [
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

export function extractCleanUrl(rawLink: string | null | undefined): string | null {
  if (!rawLink) return null;
  const trimmed = rawLink.trim();
  if (!trimmed) return null;

  const httpMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (httpMatch) {
    return httpMatch[0];
  }

  if (trimmed.toLowerCase().includes('zoom.us') || trimmed.toLowerCase().startsWith('www.')) {
    const domainMatch = trimmed.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i);
    if (domainMatch) {
      return `https://${domainMatch[0]}`;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getBlockBackground(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) {
    return isDarkMode ? '#26231e' : '#f7f4ee';
  }
  if (block.block_type === 'homework') {
    return isDarkMode ? '#26231e' : '#fcfbf8';
  }
  return block.color;
}

function getBlockBackgroundImage(block: ScheduleBlock, isDarkMode: boolean): string {
  if (block.color && block.block_type === 'homework') {
    const tint = alpha(block.color, isDarkMode ? 0.32 : 0.2);
    return `linear-gradient(${tint}, ${tint})`;
  }
  return 'none';
}

function getBlockBorderColor(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) return isDarkMode ? '#3f3a32' : '#e2dcd0';
  if (block.block_type === 'homework') return block.color;
  return alpha('#171614', 0.18);
}

function getBlockTextColor(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) return isDarkMode ? '#fcfbf8' : '#171614';
  if (block.block_type === 'homework') return isDarkMode ? '#fcfbf8' : '#171614';
  return '#ffffff';
}

function getTodayDayId(date: Date): DayOfWeek | null {
  const dayMap: Record<number, DayOfWeek> = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
  };
  return dayMap[date.getDay()] || null;
}

export default function PublicTodaySchedulePage() {
  const theme = useTheme();
  const customization = useCustomization();
  const supabase = createClient();
  const { schoolName, scheduleStartHour, scheduleEndHour } = useSchoolSettings();
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const toggleThemeMode = () => {
    const nextMode = theme.palette.mode === 'dark' ? 'light' : 'dark';
    customization.handleUpdate({ paletteMode: nextMode });
  };

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [now, setNow] = useState<Date>(new Date());
  const [autoScrolled, setAutoScrolled] = useState(false);

  // Read-only modal state
  const [viewingBlock, setViewingBlock] = useState<ScheduleBlock | null>(null);

  const todayDayId = useMemo(() => getTodayDayId(now), [now]);

  // Determine today's day of week on mount
  useEffect(() => {
    const initialToday = getTodayDayId(new Date());
    setSelectedDay(initialToday || 'monday');
  }, []);

  // Live timer update (every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch schedule blocks and subjects
  const fetchSchedule = useCallback(
    async (isBackgroundRefresh = false) => {
      try {
        if (!isBackgroundRefresh) {
          setLoading(true);
        }
        setFetchError(null);
        const [subRes, blockRes] = await Promise.all([
          supabase.from('subjects').select('*'),
          supabase.from('time_schedule_blocks').select('*'),
        ]);

        if (subRes.error) throw subRes.error;
        if (blockRes.error) throw blockRes.error;

        if (subRes.data) {
          setSubjects(subRes.data as Subject[]);
        }
        if (blockRes.data) {
          setBlocks(blockRes.data as ScheduleBlock[]);
        }
      } catch (err) {
        if (!isBackgroundRefresh) {
          setFetchError(
            err instanceof Error ? err.message : 'Unable to load the daily schedule timeline.'
          );
        }
      } finally {
        if (!isBackgroundRefresh) {
          setLoading(false);
        }
      }
    },
    [supabase]
  );

  useEffect(() => {
    fetchSchedule(false);
    const pollInterval = setInterval(() => fetchSchedule(true), 60000);
    return () => clearInterval(pollInterval);
  }, [fetchSchedule]);

  // Generate 15-minute time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = scheduleStartHour; hour < scheduleEndHour; hour++) {
      for (let min = 0; min < 60; min += 15) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
    return slots;
  }, [scheduleStartHour, scheduleEndHour]);

  // Calculate current time position on the timeline
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = scheduleStartHour * 60;
  const endMinutes = scheduleEndHour * 60;
  const isTimeInRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  const isViewingToday = todayDayId !== null && selectedDay === todayDayId;

  const currentTopPx = isTimeInRange
    ? ((currentMinutes - startMinutes) / 15) * SLOT_HEIGHT
    : null;

  // Auto-scroll to current time on load when viewing today
  useEffect(() => {
    if (
      !loading &&
      isViewingToday &&
      currentTopPx !== null &&
      !autoScrolled &&
      timelineContainerRef.current
    ) {
      timelineContainerRef.current.scrollTo({
        top: Math.max(0, currentTopPx - 150),
        behavior: 'smooth',
      });
      setAutoScrolled(true);
    }
  }, [loading, isViewingToday, currentTopPx, autoScrolled]);

  const scrollToCurrentTime = () => {
    if (todayDayId && selectedDay !== todayDayId) {
      setSelectedDay(todayDayId);
    }
    if (currentTopPx !== null && timelineContainerRef.current) {
      setTimeout(() => {
        timelineContainerRef.current?.scrollTo({
          top: Math.max(0, currentTopPx - 150),
          behavior: 'smooth',
        });
      }, 40);
    }
  };

  const isDarkMode = theme.palette.mode === 'dark';
  const liveTimeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const liveDateFormatted = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 4 } }}>
        <Container maxWidth="lg">
          <Card
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Skeleton variant="text" width={180} height={24} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width={360} height={42} sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="rounded" width={96} height={36} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          </Card>
          <Card
            elevation={0}
            sx={{
              borderRadius: 1,
              p: { xs: 1.5, sm: 3 },
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Skeleton variant="text" width={260} height={32} sx={{ mb: 2 }} />
            <Stack spacing={1}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                <Skeleton key={r} variant="rounded" height={48} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 4 } }}>
      <Container maxWidth="lg">
        {fetchError && (
          <Alert
            severity="error"
            sx={{ mb: 2.5, borderRadius: 1 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => fetchSchedule(false)}
                sx={{ fontWeight: 700 }}
              >
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* PUBLIC LIVE HEADER & BRANDING BAR */}
        <Card
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 1,
            bgcolor: 'background.paper',
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
                    bgcolor: '#c43235',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    letterSpacing: '0.02em',
                    borderRadius: 1,
                    px: 0.5,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}
                >
                  {liveDateFormatted}
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700} letterSpacing="-0.015em">
                {schoolName} — Daily Schedule
              </Typography>
            </Box>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              {/* LIGHT / DARK THEME MODE TOGGLE BUTTON */}
              <Button
                variant="outlined"
                color="inherit"
                onClick={toggleThemeMode}
                startIcon={
                  isDarkMode ? (
                    <Sun size={16} color="#b85d0c" />
                  ) : (
                    <Moon size={16} color="#1b5698" />
                  )
                }
                sx={{
                  fontWeight: 700,
                  borderRadius: 1,
                  textTransform: 'none',
                  px: 2,
                  py: 0.75,
                  fontSize: '0.875rem',
                  borderColor: 'divider',
                }}
              >
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>

              {currentTopPx !== null && todayDayId !== null && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Navigation size={16} color="#ffffff" />}
                  onClick={scrollToCurrentTime}
                  sx={{
                    fontWeight: 700,
                    color: '#ffffff',
                    borderRadius: 1,
                    textTransform: 'none',
                    px: 2,
                    py: 0.75,
                    fontSize: '0.875rem',
                  }}
                >
                  {isViewingToday ? 'Jump to Now' : 'Today / Now'}
                </Button>
              )}
            </Stack>
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
                const isActualToday = todayDayId === d.id;
                return (
                  <Chip
                    key={d.id}
                    label={isActualToday ? `${d.label} (Today)` : d.label}
                    onClick={() => setSelectedDay(d.id)}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 700,
                      px: 1,
                      py: 1.75,
                      fontSize: '0.875rem',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      color: isSelected ? '#ffffff' : 'text.primary',
                      '& .MuiChip-label': {
                        color: isSelected ? '#ffffff' : 'text.primary',
                      },
                    }}
                  />
                );
              })}
            </Stack>

            {/* CURRENT TIME PILL */}
            <Paper
              elevation={0}
              sx={{
                px: 2.5,
                py: 1.25,
                borderRadius: 1,
                bgcolor: isDarkMode ? '#26231e' : '#fcfbf8',
                border: '1.5px solid',
                borderColor: alpha('#c43235', 0.45),
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexShrink: 0,
              }}
            >
              <Clock size={26} color="#c43235" />
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  lineHeight={1}
                  fontWeight={700}
                  sx={{ fontSize: '0.75rem', letterSpacing: '0.02em' }}
                >
                  CURRENT TIME
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={800}
                  lineHeight={1.15}
                  color="text.primary"
                  sx={{ mt: 0.25, fontSize: '1.35rem', fontVariantNumeric: 'tabular-nums' }}
                >
                  {liveTimeFormatted}
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Card>

        {/* SCROLLABLE LIVE TIMELINE CARD */}
        <Card
          elevation={0}
          sx={{
            borderRadius: 1,
            p: { xs: 1.5, sm: 3 },
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography
              variant="h6"
              fontWeight={700}
              display="flex"
              alignItems="center"
              gap={1}
              sx={{ fontSize: '1.125rem' }}
            >
              <CalendarIcon size={18} color={theme.palette.primary.main} />
              {DAYS.find((d) => d.id === selectedDay)?.label} Schedule Timeline
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ fontSize: '0.75rem' }}
            >
              Click any block for full details • Solid = Class, Tinted = Homework
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
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: isDarkMode ? '#171614' : '#fcfbf8',
            }}
          >
            <Box position="relative" minWidth={600} pb={4}>
              {/* RED CURRENT TIME INDICATOR LINE (Only rendered when viewing TODAY's weekday tab) */}
              {currentTopPx !== null && isViewingToday && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: `${currentTopPx + 40}px`,
                    left: 0,
                    right: 0,
                    height: '2px',
                    bgcolor: '#c43235',
                    zIndex: 30,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 6,
                      top: -12,
                      bgcolor: '#c43235',
                      color: '#ffffff',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.02em',
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
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                  py: 1,
                  px: 2,
                  bgcolor: isDarkMode ? '#26231e' : '#f7f4ee',
                  position: 'sticky',
                  top: 0,
                  zIndex: 35,
                }}
              >
                <Box width={100} flexShrink={0}>
                  <Typography
                    variant="caption"
                    fontWeight={800}
                    color="text.secondary"
                    sx={{ fontSize: '0.75rem' }}
                  >
                    TIME
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography
                    variant="caption"
                    fontWeight={800}
                    color="text.secondary"
                    sx={{ fontSize: '0.75rem' }}
                  >
                    CLASSES, HOMEWORK &amp; DAILY ROUTINES
                  </Typography>
                </Box>
              </Box>

              {/* SLOTS & BLOCKS STACK */}
              <Stack spacing={0}>
                {timeSlots.map((slotTime) => {
                  const isHourHeader = slotTime.endsWith(':00');
                  const isHalfHour = slotTime.endsWith(':30');
                  const dayBlocks = blocks.filter((b) => b.day_of_week === selectedDay);
                  const activeBlock = dayBlocks.find((b) => b.start_time === slotTime);

                  const isInMiddleOfBlock = dayBlocks.some((b) => {
                    const bStart = timeToMinutes(b.start_time);
                    const bEnd = timeToMinutes(b.end_time);
                    const slotMin = timeToMinutes(slotTime);
                    return slotMin > bStart && slotMin < bEnd;
                  });

                  const durationSlots = activeBlock
                    ? (timeToMinutes(activeBlock.end_time) -
                        timeToMinutes(activeBlock.start_time)) /
                      15
                    : 1;

                  const calculatedHeight = durationSlots * SLOT_HEIGHT - 3;

                  const isClassBlock = activeBlock?.block_type === 'class';
                  const currentSub = activeBlock
                    ? subjects.find((s) => s.id === activeBlock.subject_id)
                    : null;
                  const rawLink =
                    isClassBlock && activeBlock
                      ? activeBlock.link || currentSub?.link || null
                      : null;
                  const effectiveLink = extractCleanUrl(rawLink);

                  return (
                    <Box
                      key={slotTime}
                      sx={{
                        display: 'flex',
                        height: SLOT_HEIGHT,
                        borderBottom: isHourHeader ? '1px solid' : '1px dashed',
                        borderColor: isHourHeader
                          ? 'divider'
                          : (t) => alpha(t.palette.divider, 0.45),
                        bgcolor: isHourHeader
                          ? (t) => alpha(t.palette.text.primary, 0.015)
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
                        justifyContent="flex-end"
                        px={1.5}
                        borderRight="1px solid"
                        borderColor="divider"
                        bgcolor={isHourHeader ? 'action.selected' : 'transparent'}
                      >
                        {isHourHeader ? (
                          <Typography
                            variant="caption"
                            fontWeight={800}
                            color="primary.main"
                            sx={{
                              fontSize: '0.75rem',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimeDisplay(slotTime)}
                          </Typography>
                        ) : isHalfHour ? (
                          <Typography
                            variant="caption"
                            fontWeight={500}
                            color="text.secondary"
                            sx={{
                              fontSize: '0.75rem',
                              fontVariantNumeric: 'tabular-nums',
                              opacity: 0.75,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimeDisplay(slotTime).replace(/ AM| PM/, '')}
                          </Typography>
                        ) : (
                          <Box sx={{ width: 6, height: 1, bgcolor: 'divider' }} />
                        )}
                      </Box>

                      {/* Main Event Column Cell */}
                      <Box flex={1} position="relative" px={1}>
                        {activeBlock && !isInMiddleOfBlock && (
                          <Paper
                            elevation={0}
                            tabIndex={0}
                            role="button"
                            aria-label={`${activeBlock.title}, ${formatTimeDisplay(activeBlock.start_time)} to ${formatTimeDisplay(activeBlock.end_time)}`}
                            onClick={() => setViewingBlock(activeBlock)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setViewingBlock(activeBlock);
                              }
                            }}
                            sx={{
                              position: 'absolute',
                              top: 1,
                              left: 8,
                              right: 8,
                              height: calculatedHeight,
                              boxSizing: 'border-box',
                              zIndex: 10,
                              p: durationSlots === 1 ? 1 : 1.5,
                              borderRadius: 1,
                              bgcolor: getBlockBackground(activeBlock, isDarkMode),
                              backgroundImage: getBlockBackgroundImage(activeBlock, isDarkMode),
                              color: getBlockTextColor(activeBlock, isDarkMode),
                              border: '1.5px solid',
                              borderColor: getBlockBorderColor(activeBlock, isDarkMode),
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: durationSlots === 1 ? 'center' : 'flex-start',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                              '&:hover': {
                                boxShadow: (t) =>
                                  `0 4px 12px ${alpha(t.palette.common.black, 0.2)}`,
                                transform: 'translateY(-1px)',
                              },
                              '&:focus-visible': {
                                outline: `2px solid ${theme.palette.primary.main}`,
                                outlineOffset: 2,
                              },
                            }}
                          >
                            {/* BLOCK HEADER & TITLE */}
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              spacing={1}
                              mb={durationSlots === 1 ? 0 : 0.5}
                            >
                              <Stack direction="row" alignItems="center" spacing={1} minWidth={0}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor:
                                      activeBlock.block_type === 'class'
                                        ? '#ffffff'
                                        : activeBlock.color || 'primary.main',
                                    flexShrink: 0,
                                  }}
                                />
                                {activeBlock.block_type === 'homework' ? (
                                  <Edit3 size={15} />
                                ) : activeBlock.block_type === 'custom' ? (
                                  <Sparkles size={15} />
                                ) : (
                                  <BookOpen size={15} />
                                )}
                                <Typography
                                  variant="subtitle1"
                                  fontWeight={700}
                                  noWrap
                                  sx={{
                                    fontSize: '0.9375rem',
                                    lineHeight: 1.25,
                                    color: 'inherit',
                                  }}
                                >
                                  {activeBlock.title}
                                </Typography>
                              </Stack>

                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                flexShrink={0}
                              >
                                {activeBlock.block_type === 'class' && (
                                  <Chip
                                    icon={<BookOpen size={13} color="#ffffff" />}
                                    label="CLASS"
                                    size="small"
                                    sx={{
                                      bgcolor: '#1b5698',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      borderRadius: 1,
                                      height: 22,
                                      px: 0.5,
                                      '& .MuiChip-label': { color: '#ffffff' },
                                    }}
                                  />
                                )}
                                {activeBlock.block_type === 'homework' && (
                                  <Chip
                                    icon={<Edit3 size={13} color="#ffffff" />}
                                    label="HOMEWORK"
                                    size="small"
                                    sx={{
                                      bgcolor: '#b85d0c',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      borderRadius: 1,
                                      height: 22,
                                      px: 0.5,
                                      '& .MuiChip-label': { color: '#ffffff' },
                                    }}
                                  />
                                )}
                                {activeBlock.block_type === 'custom' && (
                                  <Chip
                                    icon={<Sparkles size={13} color="#ffffff" />}
                                    label="ROUTINE"
                                    size="small"
                                    sx={{
                                      bgcolor: '#6c43b8',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      borderRadius: 1,
                                      height: 22,
                                      px: 0.5,
                                      '& .MuiChip-label': { color: '#ffffff' },
                                    }}
                                  />
                                )}

                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  sx={{
                                    bgcolor: alpha('#171614', 0.14),
                                    color: 'inherit',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatTimeDisplay(activeBlock.start_time)} –{' '}
                                  {formatTimeDisplay(activeBlock.end_time)}
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
                                  startIcon={
                                    effectiveLink.includes('zoom.us') ? (
                                      <Video size={15} color="#ffffff" />
                                    ) : (
                                      <ExternalLink size={15} color="#ffffff" />
                                    )
                                  }
                                  sx={{
                                    bgcolor: effectiveLink.includes('zoom.us')
                                      ? '#1b5698'
                                      : '#0d735c',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    textTransform: 'none',
                                    borderRadius: 1,
                                    px: 1.5,
                                    py: 0.5,
                                    '&:hover': {
                                      bgcolor: effectiveLink.includes('zoom.us')
                                        ? '#2e4a8f'
                                        : '#1e6f3d',
                                    },
                                  }}
                                >
                                  {effectiveLink.includes('zoom.us')
                                    ? 'Join Zoom Call'
                                    : 'Launch Class Link'}
                                </Button>
                              </Box>
                            )}

                            {/* FULL EVENT NOTES & INSTRUCTIONS */}
                            {activeBlock.note && (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.875rem',
                                  fontWeight: 400,
                                  opacity: 0.95,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  mt: 0.5,
                                  p: 1,
                                  bgcolor: alpha('#171614', 0.1),
                                  borderRadius: 1,
                                  color: 'inherit',
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
            borderRadius: 1,
            overflow: 'hidden',
          },
        }}
      >
        {viewingBlock &&
          (() => {
            const isClassBlock = viewingBlock.block_type === 'class';
            const sub = subjects.find((s) => s.id === viewingBlock.subject_id);
            const rawLink = isClassBlock ? viewingBlock.link || sub?.link || null : null;
            const link = extractCleanUrl(rawLink);
            const blockBg = viewingBlock.color || '#1b5698';

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
                    aria-label="Close block details"
                    onClick={() => setViewingBlock(null)}
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      color: '#ffffff',
                      bgcolor: alpha('#171614', 0.22),
                      '&:hover': { bgcolor: alpha('#171614', 0.36) },
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
                        sx={{
                          bgcolor: alpha('#171614', 0.28),
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: 1,
                        }}
                      />
                    )}
                    {viewingBlock.block_type === 'homework' && (
                      <Chip
                        icon={<Edit3 size={13} color="#ffffff" />}
                        label="HOMEWORK ASSIGNMENT"
                        size="small"
                        sx={{
                          bgcolor: alpha('#171614', 0.28),
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: 1,
                        }}
                      />
                    )}
                    {viewingBlock.block_type === 'custom' && (
                      <Chip
                        icon={<Sparkles size={13} color="#ffffff" />}
                        label="DAILY ROUTINE"
                        size="small"
                        sx={{
                          bgcolor: alpha('#171614', 0.28),
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: 1,
                        }}
                      />
                    )}
                  </Stack>

                  <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
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
                        borderRadius: 1,
                        bgcolor: isDarkMode ? '#26231e' : '#f7f4ee',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={700}
                            display="block"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            SCHEDULED TIME RANGE
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mt={0.5}
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            <Clock size={16} color={theme.palette.primary.main} />
                            {formatTimeDisplay(viewingBlock.start_time)} –{' '}
                            {formatTimeDisplay(viewingBlock.end_time)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={700}
                            display="block"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            DAY OF WEEK
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mt={0.5}
                          >
                            <CalendarIcon size={16} color={theme.palette.primary.main} />
                            {DAYS.find((d) => d.id === viewingBlock.day_of_week)?.label ||
                              viewingBlock.day_of_week}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    {/* Clickable Class / Zoom Link (Only on Class Blocks) */}
                    {link && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={700}
                          display="block"
                          mb={1}
                          sx={{ fontSize: '0.75rem' }}
                        >
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
                          startIcon={
                            link.includes('zoom.us') ? (
                              <Video size={18} color="#ffffff" />
                            ) : (
                              <ExternalLink size={18} color="#ffffff" />
                            )
                          }
                          sx={{
                            bgcolor: link.includes('zoom.us') ? '#1b5698' : '#0d735c',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            py: 1.2,
                            borderRadius: 1,
                            textTransform: 'none',
                            '&:hover': {
                              bgcolor: link.includes('zoom.us') ? '#2e4a8f' : '#1e6f3d',
                            },
                          }}
                        >
                          {link.includes('zoom.us')
                            ? 'Join Zoom Call Now'
                            : 'Launch Class / Courseware Link'}
                        </Button>
                      </Box>
                    )}

                    {/* Details & Notes */}
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={700}
                        display="block"
                        mb={1}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        CLASS INSTRUCTIONS &amp; NOTES
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 1,
                          bgcolor: isDarkMode ? '#26231e' : '#f7f4ee',
                          border: '1px solid',
                          borderColor: 'divider',
                          minHeight: 80,
                        }}
                      >
                        {viewingBlock.note ? (
                          <Typography
                            variant="body1"
                            sx={{
                              fontSize: '0.9375rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.55,
                            }}
                          >
                            {viewingBlock.note}
                          </Typography>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            fontStyle="italic"
                            sx={{ fontSize: '0.875rem' }}
                          >
                            No additional notes or instructions entered for this class.
                          </Typography>
                        )}
                      </Paper>
                    </Box>
                  </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => setViewingBlock(null)}
                    sx={{ fontWeight: 700, px: 3, borderRadius: 1 }}
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
