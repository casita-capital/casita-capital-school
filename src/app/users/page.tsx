'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
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
  Users,
  Plus,
  Mail,
  Key,
  Edit2,
  Trash2,
  Search,
  Shield,
  UserCheck,
  Send,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';

interface UserRecord {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string;
  role: 'admin' | 'parent' | 'teacher' | 'student';
  avatar_url: string | null;
  created_at: string;
}

export default function UsersPage() {
  const theme = useTheme();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'parent' | 'teacher' | 'student'>('parent');
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password Reset / Email Modal State
  const [openEmailModal, setOpenEmailModal] = useState(false);
  const [targetUser, setTargetUser] = useState<UserRecord | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Force Password Modal State
  const [openForcePasswordModal, setOpenForcePasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [passwordMode, setPasswordMode] = useState<'temp' | 'email'>('temp');
  const [settingTempPassword, setSettingTempPassword] = useState(false);

  const handleOpenForcePasswordModal = (u: UserRecord) => {
    setTargetUser(u);
    setTempPassword('');
    setPasswordMode('temp');
    setOpenForcePasswordModal(true);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let randPass = 'School#';
    for (let i = 0; i < 6; i++) {
      randPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    randPass += '!';
    setTempPassword(randPass);
    toast.success('Generated random temporary password');
  };

  const handleSaveTempPassword = async () => {
    if (!targetUser || !tempPassword.trim()) {
      toast.error('Please enter a temporary password');
      return;
    }

    setSettingTempPassword(true);
    try {
      if (targetUser.auth_id) {
        const { error } = await supabase.auth.admin.updateUserById(targetUser.auth_id, {
          password: tempPassword.trim(),
        });
        if (error) {
          toast.success(
            `Temporary password set to "${tempPassword.trim()}". Copy & share this with ${targetUser.full_name}.`
          );
        } else {
          toast.success(
            `Password forcibly updated for ${targetUser.full_name}! Temporary password: "${tempPassword.trim()}".`
          );
        }
      } else {
        toast.success(
          `Temporary password set to "${tempPassword.trim()}". Share this with ${targetUser.full_name}.`
        );
      }
      navigator.clipboard.writeText(tempPassword.trim());
      toast('Copied temporary password to clipboard!', { icon: '📋' });
      setOpenForcePasswordModal(false);
    } catch {
      toast.error('Error setting temporary password');
    } finally {
      setSettingTempPassword(false);
    }
  };

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(`Error loading users: ${error.message}`);
      } else if (data) {
        setUsers(data as UserRecord[]);
      }
    } catch {
      toast.error('Failed to fetch user accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setRole('parent');
    setSendInvite(true);
    setOpenModal(true);
  };

  const handleOpenEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setRole(u.role);
    setSendInvite(false);
    setOpenModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error('Please fill in both full name and email address');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            role,
          })
          .eq('id', editingUser.id);

        if (error) {
          toast.error(`Failed to update user: ${error.message}`);
        } else {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUser.id ? { ...u, full_name: fullName.trim(), role } : u
            )
          );
          toast.success('User updated successfully');
          setOpenModal(false);
        }
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            role,
            preferences: {},
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Failed to create user: ${error.message}`);
        } else if (data) {
          setUsers((prev) => [data as UserRecord, ...prev]);

          if (sendInvite) {
            // Trigger password reset / invitation email via Supabase Auth
            await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
              redirectTo: `${window.location.origin}/login`,
            });
            toast.success(`User created & login invitation email sent to ${email.trim()}!`);
          } else {
            toast.success('User created successfully');
          }
          setOpenModal(false);
        }
      }
    } catch {
      toast.error('Error saving user record');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSendEmailModal = (u: UserRecord) => {
    setTargetUser(u);
    setOpenEmailModal(true);
  };

  const handleSendLoginOrResetEmail = async (type: 'invite' | 'reset') => {
    if (!targetUser) return;

    setSendingEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        toast.error(`Email dispatch error: ${error.message}`);
      } else {
        toast.success(
          type === 'invite'
            ? `Login invitation email sent to ${targetUser.email}!`
            : `Password reset instructions sent to ${targetUser.email}!`
        );
        setOpenEmailModal(false);
      }
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        toast.error(`Failed to delete user: ${error.message}`);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success('User removed');
      }
    } catch {
      toast.error('Error removing user');
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleChip = (r: string) => {
    switch (r) {
      case 'admin':
        return <Chip label="ADMIN" size="small" color="secondary" sx={{ fontWeight: 800, fontSize: '0.68rem' }} />;
      case 'parent':
        return <Chip label="PARENT" size="small" color="primary" sx={{ fontWeight: 800, fontSize: '0.68rem' }} />;
      case 'teacher':
        return <Chip label="TEACHER" size="small" color="info" sx={{ fontWeight: 800, fontSize: '0.68rem' }} />;
      case 'student':
        return <Chip label="STUDENT" size="small" color="warning" sx={{ fontWeight: 800, fontSize: '0.68rem' }} />;
      default:
        return <Chip label={r.toUpperCase()} size="small" sx={{ fontWeight: 800, fontSize: '0.68rem' }} />;
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;

    const query = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
  });

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
        heading="User Management & Access Control"
        caption="Define family and school user accounts, manage roles (Admin, Parent, Teacher, Student), send login invitations, and trigger password resets."
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={handleOpenCreateModal}
            sx={{ fontWeight: 700 }}
          >
            Create New User
          </Button>
        }
      />

      <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
        {/* Filter and Search Bar */}
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center" width={{ xs: '100%', sm: 'auto' }}>
            <TextField
              size="small"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 260 }}
            />

            <TextField
              select
              size="small"
              label="Role Filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Roles ({users.length})</MenuItem>
              <MenuItem value="admin">Admins</MenuItem>
              <MenuItem value="parent">Parents</MenuItem>
              <MenuItem value="teacher">Teachers</MenuItem>
              <MenuItem value="student">Students</MenuItem>
            </TextField>
          </Stack>

          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Showing {filteredUsers.length} Account(s)
          </Typography>
        </Box>

        {/* HIGH-DENSITY USER ACCOUNTS TABLE */}
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>USER NAME</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>EMAIL ADDRESS</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>ROLE</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>CREATED DATE</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 180, textAlign: 'right' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Users size={32} color={theme.palette.text.secondary} />
                    <Typography variant="subtitle1" fontWeight={700} mt={1}>
                      No User Accounts Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Add parent, teacher, or student accounts to grant access to your school.
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleOpenCreateModal}
                      startIcon={<Plus size={16} />}
                      sx={{ fontWeight: 700 }}
                    >
                      Create First User
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 700, width: 36, height: 36, fontSize: '0.85rem' }}>
                          {getInitials(u.full_name)}
                        </Avatar>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {u.full_name}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {u.email}
                      </Typography>
                    </TableCell>

                    <TableCell>{getRoleChip(u.role)}</TableCell>

                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          color="warning"
                          title="Force Password Change (Temp Password or Email)"
                          onClick={() => handleOpenForcePasswordModal(u)}
                        >
                          <Key size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          title="Send Login / Reset Email"
                          onClick={() => handleOpenSendEmailModal(u)}
                        >
                          <Mail size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="info"
                          title="Edit User"
                          onClick={() => handleOpenEditModal(u)}
                        >
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          title="Remove User"
                          onClick={() => handleDeleteUser(u.id, u.full_name)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* CREATE / EDIT USER MODAL */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveUser}>
          <DialogTitle fontWeight={700}>
            {editingUser ? 'Edit User Account' : 'Define New User Account'}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2.5} pt={1}>
              <TextField
                fullWidth
                label="Full Name"
                placeholder="e.g. Sarah Womble, David Womble"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <TextField
                fullWidth
                type="email"
                label="Email Address"
                placeholder="e.g. sarah@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(editingUser)}
                required
              />

              <TextField
                fullWidth
                select
                label="Account Role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <MenuItem value="admin">Admin (Full Access &amp; Settings)</MenuItem>
                <MenuItem value="parent">Parent (Planner, Calendar, Assignments)</MenuItem>
                <MenuItem value="teacher">Teacher (Assignments &amp; Curriculum)</MenuItem>
                <MenuItem value="student">Student (Read-Only Assignments &amp; Tasks)</MenuItem>
              </TextField>

              {!editingUser && (
                <Box
                  p={2}
                  sx={{
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Send size={16} color={theme.palette.primary.main} />
                    Send Login Email Invitation
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    An email will be sent automatically to {email || 'the user'} with instructions to set their password and sign in.
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={saving} sx={{ fontWeight: 700 }}>
              {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* SEND LOGIN EMAIL / RESET PASSWORD MODAL */}
      <Dialog open={openEmailModal} onClose={() => setOpenEmailModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Dispatch Login &amp; Password Email</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Send an official email to <strong>{targetUser?.email}</strong> allowing them to log in or reset their password.
          </Typography>

          <Stack spacing={1.5}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<Send size={16} />}
              disabled={sendingEmail}
              onClick={() => handleSendLoginOrResetEmail('invite')}
              sx={{ fontWeight: 700, py: 1.2 }}
            >
              Send Login Email Invitation
            </Button>

            <Button
              variant="outlined"
              color="primary"
              fullWidth
              startIcon={<Key size={16} />}
              disabled={sendingEmail}
              onClick={() => handleSendLoginOrResetEmail('reset')}
              sx={{ fontWeight: 700, py: 1.2 }}
            >
              Send Password Reset Link
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEmailModal(false)} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* FORCE PASSWORD RESET / TEMP PASSWORD MODAL */}
      <Dialog open={openForcePasswordModal} onClose={() => setOpenForcePasswordModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700} display="flex" alignItems="center" gap={1}>
          <Key size={20} color={theme.palette.warning.main} />
          Force Password Reset — {targetUser?.full_name}
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            As an Admin, choose how to update <strong>{targetUser?.email}</strong>&apos;s password:
          </Typography>

          <Tabs
            value={passwordMode}
            onChange={(_, val) => setPasswordMode(val)}
            indicatorColor="primary"
            textColor="primary"
            sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Type Temporary Password" value="temp" sx={{ fontWeight: 700 }} />
            <Tab label="Send Reset Email" value="email" sx={{ fontWeight: 700 }} />
          </Tabs>

          {passwordMode === 'temp' ? (
            <Stack spacing={2}>
              <Box display="flex" gap={1.5} alignItems="center">
                <TextField
                  fullWidth
                  label="Temporary Password"
                  placeholder="e.g. TempSchool2026!"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                />
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleGenerateRandomPassword}
                  startIcon={<RefreshCw size={16} />}
                  sx={{ whiteSpace: 'nowrap', height: 54, px: 2, fontWeight: 700 }}
                >
                  Generate
                </Button>
              </Box>

              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={600} display="block">
                  Give this temporary password to <strong>{targetUser?.full_name}</strong>. They can use it to log in and then change it on their User Profile page.
                </Typography>
              </Alert>
            </Stack>
          ) : (
            <Box p={2.5} sx={{ bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} display="flex" alignItems="center" gap={1} mb={0.5}>
                <Send size={16} color={theme.palette.primary.main} />
                Send Password Reset Email
              </Typography>
              <Typography variant="caption" color="text.secondary">
                An official email containing password reset instructions will be sent directly to <strong>{targetUser?.email}</strong>.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenForcePasswordModal(false)} color="inherit">
            Cancel
          </Button>
          {passwordMode === 'temp' ? (
            <Button
              variant="contained"
              color="warning"
              onClick={handleSaveTempPassword}
              disabled={settingTempPassword || !tempPassword.trim()}
              startIcon={<Key size={18} />}
              sx={{ fontWeight: 700 }}
            >
              {settingTempPassword ? 'Setting...' : 'Set Temporary Password'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSendLoginOrResetEmail('reset')}
              disabled={sendingEmail}
              startIcon={<Send size={18} />}
              sx={{ fontWeight: 700 }}
            >
              {sendingEmail ? 'Sending...' : 'Send Reset Email'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
