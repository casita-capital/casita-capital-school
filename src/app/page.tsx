'use client';

import { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { Calendar, Plus, LogIn, Printer, FileText, ArrowRight, BookOpen, Repeat } from 'lucide-react';
import { RouterLink } from 'src/components/base/router-link';
import { createClient } from 'src/services/supabase/client';

import { useSchoolSettings } from 'src/contexts/school-settings';

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
}

export default function SchoolDashboardPage() {
  const theme = useTheme();
  const { schoolName } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subjectCount, setSubjectCount] = useState<number>(0);
  const [pendingTaskCount, setPendingTaskCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const activeEmail =
          user?.email ||
          (typeof window !== 'undefined' ? localStorage.getItem('school_active_user_email') : null) ||
          'blake.womble@gmail.com';

        let targetRecord = null;

        if (user?.id) {
          const { data: byAuthId } = await supabase
            .from('users')
            .select('full_name, email, role')
            .eq('auth_id', user.id)
            .maybeSingle();

          targetRecord = byAuthId;
        }

        if (!targetRecord && activeEmail) {
          const { data: byEmail } = await supabase
            .from('users')
            .select('full_name, email, role')
            .eq('email', activeEmail)
            .maybeSingle();

          targetRecord = byEmail;
        }

        if (!targetRecord) {
          const { data: fallbackUser } = await supabase
            .from('users')
            .select('full_name, email, role')
            .eq('email', 'blake.womble@gmail.com')
            .maybeSingle();

          targetRecord = fallbackUser;
        }

        if (targetRecord) {
          setProfile(targetRecord as UserProfile);
        } else {
          setProfile({
            full_name: 'Blake Womble',
            email: 'blake.womble@gmail.com',
            role: 'admin',
          });
        }

        const [{ count: subCount }, { count: taskCount }] = await Promise.all([
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('completed', false),
        ]);
        if (typeof subCount === 'number') setSubjectCount(subCount);
        if (typeof taskCount === 'number') setPendingTaskCount(taskCount);
      } catch {
        setProfile({
          full_name: 'Blake Womble',
          email: 'blake.womble@gmail.com',
          role: 'admin',
        });
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [supabase]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : '';

  return (
    <Box>
      {/* Clean Unified Greeting Header */}
      <Card
        elevation={0}
        sx={{
          p: 2.5,
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
                fontSize: { xs: '1.4rem', sm: '1.7rem' },
                lineHeight: 1.15,
              }}
            >
              {firstName ? `Welcome back, ${firstName}` : schoolName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {schoolName} · Weekly binder planning, subject automations, and family schedule.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {profile ? (
              <>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 1.75,
                    py: 0.85,
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  New Calendar Event
                </Button>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<Printer size={16} />}
                  sx={{
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2,
                    py: 0.85,
                    boxShadow: 'none',
                  }}
                >
                  Open Weekly Binder
                </Button>
              </>
            ) : (
              <Button
                component={RouterLink}
                href="/login"
                variant="contained"
                color="primary"
                startIcon={<LogIn size={18} />}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                Sign In to Start
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {/* Primary Workspace Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Weekly Binder Planner Card (Primary Daily Destination) */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.35),
              bgcolor: alpha(theme.palette.primary.main, 0.02),
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  <Printer size={20} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  Weekly Binder Planner
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                Print-ready 2-page weekly binder spread with subject rows, top 3 daily priorities, habits tracker, and notes.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="contained"
                  color="primary"
                  fullWidth
                  endIcon={<ArrowRight size={16} />}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, py: 1, boxShadow: 'none' }}
                >
                  Open Weekly Binder
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Master Monthly Calendar Card */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    display: 'flex',
                  }}
                >
                  <Calendar size={20} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  Master Monthly Calendar
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                Full month view of holidays, school assignments, parent notes, and family events ready for printing.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="outlined"
                  color="primary"
                  fullWidth
                  endIcon={<ArrowRight size={16} />}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, py: 1 }}
                >
                  Open Monthly Calendar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* School Assignments & Tasks Card */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.12),
                    color: 'success.main',
                    display: 'flex',
                  }}
                >
                  <FileText size={20} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  Assignments &amp; Tasks
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                Organize homework, projects, tests, and family to-do tasks scoped by subject and due date.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/assignments"
                  variant="outlined"
                  color="inherit"
                  fullWidth
                  endIcon={<ArrowRight size={16} />}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, py: 1, borderColor: 'divider' }}
                >
                  Open Assignments
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Compact Secondary Quick-Glance Row */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: 'secondary.main',
                    display: 'flex',
                  }}
                >
                  <BookOpen size={18} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Subjects &amp; Habit Trackers ({subjectCount} Subjects)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reorder subjects, update class links, or edit daily habits
                  </Typography>
                </Box>
              </Stack>
              <Button
                component={RouterLink}
                href="/subjects-habits"
                size="small"
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Manage →
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    display: 'flex',
                  }}
                >
                  <Repeat size={18} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Automations &amp; Syllabi ({pendingTaskCount} Open Tasks)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Configure weekday auto-fill rules or upload a syllabus with AI
                  </Typography>
                </Box>
              </Stack>
              <Button
                component={RouterLink}
                href="/automations"
                size="small"
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Configure →
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
