'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from 'src/theme';
import type { ReactNode } from 'react';
import { NextAppDirEmotionCacheProvider } from './theme-registry';

import { useCustomization } from 'src/hooks/use-customization';

interface RootThemeProviderProps {
    children: ReactNode;
}

export function RootThemeProvider({ children }: RootThemeProviderProps) {
    const customization = useCustomization();

    const theme = createTheme({
        paletteMode: customization.paletteMode || 'dark',
        colorPreset: customization.colorPreset || 'monacoBlue',
        layout: customization.layout || 'vertical-shells-dark-alternate',
    });

    return (
        <NextAppDirEmotionCacheProvider options={{ key: 'mui' }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </NextAppDirEmotionCacheProvider>
    );
}
