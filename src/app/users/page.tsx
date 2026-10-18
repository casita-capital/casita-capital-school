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
import { ItemIcon } from 'src/components/base/item-icon';
import { createClient } from 'src/services/supabase/client';

const AVATAR_ICON_OPTIONS = [
  { id: 'User', label: 'Initials / Default' },
  { id: 'Sparkles', label: 'Sparkles' },
  { id: 'Star', label: 'Star' },
  { id: 'BookOpen', label: 'Book' },
  { id: 'CheckCircle', label: 'Check Circle' },
  { id: 'Shield', label: 'Shield' },
];

interface UserRecord {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string;
  role: 'admin' | 'parent' | 'teacher' | 'student';
  avatar_url: string | null;
  last_login_at: string | null;
  updated_at?: string | null;
  last_activity_at?: string | null;
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
  const [avatarUrl, setAvatarUrl] = useState<string>('User');
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
      const [{ data, error }, { data: auditRows }] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('changed_by, created_at')
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      if (error) {
        toast.error(`Error loading users: ${error.message}`);
      } else if (data) {
        const latestAuditByActor = new Map<string, string>();
        if (auditRows) {
          for (const row of auditRows) {
            if (typeof row.changed_by === 'string' && typeof row.created_at === 'string') {
              const key = row.changed_by.trim().toLowerCase();
              if (key && !latestAuditByActor.has(key)) {
                latestAuditByActor.set(key, row.created_at);
              }
            }
          }
        }

        const enriched = (data as UserRecord[]).map((u) => {
          const emailKey = u.email.trim().toLowerCase();
          const nameKey = u.full_name.trim().toLowerCase();
          const candidates = [
            u.last_login_at,
            latestAuditByActor.get(emailKey) || null,
            latestAuditByActor.get(nameKey) || null,
            u.updated_at && u.updated_at !== u.created_at ? u.updated_at : null,
          ].filter((val): val is string => Boolean(val));

          let bestIso: string | null = null;
          let bestMs = 0;
          for (const iso of candidates) {
            const ms = new Date(iso).getTime();
            if (!Number.isNaN(ms) && ms > bestMs) {
              bestMs = ms;
              bestIso = iso;
            }
          }

          return {
            ...u,
            last_activity_at: bestIso,
          };
        });

        setUsers(enriched);
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
    setAvatarUrl('User');
    setSendInvite(true);
    setOpenModal(true);
  };

  const handleOpenEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setRole(u.role);
    setAvatarUrl(u.avatar_url || 'User');
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
        const nextAvatar = avatarUrl === 'User' ? null : avatarUrl;
        const { error } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            role,
            avatar_url: nextAvatar,
          })
          .eq('id', editingUser.id);

        if (error) {
          toast.error(`Failed to update user: ${error.message}`);
        } else {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUser.id
                ? { ...u, full_name: fullName.trim(), role, avatar_url: nextAvatar }
                : u
            )
          );
          toast.success('User updated successfully');
          setOpenModal(false);
        }
      } else {
        const nextAvatar = avatarUrl === 'User' ? null : avatarUrl;
        const { data, error } = await supabase
          .from('users')
          .insert({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            role,
            avatar_url: nextAvatar,
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

  const renderUserAvatar = (u: Pick<UserRecord, 'full_name' | 'avatar_url'>, size = 38) => {
    const isImageUrl = Boolean(
      u.avatar_url && (u.avatar_url.startsWith('data:') || u.avatar_url.startsWith('http'))
    );
    const isCustomIcon = Boolean(
      u.avatar_url && !isImageUrl && u.avatar_url !== 'User'
    );

    return (
      <Avatar
        src={isImageUrl && u.avatar_url ? u.avatar_url : undefined}
        sx={{
          bgcolor: 'primary.main',
          fontWeight: 700,
          width: size,
          height: size,
          fontSize: '0.85rem',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {!isImageUrl ? (
          isCustomIcon && u.avatar_url ? (
            <ItemIcon name={u.avatar_url} size={Math.round(size * 0.48)} color="#ffffff" />
          ) : (
            getInitials(u.full_name)
          )
        ) : null}
      </Avatar>
    );
  };

  const formatLastActivity = (activityAt: string | null | undefined) => {
    if (!activityAt) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>
          No activity yet
        </Typography>
      );
    }
    const d = new Date(activityAt);
    if (Number.isNaN(d.getTime())) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          —
        </Typography>
      );
    }

    const now = new Date();
    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    const datePart = isSameDay
      ? 'Today'
      : isYesterday
      ? 'Yesterday'
      : d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return (
      <Stack spacing={0.15} sx={{ whiteSpace: 'nowrap' }}>
        <Typography
          variant="body2"
          fontWeight={600}
          color={isSameDay ? 'success.main' : 'text.primary'}
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {datePart}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {timePart}
        </Typography>
      </Stack>
    );
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
          <Table sx={{ minWidth: 760 }}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>USER NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>EMAIL ADDRESS</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 130, whiteSpace: 'nowrap' }}>ROLE</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 170, whiteSpace: 'nowrap' }}>LAST ACTIVITY</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 150, whiteSpace: 'nowrap' }}>CREATED DATE</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 170, textAlign: 'right', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        {renderUserAvatar(u, 38)}
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {u.full_name}
                          </Typography>
                          {u.avatar_url && !u.avatar_url.startsWith('data:') && !u.avatar_url.startsWith('http') && u.avatar_url !== 'User' && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                              Icon: {u.avatar_url}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {u.email}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleChip(u.role)}</TableCell>

                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatLastActivity(u.last_activity_at ?? u.last_login_at)}
                    </TableCell>

                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
              <Stack direction="row" spacing={2} alignItems="center">
                {renderUserAvatar({ full_name: fullName || 'User', avatar_url: avatarUrl }, 48)}
                <Box flexGrow={1}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {fullName || 'New User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')
                      ? 'Using custom uploaded photo'
                      : `Avatar Icon: ${avatarUrl}`}
                  </Typography>
                </Box>
              </Stack>

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
                onChange={(e) => setRole(e.target.value as UserRecord['role'])}
              >
                <MenuItem value="admin">Admin (Full Access &amp; Settings)</MenuItem>
                <MenuItem value="parent">Parent (Planner, Calendar, Assignments)</MenuItem>
                <MenuItem value="teacher">Teacher (Assignments &amp; Curriculum)</MenuItem>
                <MenuItem value="student">Student (Read-Only Assignments &amp; Tasks)</MenuItem>
              </TextField>

              <TextField
                fullWidth
                select
                label="Avatar Icon"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              >
                {(avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) && (
                  <MenuItem value={avatarUrl}>Custom Uploaded Image (Keep Current)</MenuItem>
                )}
                {AVATAR_ICON_OPTIONS.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <ItemIcon name={opt.id} size={18} />
                      <span>{opt.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
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
