'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, CircularProgress, Typography, Alert } from '@mui/material';
import { createClient } from 'src/services/supabase/client';
import { Logo } from 'src/components/base/logo';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    async function processAuth() {
      // Check for custom return URL e.g. ?next=/settings
      const nextUrl = searchParams.get('next') || searchParams.get('redirect') || '/';

      // 1. Check for URL Hash Error (#error=...&error_description=...)
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const errDesc =
          params.get('error_description') ||
          params.get('error_code') ||
          params.get('error') ||
          'Authentication failed';
        setErrorDetails(decodeURIComponent(errDesc));
        return;
      }

      // 2. Check for URL Search Error (?error=...&error_description=...)
      const queryErr = searchParams.get('error_description') || searchParams.get('error_code') || searchParams.get('error');
      if (queryErr) {
        setErrorDetails(decodeURIComponent(queryErr));
        return;
      }

      // 3. Check for active Supabase session (handles Implicit flow #access_token and PKCE session)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        localStorage.setItem('school_active_user_email', session.user.email);
        if (session.provider_token) {
          localStorage.setItem('google_provider_token', session.provider_token);
        }
        router.push(nextUrl);
        router.refresh();
        return;
      }

      // 4. Check for PKCE ?code=...
      const code = searchParams.get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session?.user?.email) {
            localStorage.setItem('school_active_user_email', data.session.user.email);
            if (data.session.provider_token) {
              localStorage.setItem('google_provider_token', data.session.provider_token);
            }
            router.push(nextUrl);
            router.refresh();
            return;
          }
        } catch {
          // Ignore exchange error if session was created
        }

        // Retry session check
        const { data: retryData } = await supabase.auth.getSession();
        if (retryData.session?.user?.email) {
          localStorage.setItem('school_active_user_email', retryData.session.user.email);
          if (retryData.session.provider_token) {
            localStorage.setItem('google_provider_token', retryData.session.provider_token);
          }
          router.push(nextUrl);
          router.refresh();
          return;
        }
      }

      // If no session found after attempts, show fallback error
      setErrorDetails('Authentication session could not be established. Please try logging in again.');
    }

    processAuth();
  }, [router, searchParams, supabase]);

  if (errorDetails) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Card elevation={8} sx={{ maxWidth: 500, width: '100%', borderRadius: 3 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Box mb={2} display="flex" justifyContent="center">
              <Logo />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Google Sign-In Error
            </Typography>
            <Alert severity="error" sx={{ my: 3, textAlign: 'left', borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {errorDetails}
              </Typography>
            </Alert>
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/login')}
              sx={{ fontWeight: 700, mt: 1 }}
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
        Completing Google sign-in...
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
