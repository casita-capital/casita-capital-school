import { Json } from 'src/services/supabase/types';

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const DAY_KEYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
};

export interface DayRecurringConfig {
  enabled: boolean;
  attend_class: boolean;
  attend_class_label: string;
  fast_facts: boolean;
  fast_facts_label: string;
  template: string;
}

export interface MathRecurringConfig {
  base_tuesday_day: number;
  base_thursday_day: number;
  fast_facts_enabled: boolean;
  fast_facts_label: string;
  fast_facts_days: DayKey[];
  include_fast_facts_topic: boolean;
  attend_class_enabled: boolean;
  attend_class_label: string;
  attend_class_days: DayKey[];
  include_materials: boolean;
  include_topic: boolean;
  homework_enabled: boolean;
  homework_label: string;
  include_textbook: boolean;
  include_homework_notes: boolean;
  monday_homework_source: 'tuesday_class' | 'thursday_class' | 'none';
  wednesday_homework_source: 'tuesday_class' | 'thursday_class' | 'none';
}

export interface CourseSyllabusData {
  course_title: string;
  teacher_name?: string;
  summary?: string;
  uploaded_at?: string;
  days: MathSyllabusDay[];
}

export interface SubjectRecurringConfig {
  enabled: boolean;
  mode: 'template' | 'math_syllabus';
  base_week_date: string; // e.g., '2026-10-12'
  base_week_num: number; // e.g., 7
  base_class_num: number; // e.g., 19
  base_lesson_num: number; // e.g., 5
  days: Record<DayKey, DayRecurringConfig>;
  math_config?: MathRecurringConfig;
  course_syllabus?: CourseSyllabusData;
}

export interface MathSyllabusDay {
  id: string;
  day_number: number;
  semester: number;
  workbook: string;
  textbook: string;
  topic: string;
  materials: string;
  fast_facts: string;
  notes: string;
}

export interface SubjectWeekOverride {
  week_num?: number;
  class_num?: number;
  lesson_num?: number;
  tuesday_math_day?: number | null; // null or 0 means No Class / Skipped
  thursday_math_day?: number | null;
}

export type WeeklySubjectOverrides = Record<string, SubjectWeekOverride>;

export function createDefaultDayConfig(): DayRecurringConfig {
  return {
    enabled: false,
    attend_class: false,
    attend_class_label: 'Attend Class',
    fast_facts: false,
    fast_facts_label: '- [ ] Fast Facts',
    template: '',
  };
}

export function createDefaultMathConfig(): MathRecurringConfig {
  return {
    base_tuesday_day: 12,
    base_thursday_day: 13,
    fast_facts_enabled: true,
    fast_facts_label: '- [ ] Fast Facts',
    fast_facts_days: ['monday', 'tuesday', 'wednesday', 'thursday'],
    include_fast_facts_topic: false,
    attend_class_enabled: true,
    attend_class_label: 'Attend Class - Day {day}',
    attend_class_days: ['tuesday', 'thursday'],
    include_materials: false,
    include_topic: false,
    homework_enabled: true,
    homework_label: '- [ ] {workbook}',
    include_textbook: false,
    include_homework_notes: false,
    monday_homework_source: 'tuesday_class',
    wednesday_homework_source: 'thursday_class',
  };
}

export function createDefaultRecurringConfig(subjectName = ''): SubjectRecurringConfig {
  const isMath = subjectName.toLowerCase().includes('math');
  return {
    enabled: false,
    mode: isMath ? 'math_syllabus' : 'template',
    base_week_date: '2026-10-12',
    base_week_num: 7,
    base_class_num: 19,
    base_lesson_num: 5,
    days: {
      monday: createDefaultDayConfig(),
      tuesday: createDefaultDayConfig(),
      wednesday: createDefaultDayConfig(),
      thursday: createDefaultDayConfig(),
      friday: createDefaultDayConfig(),
    },
    math_config: isMath ? createDefaultMathConfig() : undefined,
  };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function parseRecurringConfig(raw: Json | null | undefined, subjectName = ''): SubjectRecurringConfig {
  const fallback = createDefaultRecurringConfig(subjectName);
  if (!isRecord(raw)) return fallback;

  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled;
  const mode = raw.mode === 'math_syllabus' || raw.mode === 'template' ? raw.mode : fallback.mode;
  const base_week_date = typeof raw.base_week_date === 'string' && raw.base_week_date ? raw.base_week_date : fallback.base_week_date;
  const base_week_num = typeof raw.base_week_num === 'number' ? raw.base_week_num : fallback.base_week_num;
  const base_class_num = typeof raw.base_class_num === 'number' ? raw.base_class_num : fallback.base_class_num;
  const base_lesson_num = typeof raw.base_lesson_num === 'number' ? raw.base_lesson_num : fallback.base_lesson_num;

  const daysRaw = isRecord(raw.days) ? raw.days : {};
  const days: Record<DayKey, DayRecurringConfig> = {
    monday: parseDayConfig(daysRaw.monday),
    tuesday: parseDayConfig(daysRaw.tuesday),
    wednesday: parseDayConfig(daysRaw.wednesday),
    thursday: parseDayConfig(daysRaw.thursday),
    friday: parseDayConfig(daysRaw.friday),
  };

  const mathRaw = isRecord(raw.math_config) ? raw.math_config : undefined;
  const defMath = createDefaultMathConfig();
  const math_config: MathRecurringConfig = mathRaw
    ? {
        base_tuesday_day: typeof mathRaw.base_tuesday_day === 'number' ? mathRaw.base_tuesday_day : defMath.base_tuesday_day,
        base_thursday_day: typeof mathRaw.base_thursday_day === 'number' ? mathRaw.base_thursday_day : defMath.base_thursday_day,
        fast_facts_enabled: typeof mathRaw.fast_facts_enabled === 'boolean' ? mathRaw.fast_facts_enabled : defMath.fast_facts_enabled,
        fast_facts_label: typeof mathRaw.fast_facts_label === 'string' ? mathRaw.fast_facts_label : defMath.fast_facts_label,
        fast_facts_days: Array.isArray(mathRaw.fast_facts_days)
          ? (mathRaw.fast_facts_days.filter((d): d is DayKey => typeof d === 'string' && DAY_KEYS.includes(d as DayKey)))
          : defMath.fast_facts_days,
        include_fast_facts_topic: typeof mathRaw.include_fast_facts_topic === 'boolean' ? mathRaw.include_fast_facts_topic : defMath.include_fast_facts_topic,
        attend_class_enabled: typeof mathRaw.attend_class_enabled === 'boolean' ? mathRaw.attend_class_enabled : defMath.attend_class_enabled,
        attend_class_label: typeof mathRaw.attend_class_label === 'string' ? mathRaw.attend_class_label : defMath.attend_class_label,
        attend_class_days: Array.isArray(mathRaw.attend_class_days)
          ? (mathRaw.attend_class_days.filter((d): d is DayKey => typeof d === 'string' && DAY_KEYS.includes(d as DayKey)))
          : defMath.attend_class_days,
        include_materials: typeof mathRaw.include_materials === 'boolean' ? mathRaw.include_materials : defMath.include_materials,
        include_topic: typeof mathRaw.include_topic === 'boolean' ? mathRaw.include_topic : defMath.include_topic,
        homework_enabled: typeof mathRaw.homework_enabled === 'boolean' ? mathRaw.homework_enabled : defMath.homework_enabled,
        homework_label: typeof mathRaw.homework_label === 'string' ? mathRaw.homework_label : defMath.homework_label,
        include_textbook: typeof mathRaw.include_textbook === 'boolean' ? mathRaw.include_textbook : defMath.include_textbook,
        include_homework_notes: typeof mathRaw.include_homework_notes === 'boolean' ? mathRaw.include_homework_notes : defMath.include_homework_notes,
        monday_homework_source:
          mathRaw.monday_homework_source === 'tuesday_class' ||
          mathRaw.monday_homework_source === 'thursday_class' ||
          mathRaw.monday_homework_source === 'none'
            ? mathRaw.monday_homework_source
            : defMath.monday_homework_source,
        wednesday_homework_source:
          mathRaw.wednesday_homework_source === 'tuesday_class' ||
          mathRaw.wednesday_homework_source === 'thursday_class' ||
          mathRaw.wednesday_homework_source === 'none'
            ? mathRaw.wednesday_homework_source
            : defMath.wednesday_homework_source,
      }
    : defMath;

  let course_syllabus: CourseSyllabusData | undefined;
  if (isRecord(raw.course_syllabus)) {
    const cs = raw.course_syllabus;
    const rawDays = Array.isArray(cs.days) ? cs.days : [];
    const parsedDays: MathSyllabusDay[] = [];
    rawDays.forEach((rawDay: unknown, idx: number) => {
      if (!isRecord(rawDay)) return;
      parsedDays.push({
        id: typeof rawDay.id === 'string' && rawDay.id ? rawDay.id : `syl-day-${idx + 1}`,
        day_number: typeof rawDay.day_number === 'number' ? rawDay.day_number : idx + 1,
        semester: typeof rawDay.semester === 'number' ? rawDay.semester : 1,
        workbook: typeof rawDay.workbook === 'string' ? rawDay.workbook : '',
        textbook: typeof rawDay.textbook === 'string' ? rawDay.textbook : '',
        topic: typeof rawDay.topic === 'string' ? rawDay.topic : '',
        materials: typeof rawDay.materials === 'string' ? rawDay.materials : '',
        fast_facts: typeof rawDay.fast_facts === 'string' ? rawDay.fast_facts : '',
        notes: typeof rawDay.notes === 'string' ? rawDay.notes : '',
      });
    });

    course_syllabus = {
      course_title: typeof cs.course_title === 'string' ? cs.course_title : `${subjectName} Syllabus`,
      teacher_name: typeof cs.teacher_name === 'string' ? cs.teacher_name : undefined,
      summary: typeof cs.summary === 'string' ? cs.summary : undefined,
      uploaded_at: typeof cs.uploaded_at === 'string' ? cs.uploaded_at : undefined,
      days: parsedDays,
    };
  }

  return {
    enabled,
    mode,
    base_week_date,
    base_week_num,
    base_class_num,
    base_lesson_num,
    days,
    math_config,
    course_syllabus,
  };
}

function parseDayConfig(raw: unknown): DayRecurringConfig {
  const def = createDefaultDayConfig();
  if (!isRecord(raw)) return def;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : def.enabled,
    attend_class: typeof raw.attend_class === 'boolean' ? raw.attend_class : def.attend_class,
    attend_class_label: typeof raw.attend_class_label === 'string' ? raw.attend_class_label : def.attend_class_label,
    fast_facts: typeof raw.fast_facts === 'boolean' ? raw.fast_facts : def.fast_facts,
    fast_facts_label: typeof raw.fast_facts_label === 'string' ? raw.fast_facts_label : def.fast_facts_label,
    template: typeof raw.template === 'string' ? raw.template : def.template,
  };
}

export function parseSubjectOverrides(raw: Json | null | undefined): WeeklySubjectOverrides {
  if (!isRecord(raw)) return {};
  const result: WeeklySubjectOverrides = {};
  for (const [subId, val] of Object.entries(raw)) {
    if (isRecord(val)) {
      result[subId] = {
        week_num: typeof val.week_num === 'number' ? val.week_num : undefined,
        class_num: typeof val.class_num === 'number' ? val.class_num : undefined,
        lesson_num: typeof val.lesson_num === 'number' ? val.lesson_num : undefined,
        tuesday_math_day:
          typeof val.tuesday_math_day === 'number'
            ? val.tuesday_math_day
            : val.tuesday_math_day === null
            ? null
            : undefined,
        thursday_math_day:
          typeof val.thursday_math_day === 'number'
            ? val.thursday_math_day
            : val.thursday_math_day === null
            ? null
            : undefined,
      };
    }
  }
  return result;
}

/**
 * Calculates number of whole weeks between baseWeekMonday and targetWeekMonday
 */
export function getWeeksDiff(baseWeekDate: string, targetWeekDate: string): number {
  const base = new Date(baseWeekDate + 'T00:00:00');
  const target = new Date(targetWeekDate + 'T00:00:00');
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Counts how many days in the week use `{class_num}` in their template
 */
export function countClassDaysPerWeek(config: SubjectRecurringConfig): number {
  let count = 0;
  for (const dayKey of DAY_KEYS) {
    const dayCfg = config.days[dayKey];
    if (dayCfg.enabled && dayCfg.template.includes('{class_num}')) {
      count++;
    }
  }
  return count > 0 ? count : 3;
}

export interface ResolvedSubjectCounters {
  week_num: number;
  class_num: number;
  lesson_num: number;
  tuesday_math_day: number | null;
  thursday_math_day: number | null;
}

export function resolveSubjectCountersForWeek(
  config: SubjectRecurringConfig,
  targetWeekDate: string,
  override?: SubjectWeekOverride
): ResolvedSubjectCounters {
  const weeksDiff = getWeeksDiff(config.base_week_date, targetWeekDate);
  const classesPerWeek = countClassDaysPerWeek(config);
  const mathCfg = config.math_config || createDefaultMathConfig();

  const defaultWeekNum = Math.max(1, config.base_week_num + weeksDiff);
  const defaultClassNum = Math.max(1, config.base_class_num + weeksDiff * classesPerWeek);
  const defaultLessonNum = Math.max(1, config.base_lesson_num + weeksDiff);

  const defaultTueDay = Math.max(1, mathCfg.base_tuesday_day + weeksDiff * 2);
  const defaultThuDay = Math.max(1, mathCfg.base_thursday_day + weeksDiff * 2);

  return {
    week_num: override?.week_num !== undefined ? override.week_num : defaultWeekNum,
    class_num: override?.class_num !== undefined ? override.class_num : defaultClassNum,
    lesson_num: override?.lesson_num !== undefined ? override.lesson_num : defaultLessonNum,
    tuesday_math_day:
      override?.tuesday_math_day !== undefined ? override.tuesday_math_day : defaultTueDay,
    thursday_math_day:
      override?.thursday_math_day !== undefined ? override.thursday_math_day : defaultThuDay,
  };
}

export interface GeneratedDayNote {
  title: string | null;
  description: string;
}

function stripLeadingBullet(text: string): string {
  return text.trim().replace(/^[-*•]\s*/, '').trim();
}

/**
 * Generates structured { title, description } Monday-Friday notes for a single subject on a given week.
 * When "Include Attend Class label" is enabled, that label becomes the bold Header (title) of the note.
 */
export function generateSubjectWeekNotesStructured(
  config: SubjectRecurringConfig,
  counters: ResolvedSubjectCounters,
  syllabusMap: Map<number, MathSyllabusDay>
): Record<DayKey, GeneratedDayNote> {
  const result: Record<DayKey, GeneratedDayNote> = {
    monday: { title: null, description: '' },
    tuesday: { title: null, description: '' },
    wednesday: { title: null, description: '' },
    thursday: { title: null, description: '' },
    friday: { title: null, description: '' },
  };

  if (!config.enabled) return result;

  if (config.mode === 'math_syllabus') {
    const mathCfg = config.math_config || createDefaultMathConfig();
    const tueDayNum = counters.tuesday_math_day;
    const thuDayNum = counters.thursday_math_day;

    const tueSyllabus = tueDayNum ? syllabusMap.get(tueDayNum) : undefined;
    const thuSyllabus = thuDayNum ? syllabusMap.get(thuDayNum) : undefined;

    for (const dayKey of DAY_KEYS) {
      const dayCfg = config.days[dayKey];
      let noteHeader: string | null = null;
      const lines: string[] = [];

      // Determine which syllabus day applies to this day of the week
      let activeSyllabusDayNum: number | null = null;
      let activeSyllabus: MathSyllabusDay | undefined;

      if (dayKey === 'tuesday') {
        activeSyllabusDayNum = tueDayNum;
        activeSyllabus = tueSyllabus;
      } else if (dayKey === 'thursday') {
        activeSyllabusDayNum = thuDayNum;
        activeSyllabus = thuSyllabus;
      } else if (dayKey === 'monday') {
        if (mathCfg.monday_homework_source === 'tuesday_class') {
          activeSyllabusDayNum = tueDayNum;
          activeSyllabus = tueSyllabus;
        } else if (mathCfg.monday_homework_source === 'thursday_class') {
          activeSyllabusDayNum = thuDayNum;
          activeSyllabus = thuSyllabus;
        }
      } else if (dayKey === 'wednesday') {
        if (mathCfg.wednesday_homework_source === 'thursday_class') {
          activeSyllabusDayNum = thuDayNum;
          activeSyllabus = thuSyllabus;
        } else if (mathCfg.wednesday_homework_source === 'tuesday_class') {
          activeSyllabusDayNum = tueDayNum;
          activeSyllabus = tueSyllabus;
        }
      }

      // 1. Attend Class (if enabled for this day -> placed as Bold Note Header!)
      const isAttendDay = mathCfg.attend_class_enabled && mathCfg.attend_class_days.includes(dayKey);
      if (isAttendDay && activeSyllabusDayNum) {
        let attendLine = (mathCfg.attend_class_label || 'Attend Class - Day {day}')
          .replace(/\{day\}/g, String(activeSyllabusDayNum))
          .replace(/\{topic\}/g, activeSyllabus?.topic || '')
          .replace(/\{materials\}/g, activeSyllabus?.materials || '');

        if (mathCfg.include_topic && activeSyllabus?.topic && !mathCfg.attend_class_label.includes('{topic}')) {
          attendLine += ` (${activeSyllabus.topic})`;
        }
        noteHeader = stripLeadingBullet(attendLine) || null;

        if (mathCfg.include_materials && activeSyllabus?.materials) {
          lines.push(`• Materials: ${activeSyllabus.materials}`);
        }
      }

      // 2. Fast Facts (if enabled for this day)
      const isFastFactsDay = mathCfg.fast_facts_enabled && mathCfg.fast_facts_days.includes(dayKey);
      if (isFastFactsDay) {
        const ffSyllabus = activeSyllabus || tueSyllabus || thuSyllabus;
        let ffLine = (mathCfg.fast_facts_label || '- [ ] Fast Facts')
          .replace(/\{fast_facts\}/g, ffSyllabus?.fast_facts || '');

        if (
          mathCfg.include_fast_facts_topic &&
          ffSyllabus?.fast_facts &&
          !mathCfg.fast_facts_label.includes('{fast_facts}')
        ) {
          ffLine += `: ${ffSyllabus.fast_facts}`;
        }
        lines.push(ffLine);
      }

      // 3. Syllabus Homework (Monday / Wednesday)
      const isHomeworkDay =
        mathCfg.homework_enabled &&
        ((dayKey === 'monday' && mathCfg.monday_homework_source !== 'none') ||
          (dayKey === 'wednesday' && mathCfg.wednesday_homework_source !== 'none'));

      if (isHomeworkDay && activeSyllabus) {
        if (activeSyllabus.workbook) {
          const hwLine = (mathCfg.homework_label || '- [ ] {workbook}')
            .replace(/\{workbook\}/g, activeSyllabus.workbook)
            .replace(/\{textbook\}/g, activeSyllabus.textbook || '')
            .replace(/\{day\}/g, String(activeSyllabus.day_number))
            .replace(/\{topic\}/g, activeSyllabus.topic || '');
          lines.push(hwLine);
        }
        if (mathCfg.include_textbook && activeSyllabus.textbook) {
          lines.push(`- [ ] Textbook: ${activeSyllabus.textbook}`);
        }
        if (mathCfg.include_homework_notes && activeSyllabus.notes) {
          lines.push(activeSyllabus.notes);
        }
      }

      // 4. Custom template on this day if any
      if (dayCfg.enabled && dayCfg.template.trim()) {
        const customText = replaceTokens(dayCfg.template.trim(), {
          week: counters.week_num,
          class_num: counters.class_num,
          lesson: counters.lesson_num,
          prev_lesson: Math.max(1, counters.lesson_num - 1),
          day: activeSyllabusDayNum || 0,
          workbook: activeSyllabus?.workbook || '',
          textbook: activeSyllabus?.textbook || '',
          topic: activeSyllabus?.topic || '',
          materials: activeSyllabus?.materials || '',
          fast_facts: activeSyllabus?.fast_facts || '',
        });
        lines.push(customText);
      }

      result[dayKey] = {
        title: noteHeader,
        description: lines.filter(Boolean).join('\n'),
      };
    }

    return result;
  }

  // Standard 'template' mode
  let runningClassNum = counters.class_num;

  for (const dayKey of DAY_KEYS) {
    const dayCfg = config.days[dayKey];
    if (!dayCfg.enabled) continue;

    let noteHeader: string | null = null;
    const lines: string[] = [];

    if (dayCfg.attend_class) {
      const formattedHeader = replaceTokens(dayCfg.attend_class_label || 'Attend Class', {
        week: counters.week_num,
        class_num: runningClassNum,
        lesson: counters.lesson_num,
        prev_lesson: Math.max(1, counters.lesson_num - 1),
      });
      noteHeader = stripLeadingBullet(formattedHeader) || null;
    }

    if (dayCfg.fast_facts) {
      lines.push(
        replaceTokens(dayCfg.fast_facts_label || '- [ ] Fast Facts', {
          week: counters.week_num,
          class_num: runningClassNum,
          lesson: counters.lesson_num,
          prev_lesson: Math.max(1, counters.lesson_num - 1),
        })
      );
    }

    if (dayCfg.template.trim()) {
      const usesClassNum = dayCfg.template.includes('{class_num}');
      const text = replaceTokens(dayCfg.template.trim(), {
        week: counters.week_num,
        class_num: runningClassNum,
        lesson: counters.lesson_num,
        prev_lesson: Math.max(1, counters.lesson_num - 1),
      });
      lines.push(text);
      if (usesClassNum) {
        runningClassNum += 1;
      }
    }

    result[dayKey] = {
      title: noteHeader,
      description: lines.filter(Boolean).join('\n'),
    };
  }

  return result;
}

/**
 * Generates the Monday-Friday note descriptions for a single subject on a given week
 */
export function generateSubjectWeekNotes(
  config: SubjectRecurringConfig,
  counters: ResolvedSubjectCounters,
  syllabusMap: Map<number, MathSyllabusDay>
): Record<DayKey, string> {
  const structured = generateSubjectWeekNotesStructured(config, counters, syllabusMap);
  const result: Record<DayKey, string> = {
    monday: '',
    tuesday: '',
    wednesday: '',
    thursday: '',
    friday: '',
  };
  for (const dk of DAY_KEYS) {
    const item = structured[dk];
    result[dk] = [item.title, item.description].filter(Boolean).join('\n');
  }
  return result;
}

function replaceTokens(
  template: string,
  tokens: {
    week: number;
    class_num: number;
    lesson: number;
    prev_lesson: number;
    day?: number;
    workbook?: string;
    textbook?: string;
    topic?: string;
    materials?: string;
    fast_facts?: string;
  }
): string {
  return template
    .replace(/\{week\}/g, String(tokens.week))
    .replace(/\{class_num\}/g, String(tokens.class_num))
    .replace(/\{lesson\}/g, String(tokens.lesson))
    .replace(/\{prev_lesson\}/g, String(tokens.prev_lesson))
    .replace(/\{day\}/g, tokens.day !== undefined ? String(tokens.day) : '')
    .replace(/\{workbook\}/g, tokens.workbook || '')
    .replace(/\{textbook\}/g, tokens.textbook || '')
    .replace(/\{topic\}/g, tokens.topic || '')
    .replace(/\{materials\}/g, tokens.materials || '')
    .replace(/\{fast_facts\}/g, tokens.fast_facts || '');
}
