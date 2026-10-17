'use client';

import { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
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
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  const [activeTab, setActiveTab] = useState<'subjects' | 'habits'>('subjects');

  // New Subject Form State
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#0C74E4');
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

  // Edit Subject Modal / Inline Drawer State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('#0C74E4');
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
    try {
      const [{ data: subData }, { data: habitData }] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase.from('habits').select('*').order('sort_order', { ascending: true }),
      ]);

      if (subData) setSubjects(subData as Subject[]);
      if (habitData) setHabits(habitData as Habit[]);
    } catch {
      toast.error('Failed to load subjects and habit trackers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
    setEditSubjectColor(sub.color || '#0C74E4');
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
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));

    try {
      const { error } = await supabase.from('subjects').update({ color }).eq('id', id);
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
              Manage each school subject, designate whether it is taught internally (with Mom) or through an outside entity, and record teacher contact details.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
        </Box>

        <CardContent sx={{ p: 3 }}>
          {activeTab === 'subjects' ? (
            <Box>
              {/* Collapsible Form: Add New Subject */}
              {showAddSubjectForm && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    mb: 3,
                    borderRadius: 2,
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
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Subject Name"
                        placeholder="e.g. Classical Studies, Math, Literature"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Class / Zoom Link (Optional URL)"
                        placeholder="e.g. https://zoom.us/j/123456789"
                        value={newSubjectLink}
                        onChange={(e) => setNewSubjectLink(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" fontWeight={700}>
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
                              sx={{ height: 20, fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}
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
                          sx={{ fontWeight: 700, textTransform: 'none' }}
                        >
                          Save Subject
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* CLEAN DRAGGABLE SUBJECTS DATA ENTRY LIST */}
              <Stack spacing={1.25}>
                {subjects.map((s, idx) => {
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
                      py={1.5}
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
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        flexGrow={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Box
                          title="Drag to reorder"
                          sx={{ color: 'text.disabled', display: 'flex', cursor: 'grab' }}
                        >
                          <GripVertical size={18} />
                        </Box>

                        {/* Color Swatch Picker */}
                        <Box title="Assign Subject Color" display="flex" alignItems="center">
                          <input
                            type="color"
                            value={s.color || '#0C74E4'}
                            onChange={(e) => handleUpdateSubjectColor(s.id, e.target.value)}
                            style={{
                              width: 18,
                              height: 18,
                              padding: 0,
                              border: 'none',
                              borderRadius: '50%',
                              cursor: 'pointer',
                            }}
                          />
                        </Box>

                        {/* Subject Name & Official Course Subtitle */}
                        <Box sx={{ minWidth: 165 }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ fontSize: '0.94rem', lineHeight: 1.2 }}
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
                                fontSize: '0.73rem',
                              }}
                            >
                              {officialCourseName}
                            </Typography>
                          )}
                        </Box>

                        {/* Instruction Designation Badge (Internal vs Outside Entity) */}
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
                              ? `Outside Entity: ${inst.outside_entity_name || 'External Provider'}`
                              : 'Internally (with Mom)'
                          }
                          size="small"
                          color={isExternal ? 'info' : 'success'}
                          variant="outlined"
                          onClick={() => handleOpenEditSubject(s)}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            height: 24,
                            cursor: 'pointer',
                          }}
                        />

                        {/* Teacher Name Pill */}
                        <Chip
                          icon={<User size={12} />}
                          label={
                            inst.teacher_name
                              ? `Teacher: ${inst.teacher_name}`
                              : 'Teacher: Not Set (Click to add)'
                          }
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenEditSubject(s)}
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            height: 24,
                            cursor: 'pointer',
                            color: inst.teacher_name ? 'text.primary' : 'text.secondary',
                          }}
                        />

                        {/* Teacher Contact Info Summary Chips */}
                        {inst.teacher_email && (
                          <Chip
                            icon={<Mail size={12} />}
                            label={inst.teacher_email}
                            size="small"
                            component="a"
                            href={`mailto:${inst.teacher_email}`}
                            clickable
                            variant="outlined"
                            sx={{
                              fontSize: '0.7rem',
                              height: 24,
                              fontWeight: 600,
                            }}
                          />
                        )}

                        {inst.teacher_phone && (
                          <Chip
                            icon={<Phone size={12} />}
                            label={inst.teacher_phone}
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenEditSubject(s)}
                            sx={{
                              fontSize: '0.7rem',
                              height: 24,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          />
                        )}

                        {inst.teacher_contact_notes && (
                          <Chip
                            icon={<FileText size={12} />}
                            label={inst.teacher_contact_notes}
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenEditSubject(s)}
                            sx={{
                              fontSize: '0.7rem',
                              height: 24,
                              color: 'text.secondary',
                              cursor: 'pointer',
                            }}
                          />
                        )}

                        {/* Class / Zoom / Live Classroom Link Pill */}
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
                                ? 'Zoom Link ↗'
                                : s.link.includes('adobeconnect.com')
                                ? 'Live Classroom ↗'
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
                              color: theme.palette.mode === 'dark' ? 'info.light' : 'info.dark',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 24,
                            }}
                          />
                        )}
                      </Stack>

                      {/* Action Buttons */}
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          startIcon={<Edit3 size={13} />}
                          onClick={() => handleOpenEditSubject(s)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.74rem',
                            borderColor: 'divider',
                            py: 0.4,
                          }}
                        >
                          Edit Info
                        </Button>

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
                      </Stack>
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
                    borderRadius: 1.5,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <Edit3 size={15} />
                  Edit Subject, Entity &amp; Teacher Info…
                </MenuItem>
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
                        borderRadius: 1.5,
                        py: 1,
                        gap: 1.25,
                        fontSize: '0.84rem',
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
                        borderRadius: 1.5,
                        py: 1,
                        gap: 1.25,
                        fontSize: '0.84rem',
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
                    if (target) handleDeleteSubject(target.id);
                  }}
                  sx={{
                    borderRadius: 1.5,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: 'error.main',
                  }}
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
                      <Box
                        title="Drag to reorder"
                        sx={{ color: 'text.disabled', display: 'flex', cursor: 'grab' }}
                      >
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
                  sx={{
                    borderRadius: 1.5,
                    py: 1,
                    gap: 1.25,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: 'error.main',
                  }}
                >
                  <Trash2 size={15} />
                  Delete Habit
                </MenuItem>
              </Menu>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* EDIT SUBJECT & TEACHER CONTACT MODAL */}
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
            sx={{
              width: '100%',
              maxWidth: 600,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <Box px={3} py={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700}>
                Edit Subject &amp; Teacher Details — {editingSubject.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Designate whether this class is taught internally or with an outside entity, and record teacher contact information.
              </Typography>
            </Box>

            <Box p={3} sx={{ overflowY: 'auto' }}>
              <Stack spacing={2.5}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Subject Name"
                      value={editSubjectName}
                      onChange={(e) => setEditSubjectName(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <input
                        type="color"
                        value={editSubjectColor}
                        onChange={(e) => setEditSubjectColor(e.target.value)}
                        style={{
                          width: 34,
                          height: 34,
                          padding: 0,
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                        }}
                      />
                      <TextField
                        size="small"
                        label="Accent Color"
                        value={editSubjectColor}
                        onChange={(e) => setEditSubjectColor(e.target.value)}
                        sx={{ width: 120 }}
                      />
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
                    <Paper
                      variant="outlined"
                      onClick={() => {
                        setEditProviderType('internal');
                        if (!editTeacherName) {
                          setEditTeacherName('Mom');
                        }
                      }}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
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
                    </Paper>

                    <Paper
                      variant="outlined"
                      onClick={() => {
                        setEditProviderType('external');
                        if (!editOutsideEntity) {
                          setEditOutsideEntity('Memoria Academy');
                        }
                      }}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
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
                    </Paper>
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
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
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
              <Button onClick={() => setEditingSubject(null)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveEditSubject}
                disabled={savingSubjectEdit}
                startIcon={<Save size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none' }}
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
