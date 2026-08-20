'use client';

import { useEffect, useState } from 'react';
import {
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
  Typography,
  useTheme,
} from '@mui/material';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Search,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  FileText,
  Bookmark,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  category: 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
  status: 'pending' | 'in_progress' | 'completed';
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

type SortField = 'due_date' | 'priority' | 'category' | 'subject';
type SortOrder = 'asc' | 'desc';
type GroupByOption = 'none' | 'subject' | 'category' | 'priority';

export default function AssignmentsPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState<'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper'>('homework');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const { data: subData } = await supabase
        .from('subjects')
        .select('id, name, color')
        .order('sort_order', { ascending: true });

      if (subData) {
        setSubjects(subData as Subject[]);
      }

      const { data: assignData, error } = await supabase
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) {
        toast.error(`Failed to load assignments: ${error.message}`);
      } else if (assignData) {
        setAssignments(assignData as Assignment[]);
      }
    } catch {
      toast.error('Error fetching assignments data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingAssignment(null);
    setTitle('');
    setDescription('');
    setSubjectId(subjects[0]?.id || '');
    setDueDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setCategory('homework');
    setOpenModal(true);
  };

  const handleOpenEditModal = (a: Assignment) => {
    setEditingAssignment(a);
    setTitle(a.title);
    setDescription(a.description || '');
    setSubjectId(a.subject_id || '');
    setDueDate(a.due_date);
    setPriority(a.priority);
    setCategory(a.category);
    setOpenModal(true);
  };

  const handleToggleStatus = async (a: Assignment) => {
    const newStatus = a.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', a.id);

      if (error) {
        toast.error(`Failed to update status: ${error.message}`);
      } else {
        setAssignments((prev) =>
          prev.map((item) => (item.id === a.id ? { ...item, status: newStatus } : item))
        );
        toast.success(newStatus === 'completed' ? 'Assignment completed!' : 'Marked pending');
      }
    } catch {
      toast.error('Error updating status');
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) {
        toast.error(`Failed to delete assignment: ${error.message}`);
      } else {
        setAssignments((prev) => prev.filter((a) => a.id !== id));
        toast.success('Assignment deleted');
      }
    } catch {
      toast.error('Error deleting assignment');
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an assignment title');
      return;
    }
    if (!dueDate) {
      toast.error('Please select a due date');
      return;
    }

    setSaving(true);
    const activeUserName =
      typeof window !== 'undefined'
        ? localStorage.getItem('school_active_user_name') || 'Blake Womble'
        : 'Blake Womble';
    const nowIso = new Date().toISOString();

    try {
      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            subject_id: subjectId || null,
            due_date: dueDate,
            priority,
            category,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .eq('id', editingAssignment.id);

        if (error) {
          toast.error(`Failed to update: ${error.message}`);
        } else {
          setAssignments((prev) =>
            prev.map((a) =>
              a.id === editingAssignment.id
                ? {
                    ...a,
                    title: title.trim(),
                    description: description.trim() || null,
                    subject_id: subjectId || null,
                    due_date: dueDate,
                    priority,
                    category,
                    updated_by: activeUserName,
                    updated_at: nowIso,
                  }
                : a
            )
          );
          toast.success('Assignment updated!');
          setOpenModal(false);
        }
      } else {
        const { data, error } = await supabase
          .from('assignments')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            subject_id: subjectId || null,
            due_date: dueDate,
            priority,
            category,
            status: 'pending',
            created_by: activeUserName,
            updated_by: activeUserName,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to create assignment: ${error.message}`);
        } else if (data) {
          setAssignments((prev) => [...prev, data as Assignment]);
          toast.success('New assignment created!');
          setOpenModal(false);
        }
      }
    } catch {
      toast.error('Error saving assignment');
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

  const subjectMap = new Map<string, Subject>();
  subjects.forEach((s) => subjectMap.set(s.id, s));

  const filteredAssignments = assignments.filter((a) => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;

    const query = searchQuery.toLowerCase();
    const matchesTitle = a.title.toLowerCase().includes(query);
    const matchesDesc = (a.description || '').toLowerCase().includes(query);
    const subName = a.subject_id ? subjectMap.get(a.subject_id)?.name || '' : '';
    const matchesSub = subName.toLowerCase().includes(query);
    return matchesTitle || matchesDesc || matchesSub;
  });

  const priorityWeight: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const sortItems = (items: Assignment[]) => {
    return [...items].sort((a, b) => {
      if (sortField === 'priority') {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        return sortOrder === 'asc' ? weightA - weightB : weightB - weightA;
      }

      if (sortField === 'due_date') {
        return sortOrder === 'asc'
          ? a.due_date.localeCompare(b.due_date)
          : b.due_date.localeCompare(a.due_date);
      }

      if (sortField === 'category') {
        return sortOrder === 'asc'
          ? a.category.localeCompare(b.category)
          : b.category.localeCompare(a.category);
      }

      if (sortField === 'subject') {
        const nameA = a.subject_id ? subjectMap.get(a.subject_id)?.name || '' : '';
        const nameB = b.subject_id ? subjectMap.get(a.subject_id)?.name || '' : '';
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      return 0;
    });
  };

  const sortedAssignments = sortItems(filteredAssignments);

  // Grouping logic
  const renderGroupedTables = () => {
    if (groupBy === 'none') {
      return renderTableRows(sortedAssignments);
    }

    const groups = new Map<string, Assignment[]>();

    sortedAssignments.forEach((a) => {
      let key = 'Unassigned';
      if (groupBy === 'subject') {
        key = a.subject_id ? subjectMap.get(a.subject_id)?.name || 'General Subject' : 'General Subject';
      } else if (groupBy === 'category') {
        key = a.category.toUpperCase();
      } else if (groupBy === 'priority') {
        key = `${a.priority.toUpperCase()} PRIORITY`;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(a);
    });

    return Array.from(groups.entries()).map(([groupName, groupItems]) => (
      <Box key={groupName} sx={{ mb: 3 }}>
        <Box
          sx={{
            py: 1,
            px: 2,
            bgcolor: 'action.selected',
            borderBottom: '2px solid',
            borderColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Bookmark size={16} color={theme.palette.primary.main} />
          <Typography variant="subtitle2" fontWeight={800} color="primary.main">
            {groupName} ({groupItems.length})
          </Typography>
        </Box>
        <Table sx={{ minWidth: 650 }}>
          <TableBody>{renderTableRows(groupItems, false)}</TableBody>
        </Table>
      </Box>
    ));
  };

  const renderTableRows = (items: Assignment[], showTableHeadIfFlat = true) => {
    if (items.length === 0 && showTableHeadIfFlat) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
            <Box textAlign="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <FileText size={28} />
              </Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                No School Assignments Found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                Add your child&apos;s homework, tests, quizzes, and projects linked to subjects and due dates.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenCreateModal}
                startIcon={<Plus size={18} />}
                sx={{ fontWeight: 700 }}
              >
                Create First Assignment
              </Button>
            </Box>
          </TableCell>
        </TableRow>
      );
    }

    return items.map((a) => {
      const isCompleted = a.status === 'completed';
      const sub = a.subject_id ? subjectMap.get(a.subject_id) : null;

      return (
        <TableRow
          key={a.id}
          hover
          sx={{
            opacity: isCompleted ? 0.6 : 1,
            bgcolor: isCompleted ? 'action.hover' : 'transparent',
          }}
        >
          <TableCell align="center" sx={{ width: 60 }}>
            <Checkbox
              checked={isCompleted}
              onChange={() => handleToggleStatus(a)}
              color="success"
            />
          </TableCell>
          <TableCell>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ textDecoration: isCompleted ? 'line-through' : 'none' }}
                >
                  {a.title}
                </Typography>
                {a.description && (
                  <Typography variant="body2" color="text.secondary">
                    {a.description}
                  </Typography>
                )}
              </Box>
            </Stack>
          </TableCell>
          <TableCell sx={{ width: 160 }}>
            {sub ? (
              <Chip
                label={sub.name}
                size="small"
                sx={{
                  bgcolor: sub.color,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                }}
              />
            ) : (
              <Chip label="General" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            )}
          </TableCell>
          <TableCell sx={{ width: 140 }}>
            <Chip
              label={a.category.toUpperCase()}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontWeight: 700, fontSize: '0.68rem' }}
            />
          </TableCell>
          <TableCell sx={{ width: 140 }}>
            <Chip
              icon={<CalendarIcon size={14} />}
              label={a.due_date}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </TableCell>
          <TableCell sx={{ width: 120 }}>
            <Chip
              label={a.priority.toUpperCase()}
              size="small"
              color={a.priority === 'high' ? 'error' : a.priority === 'medium' ? 'warning' : 'info'}
              sx={{ fontWeight: 700, fontSize: '0.68rem' }}
            />
          </TableCell>
          <TableCell align="right" sx={{ width: 100 }}>
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <IconButton size="small" color="primary" onClick={() => handleOpenEditModal(a)}>
                <Edit2 size={16} />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => handleDeleteAssignment(a.id)}>
                <Trash2 size={16} />
              </IconButton>
            </Stack>
          </TableCell>
        </TableRow>
      );
    });
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
        heading="School Assignments Manager"
        caption="Manage subject-specific homework, projects, tests, and quizzes. Linked directly to subjects and printable on weekly planner pages."
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={handleOpenCreateModal}
            sx={{ fontWeight: 700 }}
          >
            New Assignment
          </Button>
        }
      />

      <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
        {/* Controls & Filter Bar */}
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={categoryFilter}
            onChange={(_, val) => setCategoryFilter(val)}
            indicatorColor="primary"
            textColor="primary"
            sx={{ minHeight: 40 }}
          >
            <Tab label={`All (${assignments.length})`} value="all" sx={{ fontWeight: 600 }} />
            <Tab label="Homework" value="homework" sx={{ fontWeight: 600 }} />
            <Tab label="Projects" value="project" sx={{ fontWeight: 600 }} />
            <Tab label="Tests & Quizzes" value="test" sx={{ fontWeight: 600 }} />
            <Tab label="Reading" value="reading" sx={{ fontWeight: 600 }} />
            <Tab label="Papers" value="paper" sx={{ fontWeight: 600 }} />
          </Tabs>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />

            <TextField
              select
              size="small"
              label="Group By"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Layers size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="none">No Grouping</MenuItem>
              <MenuItem value="subject">Group by Subject</MenuItem>
              <MenuItem value="category">Group by Category</MenuItem>
              <MenuItem value="priority">Group by Priority</MenuItem>
            </TextField>
          </Stack>
        </Box>

        {/* HIGH-DENSITY TABLE VIEW */}
        <TableContainer component={Box}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 60, align: 'center' }}>DONE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ASSIGNMENT TITLE</TableCell>
                
                {/* SORTABLE SUBJECT COLUMN */}
                <TableCell
                  onClick={() => handleToggleSort('subject')}
                  sx={{
                    fontWeight: 700,
                    width: 160,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>SUBJECT</span>
                    {renderSortIcon('subject')}
                  </Stack>
                </TableCell>

                {/* SORTABLE CATEGORY COLUMN */}
                <TableCell
                  onClick={() => handleToggleSort('category')}
                  sx={{
                    fontWeight: 700,
                    width: 140,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>CATEGORY</span>
                    {renderSortIcon('category')}
                  </Stack>
                </TableCell>

                {/* SORTABLE DUE DATE COLUMN */}
                <TableCell
                  onClick={() => handleToggleSort('due_date')}
                  sx={{
                    fontWeight: 700,
                    width: 140,
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

                {/* SORTABLE PRIORITY COLUMN */}
                <TableCell
                  onClick={() => handleToggleSort('priority')}
                  sx={{
                    fontWeight: 700,
                    width: 120,
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
              {groupBy === 'none' ? renderTableRows(sortedAssignments) : null}
            </TableBody>
          </Table>

          {groupBy !== 'none' && renderGroupedTables()}
        </TableContainer>
      </Card>

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveAssignment}>
          <DialogTitle fontWeight={700}>
            {editingAssignment ? 'Edit School Assignment' : 'Create School Assignment'}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2.5} pt={1}>
              <TextField
                fullWidth
                label="Assignment Title"
                placeholder="e.g. Chapter 4 Math Homework, Solar System Model Project"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    select
                    label="School Subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    {subjects.map((sub) => (
                      <MenuItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    select
                    label="Category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper')
                    }
                  >
                    <MenuItem value="homework">Homework</MenuItem>
                    <MenuItem value="project">Project</MenuItem>
                    <MenuItem value="test">Test</MenuItem>
                    <MenuItem value="quiz">Quiz</MenuItem>
                    <MenuItem value="reading">Reading</MenuItem>
                    <MenuItem value="paper">Paper / Report</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

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
                    required
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description / Instructions (Optional)"
                placeholder="Add problem numbers, page references, or project requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Stack>
          </DialogContent>

          {editingAssignment && (
            <Box px={3} py={1.2} sx={{ bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.8} fontWeight={600}>
                <Clock size={14} />
                Created / Last edited by <strong>{editingAssignment.updated_by || editingAssignment.created_by || 'Blake Womble'}</strong>
                {editingAssignment.updated_at || editingAssignment.created_at
                  ? ` on ${new Date(editingAssignment.updated_at || editingAssignment.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : ''}
              </Typography>
            </Box>
          )}

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancel
            </Button>

            <Button type="submit" variant="contained" color="primary" disabled={saving} sx={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Create Assignment'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
