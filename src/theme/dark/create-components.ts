import { backdropClasses, tableCellClasses } from '@mui/material';
import { common } from '@mui/material/colors';
import { alpha, darken, lighten } from '@mui/material/styles';
import type { Components } from '@mui/material/styles/components';
import type { PaletteColor, PaletteOptions } from '@mui/material/styles/createPalette';
import { neutral } from 'src/theme/colors';

interface ComponentsConfig {
  palette: PaletteOptions;
}

export const createComponents = ({ palette }: ComponentsConfig): Components => {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none !important',
          backgroundColor: lighten(palette.neutral![900], 0.035),
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(lighten(palette.neutral![900], 0.035), 0.88),
          backdropFilter: 'blur(18px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(lighten(palette.neutral![900], 0.035), 0.88),
          backdropFilter: 'blur(18px)',
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            backgroundColor: alpha((palette.primary as PaletteColor).main, 0.12),
          },
          '&:hover  > span': {
            boxShadow: `0 0 0 3px ${alpha((palette.primary as PaletteColor).main, 0.12)} inset`,
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            backgroundColor: alpha((palette.primary as PaletteColor).main, 0.12),
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: palette.divider,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          [`& .${tableCellClasses.root}`]: {
            backgroundColor: alpha(palette.neutral![100], 0.04),
            color: palette.neutral![25],
            borderBottomColor: palette.divider,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: alpha(palette.neutral![900], 0.34),
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(palette.neutral![800], 0.16),
          boxShadow: `${alpha(palette.neutral![900], 0.64)} 0 1px 3px`,
          borderColor: palette.neutral![800],

          '&:hover': {
            backgroundColor: palette.background!.paper,
            borderColor: palette.neutral![700],
          },
          '&.Mui-focused': {
            backgroundColor: palette.background!.paper,
            borderColor: (palette.primary as PaletteColor).main,
            boxShadow: `${(palette.primary as PaletteColor).main} 0 0px 0 1px inset`,
          },
          '&.Mui-disabled': {
            backgroundColor: palette.neutral![900],
            borderColor: palette.neutral![800],
            boxShadow: `${alpha(palette.neutral![900], 0.3)} 0 1px 3px`,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          boxShadow: `${alpha(palette.neutral![900], 0.64)} 0 1px 3px`,
          backgroundColor: palette.background!.paper,

          '&:hover': {
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: palette.neutral![700],
            },
          },
        },
        notchedOutline: {
          borderColor: palette.neutral![800],
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          [`&:not(.${backdropClasses.invisible})`]: {
            backgroundColor: alpha(palette.neutral![900], 0.4),
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&:hover:not(.Mui-selected)': {
            color: palette.neutral![25],
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: palette.neutral![100],
          '&:hover': {
            backgroundColor: alpha(palette.neutral![800], 0.25),
            color: palette.neutral![100],
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          '&.MuiChip-outlined.MuiChip-colorDefault': {
            backgroundColor: alpha(common.white, 0.06),
            borderColor: alpha(common.white, 0.18),
          },
        },
        outlinedSecondary: {
          color: neutral[400],
        },
        colorPrimary: {
          backgroundColor: alpha((palette.primary as PaletteColor).main, 0.08),
          borderColor: alpha((palette.primary as PaletteColor).main, 0.3),
          color: (palette.primary as PaletteColor).light,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backdropFilter: 'blur(6px)',
          background: alpha(palette.neutral![100], 0.9),
          color: palette.neutral![900],
          padding: '8px 16px',
          fontSize: 13,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: 'solid 2px ' + (palette.primary as PaletteColor).main,
            outlineOffset: 3,
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '#nprogress .bar': {
          backgroundColor: (palette.primary as PaletteColor).main,
        },
      },
    },
  };
};
