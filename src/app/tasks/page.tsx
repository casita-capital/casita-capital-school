'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Search,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Repeat,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { getCachedActiveUserName, resolveAndSyncActiveUser } from 'src/utils/active-user';
import {
  computeNextUncompletedOccurrenceDate,
  formatShortDate,
  formatTaskRecurrenceSummary,
  generateTaskOccurrenceDates,
  getDefaultDaysForFrequency,
  getTodayIsoStr,
  parseTaskRecurrenceConfig,
  SchoolTaskRow,
  serializeTaskRecurrenceConfig,
  TASK_FREQUENCY_OPTIONS,
  TASK_WEEKDAYS,
  TaskEndType,
  TaskFrequency,
  TaskRecurrenceConfig,
  TaskWeekday,
} from 'src/utils/task-recurrence';

type SortField = 'due_date' | 'priority' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function TasksPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<SchoolTaskRow[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'recurring' | 'completed' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Column level sorting states
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingTask, setEditingTask] = useState<SchoolTaskRow | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Recurrence Modal State
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<TaskFrequency>('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<TaskWeekday[]>(['monday']);
  const [startDate, setStartDate] = useState<string>(() => getTodayIsoStr());
  const [endType, setEndType] = useState<TaskEndType>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [occurrenceCount, setOccurrenceCount] = useState<string>('10');
  const [completedDates, setCompletedDates] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  async function fetchTasks() {
    try {
      void resolveAndSyncActiveUser(supabase);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(`Failed to load tasks: ${error.message}`);
      } else if (data) {
        setTasks(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching tasks';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTasks();
  }, []);

  const handleOpenCreateModal = () => {
    const today = getTodayIsoStr();
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setDueDate(today);
    setPriority('medium');
    setIsRecurring(false);
    setFrequency('weekly');
    setStartDate(today);
    setDaysOfWeek(getDefaultDaysForFrequency('weekly', today));
    setEndType('never');
    setEndDate('');
    setOccurrenceCount('10');
    setCompletedDates([]);
    setOpenModal(true);
  };

  const handleOpenEditModal = (task: SchoolTaskRow) => {
    const today = getTodayIsoStr();
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setDueDate(task.due_date || '');
    setPriority(task.priority);

    const parsedRec = task.is_recurring
      ? parseTaskRecurrenceConfig(task.recurrence_config, task.due_date)
      : null;

    if (task.is_recurring && parsedRec) {
      setIsRecurring(true);
      setFrequency(parsedRec.frequency);
      setDaysOfWeek(parsedRec.days_of_week);
      setStartDate(parsedRec.start_date);
      setEndType(parsedRec.end_type);
      setEndDate(parsedRec.end_date || '');
      setOccurrenceCount(
        parsedRec.occurrence_count ? String(parsedRec.occurrence_count) : '10'
      );
      setCompletedDates(parsedRec.completed_dates);
    } else {
      setIsRecurring(false);
      setFrequency('weekly');
      const initStart = task.due_date || today;
      setStartDate(initStart);
      setDaysOfWeek(getDefaultDaysForFrequency('weekly', initStart));
      setEndType('never');
      setEndDate('');
      setOccurrenceCount('10');
      setCompletedDates([]);
    }

    setOpenModal(true);
  };

  const handleFrequencyChange = (nextFreq: TaskFrequency) => {
    setFrequency(nextFreq);
    setDaysOfWeek(getDefaultDaysForFrequency(nextFreq, startDate || getTodayIsoStr()));
  };

  const handleToggleWeekday = (dayKey: TaskWeekday) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length === 1) return prev; // Keep at least 1 day selected
        return prev.filter((d) => d !== dayKey);
      }
      return [...prev, dayKey];
    });
  };

  // Build live recurrence config preview inside modal
  const draftRecurrenceConfig = useMemo<TaskRecurrenceConfig>(() => {
    const parsedCount = Math.max(1, parseInt(occurrenceCount, 10) || 10);
    return {
      frequency,
      days_of_week: daysOfWeek,
      start_date: startDate || getTodayIsoStr(),
      end_type: endType,
      end_date: endType === 'on_date' ? endDate || null : null,
      occurrence_count: endType === 'after_count' ? parsedCount : null,
      completed_dates: completedDates,
    };
  }, [frequency, daysOfWeek, startDate, endType, endDate, occurrenceCount, completedDates]);

  const previewUpcomingDates = useMemo(() => {
    if (!isRecurring) return [];
    const startObj = new Date(`${draftRecurrenceConfig.start_date}T00:00:00`);
    if (Number.isNaN(startObj.getTime())) return [];
    const horizon = new Date(startObj);
    horizon.setDate(horizon.getDate() + 180);
    const yyyy = horizon.getFullYear();
    const mm = String(horizon.getMonth() + 1).padStart(2, '0');
    const dd = String(horizon.getDate()).padStart(2, '0');
    return generateTaskOccurrenceDates(
      draftRecurrenceConfig,
      draftRecurrenceConfig.start_date,
      `${yyyy}-${mm}-${dd}`
    ).slice(0, 5);
  }, [isRecurring, draftRecurrenceConfig]);

  const handleToggleTaskStatus = async (task: SchoolTaskRow) => {
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();

    const parsedRec = task.is_recurring
      ? parseTaskRecurrenceConfig(task.recurrence_config, task.due_date)
      : null;

    // For a recurring task that is currently pending, checking it off completes the current due_date occurrence and advances to the next one
    if (task.is_recurring && parsedRec && task.status !== 'completed') {
      const targetOccurrenceDate = task.due_date || parsedRec.start_date;
      const updatedCompletedDates = Array.from(
        new Set([...parsedRec.completed_dates, targetOccurrenceDate])
      );
      const nextCfg: TaskRecurrenceConfig = {
        ...parsedRec,
        completed_dates: updatedCompletedDates,
      };
      const { nextDate, allCompleted } = computeNextUncompletedOccurrenceDate(nextCfg);
      const nextStatus: 'pending' | 'completed' = allCompleted ? 'completed' : 'pending';
      const serialized = serializeTaskRecurrenceConfig(nextCfg);

      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            due_date: nextDate,
            status: nextStatus,
            recurrence_config: serialized,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', task.id);

        if (error) {
          toast.error(`Failed to update recurring task: ${error.message}`);
        } else {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    due_date: nextDate,
                    status: nextStatus,
                    recurrence_config: serialized,
                    updated_by: activeUserName,
                    updated_at: nowIso,
                  }
                : t
            )
          );
          if (allCompleted) {
            toast.success(`Completed final occurrence of "${task.title}"! 🎉`);
          } else {
            toast.success(
              `Completed ${formatShortDate(targetOccurrenceDate)}! Next scheduled for ${formatShortDate(
                nextDate || targetOccurrenceDate
              )}.`
            );
          }
        }
      } catch {
        toast.error('Error updating recurring task');
      }
      return;
    }

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          updated_by: activeUserName,
          updated_at: nowIso,
        })
        .eq('id', task.id);

      if (error) {
        toast.error(`Failed to update status: ${error.message}`);
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: newStatus, updated_by: activeUserName, updated_at: nowIso }
              : t
          )
        );
        toast.success(newStatus === 'completed' ? 'Task completed! 🎉' : 'Task marked as pending');
      }
    } catch {
      toast.error('Error updating task status');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        toast.error(`Failed to delete task: ${error.message}`);
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        toast.success('Task deleted');
      }
    } catch {
      toast.error('Error deleting task');
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (isRecurring) {
      if (!startDate) {
        toast.error('Please select a starting date for the recurring task');
        return;
      }
      if (endType === 'on_date' && !endDate) {
        toast.error('Please select an end date for the recurring task');
        return;
      }
      if (endType === 'on_date' && endDate < startDate) {
        toast.error('End date must be on or after the starting date');
        return;
      }
      if (endType === 'after_count') {
        const countNum = parseInt(occurrenceCount, 10);
        if (Number.isNaN(countNum) || countNum < 1) {
          toast.error('Please enter a valid number of events (at least 1)');
          return;
        }
      }
    }

    setSaving(true);
    const activeUserName = getCachedActiveUserName();
    const nowIso = new Date().toISOString();

    const effectiveDueDate = isRecurring
      ? computeNextUncompletedOccurrenceDate(draftRecurrenceConfig).nextDate || startDate
      : dueDate || null;

    const effectiveRecurrenceJson = isRecurring
      ? serializeTaskRecurrenceConfig(draftRecurrenceConfig)
      : null;

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            due_date: effectiveDueDate,
            priority,
            is_recurring: isRecurring,
            recurrence_config: effectiveRecurrenceJson,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', editingTask.id);

        if (error) {
          toast.error(`Failed to update task: ${error.message}`);
        } else {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === editingTask.id
                ? {
                    ...t,
                    title: title.trim(),
                    description: description.trim() || null,
                    due_date: effectiveDueDate,
                    priority,
                    is_recurring: isRecurring,
                    recurrence_config: effectiveRecurrenceJson,
                    updated_by: activeUserName,
                    updated_at: nowIso,
                  }
                : t
            )
          );
          toast.success(isRecurring ? 'Recurring task updated!' : 'Task updated!');
          setOpenModal(false);
        }
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            due_date: effectiveDueDate,
            priority,
            status: 'pending',
            is_recurring: isRecurring,
            recurrence_config: effectiveRecurrenceJson,
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to create task: ${error.message}`);
        } else if (data) {
          setTasks((prev) => [data, ...prev]);
          toast.success(isRecurring ? 'Recurring task created!' : 'Task created!');
          setOpenModal(false);
        }
      }
    } catch {
      toast.error('Error saving task');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'priority' ? 'desc' : 'asc');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'pending' && t.status === 'completed') return false;
    if (activeTab === 'recurring' && !t.is_recurring) return false;
    if (activeTab === 'completed' && t.status !== 'completed') return false;
    if (activeTab === 'high' && t.priority !== 'high') return false;

    const query = searchQuery.toLowerCase();
    const matchesTitle = t.title.toLowerCase().includes(query);
    const matchesDesc = (t.description || '').toLowerCase().includes(query);
    return matchesTitle || matchesDesc;
  });

  const priorityWeight: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortField === 'priority') {
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;
      return sortOrder === 'asc' ? weightA - weightB : weightB - weightA;
    }

    if (sortField === 'due_date') {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return sortOrder === 'asc'
        ? a.due_date.localeCompare(b.due_date)
        : b.due_date.localeCompare(a.due_date);
    }

    return 0;
  });

  const getPriorityColor = (p: string): 'error' | 'warning' | 'info' => {
    switch (p) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
    }
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const selectedFrequencyMeta = TASK_FREQUENCY_OPTIONS.find((f) => f.value === frequency);

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
        heading="To-Do List & Task Management"
        caption="Track one-time action items and recurring tasks (daily, weekly, 2x/week, etc.) that automatically appear on your Dashboard and Weekly Planner."
        actions={
          <Button
            variant="contained"
            color="success"
            startIcon={<Plus size={18} />}
            onClick={handleOpenCreateModal}
            sx={{ fontWeight: 600 }}
          >
            New Task
          </Button>
        }
      />

      <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            indicatorColor="primary"
            textColor="primary"
            sx={{ minHeight: 40 }}
          >
            <Tab label={`All Tasks (${tasks.length})`} value="all" sx={{ fontWeight: 600 }} />
            <Tab
              label={`Pending (${tasks.filter((t) => t.status !== 'completed').length})`}
              value="pending"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label={`Recurring (${tasks.filter((t) => t.is_recurring).length})`}
              value="recurring"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label={`Completed (${tasks.filter((t) => t.status === 'completed').length})`}
              value="completed"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label={`High Priority (${tasks.filter((t) => t.priority === 'high').length})`}
              value="high"
              sx={{ fontWeight: 600 }}
            />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', md: 260 } }}
          />
        </Box>

        {/* HIGH-DENSITY SCANNABLE TABLE VIEW WITH INDIVIDUALLY SORTABLE COLUMNS */}
        <TableContainer component={Box}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 60, align: 'center' }}>DONE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TASK / SCHEDULE</TableCell>

                {/* SORTABLE DUE DATE COLUMN HEADER */}
                <TableCell
                  onClick={() => handleToggleSort('due_date')}
                  sx={{
                    fontWeight: 700,
                    width: 210,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>NEXT / DUE DATE</span>
                    {renderSortIcon('due_date')}
                  </Stack>
                </TableCell>

                {/* SORTABLE PRIORITY COLUMN HEADER */}
                <TableCell
                  onClick={() => handleToggleSort('priority')}
                  sx={{
                    fontWeight: 700,
                    width: 150,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>PRIORITY</span>
                    {renderSortIcon('priority')}
                  </Stack>
                </TableCell>

                <TableCell sx={{ fontWeight: 700, width: 100, textAlign: 'right' }}>
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Box textAlign="center">
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          color: 'common.white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 2,
                        }}
                      >
                        <CheckSquare size={28} />
                      </Box>
                      <Typography variant="h4" fontWeight={700} gutterBottom>
                        No Tasks Found
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}
                      >
                        Get started by creating a one-time task or a recurring task schedule.
                      </Typography>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={handleOpenCreateModal}
                        startIcon={<Plus size={18} />}
                        sx={{ fontWeight: 700 }}
                      >
                        Add First Task
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  const recCfg = task.is_recurring
                    ? parseTaskRecurrenceConfig(task.recurrence_config, task.due_date)
                    : null;

                  return (
                    <TableRow
                      key={task.id}
                      hover
                      sx={{
                        opacity: isCompleted ? 0.6 : 1,
                        bgcolor: isCompleted ? 'action.hover' : 'transparent',
                      }}
                    >
                      <TableCell align="center">
                        <Tooltip
                          title={
                            task.is_recurring && !isCompleted
                              ? `Complete ${task.due_date || 'next'} occurrence & advance schedule`
                              : 'Toggle completed'
                          }
                        >
                          <Box component="span" sx={{ display: 'inline-flex' }}>
                            <Checkbox
                              checked={isCompleted}
                              onChange={() => void handleToggleTaskStatus(task)}
                              color="success"
                            />
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={{ textDecoration: isCompleted ? 'line-through' : 'none' }}
                          >
                            {task.title}
                          </Typography>
                          {recCfg && (
                            <Chip
                              icon={<Repeat size={13} />}
                              label={formatTaskRecurrenceSummary(recCfg)}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderRadius: 1,
                              }}
                            />
                          )}
                          {recCfg && recCfg.completed_dates.length > 0 && (
                            <Chip
                              label={`${recCfg.completed_dates.length} done`}
                              size="small"
                              color="success"
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                borderRadius: 1,
                              }}
                            />
                          )}
                        </Stack>
                        {task.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {task.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <Chip
                            icon={<CalendarIcon size={14} />}
                            label={
                              recCfg
                                ? `Next: ${formatShortDate(task.due_date)} (${task.due_date})`
                                : task.due_date
                            }
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No due date
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={task.priority.toUpperCase()}
                          size="small"
                          color={getPriorityColor(task.priority)}
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenEditModal(task)}
                          >
                            <Edit2 size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => void handleDeleteTask(task.id)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* CREATE / EDIT TASK MODAL */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveTask}>
          <DialogTitle fontWeight={700}>
            {editingTask ? 'Edit To-Do Task' : 'Create New To-Do Task'}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2.5} pt={0.5}>
              <TextField
                fullWidth
                label="Task Title"
                placeholder="e.g. Practice Piano, Review Flashcards, Library Book Return"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                placeholder="Add extra details or instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Schedule Type Toggle: One-Time vs Recurring */}
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  display="block"
                  mb={0.75}
                >
                  TASK SCHEDULE TYPE
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={isRecurring ? 'recurring' : 'one_time'}
                  onChange={(_, val) => {
                    if (!val) return;
                    const nextRec = val === 'recurring';
                    setIsRecurring(nextRec);
                    if (nextRec && !startDate) {
                      setStartDate(dueDate || getTodayIsoStr());
                    }
                  }}
                >
                  <ToggleButton
                    value="one_time"
                    sx={{ fontWeight: 700, textTransform: 'none', py: 0.85 }}
                  >
                    <CalendarIcon size={15} style={{ marginRight: 6 }} />
                    One-Time Due Date
                  </ToggleButton>
                  <ToggleButton
                    value="recurring"
                    sx={{ fontWeight: 700, textTransform: 'none', py: 0.85 }}
                  >
                    <Repeat size={15} style={{ marginRight: 6 }} />
                    Recurring Schedule (Daily, Weekly, 2x/Week…)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {!isRecurring ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Priority"
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as 'low' | 'medium' | 'high')
                      }
                    >
                      <MenuItem value="low">Low Priority</MenuItem>
                      <MenuItem value="medium">Medium Priority</MenuItem>
                      <MenuItem value="high">High Priority</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Due Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </Grid>
                </Grid>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                    borderColor: alpha(theme.palette.primary.main, 0.25),
                  }}
                >
                  <Stack spacing={2.25}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={7}>
                        <TextField
                          fullWidth
                          select
                          size="small"
                          label="Frequency"
                          value={frequency}
                          onChange={(e) =>
                            handleFrequencyChange(e.target.value as TaskFrequency)
                          }
                          helperText={selectedFrequencyMeta?.helperText}
                        >
                          {TASK_FREQUENCY_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth
                          select
                          size="small"
                          label="Priority"
                          value={priority}
                          onChange={(e) =>
                            setPriority(e.target.value as 'low' | 'medium' | 'high')
                          }
                        >
                          <MenuItem value="low">Low Priority</MenuItem>
                          <MenuItem value="medium">Medium Priority</MenuItem>
                          <MenuItem value="high">High Priority</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>

                    {/* Weekday Selector Pills for Weekly / 2x per Week / 3x per Week / Biweekly / Custom */}
                    {selectedFrequencyMeta?.usesDayPicker && (
                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={0.75}
                        >
                          <Typography variant="caption" fontWeight={700} color="text.secondary">
                            REPEAT ON DAYS OF THE WEEK
                          </Typography>
                          {selectedFrequencyMeta.recommendedDayCount && (
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color={
                                daysOfWeek.length === selectedFrequencyMeta.recommendedDayCount
                                  ? 'success.main'
                                  : 'warning.main'
                              }
                            >
                              {daysOfWeek.length} of {selectedFrequencyMeta.recommendedDayCount}{' '}
                              selected
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {TASK_WEEKDAYS.map((day) => {
                            const selected = daysOfWeek.includes(day.key);
                            return (
                              <Button
                                key={day.key}
                                size="small"
                                variant={selected ? 'contained' : 'outlined'}
                                color={selected ? 'primary' : 'inherit'}
                                onClick={() => handleToggleWeekday(day.key)}
                                sx={{
                                  minWidth: 46,
                                  px: 1.25,
                                  py: 0.5,
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  textTransform: 'none',
                                  borderRadius: 1,
                                }}
                              >
                                {day.shortLabel}
                              </Button>
                            );
                          })}
                        </Stack>
                      </Box>
                    )}

                    <Divider />

                    {/* Start Date & End Condition (Never, On Date, After N Events) */}
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Starting Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          select
                          size="small"
                          label="Ends"
                          value={endType}
                          onChange={(e) => setEndType(e.target.value as TaskEndType)}
                        >
                          <MenuItem value="never">Never Ending</MenuItem>
                          <MenuItem value="on_date">On Specific End Date</MenuItem>
                          <MenuItem value="after_count">After Number of Events</MenuItem>
                        </TextField>
                      </Grid>

                      {endType === 'on_date' && (
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="End Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                          />
                        </Grid>
                      )}

                      {endType === 'after_count' && (
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Number of Events (Occurrences)"
                            value={occurrenceCount}
                            onChange={(e) => setOccurrenceCount(e.target.value)}
                            inputProps={{ min: 1, max: 500 }}
                            helperText="Task series will automatically complete after this many scheduled occurrences"
                            required
                          />
                        </Grid>
                      )}
                    </Grid>

                    {/* Live Preview of Schedule */}
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                        <Repeat size={14} color={theme.palette.primary.main} />
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                          {formatTaskRecurrenceSummary(draftRecurrenceConfig)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {previewUpcomingDates.length > 0
                          ? `Upcoming dates: ${previewUpcomingDates
                              .map((d) => formatShortDate(d))
                              .join(', ')}${
                              endType === 'never' ||
                              (endType === 'after_count' &&
                                (parseInt(occurrenceCount, 10) || 0) > 5)
                                ? '…'
                                : ''
                            }`
                          : 'Select at least one day to preview upcoming dates.'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </DialogContent>

          {editingTask && (
            <Box
              px={3}
              py={1.2}
              sx={{ bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="flex"
                alignItems="center"
                gap={0.8}
                fontWeight={600}
              >
                <Clock size={14} />
                Created / Last edited by{' '}
                <strong>
                  {editingTask.updated_by || editingTask.created_by || 'Parent User'}
                </strong>
                {editingTask.updated_at || editingTask.created_at
                  ? ` on ${new Date(
                      editingTask.updated_at || editingTask.created_at
                    ).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : ''}
              </Typography>
            </Box>
          )}

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={saving}
              sx={{ fontWeight: 700 }}
            >
              {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
