'use client';

import { useState } from 'react';
import {
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

export function Sidebar({ openMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const menuItems = getSchoolMenuItems();

  const dailyItems = menuItems.filter((item) => item.section !== 'setup');
  const setupItems = menuItems.filter((item) => item.section === 'setup');
  const isSetupRouteActive = setupItems.some((item) => item.link === pathname);
  const [setupExpanded, setSetupExpanded] = useState<boolean>(true);

  const renderNavItem = (item: MenuItem) => {
    const active = pathname === item.link;
    return (
      <ListItemButton
        key={item.id}
        component={RouterLink}
        href={item.link || '#'}
        selected={active}
        sx={{
          borderRadius: '6px',
          mb: 0.4,
          py: 0.9,
          px: 1.75,
          color: active ? 'primary.main' : 'text.secondary',
          fontWeight: active ? 600 : 500,
          '&.Mui-selected': {
            bgcolor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.14)' : 'rgba(12, 116, 228, 0.08)',
            color: 'primary.main',
            '&:hover': {
              bgcolor: (t) =>
                t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.2)' : 'rgba(12, 116, 228, 0.12)',
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
            fontSize: '0.86rem',
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
          variant="caption"
          sx={{
            px: 1.5,
            pb: 0.75,
            display: 'block',
            fontWeight: 700,
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'text.disabled',
          }}
        >
          Daily Planning
        </Typography>
        <List component="nav" disablePadding>
          {dailyItems.map(renderNavItem)}
        </List>

        <Divider sx={{ my: 1.75 }} />

        <ListItemButton
          onClick={() => setSetupExpanded((prev) => !prev)}
          sx={{
            borderRadius: '6px',
            py: 0.6,
            px: 1.5,
            mb: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isSetupRouteActive ? 'primary.main' : 'text.disabled',
            }}
          >
            Curriculum &amp; Setup
          </Typography>
          <Box sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>
            {setupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Box>
        </ListItemButton>

        {(setupExpanded || isSetupRouteActive) && (
          <List component="nav" disablePadding>
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
