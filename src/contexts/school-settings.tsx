'use client';

import type { FC, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';

const STORAGE_KEY = 'school_app_school_name';
const DEFAULT_SCHOOL_NAME = 'Casita Capital School';

interface SchoolSettingsContextValue {
  schoolName: string;
  updateSchoolName: (name: string) => Promise<void>;
  loading: boolean;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextValue>({
  schoolName: DEFAULT_SCHOOL_NAME,
  updateSchoolName: async () => {},
  loading: true,
});

export const SchoolSettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [schoolName, setSchoolName] = useState<string>(DEFAULT_SCHOOL_NAME);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 1. Try loading from localStorage for instant initial render
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      setSchoolName(cached);
    }

    // 2. Load from Supabase DB settings
    async function loadDbSchoolName() {
      try {
        const { data } = await supabase
          .from('weekly_planner_settings')
          .select('notes')
          .eq('week_start_date', 'GLOBAL_SCHOOL_CONFIG')
          .maybeSingle();

        if (data && data.notes) {
          setSchoolName(data.notes);
          localStorage.setItem(STORAGE_KEY, data.notes);
        }
      } catch {
        // Fallback to cached or default
      } finally {
        setLoading(false);
      }
    }

    loadDbSchoolName();
  }, []);

  const updateSchoolName = async (newName: string) => {
    const trimmed = newName.trim() || DEFAULT_SCHOOL_NAME;
    setSchoolName(trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);

    try {
      await supabase
        .from('weekly_planner_settings')
        .upsert(
          {
            week_start_date: 'GLOBAL_SCHOOL_CONFIG',
            notes: trimmed,
          },
          { onConflict: 'week_start_date' }
        );
      toast.success('School name updated successfully!');
    } catch {
      toast.error('Saved locally. Failed to sync to cloud.');
    }
  };

  return (
    <SchoolSettingsContext.Provider
      value={{
        schoolName,
        updateSchoolName,
        loading,
      }}
    >
      {children}
    </SchoolSettingsContext.Provider>
  );
};

export const useSchoolSettings = () => useContext(SchoolSettingsContext);
