import type { PaletteColor } from '@mui/material/styles/createPalette';
import { darkTheme, lightTheme } from './colors';
import type { ColorPreset } from './index';

export const getPrimaryDark = (preset?: ColorPreset): PaletteColor => {
  if (!preset) {
    return darkTheme.royalBlue as unknown as PaletteColor;
  }
  const key = preset.replace('-', '') as keyof typeof darkTheme;
  const color = (darkTheme as Record<string, unknown>)[key];
  return (color ? color : darkTheme.royalBlue) as unknown as PaletteColor;
};

export const getPrimary = (preset?: ColorPreset): PaletteColor => {
  if (!preset) {
    return lightTheme.royalBlue as unknown as PaletteColor;
  }
  const key = preset.replace('-', '') as keyof typeof lightTheme;
  const color = (lightTheme as Record<string, unknown>)[key];
  return (color ? color : lightTheme.royalBlue) as unknown as PaletteColor;
};

export const SIDEBAR_WIDTH = 288;
export const SIDEBAR_WIDTH_COLLAPSED = 98;
export const HEADER_HEIGHT = 54;

export const BORDER_RADIUS = 6;
export const SPACING_UNIT = 8;
