'use client';

import type { FC, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from 'src/services/supabase/client';
import type { Json } from 'src/services/supabase/types';

const STORAGE_KEY = 'school_app_school_name';
const BRANDING_STORAGE_KEY = 'school_app_system_branding';
const SCHEDULE_HOURS_STORAGE_KEY = 'school_app_schedule_hours';
const API_REFRESH_INTERVAL_STORAGE_KEY = 'school_app_api_refresh_interval_minutes';
const API_LAST_SYNCED_STORAGE_KEY = 'school_app_api_last_synced_at';

// Sentinel valid DATE keys in school.weekly_planner_settings (since week_start_date is a Postgres DATE column)
const SENTINEL_SCHOOL_CONFIG_DATE = '2000-01-01';
const SENTINEL_SYSTEM_BRANDING_DATE = '2000-01-02';
const SENTINEL_API_SYNC_CONFIG_DATE = '2000-01-03';

const DEFAULT_SCHOOL_NAME = 'Casita Capital School';
export const DEFAULT_API_REFRESH_INTERVAL_MINUTES = 60;
export const HOURLY_SYNC_TARGET_MINUTE = 15;

export interface ApiRefreshIntervalOption {
  value: number;
  label: string;
  shortLabel: string;
  description: string;
}

export const API_REFRESH_INTERVAL_OPTIONS: ApiRefreshIntervalOption[] = [
  {
    value: 1,
    label: 'On Every App Open (1 Min Cooldown)',
    shortLabel: 'Every Open',
    description: 'Checks for new portal grades immediately whenever the app or tab is opened.',
  },
  {
    value: 5,
    label: 'Every 5 Minutes',
    shortLabel: 'Every 5m',
    description: 'High-frequency background check every 5 minutes while using the app.',
  },
  {
    value: 15,
    label: 'Every 15 Minutes',
    shortLabel: 'Every 15m',
    description: 'Checks Memoria Academy for new quiz and assignment scores every 15 minutes.',
  },
  {
    value: 30,
    label: 'Every 30 Minutes',
    shortLabel: 'Every 30m',
    description: 'Automatically refreshes portal grades every half hour.',
  },
  {
    value: 60,
    label: 'Every 1 Hour at :15 Past (Recommended)',
    shortLabel: 'Every 1h (:15)',
    description: 'Automatically refreshes portal grades every hour at :15 past the hour.',
  },
  {
    value: 120,
    label: 'Every 2 Hours',
    shortLabel: 'Every 2h',
    description: 'Refreshes portal grades every 2 hours.',
  },
  {
    value: 240,
    label: 'Every 4 Hours',
    shortLabel: 'Every 4h',
    description: 'Refreshes portal grades every 4 hours.',
  },
  {
    value: 360,
    label: 'Every 6 Hours',
    shortLabel: 'Every 6h',
    description: 'Refreshes portal grades 4 times per day.',
  },
  {
    value: 720,
    label: 'Every 12 Hours',
    shortLabel: 'Every 12h',
    description: 'Refreshes portal grades twice daily (morning and evening).',
  },
  {
    value: 1440,
    label: 'Once Daily (Every 24 Hours)',
    shortLabel: 'Daily (24h)',
    description: 'Refreshes portal grades once every 24 hours.',
  },
  {
    value: 0,
    label: 'Manual Only (Off)',
    shortLabel: 'Manual Only',
    description: 'Only pulls portal grades when you click a Refresh / Sync button manually.',
  },
];

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
  apiRefreshIntervalMinutes: number;
  updateApiRefreshInterval: (minutes: number) => Promise<void>;
  apiLastSyncedAt: string | null;
  isSyncingApi: boolean;
  syncApiScoresNow: (options?: { silent?: boolean }) => Promise<boolean>;
  apiSyncVersion: number;
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
  apiRefreshIntervalMinutes: DEFAULT_API_REFRESH_INTERVAL_MINUTES,
  updateApiRefreshInterval: async () => {},
  apiLastSyncedAt: null,
  isSyncingApi: false,
  syncApiScoresNow: async () => false,
  apiSyncVersion: 0,
  loading: true,
});

export const SchoolSettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [schoolName, setSchoolName] = useState<string>(DEFAULT_SCHOOL_NAME);
  const [branding, setBranding] = useState<SystemBrandingSettings>(DEFAULT_BRANDING);
  const [scheduleStartHour, setScheduleStartHour] = useState<number>(7);
  const [scheduleEndHour, setScheduleEndHour] = useState<number>(19);
  const [apiRefreshIntervalMinutes, setApiRefreshIntervalMinutes] = useState<number>(
    DEFAULT_API_REFRESH_INTERVAL_MINUTES
  );
  const [apiLastSyncedAt, setApiLastSyncedAt] = useState<string | null>(null);
  const [isSyncingApi, setIsSyncingApi] = useState<boolean>(false);
  const [apiSyncVersion, setApiSyncVersion] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const isSyncingRef = useRef<boolean>(false);
  const lastSyncedAtRef = useRef<string | null>(null);
  const lastAttemptedSyncMsRef = useRef<number>(0);
  const intervalMinutesRef = useRef<number>(DEFAULT_API_REFRESH_INTERVAL_MINUTES);

  const supabase = createClient();

  useEffect(() => {
    lastSyncedAtRef.current = apiLastSyncedAt;
  }, [apiLastSyncedAt]);

  useEffect(() => {
    intervalMinutesRef.current = apiRefreshIntervalMinutes;
  }, [apiRefreshIntervalMinutes]);

  const syncApiScoresNow = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (isSyncingRef.current) return false;
      isSyncingRef.current = true;
      lastAttemptedSyncMsRef.current = Date.now();
      setIsSyncingApi(true);
      const silent = options?.silent === true;

      try {
        const res = await fetch('/api/memoria/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_courses',
            auto_refresh_interval_minutes: intervalMinutesRef.current,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          synced_at?: string;
          synced_courses?: Array<{
            official_course_name: string;
            graded_items_count: number;
          }>;
        } | null;

        if (!res.ok || !data?.ok) {
          if (!silent) {
            toast.error(data?.error || 'Failed to refresh Memoria Academy API scores');
          }
          return false;
        }

        const syncedAt = data.synced_at || new Date().toISOString();
        setApiLastSyncedAt(syncedAt);
        lastSyncedAtRef.current = syncedAt;
        if (typeof window !== 'undefined') {
          localStorage.setItem(API_LAST_SYNCED_STORAGE_KEY, syncedAt);
        }

        try {
          await supabase.from('weekly_planner_settings').upsert(
            {
              week_start_date: SENTINEL_API_SYNC_CONFIG_DATE,
              todos: {
                auto_refresh_interval_minutes: intervalMinutesRef.current,
                last_synced_at: syncedAt,
              } as unknown as Json,
            },
            { onConflict: 'week_start_date' }
          );
        } catch {
          // Non-critical backup sync
        }

        setApiSyncVersion((prev) => prev + 1);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('memoria-api-synced', {
              detail: { syncedAt, syncedCourses: data.synced_courses || [] },
            })
          );
        }

        if (!silent) {
          toast.success(
            `Synced scores for ${data.synced_courses?.length || 0} Memoria Academy courses!`
          );
        }
        return true;
      } catch {
        if (!silent) {
          toast.error('Failed to refresh Memoria Academy API scores');
        }
        return false;
      } finally {
        isSyncingRef.current = false;
        setIsSyncingApi(false);
      }
    },
    [supabase]
  );

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

    const cachedRefreshInterval = localStorage.getItem(API_REFRESH_INTERVAL_STORAGE_KEY);
    if (cachedRefreshInterval !== null) {
      const parsedNum = Number(cachedRefreshInterval);
      if (!Number.isNaN(parsedNum) && parsedNum >= 0) {
        setApiRefreshIntervalMinutes(parsedNum);
        intervalMinutesRef.current = parsedNum;
      }
    }

    const cachedLastSynced = localStorage.getItem(API_LAST_SYNCED_STORAGE_KEY);
    if (cachedLastSynced) {
      setApiLastSyncedAt(cachedLastSynced);
      lastSyncedAtRef.current = cachedLastSynced;
    }

    // 2. Load from Supabase DB settings & Portal Integration config
    async function loadDbSettings() {
      try {
        const [nameRes, transcriptRes, brandRes, apiSyncRes, portalIntRes] = await Promise.all([
          supabase
            .from('weekly_planner_settings')
            .select('notes')
            .eq('week_start_date', SENTINEL_SCHOOL_CONFIG_DATE)
            .maybeSingle(),
          supabase
            .from('transcript_settings')
            .select('school_name')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('weekly_planner_settings')
            .select('todos, schedule_start_hour, schedule_end_hour')
            .eq('week_start_date', SENTINEL_SYSTEM_BRANDING_DATE)
            .maybeSingle(),
          supabase
            .from('weekly_planner_settings')
            .select('todos')
            .eq('week_start_date', SENTINEL_API_SYNC_CONFIG_DATE)
            .maybeSingle(),
          fetch('/api/memoria/sync')
            .then((r) => r.json())
            .catch(() => null),
        ]);

        const resolvedSchoolName =
          nameRes.data?.notes || transcriptRes.data?.school_name || null;
        if (resolvedSchoolName) {
          setSchoolName(resolvedSchoolName);
          localStorage.setItem(STORAGE_KEY, resolvedSchoolName);
        }

        if (brandRes.data) {
          if (brandRes.data.todos) {
            const normalized = normalizeSystemBranding(brandRes.data.todos);
            setBranding(normalized);
            localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(normalized));
          }
          if (typeof brandRes.data.schedule_start_hour === 'number') {
            setScheduleStartHour(brandRes.data.schedule_start_hour);
          }
          if (typeof brandRes.data.schedule_end_hour === 'number') {
            setScheduleEndHour(brandRes.data.schedule_end_hour);
          }
        }

        let resolvedInterval: number | null = null;
        let resolvedLastSynced: string | null = null;

        if (
          apiSyncRes.data?.todos &&
          typeof apiSyncRes.data.todos === 'object' &&
          !Array.isArray(apiSyncRes.data.todos)
        ) {
          const rec = apiSyncRes.data.todos as Record<string, unknown>;
          if (
            typeof rec.auto_refresh_interval_minutes === 'number' &&
            !Number.isNaN(rec.auto_refresh_interval_minutes) &&
            rec.auto_refresh_interval_minutes >= 0
          ) {
            resolvedInterval = rec.auto_refresh_interval_minutes;
          }
          if (typeof rec.last_synced_at === 'string' && rec.last_synced_at) {
            resolvedLastSynced = rec.last_synced_at;
          }
        }

        if (
          portalIntRes &&
          typeof portalIntRes === 'object' &&
          'integration' in portalIntRes &&
          portalIntRes.integration &&
          typeof portalIntRes.integration === 'object'
        ) {
          const pi = portalIntRes.integration as Record<string, unknown>;
          if (
            resolvedInterval === null &&
            typeof pi.auto_refresh_interval_minutes === 'number' &&
            !Number.isNaN(pi.auto_refresh_interval_minutes) &&
            pi.auto_refresh_interval_minutes >= 0
          ) {
            resolvedInterval = pi.auto_refresh_interval_minutes;
          }
          if (typeof pi.last_synced_at === 'string' && pi.last_synced_at) {
            if (
              !resolvedLastSynced ||
              Date.parse(pi.last_synced_at) > Date.parse(resolvedLastSynced)
            ) {
              resolvedLastSynced = pi.last_synced_at;
            }
          }
        }

        if (resolvedInterval !== null) {
          setApiRefreshIntervalMinutes(resolvedInterval);
          intervalMinutesRef.current = resolvedInterval;
          localStorage.setItem(API_REFRESH_INTERVAL_STORAGE_KEY, String(resolvedInterval));
        }

        if (resolvedLastSynced) {
          setApiLastSyncedAt(resolvedLastSynced);
          lastSyncedAtRef.current = resolvedLastSynced;
          localStorage.setItem(API_LAST_SYNCED_STORAGE_KEY, resolvedLastSynced);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }

    void loadDbSettings();
  }, [supabase]);

  // 3. Automatic Background API Refresh Loop (hourly anchored at :15 past the hour, or custom interval)
  useEffect(() => {
    if (loading) return;

    const getLastHandledMs = (): number => {
      const lastSyncedStr = lastSyncedAtRef.current;
      const parsedSyncedMs = lastSyncedStr ? Date.parse(lastSyncedStr) : Number.NaN;
      const validSyncedMs = Number.isNaN(parsedSyncedMs) ? 0 : parsedSyncedMs;
      return Math.max(validSyncedMs, lastAttemptedSyncMsRef.current);
    };

    const checkAndSyncIfDue = () => {
      const intervalMins = intervalMinutesRef.current;
      if (intervalMins <= 0 || isSyncingRef.current) return;

      const nowMs = Date.now();
      const lastHandledMs = getLastHandledMs();

      // For the 60-minute (hourly) setting, strictly pull at :15 after the hour
      if (intervalMins === 60) {
        const nowDate = new Date(nowMs);
        if (nowDate.getMinutes() === HOURLY_SYNC_TARGET_MINUTE) {
          const currentHourSlot = new Date(nowMs);
          currentHourSlot.setMinutes(HOURLY_SYNC_TARGET_MINUTE, 0, 0);
          if (lastHandledMs < currentHourSlot.getTime()) {
            void syncApiScoresNow({ silent: true });
          }
        }
        return;
      }

      const elapsedMs = lastHandledMs > 0 ? nowMs - lastHandledMs : Number.POSITIVE_INFINITY;
      const thresholdMs = intervalMins * 60 * 1000;

      if (elapsedMs >= thresholdMs) {
        void syncApiScoresNow({ silent: true });
      }
    };

    let hourlySlotTimeoutId: number | null = null;

    const scheduleNextHourlyFifteenSlot = () => {
      if (hourlySlotTimeoutId !== null) {
        window.clearTimeout(hourlySlotTimeoutId);
        hourlySlotTimeoutId = null;
      }
      if (intervalMinutesRef.current !== 60) return;

      const now = new Date();
      const target = new Date(now.getTime());
      target.setMinutes(HOURLY_SYNC_TARGET_MINUTE, 0, 0);
      if (now.getTime() >= target.getTime()) {
        target.setHours(target.getHours() + 1);
      }
      const delayMs = Math.max(1000, target.getTime() - now.getTime());

      hourlySlotTimeoutId = window.setTimeout(() => {
        checkAndSyncIfDue();
        scheduleNextHourlyFifteenSlot();
      }, delayMs);
    };

    // Run check immediately once settings have loaded & schedule exact :15 timer
    checkAndSyncIfDue();
    scheduleNextHourlyFifteenSlot();

    // Check every 30 seconds while the app stays open
    const timerId = window.setInterval(checkAndSyncIfDue, 30 * 1000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncIfDue();
        scheduleNextHourlyFifteenSlot();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (hourlySlotTimeoutId !== null) {
        window.clearTimeout(hourlySlotTimeoutId);
      }
      window.clearInterval(timerId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [loading, apiRefreshIntervalMinutes, syncApiScoresNow]);

  const updateSchoolName = async (newName: string) => {
    const trimmed = newName.trim() || DEFAULT_SCHOOL_NAME;
    setSchoolName(trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);

    try {
      await supabase
        .from('weekly_planner_settings')
        .upsert(
          {
            week_start_date: SENTINEL_SCHOOL_CONFIG_DATE,
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
            week_start_date: SENTINEL_SYSTEM_BRANDING_DATE,
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
            week_start_date: SENTINEL_SYSTEM_BRANDING_DATE,
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

  const updateApiRefreshInterval = async (minutes: number) => {
    const sanitized = Number.isNaN(minutes) || minutes < 0 ? 0 : minutes;
    setApiRefreshIntervalMinutes(sanitized);
    intervalMinutesRef.current = sanitized;
    localStorage.setItem(API_REFRESH_INTERVAL_STORAGE_KEY, String(sanitized));

    const matchedOpt = API_REFRESH_INTERVAL_OPTIONS.find((o) => o.value === sanitized);
    const labelText = matchedOpt ? matchedOpt.label : `${sanitized} minutes`;

    try {
      await Promise.all([
        supabase.from('weekly_planner_settings').upsert(
          {
            week_start_date: SENTINEL_API_SYNC_CONFIG_DATE,
            todos: {
              auto_refresh_interval_minutes: sanitized,
              last_synced_at: lastSyncedAtRef.current,
            } as unknown as Json,
          },
          { onConflict: 'week_start_date' }
        ),
        fetch('/api/memoria/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_refresh_settings',
            auto_refresh_interval_minutes: sanitized,
          }),
        }),
      ]);
      toast.success(`API score auto-refresh set to: ${labelText}`);
    } catch {
      toast.error('Saved locally. Failed to sync setting to cloud.');
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
        apiRefreshIntervalMinutes,
        updateApiRefreshInterval,
        apiLastSyncedAt,
        isSyncingApi,
        syncApiScoresNow,
        apiSyncVersion,
        loading,
      }}
    >
      {children}
    </SchoolSettingsContext.Provider>
  );
};

export const useSchoolSettings = () => useContext(SchoolSettingsContext);
