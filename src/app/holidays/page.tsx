'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
} from '@mui/material';
import { Sparkles, Plus, Trash2, Calendar as CalendarIcon, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';

interface Holiday {
  id: string;
  title: string;
  holiday_date: string;
  category: 'governmental' | 'religious' | 'custom';
  is_enabled: boolean;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'governmental' | 'religious' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCategory, setNewCategory] = useState<'governmental' | 'religious' | 'custom'>('custom');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function fetchHolidays() {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (error) {
        toast.error(`Failed to load holidays: ${error.message}`);
      } else if (data) {
        setHolidays(data as Holiday[]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching holidays';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleToggleHoliday = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .update({ is_enabled: !currentStatus })
        .eq('id', id);

      if (error) {
        toast.error(`Failed to update holiday: ${error.message}`);
      } else {
        setHolidays((prev) =>
          prev.map((h) => (h.id === id ? { ...h, is_enabled: !currentStatus } : h))
        );
        toast.success(`Holiday ${!currentStatus ? 'enabled' : 'disabled'}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);

      if (error) {
        toast.error(`Failed to delete holiday: ${error.message}`);
      } else {
        setHolidays((prev) => prev.filter((h) => h.id !== id));
        toast.success('Holiday deleted');
      }
    } catch {
      toast.error('Error deleting holiday');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) {
      toast.error('Please provide a title and date.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('holidays')
        .insert({
          title: newTitle,
          holiday_date: newDate,
          category: newCategory,
          is_enabled: true,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Failed to add holiday: ${error.message}`);
      } else if (data) {
        setHolidays((prev) => [...prev, data as Holiday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
        toast.success('New holiday added!');
        setOpenModal(false);
        setNewTitle('');
        setNewDate('');
      }
    } catch {
      toast.error('Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    const matchesTab = activeTab === 'all' || h.category === activeTab;
    const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.holiday_date.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  const getCategoryChipColor = (cat: string) => {
    switch (cat) {
      case 'governmental':
        return 'primary';
      case 'religious':
        return 'secondary';
      default:
        return 'success';
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
        heading="Holidays Manager"
        caption="Easily view and toggle governmental, religious, and custom holidays to display on weekly binder planners and monthly calendars."
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setOpenModal(true)}
            sx={{ fontWeight: 600 }}
          >
            Add Custom Holiday
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
            <Tab label={`All (${holidays.length})`} value="all" sx={{ fontWeight: 600 }} />
            <Tab
              label={`Governmental (${holidays.filter((h) => h.category === 'governmental').length})`}
              value="governmental"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label={`Religious (${holidays.filter((h) => h.category === 'religious').length})`}
              value="religious"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label={`Custom (${holidays.filter((h) => h.category === 'custom').length})`}
              value="custom"
              sx={{ fontWeight: 600 }}
            />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search holiday or date..."
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

        {/* HIGH-DENSITY SCANNABLE LIST / TABLE VIEW */}
        <TableContainer component={Box}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 180 }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>HOLIDAY NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>CATEGORY</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140, textAlign: 'center' }}>DISPLAY STATUS</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 90, textAlign: 'right' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHolidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No holidays found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHolidays.map((holiday) => {
                  const dObj = new Date(holiday.holiday_date + 'T00:00:00');
                  const formattedDate = dObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <TableRow
                      key={holiday.id}
                      hover
                      sx={{
                        opacity: holiday.is_enabled ? 1 : 0.5,
                        bgcolor: holiday.is_enabled ? 'transparent' : 'action.hover',
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {formattedDate}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <CalendarIcon size={18} />
                          <Typography variant="subtitle2" fontWeight={700}>
                            {holiday.title}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={holiday.category.toUpperCase()}
                          size="small"
                          color={getCategoryChipColor(holiday.category) as 'primary' | 'secondary' | 'success'}
                          variant="outlined"
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                          <Typography variant="caption" fontWeight={600} color={holiday.is_enabled ? 'success.main' : 'text.secondary'}>
                            {holiday.is_enabled ? 'Shown' : 'Hidden'}
                          </Typography>
                          <Switch
                            checked={holiday.is_enabled}
                            onChange={() => handleToggleHoliday(holiday.id, holiday.is_enabled)}
                            size="small"
                            color="primary"
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Modal: Add Custom Holiday */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleAddHoliday}>
          <DialogTitle fontWeight={700}>Add New Holiday</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} pt={1}>
              <TextField
                fullWidth
                label="Holiday Title"
                placeholder="e.g. Family Field Trip Day"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
              <TextField
                fullWidth
                select
                label="Category"
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as 'governmental' | 'religious' | 'custom')
                }
              >
                <MenuItem value="governmental">Governmental</MenuItem>
                <MenuItem value="religious">Religious</MenuItem>
                <MenuItem value="custom">Custom Family Holiday</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancel
            </Button>

            <Button type="submit" variant="contained" disabled={saving} sx={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Add Holiday'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
