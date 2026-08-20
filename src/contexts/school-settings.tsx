'use client';

import type { FC, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';

const STORAGE_KEY = 'school_app_school_name';
const BRANDING_STORAGE_KEY = 'school_app_system_branding';
const SCHEDULE_HOURS_STORAGE_KEY = 'school_app_schedule_hours';

const DEFAULT_SCHOOL_NAME = 'Casita Capital School';

export interface ItemBranding {
  color: string;
  icon: string;
}

export interface SystemBrandingSettings {
  assignments: ItemBranding;
  tasks: ItemBranding;
  notes: ItemBranding;
  holidays: ItemBranding;
}

export const DEFAULT_BRANDING: SystemBrandingSettings = {
  assignments: { color: '#0C74E4', icon: 'FileText' },
  tasks: { color: '#2E7D32', icon: 'CheckSquare' },
  notes: { color: '#D97706', icon: 'Edit3' },
  holidays: { color: '#D32F2F', icon: 'Sparkles' },
};

interface SchoolSettingsContextValue {
  schoolName: string;
  updateSchoolName: (name: string) => Promise<void>;
  branding: SystemBrandingSettings;
  updateItemBranding: (newBranding: SystemBrandingSettings) => Promise<void>;
  scheduleStartHour: number;
  scheduleEndHour: number;
  updateScheduleHours: (startHour: number, endHour: number) => Promise<void>;
  loading: boolean;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextValue>({
  schoolName: DEFAULT_SCHOOL_NAME,
  updateSchoolName: async () => {},
  branding: DEFAULT_BRANDING,
  updateItemBranding: async () => {},
  scheduleStartHour: 7,
  scheduleEndHour: 19,
  updateScheduleHours: async () => {},
  loading: true,
});

export const SchoolSettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [schoolName, setSchoolName] = useState<string>(DEFAULT_SCHOOL_NAME);
  const [branding, setBranding] = useState<SystemBrandingSettings>(DEFAULT_BRANDING);
  const [scheduleStartHour, setScheduleStartHour] = useState<number>(7);
  const [scheduleEndHour, setScheduleEndHour] = useState<number>(19);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 1. Try loading from localStorage for instant initial render
    const cachedName = localStorage.getItem(STORAGE_KEY);
    if (cachedName) {
      setSchoolName(cachedName);
    }

    const cachedBranding = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (cachedBranding) {
      try {
        setBranding(JSON.parse(cachedBranding));
      } catch {
        // Fallback
      }
    }

    const cachedHours = localStorage.getItem(SCHEDULE_HOURS_STORAGE_KEY);
    if (cachedHours) {
      try {
        const parsed = JSON.parse(cachedHours);
        if (typeof parsed.start === 'number' && typeof parsed.end === 'number') {
          setScheduleStartHour(parsed.start);
          setScheduleEndHour(parsed.end);
        }
      } catch {
        // Fallback
      }
    }

    // 2. Load from Supabase DB settings
    async function loadDbSettings() {
      try {
        const { data: nameData } = await supabase
          .from('weekly_planner_settings')
          .select('notes')
          .eq('week_start_date', 'GLOBAL_SCHOOL_CONFIG')
          .maybeSingle();

        if (nameData && nameData.notes) {
          setSchoolName(nameData.notes);
          localStorage.setItem(STORAGE_KEY, nameData.notes);
        }

        const { data: brandData } = await supabase
          .from('weekly_planner_settings')
          .select('todos, schedule_start_hour, schedule_end_hour')
          .eq('week_start_date', 'GLOBAL_SYSTEM_BRANDING')
          .maybeSingle();

        if (brandData) {
          if (brandData.todos) {
            const parsed = brandData.todos as unknown as SystemBrandingSettings;
            if (parsed.assignments && parsed.tasks && parsed.notes && parsed.holidays) {
              setBranding(parsed);
              localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(parsed));
            }
          }
          if (typeof brandData.schedule_start_hour === 'number') {
            setScheduleStartHour(brandData.schedule_start_hour);
          }
          if (typeof brandData.schedule_end_hour === 'number') {
            setScheduleEndHour(brandData.schedule_end_hour);
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }

    loadDbSettings();
  }, [supabase]);

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

  const updateItemBranding = async (newBranding: SystemBrandingSettings) => {
    setBranding(newBranding);
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(newBranding));

    try {
      await supabase
        .from('weekly_planner_settings')
        .upsert(
          {
            week_start_date: 'GLOBAL_SYSTEM_BRANDING',
            todos: newBranding as any,
          },
          { onConflict: 'week_start_date' }
        );
      toast.success('Item colors & icons updated successfully!');
    } catch {
      toast.error('Saved locally. Failed to sync to cloud.');
    }
  };

  const updateScheduleHours = async (startHour: number, endHour: number) => {
    setScheduleStartHour(startHour);
    setScheduleEndHour(endHour);
    localStorage.setItem(
      SCHEDULE_HOURS_STORAGE_KEY,
      JSON.stringify({ start: startHour, end: endHour })
    );

    try {
      await supabase
        .from('weekly_planner_settings')
        .upsert(
          {
            week_start_date: 'GLOBAL_SYSTEM_BRANDING',
            schedule_start_hour: startHour,
            schedule_end_hour: endHour,
          },
          { onConflict: 'week_start_date' }
        );
      toast.success('Time Scheduler timeframe updated!');
    } catch {
      toast.error('Saved locally. Failed to sync to cloud.');
    }
  };

  return (
    <SchoolSettingsContext.Provider
      value={{
        schoolName,
        updateSchoolName,
        branding,
        updateItemBranding,
        scheduleStartHour,
        scheduleEndHour,
        updateScheduleHours,
        loading,
      }}
    >
      {children}
    </SchoolSettingsContext.Provider>
  );
};

export const useSchoolSettings = () => useContext(SchoolSettingsContext);
