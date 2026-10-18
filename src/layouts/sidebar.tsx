'use client';

import { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Logo } from 'src/components/base/logo';
import { RouterLink } from 'src/components/base/router-link';
import { Scrollbar } from 'src/components/base/scrollbar';
import { getSchoolMenuItems } from 'src/router';
import type { MenuItem } from 'src/router/menuItem';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from 'src/theme/utils';

interface SidebarProps {
  openMobile: boolean;
  onCloseMobile: () => void;
}

const SETUP_EXPANDED_STORAGE_KEY = 'school_sidebar_setup_expanded';

export function Sidebar({ openMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const menuItems = getSchoolMenuItems();

  const dailyItems = menuItems.filter((item) => item.section !== 'setup');
  const setupItems = menuItems.filter((item) => item.section === 'setup');
  const isSetupRouteActive = setupItems.some((item) => item.link === pathname);
  const [setupExpanded, setSetupExpanded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETUP_EXPANDED_STORAGE_KEY);
      if (saved !== null) {
        setSetupExpanded(saved === 'true');
      } else {
        setSetupExpanded(isSetupRouteActive);
      }
    } catch {
      setSetupExpanded(isSetupRouteActive);
    }
  }, [isSetupRouteActive]);

  const handleToggleSetup = () => {
    setSetupExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SETUP_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const renderNavItem = (item: MenuItem) => {
    const active = pathname === item.link;
    return (
      <ListItemButton
        key={item.id}
        component={RouterLink}
        href={item.link || '#'}
        selected={active}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          py: 1,
          px: 1.5,
          color: active ? 'primary.main' : 'text.secondary',
          fontWeight: active ? 600 : 500,
          '&.Mui-selected': {
            bgcolor: (t) =>
              alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.1),
            color: 'primary.main',
            '&:hover': {
              bgcolor: (t) =>
                alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.24 : 0.14),
            },
          },
        }}
      >
        {item.icon && (
          <ListItemIcon
            sx={{
              minWidth: 30,
              color: active ? 'primary.main' : 'text.secondary',
            }}
          >
            {item.icon}
          </ListItemIcon>
        )}
        <ListItemText
          primary={item.name}
          primaryTypographyProps={{
            fontSize: '0.875rem',
            fontWeight: 'inherit',
          }}
        />
      </ListItemButton>
    );
  };

  const content = (
    <Box display="flex" flexDirection="column" height="100%">
      <Box
        sx={{
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          px: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Logo />
      </Box>
      <Scrollbar sx={{ flexGrow: 1, py: 2, px: 2 }}>
        <Typography
          variant="overline"
          sx={{
            px: 1.5,
            pb: 1,
            display: 'block',
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            lineHeight: 1.4,
            color: 'text.secondary',
          }}
        >
          Daily Planning
        </Typography>
        <List component="nav" aria-label="Daily Planning" disablePadding>
          {dailyItems.map(renderNavItem)}
        </List>

        <Divider sx={{ my: 2 }} />

        <ListItemButton
          onClick={handleToggleSetup}
          aria-expanded={setupExpanded || isSetupRouteActive}
          sx={{
            borderRadius: 1,
            py: 0.75,
            px: 1.5,
            mb: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: '0.06em',
              lineHeight: 1.4,
              color: isSetupRouteActive ? 'primary.main' : 'text.secondary',
            }}
          >
            Curriculum &amp; Setup
          </Typography>
          <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
            {setupExpanded || isSetupRouteActive ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </Box>
        </ListItemButton>

        {(setupExpanded || isSetupRouteActive) && (
          <List component="nav" aria-label="Curriculum and Setup" disablePadding>
            {setupItems.map(renderNavItem)}
          </List>
        )}
      </Scrollbar>
    </Box>
  );

  if (isDesktop) {
    return (
      <Drawer
        className="no-print"
        anchor="left"
        open
        variant="persistent"
        PaperProps={{
          className: 'no-print',
          sx: {
            width: SIDEBAR_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      className="no-print"
      anchor="left"
      onClose={onCloseMobile}
      open={openMobile}
      variant="temporary"
      PaperProps={{
        className: 'no-print',
        sx: {
          width: SIDEBAR_WIDTH,
          bgcolor: 'background.paper',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
