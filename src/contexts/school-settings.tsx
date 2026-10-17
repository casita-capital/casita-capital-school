'use client';

import type { FC, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import type { Json } from 'src/services/supabase/types';

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
  parentNotes: ItemBranding;
  holidays: ItemBranding;
}

export const DEFAULT_BRANDING: SystemBrandingSettings = {
  assignments: { color: '#0C74E4', icon: 'FileText' },
  tasks: { color: '#2E7D32', icon: 'CheckSquare' },
  notes: { color: '#D97706', icon: 'Edit3' },
  parentNotes: { color: '#8B5CF6', icon: 'User' },
  holidays: { color: '#D32F2F', icon: 'Sparkles' },
};

function isItemBranding(val: unknown): val is ItemBranding {
  if (!val || typeof val !== 'object') return false;
  const rec = val as Record<string, unknown>;
  return typeof rec.color === 'string' && typeof rec.icon === 'string';
}

export function normalizeSystemBranding(raw: unknown): SystemBrandingSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_BRANDING;
  const rec = raw as Record<string, unknown>;
  return {
    assignments: isItemBranding(rec.assignments) ? rec.assignments : DEFAULT_BRANDING.assignments,
    tasks: isItemBranding(rec.tasks) ? rec.tasks : DEFAULT_BRANDING.tasks,
    notes: isItemBranding(rec.notes) ? rec.notes : DEFAULT_BRANDING.notes,
    parentNotes: isItemBranding(rec.parentNotes) ? rec.parentNotes : DEFAULT_BRANDING.parentNotes,
    holidays: isItemBranding(rec.holidays) ? rec.holidays : DEFAULT_BRANDING.holidays,
  };
}

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
        const parsed: unknown = JSON.parse(cachedBranding);
        setBranding(normalizeSystemBranding(parsed));
      } catch {
        // Fallback
      }
    }

    const cachedHours = localStorage.getItem(SCHEDULE_HOURS_STORAGE_KEY);
    if (cachedHours) {
      try {
        const parsed: unknown = JSON.parse(cachedHours);
        if (parsed && typeof parsed === 'object') {
          const rec = parsed as Record<string, unknown>;
          if (typeof rec.start === 'number' && typeof rec.end === 'number') {
            setScheduleStartHour(rec.start);
            setScheduleEndHour(rec.end);
          }
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
            const normalized = normalizeSystemBranding(brandData.todos);
            setBranding(normalized);
            localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(normalized));
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
      await supabase
        .from('transcript_settings')
        .update({ school_name: trimmed, updated_at: new Date().toISOString() })
        .not('id', 'is', null);
      toast.success('School name updated successfully!');
    } catch {
      toast.error('Saved locally. Failed to sync to cloud.');
    }
  };

  const updateItemBranding = async (newBranding: SystemBrandingSettings) => {
    const normalized = normalizeSystemBranding(newBranding);
    setBranding(normalized);
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(normalized));

    try {
      await supabase
        .from('weekly_planner_settings')
        .upsert(
          {
            week_start_date: 'GLOBAL_SYSTEM_BRANDING',
            todos: normalized as unknown as Json,
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
