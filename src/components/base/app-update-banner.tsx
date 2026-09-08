'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Button, Snackbar, Slide } from '@mui/material';
import { RefreshCw, Sparkles } from 'lucide-react';
import { APP_BUILD_ID } from 'src/config/version';

export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Store current loaded build ID in sessionStorage on initial mount
    if (typeof window !== 'undefined') {
      if (!sessionStorage.getItem('loaded_build_id')) {
        sessionStorage.setItem('loaded_build_id', APP_BUILD_ID);
      }
    }

    const currentLoadedId =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('loaded_build_id') || APP_BUILD_ID
        : APP_BUILD_ID;

    const checkForUpdates = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (res.ok) {
          const data = (await res.json()) as { buildId?: string };
          if (data.buildId && data.buildId !== currentLoadedId) {
            setUpdateAvailable(true);
          }
        }
      } catch {
        // Ignore background check network errors
      }
    };

    // Poll every 3 minutes
    const interval = setInterval(checkForUpdates, 3 * 60 * 1000);

    // Also check immediately when window regains focus (e.g. waking PC from sleep or switching back to tab)
    const handleFocus = () => {
      checkForUpdates();
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loaded_build_id');
    }
    window.location.reload();
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <Snackbar
      className="no-print"
      open={updateAvailable}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={Slide}
      sx={{
        top: { xs: 12, sm: 20 },
        zIndex: (theme) => theme.zIndex.tooltip + 100,
        '@media print': {
          display: 'none !important',
        },
      }}
    >
      <Alert
        className="no-print"
        severity="info"
        variant="filled"
        icon={<Sparkles size={20} />}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleRefresh}
            startIcon={<RefreshCw size={14} />}
            sx={{
              fontWeight: 800,
              bgcolor: 'rgba(255, 255, 255, 0.25)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.35)' },
              ml: 1,
            }}
          >
            Refresh Page
          </Button>
        }
        onClose={() => setDismissed(true)}
        sx={{
          fontWeight: 600,
          fontSize: '0.88rem',
          boxShadow: 8,
          borderRadius: 2,
          alignItems: 'center',
          bgcolor: '#0C74E4',
          color: '#ffffff',
          '& .MuiAlert-icon': { color: '#ffffff' },
          '@media print': {
            display: 'none !important',
          },
        }}
      >
        A new version of Casita Capital School is available!
      </Alert>
    </Snackbar>
  );
}
