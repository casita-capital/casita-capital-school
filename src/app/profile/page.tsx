'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  User,
  Mail,
  Key,
  Shield,
  Save,
  Lock,
  Sparkles,
  CheckCircle,
  Camera,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeading } from 'src/components/base/page-heading';
import { createClient } from 'src/services/supabase/client';
import { ItemIcon } from 'src/components/base/item-icon';

const AVATAR_ICON_OPTIONS = [
  { id: 'User', label: 'User Silhouette' },
  { id: 'Sparkles', label: 'Sparkles' },
  { id: 'Star', label: 'Star' },
  { id: 'BookOpen', label: 'Book' },
  { id: 'CheckCircle', label: 'Check Circle' },
  { id: 'Shield', label: 'Shield' },
];

export default function UserProfilePage() {
  const theme = useTheme();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('parent');
  const [avatarIcon, setAvatarIcon] = useState('User');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarIcon(base64);
        toast.success('Avatar image uploaded! Click "Save Profile Changes" to save.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  async function loadProfile() {
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
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        targetRecord = byAuthId;
      }

      if (!targetRecord && activeEmail) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', activeEmail)
          .maybeSingle();

        targetRecord = byEmail;
      }

      if (!targetRecord) {
        const { data: fallbackUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', 'blake.womble@gmail.com')
          .maybeSingle();

        targetRecord = fallbackUser;
      }

      if (targetRecord) {
        setUserId(targetRecord.id);
        setFullName(targetRecord.full_name || '');
        setEmail(targetRecord.email || '');
        setRole(targetRecord.role || 'parent');
        if (targetRecord.avatar_url) setAvatarIcon(targetRecord.avatar_url);
      }
    } catch {
      toast.error('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setSavingProfile(true);
    try {
      if (userId) {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            avatar_url: avatarIcon,
          })
          .eq('id', userId);

        if (error) {
          toast.error(`Failed to update profile: ${error.message}`);
        } else {
          toast.success('User profile updated in database!');
          window.dispatchEvent(new Event('school_user_profile_updated'));
        }
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert({
            full_name: fullName.trim(),
            email: email.trim() || 'user@example.com',
            role: 'parent',
            avatar_url: avatarIcon,
            preferences: {},
          })
          .select('*')
          .single();

        if (error) {
          toast.error(`Error saving profile: ${error.message}`);
        } else if (data) {
          setUserId(data.id);
          toast.success('User profile created and saved!');
          window.dispatchEvent(new Event('school_user_profile_updated'));
        }
      }
    } catch {
      toast.error('Error saving profile changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(`Password update failed: ${error.message}`);
      } else {
        toast.success('Security password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast.error('Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
        heading="User Profile & Account Settings"
        caption="Manage your personal details, profile icon, email address, and security password."
      />

      <Grid container spacing={3}>
        {/* Left Main Column: Personal Details & Avatar */}
        <Grid item xs={12} lg={7}>
          <Card elevation={8} sx={{ borderRadius: 3, mb: 4 }}>
            <form onSubmit={handleSaveProfile}>
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                  <User size={22} color={theme.palette.primary.main} />
                  <Typography variant="h4" fontWeight={700}>
                    Personal Profile Details
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Update your display name and choose your preferred profile avatar icon.
                </Typography>

                <Divider sx={{ my: 3 }} />

                {/* Avatar Preview & Upload Action */}
                <Stack direction="row" alignItems="center" spacing={3} mb={4}>
                  <Avatar
                    src={avatarIcon.startsWith('data:') || avatarIcon.startsWith('http') ? avatarIcon : undefined}
                    sx={{
                      width: 68,
                      height: 68,
                      bgcolor: 'primary.main',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      boxShadow: 3,
                    }}
                  >
                    {!avatarIcon.startsWith('data:') && !avatarIcon.startsWith('http') ? (
                      avatarIcon !== 'User' ? (
                        <ItemIcon name={avatarIcon} size={28} color="#ffffff" />
                      ) : (
                        getInitials(fullName || 'Parent User')
                      )
                    ) : null}
                  </Avatar>

                  <Box flexGrow={1}>
                    <Typography variant="h6" fontWeight={700}>
                      {fullName || 'Parent User'}
                    </Typography>
                    <Chip
                      label={role.toUpperCase()}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 800, fontSize: '0.68rem', mt: 0.5, mb: 1, display: 'inline-block' }}
                    />
                    <Box mt={0.5}>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<Upload size={16} />}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ fontWeight: 700, borderRadius: 2 }}
                      >
                        Upload Avatar Image
                      </Button>
                    </Box>
                  </Box>
                </Stack>

                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    placeholder="e.g. Blake Womble, Sarah Womble"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />

                  <TextField
                    fullWidth
                    select
                    label="Profile Avatar Icon"
                    value={avatarIcon}
                    onChange={(e) => setAvatarIcon(e.target.value)}
                  >
                    {AVATAR_ICON_OPTIONS.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <ItemIcon name={opt.id} size={18} />
                          <span>{opt.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    fullWidth
                    label="Email Address"
                    value={email}
                    disabled
                    helperText="Email address is linked to your primary login account."
                  />
                </Stack>

                <Box mt={4} display="flex" justifyContent="flex-end">
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={savingProfile || !fullName.trim()}
                    startIcon={<Save size={18} />}
                    sx={{ fontWeight: 700, px: 3, py: 1.2, borderRadius: 2 }}
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </Box>
              </CardContent>
            </form>
          </Card>
        </Grid>

        {/* Right Column: Change Password & Security */}
        <Grid item xs={12} lg={5}>
          <Card elevation={8} sx={{ borderRadius: 3 }}>
            <form onSubmit={handleChangePassword}>
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                  <Lock size={22} color={theme.palette.primary.main} />
                  <Typography variant="h4" fontWeight={700}>
                    Security &amp; Password
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Update your login password to keep your school planner account secure.
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Stack spacing={2.5}>
                  <TextField
                    fullWidth
                    type="password"
                    label="New Password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    type="password"
                    label="Confirm New Password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Stack>

                <Box mt={4}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    disabled={updatingPassword || !newPassword}
                    startIcon={<Key size={18} />}
                    sx={{ fontWeight: 700, py: 1.2, borderRadius: 2 }}
                  >
                    {updatingPassword ? 'Updating Password...' : 'Update Password'}
                  </Button>
                </Box>
              </CardContent>
            </form>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
