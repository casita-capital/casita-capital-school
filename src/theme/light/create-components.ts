import { backdropClasses, tableCellClasses } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import type { Components } from '@mui/material/styles/components';
import type { PaletteColor, PaletteOptions } from '@mui/material/styles/createPalette';

interface ComponentsConfig {
  palette: PaletteOptions;
}

export const createComponents = ({ palette }: ComponentsConfig): Components => {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          color: palette.text!.primary,
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
          backgroundColor: alpha(palette.background?.paper || '#ffffff', 0.95),
          backdropFilter: 'blur(18px)',
          color: palette.text!.primary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(palette.background?.paper || '#ffffff', 0.95),
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
          backgroundColor: palette.neutral![50],
          color: palette.neutral![800],
          borderBottomColor: palette.divider,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: palette.neutral![50],
          [`& .${tableCellClasses.root}`]: {
            backgroundColor: palette.neutral![50],
            color: palette.neutral![800],
            borderBottomColor: palette.divider,
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
            color: palette.neutral![500],
            opacity: 0.8,
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: palette.neutral![700],
          '&.Mui-focused': {
            color: (palette.primary as PaletteColor).main,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: palette.neutral![700],
          '&.Mui-focused': {
            color: (palette.primary as PaletteColor).main,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(palette.neutral![50], 0.4),
          boxShadow: `${alpha(palette.neutral![400], 0.3)} 0 1px 3px`,
          borderColor: palette.neutral![400],
          color: palette.text!.primary,

          '&:hover': {
            backgroundColor: palette.background!.paper,
            borderColor: palette.neutral![500],
          },
          '&.Mui-focused': {
            backgroundColor: palette.background!.paper,
            borderColor: (palette.primary as PaletteColor).main,
            boxShadow: `${(palette.primary as PaletteColor).main} 0 0px 0 1px inset`,
          },
          '&.Mui-disabled': {
            backgroundColor: palette.neutral![50],
            borderColor: palette.neutral![300],
            boxShadow: `${alpha(palette.neutral![400], 0.3)} 0 1px 3px`,
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
          boxShadow: `${alpha(palette.neutral![400], 0.3)} 0 1px 3px`,
          backgroundColor: palette.background!.paper,
          color: palette.text!.primary,

          '&:hover': {
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: palette.neutral![500],
            },

            '&.Mui-focused': {
              '.MuiOutlinedInput-notchedOutline': {
                borderColor: (palette.primary as PaletteColor).main,
              },
            },
          },
        },
        input: {
          color: palette.text!.primary,
        },
        notchedOutline: {
          borderColor: palette.neutral![400],
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          [`&:not(.${backdropClasses.invisible})`]: {
            backgroundColor: alpha(palette.neutral![800], 0.4),
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&:hover:not(.Mui-selected)': {
            color: palette.neutral![800],
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: palette.neutral![700],
          '&:hover': {
            backgroundColor: palette.neutral![50],
            color: palette.neutral![900],
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: alpha((palette.primary as PaletteColor).main, 0.08),
          borderColor: alpha((palette.primary as PaletteColor).main, 0.3),
          color: (palette.primary as PaletteColor).dark,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backdropFilter: 'blur(6px)',
          background: alpha(palette.neutral![900], 0.9),
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
          colorScheme: 'light',
        },
        body: {
          backgroundColor: palette.background!.default,
          color: palette.text!.primary,
        },
        'input, textarea, select': {
          color: palette.text!.primary,
        },
        option: {
          backgroundColor: palette.background?.paper || '#ffffff',
          color: palette.text!.primary,
        },
        '#nprogress .bar': {
          backgroundColor: (palette.primary as PaletteColor).main,
        },
      },
    },
  };
};
