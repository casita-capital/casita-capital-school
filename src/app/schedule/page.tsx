'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Clock,
  Trash2,
  Edit2,
  BookOpen,
  Utensils,
  Coffee,
  Activity,
  Printer,
  Sparkles,
  GripHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { useSchoolSettings } from 'src/contexts/school-settings';

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface ScheduleBlock {
  id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  start_time: string; // '07:00', '07:15', etc.
  end_time: string;   // '08:00', '07:45', etc.
  title: string;
  block_type: 'class' | 'homework' | 'custom';
  subject_id: string | null;
  color: string | null;
  note?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DragPaletteItem {
  type: 'class' | 'custom';
  title: string;
  subject_id?: string | null;
  color?: string | null;
}

const DAYS_OF_WEEK: { id: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
];

const UNCOLORED_TEMPLATES: { title: string; icon: any }[] = [
  { title: 'Lunch', icon: Utensils },
  { title: 'Break', icon: Coffee },
  { title: 'Recess', icon: Activity },
  { title: 'Extracurricular', icon: Sparkles },
  { title: 'Free Time', icon: BookOpen },
];

const SLOT_HEIGHT = 44; // Height of each 15-minute slot row in px

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeDisplay(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const minsStr = String(m).padStart(2, '0');
  return `${displayHour}:${minsStr} ${ampm}`;
}

function getBlockBackground(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) {
    return isDarkMode ? '#374151' : '#e5e7eb';
  }
  if (block.block_type === 'homework') {
    return isDarkMode ? `${block.color}55` : `${block.color}33`; // Lighter washed out shade for homework
  }
  return block.color; // Solid subject color for class
}

function getBlockBorderColor(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) return isDarkMode ? '#4b5563' : '#d1d5db';
  if (block.block_type === 'homework') return block.color; // Solid subject color border for homework
  return 'rgba(0,0,0,0.15)';
}

function getBlockTextColor(block: ScheduleBlock, isDarkMode: boolean): string {
  if (!block.color) return isDarkMode ? '#ffffff' : '#111827';
  if (block.block_type === 'homework') return isDarkMode ? '#ffffff' : '#111827';
  return '#ffffff';
}

export default function TimeSchedulerPage() {
  const theme = useTheme();
  const supabase = createClient();
  const { schoolName, scheduleStartHour, scheduleEndHour } = useSchoolSettings();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);

  // Drag palette item
  const [draggedPaletteItem, setDraggedPaletteItem] = useState<DragPaletteItem | null>(null);

  // Mouse Edge Resizing State
  const [resizingState, setResizingState] = useState<{
    blockId: string;
    edge: 'top' | 'bottom';
    initialY: number;
    initialStartMin: number;
    initialEndMin: number;
  } | null>(null);

  // Edit Modal State
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'class' | 'homework' | 'custom'>('class');
  const [editNote, setEditNote] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Generate 15-minute time slots for grid
  const timeSlots: string[] = [];
  for (let hour = scheduleStartHour; hour < scheduleEndHour; hour++) {
    for (let min = 0; min < 60; min += 15) {
      timeSlots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, name, color, sort_order')
          .order('sort_order', { ascending: true });

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
        toast.error('Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  // Collision Detection
  const hasCollision = (
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday',
    startMin: number,
    endMin: number,
    ignoreBlockId?: string
  ): boolean => {
    return blocks.some((b) => {
      if (b.day_of_week !== day) return false;
      if (ignoreBlockId && b.id === ignoreBlockId) return false;

      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);

      return startMin < bEnd && endMin > bStart;
    });
  };

  // Drag Mouse Edge Resizer Effect
  useEffect(() => {
    if (!resizingState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingState.initialY;
      const stepCount = Math.round(deltaY / SLOT_HEIGHT);

      if (resizingState.edge === 'bottom') {
        const proposedEndMin = Math.max(
          resizingState.initialStartMin + 15,
          Math.min(scheduleEndHour * 60, resizingState.initialEndMin + stepCount * 15)
        );
        const newEndTimeStr = minutesToTime(proposedEndMin);

        setBlocks((prev) =>
          prev.map((b) => (b.id === resizingState.blockId ? { ...b, end_time: newEndTimeStr } : b))
        );
      } else {
        const proposedStartMin = Math.max(
          scheduleStartHour * 60,
          Math.min(resizingState.initialEndMin - 15, resizingState.initialStartMin + stepCount * 15)
        );
        const newStartTimeStr = minutesToTime(proposedStartMin);

        setBlocks((prev) =>
          prev.map((b) => (b.id === resizingState.blockId ? { ...b, start_time: newStartTimeStr } : b))
        );
      }
    };

    const handleMouseUp = async () => {
      const targetBlock = blocks.find((b) => b.id === resizingState.blockId);
      const initialState = { ...resizingState };
      setResizingState(null);

      if (targetBlock) {
        const startMin = timeToMinutes(targetBlock.start_time);
        const endMin = timeToMinutes(targetBlock.end_time);

        if (hasCollision(targetBlock.day_of_week, startMin, endMin, targetBlock.id)) {
          toast.error('Cannot resize: Slot is occupied by another activity!');
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === targetBlock.id
                ? {
                    ...b,
                    start_time: minutesToTime(initialState.initialStartMin),
                    end_time: minutesToTime(initialState.initialEndMin),
                  }
                : b
            )
          );
          return;
        }

        try {
          await supabase
            .from('time_schedule_blocks')
            .update({
              start_time: targetBlock.start_time,
              end_time: targetBlock.end_time,
            })
            .eq('id', targetBlock.id);

          toast.success(
            `Resized to ${formatTimeDisplay(targetBlock.start_time)} – ${formatTimeDisplay(targetBlock.end_time)}`
          );
        } catch {
          toast.error('Failed to save block duration');
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingState, blocks, scheduleEndHour, scheduleStartHour, supabase]);

  // Create block on drop
  const handleDropOnSlot = async (
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday',
    slotTime: string
  ) => {
    if (!draggedPaletteItem) return;

    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    const startMin = timeToMinutes(slotTime);
    const defaultDuration = 45; // Default 45 mins
    const endMin = Math.min(startMin + defaultDuration, scheduleEndHour * 60);

    if (endMin <= startMin) {
      toast.error('Cannot place block past end of schedule day');
      return;
    }

    if (hasCollision(day, startMin, endMin)) {
      toast.error('Time slot is already occupied! Choose an open slot.');
      return;
    }

    const newBlock: Partial<ScheduleBlock> = {
      day_of_week: day,
      start_time: slotTime,
      end_time: minutesToTime(endMin),
      title: draggedPaletteItem.title,
      block_type: draggedPaletteItem.type,
      subject_id: draggedPaletteItem.subject_id || null,
      color: draggedPaletteItem.color || null,
      note: null,
      created_by: activeUserName,
      updated_by: activeUserName,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      const { data, error } = await supabase
        .from('time_schedule_blocks')
        .insert(newBlock as any)
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to add block: ${error.message}`);
      } else if (data) {
        setBlocks((prev) => [...prev, data as ScheduleBlock]);
        toast.success(`Added ${draggedPaletteItem.title} to ${day.toUpperCase()}!`);
      }
    } catch {
      toast.error('Error adding schedule block');
    } finally {
      setDraggedPaletteItem(null);
    }
  };

  // Delete Block
  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('time_schedule_blocks')
        .delete()
        .eq('id', blockId);

      if (error) {
        toast.error(`Failed to delete block: ${error.message}`);
      } else {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        toast.success('Block removed from schedule');
        setEditingBlock(null);
      }
    } catch {
      toast.error('Error deleting schedule block');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (block: ScheduleBlock) => {
    setEditingBlock(block);
    setEditTitle(block.title);
    setEditType(block.block_type);
    setEditNote(block.note || '');
    setEditStartTime(block.start_time);
    setEditEndTime(block.end_time);
  };

  // Save Edit Block
  const handleSaveEditBlock = async () => {
    if (!editingBlock) return;
    if (!editTitle.trim()) {
      toast.error('Please enter a block title');
      return;
    }

    const startMin = timeToMinutes(editStartTime);
    const endMin = timeToMinutes(editEndTime);

    if (endMin <= startMin) {
      toast.error('End time must be after start time');
      return;
    }

    if (hasCollision(editingBlock.day_of_week, startMin, endMin, editingBlock.id)) {
      toast.error('Time range collides with an existing block on this day!');
      return;
    }

    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('time_schedule_blocks')
        .update({
          title: editTitle.trim(),
          block_type: editType,
          note: editNote.trim() || null,
          start_time: editStartTime,
          end_time: editEndTime,
          updated_by: activeUserName,
          updated_at: nowIso,
        })
        .eq('id', editingBlock.id);

      if (error) {
        toast.error(`Failed to update block: ${error.message}`);
      } else {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === editingBlock.id
              ? {
                  ...b,
                  title: editTitle.trim(),
                  block_type: editType,
                  note: editNote.trim() || null,
                  start_time: editStartTime,
                  end_time: editEndTime,
                  updated_by: activeUserName,
                  updated_at: nowIso,
                }
              : b
          )
        );
        toast.success('Schedule block updated!');
        setEditingBlock(null);
      }
    } catch {
      toast.error('Error updating block');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Box className="no-print-root">
      <PageHeading
        heading="Weekly Time Scheduler"
        caption="Plan Monday–Friday hourly schedules down to 15-minute granularity. Drag & drop subjects or custom activities and stretch time blocks using top/bottom handles."
        actions={
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Printer size={18} />}
            onClick={() => window.print()}
            sx={{ fontWeight: 700 }}
          >
            Print Schedule
          </Button>
        }
      />

      <Grid container spacing={3} className="schedule-print-container">
        {/* LEFT SIDEBAR PALETTE */}
        <Grid item xs={12} md={3.5} lg={3} className="schedule-palette-col no-print">
          <Card elevation={8} sx={{ borderRadius: 3, p: 2.5, position: 'sticky', top: 90 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
              <Clock size={20} color={theme.palette.primary.main} />
              Schedule Palette
            </Typography>
            <Typography variant="caption" color="text.secondary" mb={2} display="block">
              Drag any subject or custom activity block onto the daily schedule grid.
            </Typography>

            {/* SECTION 1: SUBJECTS */}
            <Typography variant="overline" color="text.secondary" fontWeight={800} display="block" sx={{ mt: 1, mb: 1 }}>
              School Subjects
            </Typography>
            <Stack spacing={1} mb={2.5}>
              {subjects.map((sub) => (
                <Paper
                  key={`class-${sub.id}`}
                  draggable
                  onDragStart={() =>
                    setDraggedPaletteItem({
                      type: 'class',
                      title: sub.name,
                      subject_id: sub.id,
                      color: sub.color,
                    })
                  }
                  elevation={2}
                  sx={{
                    p: 1.2,
                    px: 1.5,
                    borderRadius: 2,
                    bgcolor: sub.color,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    '&:hover': { opacity: 0.9, transform: 'translateY(-1px)' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BookOpen size={16} />
                    <span>{sub.name}</span>
                  </Stack>
                  <Chip label="Subject" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#ffffff', height: 20, fontSize: '0.68rem', fontWeight: 800 }} />
                </Paper>
              ))}
            </Stack>

            {/* SECTION 2: UNCOLORED CUSTOM ACTIVITIES (ELEVATED) */}
            <Typography variant="overline" color="text.secondary" fontWeight={800} display="block" mb={1}>
              Custom Activities (Uncolored)
            </Typography>
            <Stack spacing={1}>
              {UNCOLORED_TEMPLATES.map((tmpl) => {
                const IconComponent = tmpl.icon;
                return (
                  <Paper
                    key={`tmpl-${tmpl.title}`}
                    draggable
                    onDragStart={() =>
                      setDraggedPaletteItem({
                        type: 'custom',
                        title: tmpl.title,
                        color: null,
                      })
                    }
                    elevation={1}
                    sx={{
                      p: 1.2,
                      px: 1.5,
                      borderRadius: 2,
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                      color: 'text.primary',
                      border: '1.5px solid',
                      borderColor: 'divider',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                    }}
                  >
                    <IconComponent size={16} color={theme.palette.text.secondary} />
                    <span>{tmpl.title}</span>
                  </Paper>
                );
              })}
            </Stack>
          </Card>
        </Grid>

        {/* RIGHT MAIN WEEKLY TIME GRID (MON - FRI) */}
        <Grid item xs={12} md={8.5} lg={9} className="schedule-main-col">
          <Typography variant="h5" fontWeight={800} align="center" className="schedule-print-title">
            {schoolName} — Weekly Time Schedule (Monday–Friday)
          </Typography>
          <Card elevation={8} sx={{ borderRadius: 3, p: 2, overflowX: 'auto' }} className="schedule-main-card">
            <Box minWidth={800}>
              {/* GRID HEADER: DAYS OF WEEK */}
              <Grid container spacing={1} sx={{ mb: 1, borderBottom: 2, borderColor: 'divider', pb: 1 }}>
                <Grid item xs={1.5}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary" align="center" display="block">
                    TIME
                  </Typography>
                </Grid>
                {DAYS_OF_WEEK.map((d) => (
                  <Grid item key={d.id} xs={2.1}>
                    <Paper
                      elevation={0}
                      sx={{
                        py: 1,
                        bgcolor: 'primary.main',
                        color: '#ffffff',
                        textAlign: 'center',
                        borderRadius: 2,
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        letterSpacing: 0.5,
                      }}
                    >
                      {d.label.toUpperCase()}
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* GRID BODY: TIME SLOTS */}
              <Stack spacing={0.5}>
                {timeSlots.map((slotTime) => {
                  const isHourHeader = slotTime.endsWith(':00');
                  return (
                    <Grid container key={slotTime} spacing={1} alignItems="stretch" sx={{ height: SLOT_HEIGHT }}>
                      {/* Time Rail */}
                      <Grid item xs={1.5}>
                        <Box
                          sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: isHourHeader ? 'action.selected' : 'transparent',
                            borderRadius: 1,
                            px: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={isHourHeader ? 800 : 500}
                            color={isHourHeader ? 'primary.main' : 'text.secondary'}
                            sx={{ fontSize: isHourHeader ? '0.78rem' : '0.7rem' }}
                          >
                            {formatTimeDisplay(slotTime)}
                          </Typography>
                        </Box>
                      </Grid>

                      {/* 5 Day Slot Cells */}
                      {DAYS_OF_WEEK.map((d) => {
                        const activeBlock = blocks.find(
                          (b) => b.day_of_week === d.id && b.start_time === slotTime
                        );

                        // Check if slot falls inside an ongoing block range (to avoid rendering duplicates)
                        const isInMiddleOfBlock = blocks.some((b) => {
                          if (b.day_of_week !== d.id) return false;
                          const bStart = timeToMinutes(b.start_time);
                          const bEnd = timeToMinutes(b.end_time);
                          const slotMin = timeToMinutes(slotTime);
                          return slotMin > bStart && slotMin < bEnd;
                        });

                        const durationSlots = activeBlock
                          ? (timeToMinutes(activeBlock.end_time) - timeToMinutes(activeBlock.start_time)) / 15
                          : 1;

                        const calculatedHeight = durationSlots * SLOT_HEIGHT - 4;

                        return (
                          <Grid item key={`${d.id}-${slotTime}`} xs={2.1}>
                            <Box
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDropOnSlot(d.id, slotTime)}
                              sx={{
                                height: '100%',
                                borderRadius: 1.5,
                                border: isInMiddleOfBlock ? 'none' : '1px dashed',
                                borderColor: isHourHeader ? 'divider' : 'rgba(0,0,0,0.06)',
                                bgcolor: (t) =>
                                  isHourHeader
                                    ? t.palette.mode === 'dark'
                                      ? 'rgba(255,255,255,0.02)'
                                      : 'rgba(0,0,0,0.015)'
                                    : 'transparent',
                                position: 'relative',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                  borderColor: 'primary.light',
                                },
                              }}
                            >
                              {activeBlock && (
                                <Paper
                                  elevation={4}
                                  onClick={() => handleOpenEditModal(activeBlock)}
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 2,
                                    right: 2,
                                    height: calculatedHeight,
                                    zIndex: 10,
                                    p: 1,
                                    borderRadius: 1.5,
                                    bgcolor: getBlockBackground(activeBlock, isDarkMode),
                                    color: getBlockTextColor(activeBlock, isDarkMode),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    border: '2px solid',
                                    borderColor: getBlockBorderColor(activeBlock, isDarkMode),
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                                    overflow: 'hidden',
                                    transition: resizingState?.blockId === activeBlock.id ? 'none' : 'height 0.15s ease',
                                    '&:hover': { boxShadow: '0 6px 16px rgba(0,0,0,0.28)' },
                                  }}
                                >
                                  {/* TOP MOUSE RESIZE HANDLE */}
                                  <Box
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setResizingState({
                                        blockId: activeBlock.id,
                                        edge: 'top',
                                        initialY: e.clientY,
                                        initialStartMin: timeToMinutes(activeBlock.start_time),
                                        initialEndMin: timeToMinutes(activeBlock.end_time),
                                      });
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      height: 10,
                                      cursor: 'ns-resize',
                                      bgcolor: 'rgba(0,0,0,0.12)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 15,
                                      '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
                                    }}
                                  >
                                    <GripHorizontal size={12} color={getBlockTextColor(activeBlock, isDarkMode)} />
                                  </Box>

                                  {/* BLOCK HEADER, TITLE & TYPE PILL */}
                                  <Box mt={0.6}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={0.5}>
                                      <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontSize: '0.82rem' }}>
                                        {activeBlock.title}
                                      </Typography>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteBlock(activeBlock.id);
                                        }}
                                        sx={{ color: getBlockTextColor(activeBlock, isDarkMode), p: 0.2 }}
                                      >
                                        <Trash2 size={12} />
                                      </IconButton>
                                    </Box>

                                    {/* OPTIONAL NON-BOLD NOTE DETAILS */}
                                    {activeBlock.note && (
                                      <Typography
                                        variant="caption"
                                        display="block"
                                        noWrap
                                        sx={{
                                          fontSize: '0.72rem',
                                          fontWeight: 400,
                                          fontStyle: 'italic',
                                          opacity: 0.85,
                                          mt: 0.2,
                                        }}
                                      >
                                        {activeBlock.note}
                                      </Typography>
                                    )}
                                  </Box>

                                  {/* TIME RANGE & CATEGORY CHIP */}
                                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.6}>
                                    <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.68rem', fontWeight: 700 }}>
                                      {formatTimeDisplay(activeBlock.start_time)} – {formatTimeDisplay(activeBlock.end_time)}
                                    </Typography>
                                    {activeBlock.block_type !== 'custom' && (
                                      <Chip
                                        label={activeBlock.block_type === 'homework' ? 'Homework' : 'Class'}
                                        size="small"
                                        sx={{
                                          bgcolor: activeBlock.block_type === 'homework' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)',
                                          color: getBlockTextColor(activeBlock, isDarkMode),
                                          height: 18,
                                          fontSize: '0.62rem',
                                          fontWeight: 800,
                                          '& .MuiChip-label': { px: 0.8 },
                                        }}
                                      />
                                    )}
                                  </Box>

                                  {/* BOTTOM MOUSE RESIZE HANDLE */}
                                  <Box
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setResizingState({
                                        blockId: activeBlock.id,
                                        edge: 'bottom',
                                        initialY: e.clientY,
                                        initialStartMin: timeToMinutes(activeBlock.start_time),
                                        initialEndMin: timeToMinutes(activeBlock.end_time),
                                      });
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      height: 10,
                                      cursor: 'ns-resize',
                                      bgcolor: 'rgba(0,0,0,0.12)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 15,
                                      '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
                                    }}
                                  >
                                    <GripHorizontal size={12} color={getBlockTextColor(activeBlock, isDarkMode)} />
                                  </Box>
                                </Paper>
                              )}
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  );
                })}
              </Stack>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* EDIT BLOCK MODAL */}
      <Dialog open={Boolean(editingBlock)} onClose={() => setEditingBlock(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Edit Schedule Block</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} pt={1}>
            <TextField
              fullWidth
              label="Activity / Block Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />

            {/* BLOCK CATEGORY TYPE TOGGLE (CLASS VS HOMEWORK) */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={1} display="block">
                Block Category
              </Typography>
              <ToggleButtonGroup
                fullWidth
                color="primary"
                value={editType}
                exclusive
                onChange={(_, val) => val && setEditType(val)}
                size="small"
              >
                <ToggleButton value="class" sx={{ fontWeight: 700 }}>
                  📚 Class Block
                </ToggleButton>
                <ToggleButton value="homework" sx={{ fontWeight: 700 }}>
                  📝 Homework
                </ToggleButton>
                <ToggleButton value="custom" sx={{ fontWeight: 700 }}>
                  🌟 Custom Activity
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* OPTIONAL NOTE DETAILS */}
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Details / Notes (Optional)"
              placeholder="e.g. Read pages 40-55, bring calculator, family lunch"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              helperText="Displayed in non-bolded font inside the schedule block."
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="Start Time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                >
                  {timeSlots.map((slot) => (
                    <MenuItem key={`start-${slot}`} value={slot}>
                      {formatTimeDisplay(slot)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="End Time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                >
                  {timeSlots.map((slot) => (
                    <MenuItem key={`end-${slot}`} value={slot}>
                      {formatTimeDisplay(slot)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          {editingBlock && (
            <Button color="error" onClick={() => handleDeleteBlock(editingBlock.id)} startIcon={<Trash2 size={16} />}>
              Delete Block
            </Button>
          )}
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setEditingBlock(null)} color="inherit">
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleSaveEditBlock} disabled={savingEdit} sx={{ fontWeight: 700 }}>
              {savingEdit ? 'Saving...' : 'Save Block'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* GLOBAL CSS FOR PRINT MODE: LANDSCAPE 1-PAGE FITTED */}
      <style jsx global>{`
        .schedule-print-title {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 0.25in;
          }

          .no-print,
          .schedule-palette-col,
          header,
          nav,
          aside,
          .MuiDrawer-root,
          button,
          .MuiIconButton-root {
            display: none !important;
          }

          body,
          main,
          #__next {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }

          .schedule-print-title {
            display: block !important;
            font-size: 20px !important;
            font-weight: 800 !important;
            color: #000000 !important;
            margin-bottom: 12px !important;
            text-align: center !important;
          }

          .schedule-print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .schedule-main-col {
            flex-basis: 100% !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .schedule-main-card {
            box-shadow: none !important;
            border: 1.5px solid #000000 !important;
            background-color: #ffffff !important;
            padding: 8px !important;
            width: 100% !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </Box>
  );
}
