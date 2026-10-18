'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from 'src/theme';
import { useEffect, type ReactNode } from 'react';
import { NextAppDirEmotionCacheProvider } from './theme-registry';

import { useCustomization } from 'src/hooks/use-customization';

const REACT_19_ELEMENT_REF_WARNING = 'Accessing element.ref was removed in React 19';

type ConsoleErrorFn = (...args: unknown[]) => void;

interface PatchedConsoleError extends ConsoleErrorFn {
    __muiReact19RefFiltered?: boolean;
}

function createFilteredConsoleError(baseError: ConsoleErrorFn): PatchedConsoleError {
    if ((baseError as PatchedConsoleError).__muiReact19RefFiltered) {
        return baseError as PatchedConsoleError;
    }
    const filtered: PatchedConsoleError = (...args: unknown[]) => {
        const firstArg = args[0];
        if (typeof firstArg === 'string' && firstArg.includes(REACT_19_ELEMENT_REF_WARNING)) {
            return;
        }
        baseError.apply(console, args);
    };
    filtered.__muiReact19RefFiltered = true;
    return filtered;
}

function installReact19ElementRefFilter(): void {
    if (typeof console === 'undefined') return;
    try {
        let currentErrorFn: PatchedConsoleError = createFilteredConsoleError(console.error);
        Object.defineProperty(console, 'error', {
            configurable: true,
            enumerable: true,
            get() {
                return currentErrorFn;
            },
            set(nextFn: ConsoleErrorFn) {
                currentErrorFn = createFilteredConsoleError(nextFn);
            },
        });
    } catch {
        console.error = createFilteredConsoleError(console.error);
    }
}

installReact19ElementRefFilter();

interface RootThemeProviderProps {
    children: ReactNode;
}

export function RootThemeProvider({ children }: RootThemeProviderProps) {
    const customization = useCustomization();

    useEffect(() => {
        installReact19ElementRefFilter();
    }, []);

    const theme = createTheme({
        paletteMode: customization.paletteMode || 'dark',
        colorPreset: customization.colorPreset || 'monacoBlue',
        layout: customization.layout || 'vertical-shells-dark-alternate',
        headingFont: customization.headingFont || 'inter',
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
