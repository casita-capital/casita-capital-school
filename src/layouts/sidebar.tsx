'use client';

import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, useMediaQuery, useTheme } from '@mui/material';
import { usePathname } from 'next/navigation';
import { Logo } from 'src/components/base/logo';
import { RouterLink } from 'src/components/base/router-link';
import { Scrollbar } from 'src/components/base/scrollbar';
import { getSchoolMenuItems } from 'src/router';
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
        <List component="nav" disablePadding>
          {menuItems.map((item) => {
            const active = pathname === item.link;
            return (
              <ListItemButton
                key={item.id}
                component={RouterLink}
                href={item.link || '#'}
                selected={active}
                sx={{
                  borderRadius: '6px',
                  mb: 0.5,
                  py: 1,
                  px: 2,
                  color: active ? 'primary.main' : 'text.secondary',
                  fontWeight: active ? 600 : 500,
                  '&.Mui-selected': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.12)' : 'rgba(12, 116, 228, 0.08)',
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(12, 116, 228, 0.18)' : 'rgba(12, 116, 228, 0.12)',
                    },
                  },
                }}
              >
                {item.icon && (
                  <ListItemIcon
                    sx={{
                      minWidth: 32,
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
          })}
        </List>
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
