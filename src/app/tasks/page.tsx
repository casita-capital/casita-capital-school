'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  AlertCircle,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

type SortField = 'due_date' | 'priority' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function TasksPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Column level sorting states
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(`Failed to load tasks: ${error.message}`);
      } else if (data) {
        setTasks(data as Task[]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching tasks';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
    setOpenModal(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setDueDate(task.due_date || '');
    setPriority(task.priority);
    setOpenModal(true);
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) {
        toast.error(`Failed to update status: ${error.message}`);
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
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

    setSaving(true);
    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate || null,
            priority,
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
                    due_date: dueDate || null,
                    priority,
                    updated_by: activeUserName,
                    updated_at: nowIso,
                  }
                : t
            )
          );
          toast.success('Task updated!');
          setOpenModal(false);
        }
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate || null,
            priority,
            status: 'pending',
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to create task: ${error.message}`);
        } else if (data) {
          setTasks((prev) => [data as Task, ...prev]);
          toast.success('Task created!');
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

  const getPriorityColor = (p: string) => {
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
        caption="Track homework assignments, parent action items, and daily school activities."
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
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
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
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        </Box>

        {/* HIGH-DENSITY SCANNABLE TABLE VIEW WITH INDIVIDUALLY SORTABLE COLUMNS */}
        <TableContainer component={Box}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 60, align: 'center' }}>DONE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TASK / DESCRIPTION</TableCell>
                
                {/* SORTABLE DUE DATE COLUMN HEADER */}
                <TableCell
                  onClick={() => handleToggleSort('due_date')}
                  sx={{
                    fontWeight: 700,
                    width: 170,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>DUE DATE</span>
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

                <TableCell sx={{ fontWeight: 700, width: 100, textAlign: 'right' }}>ACTIONS</TableCell>
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
                      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                        Get started by creating your first homework task, chore, or parental assignment.
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
                        <Checkbox
                          checked={isCompleted}
                          onChange={() => handleToggleTaskStatus(task)}
                          color="success"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={{ textDecoration: isCompleted ? 'line-through' : 'none' }}
                        >
                          {task.title}
                        </Typography>
                        {task.description && (
                          <Typography variant="body2" color="text.secondary">
                            {task.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <Chip
                            icon={<CalendarIcon size={14} />}
                            label={task.due_date}
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
                          color={getPriorityColor(task.priority) as 'error' | 'warning' | 'info'}
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" color="primary" onClick={() => handleOpenEditModal(task)}>
                            <Edit2 size={16} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteTask(task.id)}>
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
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2.5} pt={1}>
              <TextField
                fullWidth
                label="Task Title"
                placeholder="e.g. Read Chapter 5, Complete Math Worksheet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description (Optional)"
                placeholder="Add extra details or instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Grid container spacing={2}>
                <Grid item xs={6}>
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

                <Grid item xs={6}>
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
            </Stack>
          </DialogContent>

          {editingTask && (
            <Box px={3} py={1.2} sx={{ bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.8} fontWeight={600}>
                <Clock size={14} />
                Created / Last edited by <strong>{editingTask.updated_by || editingTask.created_by || 'Blake Womble'}</strong>
                {editingTask.updated_at || editingTask.created_at
                  ? ` on ${new Date(editingTask.updated_at || editingTask.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : ''}
              </Typography>
            </Box>
          )}

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancel
            </Button>

            <Button type="submit" variant="contained" color="success" disabled={saving} sx={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
