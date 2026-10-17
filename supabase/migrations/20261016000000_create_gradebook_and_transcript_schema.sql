-- Migration: Create comprehensive Homeschool Gradebook, Syllabus Staging, Recurring Assignment Templates,
-- Class Grading Policies, Attendance/Carnegie Hours, Report Card, and Transcript Builder tables.

CREATE SCHEMA IF NOT EXISTS school;

-- 1. Configurable Assignment Types & Definitions (school.assignment_types)
CREATE TABLE IF NOT EXISTS school.assignment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scoring_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (scoring_mode IN ('problems_calculator', 'points', 'percentage', 'completion', 'pass_fail')),
  default_points NUMERIC(8,2) NOT NULL DEFAULT 100,
  default_weight NUMERIC(5,2) NOT NULL DEFAULT 20,
  color TEXT NOT NULL DEFAULT '#0C74E4',
  icon TEXT NOT NULL DEFAULT 'FileText',
  is_graded_by_default BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default Assignment Types
INSERT INTO school.assignment_types (name, slug, description, scoring_mode, default_points, default_weight, color, icon, is_graded_by_default, sort_order)
VALUES
  ('Math Problem Set', 'math_problem_set', 'Daily or bi-weekly math workbook and textbook problem sets. Enter Total Problems and Missed Problems after completion to automatically compute % correct.', 'problems_calculator', 100, 30, '#0C74E4', 'Calculator', true, 1),
  ('Daily Homework', 'homework', 'Regular daily or weekly homework assignments, worksheets, and practice exercises.', 'points', 100, 25, '#02876f', 'FileText', true, 2),
  ('Spelling Test', 'spelling_test', 'Weekly Thursday or Friday spelling assessment. Enter total words and missed words to calculate % score.', 'problems_calculator', 20, 40, '#D97706', 'CheckSquare', true, 3),
  ('Quiz', 'quiz', 'Short periodic assessments checking comprehension of recent lessons, vocabulary, or concepts.', 'points', 50, 20, '#894AE0', 'Sparkles', true, 4),
  ('Unit Test / Exam', 'test', 'Major chapter, unit, or semester exams evaluating cumulative mastery of course material.', 'points', 100, 35, '#ea2012', 'Award', true, 5),
  ('Class Participation', 'participation', 'Engagement, preparedness, discussion, and attentiveness attached to each class event, week, module, or semester.', 'points', 10, 10, '#018a3c', 'Users', true, 6),
  ('Writing / Composition', 'paper', 'Intermittent teacher-assigned essays, drafts, compositions, and research papers evaluated with teacher feedback.', 'points', 100, 25, '#4F46E5', 'Edit3', true, 7),
  ('Project / Lab', 'project', 'Hands-on science labs, presentations, history projects, and creative builds.', 'points', 100, 20, '#DB2777', 'Layers', true, 8),
  ('Reading / Literature', 'reading', 'Assigned chapters, literature readings, and reading comprehension checks.', 'completion', 10, 10, '#0891B2', 'BookOpen', false, 9)
ON CONFLICT (slug) DO NOTHING;

-- 2. Extend school.subjects with Class Grade Determination, Participation, and Transcript Metadata
ALTER TABLE school.subjects
  ADD COLUMN IF NOT EXISTS broader_discipline TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS course_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS course_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (course_level IN ('standard', 'honors', 'ap', 'dual_enrollment')),
  ADD COLUMN IF NOT EXISTS grade_display_mode TEXT NOT NULL DEFAULT 'number_and_letter'
    CHECK (grade_display_mode IN ('number_only', 'letter_only', 'number_and_letter')),
  ADD COLUMN IF NOT EXISTS calculation_basis TEXT NOT NULL DEFAULT 'running_ratio'
    CHECK (calculation_basis IN ('running_ratio', 'preset_total_points')),
  ADD COLUMN IF NOT EXISTS preset_total_points NUMERIC(10,2) NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS weighting_mode TEXT NOT NULL DEFAULT 'category_weighted'
    CHECK (weighting_mode IN ('category_weighted', 'raw_points')),
  ADD COLUMN IF NOT EXISTS participation_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS participation_scope TEXT NOT NULL DEFAULT 'per_week'
    CHECK (participation_scope IN ('per_class_event', 'per_week', 'per_module', 'per_semester')),
  ADD COLUMN IF NOT EXISTS participation_auto_behavior TEXT NOT NULL DEFAULT 'queue_for_approval'
    CHECK (participation_auto_behavior IN ('auto_create', 'queue_for_approval', 'ignore')),
  ADD COLUMN IF NOT EXISTS participation_points NUMERIC(8,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS credit_calculation_mode TEXT NOT NULL DEFAULT 'fixed_preset'
    CHECK (credit_calculation_mode IN ('carnegie_hours', 'fixed_preset')),
  ADD COLUMN IF NOT EXISTS preset_credits NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS grading_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Recurring Assignment Templates (school.recurring_assignment_templates)
CREATE TABLE IF NOT EXISTS school.recurring_assignment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  title_template TEXT NOT NULL,
  instructions_template TEXT NOT NULL DEFAULT '',
  assignment_type_slug TEXT NOT NULL DEFAULT 'homework',
  grading_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (grading_mode IN ('problems_calculator', 'points', 'percentage', 'completion', 'pass_fail')),
  points_possible NUMERIC(8,2) NOT NULL DEFAULT 100,
  total_problems_default INT DEFAULT NULL,
  days_of_week JSONB NOT NULL DEFAULT '["friday"]'::jsonb,
  linked_weekly_source TEXT NOT NULL DEFAULT 'custom'
    CHECK (linked_weekly_source IN ('custom', 'math_workbook', 'math_fast_facts', 'attend_class', 'weekly_template', 'syllabus_row')),
  auto_behavior TEXT NOT NULL DEFAULT 'auto_create'
    CHECK (auto_behavior IN ('auto_create', 'queue_for_approval', 'ignore')),
  estimated_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Extend school.assignments for Granular Gradebook, Staging, Math Problem Calculator & Portfolio Tracking
ALTER TABLE school.assignments
  ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assigned_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS due_time TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_minutes INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS actual_minutes INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (workflow_status IN ('staged', 'ignored', 'not_started', 'in_progress', 'submitted', 'needs_grading', 'completed')),
  ADD COLUMN IF NOT EXISTS is_graded BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grading_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (grading_mode IN ('problems_calculator', 'points', 'percentage', 'completion', 'pass_fail')),
  ADD COLUMN IF NOT EXISTS total_problems INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS missed_problems INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS points_possible NUMERIC(8,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS points_earned NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS percentage_score NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS letter_grade TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dropped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'syllabus_staged', 'recurring_template', 'planner_promoted', 'participation_auto')),
  ADD COLUMN IF NOT EXISTS recurring_template_id UUID REFERENCES school.recurring_assignment_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS syllabus_day_number INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_note_id UUID REFERENCES school.parent_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS term_name TEXT NOT NULL DEFAULT 'Semester 1 (Fall)',
  ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026-2027',
  ADD COLUMN IF NOT EXISTS teacher_comments TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resource_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_standards JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. Academic Terms (school.academic_terms)
CREATE TABLE IF NOT EXISTS school.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  name TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'semester'
    CHECK (term_type IN ('quarter', 'semester', 'trimester', 'unit_block', 'full_year')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO school.academic_terms (academic_year, name, term_type, start_date, end_date, is_active, sort_order)
SELECT '2026-2027', 'Semester 1 (Fall)', 'semester', '2026-08-17', '2026-12-18', true, 1
WHERE NOT EXISTS (SELECT 1 FROM school.academic_terms WHERE name = 'Semester 1 (Fall)' AND academic_year = '2026-2027');

INSERT INTO school.academic_terms (academic_year, name, term_type, start_date, end_date, is_active, sort_order)
SELECT '2026-2027', 'Semester 2 (Spring)', 'semester', '2027-01-04', '2027-05-28', false, 2
WHERE NOT EXISTS (SELECT 1 FROM school.academic_terms WHERE name = 'Semester 2 (Spring)' AND academic_year = '2026-2027');

-- 6. Subject Term Grade Overrides & Report Card Notes (school.subject_term_overrides)
CREATE TABLE IF NOT EXISTS school.subject_term_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  term_name TEXT NOT NULL DEFAULT 'Semester 1 (Fall)',
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  override_percentage NUMERIC(6,2) DEFAULT NULL,
  override_letter_grade TEXT DEFAULT NULL,
  override_credits NUMERIC(4,2) DEFAULT NULL,
  teacher_observations TEXT NOT NULL DEFAULT '',
  portfolio_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, term_name, academic_year)
);

-- 7. Attendance Logs & Instructional Hours (school.attendance_logs, school.instructional_hours)
CREATE TABLE IF NOT EXISTS school.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date DATE UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'field_trip', 'sick', 'holiday')),
  hours_logged NUMERIC(4,2) NOT NULL DEFAULT 6.0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school.instructional_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  minutes INT NOT NULL DEFAULT 60,
  activity_description TEXT NOT NULL DEFAULT '',
  source_assignment_id UUID REFERENCES school.assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Transcript Settings & Additional Course Records (school.transcript_settings)
CREATE TABLE IF NOT EXISTS school.transcript_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_legal_name TEXT NOT NULL DEFAULT 'Student Name',
  date_of_birth TEXT NOT NULL DEFAULT '',
  student_id_number TEXT NOT NULL DEFAULT '',
  anticipated_graduation_date TEXT NOT NULL DEFAULT 'May 2034',
  current_grade_level TEXT NOT NULL DEFAULT '5th Grade',
  school_name TEXT NOT NULL DEFAULT 'Casita Capital School',
  school_address TEXT NOT NULL DEFAULT '',
  school_phone TEXT NOT NULL DEFAULT '',
  school_email TEXT NOT NULL DEFAULT '',
  administrator_name TEXT NOT NULL DEFAULT 'Blake Womble',
  administrator_title TEXT NOT NULL DEFAULT 'Principal / Parent Administrator',
  attestation_statement TEXT NOT NULL DEFAULT 'I hereby certify that this transcript is a true and accurate official academic record of coursework completed at Casita Capital School in compliance with state homeschool statutes.',
  standardized_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  honors_and_awards JSONB NOT NULL DEFAULT '[]'::jsonb,
  historical_courses JSONB NOT NULL DEFAULT '[]'::jsonb,
  grading_scale JSONB NOT NULL DEFAULT '{"A": 90, "B": 80, "C": 70, "D": 60}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and grant permissions
ALTER TABLE school.assignment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.recurring_assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.subject_term_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.instructional_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.transcript_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA school TO authenticated, service_role, anon;

DROP POLICY IF EXISTS "Allow all assignment_types" ON school.assignment_types;
CREATE POLICY "Allow all assignment_types" ON school.assignment_types FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all recurring_assignment_templates" ON school.recurring_assignment_templates;
CREATE POLICY "Allow all recurring_assignment_templates" ON school.recurring_assignment_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all academic_terms" ON school.academic_terms;
CREATE POLICY "Allow all academic_terms" ON school.academic_terms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all subject_term_overrides" ON school.subject_term_overrides;
CREATE POLICY "Allow all subject_term_overrides" ON school.subject_term_overrides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all attendance_logs" ON school.attendance_logs;
CREATE POLICY "Allow all attendance_logs" ON school.attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all instructional_hours" ON school.instructional_hours;
CREATE POLICY "Allow all instructional_hours" ON school.instructional_hours FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all transcript_settings" ON school.transcript_settings;
CREATE POLICY "Allow all transcript_settings" ON school.transcript_settings FOR ALL USING (true) WITH CHECK (true);

-- Also ensure school.assignments and school.subjects allow anon/authenticated operations cleanly
DROP POLICY IF EXISTS "Allow all assignments" ON school.assignments;
CREATE POLICY "Allow all assignments" ON school.assignments FOR ALL USING (true) WITH CHECK (true);
