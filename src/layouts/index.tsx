'use client';

import { Box } from '@mui/material';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from 'src/theme/utils';
import { Header } from './header';
import { Sidebar } from './sidebar';

interface LayoutProps {
  children?: ReactNode;
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/login') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Sidebar
        openMobile={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <Header onMobileNavOpen={() => setMobileNavOpen(true)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: `${HEADER_HEIGHT + 24}px`,
          pb: 4,
          px: { xs: 2, sm: 3, md: 4 },
          ml: { lg: `${SIDEBAR_WIDTH}px` },
          width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
          '@media print': {
            ml: '0 !important',
            width: '100% !important',
            pt: '0 !important',
            pb: '0 !important',
            px: '0 !important',
            backgroundColor: '#ffffff !important',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
