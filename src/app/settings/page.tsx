'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette,
  Sun,
  Moon,
  Check,
  BookOpen,
  ArrowRight,
  School,
  Save,
  Sparkles,
  Users,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeading } from 'src/components/base/page-heading';
import { useCustomization } from 'src/hooks/use-customization';
import { colorPresetOptions } from 'src/layouts/header';
import { useSchoolSettings, SystemBrandingSettings } from 'src/contexts/school-settings';
import { ItemIcon } from 'src/components/base/item-icon';
import type { ColorPreset } from 'src/theme';

const AVAILABLE_ICONS = [
  { id: 'none', label: 'No Icon (Text Only)' },
  { id: 'FileText', label: 'Document (FileText)' },
  { id: 'CheckSquare', label: 'Checkbox (CheckSquare)' },
  { id: 'CheckCircle', label: 'Circle Check (CheckCircle)' },
  { id: 'Edit3', label: 'Edit Pencil (Edit3)' },
  { id: 'FileEdit', label: 'Notebook Edit (FileEdit)' },
  { id: 'MessageSquare', label: 'Message Note (MessageSquare)' },
  { id: 'Sparkles', label: 'Sparkles (Sparkles)' },
  { id: 'Star', label: 'Star (Star)' },
  { id: 'BookOpen', label: 'Open Book (BookOpen)' },
  { id: 'Bookmark', label: 'Bookmark Ribbon (Bookmark)' },
  { id: 'Tag', label: 'Category Tag (Tag)' },
  { id: 'Flag', label: 'Priority Flag (Flag)' },
  { id: 'Calendar', label: 'Calendar Date (Calendar)' },
];

export default function SettingsPage() {
  const theme = useTheme();
  const customization = useCustomization();
  const {
    schoolName,
    updateSchoolName,
    branding,
    updateItemBranding,
    scheduleStartHour,
    scheduleEndHour,
    updateScheduleHours,
  } = useSchoolSettings();

  const [inputSchoolName, setInputSchoolName] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);

  const [itemBrandingState, setItemBrandingState] = useState<SystemBrandingSettings>(branding);
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => {
    setInputSchoolName(schoolName);
  }, [schoolName]);

  useEffect(() => {
    setItemBrandingState(branding);
  }, [branding]);

  const activePreset = customization.colorPreset || 'monacoBlue';
  const activeMode = customization.paletteMode || 'dark';

  const handleSelectPreset = (preset: ColorPreset) => {
    customization.handleUpdate({ colorPreset: preset });
  };

  const handleSelectMode = (mode: 'light' | 'dark') => {
    customization.handleUpdate({ paletteMode: mode });
  };

  const handleSaveSchoolName = async () => {
    setSavingName(true);
    await updateSchoolName(inputSchoolName);
    setSavingName(false);
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    await updateItemBranding(itemBrandingState);
    setSavingBranding(false);
  };

  const handleUpdateSingleBranding = (
    key: keyof SystemBrandingSettings,
    field: 'color' | 'icon',
    value: string
  ) => {
    setItemBrandingState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  return (
    <Box>
      <PageHeading
        heading="School App Settings & Configuration"
        caption="Define your school name, customize item colors & icons (Assignments, Tasks, Notes, Holidays), and adjust theme preferences."
      />

      <Grid container spacing={3}>
        {/* Main Column */}
        <Grid item xs={12} lg={8}>
          {/* School Name & Profile Configuration Card */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <School size={22} color={theme.palette.primary.main} />
                <Typography variant="h4" fontWeight={700}>
                  School Name &amp; Branding
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Customize the name of your school. This title will appear across your weekly binder planners, master calendar headers, printouts, and top navigation bar.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <TextField
                  fullWidth
                  label="School Name"
                  placeholder="e.g. Womble Family Academy"
                  value={inputSchoolName}
                  onChange={(e) => setInputSchoolName(e.target.value)}
                />
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleSaveSchoolName}
                  disabled={savingName || !inputSchoolName.trim()}
                  startIcon={<Save size={18} />}
                  sx={{
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    px: 3.5,
                    py: 1.5,
                    minHeight: 54,
                    fontSize: '0.92rem',
                    borderRadius: 2,
                  }}
                >
                  {savingName ? 'Saving...' : 'Save School Name'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* System Item Colors & Icons Customizer */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={1}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Sparkles size={22} color={theme.palette.primary.main} />
                  <Typography variant="h4" fontWeight={700}>
                    System Item Colors &amp; Icons
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                  startIcon={<Save size={18} />}
                  sx={{
                    fontWeight: 700,
                    px: 3,
                    py: 1.2,
                    fontSize: '0.9rem',
                    borderRadius: 2,
                  }}
                >
                  {savingBranding ? 'Saving...' : 'Save Item Colors & Icons'}
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Customize the accent colors and icons used to display <strong>School Assignments</strong>, <strong>To-Do Tasks</strong>, <strong>Parent Notes</strong>, and <strong>Holidays</strong> across the Master Calendar and Weekly Planner.
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={3}>
                {/* 1. School Assignments */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: itemBrandingState.assignments.color,
                          color: '#ffffff',
                          display: 'flex',
                        }}
                      >
                        <ItemIcon name={itemBrandingState.assignments.icon} size={18} />
                      </Box>
                      <Typography variant="h6" fontWeight={700}>
                        School Assignments
                      </Typography>
                    </Stack>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                          Accent Color
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <input
                            type="color"
                            value={itemBrandingState.assignments.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('assignments', 'color', e.target.value)
                            }
                            style={{
                              width: 40,
                              height: 38,
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            value={itemBrandingState.assignments.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('assignments', 'color', e.target.value)
                            }
                          />
                        </Stack>
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Icon"
                        value={itemBrandingState.assignments.icon}
                        onChange={(e) =>
                          handleUpdateSingleBranding('assignments', 'icon', e.target.value)
                        }
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <MenuItem key={icon.id} value={icon.id}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <ItemIcon name={icon.id} size={16} />
                              <span>{icon.label}</span>
                            </Stack>
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Card>
                </Grid>

                {/* 2. To-Do Tasks */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: itemBrandingState.tasks.color,
                          color: '#ffffff',
                          display: 'flex',
                        }}
                      >
                        <ItemIcon name={itemBrandingState.tasks.icon} size={18} />
                      </Box>
                      <Typography variant="h6" fontWeight={700}>
                        To-Do Tasks
                      </Typography>
                    </Stack>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                          Accent Color
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <input
                            type="color"
                            value={itemBrandingState.tasks.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('tasks', 'color', e.target.value)
                            }
                            style={{
                              width: 40,
                              height: 38,
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            value={itemBrandingState.tasks.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('tasks', 'color', e.target.value)
                            }
                          />
                        </Stack>
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Icon"
                        value={itemBrandingState.tasks.icon}
                        onChange={(e) =>
                          handleUpdateSingleBranding('tasks', 'icon', e.target.value)
                        }
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <MenuItem key={icon.id} value={icon.id}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <ItemIcon name={icon.id} size={16} />
                              <span>{icon.label}</span>
                            </Stack>
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Card>
                </Grid>

                {/* 3. Parent Notes */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: itemBrandingState.notes.color,
                          color: '#ffffff',
                          display: 'flex',
                        }}
                      >
                        <ItemIcon name={itemBrandingState.notes.icon} size={18} />
                      </Box>
                      <Typography variant="h6" fontWeight={700}>
                        Parent Notes
                      </Typography>
                    </Stack>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                          Accent Color
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <input
                            type="color"
                            value={itemBrandingState.notes.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('notes', 'color', e.target.value)
                            }
                            style={{
                              width: 40,
                              height: 38,
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            value={itemBrandingState.notes.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('notes', 'color', e.target.value)
                            }
                          />
                        </Stack>
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Icon"
                        value={itemBrandingState.notes.icon}
                        onChange={(e) =>
                          handleUpdateSingleBranding('notes', 'icon', e.target.value)
                        }
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <MenuItem key={icon.id} value={icon.id}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <ItemIcon name={icon.id} size={16} />
                              <span>{icon.label}</span>
                            </Stack>
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Card>
                </Grid>

                {/* 4. Holidays */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: itemBrandingState.holidays.color,
                          color: '#ffffff',
                          display: 'flex',
                        }}
                      >
                        <ItemIcon name={itemBrandingState.holidays.icon} size={18} />
                      </Box>
                      <Typography variant="h6" fontWeight={700}>
                        Holidays
                      </Typography>
                    </Stack>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                          Accent Color
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <input
                            type="color"
                            value={itemBrandingState.holidays.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('holidays', 'color', e.target.value)
                            }
                            style={{
                              width: 40,
                              height: 38,
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            value={itemBrandingState.holidays.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('holidays', 'color', e.target.value)
                            }
                          />
                        </Stack>
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Icon"
                        value={itemBrandingState.holidays.icon}
                        onChange={(e) =>
                          handleUpdateSingleBranding('holidays', 'icon', e.target.value)
                        }
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <MenuItem key={icon.id} value={icon.id}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <ItemIcon name={icon.id} size={16} />
                              <span>{icon.label}</span>
                            </Stack>
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Card>
                </Grid>
              </Grid>

              {/* LIVE PREVIEW BOX */}
              <Box mt={3} p={2.5} sx={{ bgcolor: 'action.selected', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={800} mb={1.5}>
                  Live Preview on Calendar Chips &amp; Badges:
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                  <Chip
                    icon={<ItemIcon name={itemBrandingState.assignments.icon} size={16} color="#ffffff" />}
                    label="School Assignment"
                    sx={{
                      bgcolor: itemBrandingState.assignments.color,
                      color: '#ffffff',
                      fontWeight: 700,
                      height: 36,
                      px: 1,
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiChip-icon': { color: '#ffffff', ml: 0.5, mr: 0.5 },
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                  <Chip
                    icon={<ItemIcon name={itemBrandingState.tasks.icon} size={16} color="#ffffff" />}
                    label="To-Do Task"
                    sx={{
                      bgcolor: itemBrandingState.tasks.color,
                      color: '#ffffff',
                      fontWeight: 700,
                      height: 36,
                      px: 1,
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiChip-icon': { color: '#ffffff', ml: 0.5, mr: 0.5 },
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                  <Chip
                    icon={<ItemIcon name={itemBrandingState.notes.icon} size={16} color="#ffffff" />}
                    label="Parent Note"
                    sx={{
                      bgcolor: itemBrandingState.notes.color,
                      color: '#ffffff',
                      fontWeight: 700,
                      height: 36,
                      px: 1,
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiChip-icon': { color: '#ffffff', ml: 0.5, mr: 0.5 },
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                  <Chip
                    icon={<ItemIcon name={itemBrandingState.holidays.icon} size={16} color="#ffffff" />}
                    label="Labor Day Holiday"
                    sx={{
                      bgcolor: itemBrandingState.holidays.color,
                      color: '#ffffff',
                      fontWeight: 700,
                      height: 36,
                      px: 1,
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiChip-icon': { color: '#ffffff', ml: 0.5, mr: 0.5 },
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* TIME SCHEDULER TIMEFRAME CONFIGURATION CARD */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <Clock size={22} color={theme.palette.primary.main} />
                <Typography variant="h4" fontWeight={700}>
                  Time Scheduler Timeframe
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Define the daily starting and ending hours displayed on your 15-minute weekly scheduler (Monday–Friday). Default is 7:00 AM to 7:00 PM.
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Daily Start Time"
                    value={scheduleStartHour}
                    onChange={(e) => updateScheduleHours(Number(e.target.value), scheduleEndHour)}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 5).map((hour) => {
                      const ampm = hour < 12 ? 'AM' : 'PM';
                      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                      return (
                        <MenuItem key={hour} value={hour}>
                          {displayHour}:00 {ampm}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Daily End Time"
                    value={scheduleEndHour}
                    onChange={(e) => updateScheduleHours(scheduleStartHour, Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 12).map((hour) => {
                      const ampm = hour < 12 ? 'AM' : 'PM';
                      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                      return (
                        <MenuItem key={hour} value={hour}>
                          {displayHour}:00 {ampm}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>



          {/* Theme & Accent Color Customizer */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <Palette size={22} color={theme.palette.primary.main} />
                <Typography variant="h4" fontWeight={700}>
                  Theme &amp; Accent Color Switcher
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Choose your favorite accent color and dark/light palette mode. Preferences are saved automatically.
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* Mode Switcher */}
              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                Palette Mode
              </Typography>
              <Grid container spacing={2} mb={4}>
                <Grid item xs={6} sm={4}>
                  <Card
                    onClick={() => handleSelectMode('dark')}
                    elevation={activeMode === 'dark' ? 6 : 1}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: activeMode === 'dark' ? 'primary.main' : 'divider',
                      bgcolor: '#141923',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Moon size={20} />
                    <Box flexGrow={1}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Dark Mode
                      </Typography>
                      <Typography variant="caption" color="grey.400">
                        Default dark palette
                      </Typography>
                    </Box>
                    {activeMode === 'dark' && <Check size={18} color="#0C74E4" />}
                  </Card>
                </Grid>

                <Grid item xs={6} sm={4}>
                  <Card
                    onClick={() => handleSelectMode('light')}
                    elevation={activeMode === 'light' ? 6 : 1}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: activeMode === 'light' ? 'primary.main' : 'divider',
                      bgcolor: '#ffffff',
                      color: '#151821',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Sun size={20} />
                    <Box flexGrow={1}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        Light Mode
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Clean light palette
                      </Typography>
                    </Box>
                    {activeMode === 'light' && <Check size={18} color="#0C74E4" />}
                  </Card>
                </Grid>
              </Grid>

              {/* Accent Color Presets */}
              <Typography variant="subtitle2" fontWeight={700} mb={2}>
                Accent Color Presets (11 Presets Available)
              </Typography>
              <Grid container spacing={2}>
                {colorPresetOptions.map((option) => {
                  const isSelected = activePreset === option.key;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={option.key}>
                      <Card
                        onClick={() => handleSelectPreset(option.key)}
                        elevation={isSelected ? 6 : 1}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: isSelected ? option.color : 'divider',
                          bgcolor: 'background.paper',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Box
                              sx={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                bgcolor: option.color,
                                boxShadow: '0 0 0 2px rgba(0,0,0,0.15)',
                              }}
                            />
                            <Typography variant="body2" fontWeight={isSelected ? 700 : 500}>
                              {option.label}
                            </Typography>
                          </Box>
                          {isSelected && <Chip label="Active" size="small" sx={{ bgcolor: option.color, color: '#fff', fontWeight: 700 }} />}
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Info & Preferences Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* User Management & Access Card */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 3, bgcolor: 'action.hover' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'primary.main', color: '#ffffff', display: 'flex' }}>
                  <Users size={22} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    User Management &amp; Access
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Define users, manage roles, send login emails, and reset passwords.
                  </Typography>
                </Box>
              </Box>
              <Button
                component={Link}
                href="/users"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                endIcon={<ArrowRight size={18} />}
                sx={{ fontWeight: 700, mt: 1 }}
              >
                Go to Users Page
              </Button>
            </CardContent>
          </Card>

          <Card elevation={8} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <SettingsIcon size={22} />
                <Typography variant="h5" fontWeight={700}>
                  System Overview
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Active School Name
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {schoolName}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Customized Items Branding
                  </Typography>
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Chip
                      size="small"
                      label="Assignments"
                      sx={{ bgcolor: branding.assignments.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    <Chip
                      size="small"
                      label="Tasks"
                      sx={{ bgcolor: branding.tasks.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    <Chip
                      size="small"
                      label="Notes"
                      sx={{ bgcolor: branding.notes.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    <Chip
                      size="small"
                      label="Holidays"
                      sx={{ bgcolor: branding.holidays.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Isolated Schema
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    &quot;school&quot;
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Theme Engine
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tailwind CSS v4 + MUI v5 + Dynamic Emotion Cache
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
