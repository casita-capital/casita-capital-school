import { Json } from 'src/services/supabase/types';
import {
  DAY_KEYS,
  DayKey,
  getActiveCourseSyllabus,
  MathSyllabusDay,
  ResolvedSubjectCounters,
  resolveSyllabusDaySupplies,
  SubjectRecurringConfig,
} from 'src/utils/recurring-planner';

export type ScoringMode =
  | 'problems_calculator'
  | 'points'
  | 'percentage'
  | 'completion'
  | 'pass_fail';

export type AutoBehaviorMode = 'auto_create' | 'queue_for_approval' | 'ignore';

export type ParticipationScope =
  | 'per_class_event'
  | 'per_week'
  | 'per_module'
  | 'per_semester';

export type GradeDisplayMode = 'number_only' | 'letter_only' | 'number_and_letter';

export type CalculationBasis = 'running_ratio' | 'preset_total_points';

export type WeightingMode = 'category_weighted' | 'raw_points';

export type CourseLevel = 'standard' | 'honors' | 'ap' | 'dual_enrollment';

export type CreditCalculationMode = 'carnegie_hours' | 'fixed_preset';

export type WorkflowStatus =
  | 'staged'
  | 'ignored'
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'needs_grading'
  | 'completed';

export type AssignmentSourceType =
  | 'manual'
  | 'syllabus_staged'
  | 'recurring_template'
  | 'planner_promoted'
  | 'participation_auto';

export type LinkedWeeklySource =
  | 'custom'
  | 'math_workbook'
  | 'math_fast_facts'
  | 'attend_class'
  | 'weekly_template'
  | 'syllabus_row';

export interface AssignmentTypeConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  scoring_mode: ScoringMode;
  default_points: number;
  default_weight: number;
  color: string;
  icon: string;
  is_graded_by_default: boolean;
  sort_order: number;
}

export interface CategoryWeightRule {
  weight: number;
  drop_lowest: number;
  enabled: boolean;
}

export interface GradingScaleCutoffs {
  A: number;
  B: number;
  C: number;
  D: number;
}

export interface SubjectGradingPolicy {
  broader_discipline: string;
  course_code: string;
  course_level: CourseLevel;
  grade_display_mode: GradeDisplayMode;
  calculation_basis: CalculationBasis;
  preset_total_points: number;
  weighting_mode: WeightingMode;
  participation_enabled: boolean;
  participation_scope: ParticipationScope;
  participation_auto_behavior: AutoBehaviorMode;
  participation_points: number;
  credit_calculation_mode: CreditCalculationMode;
  preset_credits: number;
  category_weights: Record<string, CategoryWeightRule>;
  grading_scale: GradingScaleCutoffs;
}

export interface SubjectWithGrading {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  link?: string | null;
  recurring_config?: Json | null;
  broader_discipline?: string;
  course_code?: string;
  course_level?: CourseLevel;
  grade_display_mode?: GradeDisplayMode;
  calculation_basis?: CalculationBasis;
  preset_total_points?: number;
  weighting_mode?: WeightingMode;
  participation_enabled?: boolean;
  participation_scope?: ParticipationScope;
  participation_auto_behavior?: AutoBehaviorMode;
  participation_points?: number;
  credit_calculation_mode?: CreditCalculationMode;
  preset_credits?: number;
  grading_config?: Json | null;
}

export interface ResourceLinkItem {
  label: string;
  url: string;
}

export interface SubmissionFileItem {
  name: string;
  url: string;
  uploaded_at: string;
}

export interface GradebookAssignment {
  id: string;
  title: string;
  description: string | null;
  instructions?: string | null;
  subject_id: string | null;
  assigned_date?: string | null;
  due_date: string;
  due_time?: string | null;
  completed_at?: string | null;
  estimated_minutes?: number;
  actual_minutes?: number | null;
  priority: 'low' | 'medium' | 'high';
  category: string;
  status: 'pending' | 'in_progress' | 'completed';
  workflow_status?: WorkflowStatus;
  is_graded?: boolean;
  grading_mode?: ScoringMode;
  total_problems?: number | null;
  missed_problems?: number | null;
  points_possible?: number;
  points_earned?: number | null;
  percentage_score?: number | null;
  letter_grade?: string | null;
  is_exempt?: boolean;
  is_dropped?: boolean;
  requires_manual_review?: boolean;
  source_type?: AssignmentSourceType;
  recurring_template_id?: string | null;
  syllabus_day_number?: number | null;
  linked_note_id?: string | null;
  term_name?: string;
  academic_year?: string;
  teacher_comments?: string | null;
  resource_urls?: Json;
  submission_files?: Json;
  state_standards?: Json;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecurringAssignmentTemplate {
  id: string;
  subject_id: string;
  title_template: string;
  instructions_template: string;
  assignment_type_slug: string;
  grading_mode: ScoringMode;
  points_possible: number;
  total_problems_default: number | null;
  days_of_week: DayKey[];
  linked_weekly_source: LinkedWeeklySource;
  auto_behavior: AutoBehaviorMode;
  estimated_minutes: number;
  is_active: boolean;
}

export interface SubjectTermOverride {
  id?: string;
  subject_id: string;
  term_name: string;
  academic_year: string;
  override_percentage: number | null;
  override_letter_grade: string | null;
  override_credits: number | null;
  teacher_observations: string;
  portfolio_notes: string;
}

export const DEFAULT_ASSIGNMENT_TYPES: AssignmentTypeConfig[] = [
  {
    id: 'type-math-problems',
    name: 'Math Problem Set',
    slug: 'math_problem_set',
    description:
      'Daily or bi-weekly math workbook and textbook problem sets. Enter Total Problems and Missed Problems after completion to automatically compute % correct.',
    scoring_mode: 'problems_calculator',
    default_points: 100,
    default_weight: 30,
    color: '#0C74E4',
    icon: 'Calculator',
    is_graded_by_default: true,
    sort_order: 1,
  },
  {
    id: 'type-homework',
    name: 'Daily Homework',
    slug: 'homework',
    description:
      'Regular daily or weekly homework assignments, worksheets, and practice exercises.',
    scoring_mode: 'points',
    default_points: 100,
    default_weight: 25,
    color: '#02876f',
    icon: 'FileText',
    is_graded_by_default: true,
    sort_order: 2,
  },
  {
    id: 'type-spelling-test',
    name: 'Spelling Test',
    slug: 'spelling_test',
    description:
      'Weekly Thursday or Friday spelling assessment. Enter total words and missed words to calculate % score.',
    scoring_mode: 'problems_calculator',
    default_points: 20,
    default_weight: 40,
    color: '#D97706',
    icon: 'CheckSquare',
    is_graded_by_default: true,
    sort_order: 3,
  },
  {
    id: 'type-quiz',
    name: 'Quiz',
    slug: 'quiz',
    description:
      'Short periodic assessments checking comprehension of recent lessons, vocabulary, or concepts.',
    scoring_mode: 'points',
    default_points: 50,
    default_weight: 20,
    color: '#894AE0',
    icon: 'Sparkles',
    is_graded_by_default: true,
    sort_order: 4,
  },
  {
    id: 'type-test',
    name: 'Unit Test / Exam',
    slug: 'test',
    description:
      'Major chapter, unit, or semester exams evaluating cumulative mastery of course material.',
    scoring_mode: 'points',
    default_points: 100,
    default_weight: 35,
    color: '#ea2012',
    icon: 'Award',
    is_graded_by_default: true,
    sort_order: 5,
  },
  {
    id: 'type-participation',
    name: 'Class Participation',
    slug: 'participation',
    description:
      'Engagement, preparedness, discussion, and attentiveness attached to each class event, week, module, or semester.',
    scoring_mode: 'points',
    default_points: 10,
    default_weight: 10,
    color: '#018a3c',
    icon: 'Users',
    is_graded_by_default: true,
    sort_order: 6,
  },
  {
    id: 'type-paper',
    name: 'Writing / Composition',
    slug: 'paper',
    description:
      'Intermittent teacher-assigned essays, drafts, compositions, and research papers evaluated with teacher feedback.',
    scoring_mode: 'points',
    default_points: 100,
    default_weight: 25,
    color: '#4F46E5',
    icon: 'Edit3',
    is_graded_by_default: true,
    sort_order: 7,
  },
  {
    id: 'type-project',
    name: 'Project / Lab',
    slug: 'project',
    description: 'Hands-on science labs, presentations, history projects, and creative builds.',
    scoring_mode: 'points',
    default_points: 100,
    default_weight: 20,
    color: '#DB2777',
    icon: 'Layers',
    is_graded_by_default: true,
    sort_order: 8,
  },
  {
    id: 'type-reading',
    name: 'Reading / Literature',
    slug: 'reading',
    description:
      'Assigned chapters, literature readings, and reading comprehension checks.',
    scoring_mode: 'completion',
    default_points: 10,
    default_weight: 10,
    color: '#0891B2',
    icon: 'BookOpen',
    is_graded_by_default: false,
    sort_order: 9,
  },
  {
    id: 'type-activity',
    name: 'Activity',
    slug: 'activity',
    description:
      'Hands-on syllabus activities, science experiments, and practical exercises linked to class lessons and required supply lists.',
    scoring_mode: 'completion',
    default_points: 100,
    default_weight: 20,
    color: '#2e7d32',
    icon: 'Sparkles',
    is_graded_by_default: true,
    sort_order: 10,
  },
];

export const BROADER_DISCIPLINES: string[] = [
  'Mathematics',
  'English / Language Arts',
  'Science',
  'History / Social Studies',
  'Classical / Foreign Language',
  'Bible / Theology',
  'Fine Arts / Electives',
  'Physical Education',
  'General',
];

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function inferDisciplineFromSubjectName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('math') || lower.includes('algebra') || lower.includes('geometry')) {
    return 'Mathematics';
  }
  if (
    lower.includes('english') ||
    lower.includes('grammar') ||
    lower.includes('composition') ||
    lower.includes('spelling') ||
    lower.includes('reading') ||
    lower.includes('literature') ||
    lower.includes('writing')
  ) {
    return 'English / Language Arts';
  }
  if (lower.includes('science') || lower.includes('biology') || lower.includes('chemistry') || lower.includes('physics')) {
    return 'Science';
  }
  if (lower.includes('history') || lower.includes('biblioplan') || lower.includes('geography') || lower.includes('civics')) {
    return 'History / Social Studies';
  }
  if (lower.includes('latin') || lower.includes('spanish') || lower.includes('french') || lower.includes('classical')) {
    return 'Classical / Foreign Language';
  }
  if (lower.includes('bible') || lower.includes('theology')) {
    return 'Bible / Theology';
  }
  if (lower.includes('p.e.') || lower.includes('physical')) {
    return 'Physical Education';
  }
  return 'Fine Arts / Electives';
}

export function createDefaultGradingPolicy(subjectName = ''): SubjectGradingPolicy {
  const isMath = subjectName.toLowerCase().includes('math');
  const isSpelling = subjectName.toLowerCase().includes('spelling');

  const defaultWeights: Record<string, CategoryWeightRule> = {
    math_problem_set: { weight: isMath ? 35 : 25, drop_lowest: 0, enabled: isMath },
    homework: { weight: 25, drop_lowest: 0, enabled: !isMath },
    spelling_test: { weight: isSpelling ? 60 : 20, drop_lowest: 0, enabled: isSpelling },
    quiz: { weight: 20, drop_lowest: 0, enabled: true },
    test: { weight: 35, drop_lowest: 0, enabled: true },
    participation: { weight: 10, drop_lowest: 0, enabled: true },
    paper: { weight: 25, drop_lowest: 0, enabled: !isMath && !isSpelling },
    project: { weight: 20, drop_lowest: 0, enabled: true },
    reading: { weight: 10, drop_lowest: 0, enabled: false },
    activity: { weight: 20, drop_lowest: 0, enabled: true },
  };

  return {
    broader_discipline: inferDisciplineFromSubjectName(subjectName),
    course_code: subjectName
      ? `${subjectName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-101`
      : 'CRS-101',
    course_level: 'standard',
    grade_display_mode: 'number_and_letter',
    calculation_basis: 'running_ratio',
    preset_total_points: 1000,
    weighting_mode: 'category_weighted',
    participation_enabled: false,
    participation_scope: 'per_week',
    participation_auto_behavior: 'queue_for_approval',
    participation_points: 10,
    credit_calculation_mode: 'fixed_preset',
    preset_credits: 1.0,
    category_weights: defaultWeights,
    grading_scale: { A: 90, B: 80, C: 70, D: 60 },
  };
}

export function parseSubjectGradingPolicy(sub: SubjectWithGrading): SubjectGradingPolicy {
  const fallback = createDefaultGradingPolicy(sub.name);
  const rawCfg = isRecord(sub.grading_config) ? sub.grading_config : {};

  const parseCourseLevel = (val: unknown): CourseLevel => {
    if (val === 'standard' || val === 'honors' || val === 'ap' || val === 'dual_enrollment') {
      return val;
    }
    return fallback.course_level;
  };

  const parseDisplayMode = (val: unknown): GradeDisplayMode => {
    if (val === 'number_only' || val === 'letter_only' || val === 'number_and_letter') {
      return val;
    }
    return fallback.grade_display_mode;
  };

  const parseCalcBasis = (val: unknown): CalculationBasis => {
    if (val === 'running_ratio' || val === 'preset_total_points') {
      return val;
    }
    return fallback.calculation_basis;
  };

  const parseWeightingMode = (val: unknown): WeightingMode => {
    if (val === 'category_weighted' || val === 'raw_points') {
      return val;
    }
    return fallback.weighting_mode;
  };

  const parsePartScope = (val: unknown): ParticipationScope => {
    if (
      val === 'per_class_event' ||
      val === 'per_week' ||
      val === 'per_module' ||
      val === 'per_semester'
    ) {
      return val;
    }
    return fallback.participation_scope;
  };

  const parseAutoBehavior = (val: unknown): AutoBehaviorMode => {
    if (val === 'auto_create' || val === 'queue_for_approval' || val === 'ignore') {
      return val;
    }
    return fallback.participation_auto_behavior;
  };

  const parseCreditMode = (val: unknown): CreditCalculationMode => {
    if (val === 'carnegie_hours' || val === 'fixed_preset') {
      return val;
    }
    return fallback.credit_calculation_mode;
  };

  const categoryWeights: Record<string, CategoryWeightRule> = { ...fallback.category_weights };
  if (isRecord(rawCfg.category_weights)) {
    for (const [slug, ruleVal] of Object.entries(rawCfg.category_weights)) {
      if (isRecord(ruleVal)) {
        categoryWeights[slug] = {
          weight: typeof ruleVal.weight === 'number' ? ruleVal.weight : 20,
          drop_lowest: typeof ruleVal.drop_lowest === 'number' ? ruleVal.drop_lowest : 0,
          enabled: typeof ruleVal.enabled === 'boolean' ? ruleVal.enabled : true,
        };
      }
    }
  }

  let gradingScale: GradingScaleCutoffs = fallback.grading_scale;
  if (isRecord(rawCfg.grading_scale)) {
    gradingScale = {
      A: typeof rawCfg.grading_scale.A === 'number' ? rawCfg.grading_scale.A : 90,
      B: typeof rawCfg.grading_scale.B === 'number' ? rawCfg.grading_scale.B : 80,
      C: typeof rawCfg.grading_scale.C === 'number' ? rawCfg.grading_scale.C : 70,
      D: typeof rawCfg.grading_scale.D === 'number' ? rawCfg.grading_scale.D : 60,
    };
  }

  return {
    broader_discipline:
      (typeof sub.broader_discipline === 'string' && sub.broader_discipline !== 'General'
        ? sub.broader_discipline
        : typeof rawCfg.broader_discipline === 'string'
        ? rawCfg.broader_discipline
        : fallback.broader_discipline) || fallback.broader_discipline,
    course_code:
      (typeof sub.course_code === 'string' && sub.course_code
        ? sub.course_code
        : typeof rawCfg.course_code === 'string'
        ? rawCfg.course_code
        : fallback.course_code) || fallback.course_code,
    course_level: parseCourseLevel(sub.course_level ?? rawCfg.course_level),
    grade_display_mode: parseDisplayMode(sub.grade_display_mode ?? rawCfg.grade_display_mode),
    calculation_basis: parseCalcBasis(sub.calculation_basis ?? rawCfg.calculation_basis),
    preset_total_points:
      typeof sub.preset_total_points === 'number'
        ? sub.preset_total_points
        : typeof rawCfg.preset_total_points === 'number'
        ? rawCfg.preset_total_points
        : fallback.preset_total_points,
    weighting_mode: parseWeightingMode(sub.weighting_mode ?? rawCfg.weighting_mode),
    participation_enabled:
      typeof sub.participation_enabled === 'boolean'
        ? sub.participation_enabled
        : typeof rawCfg.participation_enabled === 'boolean'
        ? rawCfg.participation_enabled
        : fallback.participation_enabled,
    participation_scope: parsePartScope(sub.participation_scope ?? rawCfg.participation_scope),
    participation_auto_behavior: parseAutoBehavior(
      sub.participation_auto_behavior ?? rawCfg.participation_auto_behavior
    ),
    participation_points:
      typeof sub.participation_points === 'number'
        ? sub.participation_points
        : typeof rawCfg.participation_points === 'number'
        ? rawCfg.participation_points
        : fallback.participation_points,
    credit_calculation_mode: parseCreditMode(
      sub.credit_calculation_mode ?? rawCfg.credit_calculation_mode
    ),
    preset_credits:
      typeof sub.preset_credits === 'number'
        ? sub.preset_credits
        : typeof rawCfg.preset_credits === 'number'
        ? rawCfg.preset_credits
        : fallback.preset_credits,
    category_weights: categoryWeights,
    grading_scale: gradingScale,
  };
}

export interface ComputedAssignmentMetrics {
  correct_problems: number | null;
  points_possible: number;
  points_earned: number | null;
  percentage_score: number | null;
  letter_grade: string | null;
  is_scored: boolean;
}

export function percentageToLetterGrade(
  percentage: number | null,
  scale: GradingScaleCutoffs = { A: 90, B: 80, C: 70, D: 60 }
): string {
  if (percentage === null || Number.isNaN(percentage)) return '—';
  if (percentage >= scale.A + 7) return 'A+';
  if (percentage >= scale.A + 3) return 'A';
  if (percentage >= scale.A) return 'A-';
  if (percentage >= scale.B + 7) return 'B+';
  if (percentage >= scale.B + 3) return 'B';
  if (percentage >= scale.B) return 'B-';
  if (percentage >= scale.C + 7) return 'C+';
  if (percentage >= scale.C + 3) return 'C';
  if (percentage >= scale.C) return 'C-';
  if (percentage >= scale.D) return 'D';
  return 'F';
}

export function letterGradeToGpaPoints(
  letter: string,
  courseLevel: CourseLevel = 'standard'
): { unweighted: number; weighted: number } {
  const clean = letter.trim().toUpperCase();
  let base = 0;
  if (clean.startsWith('A')) base = 4.0;
  else if (clean.startsWith('B')) base = 3.0;
  else if (clean.startsWith('C')) base = 2.0;
  else if (clean.startsWith('D')) base = 1.0;
  else if (clean === 'PASS' || clean === 'P') base = 4.0;
  else base = 0.0;

  let bump = 0;
  if (base >= 2.0) {
    if (courseLevel === 'honors') bump = 0.5;
    else if (courseLevel === 'ap' || courseLevel === 'dual_enrollment') bump = 1.0;
  }

  return {
    unweighted: base,
    weighted: Math.min(5.0, base + bump),
  };
}

/**
 * Computes assignment score from Total/Missed Problems, Points, Percentage, or Completion.
 */
export function computeAssignmentMetrics(params: {
  grading_mode: ScoringMode;
  total_problems?: number | null;
  missed_problems?: number | null;
  points_possible?: number | null;
  points_earned?: number | null;
  percentage_score?: number | null;
  status?: 'pending' | 'in_progress' | 'completed';
  workflow_status?: WorkflowStatus;
  scale?: GradingScaleCutoffs;
}): ComputedAssignmentMetrics {
  const scale = params.scale || { A: 90, B: 80, C: 70, D: 60 };
  const ptsPossible =
    typeof params.points_possible === 'number' && params.points_possible > 0
      ? params.points_possible
      : 100;

  if (params.grading_mode === 'problems_calculator') {
    const total =
      typeof params.total_problems === 'number' && params.total_problems > 0
        ? params.total_problems
        : null;
    const missed =
      typeof params.missed_problems === 'number' && params.missed_problems >= 0
        ? params.missed_problems
        : null;

    if (total !== null && missed !== null) {
      const correct = Math.max(0, total - missed);
      const pct = Number(((correct / total) * 100).toFixed(2));
      const earned = Number(((pct / 100) * ptsPossible).toFixed(2));
      return {
        correct_problems: correct,
        points_possible: ptsPossible,
        points_earned: earned,
        percentage_score: pct,
        letter_grade: percentageToLetterGrade(pct, scale),
        is_scored: true,
      };
    }

    return {
      correct_problems: null,
      points_possible: ptsPossible,
      points_earned: null,
      percentage_score: null,
      letter_grade: null,
      is_scored: false,
    };
  }

  if (params.grading_mode === 'percentage') {
    if (typeof params.percentage_score === 'number' && !Number.isNaN(params.percentage_score)) {
      const pct = Number(params.percentage_score.toFixed(2));
      const earned = Number(((pct / 100) * ptsPossible).toFixed(2));
      return {
        correct_problems: null,
        points_possible: ptsPossible,
        points_earned: earned,
        percentage_score: pct,
        letter_grade: percentageToLetterGrade(pct, scale),
        is_scored: true,
      };
    }
    return {
      correct_problems: null,
      points_possible: ptsPossible,
      points_earned: null,
      percentage_score: null,
      letter_grade: null,
      is_scored: false,
    };
  }

  if (params.grading_mode === 'completion' || params.grading_mode === 'pass_fail') {
    const isDone =
      params.workflow_status === 'completed' ||
      params.status === 'completed' ||
      (typeof params.points_earned === 'number' && params.points_earned > 0);
    if (isDone) {
      const earned =
        typeof params.points_earned === 'number' ? params.points_earned : ptsPossible;
      const pct = Number(((earned / ptsPossible) * 100).toFixed(2));
      return {
        correct_problems: null,
        points_possible: ptsPossible,
        points_earned: earned,
        percentage_score: pct,
        letter_grade: params.grading_mode === 'pass_fail' ? (pct >= 60 ? 'Pass' : 'Fail') : percentageToLetterGrade(pct, scale),
        is_scored: true,
      };
    }
    return {
      correct_problems: null,
      points_possible: ptsPossible,
      points_earned: null,
      percentage_score: null,
      letter_grade: null,
      is_scored: false,
    };
  }

  // Default: 'points' mode
  if (typeof params.points_earned === 'number' && !Number.isNaN(params.points_earned)) {
    const earned = Number(params.points_earned.toFixed(2));
    const pct = Number(((earned / ptsPossible) * 100).toFixed(2));
    return {
      correct_problems: null,
      points_possible: ptsPossible,
      points_earned: earned,
      percentage_score: pct,
      letter_grade: percentageToLetterGrade(pct, scale),
      is_scored: true,
    };
  }

  return {
    correct_problems: null,
    points_possible: ptsPossible,
    points_earned: null,
    percentage_score: null,
    letter_grade: null,
    is_scored: false,
  };
}

export interface MoodleCategorySummary {
  category_name: string;
  weight_formatted: string;
  weight_numeric: number;
  grade_formatted: string;
  percentage_numeric: number | null;
  is_empty: boolean;
  is_ungraded_bucket: boolean;
}

export interface MoodleGradeItemSummary {
  cmid: number | null;
  item_id: number | null;
  item_name: string;
  item_module: string;
  category_name: string;
  week_number: number | null;
  weight_formatted: string;
  weight_numeric: number | null;
  grade_formatted: string;
  grade_raw: number | null;
  grade_max: number;
  range_formatted: string;
  percentage_formatted: string;
  contribution_formatted: string;
  contribution_numeric: number | null;
  feedback: string | null;
  is_ungraded_bucket: boolean;
  open_date?: string | null;
  due_date: string | null;
}

export interface MoodleCourseGradeReport {
  moodle_course_id: number;
  official_course_name: string;
  course_shortname: string;
  course_total_percentage: number | null;
  course_total_formatted: string;
  last_synced_at: string;
  categories: MoodleCategorySummary[];
  items: MoodleGradeItemSummary[];
}

export interface MoodleAssignmentMetadata {
  moodle_cmid?: number;
  moodle_course_id?: number;
  moodle_category?: string;
  weight_formatted?: string;
  contribution_formatted?: string;
  range_formatted?: string;
  is_ungraded_bucket?: boolean;
  week_number?: number | null;
  syllabus_day_number?: number | null;
  class_number?: number | null;
  class_topic?: string | null;
  activity_name?: string | null;
  supplies?: string[];
  weekday?: DayKey | null;
  official_portal_open_date?: string | null;
  official_portal_due_date?: string | null;
  api_grade_raw?: number | null;
  api_grade_max?: number | null;
  api_percentage_score?: number | null;
  api_letter_grade?: string | null;
  api_feedback?: string | null;
  manual_override?: boolean;
  manual_override_at?: string | null;
}

export function parseAssignmentMoodleMeta(
  stateStandards: Json | null | undefined
): MoodleAssignmentMetadata | null {
  if (!isRecord(stateStandards)) return null;
  const raw = isRecord(stateStandards.moodle_meta) ? stateStandards.moodle_meta : stateStandards;
  if (
    typeof raw.moodle_cmid !== 'number' &&
    typeof raw.moodle_category !== 'string' &&
    typeof raw.manual_override !== 'boolean' &&
    typeof raw.syllabus_day_number !== 'number' &&
    typeof raw.week_number !== 'number' &&
    typeof raw.activity_name !== 'string' &&
    !Array.isArray(raw.supplies)
  ) {
    return null;
  }
  const supplies = Array.isArray(raw.supplies)
    ? raw.supplies.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined;
  const weekday =
    typeof raw.weekday === 'string' && DAY_KEYS.includes(raw.weekday as DayKey)
      ? (raw.weekday as DayKey)
      : null;

  return {
    moodle_cmid: typeof raw.moodle_cmid === 'number' ? raw.moodle_cmid : undefined,
    moodle_course_id: typeof raw.moodle_course_id === 'number' ? raw.moodle_course_id : undefined,
    moodle_category: typeof raw.moodle_category === 'string' ? raw.moodle_category : undefined,
    weight_formatted: typeof raw.weight_formatted === 'string' ? raw.weight_formatted : undefined,
    contribution_formatted:
      typeof raw.contribution_formatted === 'string' ? raw.contribution_formatted : undefined,
    range_formatted: typeof raw.range_formatted === 'string' ? raw.range_formatted : undefined,
    is_ungraded_bucket:
      typeof raw.is_ungraded_bucket === 'boolean' ? raw.is_ungraded_bucket : false,
    week_number: typeof raw.week_number === 'number' ? raw.week_number : null,
    syllabus_day_number:
      typeof raw.syllabus_day_number === 'number' ? raw.syllabus_day_number : null,
    class_number: typeof raw.class_number === 'number' ? raw.class_number : null,
    class_topic: typeof raw.class_topic === 'string' ? raw.class_topic : null,
    activity_name: typeof raw.activity_name === 'string' ? raw.activity_name : null,
    supplies,
    weekday,
    official_portal_open_date:
      typeof raw.official_portal_open_date === 'string' ? raw.official_portal_open_date : null,
    official_portal_due_date:
      typeof raw.official_portal_due_date === 'string' ? raw.official_portal_due_date : null,
    api_grade_raw: typeof raw.api_grade_raw === 'number' ? raw.api_grade_raw : null,
    api_grade_max: typeof raw.api_grade_max === 'number' ? raw.api_grade_max : null,
    api_percentage_score:
      typeof raw.api_percentage_score === 'number' ? raw.api_percentage_score : null,
    api_letter_grade: typeof raw.api_letter_grade === 'string' ? raw.api_letter_grade : null,
    api_feedback: typeof raw.api_feedback === 'string' ? raw.api_feedback : null,
    manual_override: typeof raw.manual_override === 'boolean' ? raw.manual_override : false,
    manual_override_at:
      typeof raw.manual_override_at === 'string' ? raw.manual_override_at : null,
  };
}

export function isSubjectApiSynced(sub?: SubjectWithGrading | null): boolean {
  if (!sub) return false;
  if (parseMoodleGradeReport(sub.grading_config) !== null) return true;
  if (isRecord(sub.recurring_config) && isRecord(sub.recurring_config.course_syllabus)) {
    const cs = sub.recurring_config.course_syllabus;
    if (cs.source_type === 'api_sync' || typeof cs.moodle_course_id === 'number') {
      return true;
    }
  }
  return false;
}

export function isAssignmentApiSynced(
  a: GradebookAssignment,
  sub?: SubjectWithGrading | null
): boolean {
  if (sub && isSubjectApiSynced(sub)) return true;
  const mm = parseAssignmentMoodleMeta(a.state_standards);
  if (mm && (typeof mm.moodle_cmid === 'number' || typeof mm.moodle_course_id === 'number')) {
    return true;
  }
  return false;
}

export function getLocalTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isAssignmentScored(a: GradebookAssignment): boolean {
  return (
    typeof a.points_earned === 'number' ||
    typeof a.percentage_score === 'number' ||
    (a.grading_mode === 'problems_calculator' &&
      typeof a.total_problems === 'number' &&
      typeof a.missed_problems === 'number')
  );
}

/**
 * Returns true if an assignment is Upcoming:
 * - Not staged, ignored, exempt, completed, or already scored
 * - Not explicitly flagged as needs_grading
 * - Due date is in the future (due_date > todayStr)
 * - Open / assigned date (if present) has not already passed (assigned_date > todayStr)
 */
export function isAssignmentUpcoming(
  a: GradebookAssignment,
  todayStr: string = getLocalTodayDateString()
): boolean {
  if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') return false;
  if (a.is_exempt) return false;
  if (
    a.status === 'completed' ||
    a.workflow_status === 'completed' ||
    a.workflow_status === 'needs_grading'
  ) {
    return false;
  }
  if (isAssignmentScored(a)) return false;
  if (!a.due_date || a.due_date <= todayStr) return false;
  if (a.assigned_date && a.assigned_date <= todayStr) return false;
  return true;
}

export function isAssignmentAwaitingManualGrade(
  a: GradebookAssignment,
  sub?: SubjectWithGrading | null,
  todayStr: string = getLocalTodayDateString()
): boolean {
  if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') return false;
  if (a.is_graded === false || a.is_exempt) return false;
  if (isAssignmentApiSynced(a, sub)) return false;
  if (isAssignmentScored(a)) return false;
  // Exclude upcoming assignments where neither open/assigned date nor due date has passed
  if (isAssignmentUpcoming(a, todayStr)) {
    return false;
  }
  return true;
}

export function isAssignmentPendingApiGrade(
  a: GradebookAssignment,
  sub?: SubjectWithGrading | null,
  todayStr: string = getLocalTodayDateString()
): boolean {
  if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') return false;
  if (a.is_graded === false || a.is_exempt) return false;
  if (!isAssignmentApiSynced(a, sub)) return false;
  if (isAssignmentScored(a)) return false;
  // Exclude upcoming portal assignments where neither open/assigned date nor due date has passed
  if (isAssignmentUpcoming(a, todayStr)) {
    return false;
  }
  return true;
}

export function parseMoodleGradeReport(
  gradingConfig: Json | null | undefined
): MoodleCourseGradeReport | null {
  if (!isRecord(gradingConfig) || !isRecord(gradingConfig.moodle_grade_report)) {
    return null;
  }
  const rep = gradingConfig.moodle_grade_report;
  if (typeof rep.moodle_course_id !== 'number') return null;

  const rawCats = Array.isArray(rep.categories) ? rep.categories : [];
  const categories: MoodleCategorySummary[] = [];
  for (const rc of rawCats) {
    if (!isRecord(rc)) continue;
    categories.push({
      category_name: typeof rc.category_name === 'string' ? rc.category_name : 'Category',
      weight_formatted: typeof rc.weight_formatted === 'string' ? rc.weight_formatted : '0.00 %',
      weight_numeric: typeof rc.weight_numeric === 'number' ? rc.weight_numeric : 0,
      grade_formatted: typeof rc.grade_formatted === 'string' ? rc.grade_formatted : '-',
      percentage_numeric:
        typeof rc.percentage_numeric === 'number' ? rc.percentage_numeric : null,
      is_empty: typeof rc.is_empty === 'boolean' ? rc.is_empty : false,
      is_ungraded_bucket:
        typeof rc.is_ungraded_bucket === 'boolean' ? rc.is_ungraded_bucket : false,
    });
  }

  const rawItems = Array.isArray(rep.items) ? rep.items : [];
  const items: MoodleGradeItemSummary[] = [];
  for (const ri of rawItems) {
    if (!isRecord(ri)) continue;
    items.push({
      cmid: typeof ri.cmid === 'number' ? ri.cmid : null,
      item_id: typeof ri.item_id === 'number' ? ri.item_id : null,
      item_name: typeof ri.item_name === 'string' ? ri.item_name : 'Grade Item',
      item_module: typeof ri.item_module === 'string' ? ri.item_module : 'quiz',
      category_name: typeof ri.category_name === 'string' ? ri.category_name : 'Current Quizzes',
      week_number: typeof ri.week_number === 'number' ? ri.week_number : null,
      weight_formatted: typeof ri.weight_formatted === 'string' ? ri.weight_formatted : '-',
      weight_numeric: typeof ri.weight_numeric === 'number' ? ri.weight_numeric : null,
      grade_formatted: typeof ri.grade_formatted === 'string' ? ri.grade_formatted : '-',
      grade_raw: typeof ri.grade_raw === 'number' ? ri.grade_raw : null,
      grade_max: typeof ri.grade_max === 'number' ? ri.grade_max : 100,
      range_formatted: typeof ri.range_formatted === 'string' ? ri.range_formatted : '0–100',
      percentage_formatted:
        typeof ri.percentage_formatted === 'string' ? ri.percentage_formatted : '-',
      contribution_formatted:
        typeof ri.contribution_formatted === 'string' ? ri.contribution_formatted : '-',
      contribution_numeric:
        typeof ri.contribution_numeric === 'number' ? ri.contribution_numeric : null,
      feedback: typeof ri.feedback === 'string' ? ri.feedback : null,
      is_ungraded_bucket:
        typeof ri.is_ungraded_bucket === 'boolean' ? ri.is_ungraded_bucket : false,
      open_date: typeof ri.open_date === 'string' ? ri.open_date : null,
      due_date: typeof ri.due_date === 'string' ? ri.due_date : null,
    });
  }

  return {
    moodle_course_id: rep.moodle_course_id,
    official_course_name:
      typeof rep.official_course_name === 'string' ? rep.official_course_name : '',
    course_shortname: typeof rep.course_shortname === 'string' ? rep.course_shortname : '',
    course_total_percentage:
      typeof rep.course_total_percentage === 'number' ? rep.course_total_percentage : null,
    course_total_formatted:
      typeof rep.course_total_formatted === 'string' ? rep.course_total_formatted : '-',
    last_synced_at: typeof rep.last_synced_at === 'string' ? rep.last_synced_at : '',
    categories,
    items,
  };
}

export interface CategoryGradeBreakdown {
  category_slug: string;
  category_name: string;
  weight: number;
  drop_lowest: number;
  graded_count: number;
  dropped_ids: string[];
  points_earned: number;
  points_possible: number;
  average_percentage: number | null;
}

export interface SubjectGradeSummary {
  subject_id: string;
  subject_name: string;
  policy: SubjectGradingPolicy;
  moodle_report: MoodleCourseGradeReport | null;
  is_api_synced: boolean;
  total_assignments: number;
  staged_count: number;
  needs_grading_count: number;
  pending_api_count: number;
  graded_count: number;
  points_earned_so_far: number;
  points_possible_entered_so_far: number;
  preset_total_points: number;
  running_ratio_percentage: number | null;
  preset_pool_percentage: number | null;
  category_weighted_percentage: number | null;
  effective_percentage: number | null;
  effective_letter_grade: string;
  formatted_display: string;
  is_overridden: boolean;
  gpa_unweighted: number;
  gpa_weighted: number;
  instructional_minutes: number;
  instructional_hours: number;
  carnegie_credits: number;
  effective_credits: number;
  category_breakdowns: CategoryGradeBreakdown[];
  dropped_assignment_ids: Set<string>;
}

/**
 * Formats a subject's grade display string according to the class's grade_display_mode.
 */
export function formatClassGradeDisplay(
  percentage: number | null,
  letterGrade: string,
  policy: SubjectGradingPolicy
): string {
  if (percentage === null && (!letterGrade || letterGrade === '—')) {
    return 'No Grades Yet';
  }
  const pctStr = percentage !== null ? `${percentage.toFixed(1)}%` : '';
  if (policy.grade_display_mode === 'number_only') {
    return pctStr || '—';
  }
  if (policy.grade_display_mode === 'letter_only') {
    return letterGrade || '—';
  }
  if (pctStr && letterGrade && letterGrade !== '—') {
    return `${pctStr} (${letterGrade})`;
  }
  return pctStr || letterGrade || '—';
}

export function calculateSubjectGradeSummary(params: {
  subject: SubjectWithGrading;
  assignments: GradebookAssignment[];
  assignmentTypes: AssignmentTypeConfig[];
  override?: SubjectTermOverride | null;
  loggedMinutes?: number;
}): SubjectGradeSummary {
  const { subject, assignments, assignmentTypes, override, loggedMinutes = 0 } = params;
  const policy = parseSubjectGradingPolicy(subject);
  const moodleReport = parseMoodleGradeReport(subject.grading_config);
  const apiSynced = isSubjectApiSynced(subject);

  const typeMap = new Map<string, AssignmentTypeConfig>();
  for (const t of assignmentTypes) {
    typeMap.set(t.slug, t);
  }

  const subjectAssignments = assignments.filter((a) => a.subject_id === subject.id);
  const stagedCount = subjectAssignments.filter((a) => a.workflow_status === 'staged').length;
  const needsGradingCount = subjectAssignments.filter((a) =>
    isAssignmentAwaitingManualGrade(a, subject)
  ).length;
  const pendingApiCount = subjectAssignments.filter((a) =>
    isAssignmentPendingApiGrade(a, subject)
  ).length;

  // Filter active graded assignments that have a score and are not exempt/staged/ignored
  const scoredAssignments: Array<{
    assignment: GradebookAssignment;
    metrics: ComputedAssignmentMetrics;
    moodleMeta: MoodleAssignmentMetadata | null;
  }> = [];

  let assignmentMinutes = 0;
  for (const a of subjectAssignments) {
    if (a.workflow_status === 'staged' || a.workflow_status === 'ignored') continue;

    if (a.status === 'completed' || a.workflow_status === 'completed') {
      assignmentMinutes += a.actual_minutes ?? a.estimated_minutes ?? 30;
    }

    if (a.is_graded === false || a.is_exempt) continue;

    const metrics = computeAssignmentMetrics({
      grading_mode: a.grading_mode || 'points',
      total_problems: a.total_problems,
      missed_problems: a.missed_problems,
      points_possible: a.points_possible,
      points_earned: a.points_earned,
      percentage_score: a.percentage_score,
      status: a.status,
      workflow_status: a.workflow_status,
      scale: policy.grading_scale,
    });

    if (metrics.is_scored && metrics.points_earned !== null && metrics.percentage_score !== null) {
      const moodleMeta = parseAssignmentMoodleMeta(a.state_standards);
      scoredAssignments.push({ assignment: a, metrics, moodleMeta });
    }
  }

  // Group by category slug and apply drop_lowest rules
  // Note: Items sitting in Moodle's 0%-weighted "Ungraded Items" bucket are still counted in graded_count
  // and shown in the assignments table, but excluded from distorting weighted course total calculations.
  const byCategory = new Map<
    string,
    Array<{
      assignment: GradebookAssignment;
      metrics: ComputedAssignmentMetrics;
      moodleMeta: MoodleAssignmentMetadata | null;
    }>
  >();

  for (const item of scoredAssignments) {
    if (item.moodleMeta?.is_ungraded_bucket) {
      continue;
    }
    const slug = item.assignment.category || 'homework';
    const list = byCategory.get(slug) || [];
    list.push(item);
    byCategory.set(slug, list);
  }

  const droppedIds = new Set<string>();
  const categoryBreakdowns: CategoryGradeBreakdown[] = [];

  let totalEarnedAfterDrops = 0;
  let totalPossibleAfterDrops = 0;
  let weightedSum = 0;
  let activeWeightTotal = 0;

  const allCategorySlugs = Array.from(
    new Set([
      ...assignmentTypes.map((t) => t.slug),
      ...Object.keys(policy.category_weights),
      ...Array.from(byCategory.keys()),
    ])
  );

  for (const slug of allCategorySlugs) {
    const items = byCategory.get(slug) || [];
    const typeInfo = typeMap.get(slug);
    const weightRule = policy.category_weights[slug] || {
      weight: typeInfo?.default_weight ?? 20,
      drop_lowest: 0,
      enabled: true,
    };

    if (items.length === 0 && !weightRule.enabled) continue;

    // Sort ascending by percentage_score to identify lowest scores if drop_lowest > 0
    const sortedByPct = [...items].sort(
      (x, y) => (x.metrics.percentage_score ?? 0) - (y.metrics.percentage_score ?? 0)
    );

    const dropCount =
      weightRule.drop_lowest > 0 && items.length > weightRule.drop_lowest
        ? weightRule.drop_lowest
        : 0;

    const catDroppedIds: string[] = [];
    for (let i = 0; i < dropCount; i++) {
      catDroppedIds.push(sortedByPct[i].assignment.id);
      droppedIds.add(sortedByPct[i].assignment.id);
    }

    const keptItems = items.filter((it) => !droppedIds.has(it.assignment.id));
    let catEarned = 0;
    let catPossible = 0;

    for (const kept of keptItems) {
      catEarned += kept.metrics.points_earned ?? 0;
      catPossible += kept.metrics.points_possible;
    }

    totalEarnedAfterDrops += catEarned;
    totalPossibleAfterDrops += catPossible;

    const catAvg = catPossible > 0 ? Number(((catEarned / catPossible) * 100).toFixed(2)) : null;

    if (catAvg !== null && weightRule.weight > 0) {
      weightedSum += catAvg * weightRule.weight;
      activeWeightTotal += weightRule.weight;
    }

    if (items.length > 0 || weightRule.enabled) {
      categoryBreakdowns.push({
        category_slug: slug,
        category_name: typeInfo?.name || slug.replace(/_/g, ' ').toUpperCase(),
        weight: weightRule.weight,
        drop_lowest: weightRule.drop_lowest,
        graded_count: items.length,
        dropped_ids: catDroppedIds,
        points_earned: Number(catEarned.toFixed(2)),
        points_possible: Number(catPossible.toFixed(2)),
        average_percentage: catAvg,
      });
    }
  }

  const runningRatioPct =
    totalPossibleAfterDrops > 0
      ? Number(((totalEarnedAfterDrops / totalPossibleAfterDrops) * 100).toFixed(2))
      : null;

  const presetPoolPct =
    policy.preset_total_points > 0 && scoredAssignments.length > 0
      ? Number(((totalEarnedAfterDrops / policy.preset_total_points) * 100).toFixed(2))
      : null;

  const categoryWeightedPct =
    activeWeightTotal > 0 ? Number((weightedSum / activeWeightTotal).toFixed(2)) : runningRatioPct;

  // Determine effective percentage based on Class Grade Determination settings
  let calculatedPct: number | null = null;
  if (policy.calculation_basis === 'preset_total_points') {
    calculatedPct = presetPoolPct;
  } else if (policy.weighting_mode === 'category_weighted') {
    calculatedPct = categoryWeightedPct;
  } else {
    calculatedPct = runningRatioPct;
  }

  // If this course is synced with Moodle and has an official Moodle Course Total,
  // use the category-weighted calculation (which matches Moodle's 75%/25% or 100% weights)
  // or fall back to Moodle's exact reported course_total_percentage if no local modifications diverge.
  if (moodleReport && moodleReport.course_total_percentage !== null && calculatedPct === null) {
    calculatedPct = moodleReport.course_total_percentage;
  }

  const isOverridden = Boolean(
    override &&
      (override.override_percentage !== null ||
        (override.override_letter_grade && override.override_letter_grade.trim().length > 0))
  );

  const effectivePercentage =
    override && override.override_percentage !== null
      ? override.override_percentage
      : calculatedPct;

  const effectiveLetterGrade =
    override && override.override_letter_grade && override.override_letter_grade.trim()
      ? override.override_letter_grade.trim()
      : percentageToLetterGrade(effectivePercentage, policy.grading_scale);

  const formattedDisplay = formatClassGradeDisplay(
    effectivePercentage,
    effectiveLetterGrade,
    policy
  );

  const gpa = letterGradeToGpaPoints(effectiveLetterGrade, policy.course_level);

  const totalInstructionalMinutes = loggedMinutes + assignmentMinutes;
  const totalInstructionalHours = Number((totalInstructionalMinutes / 60).toFixed(1));
  // 120 hours = 1.0 Carnegie Unit credit
  const carnegieCredits = Number((totalInstructionalHours / 120).toFixed(2));
  const effectiveCredits =
    override && override.override_credits !== null
      ? override.override_credits
      : policy.credit_calculation_mode === 'carnegie_hours'
      ? carnegieCredits
      : policy.preset_credits;

  return {
    subject_id: subject.id,
    subject_name: subject.name,
    policy,
    moodle_report: moodleReport,
    is_api_synced: apiSynced,
    total_assignments: subjectAssignments.filter(
      (a) => a.workflow_status !== 'staged' && a.workflow_status !== 'ignored'
    ).length,
    staged_count: stagedCount,
    needs_grading_count: needsGradingCount,
    pending_api_count: pendingApiCount,
    graded_count: scoredAssignments.length,
    points_earned_so_far: Number(totalEarnedAfterDrops.toFixed(2)),
    points_possible_entered_so_far: Number(totalPossibleAfterDrops.toFixed(2)),
    preset_total_points: policy.preset_total_points,
    running_ratio_percentage: runningRatioPct,
    preset_pool_percentage: presetPoolPct,
    category_weighted_percentage: categoryWeightedPct,
    effective_percentage: effectivePercentage,
    effective_letter_grade: effectiveLetterGrade,
    formatted_display: formattedDisplay,
    is_overridden: isOverridden,
    gpa_unweighted: gpa.unweighted,
    gpa_weighted: gpa.weighted,
    instructional_minutes: totalInstructionalMinutes,
    instructional_hours: totalInstructionalHours,
    carnegie_credits: carnegieCredits,
    effective_credits: effectiveCredits,
    category_breakdowns: categoryBreakdowns,
    dropped_assignment_ids: droppedIds,
  };
}

export interface GeneratedRecurringAssignmentCandidate {
  subject_id: string;
  title: string;
  description: string;
  instructions: string;
  due_date: string;
  assigned_date: string;
  category: string;
  grading_mode: ScoringMode;
  points_possible: number;
  points_earned?: number | null;
  percentage_score?: number | null;
  letter_grade?: string | null;
  total_problems: number | null;
  estimated_minutes: number;
  workflow_status: WorkflowStatus;
  status: 'pending' | 'in_progress' | 'completed';
  source_type: AssignmentSourceType;
  recurring_template_id: string | null;
  syllabus_day_number: number | null;
  teacher_comments?: string | null;
  state_standards?: Json;
}

/**
 * Generates recurring graded or staged assignments for a subject on a target week
 * based on:
 * 1) API-Synced Course Syllabus Linked Assessments for the selected Week #
 * 2) Math Syllabus Workbook HW for Monday & Wednesday (when mode === 'math_syllabus')
 * 3) Recurring Assignment Templates (respecting auto_behavior: 'auto_create' | 'queue_for_approval' | 'ignore')
 * 4) Subject Participation Grading Policy (if participation_enabled is true)
 */
export function generateWeekAssignmentsFromTemplatesAndPolicy(params: {
  subject: SubjectWithGrading;
  recurringConfig: SubjectRecurringConfig;
  counters: ResolvedSubjectCounters;
  weekDates: Array<{ dateStr: string; dayKey: DayKey; dayName: string }>;
  syllabusMap: Map<number, MathSyllabusDay>;
  templates: RecurringAssignmentTemplate[];
}): GeneratedRecurringAssignmentCandidate[] {
  const { subject, recurringConfig, counters, weekDates, syllabusMap, templates } = params;
  const candidates: GeneratedRecurringAssignmentCandidate[] = [];
  const policy = parseSubjectGradingPolicy(subject);

  const mondayDate = weekDates[0]?.dateStr || '';
  const tueDayNum = counters.tuesday_math_day;
  const thuDayNum = counters.thursday_math_day;
  const tueSyl = tueDayNum ? syllabusMap.get(tueDayNum) : undefined;
  const thuSyl = thuDayNum ? syllabusMap.get(thuDayNum) : undefined;

  // 0a. If this subject has an API-synced syllabus with auto_create_gradebook_assignments enabled,
  // pull the linked assessments for counters.week_num and place them on quiz_assignment_target_day!
  const courseSyl = recurringConfig.course_syllabus;
  if (
    courseSyl &&
    courseSyl.source_type === 'api_sync' &&
    courseSyl.api_auto_populate?.enabled &&
    courseSyl.api_auto_populate.auto_create_gradebook_assignments &&
    courseSyl.weeks &&
    courseSyl.weeks.length > 0
  ) {
    const matchedWeek = courseSyl.weeks.find((w) => w.week_number === counters.week_num);
    if (matchedWeek && matchedWeek.linked_assessments.length > 0) {
      const targetDayKey = courseSyl.api_auto_populate.quiz_assignment_target_day || 'thursday';
      const targetDayInfo =
        weekDates.find((d) => d.dayKey === targetDayKey) ||
        weekDates[3] ||
        weekDates[weekDates.length - 1];
      const targetDueDate = targetDayInfo?.dateStr || mondayDate;

      for (const assessment of matchedWeek.linked_assessments) {
        const cleanTitle = assessment.name
          .replace(/--DUE[\s\S]*$/i, '')
          .replace(/^LC 4th Edition\s+/i, '')
          .trim();

        const isCompositionFinalDraft =
          assessment.moodle_category.toLowerCase().includes('final draft') ||
          assessment.modname === 'assign';
        const categorySlug = isCompositionFinalDraft ? 'essay_composition' : 'quiz';

        const hasScore =
          typeof assessment.grade_raw === 'number' && !Number.isNaN(assessment.grade_raw);
        const pct =
          hasScore && assessment.grade_max > 0 && assessment.grade_raw !== null
            ? Number(((assessment.grade_raw / assessment.grade_max) * 100).toFixed(2))
            : null;
        const letter = pct !== null ? percentageToLetterGrade(pct, policy.grading_scale) : null;

        const moodleMeta: MoodleAssignmentMetadata = {
          moodle_cmid: assessment.cmid,
          moodle_course_id: courseSyl.moodle_course_id,
          moodle_category: assessment.moodle_category,
          weight_formatted: assessment.weight_formatted || undefined,
          contribution_formatted: assessment.contribution_formatted || undefined,
          range_formatted: `0–${assessment.grade_max}`,
          is_ungraded_bucket: assessment.is_ungraded_bucket,
          week_number: matchedWeek.week_number,
          official_portal_open_date: assessment.open_date,
          official_portal_due_date: assessment.due_date,
          api_grade_raw: hasScore ? assessment.grade_raw : null,
          api_grade_max: assessment.grade_max || 100,
          api_percentage_score: pct,
          api_letter_grade: letter,
          api_feedback: assessment.feedback,
        };

        candidates.push({
          subject_id: subject.id,
          title: cleanTitle,
          description: `${courseSyl.official_course_name || subject.name} • Week ${matchedWeek.week_number} (${matchedWeek.section_title})`,
          instructions: matchedWeek.raw_summary,
          due_date: assessment.due_date || targetDueDate,
          assigned_date: assessment.open_date || mondayDate || targetDueDate,
          category: categorySlug,
          grading_mode: 'points',
          points_possible: assessment.grade_max || 100,
          points_earned: hasScore ? assessment.grade_raw : null,
          percentage_score: pct,
          letter_grade: letter,
          total_problems: null,
          estimated_minutes: 30,
          workflow_status: hasScore ? 'completed' : 'not_started',
          status: hasScore ? 'completed' : 'pending',
          source_type: 'syllabus_staged',
          recurring_template_id: null,
          syllabus_day_number: matchedWeek.week_number,
          teacher_comments: assessment.feedback,
          state_standards: { moodle_meta: moodleMeta as unknown as Json },
        });
      }
    }
  }

  // 0b. If this subject uses Math Syllabus mode and homework is enabled,
  // generate the Monday & Wednesday Math Workbook HW assignments matching the syllabus!
  if (
    recurringConfig.mode === 'math_syllabus' &&
    recurringConfig.math_config?.homework_enabled !== false
  ) {
    const mathHwPairs: Array<{ dayKey: DayKey; sylDay: MathSyllabusDay | undefined }> = [
      { dayKey: 'monday', sylDay: tueSyl },
      { dayKey: 'wednesday', sylDay: thuSyl },
    ];
    for (const pair of mathHwPairs) {
      if (!pair.sylDay || !pair.sylDay.workbook) continue;
      const targetDayInfo = weekDates.find((d) => d.dayKey === pair.dayKey);
      if (!targetDayInfo) continue;

      const sd = pair.sylDay;
      const isFinishReview =
        sd.workbook.toUpperCase().includes('FINISH WORKBOOK') ||
        sd.topic.toUpperCase().includes('REVIEW DAY');
      const hwTitle = `Day ${sd.day_number} Workbook HW: ${sd.workbook}`;
      const hwMeta: MoodleAssignmentMetadata = {
        moodle_category: isFinishReview
          ? 'Ungraded / Review Items'
          : 'Math Workbook Homework',
        is_ungraded_bucket: isFinishReview,
        week_number: counters.week_num,
        range_formatted: '0–100',
      };

      candidates.push({
        subject_id: subject.id,
        title: hwTitle,
        description: `Math Syllabus Day ${sd.day_number} • ${sd.topic}${sd.textbook ? ` • Textbook ${sd.textbook}` : ''}`,
        instructions: `Complete Math Workbook ${sd.workbook} (${sd.topic}).${sd.fast_facts ? ` Fast Facts: ${sd.fast_facts}.` : ''}`,
        due_date: targetDayInfo.dateStr,
        assigned_date: mondayDate || targetDayInfo.dateStr,
        category: 'math_problem_set',
        grading_mode: 'problems_calculator',
        points_possible: 100,
        total_problems: null,
        estimated_minutes: 35,
        workflow_status: 'not_started',
        status: 'pending',
        source_type: 'syllabus_staged',
        recurring_template_id: null,
        syllabus_day_number: sd.day_number,
        state_standards: { moodle_meta: hwMeta as unknown as Json },
      });
    }
  }

  // 0c. If this subject uses a class-based syllabus (e.g. Physical Science) where specific classes have Activities,
  // generate an 'activity' assignment on the EXACT SAME DAY OF THE WEEK as that class!
  const activeCourseSyl = getActiveCourseSyllabus(recurringConfig);
  const classDayByWeekday = new Map<DayKey, { classNum: number; sylDay?: MathSyllabusDay }>();
  if (recurringConfig.mode === 'template') {
    let runningClassNum = counters.class_num;
    for (const dk of DAY_KEYS) {
      const dayCfg = recurringConfig.days[dk];
      if (!dayCfg.enabled) continue;
      if (dayCfg.template.includes('{class_num}')) {
        const matched =
          activeCourseSyl?.days.find((d) => d.day_number === runningClassNum) ||
          syllabusMap.get(runningClassNum);
        classDayByWeekday.set(dk, { classNum: runningClassNum, sylDay: matched });
        runningClassNum += 1;
      }
    }
  }

  if (
    recurringConfig.mode === 'template' &&
    activeCourseSyl &&
    Array.isArray(activeCourseSyl.days) &&
    activeCourseSyl.days.length > 0
  ) {
    const activityTpl = templates.find(
      (t) =>
        t.subject_id === subject.id &&
        t.is_active &&
        (t.assignment_type_slug === 'activity' || t.linked_weekly_source === 'syllabus_row')
    );

    if (!activityTpl || activityTpl.auto_behavior !== 'ignore') {
      const wfStatus: WorkflowStatus =
        activityTpl?.auto_behavior === 'queue_for_approval' ? 'staged' : 'not_started';

      for (const dayInfo of weekDates) {
        const classEntry = classDayByWeekday.get(dayInfo.dayKey);
        const matchedClassDay = classEntry?.sylDay;
        if (!matchedClassDay) continue;

        const activityName =
          matchedClassDay.activity ||
          (matchedClassDay.notes && /^activity\s*:/i.test(matchedClassDay.notes.trim())
            ? matchedClassDay.notes.trim().replace(/^activity\s*:\s*/i, '')
            : '');
        if (!activityName) continue;

        const effectiveWeekNum = matchedClassDay.week_number ?? counters.week_num;
        const supplies = resolveSyllabusDaySupplies(matchedClassDay);
        const activityTitle = `Activity: ${activityName}`;
        const suppliesSummary =
          supplies.length > 0 ? `Supplies Needed: ${supplies.join(', ')}` : '';

        const actMeta: MoodleAssignmentMetadata = {
          moodle_category: 'Activity',
          is_ungraded_bucket: false,
          week_number: effectiveWeekNum,
          syllabus_day_number: matchedClassDay.day_number,
          class_number: matchedClassDay.day_number,
          class_topic: matchedClassDay.topic,
          activity_name: activityName,
          supplies,
          weekday: dayInfo.dayKey,
          range_formatted: `0–${activityTpl?.points_possible ?? 100}`,
        };

        candidates.push({
          subject_id: subject.id,
          title: activityTitle,
          description: `Week ${effectiveWeekNum}, Class ${matchedClassDay.day_number}: ${matchedClassDay.topic}${suppliesSummary ? ` • ${suppliesSummary}` : ''}`,
          instructions: `Complete ${activeCourseSyl.official_course_name || subject.name} Activity "${activityName}" (Week ${effectiveWeekNum}, Class ${matchedClassDay.day_number}: ${matchedClassDay.topic}).${
            supplies.length > 0
              ? `\n\nSupplies Needed:\n${supplies.map((s) => `• ${s}`).join('\n')}`
              : ''
          }`,
          due_date: dayInfo.dateStr,
          assigned_date: mondayDate || dayInfo.dateStr,
          category: 'activity',
          grading_mode: activityTpl?.grading_mode || 'completion',
          points_possible: activityTpl?.points_possible ?? 100,
          total_problems: null,
          estimated_minutes: activityTpl?.estimated_minutes ?? 30,
          workflow_status: wfStatus,
          status: 'pending',
          source_type: activityTpl ? 'recurring_template' : 'syllabus_staged',
          recurring_template_id: activityTpl?.id ?? null,
          syllabus_day_number: matchedClassDay.day_number,
          state_standards: { moodle_meta: actMeta as unknown as Json },
        });
      }
    }
  }

  const formatTokens = (
    text: string,
    dayKey: DayKey
  ): { formatted: string; sylDay: number | null; matchedSyl?: MathSyllabusDay } => {
    let activeSyl: MathSyllabusDay | undefined;
    let activeDayNum: number | null = null;

    if (recurringConfig.mode === 'math_syllabus') {
      const mathCfg = recurringConfig.math_config;
      if (dayKey === 'tuesday') {
        activeDayNum = tueDayNum;
        activeSyl = tueSyl;
      } else if (dayKey === 'thursday') {
        activeDayNum = thuDayNum;
        activeSyl = thuSyl;
      } else if (dayKey === 'monday') {
        if (mathCfg?.monday_homework_source === 'tuesday_class') {
          activeDayNum = tueDayNum;
          activeSyl = tueSyl;
        } else if (mathCfg?.monday_homework_source === 'thursday_class') {
          activeDayNum = thuDayNum;
          activeSyl = thuSyl;
        }
      } else if (dayKey === 'wednesday') {
        if (mathCfg?.wednesday_homework_source === 'thursday_class') {
          activeDayNum = thuDayNum;
          activeSyl = thuSyl;
        } else if (mathCfg?.wednesday_homework_source === 'tuesday_class') {
          activeDayNum = tueDayNum;
          activeSyl = tueSyl;
        }
      }
    } else if (classDayByWeekday.has(dayKey)) {
      const entry = classDayByWeekday.get(dayKey);
      activeDayNum = entry?.classNum ?? null;
      activeSyl = entry?.sylDay;
    } else if (activeCourseSyl?.days?.length) {
      activeSyl = activeCourseSyl.days.find(
        (d) => d.day_number === counters.week_num || d.day_number === counters.lesson_num
      );
      activeDayNum = activeSyl?.day_number ?? null;
    }

    const suppliesList = resolveSyllabusDaySupplies(activeSyl);
    const effectiveClassNum = activeDayNum ?? counters.class_num;
    const effectiveWeekNum = activeSyl?.week_number ?? counters.week_num;

    const formatted = text
      .replace(/\{week\}/g, String(effectiveWeekNum))
      .replace(/\{class_num\}/g, String(effectiveClassNum))
      .replace(/\{lesson\}/g, String(counters.lesson_num))
      .replace(/\{prev_lesson\}/g, String(Math.max(1, counters.lesson_num - 1)))
      .replace(/\{day\}/g, activeDayNum !== null ? String(activeDayNum) : String(counters.week_num))
      .replace(/\{workbook\}/g, activeSyl?.workbook || 'Workbook')
      .replace(/\{textbook\}/g, activeSyl?.textbook || '')
      .replace(/\{topic\}/g, activeSyl?.topic || '')
      .replace(/\{activity\}/g, activeSyl?.activity || '')
      .replace(/\{supplies\}/g, suppliesList.join(', '))
      .replace(/\{materials\}/g, activeSyl?.materials || suppliesList.join(', '))
      .replace(/\{fast_facts\}/g, activeSyl?.fast_facts || '');

    return { formatted: formatted.trim(), sylDay: activeDayNum, matchedSyl: activeSyl };
  };

  // 1. Process explicit Recurring Assignment Templates for this subject
  const subjectTemplates = templates.filter(
    (t) => t.subject_id === subject.id && t.is_active && t.auto_behavior !== 'ignore'
  );

  for (const tpl of subjectTemplates) {
    // Skip if already handled by 0c class-based syllabus activity generator
    if (
      (tpl.assignment_type_slug === 'activity' || tpl.linked_weekly_source === 'syllabus_row') &&
      recurringConfig.mode === 'template' &&
      activeCourseSyl?.days?.some((d) => Boolean(d.activity))
    ) {
      continue;
    }

    const workflowStatus: WorkflowStatus =
      tpl.auto_behavior === 'queue_for_approval' ? 'staged' : 'not_started';

    for (const dayInfo of weekDates) {
      if (!tpl.days_of_week.includes(dayInfo.dayKey)) continue;

      const { formatted: title, sylDay, matchedSyl } = formatTokens(
        tpl.title_template,
        dayInfo.dayKey
      );
      if (
        (tpl.assignment_type_slug === 'activity' ||
          tpl.title_template.includes('{activity}')) &&
        !matchedSyl?.activity
      ) {
        continue;
      }

      const { formatted: instructions } = formatTokens(
        tpl.instructions_template || '',
        dayInfo.dayKey
      );

      if (!title) continue;

      // Avoid duplicating if already added from API syllabus linked assessments or Math/Science syllabus
      const alreadyAdded = candidates.some(
        (c) => c.title.toLowerCase() === title.toLowerCase() && c.due_date === dayInfo.dateStr
      );
      if (alreadyAdded) continue;

      const resolvedDayOrWeek = sylDay ?? counters.week_num;
      const supplies = resolveSyllabusDaySupplies(matchedSyl);
      const tplMeta: MoodleAssignmentMetadata = {
        moodle_category:
          tpl.assignment_type_slug === 'spelling_test'
            ? 'Weekly Spelling Tests'
            : tpl.assignment_type_slug === 'activity'
            ? 'Activity'
            : tpl.assignment_type_slug.replace(/_/g, ' '),
        is_ungraded_bucket: false,
        week_number: matchedSyl?.week_number ?? counters.week_num,
        syllabus_day_number: resolvedDayOrWeek,
        class_number: sylDay,
        class_topic: matchedSyl?.topic || null,
        activity_name: matchedSyl?.activity || null,
        supplies: supplies.length > 0 ? supplies : undefined,
        weekday: dayInfo.dayKey,
        range_formatted: `0–${tpl.points_possible}`,
      };

      candidates.push({
        subject_id: subject.id,
        title,
        description:
          instructions ||
          `Week ${counters.week_num} • Linked to recurring ${subject.name} planner (${dayInfo.dayName})`,
        instructions,
        due_date: dayInfo.dateStr,
        assigned_date: mondayDate || dayInfo.dateStr,
        category: tpl.assignment_type_slug,
        grading_mode: tpl.grading_mode,
        points_possible: tpl.points_possible,
        total_problems: tpl.total_problems_default,
        estimated_minutes: tpl.estimated_minutes,
        workflow_status: workflowStatus,
        status: 'pending',
        source_type: 'recurring_template',
        recurring_template_id: tpl.id,
        syllabus_day_number: resolvedDayOrWeek,
        state_standards: { moodle_meta: tplMeta as unknown as Json },
      });
    }
  }

  // 2. Process Subject Participation Grading Policy (if enabled and not ignored)
  if (policy.participation_enabled && policy.participation_auto_behavior !== 'ignore') {
    const partWorkflow: WorkflowStatus =
      policy.participation_auto_behavior === 'queue_for_approval' ? 'staged' : 'not_started';

    if (policy.participation_scope === 'per_class_event') {
      // Determine class days from recurringConfig
      const classDays: DayKey[] =
        recurringConfig.mode === 'math_syllabus'
          ? recurringConfig.math_config?.attend_class_days || ['tuesday', 'thursday']
          : DAY_KEYS.filter((dk) => recurringConfig.days[dk]?.attend_class);

      const effectiveClassDays: DayKey[] =
        classDays.length > 0 ? classDays : ['tuesday', 'thursday'];

      for (const dayInfo of weekDates) {
        if (!effectiveClassDays.includes(dayInfo.dayKey)) continue;
        const { sylDay } = formatTokens('{day}', dayInfo.dayKey);
        const dayTitle =
          sylDay !== null
            ? `${subject.name} Class Participation — Day ${sylDay} (${dayInfo.dayName})`
            : `${subject.name} Class Participation — Week ${counters.week_num} (${dayInfo.dayName})`;

        candidates.push({
          subject_id: subject.id,
          title: dayTitle,
          description: `Live / In-Person Class Session Participation (${dayInfo.dateStr})`,
          instructions: 'Evaluate preparedness, attentiveness, and class participation.',
          due_date: dayInfo.dateStr,
          assigned_date: dayInfo.dateStr,
          category: 'participation',
          grading_mode: 'points',
          points_possible: policy.participation_points,
          total_problems: null,
          estimated_minutes: 45,
          workflow_status: partWorkflow,
          status: 'pending',
          source_type: 'participation_auto',
          recurring_template_id: null,
          syllabus_day_number: sylDay,
        });
      }
    } else if (policy.participation_scope === 'per_week') {
      const fridayDate = weekDates[4]?.dateStr || mondayDate;
      candidates.push({
        subject_id: subject.id,
        title: `${subject.name} Weekly Participation — Week ${counters.week_num}`,
        description: `Weekly class participation grade for Week ${counters.week_num}`,
        instructions: 'Weekly participation and preparedness evaluation.',
        due_date: fridayDate,
        assigned_date: mondayDate,
        category: 'participation',
        grading_mode: 'points',
        points_possible: policy.participation_points,
        total_problems: null,
        estimated_minutes: 30,
        workflow_status: partWorkflow,
        status: 'pending',
        source_type: 'participation_auto',
        recurring_template_id: null,
        syllabus_day_number: null,
      });
    }
  }

  return candidates;
}
