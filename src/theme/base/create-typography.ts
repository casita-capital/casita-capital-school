import type { TypographyOptions } from '@mui/material/styles/createTypography';

export type HeadingFontPreset =
  | 'inter'
  | 'plusJakarta'
  | 'outfit'
  | 'dmSans'
  | 'nunito'
  | 'newsreader';

export const HEADING_FONT_STACKS: Record<
  HeadingFontPreset,
  { family: string; weight: number; tracking: string }
> = {
  inter: {
    family:
      'var(--font-sans), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    weight: 700,
    tracking: '-0.025em',
  },
  plusJakarta: {
    family:
      'var(--font-jakarta), "Plus Jakarta Sans", var(--font-sans), -apple-system, sans-serif',
    weight: 700,
    tracking: '-0.02em',
  },
  outfit: {
    family:
      'var(--font-outfit), "Outfit", var(--font-sans), -apple-system, sans-serif',
    weight: 700,
    tracking: '-0.015em',
  },
  dmSans: {
    family:
      'var(--font-dmsans), "DM Sans", var(--font-sans), -apple-system, sans-serif',
    weight: 700,
    tracking: '-0.02em',
  },
  nunito: {
    family:
      'var(--font-nunito), "Nunito", var(--font-sans), -apple-system, sans-serif',
    weight: 800,
    tracking: '-0.01em',
  },
  newsreader: {
    family:
      'var(--font-serif), "Newsreader", Georgia, "Times New Roman", serif',
    weight: 600,
    tracking: '-0.015em',
  },
};

export const createTypography = (
  headingFont: HeadingFontPreset = 'inter'
): TypographyOptions => {
  const sansStack =
    'var(--font-sans), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';
  const activeHeading = HEADING_FONT_STACKS[headingFont] || HEADING_FONT_STACKS.inter;

  return {
    fontFamily: sansStack,
    body1: {
      fontSize: '0.9375rem',
      fontWeight: 400,
      lineHeight: 1.55,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.45,
      textTransform: 'none',
    },
    subtitle1: {
      fontSize: '0.95rem',
      fontWeight: 600,
      lineHeight: 1.45,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.45,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 700,
      lineHeight: 1.8,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    h1: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '2.5rem',
      lineHeight: 1.15,
      letterSpacing: activeHeading.tracking,
    },
    h2: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '1.9rem',
      lineHeight: 1.2,
      letterSpacing: activeHeading.tracking,
    },
    h3: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '1.5rem',
      lineHeight: 1.25,
      letterSpacing: activeHeading.tracking,
    },
    h4: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '1.35rem',
      lineHeight: 1.3,
      letterSpacing: activeHeading.tracking,
    },
    h5: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '1.125rem',
      lineHeight: 1.35,
      letterSpacing: activeHeading.tracking,
    },
    h6: {
      fontFamily: activeHeading.family,
      fontWeight: activeHeading.weight,
      fontSize: '0.95rem',
      lineHeight: 1.4,
      letterSpacing: activeHeading.tracking,
    },
  };
};
