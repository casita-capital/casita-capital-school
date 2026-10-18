import type { Database, Json } from 'src/services/supabase/types';

export type SchoolTaskRow = Database['school']['Tables']['tasks']['Row'];

export type TaskFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'twice_weekly'
  | 'three_times_weekly'
  | 'biweekly'
  | 'monthly'
  | 'custom_days';

export type TaskEndType = 'never' | 'on_date' | 'after_count';

export type TaskWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface TaskRecurrenceConfig {
  frequency: TaskFrequency;
  days_of_week: TaskWeekday[];
  start_date: string;
  end_type: TaskEndType;
  end_date: string | null;
  occurrence_count: number | null;
  completed_dates: string[];
}

export interface ScheduledTaskOccurrence {
  occurrenceId: string;
  taskId: string;
  title: string;
  description: string | null;
  occurrenceDate: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  isRecurring: boolean;
  recurrenceSummary: string | null;
  task: SchoolTaskRow;
}

export const TASK_WEEKDAYS: { key: TaskWeekday; shortLabel: string; fullLabel: string; jsDay: number }[] = [
  { key: 'sunday', shortLabel: 'Sun', fullLabel: 'Sunday', jsDay: 0 },
  { key: 'monday', shortLabel: 'Mon', fullLabel: 'Monday', jsDay: 1 },
  { key: 'tuesday', shortLabel: 'Tue', fullLabel: 'Tuesday', jsDay: 2 },
  { key: 'wednesday', shortLabel: 'Wed', fullLabel: 'Wednesday', jsDay: 3 },
  { key: 'thursday', shortLabel: 'Thu', fullLabel: 'Thursday', jsDay: 4 },
  { key: 'friday', shortLabel: 'Fri', fullLabel: 'Friday', jsDay: 5 },
  { key: 'saturday', shortLabel: 'Sat', fullLabel: 'Saturday', jsDay: 6 },
];

export const TASK_FREQUENCY_OPTIONS: {
  value: TaskFrequency;
  label: string;
  helperText: string;
  usesDayPicker: boolean;
  recommendedDayCount?: number;
}[] = [
  {
    value: 'daily',
    label: 'Daily (Every Day)',
    helperText: 'Repeats every calendar day (Mon–Sun)',
    usesDayPicker: false,
  },
  {
    value: 'weekdays',
    label: 'Every Weekday (Mon–Fri)',
    helperText: 'Repeats Monday through Friday each school week',
    usesDayPicker: false,
  },
  {
    value: 'weekly',
    label: 'Weekly (1x per week)',
    helperText: 'Repeats once a week on your chosen day',
    usesDayPicker: true,
    recommendedDayCount: 1,
  },
  {
    value: 'twice_weekly',
    label: '2x per Week',
    helperText: 'Repeats twice a week (e.g., Tue & Thu or Mon & Wed)',
    usesDayPicker: true,
    recommendedDayCount: 2,
  },
  {
    value: 'three_times_weekly',
    label: '3x per Week',
    helperText: 'Repeats three times a week (e.g., Mon, Wed & Fri)',
    usesDayPicker: true,
    recommendedDayCount: 3,
  },
  {
    value: 'biweekly',
    label: 'Every 2 Weeks (Biweekly)',
    helperText: 'Repeats every other week on selected day(s)',
    usesDayPicker: true,
  },
  {
    value: 'monthly',
    label: 'Monthly',
    helperText: 'Repeats once a month on the starting date’s day of month',
    usesDayPicker: false,
  },
  {
    value: 'custom_days',
    label: 'Custom Days of the Week',
    helperText: 'Choose any combination of days of the week',
    usesDayPicker: true,
  },
];

const VALID_FREQUENCIES: ReadonlySet<string> = new Set<TaskFrequency>([
  'daily',
  'weekdays',
  'weekly',
  'twice_weekly',
  'three_times_weekly',
  'biweekly',
  'monthly',
  'custom_days',
]);

const VALID_END_TYPES: ReadonlySet<string> = new Set<TaskEndType>([
  'never',
  'on_date',
  'after_count',
]);

const VALID_WEEKDAYS: ReadonlySet<string> = new Set<TaskWeekday>([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

function isJsonRecord(val: Json | null | undefined): val is { [key: string]: Json | undefined } {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function formatIsoDateLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayIsoStr(): string {
  return formatIsoDateLocal(new Date());
}

export function getWeekdayFromDateStr(dateStr: string): TaskWeekday {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'monday';
  const entry = TASK_WEEKDAYS.find((w) => w.jsDay === d.getDay());
  return entry ? entry.key : 'monday';
}

export function getDefaultDaysForFrequency(
  frequency: TaskFrequency,
  startDateStr: string
): TaskWeekday[] {
  const startWeekday = getWeekdayFromDateStr(startDateStr);
  switch (frequency) {
    case 'daily':
      return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    case 'weekdays':
      return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    case 'weekly':
    case 'biweekly':
      return [startWeekday];
    case 'twice_weekly':
      return ['tuesday', 'thursday'];
    case 'three_times_weekly':
      return ['monday', 'wednesday', 'friday'];
    case 'monthly':
      return [startWeekday];
    case 'custom_days':
      return [startWeekday];
  }
}

export function parseTaskRecurrenceConfig(
  raw: Json | null | undefined,
  fallbackStartDate?: string | null
): TaskRecurrenceConfig | null {
  if (!isJsonRecord(raw)) return null;

  const rawFreq = typeof raw.frequency === 'string' ? raw.frequency : 'weekly';
  const frequency: TaskFrequency = VALID_FREQUENCIES.has(rawFreq)
    ? (rawFreq as TaskFrequency)
    : 'weekly';

  const startDate =
    typeof raw.start_date === 'string' && raw.start_date.trim().length > 0
      ? raw.start_date.trim()
      : fallbackStartDate || getTodayIsoStr();

  const rawEndType = typeof raw.end_type === 'string' ? raw.end_type : 'never';
  const endType: TaskEndType = VALID_END_TYPES.has(rawEndType)
    ? (rawEndType as TaskEndType)
    : 'never';

  const endDate =
    typeof raw.end_date === 'string' && raw.end_date.trim().length > 0
      ? raw.end_date.trim()
      : null;

  const occurrenceCount =
    typeof raw.occurrence_count === 'number' && raw.occurrence_count > 0
      ? Math.floor(raw.occurrence_count)
      : null;

  const daysOfWeek: TaskWeekday[] = Array.isArray(raw.days_of_week)
    ? raw.days_of_week.filter(
        (d): d is TaskWeekday => typeof d === 'string' && VALID_WEEKDAYS.has(d)
      )
    : getDefaultDaysForFrequency(frequency, startDate);

  const completedDates: string[] = Array.isArray(raw.completed_dates)
    ? raw.completed_dates.filter((d): d is string => typeof d === 'string' && d.length > 0)
    : [];

  return {
    frequency,
    days_of_week:
      daysOfWeek.length > 0 ? daysOfWeek : getDefaultDaysForFrequency(frequency, startDate),
    start_date: startDate,
    end_type: endType,
    end_date: endDate,
    occurrence_count: occurrenceCount,
    completed_dates: completedDates,
  };
}

export function serializeTaskRecurrenceConfig(cfg: TaskRecurrenceConfig): Json {
  return {
    frequency: cfg.frequency,
    days_of_week: cfg.days_of_week,
    start_date: cfg.start_date,
    end_type: cfg.end_type,
    end_date: cfg.end_date,
    occurrence_count: cfg.occurrence_count,
    completed_dates: cfg.completed_dates,
  };
}

export function formatShortDate(isoStr: string): string {
  const d = new Date(`${isoStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTaskRecurrenceSummary(cfg: TaskRecurrenceConfig): string {
  const dayLabels = TASK_WEEKDAYS.filter((w) => cfg.days_of_week.includes(w.key)).map(
    (w) => w.shortLabel
  );
  const daysText = dayLabels.length > 0 ? ` (${dayLabels.join(', ')})` : '';

  let freqPart = '';
  switch (cfg.frequency) {
    case 'daily':
      freqPart = 'Daily';
      break;
    case 'weekdays':
      freqPart = 'Weekdays (Mon–Fri)';
      break;
    case 'weekly':
      freqPart = `Weekly${daysText}`;
      break;
    case 'twice_weekly':
      freqPart = `2x / Week${daysText}`;
      break;
    case 'three_times_weekly':
      freqPart = `3x / Week${daysText}`;
      break;
    case 'biweekly':
      freqPart = `Every 2 Weeks${daysText}`;
      break;
    case 'monthly': {
      const startD = new Date(`${cfg.start_date}T00:00:00`);
      const dayOfMonth = Number.isNaN(startD.getTime()) ? 1 : startD.getDate();
      freqPart = `Monthly (Day ${dayOfMonth})`;
      break;
    }
    case 'custom_days':
      freqPart = `Custom${daysText}`;
      break;
  }

  let endPart = 'Never ends';
  if (cfg.end_type === 'on_date' && cfg.end_date) {
    endPart = `Until ${formatShortDate(cfg.end_date)}`;
  } else if (cfg.end_type === 'after_count' && cfg.occurrence_count) {
    endPart = `${cfg.occurrence_count} ${cfg.occurrence_count === 1 ? 'event' : 'events'}`;
  }

  return `${freqPart} · ${endPart}`;
}

function matchesFrequencyOnDate(
  cfg: TaskRecurrenceConfig,
  candidateDate: Date,
  startDate: Date
): boolean {
  const jsDay = candidateDate.getDay();
  const weekdayEntry = TASK_WEEKDAYS.find((w) => w.jsDay === jsDay);
  const weekdayKey = weekdayEntry ? weekdayEntry.key : 'monday';

  switch (cfg.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return jsDay >= 1 && jsDay <= 5;
    case 'weekly':
    case 'twice_weekly':
    case 'three_times_weekly':
    case 'custom_days':
      return cfg.days_of_week.includes(weekdayKey);
    case 'biweekly': {
      if (!cfg.days_of_week.includes(weekdayKey)) return false;
      // Compute calendar week difference from startDate's Sunday
      const startSun = new Date(startDate);
      startSun.setDate(startDate.getDate() - startDate.getDay());
      const candSun = new Date(candidateDate);
      candSun.setDate(candidateDate.getDate() - candidateDate.getDay());
      const diffWeeks = Math.round(
        (candSun.getTime() - startSun.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    }
    case 'monthly':
      return candidateDate.getDate() === startDate.getDate();
  }
}

/**
 * Generates all YYYY-MM-DD occurrence dates for a recurring task that fall within [rangeStart, rangeEnd].
 */
export function generateTaskOccurrenceDates(
  cfg: TaskRecurrenceConfig,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const startObj = new Date(`${cfg.start_date}T00:00:00`);
  const rangeStartObj = new Date(`${rangeStart}T00:00:00`);
  const rangeEndObj = new Date(`${rangeEnd}T00:00:00`);

  if (
    Number.isNaN(startObj.getTime()) ||
    Number.isNaN(rangeStartObj.getTime()) ||
    Number.isNaN(rangeEndObj.getTime()) ||
    rangeEndObj < startObj
  ) {
    return [];
  }

  const maxDateObj =
    cfg.end_type === 'on_date' && cfg.end_date
      ? new Date(`${cfg.end_date}T00:00:00`)
      : rangeEndObj;

  const effectiveEndObj =
    !Number.isNaN(maxDateObj.getTime()) && maxDateObj < rangeEndObj
      ? maxDateObj
      : rangeEndObj;

  if (effectiveEndObj < startObj) {
    return [];
  }

  const results: string[] = [];
  let totalGeneratedFromStart = 0;
  const maxOccurrences =
    cfg.end_type === 'after_count' && cfg.occurrence_count && cfg.occurrence_count > 0
      ? cfg.occurrence_count
      : null;

  // Iterate day by day from startObj up to effectiveEndObj (capped at 1500 days safety bound)
  const cursor = new Date(startObj);
  let safetyCounter = 0;

  while (cursor <= effectiveEndObj && safetyCounter < 1500) {
    safetyCounter += 1;
    if (matchesFrequencyOnDate(cfg, cursor, startObj)) {
      totalGeneratedFromStart += 1;
      const iso = formatIsoDateLocal(cursor);
      if (iso >= rangeStart && iso <= rangeEnd) {
        results.push(iso);
      }
      if (maxOccurrences !== null && totalGeneratedFromStart >= maxOccurrences) {
        break;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

/**
 * Finds the next uncompleted occurrence date on or after `cfg.start_date` so `due_date` on `school.tasks`
 * always reflects the next upcoming occurrence.
 */
export function computeNextUncompletedOccurrenceDate(
  cfg: TaskRecurrenceConfig
): { nextDate: string | null; allCompleted: boolean } {
  const startObj = new Date(`${cfg.start_date}T00:00:00`);
  if (Number.isNaN(startObj.getTime())) {
    return { nextDate: cfg.start_date, allCompleted: false };
  }

  const completedSet = new Set(cfg.completed_dates);
  const horizonEnd = new Date(startObj);
  horizonEnd.setDate(horizonEnd.getDate() + 400);
  const horizonEndStr = formatIsoDateLocal(horizonEnd);

  const upcoming = generateTaskOccurrenceDates(cfg, cfg.start_date, horizonEndStr);
  if (upcoming.length === 0) {
    return { nextDate: cfg.start_date, allCompleted: false };
  }

  const firstUncompleted = upcoming.find((d) => !completedSet.has(d));
  if (firstUncompleted) {
    return { nextDate: firstUncompleted, allCompleted: false };
  }

  // If bounded series and all generated occurrences are completed
  if (cfg.end_type !== 'never') {
    return {
      nextDate: upcoming[upcoming.length - 1] || cfg.start_date,
      allCompleted: true,
    };
  }

  return { nextDate: upcoming[upcoming.length - 1] || cfg.start_date, allCompleted: false };
}

/**
 * Expands a list of `school.tasks` into concrete scheduled occurrences within `[rangeStart, rangeEnd]`.
 * Includes both one-time tasks due in `[rangeStart, rangeEnd]` and recurring task occurrences in `[rangeStart, rangeEnd]`.
 */
export function expandTasksForDateRange(
  tasks: SchoolTaskRow[],
  rangeStart: string,
  rangeEnd: string
): ScheduledTaskOccurrence[] {
  const occurrences: ScheduledTaskOccurrence[] = [];

  for (const task of tasks) {
    const recCfg = task.is_recurring
      ? parseTaskRecurrenceConfig(task.recurrence_config, task.due_date)
      : null;

    if (task.is_recurring && recCfg) {
      const dates = generateTaskOccurrenceDates(recCfg, rangeStart, rangeEnd);
      const completedSet = new Set(recCfg.completed_dates);
      const summary = formatTaskRecurrenceSummary(recCfg);

      for (const dateStr of dates) {
        const isDone = task.status === 'completed' || completedSet.has(dateStr);
        occurrences.push({
          occurrenceId: `${task.id}::${dateStr}`,
          taskId: task.id,
          title: task.title,
          description: task.description,
          occurrenceDate: dateStr,
          priority: task.priority,
          isCompleted: isDone,
          isRecurring: true,
          recurrenceSummary: summary,
          task,
        });
      }
    } else if (task.due_date && task.due_date >= rangeStart && task.due_date <= rangeEnd) {
      occurrences.push({
        occurrenceId: `${task.id}::${task.due_date}`,
        taskId: task.id,
        title: task.title,
        description: task.description,
        occurrenceDate: task.due_date,
        priority: task.priority,
        isCompleted: task.status === 'completed',
        isRecurring: false,
        recurrenceSummary: null,
        task,
      });
    }
  }

  const priorityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  return occurrences.sort((a, b) => {
    const cmpDate = a.occurrenceDate.localeCompare(b.occurrenceDate);
    if (cmpDate !== 0) return cmpDate;
    return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
  });
}
