'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Button, Snackbar, Slide } from '@mui/material';
import { RefreshCw, Sparkles } from 'lucide-react';
import { APP_BUILD_ID } from 'src/config/version';

export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const initialBuildId = APP_BUILD_ID;

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
          if (data.buildId && data.buildId !== initialBuildId) {
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

  if (!updateAvailable || dismissed) return null;

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={Slide}
      sx={{ top: { xs: 12, sm: 20 }, zIndex: (theme) => theme.zIndex.tooltip + 100 }}
    >
      <Alert
        severity="info"
        variant="filled"
        icon={<Sparkles size={20} />}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
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
        }}
      >
        A new version of Casita Capital School is available!
      </Alert>
    </Snackbar>
  );
}
