'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  ListSubheader,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BookOpen,
  Clock,
  Coffee,
  Copy,
  Edit3,
  GripHorizontal,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { createClient } from 'src/services/supabase/client';
import type { Database, Json } from 'src/services/supabase/types';
import { getCachedActiveUserName } from 'src/utils/active-user';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
type BlockType = 'class' | 'homework' | 'custom';
type RoutineIconKey = 'utensils' | 'coffee' | 'activity' | 'sparkles' | 'book' | 'clock';
type ScheduleBlockInsert = Database['school']['Tables']['time_schedule_blocks']['Insert'];

const ROUTINE_TEMPLATES_STORAGE_KEY = 'school_app_routine_templates';
const ROUTINE_TEMPLATES_DB_KEY = 'GLOBAL_ROUTINE_TEMPLATES';

interface Subject {
  id: string;
  name: string;
  color: string;
  link?: string | null;
}

interface RoutineTemplate {
  id: string;
  title: string;
  iconKey: RoutineIconKey;
  defaultDuration: number;
}

interface ScheduleBlock {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string; // '07:00', '07:15', etc.
  end_time: string;   // '08:00', '07:45', etc.
  title: string;
  block_type: BlockType;
  subject_id: string | null;
  color: string | null;
  note?: string | null;
  link?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DragPaletteItem {
  type: BlockType;
  title: string;
  subject_id?: string | null;
  color?: string | null;
  defaultDuration?: number;
}

const DAYS_OF_WEEK: { id: DayOfWeek; label: string; shortLabel: string }[] = [
  { id: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { id: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { id: 'friday', label: 'Friday', shortLabel: 'Fri' },
];

const ROUTINE_ICON_OPTIONS: { key: RoutineIconKey; label: string; icon: LucideIcon }[] = [
  { key: 'utensils', label: 'Meal / Snack', icon: Utensils },
  { key: 'coffee', label: 'Break / Rest', icon: Coffee },
  { key: 'activity', label: 'Recess / P.E.', icon: Activity },
  { key: 'sparkles', label: 'Activity / Club', icon: Sparkles },
  { key: 'book', label: 'Reading / Study', icon: BookOpen },
  { key: 'clock', label: 'Routine / Chore', icon: Clock },
];

const ROUTINE_DURATION_OPTIONS = [15, 30, 45, 60, 90];

const DEFAULT_ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { id: 'routine-lunch', title: 'Lunch', iconKey: 'utensils', defaultDuration: 30 },
  { id: 'routine-snack', title: 'Snack Break', iconKey: 'coffee', defaultDuration: 15 },
  { id: 'routine-break', title: 'Break', iconKey: 'coffee', defaultDuration: 15 },
  { id: 'routine-recess', title: 'Recess & P.E.', iconKey: 'activity', defaultDuration: 30 },
  { id: 'routine-extra', title: 'Extracurricular', iconKey: 'sparkles', defaultDuration: 45 },
  { id: 'routine-reading', title: 'Independent Reading', iconKey: 'book', defaultDuration: 30 },
];

function isRoutineIconKey(val: unknown): val is RoutineIconKey {
  return (
    val === 'utensils' ||
    val === 'coffee' ||
    val === 'activity' ||
    val === 'sparkles' ||
    val === 'book' ||
    val === 'clock'
  );
}

function parseRoutineTemplates(raw: unknown): RoutineTemplate[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: RoutineTemplate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id === 'string' && typeof rec.title === 'string' && rec.title.trim()) {
      const iconKey: RoutineIconKey = isRoutineIconKey(rec.iconKey) ? rec.iconKey : 'coffee';
      const defaultDuration =
        typeof rec.defaultDuration === 'number' && rec.defaultDuration >= 15
          ? rec.defaultDuration
          : 30;
      parsed.push({
        id: rec.id,
        title: rec.title.trim(),
        iconKey,
        defaultDuration,
      });
    }
  }
  return parsed.length > 0 ? parsed : null;
}

function getRoutineIcon(iconKey: RoutineIconKey): LucideIcon {
  const found = ROUTINE_ICON_OPTIONS.find((opt) => opt.key === iconKey);
  return found ? found.icon : Coffee;
}

const START_HOUR_OPTIONS = [6, 7, 8, 9];
const END_HOUR_OPTIONS = [15, 16, 17, 18, 19, 20];

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

function formatHourOption(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${ampm}`;
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

export default function TimeSchedulerPage() {
  const theme = useTheme();
  const supabase = createClient();
  const {
    schoolName,
    scheduleStartHour,
    scheduleEndHour,
    updateScheduleHours,
  } = useSchoolSettings();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>(DEFAULT_ROUTINE_TEMPLATES);

  // Manage Breaks & Daily Routines Modal State
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [draftRoutines, setDraftRoutines] = useState<RoutineTemplate[]>([]);
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineIcon, setNewRoutineIcon] = useState<RoutineIconKey>('coffee');
  const [newRoutineDuration, setNewRoutineDuration] = useState<number>(30);
  const [confirmDeleteRoutineId, setConfirmDeleteRoutineId] = useState<string | null>(null);
  const [savingRoutines, setSavingRoutines] = useState(false);

  // Palette mode: drag/click subjects directly as Class or Homework
  const [paletteSubjectMode, setPaletteSubjectMode] = useState<'class' | 'homework'>('class');

  // Drag palette item, existing block, & active drop slot highlight
  const [draggedPaletteItem, setDraggedPaletteItem] = useState<DragPaletteItem | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<ScheduleBlock | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: DayOfWeek; slotTime: string } | null>(null);

  // Mouse Edge Resizing State
  const [resizingState, setResizingState] = useState<{
    blockId: string;
    edge: 'top' | 'bottom';
    initialY: number;
    initialStartMin: number;
    initialEndMin: number;
  } | null>(null);

  // Unified Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<BlockType>('class');
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editEndTime, setEditEndTime] = useState('08:45');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['monday']);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingModalDelete, setConfirmingModalDelete] = useState(false);

  // 5-second Undo Delete Toast State
  const [undoDeleteState, setUndoDeleteState] = useState<{
    block: ScheduleBlock;
  } | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate 15-minute start time slots and end time slots (including scheduleEndHour:00)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = scheduleStartHour; hour < scheduleEndHour; hour++) {
      for (let min = 0; min < 60; min += 15) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
    return slots;
  }, [scheduleStartHour, scheduleEndHour]);

  const endTimeSlots = useMemo(() => {
    const endHourSlot = `${String(scheduleEndHour).padStart(2, '0')}:00`;
    return [...timeSlots.slice(1), endHourSlot];
  }, [timeSlots, scheduleEndHour]);

  const validEndTimeSlots = useMemo(() => {
    const startMin = timeToMinutes(editStartTime);
    const filtered = endTimeSlots.filter((slot) => timeToMinutes(slot) > startMin);
    return filtered.length > 0 ? filtered : endTimeSlots;
  }, [endTimeSlots, editStartTime]);

  // Hydrate custom routine templates from localStorage immediately on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROUTINE_TEMPLATES_STORAGE_KEY);
      if (raw) {
        const parsed = parseRoutineTemplates(JSON.parse(raw));
        if (parsed) {
          setRoutineTemplates(parsed);
        }
      }
    } catch {
      // Ignore malformed localStorage
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [subRes, blockRes, routineRes] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, name, color, sort_order, link')
          .order('sort_order', { ascending: true }),
        supabase
          .from('time_schedule_blocks')
          .select('*'),
        supabase
          .from('weekly_planner_settings')
          .select('todos')
          .eq('week_start_date', ROUTINE_TEMPLATES_DB_KEY)
          .maybeSingle(),
      ]);

      if (subRes.error) throw subRes.error;
      if (blockRes.error) throw blockRes.error;

      if (subRes.data) {
        setSubjects(subRes.data as Subject[]);
      }
      if (blockRes.data) {
        setBlocks(blockRes.data as ScheduleBlock[]);
      }
      if (!routineRes.error && routineRes.data?.todos) {
        const parsedRoutines = parseRoutineTemplates(routineRes.data.todos);
        if (parsedRoutines) {
          setRoutineTemplates(parsedRoutines);
          try {
            localStorage.setItem(ROUTINE_TEMPLATES_STORAGE_KEY, JSON.stringify(parsedRoutines));
          } catch {
            // Ignore storage quota errors
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load weekly schedule data.';
      setLoadError(msg);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Collision Detection
  const hasCollision = useCallback(
    (
      day: DayOfWeek,
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
    },
    [blocks]
  );

  // Calculate maximum available end minutes before collision or day end (auto-squeezing into available space)
  const getAvailableEndMinutes = useCallback(
    (
      day: DayOfWeek,
      startMin: number,
      desiredDurationMins: number,
      ignoreBlockId?: string
    ): number => {
      const dayBlocksAfterStart = blocks.filter((b) => {
        if (b.day_of_week !== day) return false;
        if (ignoreBlockId && b.id === ignoreBlockId) return false;
        const bStart = timeToMinutes(b.start_time);
        return bStart > startMin;
      });

      let boundaryMin = scheduleEndHour * 60;
      if (dayBlocksAfterStart.length > 0) {
        const earliestNextBlockStart = Math.min(
          ...dayBlocksAfterStart.map((b) => timeToMinutes(b.start_time))
        );
        boundaryMin = Math.min(boundaryMin, earliestNextBlockStart);
      }

      return Math.min(startMin + desiredDurationMins, boundaryMin);
    },
    [blocks, scheduleEndHour]
  );

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
  }, [resizingState, blocks, scheduleEndHour, scheduleStartHour, hasCollision, supabase]);

  // Create or move block on drop
  const handleDropOnSlot = async (day: DayOfWeek, slotTime: string) => {
    setDragOverSlot(null);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();
    const startMin = timeToMinutes(slotTime);

    // MODE 1: MOVING AN EXISTING SCHEDULE BLOCK
    if (draggedBlock) {
      const originalDurationMins =
        timeToMinutes(draggedBlock.end_time) - timeToMinutes(draggedBlock.start_time);

      if (hasCollision(day, startMin, startMin + 15, draggedBlock.id)) {
        toast.error('Time slot is already occupied! Choose an open slot.');
        setDraggedBlock(null);
        return;
      }

      const availableEndMin = getAvailableEndMinutes(
        day,
        startMin,
        originalDurationMins,
        draggedBlock.id
      );

      const actualDuration = availableEndMin - startMin;
      if (actualDuration < 15) {
        toast.error('Not enough available space at this time slot');
        setDraggedBlock(null);
        return;
      }

      const newEndTimeStr = minutesToTime(availableEndMin);

      try {
        const { error } = await supabase
          .from('time_schedule_blocks')
          .update({
            day_of_week: day,
            start_time: slotTime,
            end_time: newEndTimeStr,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', draggedBlock.id);

        if (error) {
          toast.error(`Failed to move block: ${error.message}`);
        } else {
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === draggedBlock.id
                ? {
                    ...b,
                    day_of_week: day,
                    start_time: slotTime,
                    end_time: newEndTimeStr,
                    updated_by: activeUserName,
                    updated_at: nowIso,
                  }
                : b
            )
          );

          if (actualDuration < originalDurationMins) {
            toast.success(
              `Moved ${draggedBlock.title} to ${day.toUpperCase()} (${actualDuration} mins fit available space)`
            );
          } else {
            toast.success(
              `Moved ${draggedBlock.title} to ${day.toUpperCase()} (${formatTimeDisplay(slotTime)} – ${formatTimeDisplay(newEndTimeStr)})`
            );
          }
        }
      } catch {
        toast.error('Error moving schedule block');
      } finally {
        setDraggedBlock(null);
      }
      return;
    }

    // MODE 2: DROPPING A NEW PALETTE ITEM
    if (draggedPaletteItem) {
      const titleLower = draggedPaletteItem.title.toLowerCase();
      const isShortBreak =
        titleLower.includes('break') ||
        titleLower.includes('lunch') ||
        titleLower.includes('recess');
      const desiredDuration = draggedPaletteItem.defaultDuration || (isShortBreak ? 30 : 45);

      if (hasCollision(day, startMin, startMin + 15)) {
        toast.error('Time slot is already occupied! Choose an open slot.');
        setDraggedPaletteItem(null);
        return;
      }

      const availableEndMin = getAvailableEndMinutes(day, startMin, desiredDuration);
      const actualDuration = availableEndMin - startMin;

      if (actualDuration < 15) {
        toast.error('Not enough available space at this time slot');
        setDraggedPaletteItem(null);
        return;
      }

      const newEndTimeStr = minutesToTime(availableEndMin);
      const matchedSub = subjects.find((s) => s.id === draggedPaletteItem.subject_id);

      const newBlockPayload: ScheduleBlockInsert = {
        day_of_week: day,
        start_time: slotTime,
        end_time: newEndTimeStr,
        title: draggedPaletteItem.title,
        block_type: draggedPaletteItem.type,
        subject_id: draggedPaletteItem.subject_id || null,
        color: draggedPaletteItem.color || null,
        note: null,
        link: matchedSub?.link || null,
        created_by: activeUserName,
        updated_by: activeUserName,
        created_at: nowIso,
        updated_at: nowIso,
      };

      try {
        const { data, error } = await supabase
          .from('time_schedule_blocks')
          .insert(newBlockPayload)
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to add block: ${error.message}`);
        } else if (data) {
          setBlocks((prev) => [...prev, data as ScheduleBlock]);
          if (actualDuration < desiredDuration) {
            toast.success(
              `Added ${draggedPaletteItem.title} to ${day.toUpperCase()} (${actualDuration} mins fit in available space)`
            );
          } else {
            toast.success(`Added ${draggedPaletteItem.title} to ${day.toUpperCase()}!`);
          }
        }
      } catch {
        toast.error('Error adding schedule block');
      } finally {
        setDraggedPaletteItem(null);
      }
    }
  };

  // Commit Pending Undoable Delete
  const commitDatabaseDelete = useCallback(
    async (blockId: string) => {
      try {
        const { error } = await supabase
          .from('time_schedule_blocks')
          .delete()
          .eq('id', blockId);

        if (error) {
          toast.error(`Failed to delete block: ${error.message}`);
          loadData();
        }
      } catch {
        toast.error('Error deleting schedule block');
        loadData();
      }
    },
    [supabase, loadData]
  );

  // Schedule Block Delete with 5-second Undo Toast
  const handleDeleteBlock = (block: ScheduleBlock) => {
    if (deleteTimeoutRef.current && undoDeleteState) {
      clearTimeout(deleteTimeoutRef.current);
      commitDatabaseDelete(undoDeleteState.block.id);
    }

    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setEditingBlock(null);
    setModalOpen(false);
    setConfirmingModalDelete(false);
    setUndoDeleteState({ block });

    deleteTimeoutRef.current = setTimeout(() => {
      commitDatabaseDelete(block.id);
      setUndoDeleteState(null);
      deleteTimeoutRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!undoDeleteState) return;
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    const restored = undoDeleteState.block;
    setBlocks((prev) => [...prev, restored]);
    setUndoDeleteState(null);
    toast.success(`Restored "${restored.title}"`);
  };

  // Open Create Modal (from "+ Add Block", clicking an empty slot, or clicking a palette item)
  const handleOpenCreateModal = (options?: {
    day?: DayOfWeek;
    startTime?: string;
    paletteItem?: DragPaletteItem;
    defaultDurationMins?: number;
  }) => {
    const targetDay = options?.day || 'monday';
    const startSlot = options?.startTime || timeSlots[4] || timeSlots[0] || '08:00';
    const durationMins =
      options?.defaultDurationMins || options?.paletteItem?.defaultDuration || 45;
    const startMin = timeToMinutes(startSlot);
    const computedEndMin = Math.min(scheduleEndHour * 60, startMin + durationMins);
    const endSlot = minutesToTime(Math.max(startMin + 15, computedEndMin));

    setEditingBlock(null);
    setConfirmingModalDelete(false);
    setSelectedDays([targetDay]);
    setEditStartTime(startSlot);
    setEditEndTime(endSlot);

    if (options?.paletteItem) {
      const p = options.paletteItem;
      const sub = subjects.find((s) => s.id === p.subject_id);
      const matchedRoutine =
        p.type === 'custom'
          ? routineTemplates.find((r) => r.title.toLowerCase() === p.title.toLowerCase())
          : undefined;
      setSelectedSubjectId(
        p.subject_id || (matchedRoutine ? `routine:${matchedRoutine.id}` : '')
      );
      setEditTitle(p.title);
      setEditType(p.type);
      setEditColor(p.color || null);
      setEditLink(sub?.link || '');
      setEditNote('');
    } else if (subjects.length > 0) {
      const firstSub = subjects[0];
      setSelectedSubjectId(firstSub.id);
      setEditTitle(firstSub.name);
      setEditType(paletteSubjectMode);
      setEditColor(firstSub.color);
      setEditLink(firstSub.link || '');
      setEditNote('');
    } else {
      setSelectedSubjectId('');
      setEditTitle('');
      setEditType('custom');
      setEditColor(null);
      setEditLink('');
      setEditNote('');
    }

    setModalOpen(true);
  };

  // Open Edit Modal for an existing block
  const handleOpenEditModal = (block: ScheduleBlock) => {
    setEditingBlock(block);
    setConfirmingModalDelete(false);
    const matchedRoutine =
      block.block_type === 'custom' && !block.subject_id
        ? routineTemplates.find((r) => r.title.toLowerCase() === block.title.toLowerCase())
        : undefined;
    setSelectedSubjectId(
      block.subject_id || (matchedRoutine ? `routine:${matchedRoutine.id}` : '')
    );
    setEditTitle(block.title);
    setEditType(block.block_type);
    setEditColor(block.color);
    setEditNote(block.note || '');
    const currentSub = subjects.find((s) => s.id === block.subject_id);
    setEditLink(block.link || currentSub?.link || '');
    setEditStartTime(block.start_time);
    setEditEndTime(block.end_time);
    setSelectedDays([block.day_of_week]);
    setModalOpen(true);
  };

  // Handle Subject / Routine Preset Selection inside Create/Edit Modal
  const handleSelectSubjectPreset = (presetValue: string) => {
    setSelectedSubjectId(presetValue);
    if (!presetValue) {
      setEditColor(null);
      if (editType !== 'custom') {
        setEditType('custom');
      }
      return;
    }
    if (presetValue.startsWith('routine:')) {
      const routineId = presetValue.replace('routine:', '');
      const routine = routineTemplates.find((r) => r.id === routineId);
      if (routine) {
        setEditTitle(routine.title);
        setEditType('custom');
        setEditColor(null);
        setEditLink('');
        const startMin = timeToMinutes(editStartTime);
        const computedEndMin = Math.min(scheduleEndHour * 60, startMin + routine.defaultDuration);
        setEditEndTime(minutesToTime(Math.max(startMin + 15, computedEndMin)));
      }
      return;
    }
    const sub = subjects.find((s) => s.id === presetValue);
    if (sub) {
      setEditTitle(sub.name);
      setEditColor(sub.color);
      setEditLink(sub.link || '');
      if (editType === 'custom') {
        setEditType(paletteSubjectMode);
      }
    }
  };

  // Manage Breaks & Daily Routines Modal Handlers
  const handleOpenRoutineModal = () => {
    setDraftRoutines(routineTemplates.map((r) => ({ ...r })));
    setNewRoutineTitle('');
    setNewRoutineIcon('coffee');
    setNewRoutineDuration(30);
    setConfirmDeleteRoutineId(null);
    setRoutineModalOpen(true);
  };

  const handleUpdateDraftRoutine = (
    routineId: string,
    patch: Partial<Pick<RoutineTemplate, 'title' | 'iconKey' | 'defaultDuration'>>
  ) => {
    setDraftRoutines((prev) =>
      prev.map((item) => (item.id === routineId ? { ...item, ...patch } : item))
    );
  };

  const handleDeleteDraftRoutine = (routineId: string) => {
    setDraftRoutines((prev) => prev.filter((item) => item.id !== routineId));
    setConfirmDeleteRoutineId(null);
  };

  const handleAddDraftRoutine = () => {
    const trimmed = newRoutineTitle.trim();
    if (!trimmed) {
      toast.error('Enter a title for the new routine or break block');
      return;
    }
    if (
      draftRoutines.some((r) => r.title.trim().toLowerCase() === trimmed.toLowerCase())
    ) {
      toast.error('A routine block with that name already exists');
      return;
    }
    const newEntry: RoutineTemplate = {
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      iconKey: newRoutineIcon,
      defaultDuration: newRoutineDuration,
    };
    setDraftRoutines((prev) => [...prev, newEntry]);
    setNewRoutineTitle('');
    setNewRoutineIcon('coffee');
    setNewRoutineDuration(30);
    toast.success(`Added "${trimmed}" to routine blocks`);
  };

  const handleResetDefaultRoutines = () => {
    setDraftRoutines(DEFAULT_ROUTINE_TEMPLATES.map((r) => ({ ...r })));
    setConfirmDeleteRoutineId(null);
    toast.success('Reset draft list to default breaks & routines');
  };

  const handleSaveRoutineTemplates = async () => {
    const sanitized = draftRoutines
      .map((r) => ({
        ...r,
        title: r.title.trim(),
      }))
      .filter((r) => r.title.length > 0);

    if (sanitized.length === 0) {
      toast.error('Keep at least one break or daily routine block');
      return;
    }

    setSavingRoutines(true);
    try {
      // Detect any existing routine templates whose title was renamed so scheduled blocks stay in sync
      const renames: { oldTitle: string; newTitle: string }[] = [];
      for (const updated of sanitized) {
        const previous = routineTemplates.find((orig) => orig.id === updated.id);
        if (previous && previous.title.trim() !== updated.title) {
          renames.push({ oldTitle: previous.title.trim(), newTitle: updated.title });
        }
      }

      setRoutineTemplates(sanitized);
      try {
        localStorage.setItem(ROUTINE_TEMPLATES_STORAGE_KEY, JSON.stringify(sanitized));
      } catch {
        // Ignore storage quota errors
      }

      const { error: dbErr } = await supabase.from('weekly_planner_settings').upsert(
        {
          week_start_date: ROUTINE_TEMPLATES_DB_KEY,
          todos: sanitized as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'week_start_date' }
      );

      if (dbErr) {
        toast.error(`Saved locally, but cloud sync failed: ${dbErr.message}`);
      } else {
        // Sync renamed routine titles on scheduled custom blocks
        if (renames.length > 0) {
          const activeUserName = getCachedActiveUserName();
          const nowIso = new Date().toISOString();
          for (const rename of renames) {
            const matchingIds = blocks
              .filter(
                (b) =>
                  b.block_type === 'custom' &&
                  b.title.trim().toLowerCase() === rename.oldTitle.toLowerCase()
              )
              .map((b) => b.id);

            if (matchingIds.length > 0) {
              await supabase
                .from('time_schedule_blocks')
                .update({
                  title: rename.newTitle,
                  updated_by: activeUserName,
                  updated_at: nowIso,
                })
                .in('id', matchingIds);

              setBlocks((prev) =>
                prev.map((b) =>
                  matchingIds.includes(b.id)
                    ? { ...b, title: rename.newTitle, updated_by: activeUserName, updated_at: nowIso }
                    : b
                )
              );
            }
          }
        }
        toast.success('Breaks & Daily Routines updated!');
      }
      setRoutineModalOpen(false);
    } catch {
      toast.error('Failed to save routine templates');
    } finally {
      setSavingRoutines(false);
    }
  };

  const handleToggleDaySelection = (day: DayOfWeek) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least 1 day selected
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  // Save Create or Edit Block (supports multi-day Mon-Fri creation & duplication)
  const handleSaveModalBlock = async () => {
    if (!editTitle.trim()) {
      toast.error('Please enter a block title');
      return;
    }
    if (selectedDays.length === 0) {
      toast.error('Please select at least one day of the week');
      return;
    }

    const startMin = timeToMinutes(editStartTime);
    const endMin = timeToMinutes(editEndTime);

    if (endMin <= startMin) {
      toast.error('End time must be after start time');
      return;
    }

    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();
    const normalizedSubjectId = selectedSubjectId.startsWith('routine:')
      ? ''
      : selectedSubjectId;

    setSavingEdit(true);
    try {
      // CASE 1: Editing an existing block (+ optional duplication to additional selected days)
      if (editingBlock) {
        const primaryDay = selectedDays.includes(editingBlock.day_of_week)
          ? editingBlock.day_of_week
          : selectedDays[0];

        if (hasCollision(primaryDay, startMin, endMin, editingBlock.id)) {
          toast.error(`Time range collides with an existing block on ${primaryDay.toUpperCase()}!`);
          setSavingEdit(false);
          return;
        }

        const resolvedColor =
          editType === 'custom'
            ? null
            : editColor || subjects.find((s) => s.id === normalizedSubjectId)?.color || editingBlock.color;
        const resolvedSubjectId =
          editType === 'custom' ? null : normalizedSubjectId || editingBlock.subject_id || null;

        const { error: updateErr } = await supabase
          .from('time_schedule_blocks')
          .update({
            day_of_week: primaryDay,
            title: editTitle.trim(),
            block_type: editType,
            subject_id: resolvedSubjectId,
            color: resolvedColor,
            note: editNote.trim() || null,
            link: editLink.trim() || null,
            start_time: editStartTime,
            end_time: editEndTime,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', editingBlock.id);

        if (updateErr) {
          toast.error(`Failed to update block: ${updateErr.message}`);
          setSavingEdit(false);
          return;
        }

        const updatedPrimary: ScheduleBlock = {
          ...editingBlock,
          day_of_week: primaryDay,
          title: editTitle.trim(),
          block_type: editType,
          subject_id: resolvedSubjectId,
          color: resolvedColor,
          note: editNote.trim() || null,
          link: editLink.trim() || null,
          start_time: editStartTime,
          end_time: editEndTime,
          updated_by: activeUserName,
          updated_at: nowIso,
        };

        // Check if user selected additional days to copy/duplicate onto
        const extraDays = selectedDays.filter((d) => d !== primaryDay);
        const payloadsToInsert: ScheduleBlockInsert[] = [];
        const skippedDays: string[] = [];

        for (const day of extraDays) {
          if (hasCollision(day, startMin, endMin)) {
            skippedDays.push(day.slice(0, 3).toUpperCase());
          } else {
            payloadsToInsert.push({
              day_of_week: day,
              start_time: editStartTime,
              end_time: editEndTime,
              title: editTitle.trim(),
              block_type: editType,
              subject_id: resolvedSubjectId,
              color: resolvedColor,
              note: editNote.trim() || null,
              link: editLink.trim() || null,
              created_by: activeUserName,
              updated_by: activeUserName,
              created_at: nowIso,
              updated_at: nowIso,
            });
          }
        }

        let newlyInserted: ScheduleBlock[] = [];
        if (payloadsToInsert.length > 0) {
          const { data: insertedData, error: insertErr } = await supabase
            .from('time_schedule_blocks')
            .insert(payloadsToInsert)
            .select('*');

          if (insertErr) {
            toast.error(`Updated block, but failed copying to extra days: ${insertErr.message}`);
          } else if (insertedData) {
            newlyInserted = insertedData as ScheduleBlock[];
          }
        }

        setBlocks((prev) => [
          ...prev.map((b) => (b.id === editingBlock.id ? updatedPrimary : b)),
          ...newlyInserted,
        ]);

        if (newlyInserted.length > 0 && skippedDays.length > 0) {
          toast.success(
            `Updated & copied to ${newlyInserted.length} day(s) (skipped ${skippedDays.join(', ')} due to collision)`
          );
        } else if (newlyInserted.length > 0) {
          toast.success(`Updated & applied across ${newlyInserted.length + 1} days!`);
        } else if (skippedDays.length > 0) {
          toast.success(`Block updated (skipped ${skippedDays.join(', ')} — slot occupied)`);
        } else {
          toast.success('Schedule block updated!');
        }

        setModalOpen(false);
        setEditingBlock(null);
        return;
      }

      // CASE 2: Creating new block(s) across 1 or more selected days
      const resolvedColor =
        editType === 'custom'
          ? null
          : editColor || subjects.find((s) => s.id === normalizedSubjectId)?.color || '#1b5698';
      const resolvedSubjectId = editType === 'custom' ? null : normalizedSubjectId || null;

      const payloadsToInsert: ScheduleBlockInsert[] = [];
      const skippedDays: string[] = [];

      for (const day of selectedDays) {
        if (hasCollision(day, startMin, endMin)) {
          skippedDays.push(day.slice(0, 3).toUpperCase());
        } else {
          payloadsToInsert.push({
            day_of_week: day,
            start_time: editStartTime,
            end_time: editEndTime,
            title: editTitle.trim(),
            block_type: editType,
            subject_id: resolvedSubjectId,
            color: resolvedColor,
            note: editNote.trim() || null,
            link: editLink.trim() || null,
            created_by: activeUserName,
            updated_by: activeUserName,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      }

      if (payloadsToInsert.length === 0) {
        toast.error(
          `Selected time slot is already occupied on ${skippedDays.join(', ')}. Choose an open time.`
        );
        setSavingEdit(false);
        return;
      }

      const { data: insertedData, error: insertErr } = await supabase
        .from('time_schedule_blocks')
        .insert(payloadsToInsert)
        .select('*');

      if (insertErr) {
        toast.error(`Failed to create schedule block: ${insertErr.message}`);
      } else if (insertedData) {
        const createdBlocks = insertedData as ScheduleBlock[];
        setBlocks((prev) => [...prev, ...createdBlocks]);
        if (skippedDays.length > 0) {
          toast.success(
            `Added "${editTitle.trim()}" to ${createdBlocks.length} day(s) (skipped ${skippedDays.join(', ')} — occupied)`
          );
        } else if (createdBlocks.length > 1) {
          toast.success(`Added "${editTitle.trim()}" across ${createdBlocks.length} weekdays!`);
        } else {
          toast.success(`Added "${editTitle.trim()}" to ${selectedDays[0].toUpperCase()}!`);
        }
        setModalOpen(false);
      }
    } catch {
      toast.error('Error saving schedule block');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleHoursChange = async (newStart: number, newEnd: number) => {
    if (newEnd <= newStart + 2) {
      toast.error('End hour must be at least 3 hours after start hour');
      return;
    }
    await updateScheduleHours(newStart, newEnd);
  };

  const isDarkMode = theme.palette.mode === 'dark';

  if (loading) {
    return (
      <Box>
        <Box mb={3}>
          <Skeleton variant="text" width={280} height={40} />
          <Skeleton variant="text" width={480} height={24} />
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3.5} lg={3}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 1,
                p: 2.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="text" width="65%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="90%" height={20} sx={{ mb: 2 }} />
              <Stack spacing={1}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Skeleton key={n} variant="rounded" height={42} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} md={8.5} lg={9}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 1,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="rounded" height={44} sx={{ borderRadius: 1, mb: 1.5 }} />
              <Stack spacing={0.5}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => (
                  <Skeleton key={r} variant="rounded" height={44} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box className="no-print-root">
      <Box className="no-print">
        <PageHeading
          heading="Weekly Time Grid"
          caption="Click any time slot or drag from the palette to schedule Monday–Friday blocks."
          actions={
            <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="nowrap">
              {/* INLINE SCHEDULE HOURS RANGE SELECTOR */}
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Clock size={15} color={theme.palette.text.secondary} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Hours:
                </Typography>
                <TextField
                  select
                  size="small"
                  variant="standard"
                  value={scheduleStartHour}
                  onChange={(e) => handleHoursChange(Number(e.target.value), scheduleEndHour)}
                  inputProps={{ 'aria-label': 'Schedule start hour' }}
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    '& .MuiSelect-select': {
                      py: 0.25,
                      pr: 2.5,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    },
                  }}
                >
                  {START_HOUR_OPTIONS.map((h) => (
                    <MenuItem key={`start-hr-${h}`} value={h} sx={{ fontSize: '0.75rem' }}>
                      {formatHourOption(h)}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  –
                </Typography>
                <TextField
                  select
                  size="small"
                  variant="standard"
                  value={scheduleEndHour}
                  onChange={(e) => handleHoursChange(scheduleStartHour, Number(e.target.value))}
                  inputProps={{ 'aria-label': 'Schedule end hour' }}
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    '& .MuiSelect-select': {
                      py: 0.25,
                      pr: 2.5,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    },
                  }}
                >
                  {END_HOUR_OPTIONS.map((h) => (
                    <MenuItem key={`end-hr-${h}`} value={h} sx={{ fontSize: '0.75rem' }}>
                      {formatHourOption(h)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Button
                variant="outlined"
                color="primary"
                startIcon={<Printer size={16} />}
                onClick={() => window.print()}
                sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Print Schedule
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={<Plus size={16} />}
                onClick={() => handleOpenCreateModal()}
                sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Add Block
              </Button>
            </Stack>
          }
        />
      </Box>

      {loadError && (
        <Alert
          severity="error"
          className="no-print"
          sx={{ mb: 2.5, borderRadius: 1 }}
          action={
            <Button color="inherit" size="small" onClick={loadData} sx={{ fontWeight: 700 }}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      <Grid container spacing={3} className="schedule-print-container">
        {/* LEFT SIDEBAR PALETTE */}
        <Grid item xs={12} md={3.5} lg={3} className="schedule-palette-col no-print">
          <Card
            elevation={0}
            sx={{
              borderRadius: 1,
              p: 2.5,
              position: 'sticky',
              top: 90,
              maxHeight: { md: 'calc(100vh - 114px)' },
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="h6"
              fontWeight={700}
              gutterBottom
              display="flex"
              alignItems="center"
              gap={1}
              sx={{ fontSize: '1.125rem' }}
            >
              <Clock size={18} color={theme.palette.primary.main} />
              Schedule Palette
            </Typography>
            <Typography variant="caption" color="text.secondary" mb={2} display="block">
              Click any item to schedule across multiple days, or drag it directly onto a time slot.
            </Typography>

            {/* SECTION 1: SUBJECTS + CLASS / HOMEWORK MODE TOGGLE */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 1, mb: 1 }}
            >
              <Typography variant="overline" color="text.secondary" fontWeight={800}>
                School Subjects
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={paletteSubjectMode}
                onChange={(_, val: 'class' | 'homework' | null) => {
                  if (val) setPaletteSubjectMode(val);
                }}
                aria-label="Palette subject block type"
                sx={{
                  '& .MuiToggleButton-root': {
                    py: 0.25,
                    px: 1,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'none',
                  },
                }}
              >
                <ToggleButton value="class">Class</ToggleButton>
                <ToggleButton value="homework">Homework</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Stack spacing={1} mb={2.5}>
              {subjects.map((sub) => {
                const isHwMode = paletteSubjectMode === 'homework';
                return (
                  <Paper
                    key={`palette-${sub.id}`}
                    draggable
                    tabIndex={0}
                    role="button"
                    aria-label={`Schedule ${sub.name} as ${isHwMode ? 'Homework' : 'Class'}`}
                    onDragStart={() =>
                      setDraggedPaletteItem({
                        type: paletteSubjectMode,
                        title: sub.name,
                        subject_id: sub.id,
                        color: sub.color,
                      })
                    }
                    onDragEnd={() => {
                      setDraggedPaletteItem(null);
                      setDragOverSlot(null);
                    }}
                    onClick={() =>
                      handleOpenCreateModal({
                        paletteItem: {
                          type: paletteSubjectMode,
                          title: sub.name,
                          subject_id: sub.id,
                          color: sub.color,
                        },
                        defaultDurationMins: 45,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenCreateModal({
                          paletteItem: {
                            type: paletteSubjectMode,
                            title: sub.name,
                            subject_id: sub.id,
                            color: sub.color,
                          },
                          defaultDurationMins: 45,
                        });
                      }
                    }}
                    elevation={0}
                    sx={{
                      p: 1,
                      px: 1.5,
                      borderRadius: 1,
                      bgcolor: isHwMode
                        ? alpha(sub.color, isDarkMode ? 0.28 : 0.16)
                        : sub.color,
                      color: isHwMode ? 'text.primary' : '#ffffff',
                      border: '1.5px solid',
                      borderColor: isHwMode ? sub.color : alpha('#171614', 0.15),
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      transition: 'transform 0.12s ease, opacity 0.12s ease',
                      '&:hover': { opacity: 0.92, transform: 'translateY(-1px)' },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      {isHwMode ? <Edit3 size={15} /> : <BookOpen size={15} />}
                      <Typography
                        component="span"
                        noWrap
                        sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'inherit' }}
                      >
                        {sub.name}
                      </Typography>
                    </Stack>
                    <Chip
                      label={isHwMode ? 'HW' : 'Class'}
                      size="small"
                      sx={{
                        bgcolor: isHwMode
                          ? alpha(sub.color, isDarkMode ? 0.45 : 0.22)
                          : alpha('#ffffff', 0.22),
                        color: isHwMode ? 'text.primary' : '#ffffff',
                        height: 20,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: 1,
                        flexShrink: 0,
                      }}
                    />
                  </Paper>
                );
              })}
            </Stack>

            {/* SECTION 2: BREAKS & DAILY ROUTINES */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                fontWeight={800}
                sx={{ lineHeight: 1.2 }}
              >
                Breaks &amp; Daily Routines
              </Typography>
              <Tooltip title="Edit existing routine blocks or create new standard blocks">
                <Button
                  size="small"
                  variant="text"
                  startIcon={<Settings2 size={13} />}
                  onClick={handleOpenRoutineModal}
                  aria-label="Manage breaks and daily routines"
                  sx={{
                    py: 0.25,
                    px: 0.75,
                    minWidth: 0,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'none',
                  }}
                >
                  Manage
                </Button>
              </Tooltip>
            </Stack>
            <Stack spacing={1}>
              {routineTemplates.map((tmpl) => {
                const IconComponent = getRoutineIcon(tmpl.iconKey);
                return (
                  <Paper
                    key={tmpl.id}
                    draggable
                    tabIndex={0}
                    role="button"
                    aria-label={`Schedule ${tmpl.title} (${tmpl.defaultDuration} mins)`}
                    onDragStart={() =>
                      setDraggedPaletteItem({
                        type: 'custom',
                        title: tmpl.title,
                        color: null,
                        defaultDuration: tmpl.defaultDuration,
                      })
                    }
                    onDragEnd={() => {
                      setDraggedPaletteItem(null);
                      setDragOverSlot(null);
                    }}
                    onClick={() =>
                      handleOpenCreateModal({
                        paletteItem: {
                          type: 'custom',
                          title: tmpl.title,
                          color: null,
                          defaultDuration: tmpl.defaultDuration,
                        },
                        defaultDurationMins: tmpl.defaultDuration,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenCreateModal({
                          paletteItem: {
                            type: 'custom',
                            title: tmpl.title,
                            color: null,
                            defaultDuration: tmpl.defaultDuration,
                          },
                          defaultDurationMins: tmpl.defaultDuration,
                        });
                      }
                    }}
                    elevation={0}
                    sx={{
                      p: 1,
                      px: 1.5,
                      borderRadius: 1,
                      bgcolor: isDarkMode ? '#26231e' : '#f7f4ee',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: 'divider',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      transition: 'transform 0.12s ease, background-color 0.12s ease',
                      '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <IconComponent size={15} color={theme.palette.text.secondary} />
                      <Typography
                        component="span"
                        noWrap
                        sx={{ fontSize: '0.875rem', fontWeight: 600 }}
                      >
                        {tmpl.title}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {tmpl.defaultDuration}m
                      </Typography>
                      <Plus size={14} color={theme.palette.text.secondary} />
                    </Stack>
                  </Paper>
                );
              })}
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<Plus size={15} />}
                onClick={handleOpenRoutineModal}
                sx={{
                  mt: 0.5,
                  py: 0.75,
                  borderRadius: 1,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  '&:hover': {
                    borderStyle: 'dashed',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                Add / Edit Routine Blocks
              </Button>
            </Stack>
          </Card>
        </Grid>

        {/* RIGHT MAIN WEEKLY TIME GRID (MON - FRI) */}
        <Grid item xs={12} md={8.5} lg={9} className="schedule-main-col">
          <Typography
            variant="h5"
            fontWeight={800}
            align="center"
            className="schedule-print-title"
          >
            {schoolName} — Weekly Time Schedule (Monday–Friday)
          </Typography>
          <Card
            elevation={0}
            sx={{
              borderRadius: 1,
              p: 2,
              overflowX: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
            className="schedule-main-card"
          >
            <Box minWidth={780}>
              {/* GRID HEADER: DAYS OF WEEK */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '88px repeat(5, minmax(0, 1fr))',
                  columnGap: 1,
                  mb: 1,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                  pb: 1,
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  align="center"
                  display="block"
                  sx={{ py: 0.75 }}
                >
                  TIME
                </Typography>
                {DAYS_OF_WEEK.map((d) => (
                  <Paper
                    key={d.id}
                    elevation={0}
                    sx={{
                      py: 0.75,
                      bgcolor: 'primary.main',
                      color: '#ffffff',
                      textAlign: 'center',
                      borderRadius: 1,
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {d.label.toUpperCase()}
                  </Paper>
                ))}
              </Box>

              {/* GRID BODY: TIME SLOTS (Strict 44px row height, zero negative margins) */}
              <Box>
                {timeSlots.map((slotTime) => {
                  const isHourHeader = slotTime.endsWith(':00');
                  const isHalfHour = slotTime.endsWith(':30');

                  return (
                    <Box
                      key={slotTime}
                      className="schedule-slot-row"
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '88px repeat(5, minmax(0, 1fr))',
                        columnGap: 1,
                        height: 'var(--slot-height, 44px)',
                        boxSizing: 'border-box',
                        borderTop: isHourHeader ? '1px solid' : '1px dashed',
                        borderColor: isHourHeader
                          ? 'divider'
                          : (t) => alpha(t.palette.divider, 0.45),
                      }}
                    >
                      {/* Clean Classical Academy Time Rail */}
                      <Box
                        sx={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          bgcolor: isHourHeader ? 'action.selected' : 'transparent',
                          borderRadius: 1,
                          px: 1,
                        }}
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
                              opacity: 0.7,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimeDisplay(slotTime).replace(/ AM| PM/, '')}
                          </Typography>
                        ) : (
                          <Box
                            sx={{
                              width: 6,
                              height: 1,
                              bgcolor: 'divider',
                            }}
                          />
                        )}
                      </Box>

                      {/* 5 Day Slot Cells */}
                      {DAYS_OF_WEEK.map((d) => {
                        const activeBlock = blocks.find(
                          (b) => b.day_of_week === d.id && b.start_time === slotTime
                        );

                        // Check if slot falls inside an ongoing block range
                        const isInMiddleOfBlock = blocks.some((b) => {
                          if (b.day_of_week !== d.id) return false;
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

                        const isDragTarget =
                          dragOverSlot?.day === d.id && dragOverSlot?.slotTime === slotTime;
                        const isEmptySlot = !activeBlock && !isInMiddleOfBlock;

                        return (
                          <Box
                            key={`${d.id}-${slotTime}`}
                            tabIndex={isEmptySlot ? 0 : -1}
                            role={isEmptySlot ? 'button' : undefined}
                            aria-label={
                              isEmptySlot
                                ? `Add block on ${d.label} at ${formatTimeDisplay(slotTime)}`
                                : undefined
                            }
                            onClick={() => {
                              if (isEmptySlot) {
                                handleOpenCreateModal({
                                  day: d.id,
                                  startTime: slotTime,
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (isEmptySlot && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleOpenCreateModal({
                                  day: d.id,
                                  startTime: slotTime,
                                });
                              }
                            }}
                            onDragEnter={() => {
                              if (!isInMiddleOfBlock) {
                                setDragOverSlot({ day: d.id, slotTime });
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (
                                !isInMiddleOfBlock &&
                                (dragOverSlot?.day !== d.id ||
                                  dragOverSlot?.slotTime !== slotTime)
                              ) {
                                setDragOverSlot({ day: d.id, slotTime });
                              }
                            }}
                            onDrop={() => handleDropOnSlot(d.id, slotTime)}
                            sx={{
                              height: '100%',
                              borderRadius: 1,
                              border: isDragTarget
                                ? '1.5px solid'
                                : '1px solid transparent',
                              borderColor: isDragTarget ? 'primary.main' : 'transparent',
                              bgcolor: (t) =>
                                isDragTarget
                                  ? alpha(t.palette.primary.main, 0.14)
                                  : isHourHeader
                                    ? alpha(t.palette.text.primary, 0.015)
                                    : 'transparent',
                              position: 'relative',
                              cursor: isEmptySlot ? 'pointer' : 'default',
                              transition: 'background-color 0.12s ease, border-color 0.12s ease',
                              '&:hover': isEmptySlot
                                ? {
                                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                                    borderColor: (t) => alpha(t.palette.primary.main, 0.3),
                                    '& .slot-add-hint': { opacity: 1 },
                                  }
                                : undefined,
                              '&:focus-visible': {
                                outline: `2px solid ${theme.palette.primary.main}`,
                                outlineOffset: -2,
                                '& .slot-add-hint': { opacity: 1 },
                              },
                            }}
                          >
                            {isEmptySlot && (
                              <Box
                                className="slot-add-hint no-print"
                                sx={{
                                  opacity: 0,
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'text.secondary',
                                  pointerEvents: 'none',
                                  transition: 'opacity 0.12s ease',
                                }}
                              >
                                <Plus size={13} />
                              </Box>
                            )}

                            {activeBlock && (
                              <Paper
                                elevation={0}
                                draggable
                                tabIndex={0}
                                role="button"
                                aria-label={`${activeBlock.title} (${activeBlock.block_type}), ${d.label} ${formatTimeDisplay(activeBlock.start_time)} to ${formatTimeDisplay(activeBlock.end_time)}. Click to edit.`}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedBlock(activeBlock);
                                  setDraggedPaletteItem(null);
                                }}
                                onDragEnd={() => {
                                  setDraggedBlock(null);
                                  setDragOverSlot(null);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(activeBlock);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleOpenEditModal(activeBlock);
                                  }
                                }}
                                className={`schedule-block-paper ${
                                  durationSlots <= 2 ? 'schedule-block-compact' : ''
                                }`}
                                sx={{
                                  position: 'absolute',
                                  top: 1,
                                  left: 1,
                                  right: 1,
                                  height: `calc(var(--slot-height, 44px) * ${durationSlots} - 3px)`,
                                  boxSizing: 'border-box',
                                  zIndex: 10,
                                  p: durationSlots === 1 ? 0.5 : 0.75,
                                  px: 1,
                                  borderRadius: 1,
                                  bgcolor: getBlockBackground(activeBlock, isDarkMode),
                                  backgroundImage: getBlockBackgroundImage(
                                    activeBlock,
                                    isDarkMode
                                  ),
                                  color: getBlockTextColor(activeBlock, isDarkMode),
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent:
                                    durationSlots === 1 ? 'center' : 'space-between',
                                  cursor: 'grab',
                                  border: '1.5px solid',
                                  borderColor: getBlockBorderColor(activeBlock, isDarkMode),
                                  overflow: 'hidden',
                                  transition:
                                    resizingState?.blockId === activeBlock.id
                                      ? 'none'
                                      : 'height 0.15s ease, box-shadow 0.15s ease',
                                  '&:hover, &:focus-within': {
                                    zIndex: 20,
                                    boxShadow: (t) =>
                                      `0 4px 12px ${alpha(t.palette.common.black, 0.22)}`,
                                    '& .resize-handle-bar, & .block-action-btn': {
                                      opacity: 1,
                                    },
                                  },
                                  '&:focus-visible': {
                                    outline: `2px solid ${theme.palette.primary.main}`,
                                    outlineOffset: 1,
                                  },
                                  '&:active': { cursor: 'grabbing' },
                                }}
                              >
                                {/* TOP MOUSE RESIZE HANDLE (Revealed on hover/focus) */}
                                <Box
                                  className="no-print resize-handle-bar"
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
                                    height: 6,
                                    cursor: 'ns-resize',
                                    opacity:
                                      resizingState?.blockId === activeBlock.id ? 1 : 0,
                                    bgcolor: alpha('#171614', 0.18),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 15,
                                    transition: 'opacity 0.12s ease',
                                    '&:hover': { bgcolor: alpha('#171614', 0.32) },
                                  }}
                                >
                                  <GripHorizontal
                                    size={10}
                                    color={getBlockTextColor(activeBlock, isDarkMode)}
                                  />
                                </Box>

                                {durationSlots === 1 ? (
                                  /* COMPACT SINGLE 15-MIN SLOT CONTENT */
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    width="100%"
                                    height="100%"
                                    gap={0.5}
                                    sx={{ overflow: 'hidden' }}
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      noWrap
                                      sx={{
                                        fontSize: '0.75rem',
                                        lineHeight: 1.1,
                                        color: 'inherit',
                                        minWidth: 0,
                                      }}
                                    >
                                      {activeBlock.title}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      alignItems="center"
                                      spacing={0.25}
                                      sx={{ flexShrink: 0 }}
                                    >
                                      <Typography
                                        variant="caption"
                                        noWrap
                                        sx={{
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          fontVariantNumeric: 'tabular-nums',
                                          opacity: 0.88,
                                          lineHeight: 1,
                                          color: 'inherit',
                                        }}
                                      >
                                        {formatTimeDisplay(activeBlock.start_time).replace(
                                          / AM| PM/,
                                          ''
                                        )}
                                      </Typography>
                                      <IconButton
                                        className="no-print block-action-btn"
                                        size="small"
                                        aria-label={`Delete ${activeBlock.title} block`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteBlock(activeBlock);
                                        }}
                                        sx={{
                                          opacity: 0,
                                          color: getBlockTextColor(activeBlock, isDarkMode),
                                          p: 0.2,
                                          transition: 'opacity 0.12s ease',
                                        }}
                                      >
                                        <Trash2 size={11} />
                                      </IconButton>
                                    </Stack>
                                  </Box>
                                ) : (
                                  /* MULTI-SLOT 30+ MIN CONTENT */
                                  <>
                                    <Box>
                                      <Box
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        gap={0.5}
                                      >
                                        <Typography
                                          variant="subtitle2"
                                          fontWeight={700}
                                          noWrap
                                          sx={{
                                            fontSize: '0.75rem',
                                            lineHeight: 1.2,
                                            color: 'inherit',
                                          }}
                                        >
                                          {activeBlock.title}
                                        </Typography>
                                        <Stack
                                          direction="row"
                                          alignItems="center"
                                          spacing={0.25}
                                          sx={{ flexShrink: 0 }}
                                        >
                                          {activeBlock.block_type === 'homework' && (
                                            <Chip
                                              label="HW"
                                              size="small"
                                              sx={{
                                                bgcolor: alpha('#171614', 0.14),
                                                color: 'inherit',
                                                height: 18,
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                borderRadius: 1,
                                                '& .MuiChip-label': { px: 0.5 },
                                              }}
                                            />
                                          )}
                                          <IconButton
                                            className="no-print block-action-btn"
                                            size="small"
                                            aria-label={`Delete ${activeBlock.title} block`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteBlock(activeBlock);
                                            }}
                                            sx={{
                                              opacity: 0,
                                              color: getBlockTextColor(activeBlock, isDarkMode),
                                              p: 0.25,
                                              transition: 'opacity 0.12s ease',
                                            }}
                                          >
                                            <Trash2 size={12} />
                                          </IconButton>
                                        </Stack>
                                      </Box>

                                      {activeBlock.note && (
                                        <Typography
                                          variant="caption"
                                          display="block"
                                          noWrap
                                          className="schedule-block-note"
                                          sx={{
                                            fontSize: '0.75rem',
                                            fontWeight: 400,
                                            fontStyle: 'italic',
                                            opacity: 0.88,
                                            mt: 0.25,
                                            lineHeight: 1.15,
                                            color: 'inherit',
                                          }}
                                        >
                                          {activeBlock.note}
                                        </Typography>
                                      )}
                                    </Box>

                                    <Box
                                      display="flex"
                                      alignItems="center"
                                      justifyContent="space-between"
                                      className="schedule-block-time-range"
                                    >
                                      <Typography
                                        variant="caption"
                                        noWrap
                                        sx={{
                                          opacity: 0.9,
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          fontVariantNumeric: 'tabular-nums',
                                          whiteSpace: 'nowrap',
                                          lineHeight: 1,
                                          color: 'inherit',
                                        }}
                                      >
                                        {formatTimeDisplay(activeBlock.start_time)} –{' '}
                                        {formatTimeDisplay(activeBlock.end_time)}
                                      </Typography>
                                    </Box>
                                  </>
                                )}

                                {/* BOTTOM MOUSE RESIZE HANDLE (Revealed on hover/focus) */}
                                <Box
                                  className="no-print resize-handle-bar"
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
                                    height: 6,
                                    cursor: 'ns-resize',
                                    opacity:
                                      resizingState?.blockId === activeBlock.id ? 1 : 0,
                                    bgcolor: alpha('#171614', 0.18),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 15,
                                    transition: 'opacity 0.12s ease',
                                    '&:hover': { bgcolor: alpha('#171614', 0.32) },
                                  }}
                                >
                                  <GripHorizontal
                                    size={10}
                                    color={getBlockTextColor(activeBlock, isDarkMode)}
                                  />
                                </Box>
                              </Paper>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* UNIFIED CREATE / EDIT SCHEDULE BLOCK MODAL */}
      <Dialog
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBlock(null);
          setConfirmingModalDelete(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{editingBlock ? 'Edit Schedule Block' : 'Add Schedule Block'}</span>
          <IconButton
            size="small"
            aria-label="Close schedule block dialog"
            onClick={() => {
              setModalOpen(false);
              setEditingBlock(null);
              setConfirmingModalDelete(false);
            }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} pt={0.5}>
            {/* QUICK SUBJECT / ROUTINE SELECTOR */}
            <TextField
              select
              fullWidth
              size="small"
              label="Subject or Routine Preset"
              value={selectedSubjectId}
              onChange={(e) => handleSelectSubjectPreset(e.target.value)}
            >
              <MenuItem value="">
                <em>Custom Activity / Break (One-Off)</em>
              </MenuItem>
              {subjects.map((sub) => (
                <MenuItem key={sub.id} value={sub.id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: sub.color,
                        flexShrink: 0,
                      }}
                    />
                    <span>{sub.name}</span>
                  </Stack>
                </MenuItem>
              ))}
              {routineTemplates.map((tmpl) => {
                const IconComp = getRoutineIcon(tmpl.iconKey);
                return (
                  <MenuItem key={`preset-${tmpl.id}`} value={`routine:${tmpl.id}`}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ width: '100%' }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconComp size={14} color={theme.palette.text.secondary} />
                        <span>{tmpl.title}</span>
                      </Stack>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {tmpl.defaultDuration}m
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>

            <TextField
              fullWidth
              size="small"
              label="Activity / Block Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />

            {/* BLOCK CATEGORY TYPE TOGGLE */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                mb={0.75}
                display="block"
              >
                Block Category
              </Typography>
              <ToggleButtonGroup
                fullWidth
                color="primary"
                value={editType}
                exclusive
                onChange={(_, val: BlockType | null) => {
                  if (val) setEditType(val);
                }}
                size="small"
              >
                <ToggleButton value="class" sx={{ fontWeight: 700, gap: 0.75, textTransform: 'none' }}>
                  <BookOpen size={15} />
                  Class Block
                </ToggleButton>
                <ToggleButton
                  value="homework"
                  sx={{ fontWeight: 700, gap: 0.75, textTransform: 'none' }}
                >
                  <Edit3 size={15} />
                  Homework
                </ToggleButton>
                <ToggleButton
                  value="custom"
                  sx={{ fontWeight: 700, gap: 0.75, textTransform: 'none' }}
                >
                  <Sparkles size={15} />
                  Break / Routine
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* MULTI-DAY SELECTOR (MON - FRI) */}
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                mb={0.75}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {editingBlock ? 'Day(s) of Week (Select extra days to copy)' : 'Days of Week'}
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Copy size={12} />}
                    onClick={() =>
                      setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
                    }
                    sx={{ py: 0, px: 0.75, fontSize: '0.75rem', fontWeight: 700, minWidth: 0 }}
                  >
                    Mon–Fri
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSelectedDays(['monday', 'wednesday', 'friday'])}
                    sx={{ py: 0, px: 0.75, fontSize: '0.75rem', fontWeight: 700, minWidth: 0 }}
                  >
                    M/W/F
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSelectedDays(['tuesday', 'thursday'])}
                    sx={{ py: 0, px: 0.75, fontSize: '0.75rem', fontWeight: 700, minWidth: 0 }}
                  >
                    T/Th
                  </Button>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedDays.includes(d.id);
                  return (
                    <ButtonBase
                      key={`modal-day-${d.id}`}
                      onClick={() => handleToggleDaySelection(d.id)}
                      aria-pressed={isSelected}
                      sx={{
                        flex: 1,
                        py: 0.75,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected
                          ? (t) => alpha(t.palette.primary.main, 0.12)
                          : 'background.paper',
                        color: isSelected ? 'primary.main' : 'text.secondary',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {d.shortLabel}
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Start Time"
                  value={editStartTime}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setEditStartTime(nextStart);
                    if (timeToMinutes(editEndTime) <= timeToMinutes(nextStart)) {
                      const nextEndMin = Math.min(
                        scheduleEndHour * 60,
                        timeToMinutes(nextStart) + 45
                      );
                      setEditEndTime(minutesToTime(nextEndMin));
                    }
                  }}
                >
                  {timeSlots.map((slot) => (
                    <MenuItem
                      key={`start-${slot}`}
                      value={slot}
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatTimeDisplay(slot)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="End Time"
                  value={
                    validEndTimeSlots.includes(editEndTime)
                      ? editEndTime
                      : validEndTimeSlots[0] || editEndTime
                  }
                  onChange={(e) => setEditEndTime(e.target.value)}
                >
                  {validEndTimeSlots.map((slot) => (
                    <MenuItem
                      key={`end-${slot}`}
                      value={slot}
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatTimeDisplay(slot)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {/* OPTIONAL NOTE DETAILS */}
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Details / Notes (Optional)"
              placeholder="e.g. Read pages 40-55, bring calculator, family lunch"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              helperText="Displayed inside the schedule block and on the student Daily Timeline."
            />

            {/* CLASS / ZOOM CALL LINK */}
            <TextField
              fullWidth
              size="small"
              label="Class / Zoom Call Link (URL)"
              placeholder="e.g. https://zoom.us/j/123456789 or school portal link"
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              helperText="Direct URL to join Zoom call or courseware. Populated automatically if configured on subject."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {editingBlock ? (
            confirmingModalDelete ? (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={() => handleDeleteBlock(editingBlock)}
                  sx={{ fontWeight: 700 }}
                >
                  Confirm Delete?
                </Button>
                <Button
                  variant="text"
                  color="inherit"
                  size="small"
                  onClick={() => setConfirmingModalDelete(false)}
                >
                  Cancel
                </Button>
              </Stack>
            ) : (
              <Button
                color="error"
                onClick={() => setConfirmingModalDelete(true)}
                startIcon={<Trash2 size={16} />}
                sx={{ fontWeight: 700 }}
              >
                Delete Block
              </Button>
            )
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => {
                setModalOpen(false);
                setEditingBlock(null);
                setConfirmingModalDelete(false);
              }}
              color="inherit"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveModalBlock}
              disabled={savingEdit}
              sx={{ fontWeight: 700 }}
            >
              {savingEdit
                ? 'Saving...'
                : editingBlock
                  ? selectedDays.length > 1
                    ? `Save & Apply (${selectedDays.length} Days)`
                    : 'Save Changes'
                  : selectedDays.length > 1
                    ? `Add to ${selectedDays.length} Days`
                    : 'Add Block'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* MANAGE BREAKS & DAILY ROUTINES MODAL */}
      <Dialog
        open={routineModalOpen}
        onClose={() => {
          setRoutineModalOpen(false);
          setConfirmDeleteRoutineId(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Manage Breaks &amp; Daily Routines</span>
          <IconButton
            size="small"
            aria-label="Close breaks and daily routines dialog"
            onClick={() => {
              setRoutineModalOpen(false);
              setConfirmDeleteRoutineId(null);
            }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} pt={0.5}>
            <Typography variant="body2" color="text.secondary">
              Edit your standard break and routine blocks or define new reusable blocks for your palette. Renaming an existing routine also updates its title on your schedule.
            </Typography>

            {/* EXISTING ROUTINE BLOCKS LIST */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                mb={1}
                display="block"
              >
                Saved Routine &amp; Break Blocks ({draftRoutines.length})
              </Typography>
              <Stack spacing={1.25}>
                {draftRoutines.map((routine) => {
                  const isConfirmingDelete = confirmDeleteRoutineId === routine.id;
                  return (
                    <Paper
                      key={routine.id}
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isDarkMode ? '#26231e' : '#f7f4ee',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                      >
                        <TextField
                          select
                          size="small"
                          label="Icon"
                          value={routine.iconKey}
                          onChange={(e) =>
                            handleUpdateDraftRoutine(routine.id, {
                              iconKey: e.target.value as RoutineIconKey,
                            })
                          }
                          sx={{ width: { xs: '100%', sm: 145 }, flexShrink: 0 }}
                        >
                          {ROUTINE_ICON_OPTIONS.map((opt) => {
                            const OptIcon = opt.icon;
                            return (
                              <MenuItem key={opt.key} value={opt.key}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <OptIcon size={14} />
                                  <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                    {opt.label}
                                  </Typography>
                                </Stack>
                              </MenuItem>
                            );
                          })}
                        </TextField>

                        <TextField
                          size="small"
                          fullWidth
                          label="Block Title"
                          value={routine.title}
                          onChange={(e) =>
                            handleUpdateDraftRoutine(routine.id, { title: e.target.value })
                          }
                        />

                        <TextField
                          select
                          size="small"
                          label="Default"
                          value={routine.defaultDuration}
                          onChange={(e) =>
                            handleUpdateDraftRoutine(routine.id, {
                              defaultDuration: Number(e.target.value),
                            })
                          }
                          sx={{
                            width: { xs: '100%', sm: 96 },
                            flexShrink: 0,
                            '& .MuiSelect-select': { fontVariantNumeric: 'tabular-nums' },
                          }}
                        >
                          {ROUTINE_DURATION_OPTIONS.map((mins) => (
                            <MenuItem
                              key={`dur-${routine.id}-${mins}`}
                              value={mins}
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {mins} min
                            </MenuItem>
                          ))}
                        </TextField>

                        {isConfirmingDelete ? (
                          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => handleDeleteDraftRoutine(routine.id)}
                              sx={{
                                minWidth: 0,
                                px: 1,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'none',
                              }}
                            >
                              Confirm?
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              color="inherit"
                              onClick={() => setConfirmDeleteRoutineId(null)}
                              sx={{
                                minWidth: 0,
                                px: 0.75,
                                fontSize: '0.75rem',
                                textTransform: 'none',
                              }}
                            >
                              Cancel
                            </Button>
                          </Stack>
                        ) : (
                          <Tooltip title="Remove from saved routine blocks">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Delete ${routine.title} routine block`}
                                disabled={draftRoutines.length <= 1}
                                onClick={() => setConfirmDeleteRoutineId(routine.id)}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>

            <Divider />

            {/* CREATE NEW STANDARD ROUTINE BLOCK */}
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                mb={1}
                display="block"
              >
                Create New Standard Block for Future Use
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Icon"
                      value={newRoutineIcon}
                      onChange={(e) => setNewRoutineIcon(e.target.value as RoutineIconKey)}
                      sx={{ width: { xs: '100%', sm: 145 }, flexShrink: 0 }}
                    >
                      {ROUTINE_ICON_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon;
                        return (
                          <MenuItem key={`new-icon-${opt.key}`} value={opt.key}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <OptIcon size={14} />
                              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {opt.label}
                              </Typography>
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </TextField>

                    <TextField
                      size="small"
                      fullWidth
                      label="New Routine / Break Title"
                      placeholder="e.g. Morning Devotional, Piano Practice, Quiet Reading"
                      value={newRoutineTitle}
                      onChange={(e) => setNewRoutineTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDraftRoutine();
                        }
                      }}
                    />

                    <TextField
                      select
                      size="small"
                      label="Default"
                      value={newRoutineDuration}
                      onChange={(e) => setNewRoutineDuration(Number(e.target.value))}
                      sx={{
                        width: { xs: '100%', sm: 96 },
                        flexShrink: 0,
                        '& .MuiSelect-select': { fontVariantNumeric: 'tabular-nums' },
                      }}
                    >
                      {ROUTINE_DURATION_OPTIONS.map((mins) => (
                        <MenuItem
                          key={`new-dur-${mins}`}
                          value={mins}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {mins} min
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<Plus size={15} />}
                      onClick={handleAddDraftRoutine}
                      disabled={!newRoutineTitle.trim()}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      Add to Saved Routines
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<RotateCcw size={14} />}
            onClick={handleResetDefaultRoutines}
            sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'none' }}
          >
            Reset Defaults
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              color="inherit"
              onClick={() => {
                setRoutineModalOpen(false);
                setConfirmDeleteRoutineId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveRoutineTemplates}
              disabled={savingRoutines}
              sx={{ fontWeight: 700 }}
            >
              {savingRoutines ? 'Saving...' : 'Save Routine Blocks'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* 5-SECOND UNDO DELETE SNACKBAR */}
      <Snackbar
        open={Boolean(undoDeleteState)}
        autoHideDuration={5000}
        onClose={() => setUndoDeleteState(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          sx={{ borderRadius: 1, alignItems: 'center' }}
          action={
            <Tooltip title="Restore deleted block">
              <Button
                color="inherit"
                size="small"
                startIcon={<RotateCcw size={14} />}
                onClick={handleUndoDelete}
                sx={{ fontWeight: 700 }}
              >
                Undo
              </Button>
            </Tooltip>
          }
        >
          Removed &ldquo;{undoDeleteState?.block.title}&rdquo; from schedule.
        </Alert>
      </Snackbar>

      {/* GLOBAL CSS FOR PRINT MODE: PORTRAIT 1-PAGE FITTED WITH COLOR PRESERVATION */}
      <style jsx global>{`
        .schedule-print-title {
          display: none;
        }

        @media print {
          @page {
            size: letter portrait;
            margin: 0.2in 0.25in;
          }

          :root,
          body,
          main,
          .no-print-root {
            --slot-height: 18px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print,
          .resize-handle-bar,
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
            color: #171614 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }

          .schedule-print-title {
            display: block !important;
            font-size: 1.125rem !important;
            font-weight: 800 !important;
            color: #171614 !important;
            margin-bottom: 6px !important;
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

          .schedule-main-card,
          .schedule-block-paper,
          .MuiPaper-root {
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .schedule-main-card {
            border: 1.5px solid #171614 !important;
            background-color: #ffffff !important;
            padding: 2px !important;
            width: 100% !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .schedule-slot-row {
            height: 18px !important;
            margin: 0 !important;
          }

          .schedule-block-paper {
            border-width: 1px !important;
            left: 0 !important;
            right: 0 !important;
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }

          .schedule-block-compact .schedule-block-note,
          .schedule-block-compact .schedule-block-time-range {
            display: none !important;
          }
        }
      `}</style>
    </Box>
  );
}
