import { darken, getContrastRatio, lighten, type NeutralColors } from '@mui/material/styles';

export type ThemeColor = {
  main: string;
  light: string;
  dark: string;
  darkest: string;
  contrastText: string;
};

export type ThemeColors = {
  livingCoral: ThemeColor;
  greenery: ThemeColor;
  ultraViolet: ThemeColor;
  roseQuartz: ThemeColor;
  radiantOrchid: ThemeColor;
  tangerineTango: ThemeColor;
  emerald: ThemeColor;
  honeyGold: ThemeColor;
  monacoBlue: ThemeColor;
  darkViolet: ThemeColor;
  royalBlue: ThemeColor;
  success: ThemeColor;
  info: ThemeColor;
  warning: ThemeColor;
  error: ThemeColor;
  [key: string]: ThemeColor;
};

const common = {
  white: '#ffffff',
  black: '#171614',
  neutral: '#171614',
};

const baseColors = [
  { name: 'livingCoral', value: '#b8422e' },
  { name: 'greenery', value: '#1e6b43' },
  { name: 'ultraViolet', value: '#6c43b8' },
  { name: 'roseQuartz', value: '#b83b48' },
  { name: 'radiantOrchid', value: '#9c2d7c' },
  { name: 'tangerineTango', value: '#c2511a' },
  { name: 'emerald', value: '#0d735c' },
  { name: 'honeyGold', value: '#967210' },
  { name: 'monacoBlue', value: '#1b5698' },
  { name: 'darkViolet', value: '#7e38b7' },
  { name: 'royalBlue', value: '#2e4a8f' },
  { name: 'success', value: '#1e6f3d' },
  { name: 'info', value: '#1d6896' },
  { name: 'warning', value: '#b85d0c' },
  { name: 'error', value: '#c43235' },
];

export const adjustColorForLightTheme = (color: string) => color;
export const adjustColorForDarkTheme = (color: string) => lighten(color, 0.34);

export const generateColorScale = (mainColor: string, theme: 'light' | 'dark') => {
  const adjustedMainColor =
    theme === 'light' ? adjustColorForLightTheme(mainColor) : adjustColorForDarkTheme(mainColor);

  const contrastWithWhite = getContrastRatio(adjustedMainColor, common.white);
  const contrastWithBlack = getContrastRatio(adjustedMainColor, common.black);
  const contrastText = contrastWithWhite >= contrastWithBlack ? common.white : common.black;

  return {
    light: lighten(adjustedMainColor, 0.3),
    main: adjustedMainColor,
    dark: darken(adjustedMainColor, 0.1),
    darkest: darken(adjustedMainColor, 0.4),
    contrastText,
  };
};

export const generateThemeColors = (): {
  light: ThemeColors;
  dark: ThemeColors;
} => {
  const themeColors: { light: ThemeColors; dark: ThemeColors } = {
    light: {} as ThemeColors,
    dark: {} as ThemeColors,
  };

  baseColors.forEach((color) => {
    themeColors.light[color.name] = generateColorScale(color.value, 'light');
    themeColors.dark[color.name] = generateColorScale(color.value, 'dark');
  });

  return themeColors;
};

export const neutral: NeutralColors = {
  25: '#fcfbf8',
  50: '#f7f4ee',
  100: '#efeae0',
  200: '#e2dcd0',
  300: '#cdc5b6',
  400: '#9e9688',
  500: '#787063',
  600: '#595348',
  700: '#3f3a32',
  800: '#26231e',
  900: '#171614',
};

const { light: lightThemeColors, dark: darkThemeColors } = generateThemeColors();

export const lightTheme: ThemeColors = lightThemeColors;
export const darkTheme: ThemeColors = darkThemeColors;
