'use client';

import { useEffect, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette,
  Sun,
  Moon,
  Check,
  ArrowRight,
  School,
  Save,
  Sparkles,
  Users,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Trash2,
  Type,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { useCustomization } from 'src/hooks/use-customization';
import { colorPresetOptions, headingFontOptions } from 'src/layouts/header';
import { useSchoolSettings, SystemBrandingSettings } from 'src/contexts/school-settings';
import { ItemIcon } from 'src/components/base/item-icon';
import { createClient } from 'src/services/supabase/client';
import type { Json } from 'src/services/supabase/types';
import type { ColorPreset, HeadingFontPreset } from 'src/theme';
import { HEADING_FONT_STACKS } from 'src/theme/base/create-typography';
import { resolveAndSyncActiveUser } from 'src/utils/active-user';

const AVAILABLE_ICONS = [
  { id: 'none', label: 'No Icon (Text Only)' },
  { id: 'User', label: 'Person / User (User)' },
  { id: 'UserCheck', label: 'Person Check (UserCheck)' },
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

export interface GoogleCalendarConnection {
  id: string;
  google_email: string;
  calendar_id: string;
  calendar_name: string;
  color: string;
  is_enabled: boolean;
  show_on_monthly: boolean;
  show_on_weekly: boolean;
  created_at?: string;
}

export default function SettingsPage() {
  const theme = useTheme();
  const customization = useCustomization();
  const supabase = createClient();

  const {
    schoolName,
    updateSchoolName,
    branding,
    updateItemBranding,
    scheduleStartHour,
    scheduleEndHour,
    updateScheduleHours,
  } = useSchoolSettings();

  const [activeTab, setActiveTab] = useState<'school' | 'preferences' | 'calendars'>('school');

  const [inputSchoolName, setInputSchoolName] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);

  const [itemBrandingState, setItemBrandingState] = useState<SystemBrandingSettings>(branding);
  const [savingBranding, setSavingBranding] = useState(false);

  // Google Calendar Connections State
  const [googleConnections, setGoogleConnections] = useState<GoogleCalendarConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newGoogleEmail, setNewGoogleEmail] = useState('');
  const [newCalendarId, setNewCalendarId] = useState('primary');
  const [newCalendarColor, setNewCalendarColor] = useState('#4285F4');
  const [newShowMonthly, setNewShowMonthly] = useState(true);
  const [newShowWeekly, setNewShowWeekly] = useState(true);
  const [savingConnection, setSavingConnection] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Auto-Discovered Calendars
  const [discoveredCalendars, setDiscoveredCalendars] = useState<
    { id: string; summary: string; description?: string; backgroundColor?: string; primary?: boolean }[]
  >([]);
  const [fetchingCalendars, setFetchingCalendars] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const handleAuthorizeGoogleCalendar = async () => {
    const redirectUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=/settings`
        : 'https://school.casitacapital.com/auth/callback?next=/settings';

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly',
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const fetchUserGoogleCalendars = async () => {
    setFetchingCalendars(true);
    setDiscoveryError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken =
        session?.provider_token ||
        (typeof window !== 'undefined' ? localStorage.getItem('google_provider_token') : null);

      const url = providerToken
        ? `/api/google-calendar/list?token=${encodeURIComponent(providerToken)}`
        : '/api/google-calendar/list';

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.items) {
        setDiscoveredCalendars(data.items);
        if (providerToken) {
          toast.success(`Fetched ${data.items.length} live Google Calendars!`);
        }
      } else if (data.error) {
        setDiscoveryError(data.error);
      }
    } catch {
      toast.error('Error scanning Google account');
    } finally {
      setFetchingCalendars(false);
    }
  };

  useEffect(() => {
    if (openAddModal) {
      fetchUserGoogleCalendars();
    }
  }, [openAddModal]);

  async function loadGoogleConnections() {
    setLoadingConnections(true);
    try {
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        toast.error(`Error loading Google Calendars: ${error.message}`);
      } else if (data) {
        setGoogleConnections(data as GoogleCalendarConnection[]);
      }
    } catch {
      toast.error('Failed to load Google Calendar connections');
    } finally {
      setLoadingConnections(false);
    }
  }

  useEffect(() => {
    loadGoogleConnections();
  }, []);

  useEffect(() => {
    setInputSchoolName(schoolName);
  }, [schoolName]);

  useEffect(() => {
    setItemBrandingState(branding);
  }, [branding]);

  const [systemUsers, setSystemUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [selectedThemeUserEmail, setSelectedThemeUserEmail] = useState<string>('__current__');
  const [targetUserPrefs, setTargetUserPrefs] = useState<{
    paletteMode: 'light' | 'dark';
    colorPreset: ColorPreset;
    headingFont: HeadingFontPreset;
  } | null>(null);
  const [loadingUserPrefs, setLoadingUserPrefs] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadUsersAndActiveUser() {
      const [{ data: usersData }, resolvedUser] = await Promise.all([
        supabase.from('users').select('id, full_name, email, role').order('full_name', { ascending: true }),
        resolveAndSyncActiveUser(supabase),
      ]);
      if (!isMounted) return;
      if (usersData) {
        setSystemUsers(usersData);
      }
      if (resolvedUser?.email) {
        setCurrentUserEmail(resolvedUser.email.trim().toLowerCase());
      }
    }
    loadUsersAndActiveUser();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const isTargetCurrentSession =
    selectedThemeUserEmail === '__current__' ||
    (Boolean(currentUserEmail) && selectedThemeUserEmail.trim().toLowerCase() === currentUserEmail);

  const parseUserPrefsRecord = (raw: unknown): {
    paletteMode: 'light' | 'dark';
    colorPreset: ColorPreset;
    headingFont: HeadingFontPreset;
  } | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const paletteMode = record.paletteMode === 'light' || record.paletteMode === 'dark' ? record.paletteMode : 'light';
    const colorPreset = typeof record.colorPreset === 'string' ? (record.colorPreset as ColorPreset) : 'monacoBlue';
    const headingFont =
      record.headingFont === 'inter' ||
      record.headingFont === 'plusJakarta' ||
      record.headingFont === 'outfit' ||
      record.headingFont === 'dmSans' ||
      record.headingFont === 'nunito' ||
      record.headingFont === 'newsreader'
        ? record.headingFont
        : 'inter';
    return { paletteMode, colorPreset, headingFont };
  };

  const handleThemeUserChange = async (nextEmailValue: string) => {
    setSelectedThemeUserEmail(nextEmailValue);
    const normalized = nextEmailValue.trim().toLowerCase();
    if (nextEmailValue === '__current__' || (currentUserEmail && normalized === currentUserEmail)) {
      setTargetUserPrefs(null);
      return;
    }

    setLoadingUserPrefs(true);
    try {
      const { data } = await supabase
        .from('weekly_planner_settings')
        .select('todos')
        .eq('week_start_date', `USER_CUSTOMIZATION:${normalized}`)
        .maybeSingle();

      const parsedFromDb = data?.todos ? parseUserPrefsRecord(data.todos) : null;
      if (parsedFromDb) {
        setTargetUserPrefs(parsedFromDb);
      } else {
        const localStr = typeof window !== 'undefined' ? window.localStorage.getItem(`school_app_customization:${normalized}`) : null;
        const parsedLocal = localStr ? parseUserPrefsRecord(JSON.parse(localStr)) : null;
        setTargetUserPrefs(
          parsedLocal || {
            paletteMode: customization.paletteMode || 'light',
            colorPreset: customization.colorPreset || 'monacoBlue',
            headingFont: customization.headingFont || 'inter',
          }
        );
      }
    } catch {
      setTargetUserPrefs({
        paletteMode: customization.paletteMode || 'light',
        colorPreset: customization.colorPreset || 'monacoBlue',
        headingFont: customization.headingFont || 'inter',
      });
    } finally {
      setLoadingUserPrefs(false);
    }
  };

  const saveTargetUserPrefs = async (
    nextPartial: Partial<{
      paletteMode: 'light' | 'dark';
      colorPreset: ColorPreset;
      headingFont: HeadingFontPreset;
    }>
  ) => {
    if (isTargetCurrentSession) {
      customization.handleUpdate(nextPartial);
      toast.success('Theme & font preference updated!');
      return;
    }

    const normalized = selectedThemeUserEmail.trim().toLowerCase();
    const currentTarget = targetUserPrefs || {
      paletteMode: customization.paletteMode || 'light',
      colorPreset: customization.colorPreset || 'monacoBlue',
      headingFont: customization.headingFont || 'inter',
    };
    const merged = { ...currentTarget, ...nextPartial };
    setTargetUserPrefs(merged);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`school_app_customization:${normalized}`, JSON.stringify(merged));
      }
      const { error } = await supabase.from('weekly_planner_settings').upsert(
        {
          week_start_date: `USER_CUSTOMIZATION:${normalized}`,
          todos: merged as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'week_start_date' }
      );
      if (error) {
        toast.error(`Failed to save preference for ${selectedThemeUserEmail}: ${error.message}`);
      } else {
        const matchedUser = systemUsers.find((u) => u.email.trim().toLowerCase() === normalized);
        toast.success(`Saved preference for ${matchedUser ? matchedUser.full_name : selectedThemeUserEmail}!`);
      }
    } catch {
      toast.error('Failed to save user theme preference');
    }
  };

  const activePreset = isTargetCurrentSession
    ? customization.colorPreset || 'monacoBlue'
    : targetUserPrefs?.colorPreset || customization.colorPreset || 'monacoBlue';
  const activeMode = isTargetCurrentSession
    ? customization.paletteMode || 'dark'
    : targetUserPrefs?.paletteMode || customization.paletteMode || 'dark';
  const activeHeadingFont: HeadingFontPreset = isTargetCurrentSession
    ? customization.headingFont || 'inter'
    : targetUserPrefs?.headingFont || customization.headingFont || 'inter';

  const handleSelectPreset = (preset: ColorPreset) => {
    void saveTargetUserPrefs({ colorPreset: preset });
  };

  const handleSelectMode = (mode: 'light' | 'dark') => {
    void saveTargetUserPrefs({ paletteMode: mode });
  };

  const handleSelectHeadingFont = (font: HeadingFontPreset) => {
    void saveTargetUserPrefs({ headingFont: font });
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

  // Google Calendar Connection Handlers
  const handleToggleConnectionField = async (
    id: string,
    field: 'is_enabled' | 'show_on_monthly' | 'show_on_weekly',
    value: boolean
  ) => {
    setGoogleConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );

    try {
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ [field]: value })
        .eq('id', id);

      if (error) {
        toast.error(`Failed to update setting: ${error.message}`);
      } else {
        toast.success('Calendar setting updated!');
      }
    } catch {
      toast.error('Error updating calendar setting');
    }
  };

  const handleUpdateConnectionColor = async (id: string, color: string) => {
    setGoogleConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, color } : c))
    );

    try {
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ color })
        .eq('id', id);

      if (error) {
        toast.error(`Failed to update color: ${error.message}`);
      } else {
        toast.success('Calendar color updated!');
      }
    } catch {
      toast.error('Error updating color');
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error(`Failed to remove calendar: ${error.message}`);
      } else {
        setGoogleConnections((prev) => prev.filter((c) => c.id !== id));
        toast.success('Google Calendar disconnected');
      }
    } catch {
      toast.error('Error disconnecting calendar');
    }
  };

  const handleAddGoogleConnection = async () => {
    if (!newCalendarName.trim() || !newGoogleEmail.trim()) {
      toast.error('Please enter calendar name and Google email');
      return;
    }

    setSavingConnection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('google_calendar_connections')
        .insert({
          user_id: user?.id || null,
          google_email: newGoogleEmail.trim(),
          calendar_id: newCalendarId.trim() || 'primary',
          calendar_name: newCalendarName.trim(),
          color: newCalendarColor,
          is_enabled: true,
          show_on_monthly: newShowMonthly,
          show_on_weekly: newShowWeekly,
        })
        .select('*')
        .single();

      if (error) {
        toast.error(`Error connecting calendar: ${error.message}`);
      } else if (data) {
        const newConn = data as GoogleCalendarConnection;
        setGoogleConnections((prev) => [...prev, newConn]);
        setOpenAddModal(false);
        setNewCalendarName('');
        setNewGoogleEmail('');
        toast.success('Google Calendar connected!');

        // Generate sample events for testing overlay immediately
        await seedSampleEventsForConnection(newConn.id, newConn.color);
      }
    } catch {
      toast.error('Failed to connect Google Calendar');
    } finally {
      setSavingConnection(false);
    }
  };

  const seedSampleEventsForConnection = async (connectionId: string, color: string) => {
    setSyncingId(connectionId);
    try {
      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');

      const sampleEvents = [
        {
          connection_id: connectionId,
          google_event_id: `sample_g_evt_1_${Date.now()}`,
          title: 'Parent-Teacher Conference',
          description: 'Annual progress sync with homeroom teacher',
          event_date: `${yr}-${mo}-15`,
          start_time: `${yr}-${mo}-15T14:00:00Z`,
          end_time: `${yr}-${mo}-15T15:00:00Z`,
          is_all_day: false,
          color,
        },
        {
          connection_id: connectionId,
          google_event_id: `sample_g_evt_2_${Date.now()}`,
          title: 'Soccer Practice & Pizza',
          description: 'After-school sports activity',
          event_date: `${yr}-${mo}-22`,
          start_time: `${yr}-${mo}-22T16:30:00Z`,
          end_time: `${yr}-${mo}-22T18:00:00Z`,
          is_all_day: false,
          color,
        },
        {
          connection_id: connectionId,
          google_event_id: `sample_g_evt_3_${Date.now()}`,
          title: 'District Science Fair Day',
          description: 'All-day school event',
          event_date: `${yr}-${mo}-28`,
          start_time: null,
          end_time: null,
          is_all_day: true,
          color,
        },
      ];

      await supabase.from('google_calendar_events').insert(sampleEvents);
      toast.success('Synced Google Calendar events!');
    } catch {
      // Ignore sample error
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Box>
      <PageHeading
        heading="School App Settings & Configuration"
        caption="Define your school name, customize item colors & icons, adjust user theme & font preferences, and connect Google Calendars."
      />

      {/* Top Settings Section Tabs */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: { xs: 1, sm: 2 },
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, nextVal: 'school' | 'preferences' | 'calendars') => setActiveTab(nextVal)}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
          sx={{
            minHeight: 54,
            '& .MuiTab-root': {
              minHeight: 54,
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '0.92rem',
              px: 2.5,
            },
          }}
        >
          <Tab
            value="school"
            icon={<School size={18} />}
            iconPosition="start"
            label="School & System"
          />
          <Tab
            value="preferences"
            icon={<Palette size={18} />}
            iconPosition="start"
            label="User Preferences & Theme"
          />
          <Tab
            value="calendars"
            icon={<CalendarIcon size={18} />}
            iconPosition="start"
            label={`Calendar Integrations (${googleConnections.length})`}
          />
        </Tabs>
      </Card>

      <Grid container spacing={3} alignItems="flex-start">
        {/* Main Column */}
        <Grid item xs={12} lg={8}>
          {activeTab === 'school' && (
            <>
              {/* School Name & Profile Configuration Card */}
              <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
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

              {/* TIME SCHEDULER TIMEFRAME CONFIGURATION CARD */}
              <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
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
            </>
          )}

          {activeTab === 'calendars' && (
            /* GOOGLE CALENDAR CONNECTIONS CARD */
            <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={1}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <CalendarIcon size={22} color="#4285F4" />
                    <Typography variant="h4" fontWeight={700}>
                      Google Calendar Integration
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setOpenAddModal(true)}
                    startIcon={<Plus size={18} />}
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                  >
                    Connect Google Calendar
                  </Button>
                </Box>

                <Typography variant="body2" color="text.secondary" mb={3}>
                  Link external Google Calendars to display schedule events alongside school assignments, notes, and tasks on your <strong>Monthly Planner</strong> and <strong>Weekly Binder Planner</strong>.
                </Typography>

                <Divider sx={{ my: 3 }} />

                {googleConnections.length === 0 ? (
                  <Box p={3} textAlign="center" bgcolor="action.selected" borderRadius={2}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary" mb={1}>
                      No Google Calendars linked yet
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                      Click &quot;Connect Google Calendar&quot; above to link a calendar and customize per-planner visibility.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2.5}>
                    {googleConnections.map((conn) => (
                      <Card key={conn.id} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={2}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            {/* Color Swatch */}
                            <Tooltip title="Custom Accent Color">
                              <Box display="flex" alignItems="center">
                                <input
                                  type="color"
                                  value={conn.color || '#4285F4'}
                                  onChange={(e) => handleUpdateConnectionColor(conn.id, e.target.value)}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    border: 'none',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                  }}
                                />
                              </Box>
                            </Tooltip>

                            <Box>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {conn.calendar_name}
                              </Typography>
                              <Chip
                                label={conn.google_email}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                              />
                            </Box>
                          </Stack>

                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => seedSampleEventsForConnection(conn.id, conn.color)}
                              disabled={syncingId === conn.id}
                              startIcon={<RefreshCw size={14} />}
                              sx={{ fontWeight: 700 }}
                            >
                              {syncingId === conn.id ? 'Syncing...' : 'Sync Now'}
                            </Button>
                            <IconButton size="small" color="error" onClick={() => handleDeleteConnection(conn.id)}>
                              <Trash2 size={18} />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        {/* Display Preferences Toggles */}
                        <Grid container spacing={2} pt={1}>
                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="body2" fontWeight={600}>
                                Enabled
                              </Typography>
                              <Switch
                                checked={conn.is_enabled}
                                onChange={(e) => handleToggleConnectionField(conn.id, 'is_enabled', e.target.checked)}
                                color="primary"
                                size="small"
                              />
                            </Stack>
                          </Grid>

                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="body2" fontWeight={600}>
                                Show on Monthly
                              </Typography>
                              <Switch
                                checked={conn.show_on_monthly}
                                onChange={(e) => handleToggleConnectionField(conn.id, 'show_on_monthly', e.target.checked)}
                                color="primary"
                                size="small"
                              />
                            </Stack>
                          </Grid>

                          <Grid item xs={12} sm={4}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="body2" fontWeight={600}>
                                Show on Weekly
                              </Typography>
                              <Switch
                                checked={conn.show_on_weekly}
                                onChange={(e) => handleToggleConnectionField(conn.id, 'show_on_weekly', e.target.checked)}
                                color="primary"
                                size="small"
                              />
                            </Stack>
                          </Grid>
                        </Grid>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'school' && (
            /* System Item Colors & Icons Customizer */
            <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
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
                Customize the accent colors and icons used to display <strong>School Assignments</strong>, <strong>To-Do Tasks</strong>, <strong>School Work</strong>, <strong>Parent Notes</strong>, and <strong>Holidays</strong> across the Master Calendar and Weekly Planner.
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

                {/* 3. School Work (formerly Parent Notes) */}
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
                      <Box>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                          School Work
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Daily classwork, lessons &amp; workbook items
                        </Typography>
                      </Box>
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

                {/* 4. Parent Notes (New Purple Category for Syllabus Notes) */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: itemBrandingState.parentNotes.color,
                          color: '#ffffff',
                          display: 'flex',
                        }}
                      >
                        <ItemIcon name={itemBrandingState.parentNotes.icon} size={18} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                          Parent Notes
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Notes from the parent about the syllabus
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
                          Accent Color
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <input
                            type="color"
                            value={itemBrandingState.parentNotes.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('parentNotes', 'color', e.target.value)
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
                            value={itemBrandingState.parentNotes.color}
                            onChange={(e) =>
                              handleUpdateSingleBranding('parentNotes', 'color', e.target.value)
                            }
                          />
                        </Stack>
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Icon"
                        value={itemBrandingState.parentNotes.icon}
                        onChange={(e) =>
                          handleUpdateSingleBranding('parentNotes', 'icon', e.target.value)
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

                {/* 5. Holidays */}
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
                <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center" useFlexGap>
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
                    label="School Work"
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
                    icon={<ItemIcon name={itemBrandingState.parentNotes.icon} size={16} color="#ffffff" />}
                    label="Parent Note"
                    sx={{
                      bgcolor: itemBrandingState.parentNotes.color,
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
          )}

          {activeTab === 'preferences' && (
          /* Theme, Header Font & Accent Color Customizer */
          <Card elevation={8} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={1}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Palette size={22} color={theme.palette.primary.main} />
                  <Typography variant="h4" fontWeight={700}>
                    Theme, Header Font &amp; Accent Color Switcher
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={
                    isTargetCurrentSession
                      ? `Editing: My Session${currentUserEmail ? ` (${currentUserEmail})` : ''}`
                      : `Editing User: ${selectedThemeUserEmail}`
                  }
                  color={isTargetCurrentSession ? 'primary' : 'secondary'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Choose the light/dark palette mode, header &amp; logo font, and accent color. You can adjust preferences for your own session or pre-configure them for any user account.
              </Typography>

              {/* User Account Target Selector */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 3,
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1.25}>
                      <Users size={18} color={theme.palette.primary.main} />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Configure Theme &amp; Font For User
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Saved per user in Supabase so each user sees their preferred font &amp; theme on login.
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Target User Account"
                      value={selectedThemeUserEmail}
                      disabled={loadingUserPrefs}
                      onChange={(e) => {
                        void handleThemeUserChange(e.target.value);
                      }}
                    >
                      <MenuItem value="__current__">
                        My Current Session {currentUserEmail ? `(${currentUserEmail})` : ''}
                      </MenuItem>
                      {systemUsers.map((u) => (
                        <MenuItem key={u.id} value={u.email.trim().toLowerCase()}>
                          {u.full_name} ({u.email}) — {u.role}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
              </Box>

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

              <Divider sx={{ my: 3 }} />

              {/* Header & Logo Font Switcher */}
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={0.75}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Type size={18} color={theme.palette.primary.main} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Header &amp; Logo Font (6 Fonts Available)
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Applies to &ldquo;{schoolName || "Audrey's Planner"}&rdquo; logo &amp; page headers
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Select a smooth sans-serif or classic serif typeface for headings across the app. Body copy and gradebook tables remain crisp in Inter.
              </Typography>

              <Grid container spacing={2} mb={4}>
                {headingFontOptions.map((fontOpt) => {
                  const isSelected = activeHeadingFont === fontOpt.key;
                  const fontFamilyStack = HEADING_FONT_STACKS[fontOpt.key];
                  return (
                    <Grid item xs={12} sm={6} md={4} key={fontOpt.key}>
                      <Card
                        onClick={() => handleSelectHeadingFont(fontOpt.key)}
                        elevation={isSelected ? 6 : 1}
                        sx={{
                          p: 2.25,
                          height: '100%',
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected
                            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.05)
                            : 'background.paper',
                          transition: 'all 0.2s ease-in-out',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                            borderColor: isSelected ? 'primary.main' : 'text.secondary',
                          },
                        }}
                      >
                        <Box>
                          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Typography variant="body2" fontWeight={700} color="text.primary">
                                {fontOpt.label}
                              </Typography>
                              <Chip
                                label={fontOpt.badge}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  bgcolor: isSelected
                                    ? 'primary.main'
                                    : alpha(theme.palette.primary.main, 0.12),
                                  color: isSelected ? '#ffffff' : 'primary.main',
                                }}
                              />
                            </Stack>
                            {isSelected && <Check size={18} color={theme.palette.primary.main} />}
                          </Box>

                          {/* Mini Live Brand & Header Preview */}
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: 'action.hover',
                              border: '1px solid',
                              borderColor: 'divider',
                              mb: 1.25,
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Box
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '6px',
                                  bgcolor: 'primary.main',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <GraduationCap size={14} />
                              </Box>
                              <Typography
                                sx={{
                                  fontFamily: fontFamilyStack,
                                  fontWeight: 700,
                                  fontSize: '1.02rem',
                                  letterSpacing: fontOpt.key === 'newsreader' ? '-0.015em' : '-0.025em',
                                  color: 'text.primary',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {schoolName || "Audrey's Planner"}
                              </Typography>
                            </Box>
                            <Typography
                              sx={{
                                fontFamily: fontFamilyStack,
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                color: 'text.secondary',
                                lineHeight: 1.3,
                              }}
                            >
                              Weekly Binder &amp; Schedule
                            </Typography>
                          </Box>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                          {fontOpt.description}
                        </Typography>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ my: 3 }} />

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
          )}
        </Grid>

        {/* Info & Preferences Sidebar (Sticky on Desktop) */}
        <Grid item xs={12} lg={4} sx={{ position: { lg: 'sticky' }, top: { lg: 84 } }}>
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
                    Define users ({systemUsers.length} active), view last activity, and manage roles.
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
                <Box
                  onClick={() => setActiveTab('school')}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Active School Name
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {schoolName}
                  </Typography>
                </Box>

                <Box
                  onClick={() => setActiveTab('preferences')}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Active Header &amp; Logo Font
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="primary.main"
                    sx={{ fontFamily: HEADING_FONT_STACKS[activeHeadingFont] }}
                  >
                    {headingFontOptions.find((f) => f.key === activeHeadingFont)?.label || 'Inter'} (
                    {headingFontOptions.find((f) => f.key === activeHeadingFont)?.badge || 'Original'})
                  </Typography>
                </Box>

                <Box
                  onClick={() => setActiveTab('preferences')}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Active Theme &amp; Accent Color
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" mt={0.25}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: colorPresetOptions.find((c) => c.key === activePreset)?.color || 'primary.main',
                      }}
                    />
                    <Typography variant="body2" fontWeight={700} color="text.primary">
                      {colorPresetOptions.find((c) => c.key === activePreset)?.label || 'Oxford Blue'} ({activeMode === 'light' ? 'Light' : 'Dark'})
                    </Typography>
                  </Stack>
                </Box>

                <Box
                  onClick={() => setActiveTab('school')}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Customized Items Branding
                  </Typography>
                  <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap" useFlexGap>
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
                      label="School Work"
                      sx={{ bgcolor: branding.notes.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    <Chip
                      size="small"
                      label="Parent Notes"
                      sx={{ bgcolor: branding.parentNotes.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                    <Chip
                      size="small"
                      label="Holidays"
                      sx={{ bgcolor: branding.holidays.color, color: '#fff', fontWeight: 700, fontSize: '0.68rem' }}
                    />
                  </Stack>
                </Box>

                <Box
                  onClick={() => setActiveTab('calendars')}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Linked Google Calendars
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {googleConnections.length} Connected
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
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* CONNECT GOOGLE CALENDAR MODAL */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Connect Google Calendar</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Enter the details for the Google Calendar account you wish to link. You can assign custom event badge colors and select whether events render on your Monthly or Weekly planners.
          </Typography>

          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Calendar Name"
              placeholder="e.g. Personal Schedule, Family Calendar, School Events"
              value={newCalendarName}
              onChange={(e) => setNewCalendarName(e.target.value)}
              required
            />

            <TextField
              fullWidth
              label="Google Email Address"
              placeholder="e.g. blake.womble@gmail.com"
              value={newGoogleEmail}
              onChange={(e) => setNewGoogleEmail(e.target.value)}
              required
            />

            {/* Auto-Discovered Calendar Selector */}
            <Box p={2.5} sx={{ bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
                <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                  📅 Auto-Discovered Google Calendars
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={handleAuthorizeGoogleCalendar}
                    sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                  >
                    Grant Google Access
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={fetchUserGoogleCalendars}
                    disabled={fetchingCalendars}
                    startIcon={<RefreshCw size={14} />}
                    sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                  >
                    {fetchingCalendars ? 'Scanning...' : 'Scan Account'}
                  </Button>
                </Stack>
              </Box>

              {discoveryError && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Google Calendar API Needs to be Enabled
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Google Cloud Project <strong>74675552707</strong> requires the Google Calendar API service to be turned on.
                  </Typography>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    component="a"
                    href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=74675552707"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                  >
                    Enable Google Calendar API in Google Console &rarr;
                  </Button>
                </Alert>
              )}

              <TextField
                fullWidth
                select
                size="small"
                label="Select Discovered Calendar"
                value={newCalendarId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setNewCalendarId(selectedId);
                  const found = discoveredCalendars.find((c) => c.id === selectedId);
                  if (found) {
                    setNewCalendarName(found.summary);
                    if (found.backgroundColor) {
                      setNewCalendarColor(found.backgroundColor);
                    }
                  }
                }}
                helperText="Clicking a calendar auto-fills its Name, Calendar ID, and default Color."
              >
                {discoveredCalendars.map((cal) => (
                  <MenuItem key={cal.id} value={cal.id}>
                    <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="space-between" width="100%">
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: cal.backgroundColor || '#4285F4',
                          }}
                        />
                        <Typography variant="body2" fontWeight={700}>
                          {cal.summary}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        ({cal.id.length > 25 ? cal.id.substring(0, 22) + '...' : cal.id})
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              fullWidth
              label="Calendar Name"
              placeholder="e.g. Personal Schedule, Family Calendar, School Events"
              value={newCalendarName}
              onChange={(e) => setNewCalendarName(e.target.value)}
              required
            />

            <TextField
              fullWidth
              label="Google Email Address"
              placeholder="e.g. blake.womble@gmail.com"
              value={newGoogleEmail}
              onChange={(e) => setNewGoogleEmail(e.target.value)}
              required
            />

            <TextField
              fullWidth
              label="Google Calendar ID"
              placeholder="primary (or e.g. xyz@group.calendar.google.com)"
              value={newCalendarId}
              onChange={(e) => setNewCalendarId(e.target.value)}
              helperText="Use 'primary' for your main calendar, or paste a secondary group calendar ID."
            />

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={700}>
                Event Badge Color
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <input
                  type="color"
                  value={newCalendarColor}
                  onChange={(e) => setNewCalendarColor(e.target.value)}
                  style={{
                    width: 36,
                    height: 36,
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                  }}
                />
                <TextField
                  size="small"
                  value={newCalendarColor}
                  onChange={(e) => setNewCalendarColor(e.target.value)}
                  sx={{ width: 110 }}
                />
              </Stack>
            </Box>

            <Divider />

            <Typography variant="subtitle2" fontWeight={700}>
              Planner Display Preferences
            </Typography>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Display events on Monthly Planner (/calendar)</Typography>
              <Switch
                checked={newShowMonthly}
                onChange={(e) => setNewShowMonthly(e.target.checked)}
                color="primary"
              />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Display events on Weekly Binder Planner (/calendar/planner)</Typography>
              <Switch
                checked={newShowWeekly}
                onChange={(e) => setNewShowWeekly(e.target.checked)}
                color="primary"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddModal(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddGoogleConnection}
            disabled={savingConnection || !newCalendarName.trim() || !newGoogleEmail.trim()}
            startIcon={<Plus size={16} />}
            sx={{ fontWeight: 700 }}
          >
            {savingConnection ? 'Connecting...' : 'Connect & Sync Calendar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
