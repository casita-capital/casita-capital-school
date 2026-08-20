'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { createClient } from 'src/services/supabase/client';
import { Logo } from 'src/components/base/logo';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [statusMessage, setStatusMessage] = useState('Completing sign-in...');

  useEffect(() => {
    async function processAuth() {
      // 1. Check for URL Hash Error (#error=...&error_description=...)
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const errDesc = params.get('error_description') || params.get('error') || 'Authentication failed';
        router.push(`/login?error=${encodeURIComponent(errDesc)}`);
        return;
      }

      // 2. Check for URL Search Error (?error=...&error_description=...)
      const queryErr = searchParams.get('error_description') || searchParams.get('error');
      if (queryErr) {
        router.push(`/login?error=${encodeURIComponent(queryErr)}`);
        return;
      }

      // 3. Check for PKCE ?code=...
      const code = searchParams.get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            router.push(`/login?error=${encodeURIComponent(error.message)}`);
            return;
          }
          if (data.session?.user?.email) {
            localStorage.setItem('school_active_user_email', data.session.user.email);
            router.push('/');
            router.refresh();
            return;
          }
        } catch (err: unknown) {
          const errText = err instanceof Error ? err.message : 'Session exchange failed';
          router.push(`/login?error=${encodeURIComponent(errText)}`);
          return;
        }
      }

      // 4. Check for active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        localStorage.setItem('school_active_user_email', session.user.email);
        router.push('/');
        router.refresh();
        return;
      }

      // Fallback redirect to login
      router.push('/login');
    }

    processAuth();
  }, [router, searchParams, supabase]);

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
      <CircularProgress size={36} color="primary" />
      <Typography variant="body2" color="text.secondary" fontWeight={600}>
        {statusMessage}
      </Typography>
    </Box>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
