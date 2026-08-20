'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Logo } from 'src/components/base/logo';
import { createClient } from 'src/services/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleQuickFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('password');
    setErrorMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(`Login failed: ${error.message}`);
      } else if (data.session) {
        toast.success('Successfully logged in!');
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(errText);
      toast.error(errText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 450,
        px: 2,
        py: 6,
      }}
    >
      <Card elevation={12} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3} textAlign="center">
            <Box mb={2}>
              <Logo />
            </Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage weekly school calendars &amp; tasks
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
              Quick Select User (Development Setup):
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Chip
                label="Blake Womble"
                onClick={() => handleQuickFill('blake.womble@gmail.com')}
                color={email === 'blake.womble@gmail.com' ? 'primary' : 'default'}
                variant={email === 'blake.womble@gmail.com' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, cursor: 'pointer' }}
              />
              <Chip
                label="Stephanie Womble"
                onClick={() => handleQuickFill('stephanie.womble@gmail.com')}
                color={email === 'stephanie.womble@gmail.com' ? 'primary' : 'default'}
                variant={email === 'stephanie.womble@gmail.com' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, cursor: 'pointer' }}
              />
            </Stack>
          </Box>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={18} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
