'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  Video,
  Link as LinkIcon,
  Menu as MenuIcon,
  User,
  Building2,
  Mail,
  Phone,
  FileText,
  Repeat,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RouterLink } from 'src/components/base/router-link';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import {
  InstructionProviderType,
  SubjectInstructorInfo,
  createDefaultInstructorInfo,
  parseRecurringConfig,
} from 'src/utils/recurring-planner';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  link?: string | null;
  recurring_config?: Json | null;
}

interface Habit {
  id: string;
  title: string;
  sort_order: number;
}

const OUTSIDE_ENTITY_PRESETS = ['Memoria Academy', 'Amanda Holliday Math'] as const;

const CLASSICAL_SUBJECT_SWATCHES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: 'Oxford Blue', hex: '#1b5698' },
  { label: 'Academy Pine', hex: '#0d735c' },
  { label: 'Terracotta Ink', hex: '#b8422e' },
  { label: 'Botanical Sage', hex: '#1e6f3d' },
  { label: 'Gilded Ochre', hex: '#b85d0c' },
  { label: 'Classical Plum', hex: '#6c43b8' },
  { label: 'Crimson Seal', hex: '#c43235' },
  { label: 'Slate Cobalt', hex: '#2b6cb0' },
];

function sanitizeUrlInput(raw: string): string | null {
  if (!raw.trim()) return null;
  const match = raw.match(/https?:\/\/[^\s]+/i);
  if (match) return match[0];
  if (raw.toLowerCase().includes('zoom.us') || raw.toLowerCase().startsWith('www.')) {
    const domainMatch = raw.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i);
    if (domainMatch) return `https://${domainMatch[0]}`;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.trim();
  return `https://${raw.trim()}`;
}

export default function SubjectsHabitsPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeTab, setActiveTab] = useState<'subjects' | 'habits'>('subjects');

  // New Subject Form State
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#1b5698');
  const [newSubjectLink, setNewSubjectLink] = useState('');
  const [newProviderType, setNewProviderType] =
    useState<InstructionProviderType>('internal');
  const [newOutsideEntity, setNewOutsideEntity] = useState('Memoria Academy');
  const [newTeacherName, setNewTeacherName] = useState('Mom');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');
  const [newTeacherNotes, setNewTeacherNotes] = useState('');

  // New Habit Form State
  const [showAddHabitForm, setShowAddHabitForm] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // 3-Line Row Action Menu State
  const [subjectMenuAnchorEl, setSubjectMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [menuSubject, setMenuSubject] = useState<Subject | null>(null);
  const [habitMenuAnchorEl, setHabitMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuHabit, setMenuHabit] = useState<Habit | null>(null);

  // 2-Step Inline Delete Confirmation State
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(
    null
  );
  const [confirmDeleteHabitId, setConfirmDeleteHabitId] = useState<string | null>(null);

  // Edit Subject Modal / Inline Drawer State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('#1b5698');
  const [editSubjectLink, setEditSubjectLink] = useState('');
  const [editProviderType, setEditProviderType] =
    useState<InstructionProviderType>('internal');
  const [editOutsideEntity, setEditOutsideEntity] = useState('');
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherPhone, setEditTeacherPhone] = useState('');
  const [editTeacherNotes, setEditTeacherNotes] = useState('');
  const [savingSubjectEdit, setSavingSubjectEdit] = useState(false);

  // Edit Habit Modal State
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [savingHabitEdit, setSavingHabitEdit] = useState(false);

  const [draggedSubjectIndex, setDraggedSubjectIndex] = useState<number | null>(null);
  const [draggedHabitIndex, setDraggedHabitIndex] = useState<number | null>(null);

  async function loadData() {
    setLoadError(null);
    try {
      const [{ data: subData, error: subErr }, { data: habitData, error: habErr }] =
        await Promise.all([
          supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
          supabase.from('habits').select('*').order('sort_order', { ascending: true }),
        ]);

      if (subErr) throw subErr;
      if (habErr) throw habErr;

      if (subData) setSubjects(subData as Subject[]);
      if (habitData) setHabits(habitData as Habit[]);
    } catch {
      setLoadError('Failed to load subjects and habit trackers. Please try again.');
      toast.error('Failed to load subjects and habit trackers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingSubject) setEditingSubject(null);
        if (editingHabit) setEditingHabit(null);
        if (confirmDeleteSubjectId) setConfirmDeleteSubjectId(null);
        if (confirmDeleteHabitId) setConfirmDeleteHabitId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSubject, editingHabit, confirmDeleteSubjectId, confirmDeleteHabitId]);

  // ---------------------------------------------------------------------------
  // SUBJECT HANDLERS
  // ---------------------------------------------------------------------------
  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setSaving(true);
    const cleanLink = sanitizeUrlInput(newSubjectLink);
    const baseRec = parseRecurringConfig(null, newSubjectName.trim());
    const instructorInfo: SubjectInstructorInfo = {
      provider_type: newProviderType,
      outside_entity_name:
        newProviderType === 'external' ? newOutsideEntity.trim() : '',
      teacher_name:
        newTeacherName.trim() || (newProviderType === 'internal' ? 'Mom' : ''),
      teacher_email: newTeacherEmail.trim(),
      teacher_phone: newTeacherPhone.trim(),
      teacher_contact_notes: newTeacherNotes.trim(),
    };
    const nextRec = {
      ...baseRec,
      instructor_info: instructorInfo,
    };

    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          name: newSubjectName.trim(),
          sort_order: subjects.length + 1,
          color: newSubjectColor,
          link: cleanLink,
          recurring_config: JSON.parse(JSON.stringify(nextRec)) as Json,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error adding subject: ${error.message}`);
      } else if (data) {
        setSubjects((prev) => [...prev, data as Subject]);
        setNewSubjectName('');
        setNewSubjectLink('');
        setNewProviderType('internal');
        setNewOutsideEntity('Memoria Academy');
        setNewTeacherName('Mom');
        setNewTeacherEmail('');
        setNewTeacherPhone('');
        setNewTeacherNotes('');
        toast.success('Subject added!');
      }
    } catch {
      toast.error('Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditSubject = (sub: Subject) => {
    const rec = parseRecurringConfig(sub.recurring_config, sub.name);
    const inst =
      rec.instructor_info ||
      createDefaultInstructorInfo(
        sub.name,
        rec.course_syllabus?.source_type === 'api_sync',
        rec.course_syllabus?.teacher_name
      );

    setEditingSubject(sub);
    setEditSubjectName(sub.name);
    setEditSubjectColor(sub.color || '#1b5698');
    setEditSubjectLink(sub.link || '');
    setEditProviderType(inst.provider_type);
    setEditOutsideEntity(inst.outside_entity_name || 'Memoria Academy');
    setEditTeacherName(inst.teacher_name);
    setEditTeacherEmail(inst.teacher_email);
    setEditTeacherPhone(inst.teacher_phone);
    setEditTeacherNotes(inst.teacher_contact_notes);
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubject) return;
    if (!editSubjectName.trim()) {
      toast.error('Subject name cannot be empty');
      return;
    }

    setSavingSubjectEdit(true);
    const cleanLink = sanitizeUrlInput(editSubjectLink);
    const existingRec = parseRecurringConfig(
      editingSubject.recurring_config,
      editSubjectName.trim()
    );
    const updatedInstructor: SubjectInstructorInfo = {
      provider_type: editProviderType,
      outside_entity_name:
        editProviderType === 'external' ? editOutsideEntity.trim() : '',
      teacher_name: editTeacherName.trim(),
      teacher_email: editTeacherEmail.trim(),
      teacher_phone: editTeacherPhone.trim(),
      teacher_contact_notes: editTeacherNotes.trim(),
    };

    const updatedRec = {
      ...existingRec,
      instructor_info: updatedInstructor,
      course_syllabus: existingRec.course_syllabus
        ? {
            ...existingRec.course_syllabus,
            teacher_name:
              editTeacherName.trim() || existingRec.course_syllabus.teacher_name,
          }
        : undefined,
    };
    const jsonRec = JSON.parse(JSON.stringify(updatedRec)) as Json;

    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: editSubjectName.trim(),
          color: editSubjectColor,
          link: cleanLink,
          recurring_config: jsonRec,
        })
        .eq('id', editingSubject.id);

      if (error) {
        toast.error(`Failed to update subject: ${error.message}`);
      } else {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === editingSubject.id
              ? {
                  ...s,
                  name: editSubjectName.trim(),
                  color: editSubjectColor,
                  link: cleanLink,
                  recurring_config: jsonRec,
                }
              : s
          )
        );
        toast.success('Subject details & teacher info saved!');
        setEditingSubject(null);
      }
    } catch {
      toast.error('Error updating subject');
    } finally {
      setSavingSubjectEdit(false);
    }
  };

  const handleDeleteSubjectWithUndo = async (subject: Subject) => {
    setConfirmDeleteSubjectId(null);
    const snapshot = { ...subject };
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));

    try {
      const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
      if (error) {
        setSubjects((prev) =>
          [...prev, snapshot].sort((a, b) => a.sort_order - b.sort_order)
        );
        toast.error(`Failed to delete: ${error.message}`);
        return;
      }

      toast(
        (t) => (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              Deleted &ldquo;{snapshot.name}&rdquo;
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                toast.dismiss(t.id);
                const { data, error: restoreErr } = await supabase
                  .from('subjects')
                  .insert({
                    id: snapshot.id,
                    name: snapshot.name,
                    sort_order: snapshot.sort_order,
                    color: snapshot.color,
                    link: snapshot.link ?? null,
                    recurring_config: snapshot.recurring_config ?? null,
                  })
                  .select('*')
                  .single();
                if (!restoreErr && data) {
                  setSubjects((prev) =>
                    [...prev, data as Subject].sort(
                      (a, b) => a.sort_order - b.sort_order
                    )
                  );
                  toast.success(`Restored "${snapshot.name}"`);
                } else {
                  toast.error('Could not restore subject');
                }
              }}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.25,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              Undo
            </Button>
          </Stack>
        ),
        { duration: 5000 }
      );
    } catch {
      setSubjects((prev) =>
        [...prev, snapshot].sort((a, b) => a.sort_order - b.sort_order)
      );
      toast.error('Failed to delete subject');
    }
  };

  const handleUpdateSubjectColor = async (id: string, color: string) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));

    try {
      const { error } = await supabase.from('subjects').update({ color }).eq('id', id);
      if (error) {
        toast.error(`Failed to update color: ${error.message}`);
      } else {
        toast.success('Subject color updated!');
      }
    } catch {
      toast.error('Error updating color');
    }
  };

  const persistSubjectOrder = async (reordered: Subject[]) => {
    try {
      await Promise.all(
        reordered.map((item) =>
          supabase
            .from('subjects')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id)
        )
      );
      toast.success('Subject order updated!');
    } catch {
      toast.error('Failed to save subject order');
    }
  };

  const handleMoveSubject = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subjects.length) return;

    const updated = [...subjects];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    const reordered = updated.map((item, i) => ({
      ...item,
      sort_order: i + 1,
    }));

    setSubjects(reordered);
    await persistSubjectOrder(reordered);
  };

  const handleSubjectDragStart = (index: number) => {
    setDraggedSubjectIndex(index);
  };

  const handleSubjectDrop = async (dropIndex: number) => {
    if (draggedSubjectIndex === null || draggedSubjectIndex === dropIndex) return;

    const updated = [...subjects];
    const [movedItem] = updated.splice(draggedSubjectIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    const reordered = updated.map((item, i) => ({
      ...item,
      sort_order: i + 1,
    }));

    setSubjects(reordered);
    setDraggedSubjectIndex(null);
    await persistSubjectOrder(reordered);
  };

  // ---------------------------------------------------------------------------
  // HABIT HANDLERS
  // ---------------------------------------------------------------------------
  const handleAddHabit = async () => {
    if (!newHabitTitle.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({
          title: newHabitTitle.trim(),
          sort_order: habits.length + 1,
          is_enabled: true,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error adding habit: ${error.message}`);
      } else if (data) {
        setHabits((prev) => [...prev, data as Habit]);
        setNewHabitTitle('');
        toast.success('Habit added!');
      }
    } catch {
      toast.error('Failed to add habit');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditHabitTitle(habit.title);
  };

  const handleSaveEditHabit = async () => {
    if (!editingHabit) return;
    if (!editHabitTitle.trim()) {
      toast.error('Habit title cannot be empty');
      return;
    }

    setSavingHabitEdit(true);
    try {
      const { error } = await supabase
        .from('habits')
        .update({
          title: editHabitTitle.trim(),
        })
        .eq('id', editingHabit.id);

      if (error) {
        toast.error(`Failed to update habit: ${error.message}`);
      } else {
        setHabits((prev) =>
          prev.map((h) =>
            h.id === editingHabit.id ? { ...h, title: editHabitTitle.trim() } : h
          )
        );
        toast.success('Habit updated!');
        setEditingHabit(null);
      }
    } catch {
      toast.error('Error updating habit');
    } finally {
      setSavingHabitEdit(false);
    }
  };

  const handleDeleteHabitWithUndo = async (habit: Habit) => {
    setConfirmDeleteHabitId(null);
    const snapshot = { ...habit };
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));

    try {
      const { error } = await supabase.from('habits').delete().eq('id', habit.id);
      if (error) {
        setHabits((prev) =>
          [...prev, snapshot].sort((a, b) => a.sort_order - b.sort_order)
        );
        toast.error(`Failed to delete: ${error.message}`);
        return;
      }

      toast(
        (t) => (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              Deleted &ldquo;{snapshot.title}&rdquo;
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                toast.dismiss(t.id);
                const { data, error: restoreErr } = await supabase
                  .from('habits')
                  .insert({
                    id: snapshot.id,
                    title: snapshot.title,
                    sort_order: snapshot.sort_order,
                    is_enabled: true,
                  })
                  .select('*')
                  .single();
                if (!restoreErr && data) {
                  setHabits((prev) =>
                    [...prev, data as Habit].sort((a, b) => a.sort_order - b.sort_order)
                  );
                  toast.success(`Restored "${snapshot.title}"`);
                } else {
                  toast.error('Could not restore habit');
                }
              }}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.25,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              Undo
            </Button>
          </Stack>
        ),
        { duration: 5000 }
      );
    } catch {
      setHabits((prev) =>
        [...prev, snapshot].sort((a, b) => a.sort_order - b.sort_order)
      );
      toast.error('Failed to delete habit');
    }
  };

  const persistHabitOrder = async (reordered: Habit[]) => {
    try {
      await Promise.all(
        reordered.map((item) =>
          supabase
            .from('habits')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id)
        )
      );
      toast.success('Habit order updated!');
    } catch {
      toast.error('Failed to save habit order');
    }
  };

  const handleMoveHabit = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= habits.length) return;

    const updated = [...habits];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    const reordered = updated.map((item, i) => ({
      ...item,
      sort_order: i + 1,
    }));

    setHabits(reordered);
    await persistHabitOrder(reordered);
  };

  const handleHabitDragStart = (index: number) => {
    setDraggedHabitIndex(index);
  };

  const handleHabitDrop = async (dropIndex: number) => {
    if (draggedHabitIndex === null || draggedHabitIndex === dropIndex) return;

    const updated = [...habits];
    const [movedItem] = updated.splice(draggedHabitIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    const reordered = updated.map((item, i) => ({
      ...item,
      sort_order: i + 1,
    }));

    setHabits(reordered);
    setDraggedHabitIndex(null);
    await persistHabitOrder(reordered);
  };

  const renderColorSwatches = (
    selectedColor: string,
    onSelect: (hex: string) => void,
    inputAriaLabel: string
  ) => (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
      {CLASSICAL_SUBJECT_SWATCHES.map((swatch) => {
        const isSelected =
          selectedColor.toLowerCase() === swatch.hex.toLowerCase();
        return (
          <Tooltip key={swatch.hex} title={swatch.label}>
            <ButtonBase
              aria-label={`Select ${swatch.label} (${swatch.hex})`}
              onClick={() => onSelect(swatch.hex)}
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: swatch.hex,
                border: isSelected ? '2px solid' : '1px solid',
                borderColor: isSelected ? 'text.primary' : 'divider',
                boxShadow: isSelected
                  ? `0 0 0 2px ${alpha(swatch.hex, 0.35)}`
                  : 'none',
                transition: 'transform 0.12s ease',
                '&:hover': { transform: 'scale(1.12)' },
              }}
            />
          </Tooltip>
        );
      })}
      <Tooltip title="Custom Color Picker">
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.5 }}>
          <input
            type="color"
            aria-label={inputAriaLabel}
            value={selectedColor}
            onChange={(e) => onSelect(e.target.value)}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
        </Box>
      </Tooltip>
    </Stack>
  );

  if (loading) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={76} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }

  return (
    <Box>
      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2.5, borderRadius: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={loadData}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {/* Unified Page Header Bar */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontSize: { xs: '1.35rem', sm: '1.6rem' },
                lineHeight: 1.15,
              }}
            >
              Subjects &amp; Habit Trackers
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Subject order (#1, #2…) controls the exact row sequence on the 2-Page Weekly Binder Planner and Gradebook.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Button
              component={RouterLink}
              href="/automations"
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<Repeat size={15} />}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 1,
                borderColor: 'divider',
                whiteSpace: 'nowrap',
              }}
            >
              Automations &amp; Syllabi
            </Button>
            {activeTab === 'subjects' ? (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Plus size={16} />}
                onClick={() => setShowAddSubjectForm((prev) => !prev)}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1,
                  px: 2,
                  py: 0.75,
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {showAddSubjectForm ? 'Hide Form' : 'Add Subject'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Plus size={16} />}
                onClick={() => setShowAddHabitForm((prev) => !prev)}
                sx={{
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1,
                  px: 2,
                  py: 0.75,
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {showAddHabitForm ? 'Hide Form' : 'Add Habit'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
        }}
      >
        <Box
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 3,
            pt: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {(
              [
                { value: 'subjects', label: `School Subjects (${subjects.length})` },
                { value: 'habits', label: `Habit Trackers (${habits.length})` },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.value;
              return (
                <Button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    borderBottom: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    bgcolor: 'transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {activeTab === 'subjects' ? (
            <Box>
              {/* Collapsible Form: Add New Subject */}
              {showAddSubjectForm && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    mb: 3,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                    borderColor: alpha(theme.palette.primary.main, 0.25),
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={800}
                    color="primary.main"
                    display="block"
                    mb={2}
                    sx={{ letterSpacing: '0.05em' }}
                  >
                    ADD NEW SCHOOL SUBJECT
                  </Typography>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Subject Name"
                        placeholder="e.g. Classical Studies, Math, Literature"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newSubjectName.trim()) {
                            e.preventDefault();
                            await handleAddSubject();
                            setShowAddSubjectForm(false);
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Class / Zoom Link (Optional URL)"
                        placeholder="e.g. https://zoom.us/j/123456789"
                        value={newSubjectLink}
                        onChange={(e) => setNewSubjectLink(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          Classical Ink Color:
                        </Typography>
                        {renderColorSwatches(
                          newSubjectColor,
                          setNewSubjectColor,
                          'Custom color for new subject'
                        )}
                      </Stack>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth
                        size="small"
                        label="Taught By (Instruction Designation)"
                        value={newProviderType}
                        onChange={(e) => {
                          const nextType: InstructionProviderType =
                            e.target.value === 'external' ? 'external' : 'internal';
                          setNewProviderType(nextType);
                          if (nextType === 'internal' && !newTeacherName) {
                            setNewTeacherName('Mom');
                          }
                        }}
                      >
                        <option value="internal">Taught Internally (with Mom)</option>
                        <option value="external">Outside Entity (Memoria Academy, Amanda Holliday Math, etc.)</option>
                      </TextField>
                    </Grid>

                    {newProviderType === 'external' && (
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Outside Entity Name"
                          placeholder="Memoria Academy or Amanda Holliday Math"
                          value={newOutsideEntity}
                          onChange={(e) => setNewOutsideEntity(e.target.value)}
                        />
                        <Stack direction="row" spacing={0.75} mt={0.75} flexWrap="wrap">
                          {OUTSIDE_ENTITY_PRESETS.map((preset) => (
                            <Chip
                              key={preset}
                              label={preset}
                              size="small"
                              color={newOutsideEntity === preset ? 'primary' : 'default'}
                              variant={newOutsideEntity === preset ? 'filled' : 'outlined'}
                              onClick={() => {
                                setNewOutsideEntity(preset);
                                if (
                                  preset === 'Amanda Holliday Math' &&
                                  (!newTeacherName || newTeacherName === 'Mom')
                                ) {
                                  setNewTeacherName('Amanda Holliday');
                                }
                              }}
                              sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                            />
                          ))}
                        </Stack>
                      </Grid>
                    )}

                    <Grid item xs={12} sm={newProviderType === 'external' ? 4 : 8}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher Name"
                        placeholder="e.g. Mom, Amanda Holliday, or Memoria Instructor"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher Email"
                        placeholder="e.g. teacher@memoriaacademy.com"
                        value={newTeacherEmail}
                        onChange={(e) => setNewTeacherEmail(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher Phone"
                        placeholder="e.g. (555) 123-4567"
                        value={newTeacherPhone}
                        onChange={(e) => setNewTeacherPhone(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Contact Notes / Office Hours"
                        placeholder="e.g. Portal messaging or office hours"
                        value={newTeacherNotes}
                        onChange={(e) => setNewTeacherNotes(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setShowAddSubjectForm(false)}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={async () => {
                            await handleAddSubject();
                            setShowAddSubjectForm(false);
                          }}
                          disabled={saving || !newSubjectName.trim()}
                          startIcon={<Plus size={16} />}
                          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
                        >
                          Save Subject
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* STRUCTURED SINGLE-ROW SUBJECTS TABLE */}
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.025) }}>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        ORDER &amp; SUBJECT
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        PROVIDER &amp; TEACHER
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        CONTACT &amp; CURRICULUM LINKS
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        ACTIONS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                          <Typography variant="body2" color="text.secondary" mb={1.5}>
                            No school subjects configured yet.
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Plus size={15} />}
                            onClick={() => setShowAddSubjectForm(true)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
                          >
                            Add First Subject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      subjects.map((s, idx) => {
                        const recConfig = parseRecurringConfig(s.recurring_config, s.name);
                        const officialCourseName =
                          recConfig.course_syllabus?.official_course_name || '';
                        const inst =
                          recConfig.instructor_info ||
                          createDefaultInstructorInfo(
                            s.name,
                            recConfig.course_syllabus?.source_type === 'api_sync',
                            recConfig.course_syllabus?.teacher_name
                          );
                        const isExternal = inst.provider_type === 'external';
                        const isConfirmingDelete = confirmDeleteSubjectId === s.id;

                        return (
                          <TableRow
                            key={s.id}
                            hover
                            draggable
                            onDragStart={() => handleSubjectDragStart(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleSubjectDrop(idx)}
                            sx={{
                              cursor: 'grab',
                              '&:last-child td': { borderBottom: 0 },
                            }}
                          >
                            {/* COL 1: ORDER & SUBJECT */}
                            <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" spacing={1.25} alignItems="center">
                                <Box
                                  title="Drag to reorder"
                                  sx={{
                                    color: 'text.disabled',
                                    display: 'flex',
                                    cursor: 'grab',
                                  }}
                                >
                                  <GripVertical size={16} />
                                </Box>
                                <Chip
                                  size="small"
                                  label={`#${idx + 1}`}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    bgcolor: alpha(theme.palette.text.primary, 0.05),
                                    color: 'text.secondary',
                                  }}
                                />
                                <Tooltip title="Change Subject Color">
                                  <Box display="flex" alignItems="center">
                                    <input
                                      type="color"
                                      aria-label={`Color for ${s.name}`}
                                      value={s.color || '#1b5698'}
                                      onChange={(e) =>
                                        handleUpdateSubjectColor(s.id, e.target.value)
                                      }
                                      style={{
                                        width: 16,
                                        height: 16,
                                        padding: 0,
                                        border: 'none',
                                        borderRadius: '50%',
                                        cursor: 'pointer',
                                      }}
                                    />
                                  </Box>
                                </Tooltip>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    sx={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}
                                  >
                                    {s.name}
                                  </Typography>
                                  {officialCourseName && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        fontStyle: 'italic',
                                        color: 'text.secondary',
                                        fontSize: '0.75rem',
                                        whiteSpace: 'nowrap',
                                        maxWidth: 240,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {officialCourseName}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>

                            {/* COL 2: PROVIDER & TEACHER */}
                            <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  icon={
                                    isExternal ? (
                                      <Building2 size={13} />
                                    ) : (
                                      <User size={13} />
                                    )
                                  }
                                  label={
                                    isExternal
                                      ? inst.outside_entity_name || 'Outside Entity'
                                      : 'Mom (Internal)'
                                  }
                                  size="small"
                                  color={isExternal ? 'info' : 'success'}
                                  variant="outlined"
                                  onClick={() => handleOpenEditSubject(s)}
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    height: 24,
                                    cursor: 'pointer',
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color={inst.teacher_name ? 'text.primary' : 'text.secondary'}
                                  sx={{ whiteSpace: 'nowrap' }}
                                >
                                  {inst.teacher_name || 'No Teacher Set'}
                                </Typography>
                              </Stack>
                            </TableCell>

                            {/* COL 3: CONTACT & CURRICULUM LINKS */}
                            <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                {s.link && (
                                  <Chip
                                    icon={
                                      s.link.includes('zoom.us') ||
                                      s.link.includes('adobeconnect.com') ? (
                                        <Video size={12} />
                                      ) : (
                                        <LinkIcon size={12} />
                                      )
                                    }
                                    label={
                                      s.link.includes('zoom.us')
                                        ? 'Zoom ↗'
                                        : s.link.includes('adobeconnect.com')
                                        ? 'Classroom ↗'
                                        : 'Class Link ↗'
                                    }
                                    size="small"
                                    component="a"
                                    href={s.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    clickable
                                    sx={{
                                      bgcolor: alpha(theme.palette.info.main, 0.1),
                                      color:
                                        theme.palette.mode === 'dark'
                                          ? 'info.light'
                                          : 'info.dark',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      height: 24,
                                    }}
                                  />
                                )}

                                {inst.teacher_email && (
                                  <Tooltip title={`Email ${inst.teacher_email}`}>
                                    <Chip
                                      icon={<Mail size={12} />}
                                      label={inst.teacher_email}
                                      size="small"
                                      component="a"
                                      href={`mailto:${inst.teacher_email}`}
                                      clickable
                                      variant="outlined"
                                      sx={{
                                        fontSize: '0.75rem',
                                        height: 24,
                                        fontWeight: 600,
                                        maxWidth: 190,
                                      }}
                                    />
                                  </Tooltip>
                                )}

                                {(inst.teacher_phone || inst.teacher_contact_notes) && (
                                  <Tooltip
                                    title={
                                      [inst.teacher_phone, inst.teacher_contact_notes]
                                        .filter(Boolean)
                                        .join(' • ')
                                    }
                                  >
                                    <Chip
                                      icon={
                                        inst.teacher_phone ? (
                                          <Phone size={12} />
                                        ) : (
                                          <FileText size={12} />
                                        )
                                      }
                                      label={
                                        inst.teacher_phone ||
                                        inst.teacher_contact_notes
                                      }
                                      size="small"
                                      variant="outlined"
                                      onClick={() => handleOpenEditSubject(s)}
                                      sx={{
                                        fontSize: '0.75rem',
                                        height: 24,
                                        color: 'text.secondary',
                                        cursor: 'pointer',
                                        maxWidth: 160,
                                      }}
                                    />
                                  </Tooltip>
                                )}

                                <Chip
                                  icon={<Repeat size={12} />}
                                  label="Syllabus & Rules"
                                  size="small"
                                  component={RouterLink}
                                  href={`/automations?subject=${s.id}`}
                                  clickable
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.75rem',
                                    height: 24,
                                    fontWeight: 600,
                                  }}
                                />
                              </Stack>
                            </TableCell>

                            {/* COL 4: ACTIONS */}
                            <TableCell align="right" sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              {isConfirmingDelete ? (
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  justifyContent="flex-end"
                                  alignItems="center"
                                >
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="contained"
                                    onClick={() => handleDeleteSubjectWithUndo(s)}
                                    sx={{
                                      minWidth: 0,
                                      px: 1.25,
                                      py: 0.35,
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textTransform: 'none',
                                      borderRadius: 1,
                                    }}
                                  >
                                    Confirm Delete?
                                  </Button>
                                  <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => setConfirmDeleteSubjectId(null)}
                                    sx={{
                                      minWidth: 0,
                                      px: 1,
                                      py: 0.35,
                                      fontSize: '0.75rem',
                                      textTransform: 'none',
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </Stack>
                              ) : (
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  justifyContent="flex-end"
                                  alignItems="center"
                                >
                                  <Tooltip title="Move Up">
                                    <span>
                                      <IconButton
                                        size="small"
                                        aria-label={`Move ${s.name} up`}
                                        disabled={idx === 0}
                                        onClick={() => handleMoveSubject(idx, 'up')}
                                      >
                                        <ArrowUp size={15} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Move Down">
                                    <span>
                                      <IconButton
                                        size="small"
                                        aria-label={`Move ${s.name} down`}
                                        disabled={idx === subjects.length - 1}
                                        onClick={() => handleMoveSubject(idx, 'down')}
                                      >
                                        <ArrowDown size={15} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<Edit3 size={13} />}
                                    onClick={() => handleOpenEditSubject(s)}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      py: 0.35,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Edit Info
                                  </Button>
                                  <IconButton
                                    size="small"
                                    aria-label={`More options for ${s.name}`}
                                    onClick={(e) => {
                                      setSubjectMenuAnchorEl(e.currentTarget);
                                      setMenuSubject(s);
                                    }}
                                    sx={{
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      p: 0.6,
                                    }}
                                  >
                                    <MenuIcon size={15} />
                                  </IconButton>
                                </Stack>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Subject 3-Line Dropdown Menu */}
              <Menu
                anchorEl={subjectMenuAnchorEl}
                open={Boolean(subjectMenuAnchorEl && menuSubject)}
                onClose={() => {
                  setSubjectMenuAnchorEl(null);
                  setMenuSubject(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                  paper: {
                    elevation: 4,
                    sx: {
                      mt: 0.5,
                      minWidth: 235,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                    },
                  },
                }}
              >
                {menuSubject && (
                  <Box sx={{ px: 1.5, py: 0.75 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {menuSubject.name}
                    </Typography>
                  </Box>
                )}
                <MenuItem
                  onClick={() => {
                    const target = menuSubject;
                    setSubjectMenuAnchorEl(null);
                    setMenuSubject(null);
                    if (target) handleOpenEditSubject(target);
                  }}
                  sx={{
                    borderRadius: 1,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  <Edit3 size={15} />
                  Edit Subject, Entity &amp; Teacher Info…
                </MenuItem>
                {menuSubject && (
                  <MenuItem
                    component={RouterLink}
                    href={`/automations?subject=${menuSubject.id}`}
                    onClick={() => {
                      setSubjectMenuAnchorEl(null);
                      setMenuSubject(null);
                    }}
                    sx={{
                      borderRadius: 1,
                      py: 1,
                      gap: 1.25,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    <Repeat size={15} />
                    Syllabus &amp; Automation Rules…
                  </MenuItem>
                )}
                {menuSubject &&
                  subjects.findIndex((x) => x.id === menuSubject.id) > 0 && (
                    <MenuItem
                      onClick={() => {
                        const idx = subjects.findIndex((x) => x.id === menuSubject.id);
                        setSubjectMenuAnchorEl(null);
                        setMenuSubject(null);
                        if (idx > 0) handleMoveSubject(idx, 'up');
                      }}
                      sx={{
                        borderRadius: 1,
                        py: 1,
                        gap: 1.25,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      <ArrowUp size={15} />
                      Move Up
                    </MenuItem>
                  )}
                {menuSubject &&
                  subjects.findIndex((x) => x.id === menuSubject.id) <
                    subjects.length - 1 && (
                    <MenuItem
                      onClick={() => {
                        const idx = subjects.findIndex((x) => x.id === menuSubject.id);
                        setSubjectMenuAnchorEl(null);
                        setMenuSubject(null);
                        if (idx >= 0 && idx < subjects.length - 1)
                          handleMoveSubject(idx, 'down');
                      }}
                      sx={{
                        borderRadius: 1,
                        py: 1,
                        gap: 1.25,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      <ArrowDown size={15} />
                      Move Down
                    </MenuItem>
                  )}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => {
                    const target = menuSubject;
                    setSubjectMenuAnchorEl(null);
                    setMenuSubject(null);
                    if (target) setConfirmDeleteSubjectId(target.id);
                  }}
                  sx={{
                    borderRadius: 1,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'error.main',
                  }}
                >
                  <Trash2 size={15} />
                  Delete Subject…
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Box>
              {/* Collapsible Form: Add New Habit */}
              {showAddHabitForm && (
                <Box
                  sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="primary.main"
                    display="block"
                    mb={1.5}
                  >
                    NEW DAILY HABIT TRACKER
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="New Habit Title"
                      placeholder="e.g. Vitamin 1, Reading 20m, Chores"
                      value={newHabitTitle}
                      onChange={(e) => setNewHabitTitle(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newHabitTitle.trim()) {
                          e.preventDefault();
                          await handleAddHabit();
                          setShowAddHabitForm(false);
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={async () => {
                        await handleAddHabit();
                        setShowAddHabitForm(false);
                      }}
                      disabled={saving || !newHabitTitle.trim()}
                      startIcon={<Plus size={16} />}
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        textTransform: 'none',
                        borderRadius: 1,
                      }}
                    >
                      Save Habit
                    </Button>
                  </Stack>
                </Box>
              )}

              {/* STRUCTURED SINGLE-ROW HABITS TABLE */}
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.025) }}>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        ORDER &amp; DAILY HABIT
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          whiteSpace: 'nowrap',
                          py: 1.25,
                        }}
                      >
                        ACTIONS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {habits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 5 }}>
                          <Typography variant="body2" color="text.secondary" mb={1.5}>
                            No daily habit trackers configured yet.
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Plus size={15} />}
                            onClick={() => setShowAddHabitForm(true)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}
                          >
                            Add First Habit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      habits.map((h, idx) => {
                        const isConfirmingDelete = confirmDeleteHabitId === h.id;
                        return (
                          <TableRow
                            key={h.id}
                            hover
                            draggable
                            onDragStart={() => handleHabitDragStart(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleHabitDrop(idx)}
                            sx={{
                              cursor: 'grab',
                              '&:last-child td': { borderBottom: 0 },
                            }}
                          >
                            <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" alignItems="center" spacing={1.25}>
                                <Box
                                  title="Drag to reorder"
                                  sx={{
                                    color: 'text.disabled',
                                    display: 'flex',
                                    cursor: 'grab',
                                  }}
                                >
                                  <GripVertical size={16} />
                                </Box>
                                <Chip
                                  size="small"
                                  label={`#${idx + 1}`}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    bgcolor: alpha(theme.palette.text.primary, 0.05),
                                    color: 'text.secondary',
                                  }}
                                />
                                <Typography variant="subtitle2" fontWeight={700}>
                                  {h.title}
                                </Typography>
                              </Stack>
                            </TableCell>

                            <TableCell align="right" sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                              {isConfirmingDelete ? (
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  justifyContent="flex-end"
                                  alignItems="center"
                                >
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="contained"
                                    onClick={() => handleDeleteHabitWithUndo(h)}
                                    sx={{
                                      minWidth: 0,
                                      px: 1.25,
                                      py: 0.35,
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textTransform: 'none',
                                      borderRadius: 1,
                                    }}
                                  >
                                    Confirm Delete?
                                  </Button>
                                  <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => setConfirmDeleteHabitId(null)}
                                    sx={{
                                      minWidth: 0,
                                      px: 1,
                                      py: 0.35,
                                      fontSize: '0.75rem',
                                      textTransform: 'none',
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </Stack>
                              ) : (
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  justifyContent="flex-end"
                                  alignItems="center"
                                >
                                  <Tooltip title="Move Up">
                                    <span>
                                      <IconButton
                                        size="small"
                                        aria-label={`Move ${h.title} up`}
                                        disabled={idx === 0}
                                        onClick={() => handleMoveHabit(idx, 'up')}
                                      >
                                        <ArrowUp size={15} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Move Down">
                                    <span>
                                      <IconButton
                                        size="small"
                                        aria-label={`Move ${h.title} down`}
                                        disabled={idx === habits.length - 1}
                                        onClick={() => handleMoveHabit(idx, 'down')}
                                      >
                                        <ArrowDown size={15} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<Edit3 size={13} />}
                                    onClick={() => handleOpenEditHabit(h)}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      py: 0.35,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Rename
                                  </Button>
                                  <IconButton
                                    size="small"
                                    aria-label={`More options for ${h.title}`}
                                    onClick={(e) => {
                                      setHabitMenuAnchorEl(e.currentTarget);
                                      setMenuHabit(h);
                                    }}
                                    sx={{
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      p: 0.6,
                                    }}
                                  >
                                    <MenuIcon size={15} />
                                  </IconButton>
                                </Stack>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Habit 3-Line Dropdown Menu */}
              <Menu
                anchorEl={habitMenuAnchorEl}
                open={Boolean(habitMenuAnchorEl && menuHabit)}
                onClose={() => {
                  setHabitMenuAnchorEl(null);
                  setMenuHabit(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                  paper: {
                    elevation: 4,
                    sx: {
                      mt: 0.5,
                      minWidth: 210,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                    },
                  },
                }}
              >
                <MenuItem
                  onClick={() => {
                    const target = menuHabit;
                    setHabitMenuAnchorEl(null);
                    setMenuHabit(null);
                    if (target) handleOpenEditHabit(target);
                  }}
                  sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 500 }}
                >
                  <Edit3 size={15} />
                  Rename Habit…
                </MenuItem>
                {menuHabit && habits.findIndex((x) => x.id === menuHabit.id) > 0 && (
                  <MenuItem
                    onClick={() => {
                      const idx = habits.findIndex((x) => x.id === menuHabit.id);
                      setHabitMenuAnchorEl(null);
                      setMenuHabit(null);
                      if (idx > 0) handleMoveHabit(idx, 'up');
                    }}
                    sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    <ArrowUp size={15} />
                    Move Up
                  </MenuItem>
                )}
                {menuHabit &&
                  habits.findIndex((x) => x.id === menuHabit.id) < habits.length - 1 && (
                    <MenuItem
                      onClick={() => {
                        const idx = habits.findIndex((x) => x.id === menuHabit.id);
                        setHabitMenuAnchorEl(null);
                        setMenuHabit(null);
                        if (idx >= 0 && idx < habits.length - 1)
                          handleMoveHabit(idx, 'down');
                      }}
                      sx={{ borderRadius: 1, py: 1, gap: 1.25, fontSize: '0.875rem', fontWeight: 500 }}
                    >
                      <ArrowDown size={15} />
                      Move Down
                    </MenuItem>
                  )}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => {
                    const target = menuHabit;
                    setHabitMenuAnchorEl(null);
                    setMenuHabit(null);
                    if (target) setConfirmDeleteHabitId(target.id);
                  }}
                  sx={{
                    borderRadius: 1,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'error.main',
                  }}
                >
                  <Trash2 size={15} />
                  Delete Habit…
                </MenuItem>
              </Menu>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* EDIT SUBJECT & TEACHER CONTACT MODAL */}
      {editingSubject && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-subject-modal-title"
          onClick={() => setEditingSubject(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
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
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 1,
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
              <Box>
                <Typography id="edit-subject-modal-title" variant="h6" fontWeight={700}>
                  Edit Subject &amp; Teacher Details — {editingSubject.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Designate whether this class is taught internally or with an outside entity, and record teacher contact information.
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label="Close modal"
                onClick={() => setEditingSubject(null)}
              >
                <X size={18} />
              </IconButton>
            </Box>

            <Box p={3} sx={{ overflowY: 'auto' }}>
              <Stack spacing={2.5}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Subject Name"
                      value={editSubjectName}
                      onChange={(e) => setEditSubjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editSubjectName.trim()) {
                          e.preventDefault();
                          handleSaveEditSubject();
                        }
                      }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Classical Ink Color:
                      </Typography>
                      {renderColorSwatches(
                        editSubjectColor,
                        setEditSubjectColor,
                        `Custom color for ${editingSubject.name}`
                      )}
                    </Stack>
                  </Grid>
                </Grid>

                <Divider />

                {/* Instruction Designation */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>
                    Instruction Designation
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <ButtonBase
                      aria-pressed={editProviderType === 'internal'}
                      onClick={() => {
                        setEditProviderType('internal');
                        if (!editTeacherName) {
                          setEditTeacherName('Mom');
                        }
                      }}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 1,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        border: '1px solid',
                        borderColor:
                          editProviderType === 'internal'
                            ? 'success.main'
                            : 'divider',
                        bgcolor:
                          editProviderType === 'internal'
                            ? alpha(theme.palette.success.main, 0.06)
                            : 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <User
                          size={16}
                          color={
                            editProviderType === 'internal'
                              ? theme.palette.success.main
                              : theme.palette.text.secondary
                          }
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            Taught Internally (with Mom)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Home instruction led by Mom
                          </Typography>
                        </Box>
                      </Stack>
                    </ButtonBase>

                    <ButtonBase
                      aria-pressed={editProviderType === 'external'}
                      onClick={() => {
                        setEditProviderType('external');
                        if (!editOutsideEntity) {
                          setEditOutsideEntity('Memoria Academy');
                        }
                      }}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 1,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        border: '1px solid',
                        borderColor:
                          editProviderType === 'external' ? 'info.main' : 'divider',
                        bgcolor:
                          editProviderType === 'external'
                            ? alpha(theme.palette.info.main, 0.06)
                            : 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Building2
                          size={16}
                          color={
                            editProviderType === 'external'
                              ? theme.palette.info.main
                              : theme.palette.text.secondary
                          }
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            Outside Entity
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Memoria Academy, Amanda Holliday Math, etc.
                          </Typography>
                        </Box>
                      </Stack>
                    </ButtonBase>
                  </Stack>

                  {editProviderType === 'external' && (
                    <Box mt={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Outside Entity Name"
                        placeholder="e.g. Memoria Academy or Amanda Holliday Math"
                        value={editOutsideEntity}
                        onChange={(e) => setEditOutsideEntity(e.target.value)}
                      />
                      <Stack direction="row" spacing={1} alignItems="center" mt={1} flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Quick Select:
                        </Typography>
                        {OUTSIDE_ENTITY_PRESETS.map((preset) => (
                          <Chip
                            key={preset}
                            label={preset}
                            size="small"
                            color={editOutsideEntity === preset ? 'info' : 'default'}
                            variant={editOutsideEntity === preset ? 'filled' : 'outlined'}
                            onClick={() => {
                              setEditOutsideEntity(preset);
                              if (
                                preset === 'Amanda Holliday Math' &&
                                (!editTeacherName || editTeacherName === 'Mom')
                              ) {
                                setEditTeacherName('Amanda Holliday');
                              }
                            }}
                            sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Divider />

                {/* Teacher & Contact Information */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    Teacher &amp; Contact Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher for This Class"
                        placeholder="e.g. Mom, Amanda Holliday, or Memoria Teacher"
                        value={editTeacherName}
                        onChange={(e) => setEditTeacherName(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher Email"
                        placeholder="e.g. instructor@memoriaacademy.com"
                        value={editTeacherEmail}
                        onChange={(e) => setEditTeacherEmail(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Teacher Phone"
                        placeholder="e.g. (555) 123-4567"
                        value={editTeacherPhone}
                        onChange={(e) => setEditTeacherPhone(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Contact Notes / Portal / Office Hours"
                        placeholder="e.g. Message via Memoria Portal, Tue/Thu office hours"
                        value={editTeacherNotes}
                        onChange={(e) => setEditTeacherNotes(e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                <TextField
                  fullWidth
                  size="small"
                  label="Class / Zoom Call Link (URL)"
                  placeholder="e.g. https://zoom.us/j/123456789 or online classroom link"
                  value={editSubjectLink}
                  onChange={(e) => setEditSubjectLink(e.target.value)}
                  helperText="Appears on calendar blocks assigned to this class."
                />
              </Stack>
            </Box>

            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}
            >
              <Button
                onClick={() => setEditingSubject(null)}
                color="inherit"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveEditSubject}
                disabled={savingSubjectEdit}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
              >
                {savingSubjectEdit ? 'Saving...' : 'Save Subject Info'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* EDIT HABIT MODAL */}
      {editingHabit && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-habit-modal-title"
          onClick={() => setEditingHabit(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            bgcolor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={12}
            onClick={(e) => e.stopPropagation()}
            sx={{ width: '100%', maxWidth: 420, borderRadius: 1, overflow: 'hidden' }}
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
              <Typography id="edit-habit-modal-title" variant="h6" fontWeight={700}>
                Edit Habit Tracker
              </Typography>
              <IconButton
                size="small"
                aria-label="Close modal"
                onClick={() => setEditingHabit(null)}
              >
                <X size={18} />
              </IconButton>
            </Box>
            <Box p={3}>
              <TextField
                fullWidth
                autoFocus
                label="Habit Title"
                value={editHabitTitle}
                onChange={(e) => setEditHabitTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editHabitTitle.trim()) {
                    e.preventDefault();
                    handleSaveEditHabit();
                  }
                }}
                required
              />
            </Box>
            <Box
              px={3}
              py={2}
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}
            >
              <Button
                onClick={() => setEditingHabit(null)}
                color="inherit"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveEditHabit}
                disabled={savingHabitEdit}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}
              >
                {savingHabitEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

