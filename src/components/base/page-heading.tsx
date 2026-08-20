'use client';

import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeadingProps {
  heading: string;
  caption?: string;
  actions?: ReactNode;
}

export function PageHeading({ heading, caption, actions }: PageHeadingProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
          {heading}
        </Typography>
        {caption && (
          <Typography variant="subtitle1" color="text.secondary">
            {caption}
          </Typography>
        )}
      </Box>
      {actions && <Box>{actions}</Box>}
    </Box>
  );
}
