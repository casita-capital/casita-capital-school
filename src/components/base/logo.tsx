'use client';

import { Box, Typography } from '@mui/material';
import { GraduationCap } from 'lucide-react';
import { useSchoolSettings } from 'src/contexts/school-settings';
import { RouterLink } from './router-link';

export function Logo() {
  const { schoolName } = useSchoolSettings();

  return (
    <RouterLink
      href="/"
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #0C74E4 0%, #4656E8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(12, 116, 228, 0.3)',
          flexShrink: 0,
        }}
      >
        <GraduationCap size={22} />
      </Box>
      <Box display="flex" flexDirection="column" overflow="hidden">
        <Typography
          variant="h6"
          noWrap
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: '-0.02rem',
            lineHeight: 1.1,
          }}
        >
          {schoolName}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'primary.main',
            letterSpacing: '0.05rem',
            lineHeight: 1.1,
          }}
        >
          School &amp; Calendar
        </Typography>
      </Box>
    </RouterLink>
  );
}
