'use client';

import type { Direction, PaletteMode } from '@mui/material';
import isEqual from 'lodash.isequal';
import PropTypes from 'prop-types';
import type { FC, ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ColorPreset } from 'src/theme';

export type Layout =
  | 'vertical-shells-dark'
  | 'vertical-shells-dark-alternate'
  | 'vertical-shells-brand'
  | 'vertical-shells-white'
  | 'vertical-shells-white-off'
  | 'vertical-shells-light'
  | 'vertical-shells-accent-header'
  | 'collapsed-shells-double'
  | 'collapsed-shells-double-accent'
  | 'collapsed-shells-double-dark'
  | 'collapsed-shells-single'
  | 'collapsed-shells-single-accent'
  | 'collapsed-shells-single-white'
  | 'collapsed-shells-single-white-off'
  | 'stacked-shells-top-nav'
  | 'stacked-shells-top-nav-accent'
  | 'stacked-shells-top-nav-tabs'
  | 'stacked-shells-top-nav-wide';

export interface Customization {
  colorPreset?: ColorPreset;
  direction?: Direction;
  layout?: Layout;
  paletteMode?: PaletteMode;
  stretch?: boolean;
}

export interface State extends Customization {
  isInitialized: boolean;
}

export const defaultCustomization: Customization = {
  colorPreset: 'monacoBlue',
  direction: 'ltr',
  layout: 'vertical-shells-dark-alternate',
  paletteMode: 'dark',
  stretch: false,
};

export const initialState: State = {
  isInitialized: false,
};

export interface CustomizationContextType extends State {
  handleReset: () => void;
  handleUpdate: (settings: Customization) => void;
  isCustom: boolean;
}

export const CustomizationContext = createContext<CustomizationContextType>({
  ...defaultCustomization,
  ...initialState,
  handleReset: () => { },
  handleUpdate: () => { },
  isCustom: false,
});

interface CustomizationProviderProps {
  children?: ReactNode;
  onReset?: () => void;
  onUpdate?: (settings: Customization) => void;
  settings?: Customization;
}

export const CustomizationProvider: FC<CustomizationProviderProps> = (props) => {
  const {
    children,
    onReset = () => { },
    onUpdate = () => { },
    settings: initialCustomization,
  } = props;

  const [settings, setSettings] = useState<Customization>(() => ({
    ...defaultCustomization,
    ...initialCustomization,
  }));

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('school_app_customization');
      if (stored) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch {
      // Fallback to initial
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const handleUpdate = useCallback(
    (newCustomization: Customization): void => {
      setSettings((prev) => {
        const updated = {
          ...prev,
          ...newCustomization,
        };
        try {
          localStorage.setItem('school_app_customization', JSON.stringify(updated));
        } catch {
          // Ignore write errors
        }
        return updated;
      });
      onUpdate(newCustomization);
    },
    [onUpdate]
  );

  const handleReset = useCallback((): void => {
    setSettings(defaultCustomization);
    try {
      localStorage.removeItem('school_app_customization');
    } catch {
      // Ignore errors
    }
    onReset();
  }, [onReset]);

  const isCustom = useMemo(() => {
    return !isEqual(settings, defaultCustomization);
  }, [settings]);

  return (
    <CustomizationContext.Provider
      value={{
        ...settings,
        isInitialized,
        handleReset,
        handleUpdate,
        isCustom,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

CustomizationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const CustomizationConsumer = CustomizationContext.Consumer;
