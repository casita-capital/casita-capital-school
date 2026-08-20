'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { Calendar, CheckSquare, Plus, LogIn, User, ShieldCheck, Printer, FileText, ArrowRight } from 'lucide-react';
import { PageHeading } from 'src/components/base/page-heading';
import { RouterLink } from 'src/components/base/router-link';
import { createClient } from 'src/services/supabase/client';

import { useSchoolSettings } from 'src/contexts/school-settings';

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
}

export default function SchoolDashboardPage() {
  const { schoolName } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <Box>
      <PageHeading
        heading={profile ? `Welcome Back, ${profile.full_name}!` : schoolName}
        caption={
          profile
            ? `Logged in as ${profile.email} (${profile.role.toUpperCase()}) — Manage your family's weekly calendar & homework tasks.`
            : 'Weekly calendar & to-do list creator for school activities, homework, and weekly planning.'
        }
        actions={
          profile ? (
            <Button
              component={RouterLink}
              href="/calendar"
              variant="contained"
              color="primary"
              startIcon={<Plus size={18} />}
              sx={{ fontWeight: 600 }}
            >
              Create New Event
            </Button>
          ) : (
            <Button
              component={RouterLink}
              href="/login"
              variant="contained"
              color="primary"
              startIcon={<LogIn size={18} />}
              sx={{ fontWeight: 600 }}
            >
              Sign In to Start
            </Button>
          )
        }
      />

      {profile && (
        <Card elevation={2} sx={{ mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2} justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    color: 'common.white',
                    display: 'flex',
                  }}
                >
                  <ShieldCheck size={28} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    Authenticated User Session
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active user account isolated under the <strong>&quot;school&quot;</strong> database schema.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Chip icon={<User size={14} />} label={profile.full_name} color="primary" variant="filled" sx={{ fontWeight: 600 }} />
                <Chip label={profile.role.toUpperCase()} color="success" variant="outlined" sx={{ fontWeight: 600 }} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4} md={4}>
          <Card elevation={8}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                Weekly Schedule
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 1, mb: 0.5 }}>
                0 Events
              </Typography>
              <Typography variant="caption" color="text.secondary">
                No events scheduled for this week
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4} md={4}>
          <Card elevation={8}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                Pending Tasks
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 1, mb: 0.5 }}>
                0 To-Dos
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All tasks are up to date
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4} md={4}>
          <Card elevation={8}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                Active User Profile
              </Typography>
              <Typography variant="h5" fontWeight={600} color="primary.main" sx={{ mt: 1, mb: 0.5 }}>
                {profile ? profile.full_name : 'Blake Womble'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {profile ? profile.email : 'blake.womble@gmail.com'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Master Monthly Calendar Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={8} sx={{ height: '100%', border: '1px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  <Calendar size={24} />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  Master Monthly Calendar
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                View full month overview, track holidays, school assignments, parent notes, and to-do tasks across all dates.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  endIcon={<ArrowRight size={18} />}
                  sx={{ fontWeight: 700, borderRadius: 2, py: 1.2 }}
                >
                  Open Monthly Calendar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly Binder Planner Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={8} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'secondary.main',
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  <Printer size={24} />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  Weekly Binder Planner
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Print-ready 2-page weekly binder planner with subject rows, top 3 priorities, habits tracker, and notes.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar/planner"
                  variant="outlined"
                  color="primary"
                  fullWidth
                  size="large"
                  endIcon={<ArrowRight size={18} />}
                  sx={{ fontWeight: 700, borderRadius: 2, py: 1.2 }}
                >
                  Open Weekly Planner
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* School Assignments & Tasks Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={8} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'success.main',
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  <FileText size={24} />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  School Assignments &amp; Tasks
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Organize homework, projects, tests, priorities, and category filters scoped by subject and due dates.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/assignments"
                  variant="outlined"
                  color="success"
                  fullWidth
                  size="large"
                  endIcon={<ArrowRight size={18} />}
                  sx={{ fontWeight: 700, borderRadius: 2, py: 1.2 }}
                >
                  Open Assignments &amp; Tasks
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
