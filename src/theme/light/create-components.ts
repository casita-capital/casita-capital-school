import { backdropClasses, tableCellClasses } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import type { Components } from '@mui/material/styles/components';
import type { PaletteColor, PaletteOptions } from '@mui/material/styles/createPalette';

interface ComponentsConfig {
  palette: PaletteOptions;
}

export const createComponents = ({ palette }: ComponentsConfig): Components => {
  return {
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(palette.background?.paper || '#ffffff', 0.9),
          backdropFilter: 'blur(18px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(palette.background?.paper || '#ffffff', 0.9),
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
            backgroundColor: alpha(palette.neutral![100], 0.5),
            color: palette.neutral![800],
            borderBottomColor: palette.divider,
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
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          boxShadow: `${alpha(palette.neutral![400], 0.3)} 0 1px 3px`,
          backgroundColor: palette.background!.paper,

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
        '#nprogress .bar': {
          backgroundColor: (palette.primary as PaletteColor).main,
        },
      },
    },
  };
};
