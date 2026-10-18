'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  alpha,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
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
  Clock,
  History,
  Type,
  GraduationCap,
  X,
} from 'lucide-react';
import { useCustomization } from 'src/hooks/use-customization';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from 'src/theme/utils';
import { createClient } from 'src/services/supabase/client';
import { RouterLink } from 'src/components/base/router-link';
import { ItemIcon } from 'src/components/base/item-icon';
import {
  clearCachedActiveUser,
  resolveAndSyncActiveUser,
} from 'src/utils/active-user';
import type { ColorPreset, HeadingFontPreset } from 'src/theme';
import { HEADING_FONT_STACKS } from 'src/theme/base/create-typography';

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
  shortLabel: string;
  color: string;
}

interface HeadingFontOption {
  key: HeadingFontPreset;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
}

export const colorPresetOptions: ColorPresetOption[] = [
  { key: 'monacoBlue', label: 'Oxford Blue', shortLabel: 'Oxford', color: '#1b5698' },
  { key: 'emerald', label: 'Academy Pine', shortLabel: 'Pine', color: '#0d735c' },
  { key: 'livingCoral', label: 'Terracotta Ink', shortLabel: 'Terracotta', color: '#b8422e' },
  { key: 'greenery', label: 'Botanical Sage', shortLabel: 'Sage', color: '#1e6b43' },
  { key: 'honeyGold', label: 'Gilded Ochre', shortLabel: 'Ochre', color: '#967210' },
  { key: 'royalBlue', label: 'Regent Navy', shortLabel: 'Navy', color: '#2e4a8f' },
  { key: 'ultraViolet', label: 'Classical Plum', shortLabel: 'Plum', color: '#6c43b8' },
  { key: 'roseQuartz', label: 'Crimson Seal', shortLabel: 'Crimson', color: '#b83b48' },
  { key: 'tangerineTango', label: 'Sienna Clay', shortLabel: 'Sienna', color: '#c2511a' },
  { key: 'radiantOrchid', label: 'Mulberry Ink', shortLabel: 'Mulberry', color: '#9c2d7c' },
  { key: 'darkViolet', label: 'Byzantine Violet', shortLabel: 'Violet', color: '#7e38b7' },
];

export const headingFontOptions: HeadingFontOption[] = [
  {
    key: 'inter',
    label: 'Inter (Original Smooth)',
    shortLabel: 'Inter',
    badge: 'Original',
    description: 'Crisp, ultra-smooth neo-grotesque with tight tracking — the original font.',
  },
  {
    key: 'plusJakarta',
    label: 'Plus Jakarta Sans',
    shortLabel: 'Jakarta',
    badge: 'Warm Modern',
    description: 'Smooth geometric curves with friendly open terminals on "a", "y", and "g".',
  },
  {
    key: 'outfit',
    label: 'Outfit',
    shortLabel: 'Outfit',
    badge: 'Soft Studio',
    description: 'Silky circular geometry with a modern boutique stationery planner feel.',
  },
  {
    key: 'dmSans',
    label: 'DM Sans',
    shortLabel: 'DM Sans',
    badge: 'Editorial Sans',
    description: 'Balanced low-contrast geometric sans crafted for clean, calm headings.',
  },
  {
    key: 'nunito',
    label: 'Nunito',
    shortLabel: 'Nunito',
    badge: 'Rounded',
    description: 'Smooth, gently rounded terminals that feel warm, soft, and approachable.',
  },
  {
    key: 'newsreader',
    label: 'Newsreader',
    shortLabel: 'Newsreader',
    badge: 'Classic Serif',
    description: 'High-contrast literary book serif with traditional academic serifs.',
  },
];

export function Header({ onMobileNavOpen }: HeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const customization = useCustomization();
  const { schoolName } = useSchoolSettings();
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [fontModalOpen, setFontModalOpen] = useState(false);

  const activeMode = customization.paletteMode || 'dark';
  const activePreset = customization.colorPreset || 'monacoBlue';
  const activeHeadingFont: HeadingFontPreset = customization.headingFont || 'inter';
  const displaySchoolName = schoolName || "Audrey's Planner";

  useEffect(() => {
    async function loadUser() {
      const resolved = await resolveAndSyncActiveUser(supabase);
      if (!resolved) {
        setProfile(null);
        return;
      }
      setProfile({
        full_name: resolved.fullName,
        email: resolved.email,
        role: resolved.role,
        avatar_url: resolved.avatarUrl,
      });
    }

    loadUser();

    const handleProfileUpdated = () => {
      loadUser();
    };

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('school_user_profile_updated', handleProfileUpdated);
    }

    return () => {
      authSub.subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('school_user_profile_updated', handleProfileUpdated);
      }
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

  const handleSelectHeadingFont = (headingFont: HeadingFontPreset) => {
    customization.handleUpdate({ headingFont });
  };

  const handleSignOut = async () => {
    handleCloseMenu();
    clearCachedActiveUser();
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
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <IconButton
          aria-label="Open navigation menu"
          onClick={onMobileNavOpen}
          sx={{ display: { lg: 'none' }, mr: 1, color: 'text.primary' }}
        >
          <MenuIcon size={20} />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        <Box display="flex" alignItems="center" gap={1.5}>
          {/* Link to Daily Timeline page (/today) */}
          <Button
            component={RouterLink}
            href="/today"
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<Clock size={16} />}
            sx={{
              fontWeight: 600,
              borderRadius: 1,
              textTransform: 'none',
              px: 1.5,
              py: 0.75,
              fontSize: '0.875rem',
            }}
          >
            Daily Timeline
          </Button>

          {/* Accessible Avatar Dropdown Trigger Pill */}
          <ButtonBase
            onClick={handleOpenMenu}
            aria-label="Open user profile and theme settings menu"
            aria-haspopup="true"
            aria-expanded={Boolean(menuAnchorEl)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 0.75,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: 'border-color 0.15s ease-in-out, background-color 0.15s ease-in-out',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
              },
              '&.Mui-focusVisible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <Avatar
              src={profile?.avatar_url && (profile.avatar_url.startsWith('data:') || profile.avatar_url.startsWith('http')) ? profile.avatar_url : undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.75rem',
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
              <Typography variant="body2" fontWeight={600} color="text.primary" lineHeight={1.2}>
                {profile ? (profile.full_name.includes('@') ? profile.full_name.split('@')[0] : profile.full_name) : 'Parent User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                {profile ? profile.role.toUpperCase() : 'Theme & Account'}
              </Typography>
            </Box>
          </ButtonBase>

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
                width: 340,
                borderRadius: 1,
                p: 2,
                boxShadow: 8,
                border: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            {/* Header: User Account Info */}
            <Box sx={{ pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} color="text.primary">
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
                fontWeight: 600,
                borderRadius: 1,
                justifyContent: 'space-between',
                my: 1,
                py: 0.75,
              }}
            >
              Edit User Profile
            </Button>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 1: Palette Mode Selection (Light / Dark) */}
            <Typography variant="overline" color="text.secondary" mb={1} display="block">
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
                sx={{ borderRadius: 1, fontWeight: 600, textTransform: 'none' }}
              >
                Warm Paper (Light)
              </Button>
              <Button
                fullWidth
                variant={activeMode === 'dark' ? 'contained' : 'outlined'}
                color={activeMode === 'dark' ? 'primary' : 'inherit'}
                size="small"
                startIcon={<Moon size={16} />}
                onClick={() => handleSelectMode('dark')}
                sx={{ borderRadius: 1, fontWeight: 600, textTransform: 'none' }}
              >
                Study Slate (Dark)
              </Button>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 2: Header Typography Preset */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="overline" color="text.secondary">
                Header &amp; Logo Font
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  handleCloseMenu();
                  setFontModalOpen(true);
                }}
                sx={{ py: 0, px: 0.75, minWidth: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
              >
                Compare Mockups
              </Button>
            </Box>
            <Grid container spacing={1} mb={2} role="radiogroup" aria-label="Header Font">
              {headingFontOptions.map((fontOpt) => {
                const isSelected = activeHeadingFont === fontOpt.key;
                const stack = HEADING_FONT_STACKS[fontOpt.key];
                return (
                  <Grid item xs={6} key={fontOpt.key}>
                    <ButtonBase
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectHeadingFont(fontOpt.key)}
                      sx={{
                        width: '100%',
                        p: 0.75,
                        px: 1,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography
                        noWrap
                        sx={{
                          fontFamily: stack.family,
                          fontWeight: stack.weight,
                          letterSpacing: stack.tracking,
                          fontSize: '0.75rem',
                        }}
                      >
                        {fontOpt.shortLabel}
                      </Typography>
                      {isSelected && <Check size={12} color={theme.palette.primary.main} />}
                    </ButtonBase>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 3: Accent Color Presets */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="overline" color="text.secondary">
                Academy Accent Ink
              </Typography>
              <Palette size={14} color={theme.palette.primary.main} />
            </Box>
            <Grid container spacing={1} mb={2} role="radiogroup" aria-label="Academy Accent Ink">
              {colorPresetOptions.map((option) => {
                const isSelected = activePreset === option.key;
                return (
                  <Grid item xs={4} key={option.key}>
                    <Tooltip title={option.label} arrow placement="top">
                      <ButtonBase
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={option.label}
                        onClick={() => handleSelectPreset(option.key)}
                        sx={{
                          width: '100%',
                          p: 0.75,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 0.75,
                          border: '1px solid',
                          borderColor: isSelected ? option.color : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'transparent',
                          transition: 'background-color 0.15s ease, border-color 0.15s ease',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                          '&.Mui-focusVisible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: 1,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: option.color,
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="caption" fontWeight={isSelected ? 700 : 500} noWrap sx={{ fontSize: '0.75rem' }}>
                          {option.shortLabel}
                        </Typography>
                        {isSelected && <Check size={12} color={option.color} style={{ marginLeft: 'auto' }} />}
                      </ButtonBase>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ my: 1.5 }} />

            {/* Section 4: Navigation Links & Sign Out */}
            <MenuItem
              component={RouterLink}
              href="/audit-log"
              onClick={handleCloseMenu}
              sx={{ borderRadius: 1, gap: 1.5, py: 1 }}
            >
              <History size={18} />
              <Typography variant="body2" fontWeight={600}>
                Audit Log &amp; Change History
              </Typography>
            </MenuItem>

            <MenuItem
              component={RouterLink}
              href="/settings"
              onClick={handleCloseMenu}
              sx={{ borderRadius: 1, gap: 1.5, py: 1 }}
            >
              <Settings size={18} />
              <Typography variant="body2" fontWeight={600}>
                Full Settings &amp; Preferences
              </Typography>
            </MenuItem>

            {profile ? (
              <MenuItem onClick={handleSignOut} sx={{ borderRadius: 1, gap: 1.5, py: 1, color: 'error.main' }}>
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
                sx={{ borderRadius: 1, gap: 1.5, py: 1, color: 'primary.main' }}
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

      {/* LIVE HEADER TYPOGRAPHY MOCKUP GALLERY MODAL */}
      <Dialog
        open={fontModalOpen}
        onClose={() => setFontModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Type size={20} color={theme.palette.primary.main} />
            <span>Header &amp; Brand Typography Mockups</span>
          </Stack>
          <IconButton
            size="small"
            aria-label="Close typography mockups dialog"
            onClick={() => setFontModalOpen(false)}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Click any font mockup below to immediately apply it to{' '}
            <strong>{displaySchoolName}</strong> in the sidebar and all page headers across the system.
          </Typography>
          <Grid container spacing={2}>
            {headingFontOptions.map((opt) => {
              const isSelected = activeHeadingFont === opt.key;
              const stack = HEADING_FONT_STACKS[opt.key];
              return (
                <Grid item xs={12} sm={6} key={opt.key}>
                  <Paper
                    elevation={0}
                    onClick={() => handleSelectHeadingFont(opt.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectHeadingFont(opt.key);
                      }
                    }}
                    sx={{
                      p: 2,
                      height: '100%',
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: '1.5px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.06)
                        : 'background.paper',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      mb={1.5}
                    >
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        {opt.label}
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Chip
                          label={opt.badge}
                          size="small"
                          color={isSelected ? 'primary' : 'default'}
                          sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700, borderRadius: 1 }}
                        />
                        {isSelected && <Check size={15} color={theme.palette.primary.main} />}
                      </Stack>
                    </Stack>

                    {/* Mock Sidebar Brand Mark */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.25,
                        mb: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: 1,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <GraduationCap size={18} />
                      </Box>
                      <Box minWidth={0}>
                        <Typography
                          noWrap
                          sx={{
                            fontFamily: stack.family,
                            fontWeight: stack.weight,
                            letterSpacing: stack.tracking,
                            fontSize: '1.125rem',
                            lineHeight: 1.15,
                          }}
                        >
                          {displaySchoolName}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          Academic Planner &amp; Records
                        </Typography>
                      </Box>
                    </Box>

                    {/* Mock Page Header & Section Header */}
                    <Typography
                      sx={{
                        fontFamily: stack.family,
                        fontWeight: stack.weight,
                        letterSpacing: stack.tracking,
                        fontSize: '1.35rem',
                        lineHeight: 1.25,
                        mb: 0.5,
                      }}
                    >
                      Weekly Time Grid
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: stack.family,
                        fontWeight: stack.weight,
                        letterSpacing: stack.tracking,
                        fontSize: '0.9375rem',
                        color: 'text.secondary',
                        mb: 1,
                      }}
                    >
                      Today&apos;s Schedule — Monday, Oct 19
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {opt.description}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setFontModalOpen(false)} sx={{ fontWeight: 700 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}
