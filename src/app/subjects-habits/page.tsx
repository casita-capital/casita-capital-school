'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';

interface Subject {
  id: string;
  name: string;
  sort_order: number;
  color: string;
}

interface Habit {
  id: string;
  title: string;
  sort_order: number;
}

export default function SubjectsHabitsPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeTab, setActiveTab] = useState<'subjects' | 'habits'>('subjects');

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#0C74E4');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [saving, setSaving] = useState(false);

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
    } catch {
      toast.error('Failed to load subjects and habits');
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
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          name: newSubjectName.trim(),
          sort_order: subjects.length + 1,
          color: newSubjectColor,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error adding subject: ${error.message}`);
      } else if (data) {
        setSubjects((prev) => [...prev, data as Subject]);
        setNewSubjectName('');
        toast.success('Subject added!');
      }
    } catch {
      toast.error('Failed to add subject');
    } finally {
      setSaving(false);
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
      <PageHeading
        heading="Subjects & Habit Trackers Manager"
        caption="Define your 8 school subjects in 1 draggable column with block colors, and organize habit tracker lines for your printable weekly binder planners."
      />

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
              <Tabs
                value={activeTab}
                onChange={(_, val) => setActiveTab(val)}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab label={`School Subjects (${subjects.length})`} value="subjects" sx={{ fontWeight: 700 }} />
                <Tab label={`Habit Trackers (${habits.length})`} value="habits" sx={{ fontWeight: 700 }} />
              </Tabs>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {activeTab === 'subjects' ? (
                <Box>
                  {/* Form: Add New Subject */}
                  <Stack direction="row" spacing={2} mb={3} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      label="New Subject Name"
                      placeholder="e.g. Foreign Language, Computer Science"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                    />

                    {/* Color Input */}
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" fontWeight={600}>
                        Color:
                      </Typography>
                      <input
                        type="color"
                        value={newSubjectColor}
                        onChange={(e) => setNewSubjectColor(e.target.value)}
                        style={{
                          width: 36,
                          height: 36,
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
                      onClick={handleAddSubject}
                      disabled={saving || !newSubjectName.trim()}
                      startIcon={<Plus size={16} />}
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Add Subject
                    </Button>
                  </Stack>

                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    Single-Column Draggable Subjects List (1–{subjects.length})
                  </Typography>
                  <Typography variant="caption" color="text.secondary" mb={2} display="block">
                    Drag items or use the up/down arrows to re-order 1 to {subjects.length}. Click the color circle to assign block colors for weekly time scheduling.
                  </Typography>

                  {/* SINGLE COLUMN DRAGGABLE SUBJECTS LIST */}
                  <Stack spacing={1.5}>
                    {subjects.map((s, idx) => (
                      <Box
                        key={s.id}
                        draggable
                        onDragStart={() => handleSubjectDragStart(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleSubjectDrop(idx)}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        p={2}
                        borderRadius={2}
                        border="2px solid"
                        borderColor="divider"
                        bgcolor="background.paper"
                        sx={{
                          cursor: 'grab',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: 3,
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
                          <Tooltip title="Drag to reorder">
                            <Box sx={{ color: 'text.secondary', display: 'flex', cursor: 'grab' }}>
                              <GripVertical size={20} />
                            </Box>
                          </Tooltip>

                          {/* Index Badge */}
                          <Chip
                            label={`#${idx + 1}`}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 700, minWidth: 32 }}
                          />

                          {/* Color Swatch Picker */}
                          <Tooltip title="Assign Block Color">
                            <Box display="flex" alignItems="center">
                              <input
                                type="color"
                                value={s.color || '#0C74E4'}
                                onChange={(e) => handleUpdateSubjectColor(s.id, e.target.value)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  padding: 0,
                                  border: 'none',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                }}
                              />
                            </Box>
                          </Tooltip>

                          {/* Subject Name */}
                          <Typography variant="subtitle1" fontWeight={700}>
                            {s.name}
                          </Typography>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          <IconButton
                            size="small"
                            disabled={idx === 0}
                            onClick={() => handleMoveSubject(idx, 'up')}
                          >
                            <ArrowUp size={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={idx === subjects.length - 1}
                            onClick={() => handleMoveSubject(idx, 'down')}
                          >
                            <ArrowDown size={18} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteSubject(s.id)}>
                            <Trash2 size={18} />
                          </IconButton>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Box>
                  {/* Form: Add New Habit */}
                  <Stack direction="row" spacing={2} mb={3}>
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
                      onClick={handleAddHabit}
                      disabled={saving || !newHabitTitle.trim()}
                      startIcon={<Plus size={16} />}
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Add Habit
                    </Button>
                  </Stack>

                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    Single-Column Draggable Habits List (1–{habits.length})
                  </Typography>
                  <Typography variant="caption" color="text.secondary" mb={2} display="block">
                    Drag items or use the up/down arrows to re-order 1 to {habits.length}. The order matches the habit rows on Page 2 of your Weekly Planner.
                  </Typography>

                  {/* SINGLE COLUMN DRAGGABLE HABITS LIST */}
                  <Stack spacing={1.5}>
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
                        p={2}
                        borderRadius={2}
                        border="2px solid"
                        borderColor="divider"
                        bgcolor="background.paper"
                        sx={{
                          cursor: 'grab',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: 'secondary.main',
                            boxShadow: 3,
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
                          <Tooltip title="Drag to reorder">
                            <Box sx={{ color: 'text.secondary', display: 'flex', cursor: 'grab' }}>
                              <GripVertical size={20} />
                            </Box>
                          </Tooltip>

                          {/* Index Badge */}
                          <Chip
                            label={`#${idx + 1}`}
                            size="small"
                            color="secondary"
                            sx={{ fontWeight: 700, minWidth: 32 }}
                          />

                          {/* Habit Title */}
                          <Typography variant="subtitle1" fontWeight={700}>
                            {h.title}
                          </Typography>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          <IconButton
                            size="small"
                            disabled={idx === 0}
                            onClick={() => handleMoveHabit(idx, 'up')}
                          >
                            <ArrowUp size={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={idx === habits.length - 1}
                            onClick={() => handleMoveHabit(idx, 'down')}
                          >
                            <ArrowDown size={18} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteHabit(h.id)}>
                            <Trash2 size={18} />
                          </IconButton>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar Info */}
        <Grid item xs={12} lg={4}>
          <Card elevation={8} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <BookOpen size={22} color={theme.palette.primary.main} />
                <Typography variant="h5" fontWeight={700}>
                  Curriculum Tips
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Subjects Order:</strong> The order defined here (1–8) determines the row sequence printed on both Page 1 and Page 2 of your binder planners.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Block Colors:</strong> Each subject color assigned here will be highlighted in future time-block weekly scheduling tools.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Habit Lines:</strong> Habit titles match the printable bubble rows on the right sidebar of Page 2.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
