'use client';

import { Box, CircularProgress, Typography } from '@mui/material';
import type { FC, ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from 'src/theme/utils';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { createClient } from 'src/services/supabase/client';
import { Logo } from 'src/components/base/logo';

interface LayoutProps {
  children?: ReactNode;
}

export const Layout: FC<LayoutProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (pathname === '/login') {
      setAuthChecking(false);
      return;
    }

    async function checkAuth() {
      setAuthChecking(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const activeEmail =
          typeof window !== 'undefined'
            ? localStorage.getItem('school_active_user_email')
            : null;

        if (session || activeEmail) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch {
        setIsAuthenticated(false);
        router.push('/login');
      } finally {
        setAuthChecking(false);
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (pathname !== '/login') {
        const activeEmail =
          typeof window !== 'undefined'
            ? localStorage.getItem('school_active_user_email')
            : null;

        if (!session && !activeEmail) {
          setIsAuthenticated(false);
          router.push('/login');
        } else {
          setIsAuthenticated(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  // Unauthenticated / Loading fallback for login page
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

  // Show full-screen spinner while verifying authentication
  if (authChecking || !isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Logo />
        <CircularProgress size={32} color="primary" />
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Verifying session...
        </Typography>
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
