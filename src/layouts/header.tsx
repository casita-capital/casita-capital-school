'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Sun,
  Moon,
  LogOut,
  User,
  Check,
  Settings,
  Palette,
  ArrowRight,
} from 'lucide-react';
import { useCustomization } from 'src/hooks/use-customization';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from 'src/theme/utils';
import { createClient } from 'src/services/supabase/client';
import { RouterLink } from 'src/components/base/router-link';
import { ItemIcon } from 'src/components/base/item-icon';
import type { ColorPreset } from 'src/theme';

interface HeaderProps {
  onMobileNavOpen: () => void;
}

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface ColorPresetOption {
  key: ColorPreset;
  label: string;
  color: string;
}

export const colorPresetOptions: ColorPresetOption[] = [
  { key: 'monacoBlue', label: 'Monaco Blue', color: '#0C74E4' },
  { key: 'emerald', label: 'Emerald', color: '#02876f' },
  { key: 'livingCoral', label: 'Living Coral', color: '#ea2012' },
  { key: 'greenery', label: 'Greenery', color: '#018a3c' },
  { key: 'ultraViolet', label: 'Ultra Violet', color: '#894AE0' },
  { key: 'roseQuartz', label: 'Rose Quartz', color: '#da3c42' },
  { key: 'radiantOrchid', label: 'Radiant Orchid', color: '#d427af' },
  { key: 'tangerineTango', label: 'Tangerine Tango', color: '#cf4c10' },
  { key: 'honeyGold', label: 'Honey Gold', color: '#967210' },
  { key: 'darkViolet', label: 'Dark Violet', color: '#B741FB' },
  { key: 'royalBlue', label: 'Royal Blue', color: '#4656E8' },
];

export function Header({ onMobileNavOpen }: HeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const customization = useCustomization();
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  const activeMode = customization.paletteMode || 'dark';
  const activePreset = customization.colorPreset || 'monacoBlue';

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      const activeEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('school_active_user_email') : null) || 'blake.womble@gmail.com';

      if (user?.id) {
        const { data: byAuthId } = await supabase
          .from('users')
          .select('full_name, email, role, avatar_url')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (byAuthId) {
          setProfile(byAuthId as UserProfile);
          return;
        }
      }

      if (activeEmail) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('full_name, email, role, avatar_url')
          .eq('email', activeEmail)
          .maybeSingle();

        if (byEmail) {
          setProfile(byEmail as UserProfile);
          return;
        }
      }

      // Default fallback
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('full_name, email, role, avatar_url')
        .eq('email', 'blake.womble@gmail.com')
        .maybeSingle();

      if (fallbackUser) {
        setProfile(fallbackUser as UserProfile);
      } else {
        setProfile({
          full_name: 'Blake Womble',
          email: 'blake.womble@gmail.com',
          role: 'admin',
        });
      }
    }

    loadUser();

    const handleProfileUpdated = () => {
      loadUser();
    };

    window.addEventListener('school_user_profile_updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('school_user_profile_updated', handleProfileUpdated);
    };
  }, [supabase]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleSelectMode = (mode: 'light' | 'dark') => {
    customization.handleUpdate({ paletteMode: mode });
  };

  const handleSelectPreset = (preset: ColorPreset) => {
    customization.handleUpdate({ colorPreset: preset });
  };

  const handleSignOut = async () => {
    handleCloseMenu();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('school_active_user_email');
    }
    await supabase.auth.signOut();
    setProfile(null);
    router.push('/login');
    router.refresh();
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <AppBar
      className="no-print"
      elevation={0}
      sx={{
        height: HEADER_HEIGHT,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        left: { lg: `${SIDEBAR_WIDTH}px` },
        width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
      }}
    >
      <Toolbar
        sx={{
          minHeight: `${HEADER_HEIGHT}px !important`,
          px: { xs: 2, sm: 3 },
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
        }}
      >
        <IconButton
          onClick={onMobileNavOpen}
          sx={{ display: { lg: 'none' }, mr: 1, color: 'text.primary' }}
        >
          <MenuIcon size={20} />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        <Box display="flex" alignItems="center" gap={1}>
          {/* Avatar Dropdown Trigger Pill */}
          <Box
            onClick={handleOpenMenu}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              p: 0.75,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: 'all 0.15s ease-in-out',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
              },
            }}
          >
            <Avatar
              src={profile?.avatar_url && (profile.avatar_url.startsWith('data:') || profile.avatar_url.startsWith('http')) ? profile.avatar_url : undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {profile && (!profile.avatar_url || (!profile.avatar_url.startsWith('data:') && !profile.avatar_url.startsWith('http'))) ? (
                profile.avatar_url && profile.avatar_url !== 'User' ? (
                  <ItemIcon name={profile.avatar_url} size={16} color="#ffffff" />
                ) : (
                  getInitials(profile.full_name)
                )
              ) : null}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', pr: 0.5 }}>
              <Typography variant="body2" fontWeight={700} color="text.primary" lineHeight={1.2}>
                {profile ? (profile.full_name.includes('@') ? profile.full_name.split('@')[0] : profile.full_name) : 'Parent User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1}>
                {profile ? profile.role.toUpperCase() : 'Click to customize theme'}
              </Typography>
            </Box>
          </Box>

          {/* User & Theme Customizer Dropdown Menu */}
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                mt: 1,
                width: 320,
                borderRadius: 3,
                p: 2,
                boxShadow: 12,
                border: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            {/* Header: User Account Info */}
            <Box sx={{ pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                {profile ? (profile.full_name.includes('@') ? profile.full_name.split('@')[0] : profile.full_name) : 'Parent User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {profile ? profile.email : ''}
              </Typography>
            </Box>

            {/* Edit User Profile Button */}
            <Button
              component={RouterLink}
              href="/profile"
              onClick={handleCloseMenu}
              variant="outlined"
              color="primary"
              fullWidth
              size="small"
              startIcon={<User size={16} />}
              endIcon={<ArrowRight size={14} />}
              sx={{
                fontWeight: 700,
                borderRadius: 2,
                justifyContent: 'space-between',
                my: 1,
                py: 0.8,
              }}
            >
              Edit User Profile
            </Button>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 1: Palette Mode Selection (Light / Dark) */}
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} mb={1} display="block">
              Theme Mode
            </Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <Button
                fullWidth
                variant={activeMode === 'light' ? 'contained' : 'outlined'}
                color={activeMode === 'light' ? 'primary' : 'inherit'}
                size="small"
                startIcon={<Sun size={16} />}
                onClick={() => handleSelectMode('light')}
                sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
              >
                Light
              </Button>
              <Button
                fullWidth
                variant={activeMode === 'dark' ? 'contained' : 'outlined'}
                color={activeMode === 'dark' ? 'primary' : 'inherit'}
                size="small"
                startIcon={<Moon size={16} />}
                onClick={() => handleSelectMode('dark')}
                sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
              >
                Dark
              </Button>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 2: Accent Color Presets */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
                Accent Color Presets
              </Typography>
              <Palette size={14} color={theme.palette.primary.main} />
            </Box>
            <Grid container spacing={1} mb={2}>
              {colorPresetOptions.map((option) => {
                const isSelected = activePreset === option.key;
                return (
                  <Grid item xs={4} key={option.key}>
                    <Tooltip title={option.label} arrow placement="top">
                      <Box
                        onClick={() => handleSelectPreset(option.key)}
                        sx={{
                          p: 0.75,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          border: '1.5px solid',
                          borderColor: isSelected ? option.color : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'transparent',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            bgcolor: 'action.hover',
                            transform: 'scale(1.02)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: option.color,
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="caption" fontWeight={isSelected ? 700 : 500} noWrap sx={{ fontSize: '0.75rem' }}>
                          {option.label.split(' ')[0]}
                        </Typography>
                        {isSelected && <Check size={12} color={option.color} style={{ marginLeft: 'auto' }} />}
                      </Box>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 3: Navigation Links & Sign Out */}
            <MenuItem
              component={RouterLink}
              href="/settings"
              onClick={handleCloseMenu}
              sx={{ borderRadius: 1.5, gap: 1.5, py: 1 }}
            >
              <Settings size={18} />
              <Typography variant="body2" fontWeight={600}>
                Full Settings &amp; Preferences
              </Typography>
            </MenuItem>

            {profile ? (
              <MenuItem onClick={handleSignOut} sx={{ borderRadius: 1.5, gap: 1.5, py: 1, color: 'error.main' }}>
                <LogOut size={18} />
                <Typography variant="body2" fontWeight={600}>
                  Sign Out
                </Typography>
              </MenuItem>
            ) : (
              <MenuItem
                component={RouterLink}
                href="/login"
                onClick={handleCloseMenu}
                sx={{ borderRadius: 1.5, gap: 1.5, py: 1, color: 'primary.main' }}
              >
                <User size={18} />
                <Typography variant="body2" fontWeight={600}>
                  Sign In
                </Typography>
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
