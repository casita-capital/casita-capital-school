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
          color: palette.text!.primary,
          colorScheme: 'dark',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          colorScheme: 'dark',
        },
      },
    },
    MuiModal: {
      styleOverrides: {
        root: {
          color: palette.text!.primary,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(lighten(palette.neutral![900], 0.035), 0.96),
          backdropFilter: 'blur(18px)',
          color: palette.text!.primary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(lighten(palette.neutral![900], 0.035), 0.96),
          backdropFilter: 'blur(18px)',
          color: palette.text!.primary,
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
          color: palette.text!.primary,
        },
        stickyHeader: {
          backgroundColor: lighten(palette.neutral![900], 0.06),
          color: palette.neutral![25],
          borderBottomColor: palette.divider,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: lighten(palette.neutral![900], 0.06),
          [`& .${tableCellClasses.root}`]: {
            backgroundColor: lighten(palette.neutral![900], 0.06),
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
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: palette.text!.primary,
        },
        input: {
          color: palette.text!.primary,
          '&::placeholder': {
            color: palette.neutral![400],
            opacity: 0.8,
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: palette.neutral![300],
          '&.Mui-focused': {
            color: (palette.primary as PaletteColor).main,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: palette.neutral![300],
          '&.Mui-focused': {
            color: (palette.primary as PaletteColor).main,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(palette.neutral![800], 0.24),
          boxShadow: `${alpha(palette.neutral![900], 0.64)} 0 1px 3px`,
          borderColor: palette.neutral![700],
          color: palette.text!.primary,

          '&:hover': {
            backgroundColor: palette.background!.paper,
            borderColor: palette.neutral![600],
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
        input: {
          color: palette.text!.primary,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          boxShadow: `${alpha(palette.neutral![900], 0.64)} 0 1px 3px`,
          backgroundColor: alpha(palette.neutral![900], 0.6),
          color: palette.text!.primary,

          '&:hover': {
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: palette.neutral![500],
            },
          },
          '&.Mui-focused': {
            backgroundColor: alpha(palette.neutral![900], 0.8),
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: (palette.primary as PaletteColor).main,
            },
          },
        },
        input: {
          color: palette.text!.primary,
        },
        notchedOutline: {
          borderColor: palette.neutral![700],
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
          borderColor: alpha(neutral[300], 0.4),
          color: neutral[200],
        },
        colorSecondary: {
          backgroundColor: alpha(neutral[300], 0.14),
          borderColor: alpha(neutral[300], 0.35),
          color: neutral[100],
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
        html: {
          colorScheme: 'dark',
        },
        body: {
          backgroundColor: palette.background!.default,
          color: palette.text!.primary,
        },
        'input, textarea, select': {
          color: palette.text!.primary,
        },
        option: {
          backgroundColor: lighten(palette.neutral![900], 0.035),
          color: palette.text!.primary,
        },
        '#nprogress .bar': {
          backgroundColor: (palette.primary as PaletteColor).main,
        },
      },
    },
  };
};
