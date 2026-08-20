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
} from 'lucide-react';
import Link from 'next/link';
import { PageHeading } from 'src/components/base/page-heading';
import { useCustomization } from 'src/hooks/use-customization';
import { colorPresetOptions } from 'src/layouts/header';
import { useSchoolSettings } from 'src/contexts/school-settings';
import type { ColorPreset } from 'src/theme';

export default function SettingsPage() {
  const theme = useTheme();
  const customization = useCustomization();
  const { schoolName, updateSchoolName } = useSchoolSettings();

  const [inputSchoolName, setInputSchoolName] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setInputSchoolName(schoolName);
  }, [schoolName]);

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

  return (
    <Box>
      <PageHeading
        heading="School App Settings & Configuration"
        caption="Define your school name, personalize your theme & accent colors, and manage curriculum settings."
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

              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label="School Name"
                  placeholder="e.g. Womble Family Academy"
                  value={inputSchoolName}
                  onChange={(e) => setInputSchoolName(e.target.value)}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveSchoolName}
                  disabled={savingName || !inputSchoolName.trim()}
                  startIcon={<Save size={16} />}
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {savingName ? 'Saving...' : 'Save School Name'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Dedicated Subjects & Habits Shortcut Card */}
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4, bgcolor: 'action.hover' }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                    }}
                  >
                    <BookOpen size={24} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>
                      Subjects &amp; Habits Manager
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage 1–8 subject rows, assign block colors, and organize habit tracker lines on a dedicated page.
                    </Typography>
                  </Box>
                </Box>

                <Button
                  component={Link}
                  href="/subjects-habits"
                  variant="contained"
                  color="primary"
                  endIcon={<ArrowRight size={18} />}
                  sx={{ fontWeight: 700 }}
                >
                  Open Subjects &amp; Habits Manager
                </Button>
              </Box>
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
