'use client';

import { Box, styled } from '@mui/material';
import type { FC, ReactNode } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

const SimpleBarWrapper = styled(SimpleBar)(() => ({
  maxHeight: '100%',
  '& .simplebar-scrollbar': {
    '&:before': {
      background: 'rgba(255, 255, 255, 0.2)',
    },
    '&.simplebar-visible:before': {
      opacity: 1,
    },
  },
  '& .simplebar-track.simplebar-vertical': {
    width: 9,
  },
  '& .simplebar-track.simplebar-horizontal': {
    height: 9,
  },
  '& .simplebar-mask': {
    zIndex: 'inherit',
  },
}));

interface ScrollbarProps {
  children?: ReactNode;
  className?: string;
  sx?: object;
}

export const Scrollbar: FC<ScrollbarProps> = ({ children, className, sx, ...other }) => {
  return (
    <SimpleBarWrapper className={className} sx={sx} {...other}>
      {children}
    </SimpleBarWrapper>
  );
};
