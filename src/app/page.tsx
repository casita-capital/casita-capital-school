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
import { Calendar, CheckSquare, Plus, LogIn, User, ShieldCheck } from 'lucide-react';
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

        if (user) {
          const { data } = await supabase
            .from('users')
            .select('full_name, email, role')
            .eq('auth_id', user.id)
            .single();

          if (data) {
            setProfile(data as UserProfile);
          } else {
            setProfile({
              full_name: (user.user_metadata?.full_name as string) || user.email || 'Parent User',
              email: user.email || '',
              role: 'parent',
            });
          }
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
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

      {!profile && (
        <Card
          elevation={4}
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 3,
            bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.12)' : 'rgba(12, 116, 228, 0.06)'),
            border: '1px solid',
            borderColor: 'primary.main',
          }}
        >
          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary.main" gutterBottom>
                Parent Access Required
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please sign in with your configured parent account (Blake Womble or Stephanie Womble) to manage weekly activities.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              href="/login"
              variant="contained"
              color="primary"
              size="large"
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Go to Login Page &rarr;
            </Button>
          </Box>
        </Card>
      )}

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
                    Authenticated Parent Session
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
        <Grid item xs={12} sm={6} md={3}>
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

        <Grid item xs={12} sm={6} md={3}>
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

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={8}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                Target Host
              </Typography>
              <Typography variant="h5" fontWeight={600} color="primary.main" sx={{ mt: 1, mb: 0.5 }}>
                school.casitacapital.com
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Production domain endpoint
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={8}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                Database Schema
              </Typography>
              <Typography variant="h5" fontWeight={600} color="success.main" sx={{ mt: 1, mb: 0.5 }}>
                &quot;school&quot;
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Isolated Supabase schema
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={8} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '8px',
                    bgcolor: 'primary.main',
                    color: 'common.white',
                    display: 'flex',
                  }}
                >
                  <Calendar size={22} />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  Weekly Calendar View
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Design and manage your daughter&apos;s weekly class schedules, extracurricular activities, assignment due dates, and school reminders.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/calendar"
                  variant="outlined"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  Open Calendar Creator &rarr;
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={8} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '8px',
                    bgcolor: 'success.main',
                    color: 'common.white',
                    display: 'flex',
                  }}
                >
                  <CheckSquare size={22} />
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  To-Do List &amp; Tasks
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Organize homework tasks, daily checklists, reading goals, and parent management items in an intuitive card-based layout.
              </Typography>
              <Box sx={{ mt: 'auto' }}>
                <Button
                  component={RouterLink}
                  href="/tasks"
                  variant="outlined"
                  color="success"
                  sx={{ fontWeight: 600 }}
                >
                  Open To-Do List Creator &rarr;
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
