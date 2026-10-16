'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
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
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  Video,
  Link as LinkIcon,
  Repeat,
  Calculator,
  Sparkles,
  CheckSquare,
  Upload,
  Menu as MenuIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { Json } from 'src/services/supabase/types';
import { FormattedParentNote } from 'src/components/base/formatted-parent-note';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  MathSyllabusDay,
  SubjectRecurringConfig,
  createDefaultMathConfig,
  generateSubjectWeekNotesStructured,
  parseRecurringConfig,
  resolveSubjectCountersForWeek,
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [syllabusDays, setSyllabusDays] = useState<MathSyllabusDay[]>([]);
  const [activeTab, setActiveTab] = useState<'subjects' | 'habits'>('subjects');

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#0C74E4');
  const [newSubjectLink, setNewSubjectLink] = useState('');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [showAddHabitForm, setShowAddHabitForm] = useState(false);

  // 3-Line Row Action Menu State
  const [subjectMenuAnchorEl, setSubjectMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuSubject, setMenuSubject] = useState<Subject | null>(null);
  const [habitMenuAnchorEl, setHabitMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuHabit, setMenuHabit] = useState<Habit | null>(null);

  // Edit Subject Modal State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('#0C74E4');
  const [editSubjectLink, setEditSubjectLink] = useState('');
  const [savingSubjectEdit, setSavingSubjectEdit] = useState(false);

  // Edit Habit Modal State
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [savingHabitEdit, setSavingHabitEdit] = useState(false);

  // Recurring Config Modal State
  const [recurringSubject, setRecurringSubject] = useState<Subject | null>(null);
  const [recurringDraft, setRecurringDraft] = useState<SubjectRecurringConfig | null>(null);
  const [activeRecurringDay, setActiveRecurringDay] = useState<DayKey>('monday');
  const [previewWeekDate, setPreviewWeekDate] = useState<string>('2026-10-19');
  const [savingRecurring, setSavingRecurring] = useState(false);

  const [draggedSubjectIndex, setDraggedSubjectIndex] = useState<number | null>(null);
  const [draggedHabitIndex, setDraggedHabitIndex] = useState<number | null>(null);

  async function loadData() {
    try {
      const { data: subData } = await supabase
        .from('subjects')
        .select('*')
        .order('sort_order', { ascending: true });

      if (subData) setSubjects(subData as Subject[]);

      const { data: habitData } = await supabase
        .from('habits')
        .select('*')
        .order('sort_order', { ascending: true });

      if (habitData) setHabits(habitData as Habit[]);

      const { data: sylData } = await supabase
        .from('math_syllabus')
        .select('*')
        .order('day_number', { ascending: true });

      if (sylData) setSyllabusDays(sylData as MathSyllabusDay[]);
    } catch {
      toast.error('Failed to load subjects, habits, and syllabus');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const syllabusMap = useMemo(() => {
    const map = new Map<number, MathSyllabusDay>();
    for (const item of syllabusDays) {
      map.set(item.day_number, item);
    }
    return map;
  }, [syllabusDays]);

  // ---------------------------------------------------------------------------
  // SUBJECT HANDLERS
  // ---------------------------------------------------------------------------
  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setSaving(true);
    const cleanLink = sanitizeUrlInput(newSubjectLink);
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          name: newSubjectName.trim(),
          sort_order: subjects.length + 1,
          color: newSubjectColor,
          link: cleanLink,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error adding subject: ${error.message}`);
      } else if (data) {
        setSubjects((prev) => [...prev, data as Subject]);
        setNewSubjectName('');
        setNewSubjectLink('');
        toast.success('Subject added!');
      }
    } catch {
      toast.error('Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setEditSubjectName(sub.name);
    setEditSubjectColor(sub.color || '#0C74E4');
    setEditSubjectLink(sub.link || '');
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubject) return;
    if (!editSubjectName.trim()) {
      toast.error('Subject name cannot be empty');
      return;
    }

    setSavingSubjectEdit(true);
    const cleanLink = sanitizeUrlInput(editSubjectLink);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: editSubjectName.trim(),
          color: editSubjectColor,
          link: cleanLink,
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
                }
              : s
          )
        );
        toast.success('Subject updated!');
        setEditingSubject(null);
      }
    } catch {
      toast.error('Error updating subject');
    } finally {
      setSavingSubjectEdit(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) {
        toast.error(`Failed to delete: ${error.message}`);
      } else {
        setSubjects((prev) => prev.filter((s) => s.id !== id));
        toast.success('Subject deleted');
      }
    } catch {
      toast.error('Failed to delete subject');
    }
  };

  const handleUpdateSubjectColor = async (id: string, color: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, color } : s))
    );

    try {
      const { error } = await supabase
        .from('subjects')
        .update({ color })
        .eq('id', id);

      if (error) {
        toast.error(`Failed to update color: ${error.message}`);
      } else {
        toast.success('Subject block color updated!');
      }
    } catch {
      toast.error('Error updating color');
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

    try {
      for (const item of reordered) {
        await supabase
          .from('subjects')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
      toast.success('Subject order updated!');
    } catch {
      toast.error('Failed to save subject order');
    }
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

    try {
      for (const item of reordered) {
        await supabase
          .from('subjects')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
      toast.success('Subject order updated!');
    } catch {
      toast.error('Failed to save subject order');
    }
  };

  // ---------------------------------------------------------------------------
  // RECURRING CONFIG HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenRecurringModal = (sub: Subject) => {
    setRecurringSubject(sub);
    const parsed = parseRecurringConfig(sub.recurring_config, sub.name);
    setRecurringDraft(parsed);
    setActiveRecurringDay('monday');
  };

  const handleSaveRecurringConfig = async () => {
    if (!recurringSubject || !recurringDraft) return;
    setSavingRecurring(true);
    try {
      const jsonPayload = JSON.parse(JSON.stringify(recurringDraft)) as Json;
      const { error } = await supabase
        .from('subjects')
        .update({ recurring_config: jsonPayload })
        .eq('id', recurringSubject.id);

      if (error) {
        toast.error(`Failed to save recurring settings: ${error.message}`);
      } else {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === recurringSubject.id ? { ...s, recurring_config: jsonPayload } : s
          )
        );
        toast.success(`Recurring settings saved for ${recurringSubject.name}!`);
        setRecurringSubject(null);
      }
    } catch {
      toast.error('Error saving recurring settings');
    } finally {
      setSavingRecurring(false);
    }
  };

  const handleInsertTokenToDayTemplate = (token: string) => {
    if (!recurringDraft) return;
    const currentDay = recurringDraft.days[activeRecurringDay];
    const nextTemplate = currentDay.template
      ? `${currentDay.template}${currentDay.template.endsWith(' ') || currentDay.template.endsWith('\n') ? '' : ' '}${token}`
      : token;
    setRecurringDraft({
      ...recurringDraft,
      days: {
        ...recurringDraft.days,
        [activeRecurringDay]: {
          ...currentDay,
          enabled: true,
          template: nextTemplate,
        },
      },
    });
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

  const handleDeleteHabit = async (id: string) => {
    try {
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) {
        toast.error(`Failed to delete: ${error.message}`);
      } else {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        toast.success('Habit deleted');
      }
    } catch {
      toast.error('Failed to delete habit');
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

    try {
      for (const item of reordered) {
        await supabase
          .from('habits')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
      toast.success('Habit order updated!');
    } catch {
      toast.error('Failed to save habit order');
    }
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

    try {
      for (const item of reordered) {
        await supabase
          .from('habits')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
      }
      toast.success('Habit order updated!');
    } catch {
      toast.error('Failed to save habit order');
    }
  };

  // Live preview of the recurring draft
  const recurringPreviewNotes = useMemo(() => {
    if (!recurringDraft) return null;
    const counters = resolveSubjectCountersForWeek(recurringDraft, previewWeekDate);
    return {
      counters,
      notes: generateSubjectWeekNotesStructured(recurringDraft, counters, syllabusMap),
    };
  }, [recurringDraft, previewWeekDate, syllabusMap]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Unified Page Header Bar */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
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
              Drag any row to reorder. Use the 3-line menu on a subject to edit recurring rules, class links, or delete.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              component="a"
              href="/automations?tab=upload"
              variant="outlined"
              size="small"
              startIcon={<Upload size={15} />}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 1.75,
                py: 0.75,
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              Import Syllabus (AI)
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
                  borderRadius: 2,
                  px: 2,
                  py: 0.75,
                  boxShadow: 'none',
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
                  borderRadius: 2,
                  px: 2,
                  py: 0.75,
                  boxShadow: 'none',
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
          borderRadius: 2.5,
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
                    borderRadius: '6px 6px 0 0',
                    borderBottom: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    bgcolor: 'transparent',
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </Stack>

          <Button
            component="a"
            href="/automations"
            size="small"
            startIcon={<Repeat size={14} />}
            sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.78rem', mb: 0.5 }}
          >
            Automations &amp; Syllabi →
          </Button>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {activeTab === 'subjects' ? (
            <Box>
              {/* Collapsible Form: Add New Subject */}
              {showAddSubjectForm && (
                <Box
                  sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="primary.main" display="block" mb={1.5}>
                    NEW SCHOOL SUBJECT
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      label="Subject Name"
                      placeholder="e.g. Foreign Language, Computer Science, Math"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      label="Class / Zoom Link (Optional URL)"
                      placeholder="e.g. https://zoom.us/j/123456789"
                      value={newSubjectLink}
                      onChange={(e) => setNewSubjectLink(e.target.value)}
                    />

                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" fontWeight={600}>
                        Color:
                      </Typography>
                      <input
                        type="color"
                        value={newSubjectColor}
                        onChange={(e) => setNewSubjectColor(e.target.value)}
                        style={{
                          width: 32,
                          height: 32,
                          padding: 0,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                        }}
                      />
                    </Box>

                    <Button
                      variant="contained"
                      color="primary"
                      onClick={async () => {
                        await handleAddSubject();
                        setShowAddSubjectForm(false);
                      }}
                      disabled={saving || !newSubjectName.trim()}
                      startIcon={<Plus size={16} />}
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'none' }}
                    >
                      Save Subject
                    </Button>
                  </Stack>
                </Box>
              )}

              {/* CLEAN DRAGGABLE SUBJECTS LIST */}
              <Stack spacing={1}>
                {subjects.map((s, idx) => {
                  const recConfig = parseRecurringConfig(s.recurring_config, s.name);
                  const activeDayKeys =
                    recConfig.mode === 'math_syllabus'
                      ? DAY_KEYS.filter((dk) => {
                          const mc = recConfig.math_config || createDefaultMathConfig();
                          return (
                            (mc.fast_facts_enabled && mc.fast_facts_days.includes(dk)) ||
                            (mc.attend_class_enabled && mc.attend_class_days.includes(dk)) ||
                            (mc.homework_enabled && (dk === 'monday' || dk === 'wednesday')) ||
                            recConfig.days[dk].enabled
                          );
                        })
                      : DAY_KEYS.filter((dk) => recConfig.days[dk].enabled);

                  return (
                    <Box
                      key={s.id}
                      draggable
                      onDragStart={() => handleSubjectDragStart(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSubjectDrop(idx)}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      flexWrap="wrap"
                      gap={1.5}
                      px={2}
                      py={1.35}
                      borderRadius={2}
                      border="1px solid"
                      borderColor="divider"
                      bgcolor="background.paper"
                      sx={{
                        cursor: 'grab',
                        transition: 'border-color 0.15s ease, background-color 0.15s ease',
                        '&:hover': {
                          borderColor: alpha(theme.palette.primary.main, 0.45),
                          bgcolor: alpha(theme.palette.primary.main, 0.015),
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5} flexGrow={1} flexWrap="wrap">
                        <Box title="Drag to reorder" sx={{ color: 'text.disabled', display: 'flex', cursor: 'grab' }}>
                          <GripVertical size={18} />
                        </Box>

                        {/* Color Swatch Picker */}
                        <Box title="Assign Subject Color" display="flex" alignItems="center">
                          <input
                            type="color"
                            value={s.color || '#0C74E4'}
                            onChange={(e) => handleUpdateSubjectColor(s.id, e.target.value)}
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

                        {/* Subject Name */}
                        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.92rem' }}>
                          {s.name}
                        </Typography>

                        {/* Recurring Status Badge */}
                        {recConfig.enabled ? (
                          <Chip
                            icon={recConfig.mode === 'math_syllabus' ? <Calculator size={12} /> : <Repeat size={12} />}
                            label={
                              recConfig.mode === 'math_syllabus'
                                ? '64-Day Math Syllabus'
                                : activeDayKeys.map((d) => DAY_LABELS[d].slice(0, 3)).join(' · ')
                            }
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => handleOpenRecurringModal(s)}
                            sx={{ fontWeight: 600, fontSize: '0.72rem', height: 24, cursor: 'pointer' }}
                          />
                        ) : (
                          <Chip
                            label="Manual / No Auto-Fill"
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenRecurringModal(s)}
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary', cursor: 'pointer' }}
                          />
                        )}

                        {/* Class / Zoom Link Pill */}
                        {s.link && (
                          <Chip
                            icon={s.link.includes('zoom.us') ? <Video size={12} /> : <LinkIcon size={12} />}
                            label={s.link.includes('zoom.us') ? 'Zoom Link ↗' : 'Class Link ↗'}
                            size="small"
                            component="a"
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            clickable
                            sx={{
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              color: 'info.dark',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 24,
                            }}
                          />
                        )}
                      </Stack>

                      {/* Clean 3-Line Menu Trigger */}
                      <IconButton
                        size="small"
                        aria-label="Subject options"
                        onClick={(e) => {
                          setSubjectMenuAnchorEl(e.currentTarget);
                          setMenuSubject(s);
                        }}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          p: 0.65,
                        }}
                      >
                        <MenuIcon size={16} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>

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
                      minWidth: 230,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                    },
                  },
                }}
              >
                {menuSubject && (
                  <Box sx={{ px: 1.5, py: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {menuSubject.name}
                    </Typography>
                  </Box>
                )}
                <MenuItem
                  onClick={() => {
                    const target = menuSubject;
                    setSubjectMenuAnchorEl(null);
                    setMenuSubject(null);
                    if (target) handleOpenRecurringModal(target);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 600 }}
                >
                  <Repeat size={15} color={theme.palette.primary.main} />
                  Configure Recurring Rules…
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    const target = menuSubject;
                    setSubjectMenuAnchorEl(null);
                    setMenuSubject(null);
                    if (target) handleOpenEditSubject(target);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
                >
                  <Edit3 size={15} />
                  Edit Name, Color &amp; Link…
                </MenuItem>
                {menuSubject && subjects.findIndex((x) => x.id === menuSubject.id) > 0 && (
                  <MenuItem
                    onClick={() => {
                      const idx = subjects.findIndex((x) => x.id === menuSubject.id);
                      setSubjectMenuAnchorEl(null);
                      setMenuSubject(null);
                      if (idx > 0) handleMoveSubject(idx, 'up');
                    }}
                    sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
                  >
                    <ArrowUp size={15} />
                    Move Up
                  </MenuItem>
                )}
                {menuSubject && subjects.findIndex((x) => x.id === menuSubject.id) < subjects.length - 1 && (
                  <MenuItem
                    onClick={() => {
                      const idx = subjects.findIndex((x) => x.id === menuSubject.id);
                      setSubjectMenuAnchorEl(null);
                      setMenuSubject(null);
                      if (idx >= 0 && idx < subjects.length - 1) handleMoveSubject(idx, 'down');
                    }}
                    sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
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
                    if (target) handleDeleteSubject(target.id);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 600, color: 'error.main' }}
                >
                  <Trash2 size={15} />
                  Delete Subject
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
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="primary.main" display="block" mb={1.5}>
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
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'none' }}
                    >
                      Save Habit
                    </Button>
                  </Stack>
                </Box>
              )}

              {/* CLEAN DRAGGABLE HABITS LIST */}
              <Stack spacing={1}>
                {habits.map((h, idx) => (
                  <Box
                    key={h.id}
                    draggable
                    onDragStart={() => handleHabitDragStart(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleHabitDrop(idx)}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    px={2}
                    py={1.35}
                    borderRadius={2}
                    border="1px solid"
                    borderColor="divider"
                    bgcolor="background.paper"
                    sx={{
                      cursor: 'grab',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': {
                        borderColor: alpha(theme.palette.secondary.main, 0.45),
                        bgcolor: alpha(theme.palette.secondary.main, 0.015),
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} flexGrow={1}>
                      <Box title="Drag to reorder" sx={{ color: 'text.disabled', display: 'flex', cursor: 'grab' }}>
                        <GripVertical size={18} />
                      </Box>

                      <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.92rem' }}>
                        {h.title}
                      </Typography>
                    </Stack>

                    <IconButton
                      size="small"
                      aria-label="Habit options"
                      onClick={(e) => {
                        setHabitMenuAnchorEl(e.currentTarget);
                        setMenuHabit(h);
                      }}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        p: 0.65,
                      }}
                    >
                      <MenuIcon size={16} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>

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
                      borderRadius: 2,
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
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
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
                    sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
                  >
                    <ArrowUp size={15} />
                    Move Up
                  </MenuItem>
                )}
                {menuHabit && habits.findIndex((x) => x.id === menuHabit.id) < habits.length - 1 && (
                  <MenuItem
                    onClick={() => {
                      const idx = habits.findIndex((x) => x.id === menuHabit.id);
                      setHabitMenuAnchorEl(null);
                      setMenuHabit(null);
                      if (idx >= 0 && idx < habits.length - 1) handleMoveHabit(idx, 'down');
                    }}
                    sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 500 }}
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
                    if (target) handleDeleteHabit(target.id);
                  }}
                  sx={{ borderRadius: 1.5, py: 1, gap: 1.25, fontSize: '0.84rem', fontWeight: 600, color: 'error.main' }}
                >
                  <Trash2 size={15} />
                  Delete Habit
                </MenuItem>
              </Menu>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* RECURRING RULES CONFIGURATION MODAL (React 19 safe)                  */}
      {/* ===================================================================== */}
      {recurringSubject && recurringDraft && (
        <Box
          onClick={() => setRecurringSubject(null)}
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
              maxWidth: 960,
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
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Repeat size={22} color={theme.palette.primary.main} />
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Recurring Weekly Rules: {recurringSubject.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Define recurring labels, checkboxes, and automatic week/lesson/syllabus counters.
                  </Typography>
                </Box>
              </Stack>
              <Paper
                variant="outlined"
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  borderColor: recurringDraft.enabled ? 'success.main' : 'divider',
                  bgcolor: recurringDraft.enabled ? 'rgba(16, 185, 129, 0.08)' : 'background.default',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Switch
                    checked={recurringDraft.enabled}
                    onChange={(e) =>
                      setRecurringDraft({ ...recurringDraft, enabled: e.target.checked })
                    }
                    color="success"
                  />
                  <Typography variant="subtitle2" fontWeight={800}>
                    {recurringDraft.enabled ? 'Automation Enabled' : 'Automation Disabled'}
                  </Typography>
                  <Chip
                    size="small"
                    label={recurringDraft.enabled ? 'ENABLED' : 'DISABLED'}
                    color={recurringDraft.enabled ? 'success' : 'default'}
                    sx={{ fontWeight: 800, fontSize: '0.68rem', height: 22 }}
                  />
                </Stack>
              </Paper>
            </Box>

            <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
              <Stack spacing={3}>
                {/* 1. 2-ROW TOP BOX: Row 1 = Automation Mode, Row 2 = 3 Reference / Counter Boxes */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.default' }}>
                  <Stack spacing={2.25}>
                    {/* ROW 1: Automation Mode Selection */}
                    <Box>
                      <TextField
                        select
                        SelectProps={{ native: true }}
                        fullWidth
                        size="small"
                        label="Automation Mode"
                        value={recurringDraft.mode}
                        onChange={(e) => {
                          const newMode = e.target.value === 'math_syllabus' ? 'math_syllabus' : 'template';
                          setRecurringDraft({
                            ...recurringDraft,
                            mode: newMode,
                            math_config:
                              newMode === 'math_syllabus'
                                ? recurringDraft.math_config || createDefaultMathConfig()
                                : recurringDraft.math_config,
                          });
                        }}
                        helperText="Choose whether this subject uses standard weekly/daily templates or pulls from the 64-day syllabus."
                      >
                        <option value="template">Standard Weekly / Daily Template (Iterates Week #, Class #, or Lesson #)</option>
                        <option value="math_syllabus">Math Syllabus-Driven Schedule (Days 1–64 Homework + Class Day Labels)</option>
                      </TextField>
                    </Box>

                    <Divider />

                    {/* ROW 2: The 3 Reference & Counter Selection Boxes */}
                    {recurringDraft.mode === 'template' ? (
                      <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Reference Week (Monday)"
                            value={recurringDraft.base_week_date}
                            onChange={(e) =>
                              setRecurringDraft({ ...recurringDraft, base_week_date: e.target.value })
                            }
                            InputLabelProps={{ shrink: true }}
                            helperText="Anchor Monday date"
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Week #"
                            value={recurringDraft.base_week_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_week_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Token: {week} (+1/wk)"
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Start Class #"
                            value={recurringDraft.base_class_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_class_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Token: {class_num}"
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Lesson #"
                            value={recurringDraft.base_lesson_num}
                            onChange={(e) =>
                              setRecurringDraft({
                                ...recurringDraft,
                                base_lesson_num: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            helperText="Token: {lesson} (+1/wk)"
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="Reference Week (Monday)"
                            value={recurringDraft.base_week_date}
                            onChange={(e) =>
                              setRecurringDraft({ ...recurringDraft, base_week_date: e.target.value })
                            }
                            InputLabelProps={{ shrink: true }}
                            helperText="Anchor week used to calculate future weeks"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Tue Syllabus Day #"
                            value={recurringDraft.math_config?.base_tuesday_day ?? 12}
                            onChange={(e) => {
                              const mc = recurringDraft.math_config || createDefaultMathConfig();
                              setRecurringDraft({
                                ...recurringDraft,
                                math_config: {
                                  ...mc,
                                  base_tuesday_day: Math.max(1, parseInt(e.target.value, 10) || 1),
                                },
                              });
                            }}
                            helperText="e.g. Day 12 on 10/12 (+2 each week)"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Ref Thu Syllabus Day #"
                            value={recurringDraft.math_config?.base_thursday_day ?? 13}
                            onChange={(e) => {
                              const mc = recurringDraft.math_config || createDefaultMathConfig();
                              setRecurringDraft({
                                ...recurringDraft,
                                math_config: {
                                  ...mc,
                                  base_thursday_day: Math.max(1, parseInt(e.target.value, 10) || 1),
                                },
                              });
                            }}
                            helperText="e.g. Day 13 on 10/12 (+2 each week)"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Stack>
                </Paper>

                {/* 2A. MATH SYLLABUS MODE CONTROLS */}
                {recurringDraft.mode === 'math_syllabus' && (
                  <Stack spacing={2.5}>
                    {(() => {
                      const mc = recurringDraft.math_config || createDefaultMathConfig();
                      const updateMc = (patch: Partial<typeof mc>) =>
                        setRecurringDraft({
                          ...recurringDraft,
                          math_config: { ...mc, ...patch },
                        });

                      const toggleDayInList = (list: DayKey[], day: DayKey): DayKey[] =>
                        list.includes(day) ? list.filter((d) => d !== day) : [...list, day];

                      return (
                        <>
                          {/* Fast Facts Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  1. Daily &ldquo;Fast Facts&rdquo; Label
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Automatically place Fast Facts on selected days of the week.
                                </Typography>
                              </Box>
                              <Switch
                                checked={mc.fast_facts_enabled}
                                onChange={(e) => updateMc({ fast_facts_enabled: e.target.checked })}
                              />
                            </Stack>

                            {mc.fast_facts_enabled && (
                              <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Fast Facts Label Format"
                                    value={mc.fast_facts_label}
                                    onChange={(e) => updateMc({ fast_facts_label: e.target.value })}
                                    helperText="Use - [ ] for a checkbox. Optional token: {fast_facts}"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={mc.include_fast_facts_topic}
                                        onChange={(e) =>
                                          updateMc({ include_fast_facts_topic: e.target.checked })
                                        }
                                      />
                                    }
                                    label={
                                      <Typography variant="body2">
                                        Include syllabus Fast Facts drill name (e.g., <em>x and ÷ 6&apos;s</em>)
                                      </Typography>
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Typography variant="caption" fontWeight={700} mr={1}>
                                      Active Days:
                                    </Typography>
                                    {DAY_KEYS.map((dk) => (
                                      <Chip
                                        key={dk}
                                        label={DAY_LABELS[dk]}
                                        size="small"
                                        color={mc.fast_facts_days.includes(dk) ? 'primary' : 'default'}
                                        variant={mc.fast_facts_days.includes(dk) ? 'filled' : 'outlined'}
                                        onClick={() =>
                                          updateMc({
                                            fast_facts_days: toggleDayInList(mc.fast_facts_days, dk),
                                          })
                                        }
                                        sx={{ fontWeight: 700, cursor: 'pointer' }}
                                      />
                                    ))}
                                  </Stack>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>

                          {/* Attend Class Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  2. &ldquo;Attend Class - Day #&rdquo; Label (Tues &amp; Thurs)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Displays the syllabus Day # for Tuesday and Thursday classes, plus optional materials/topic toggles.
                                </Typography>
                              </Box>
                              <Switch
                                checked={mc.attend_class_enabled}
                                onChange={(e) => updateMc({ attend_class_enabled: e.target.checked })}
                              />
                            </Stack>

                            {mc.attend_class_enabled && (
                              <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Attend Class Label Format"
                                    value={mc.attend_class_label}
                                    onChange={(e) => updateMc({ attend_class_label: e.target.value })}
                                    helperText="Use {day} for the syllabus day number (e.g. • Attend Class - Day {day})"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Stack spacing={0.5}>
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_materials}
                                          onChange={(e) =>
                                            updateMc({ include_materials: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Include &ldquo;Additional Class Materials to bring today&rdquo; from syllabus
                                        </Typography>
                                      }
                                    />
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_topic}
                                          onChange={(e) =>
                                            updateMc({ include_topic: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Include Lesson Topic title from syllabus
                                        </Typography>
                                      }
                                    />
                                  </Stack>
                                </Grid>
                                <Grid item xs={12}>
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                    <Typography variant="caption" fontWeight={700} mr={1}>
                                      Class Days:
                                    </Typography>
                                    {DAY_KEYS.map((dk) => (
                                      <Chip
                                        key={dk}
                                        label={DAY_LABELS[dk]}
                                        size="small"
                                        color={mc.attend_class_days.includes(dk) ? 'primary' : 'default'}
                                        variant={mc.attend_class_days.includes(dk) ? 'filled' : 'outlined'}
                                        onClick={() =>
                                          updateMc({
                                            attend_class_days: toggleDayInList(mc.attend_class_days, dk),
                                          })
                                        }
                                        sx={{ fontWeight: 700, cursor: 'pointer' }}
                                      />
                                    ))}
                                  </Stack>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>

                          {/* Syllabus Workbook Homework Card */}
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  3. Syllabus Workbook Homework (Mon &amp; Wed)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Automatically assigns Tuesday&apos;s syllabus workbook pages on Monday, and Thursday&apos;s workbook pages on Wednesday.
                                </Typography>
                              </Box>
                              <Switch
                                checked={mc.homework_enabled}
                                onChange={(e) => updateMc({ homework_enabled: e.target.checked })}
                              />
                            </Stack>

                            {mc.homework_enabled && (
                              <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Homework Line Format"
                                    value={mc.homework_label}
                                    onChange={(e) => updateMc({ homework_label: e.target.value })}
                                    helperText="Use {workbook} for workbook pages"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    fullWidth
                                    size="small"
                                    label="Monday Homework Source"
                                    value={mc.monday_homework_source}
                                    onChange={(e) =>
                                      updateMc({
                                        monday_homework_source:
                                          e.target.value === 'tuesday_class' ||
                                          e.target.value === 'thursday_class'
                                            ? e.target.value
                                            : 'none',
                                      })
                                    }
                                  >
                                    <option value="tuesday_class">Tuesday&apos;s Math Class Day</option>
                                    <option value="thursday_class">Thursday&apos;s Math Class Day</option>
                                    <option value="none">None (Disabled on Monday)</option>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    SelectProps={{ native: true }}
                                    fullWidth
                                    size="small"
                                    label="Wednesday Homework Source"
                                    value={mc.wednesday_homework_source}
                                    onChange={(e) =>
                                      updateMc({
                                        wednesday_homework_source:
                                          e.target.value === 'tuesday_class' ||
                                          e.target.value === 'thursday_class'
                                            ? e.target.value
                                            : 'none',
                                      })
                                    }
                                  >
                                    <option value="thursday_class">Thursday&apos;s Math Class Day</option>
                                    <option value="tuesday_class">Tuesday&apos;s Math Class Day</option>
                                    <option value="none">None (Disabled on Wednesday)</option>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12}>
                                  <Stack direction="row" spacing={3} flexWrap="wrap">
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_textbook}
                                          onChange={(e) =>
                                            updateMc({ include_textbook: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Also include Textbook page numbers (<code>{'{textbook}'}</code>)
                                        </Typography>
                                      }
                                    />
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={mc.include_homework_notes}
                                          onChange={(e) =>
                                            updateMc({ include_homework_notes: e.target.checked })
                                          }
                                        />
                                      }
                                      label={
                                        <Typography variant="body2">
                                          Include special teacher homework notes (if any on that syllabus day)
                                        </Typography>
                                      }
                                    />
                                  </Stack>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>
                        </>
                      );
                    })()}
                  </Stack>
                )}

                {/* 2B. DAY-BY-DAY TEMPLATE EDITOR */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} mb={0.5}>
                    {recurringDraft.mode === 'math_syllabus'
                      ? '4. Optional Custom Day Notes (Mon–Fri)'
                      : 'Day-by-Day Recurring Templates & Labels (Mon–Fri)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Select each day of the week to turn its recurring template on/off, toggle &ldquo;Attend Class&rdquo;, and edit the assignment lines.
                  </Typography>

                  {/* Day Tabs */}
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    {DAY_KEYS.map((dk) => {
                      const dCfg = recurringDraft.days[dk];
                      const isSelected = activeRecurringDay === dk;
                      return (
                        <Button
                          key={dk}
                          onClick={() => setActiveRecurringDay(dk)}
                          sx={{
                            fontWeight: 700,
                            textTransform: 'none',
                            px: 2,
                            py: 1,
                            borderRadius: '6px 6px 0 0',
                            borderBottom: '3px solid',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            color: isSelected ? 'primary.main' : 'text.secondary',
                            bgcolor: isSelected ? 'action.hover' : 'transparent',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{DAY_LABELS[dk]}</span>
                            <Chip
                              label={dCfg.enabled ? 'ON' : 'OFF'}
                              size="small"
                              color={dCfg.enabled ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                            />
                          </Stack>
                        </Button>
                      );
                    })}
                  </Stack>

                  {(() => {
                    const dayCfg = recurringDraft.days[activeRecurringDay];
                    const updateDay = (patch: Partial<typeof dayCfg>) =>
                      setRecurringDraft({
                        ...recurringDraft,
                        days: {
                          ...recurringDraft.days,
                          [activeRecurringDay]: { ...dayCfg, ...patch },
                        },
                      });

                    return (
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          justifyContent="space-between"
                        >
                          <FormControlLabel
                            control={
                              <Switch
                                checked={dayCfg.enabled}
                                onChange={(e) => updateDay({ enabled: e.target.checked })}
                                color="primary"
                              />
                            }
                            label={
                              <Typography variant="subtitle2" fontWeight={700}>
                                Enable Recurring Template on {DAY_LABELS[activeRecurringDay]}
                              </Typography>
                            }
                          />

                          {recurringDraft.mode === 'template' && (
                            <Stack direction="row" spacing={2} alignItems="center">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={dayCfg.attend_class}
                                    onChange={(e) =>
                                      updateDay({
                                        enabled: e.target.checked ? true : dayCfg.enabled,
                                        attend_class: e.target.checked,
                                      })
                                    }
                                  />
                                }
                                label={
                                  <Typography variant="body2" fontWeight={600}>
                                    Include &ldquo;Attend Class&rdquo; label
                                  </Typography>
                                }
                              />
                              {dayCfg.attend_class && (
                                <TextField
                                  size="small"
                                  label="Attend Class Label"
                                  value={dayCfg.attend_class_label}
                                  onChange={(e) =>
                                    updateDay({ attend_class_label: e.target.value })
                                  }
                                  sx={{ width: 190 }}
                                />
                              )}
                            </Stack>
                          )}
                        </Stack>

                        {/* Quick Insert Token Buttons */}
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="caption" fontWeight={700} color="text.secondary">
                            Insert Dynamic Token / Format:
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CheckSquare size={13} />}
                            onClick={() => handleInsertTokenToDayTemplate('\n- [ ] ')}
                            sx={{ fontSize: '0.72rem', py: 0.25, textTransform: 'none', fontWeight: 700 }}
                          >
                            + Checkbox Line
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleInsertTokenToDayTemplate('\n• ')}
                            sx={{ fontSize: '0.72rem', py: 0.25, textTransform: 'none', fontWeight: 700 }}
                          >
                            • Bullet Line
                          </Button>
                          <Chip
                            label="{week} (Week #)"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => handleInsertTokenToDayTemplate('{week}')}
                            sx={{ fontWeight: 700, cursor: 'pointer' }}
                          />
                          <Chip
                            label="{class_num} (Daily Class #)"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => handleInsertTokenToDayTemplate('{class_num}')}
                            sx={{ fontWeight: 700, cursor: 'pointer' }}
                          />
                          <Chip
                            label="{lesson} (Lesson #)"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => handleInsertTokenToDayTemplate('{lesson}')}
                            sx={{ fontWeight: 700, cursor: 'pointer' }}
                          />
                          <Chip
                            label="{prev_lesson} (Prev Lesson #)"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={() => handleInsertTokenToDayTemplate('{prev_lesson}')}
                            sx={{ fontWeight: 700, cursor: 'pointer' }}
                          />
                        </Stack>

                        <TextField
                          fullWidth
                          multiline
                          rows={5}
                          label={`${DAY_LABELS[activeRecurringDay]} Recurring Assignment Template`}
                          placeholder="e.g. - [ ] Week {week}, do 2 pages"
                          value={dayCfg.template}
                          onChange={(e) =>
                            updateDay({
                              enabled: e.target.value.trim().length > 0 ? true : dayCfg.enabled,
                              template: e.target.value,
                            })
                          }
                        />
                      </Stack>
                    );
                  })()}
                </Paper>

                {/* 3. LIVE WEEK PREVIEW ACROSS MON-FRI */}
                {recurringPreviewNotes && (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1.5}
                      mb={2}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Sparkles size={18} color={theme.palette.primary.main} />
                        <Typography variant="subtitle2" fontWeight={800}>
                          Live Generated Week Preview
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            recurringDraft.mode === 'math_syllabus'
                              ? `Tue: Day ${recurringPreviewNotes.counters.tuesday_math_day} | Thu: Day ${recurringPreviewNotes.counters.thursday_math_day}`
                              : `Week ${recurringPreviewNotes.counters.week_num} | Start Class ${recurringPreviewNotes.counters.class_num} | Lesson ${recurringPreviewNotes.counters.lesson_num}`
                          }
                          color="primary"
                          sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                        />
                      </Stack>
                      <TextField
                        size="small"
                        type="date"
                        label="Preview Week (Monday)"
                        value={previewWeekDate}
                        onChange={(e) => setPreviewWeekDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 185, bgcolor: 'background.paper' }}
                      />
                    </Stack>

                    <Grid container spacing={1.5}>
                      {DAY_KEYS.map((dk) => {
                        const dayItem = recurringPreviewNotes.notes[dk];
                        const hasContent = Boolean(dayItem.title || dayItem.description);
                        return (
                          <Grid item xs={12} sm={6} md={2.4} key={dk}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                height: '100%',
                                minHeight: 110,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography
                                variant="caption"
                                fontWeight={800}
                                color="primary.main"
                                display="block"
                                mb={0.75}
                                sx={{ textTransform: 'uppercase' }}
                              >
                                {DAY_LABELS[dk]}
                              </Typography>
                              {hasContent ? (
                                <FormattedParentNote
                                  title={dayItem.title}
                                  description={dayItem.description}
                                  color="#1a1a1a"
                                  iconName="FileText"
                                  interactive={false}
                                />
                              ) : (
                                <Typography variant="caption" color="text.disabled">
                                  — No recurring items —
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                )}
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
              <Button onClick={() => setRecurringSubject(null)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveRecurringConfig}
                disabled={savingRecurring}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700 }}
              >
                {savingRecurring ? 'Saving Rules...' : 'Save Recurring Rules'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* EDIT SUBJECT MODAL (React 19 safe) */}
      {editingSubject && (
        <Box
          onClick={() => setEditingSubject(null)}
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
            sx={{ width: '100%', maxWidth: 520, borderRadius: 3, overflow: 'hidden' }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700}>
                Edit Subject
              </Typography>
            </Box>
            <Box p={3}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Subject Name"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  required
                />

                <TextField
                  fullWidth
                  label="Class / Zoom Call Link (URL)"
                  placeholder="e.g. https://zoom.us/j/123456789 or courseware link"
                  value={editSubjectLink}
                  onChange={(e) => setEditSubjectLink(e.target.value)}
                  helperText="This link will automatically appear on all calendar blocks assigned to this class."
                />

                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" fontWeight={700}>
                    Subject Accent Color
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <input
                      type="color"
                      value={editSubjectColor}
                      onChange={(e) => setEditSubjectColor(e.target.value)}
                      style={{
                        width: 36,
                        height: 36,
                        padding: 0,
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    />
                    <TextField
                      size="small"
                      value={editSubjectColor}
                      onChange={(e) => setEditSubjectColor(e.target.value)}
                      sx={{ width: 110 }}
                    />
                  </Stack>
                </Box>
              </Stack>
            </Box>
            <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => setEditingSubject(null)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveEditSubject}
                disabled={savingSubjectEdit}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700 }}
              >
                {savingSubjectEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* EDIT HABIT MODAL (React 19 safe) */}
      {editingHabit && (
        <Box
          onClick={() => setEditingHabit(null)}
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
            sx={{ width: '100%', maxWidth: 420, borderRadius: 3, overflow: 'hidden' }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700}>
                Edit Habit Tracker
              </Typography>
            </Box>
            <Box p={3}>
              <TextField
                fullWidth
                label="Habit Title"
                value={editHabitTitle}
                onChange={(e) => setEditHabitTitle(e.target.value)}
                required
              />
            </Box>
            <Box px={3} py={2} sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button onClick={() => setEditingHabit(null)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveEditHabit}
                disabled={savingHabitEdit}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700 }}
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
