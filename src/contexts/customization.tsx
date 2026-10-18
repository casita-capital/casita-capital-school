'use client';

import type { Direction, PaletteMode } from '@mui/material';
import PropTypes from 'prop-types';
import type { FC, ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from 'src/services/supabase/client';
import type { Json } from 'src/services/supabase/types';
import type { ColorPreset, HeadingFontPreset } from 'src/theme';
import { ACTIVE_USER_EMAIL_STORAGE_KEY } from 'src/utils/active-user';

const BASE_STORAGE_KEY = 'school_app_customization';
const USER_DB_PREFIX = 'USER_CUSTOMIZATION:';

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
  headingFont?: HeadingFontPreset;
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
  headingFont: 'inter',
};

function isCustomizationEqual(a: Customization, b: Customization): boolean {
  return (
    a.colorPreset === b.colorPreset &&
    a.direction === b.direction &&
    a.layout === b.layout &&
    a.paletteMode === b.paletteMode &&
    a.stretch === b.stretch &&
    a.headingFont === b.headingFont
  );
}

function getStorageKeyForEmail(email: string | null): string {
  const clean = email?.trim().toLowerCase() || '';
  return clean ? `${BASE_STORAGE_KEY}:${clean}` : BASE_STORAGE_KEY;
}

function parseCustomizationJson(raw: unknown): Partial<Customization> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const out: Partial<Customization> = {};
  if (rec.paletteMode === 'light' || rec.paletteMode === 'dark') {
    out.paletteMode = rec.paletteMode;
  }
  if (typeof rec.colorPreset === 'string') {
    out.colorPreset = rec.colorPreset as ColorPreset;
  }
  if (
    rec.headingFont === 'inter' ||
    rec.headingFont === 'plusJakarta' ||
    rec.headingFont === 'outfit' ||
    rec.headingFont === 'dmSans' ||
    rec.headingFont === 'nunito' ||
    rec.headingFont === 'newsreader'
  ) {
    out.headingFont = rec.headingFont;
  }
  return out;
}

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
  handleReset: () => {},
  handleUpdate: () => {},
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
    onReset = () => {},
    onUpdate = () => {},
    settings: initialCustomization,
  } = props;

  const supabase = useMemo(() => createClient(), []);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);

  const [settings, setSettings] = useState<Customization>(() => ({
    ...defaultCustomization,
    ...initialCustomization,
  }));

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const loadUserCustomization = useCallback(
    async (emailHint?: string | null) => {
      try {
        let resolvedEmail =
          emailHint ??
          (typeof window !== 'undefined'
            ? localStorage.getItem(ACTIVE_USER_EMAIL_STORAGE_KEY)
            : null);

        if (!resolvedEmail) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          resolvedEmail = user?.email || null;
        }

        const cleanEmail = resolvedEmail?.trim().toLowerCase() || null;
        setActiveEmail(cleanEmail);

        // 1. Read local per-user storage (falling back to global storage)
        if (typeof window !== 'undefined') {
          const userStored = cleanEmail
            ? localStorage.getItem(getStorageKeyForEmail(cleanEmail))
            : null;
          const fallbackStored = localStorage.getItem(BASE_STORAGE_KEY);
          const rawStr = userStored || fallbackStored;
          if (rawStr) {
            const parsed = parseCustomizationJson(JSON.parse(rawStr));
            if (parsed) {
              setSettings((prev) => ({ ...prev, ...parsed }));
            }
          }
        }

        // 2. Sync per-user preferences from Supabase if signed in
        if (cleanEmail) {
          const dbKey = `${USER_DB_PREFIX}${cleanEmail}`;
          const { data } = await supabase
            .from('weekly_planner_settings')
            .select('todos')
            .eq('week_start_date', dbKey)
            .maybeSingle();

          if (data?.todos) {
            const parsedDb = parseCustomizationJson(data.todos);
            if (parsedDb) {
              setSettings((prev) => {
                const merged = { ...prev, ...parsedDb };
                try {
                  localStorage.setItem(getStorageKeyForEmail(cleanEmail), JSON.stringify(merged));
                  localStorage.setItem(BASE_STORAGE_KEY, JSON.stringify(merged));
                } catch {
                  // Ignore storage errors
                }
                return merged;
              });
            }
          }
        }
      } catch {
        // Fallback to current state
      } finally {
        setIsInitialized(true);
      }
    },
    [supabase]
  );

  useEffect(() => {
    loadUserCustomization();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserCustomization(session?.user?.email || null);
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [loadUserCustomization, supabase]);

  const handleUpdate = useCallback(
    (newCustomization: Customization): void => {
      setSettings((prev) => {
        const updated = {
          ...prev,
          ...newCustomization,
        };
        const currentEmail =
          activeEmail ||
          (typeof window !== 'undefined'
            ? localStorage.getItem(ACTIVE_USER_EMAIL_STORAGE_KEY)?.trim().toLowerCase() || null
            : null);

        try {
          if (currentEmail) {
            localStorage.setItem(getStorageKeyForEmail(currentEmail), JSON.stringify(updated));
          }
          localStorage.setItem(BASE_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore write errors
        }

        if (currentEmail) {
          const dbKey = `${USER_DB_PREFIX}${currentEmail}`;
          void supabase.from('weekly_planner_settings').upsert(
            {
              week_start_date: dbKey,
              todos: {
                paletteMode: updated.paletteMode,
                colorPreset: updated.colorPreset,
                headingFont: updated.headingFont,
              } as unknown as Json,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'week_start_date' }
          );
        }

        return updated;
      });
      onUpdate(newCustomization);
    },
    [activeEmail, onUpdate, supabase]
  );

  const handleReset = useCallback((): void => {
    setSettings(defaultCustomization);
    try {
      if (activeEmail) {
        localStorage.removeItem(getStorageKeyForEmail(activeEmail));
      }
      localStorage.removeItem(BASE_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
    onReset();
  }, [activeEmail, onReset]);

  const isCustom = useMemo(() => {
    return !isCustomizationEqual(settings, defaultCustomization);
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
