import { Json } from 'src/services/supabase/types';
import {
  getPhysicalScienceActivitySupplies,
  PHYSICAL_SCIENCE_COURSE_SYLLABUS,
} from './science-syllabi';

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

export type SyllabusSourceType = 'manual_upload' | 'api_sync';

export type ApiWeekdaySplitSource =
  | 'none'
  | 'full_week'
  | 'day_1'
  | 'day_2'
  | 'day_3'
  | 'day_4'
  | 'day_5'
  | 'day_4_and_5'
  | 'read_only'
  | 'memorize_only'
  | 'complete_and_do';

export interface ApiWeekdayRule {
  enabled: boolean;
  attend_class: boolean;
  attend_class_label: string;
  api_source: ApiWeekdaySplitSource;
  format_as_checkboxes: boolean;
  strip_week_header: boolean;
  include_linked_quiz_line: boolean;
  custom_additional_lines: string;
}

export interface ApiSyllabusAutoPopulateConfig {
  enabled: boolean;
  quiz_assignment_target_day: DayKey;
  auto_create_gradebook_assignments: boolean;
  weekday_rules: Record<DayKey, ApiWeekdayRule>;
}

export interface ApiLinkedAssessment {
  cmid: number;
  instance_id: number;
  name: string;
  modname: string;
  url?: string;
  open_date: string | null;
  due_date: string | null;
  due_timestamp: number | null;
  grade_raw: number | null;
  grade_max: number;
  percentage_formatted: string | null;
  weight_raw: number | null;
  weight_formatted: string | null;
  contribution_formatted: string | null;
  moodle_category: string;
  is_ungraded_bucket: boolean;
  feedback: string | null;
  status_label: 'graded' | 'submitted' | 'upcoming' | 'open';
}

export interface ApiSyllabusWeek {
  week_number: number;
  section_num: number;
  section_title: string;
  raw_summary: string;
  custom_override_text?: string;
  days_breakdown: {
    day_1?: string;
    day_2?: string;
    day_3?: string;
    day_4?: string;
    day_5?: string;
  };
  structured_lines: {
    header_line?: string;
    read_line?: string;
    memorize_line?: string;
    complete_line?: string;
    do_line?: string;
    other_lines: string[];
  };
  linked_assessments: ApiLinkedAssessment[];
}

export interface PortalIntegrationCourseMapping {
  moodle_course_id: number;
  course_fullname: string;
  course_shortname: string;
  subject_id: string | null;
  ignored: boolean;
}

export interface PortalIntegrationConfig {
  portal_login_url: string;
  moodle_base_url: string;
  username: string;
  password?: string;
  last_synced_at?: string;
  student_fullname?: string;
  moodle_user_id?: number;
  course_mappings: PortalIntegrationCourseMapping[];
}

export interface CourseSyllabusData {
  id?: string;
  course_title: string;
  official_course_name?: string;
  source_type?: SyllabusSourceType;
  uploaded_file_name?: string;
  moodle_course_id?: number;
  moodle_course_shortname?: string;
  portal_url?: string;
  last_synced_at?: string;
  teacher_name?: string;
  summary?: string;
  uploaded_at?: string;
  days: MathSyllabusDay[];
  weeks?: ApiSyllabusWeek[];
  api_auto_populate?: ApiSyllabusAutoPopulateConfig;
}

export type InstructionProviderType = 'internal' | 'external';

export interface SubjectInstructorInfo {
  provider_type: InstructionProviderType;
  outside_entity_name: string;
  teacher_name: string;
  teacher_email: string;
  teacher_phone: string;
  teacher_contact_notes: string;
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
  course_syllabi?: CourseSyllabusData[];
  active_syllabus_id?: string;
  instructor_info?: SubjectInstructorInfo;
}

export interface MathSyllabusDay {
  id: string;
  day_number: number;
  week_number?: number;
  unit?: string;
  activity?: string;
  supplies?: string[];
  semester: number;
  workbook: string;
  textbook: string;
  topic: string;
  materials: string;
  fast_facts: string;
  notes: string;
}

export function resolveSyllabusDaySupplies(day?: MathSyllabusDay | null): string[] {
  if (!day) return [];
  if (Array.isArray(day.supplies) && day.supplies.length > 0) {
    return day.supplies.filter((s) => typeof s === 'string' && s.trim().length > 0);
  }
  const activityName =
    day.activity ||
    (day.notes && /^activity\s*:/i.test(day.notes.trim())
      ? day.notes.trim().replace(/^activity\s*:\s*/i, '')
      : '');
  if (activityName) {
    return getPhysicalScienceActivitySupplies(activityName);
  }
  return [];
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

export function createDefaultApiWeekdayRule(): ApiWeekdayRule {
  return {
    enabled: false,
    attend_class: false,
    attend_class_label: 'Attend Class',
    api_source: 'none',
    format_as_checkboxes: true,
    strip_week_header: true,
    include_linked_quiz_line: false,
    custom_additional_lines: '',
  };
}

export function createDefaultApiAutoPopulateConfig(
  subjectName = '',
  courseTitle = ''
): ApiSyllabusAutoPopulateConfig {
  const combined = `${subjectName} ${courseTitle}`.toLowerCase();
  const isGreekMyths =
    combined.includes('greek') ||
    combined.includes('classical') ||
    combined.includes('cs400');
  const isFable =
    combined.includes('fable') ||
    combined.includes('composition') ||
    combined.includes('cw400');
  const isLatin =
    combined.includes('latin') ||
    combined.includes('christiana') ||
    combined.includes('la400');

  if (isGreekMyths) {
    return {
      enabled: true,
      quiz_assignment_target_day: 'thursday',
      auto_create_gradebook_assignments: true,
      weekday_rules: {
        monday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend Class',
          api_source: 'full_week',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        tuesday: {
          enabled: true,
          attend_class: true,
          attend_class_label: 'Attend Class',
          api_source: 'none',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        wednesday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend Class',
          api_source: 'none',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '- [ ] Memory Work',
        },
        thursday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend Class',
          api_source: 'none',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: true,
          custom_additional_lines: '',
        },
        friday: createDefaultApiWeekdayRule(),
      },
    };
  }

  if (isFable) {
    return {
      enabled: true,
      quiz_assignment_target_day: 'thursday',
      auto_create_gradebook_assignments: true,
      weekday_rules: {
        monday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_2',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        tuesday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_3',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        wednesday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_4_and_5',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        thursday: {
          enabled: true,
          attend_class: true,
          attend_class_label: 'Attend class',
          api_source: 'day_1',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: true,
          custom_additional_lines: '',
        },
        friday: createDefaultApiWeekdayRule(),
      },
    };
  }

  if (isLatin) {
    return {
      enabled: true,
      quiz_assignment_target_day: 'thursday',
      auto_create_gradebook_assignments: true,
      weekday_rules: {
        monday: {
          enabled: true,
          attend_class: true,
          attend_class_label: 'Attend class',
          api_source: 'day_1',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        tuesday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_2',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        wednesday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_3',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: false,
          custom_additional_lines: '',
        },
        thursday: {
          enabled: true,
          attend_class: false,
          attend_class_label: 'Attend class',
          api_source: 'day_4',
          format_as_checkboxes: true,
          strip_week_header: true,
          include_linked_quiz_line: true,
          custom_additional_lines: '',
        },
        friday: createDefaultApiWeekdayRule(),
      },
    };
  }

  return {
    enabled: true,
    quiz_assignment_target_day: 'thursday',
    auto_create_gradebook_assignments: true,
    weekday_rules: {
      monday: {
        ...createDefaultApiWeekdayRule(),
        enabled: true,
        api_source: 'full_week',
      },
      tuesday: createDefaultApiWeekdayRule(),
      wednesday: createDefaultApiWeekdayRule(),
      thursday: {
        ...createDefaultApiWeekdayRule(),
        enabled: true,
        include_linked_quiz_line: true,
      },
      friday: createDefaultApiWeekdayRule(),
    },
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
    base_week_num: 6,
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
    instructor_info: createDefaultInstructorInfo(subjectName),
  };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const VALID_API_SPLIT_SOURCES: ApiWeekdaySplitSource[] = [
  'none',
  'full_week',
  'day_1',
  'day_2',
  'day_3',
  'day_4',
  'day_5',
  'day_4_and_5',
  'read_only',
  'memorize_only',
  'complete_and_do',
];

function parseApiWeekdayRule(raw: unknown, fallback: ApiWeekdayRule): ApiWeekdayRule {
  if (!isRecord(raw)) return fallback;
  const apiSourceRaw = raw.api_source;
  const api_source: ApiWeekdaySplitSource =
    typeof apiSourceRaw === 'string' &&
    VALID_API_SPLIT_SOURCES.includes(apiSourceRaw as ApiWeekdaySplitSource)
      ? (apiSourceRaw as ApiWeekdaySplitSource)
      : fallback.api_source;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    attend_class: typeof raw.attend_class === 'boolean' ? raw.attend_class : fallback.attend_class,
    attend_class_label:
      typeof raw.attend_class_label === 'string'
        ? raw.attend_class_label
        : fallback.attend_class_label,
    api_source,
    format_as_checkboxes:
      typeof raw.format_as_checkboxes === 'boolean'
        ? raw.format_as_checkboxes
        : fallback.format_as_checkboxes,
    strip_week_header:
      typeof raw.strip_week_header === 'boolean'
        ? raw.strip_week_header
        : fallback.strip_week_header,
    include_linked_quiz_line:
      typeof raw.include_linked_quiz_line === 'boolean'
        ? raw.include_linked_quiz_line
        : fallback.include_linked_quiz_line,
    custom_additional_lines:
      typeof raw.custom_additional_lines === 'string'
        ? raw.custom_additional_lines
        : fallback.custom_additional_lines,
  };
}

function parseApiAutoPopulateConfig(
  raw: unknown,
  subjectName: string,
  courseTitle: string
): ApiSyllabusAutoPopulateConfig {
  const def = createDefaultApiAutoPopulateConfig(subjectName, courseTitle);
  if (!isRecord(raw)) return def;

  const targetDayRaw = raw.quiz_assignment_target_day;
  const quiz_assignment_target_day: DayKey =
    typeof targetDayRaw === 'string' && DAY_KEYS.includes(targetDayRaw as DayKey)
      ? (targetDayRaw as DayKey)
      : def.quiz_assignment_target_day;

  const rulesRaw = isRecord(raw.weekday_rules) ? raw.weekday_rules : {};
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : def.enabled,
    quiz_assignment_target_day,
    auto_create_gradebook_assignments:
      typeof raw.auto_create_gradebook_assignments === 'boolean'
        ? raw.auto_create_gradebook_assignments
        : def.auto_create_gradebook_assignments,
    weekday_rules: {
      monday: parseApiWeekdayRule(rulesRaw.monday, def.weekday_rules.monday),
      tuesday: parseApiWeekdayRule(rulesRaw.tuesday, def.weekday_rules.tuesday),
      wednesday: parseApiWeekdayRule(rulesRaw.wednesday, def.weekday_rules.wednesday),
      thursday: parseApiWeekdayRule(rulesRaw.thursday, def.weekday_rules.thursday),
      friday: parseApiWeekdayRule(rulesRaw.friday, def.weekday_rules.friday),
    },
  };
}

function parseApiWeeks(rawWeeks: unknown): ApiSyllabusWeek[] {
  if (!Array.isArray(rawWeeks)) return [];
  const parsed: ApiSyllabusWeek[] = [];

  for (let i = 0; i < rawWeeks.length; i++) {
    const rw = rawWeeks[i];
    if (!isRecord(rw)) continue;

    const dbRaw = isRecord(rw.days_breakdown) ? rw.days_breakdown : {};
    const slRaw = isRecord(rw.structured_lines) ? rw.structured_lines : {};
    const rawAssessments = Array.isArray(rw.linked_assessments) ? rw.linked_assessments : [];
    const linked_assessments: ApiLinkedAssessment[] = [];

    for (const ra of rawAssessments) {
      if (!isRecord(ra)) continue;
      const statusRaw = ra.status_label;
      const status_label: 'graded' | 'submitted' | 'upcoming' | 'open' =
        statusRaw === 'graded' ||
        statusRaw === 'submitted' ||
        statusRaw === 'upcoming' ||
        statusRaw === 'open'
          ? statusRaw
          : 'upcoming';

      linked_assessments.push({
        cmid: typeof ra.cmid === 'number' ? ra.cmid : 0,
        instance_id: typeof ra.instance_id === 'number' ? ra.instance_id : 0,
        name: typeof ra.name === 'string' ? ra.name : 'Assessment',
        modname: typeof ra.modname === 'string' ? ra.modname : 'quiz',
        url: typeof ra.url === 'string' ? ra.url : undefined,
        open_date: typeof ra.open_date === 'string' ? ra.open_date : null,
        due_date: typeof ra.due_date === 'string' ? ra.due_date : null,
        due_timestamp: typeof ra.due_timestamp === 'number' ? ra.due_timestamp : null,
        grade_raw: typeof ra.grade_raw === 'number' ? ra.grade_raw : null,
        grade_max: typeof ra.grade_max === 'number' ? ra.grade_max : 100,
        percentage_formatted:
          typeof ra.percentage_formatted === 'string' ? ra.percentage_formatted : null,
        weight_raw: typeof ra.weight_raw === 'number' ? ra.weight_raw : null,
        weight_formatted: typeof ra.weight_formatted === 'string' ? ra.weight_formatted : null,
        contribution_formatted:
          typeof ra.contribution_formatted === 'string' ? ra.contribution_formatted : null,
        moodle_category:
          typeof ra.moodle_category === 'string' ? ra.moodle_category : 'Current Quizzes',
        is_ungraded_bucket:
          typeof ra.is_ungraded_bucket === 'boolean' ? ra.is_ungraded_bucket : false,
        feedback: typeof ra.feedback === 'string' ? ra.feedback : null,
        status_label,
      });
    }

    parsed.push({
      week_number: typeof rw.week_number === 'number' ? rw.week_number : i + 1,
      section_num: typeof rw.section_num === 'number' ? rw.section_num : i + 1,
      section_title: typeof rw.section_title === 'string' ? rw.section_title : `Week ${i + 1}`,
      raw_summary: typeof rw.raw_summary === 'string' ? rw.raw_summary : '',
      custom_override_text:
        typeof rw.custom_override_text === 'string' ? rw.custom_override_text : undefined,
      days_breakdown: {
        day_1: typeof dbRaw.day_1 === 'string' ? dbRaw.day_1 : undefined,
        day_2: typeof dbRaw.day_2 === 'string' ? dbRaw.day_2 : undefined,
        day_3: typeof dbRaw.day_3 === 'string' ? dbRaw.day_3 : undefined,
        day_4: typeof dbRaw.day_4 === 'string' ? dbRaw.day_4 : undefined,
        day_5: typeof dbRaw.day_5 === 'string' ? dbRaw.day_5 : undefined,
      },
      structured_lines: {
        header_line: typeof slRaw.header_line === 'string' ? slRaw.header_line : undefined,
        read_line: typeof slRaw.read_line === 'string' ? slRaw.read_line : undefined,
        memorize_line: typeof slRaw.memorize_line === 'string' ? slRaw.memorize_line : undefined,
        complete_line: typeof slRaw.complete_line === 'string' ? slRaw.complete_line : undefined,
        do_line: typeof slRaw.do_line === 'string' ? slRaw.do_line : undefined,
        other_lines: Array.isArray(slRaw.other_lines)
          ? slRaw.other_lines.filter((l): l is string => typeof l === 'string')
          : [],
      },
      linked_assessments,
    });
  }

  return parsed;
}

function parseSingleCourseSyllabus(
  cs: Record<string, unknown>,
  subjectName: string,
  fallbackIndex = 0
): CourseSyllabusData {
  const rawDays = Array.isArray(cs.days) ? cs.days : [];
  const parsedDays: MathSyllabusDay[] = [];
  rawDays.forEach((rawDay: unknown, idx: number) => {
    if (!isRecord(rawDay)) return;
    const activity =
      typeof rawDay.activity === 'string' && rawDay.activity ? rawDay.activity : undefined;
    const rawSupplies = Array.isArray(rawDay.supplies)
      ? rawDay.supplies.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const effectiveSupplies =
      rawSupplies.length > 0
        ? rawSupplies
        : activity
        ? getPhysicalScienceActivitySupplies(activity)
        : [];
    parsedDays.push({
      id: typeof rawDay.id === 'string' && rawDay.id ? rawDay.id : `syl-day-${idx + 1}`,
      day_number: typeof rawDay.day_number === 'number' ? rawDay.day_number : idx + 1,
      week_number: typeof rawDay.week_number === 'number' ? rawDay.week_number : undefined,
      unit: typeof rawDay.unit === 'string' && rawDay.unit ? rawDay.unit : undefined,
      activity,
      supplies: effectiveSupplies.length > 0 ? effectiveSupplies : undefined,
      semester: typeof rawDay.semester === 'number' ? rawDay.semester : 1,
      workbook: typeof rawDay.workbook === 'string' ? rawDay.workbook : '',
      textbook: typeof rawDay.textbook === 'string' ? rawDay.textbook : '',
      topic: typeof rawDay.topic === 'string' ? rawDay.topic : '',
      materials:
        typeof rawDay.materials === 'string' && rawDay.materials
          ? rawDay.materials
          : effectiveSupplies.join(' • '),
      fast_facts: typeof rawDay.fast_facts === 'string' ? rawDay.fast_facts : '',
      notes: typeof rawDay.notes === 'string' ? rawDay.notes : '',
    });
  });

  const courseTitle =
    typeof cs.course_title === 'string' && cs.course_title.trim()
      ? cs.course_title
      : `${subjectName} Syllabus`;
  const sourceType: SyllabusSourceType =
    cs.source_type === 'api_sync' || cs.source_type === 'manual_upload'
      ? cs.source_type
      : typeof cs.moodle_course_id === 'number'
      ? 'api_sync'
      : 'manual_upload';

  const parsedWeeks = parseApiWeeks(cs.weeks);
  const slugId = courseTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    id:
      typeof cs.id === 'string' && cs.id.trim()
        ? cs.id.trim()
        : slugId || `syllabus-${fallbackIndex + 1}`,
    course_title: courseTitle,
    official_course_name:
      typeof cs.official_course_name === 'string' ? cs.official_course_name : undefined,
    source_type: sourceType,
    uploaded_file_name:
      typeof cs.uploaded_file_name === 'string' ? cs.uploaded_file_name : undefined,
    moodle_course_id: typeof cs.moodle_course_id === 'number' ? cs.moodle_course_id : undefined,
    moodle_course_shortname:
      typeof cs.moodle_course_shortname === 'string' ? cs.moodle_course_shortname : undefined,
    portal_url: typeof cs.portal_url === 'string' ? cs.portal_url : undefined,
    last_synced_at: typeof cs.last_synced_at === 'string' ? cs.last_synced_at : undefined,
    teacher_name: typeof cs.teacher_name === 'string' ? cs.teacher_name : undefined,
    summary: typeof cs.summary === 'string' ? cs.summary : undefined,
    uploaded_at: typeof cs.uploaded_at === 'string' ? cs.uploaded_at : undefined,
    days: parsedDays,
    weeks: parsedWeeks.length > 0 ? parsedWeeks : undefined,
    api_auto_populate:
      sourceType === 'api_sync' || isRecord(cs.api_auto_populate)
        ? parseApiAutoPopulateConfig(cs.api_auto_populate, subjectName, courseTitle)
        : undefined,
  };
}

export function getSubjectCourseSyllabi(config: SubjectRecurringConfig): CourseSyllabusData[] {
  const list: CourseSyllabusData[] = [];
  const seenIds = new Set<string>();

  if (Array.isArray(config.course_syllabi)) {
    for (let i = 0; i < config.course_syllabi.length; i++) {
      const item = config.course_syllabi[i];
      const id = item.id || `syllabus-${i + 1}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        list.push({ ...item, id });
      }
    }
  }

  if (config.course_syllabus) {
    const activeId =
      config.course_syllabus.id ||
      config.active_syllabus_id ||
      config.course_syllabus.course_title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      'default-syllabus';
    const existingIdx = list.findIndex(
      (s) => s.id === activeId || s.course_title === config.course_syllabus?.course_title
    );
    if (existingIdx >= 0) {
      list[existingIdx] = { ...config.course_syllabus, id: list[existingIdx].id || activeId };
    } else {
      list.unshift({ ...config.course_syllabus, id: activeId });
    }
  }

  return list;
}

export function getActiveCourseSyllabus(
  config: SubjectRecurringConfig
): CourseSyllabusData | undefined {
  const syllabi = getSubjectCourseSyllabi(config);
  if (config.active_syllabus_id) {
    const matched = syllabi.find((s) => s.id === config.active_syllabus_id);
    if (matched) return matched;
  }
  return config.course_syllabus || syllabi[0];
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
    course_syllabus = parseSingleCourseSyllabus(raw.course_syllabus, subjectName, 0);
  }

  const course_syllabi: CourseSyllabusData[] = [];
  if (Array.isArray(raw.course_syllabi)) {
    raw.course_syllabi.forEach((rawItem: unknown, idx: number) => {
      if (!isRecord(rawItem)) return;
      course_syllabi.push(parseSingleCourseSyllabus(rawItem, subjectName, idx));
    });
  }

  const isScienceSubject = subjectName.trim().toLowerCase() === 'science';
  if (isScienceSubject) {
    const hasPhysicalScience = course_syllabi.some(
      (s) =>
        s.id === PHYSICAL_SCIENCE_COURSE_SYLLABUS.id ||
        s.course_title.toLowerCase().includes('physical science')
    );
    if (!hasPhysicalScience) {
      course_syllabi.unshift(PHYSICAL_SCIENCE_COURSE_SYLLABUS);
    }
    if (!course_syllabus || course_syllabus.days.length === 0) {
      course_syllabus = PHYSICAL_SCIENCE_COURSE_SYLLABUS;
    }
  }

  if (course_syllabus) {
    const existingIndex = course_syllabi.findIndex(
      (s) => s.id === course_syllabus?.id || s.course_title === course_syllabus?.course_title
    );
    if (existingIndex === -1) {
      course_syllabi.unshift(course_syllabus);
    } else {
      course_syllabi[existingIndex] = course_syllabus;
    }
  }

  const active_syllabus_id =
    typeof raw.active_syllabus_id === 'string' && raw.active_syllabus_id
      ? raw.active_syllabus_id
      : course_syllabus?.id || course_syllabi[0]?.id;

  if (active_syllabus_id && course_syllabi.length > 0) {
    const matchedActive = course_syllabi.find((s) => s.id === active_syllabus_id);
    if (matchedActive) {
      course_syllabus = matchedActive;
    }
  }

  const defaultInstructor = createDefaultInstructorInfo(
    subjectName,
    course_syllabus?.source_type === 'api_sync',
    course_syllabus?.teacher_name
  );
  const instRaw = isRecord(raw.instructor_info) ? raw.instructor_info : undefined;
  const instructor_info: SubjectInstructorInfo = instRaw
    ? {
        provider_type:
          instRaw.provider_type === 'internal' || instRaw.provider_type === 'external'
            ? instRaw.provider_type
            : defaultInstructor.provider_type,
        outside_entity_name:
          typeof instRaw.outside_entity_name === 'string' && instRaw.outside_entity_name.trim()
            ? instRaw.outside_entity_name
            : defaultInstructor.outside_entity_name,
        teacher_name:
          typeof instRaw.teacher_name === 'string' && instRaw.teacher_name.trim()
            ? instRaw.teacher_name
            : defaultInstructor.teacher_name,
        teacher_email:
          typeof instRaw.teacher_email === 'string' && instRaw.teacher_email.trim()
            ? instRaw.teacher_email
            : defaultInstructor.teacher_email,
        teacher_phone:
          typeof instRaw.teacher_phone === 'string' && instRaw.teacher_phone.trim()
            ? instRaw.teacher_phone
            : defaultInstructor.teacher_phone,
        teacher_contact_notes:
          typeof instRaw.teacher_contact_notes === 'string' &&
          instRaw.teacher_contact_notes.trim() &&
          instRaw.teacher_contact_notes !== 'Memoria Academy Portal (mpoa.memoriapress.com)'
            ? instRaw.teacher_contact_notes
            : defaultInstructor.teacher_contact_notes,
      }
    : defaultInstructor;

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
    course_syllabi: course_syllabi.length > 0 ? course_syllabi : undefined,
    active_syllabus_id,
    instructor_info,
  };
}

export function createDefaultInstructorInfo(
  subjectName = '',
  hasApiSyllabus = false,
  syllabusTeacherName?: string
): SubjectInstructorInfo {
  const lower = subjectName.toLowerCase();
  if (lower.includes('latin')) {
    return {
      provider_type: 'external',
      outside_entity_name: 'Memoria Academy',
      teacher_name: syllabusTeacherName || 'Mrs. Anne Parry',
      teacher_email: 'aparry@memoriaacademy.com',
      teacher_phone: '',
      teacher_contact_notes: 'Class Time: Monday 2:40 - 4:10 PM ET',
    };
  }

  if (lower.includes('classical') || lower.includes('greek')) {
    return {
      provider_type: 'external',
      outside_entity_name: 'Memoria Academy',
      teacher_name: syllabusTeacherName || 'Mrs. Butler',
      teacher_email: 'abutler@memoriaacademy.com',
      teacher_phone: '',
      teacher_contact_notes: 'Class Time: Tuesday 1:00 - 2:00 PM ET',
    };
  }

  if (lower.includes('composition') || lower.includes('grammar') || lower.includes('fable')) {
    return {
      provider_type: 'external',
      outside_entity_name: 'Memoria Academy',
      teacher_name: syllabusTeacherName || 'Mrs. Holcombe',
      teacher_email: 'sholcombe@memoriaacademy.com',
      teacher_phone: '',
      teacher_contact_notes: 'Class Time: Thursdays 1:00 - 2:30 PM ET',
    };
  }

  if (hasApiSyllabus) {
    return {
      provider_type: 'external',
      outside_entity_name: 'Memoria Academy',
      teacher_name: syllabusTeacherName || '',
      teacher_email: '',
      teacher_phone: '',
      teacher_contact_notes: 'Memoria Academy Portal (mpoa.memoriapress.com)',
    };
  }

  if (lower.includes('math')) {
    return {
      provider_type: 'external',
      outside_entity_name: 'Amanda Holliday Math',
      teacher_name: syllabusTeacherName || 'Amanda Holliday',
      teacher_email: '',
      teacher_phone: '',
      teacher_contact_notes: '',
    };
  }

  return {
    provider_type: 'internal',
    outside_entity_name: '',
    teacher_name: syllabusTeacherName || 'Mom',
    teacher_email: '',
    teacher_phone: '',
    teacher_contact_notes: '',
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

  const activeSyl = getActiveCourseSyllabus(config);

  let resolvedWeekNum = override?.week_num !== undefined ? override.week_num : defaultWeekNum;
  let resolvedClassNum = override?.class_num !== undefined ? override.class_num : defaultClassNum;

  if (override?.week_num !== undefined && override?.class_num === undefined) {
    const firstClassForWeek = activeSyl?.days.find((d) => d.week_number === override.week_num);
    resolvedClassNum = firstClassForWeek
      ? firstClassForWeek.day_number
      : Math.max(1, (override.week_num - 1) * classesPerWeek + 1);
  } else if (override?.class_num !== undefined && override?.week_num === undefined) {
    const matchedClass = activeSyl?.days.find((d) => d.day_number === override.class_num);
    resolvedWeekNum =
      matchedClass?.week_number !== undefined
        ? matchedClass.week_number
        : Math.max(1, Math.ceil(override.class_num / classesPerWeek));
  }

  return {
    week_num: resolvedWeekNum,
    class_num: resolvedClassNum,
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

export function getOfficialCourseSubtitle(config: SubjectRecurringConfig): string | null {
  const syl = getActiveCourseSyllabus(config);
  if (!syl) return null;
  if (syl.official_course_name && syl.official_course_name.trim()) {
    return syl.official_course_name.trim();
  }
  if (syl.source_type === 'api_sync' && syl.course_title && syl.course_title.trim()) {
    return syl.course_title.trim();
  }
  return null;
}

export function formatApiWeekBlockForWeekday(
  week: ApiSyllabusWeek,
  rule: ApiWeekdayRule,
  tokens: { week: number; class_num: number; lesson: number; prev_lesson: number }
): { title: string | null; description: string } {
  if (!rule.enabled) {
    return { title: null, description: '' };
  }

  let noteHeader: string | null = null;
  if (rule.attend_class) {
    const formattedHeader = replaceTokens(rule.attend_class_label || 'Attend Class', tokens);
    noteHeader = stripLeadingBullet(formattedHeader) || null;
  }

  const rawLinesToFormat: string[] = [];
  const effectiveFullText = (week.custom_override_text ?? week.raw_summary).trim();

  switch (rule.api_source) {
    case 'none':
      break;
    case 'full_week': {
      const splitLines = effectiveFullText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of splitLines) {
        if (rule.strip_week_header && /^week\s+\d+\b/i.test(line) && line.length <= 24) {
          continue;
        }
        rawLinesToFormat.push(line);
      }
      break;
    }
    case 'day_1':
      if (week.days_breakdown.day_1) {
        rawLinesToFormat.push(...week.days_breakdown.day_1.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    case 'day_2':
      if (week.days_breakdown.day_2) {
        rawLinesToFormat.push(...week.days_breakdown.day_2.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    case 'day_3':
      if (week.days_breakdown.day_3) {
        rawLinesToFormat.push(...week.days_breakdown.day_3.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    case 'day_4':
      if (week.days_breakdown.day_4) {
        rawLinesToFormat.push(...week.days_breakdown.day_4.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    case 'day_5':
      if (week.days_breakdown.day_5) {
        rawLinesToFormat.push(...week.days_breakdown.day_5.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    case 'day_4_and_5': {
      if (week.days_breakdown.day_4) {
        rawLinesToFormat.push(...week.days_breakdown.day_4.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      if (week.days_breakdown.day_5) {
        rawLinesToFormat.push(...week.days_breakdown.day_5.split('\n').map((l) => l.trim()).filter(Boolean));
      }
      break;
    }
    case 'read_only':
      if (week.structured_lines.read_line) {
        rawLinesToFormat.push(week.structured_lines.read_line);
      }
      break;
    case 'memorize_only':
      if (week.structured_lines.memorize_line) {
        rawLinesToFormat.push(week.structured_lines.memorize_line);
      }
      break;
    case 'complete_and_do':
      if (week.structured_lines.complete_line) {
        rawLinesToFormat.push(week.structured_lines.complete_line);
      }
      if (week.structured_lines.do_line) {
        rawLinesToFormat.push(week.structured_lines.do_line);
      }
      break;
  }

  const formattedLines: string[] = [];
  for (const rawLine of rawLinesToFormat) {
    const cleaned = rawLine.replace(/^[-*•]\s*/, '').trim();
    if (!cleaned) continue;
    // Strip leading "Day X:" prefix if a single day block is selected and line is "Day 1: Complete..."
    const dayPrefixStripped =
      rule.api_source.startsWith('day_') && /^day\s+\d+\s*:\s*/i.test(cleaned)
        ? cleaned.replace(/^day\s+\d+\s*:\s*/i, '').trim()
        : cleaned;

    // Skip standalone "Day X" header lines when already mapped to a specific day
    if (rule.api_source.startsWith('day_') && /^day\s+\d+$/i.test(dayPrefixStripped)) {
      continue;
    }

    // Skip standalone "Attend class." line in body when rule.attend_class header is enabled
    if (rule.attend_class && /^attend\s+class\.?$/i.test(dayPrefixStripped)) {
      continue;
    }

    if (!dayPrefixStripped) continue;

    if (rule.format_as_checkboxes) {
      if (
        dayPrefixStripped.startsWith('- [ ]') ||
        dayPrefixStripped.startsWith('- [x]') ||
        dayPrefixStripped.startsWith('☐')
      ) {
        formattedLines.push(dayPrefixStripped);
      } else {
        formattedLines.push(`- [ ] ${dayPrefixStripped}`);
      }
    } else {
      formattedLines.push(`• ${dayPrefixStripped}`);
    }
  }

  if (rule.custom_additional_lines && rule.custom_additional_lines.trim()) {
    const customReplaced = replaceTokens(rule.custom_additional_lines.trim(), tokens);
    formattedLines.push(customReplaced);
  }

  if (rule.include_linked_quiz_line && week.linked_assessments.length > 0) {
    const existingJoined = formattedLines.join('\n').toLowerCase();
    for (const assessment of week.linked_assessments) {
      const shortName = assessment.name
        .replace(/--DUE[\s\S]*$/i, '')
        .replace(/^LC 4th Edition\s+/i, '')
        .trim();
      if (!existingJoined.includes(shortName.toLowerCase())) {
        formattedLines.push(
          rule.format_as_checkboxes ? `- [ ] ${shortName}` : `• ${shortName}`
        );
      }
    }
  }

  return {
    title: noteHeader,
    description: formattedLines.filter(Boolean).join('\n'),
  };
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

  // Check if this subject uses an API-synced syllabus with Auto-Populate enabled
  const courseSyl = getActiveCourseSyllabus(config);
  if (
    config.mode !== 'math_syllabus' &&
    courseSyl &&
    courseSyl.source_type === 'api_sync' &&
    courseSyl.api_auto_populate?.enabled &&
    courseSyl.weeks &&
    courseSyl.weeks.length > 0
  ) {
    const targetWeek =
      courseSyl.weeks.find((w) => w.week_number === counters.week_num) ||
      courseSyl.weeks[Math.min(courseSyl.weeks.length - 1, Math.max(0, counters.week_num - 1))];

    if (targetWeek) {
      const tokens = {
        week: counters.week_num,
        class_num: counters.class_num,
        lesson: counters.lesson_num,
        prev_lesson: Math.max(1, counters.lesson_num - 1),
      };
      for (const dayKey of DAY_KEYS) {
        const rule = courseSyl.api_auto_populate.weekday_rules[dayKey];
        result[dayKey] = formatApiWeekBlockForWeekday(targetWeek, rule, tokens);
      }
      return result;
    }
  }

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
          const cleanNote = activeSyllabus.notes.trim().replace(/^\s*\[PARENT_NOTE\]\s*/i, '');
          if (cleanNote) {
            lines.push(`[PARENT_NOTE] ${cleanNote}`);
          }
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

  // Standard 'template' mode (including class-based syllabi such as Science)
  let runningClassNum = counters.class_num;

  for (const dayKey of DAY_KEYS) {
    const dayCfg = config.days[dayKey];
    if (!dayCfg.enabled) continue;

    let noteHeader: string | null = null;
    const lines: string[] = [];

    const matchedClassDay =
      courseSyl?.days.find((d) => d.day_number === runningClassNum) ||
      syllabusMap.get(runningClassNum);
    const effectiveWeekNum = matchedClassDay?.week_number ?? counters.week_num;

    if (dayCfg.attend_class) {
      const formattedHeader = replaceTokens(dayCfg.attend_class_label || 'Attend Class', {
        week: effectiveWeekNum,
        class_num: runningClassNum,
        lesson: counters.lesson_num,
        prev_lesson: Math.max(1, counters.lesson_num - 1),
        day: runningClassNum,
        workbook: matchedClassDay?.workbook || '',
        textbook: matchedClassDay?.textbook || '',
        topic: matchedClassDay?.topic || '',
        materials: matchedClassDay?.materials || '',
        fast_facts: matchedClassDay?.fast_facts || '',
        unit: matchedClassDay?.unit || '',
        activity: matchedClassDay?.activity || '',
      });
      noteHeader = stripLeadingBullet(formattedHeader) || null;
    }

    if (dayCfg.fast_facts) {
      lines.push(
        replaceTokens(dayCfg.fast_facts_label || '- [ ] Fast Facts', {
          week: effectiveWeekNum,
          class_num: runningClassNum,
          lesson: counters.lesson_num,
          prev_lesson: Math.max(1, counters.lesson_num - 1),
          day: runningClassNum,
          workbook: matchedClassDay?.workbook || '',
          textbook: matchedClassDay?.textbook || '',
          topic: matchedClassDay?.topic || '',
          materials: matchedClassDay?.materials || '',
          fast_facts: matchedClassDay?.fast_facts || '',
          unit: matchedClassDay?.unit || '',
          activity: matchedClassDay?.activity || '',
        })
      );
    }

    if (dayCfg.template.trim()) {
      const rawTemplate = dayCfg.template.trim();
      const usesClassNum = rawTemplate.includes('{class_num}');
      const templateHasTopicToken = rawTemplate.includes('{topic}');
      const templateHasActivityToken = rawTemplate.includes('{activity}');

      let text = replaceTokens(rawTemplate, {
        week: effectiveWeekNum,
        class_num: runningClassNum,
        lesson: counters.lesson_num,
        prev_lesson: Math.max(1, counters.lesson_num - 1),
        day: runningClassNum,
        workbook: matchedClassDay?.workbook || '',
        textbook: matchedClassDay?.textbook || '',
        topic: matchedClassDay?.topic || '',
        materials: matchedClassDay?.materials || '',
        fast_facts: matchedClassDay?.fast_facts || '',
        unit: matchedClassDay?.unit || '',
        activity: matchedClassDay?.activity || '',
      });

      // Automatically append topic and activity for class-based syllabi when not explicitly tokenized
      if (usesClassNum && matchedClassDay) {
        if (matchedClassDay.topic && !templateHasTopicToken) {
          text = `${text}: ${matchedClassDay.topic}`;
        }
        const activityText =
          matchedClassDay.activity ||
          (matchedClassDay.notes && /^activity\s*:/i.test(matchedClassDay.notes.trim())
            ? matchedClassDay.notes.trim().replace(/^activity\s*:\s*/i, '')
            : '');
        if (activityText && !templateHasActivityToken) {
          text = `${text}\n- [ ] Activity: ${activityText}`;
        }
      }

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
    unit?: string;
    activity?: string;
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
    .replace(/\{fast_facts\}/g, tokens.fast_facts || '')
    .replace(/\{unit\}/g, tokens.unit || '')
    .replace(/\{activity\}/g, tokens.activity || '');
}
