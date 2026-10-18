import type { Direction, ThemeOptions } from '@mui/material';
import { BORDER_RADIUS } from '../utils';
import { createComponents } from './create-components';
import { createTypography, type HeadingFontPreset } from './create-typography';

interface ComponentsConfig {
  direction?: Direction;
  headingFont?: HeadingFontPreset;
}

export const createOptions = (config: ComponentsConfig): ThemeOptions => {
  const { direction = 'ltr', headingFont = 'inter' } = config;

  return {
    components: createComponents(),
    direction,
    spacing: 8,
    shape: {
      borderRadius: BORDER_RADIUS,
    },
    typography: createTypography(headingFont),
  };
};
