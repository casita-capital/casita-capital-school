'use client';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { GraduationCap } from 'lucide-react';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { RouterLink } from './router-link';

export function Logo() {
  const { schoolName } = useSchoolSettings();
  const theme = useTheme();

  return (
    <RouterLink
      href="/"
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: 'primary.main',
          border: '1px solid',
          borderColor: alpha(theme.palette.common.white, 0.14),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.contrastText',
          boxShadow: '0 2px 6px rgba(23, 22, 20, 0.16)',
          flexShrink: 0,
        }}
      >
        <GraduationCap size={20} />
      </Box>
      <Box display="flex" flexDirection="column" overflow="hidden">
        <Typography
          variant="h5"
          noWrap
          sx={{
            fontWeight: 600,
            fontSize: '1.125rem',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}
        >
          {schoolName}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            letterSpacing: '0.02em',
            lineHeight: 1.2,
          }}
        >
          Academic Planner &amp; Records
        </Typography>
      </Box>
    </RouterLink>
  );
}
