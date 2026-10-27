-- Complete 'school' schema baseline for Casita Capital School (school.casitacapital.com)
CREATE SCHEMA IF NOT EXISTS school;

-- Grant usage and default privileges on school schema
GRANT USAGE ON SCHEMA school TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ============================================================================
-- 1. TABLES & CONSTRAINTS
-- ============================================================================

-- 1.1 school.users
CREATE TABLE IF NOT EXISTS school.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'parent' CHECK (role = ANY (ARRAY['admin'::text, 'parent'::text, 'teacher'::text, 'student'::text])),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS school_users_auth_id_idx ON school.users USING btree (auth_id) WHERE (auth_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS school_users_email_idx ON school.users USING btree (email);

-- 1.2 school.subjects
CREATE TABLE IF NOT EXISTS school.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  color TEXT DEFAULT '#0C74E4',
  created_at TIMESTAMPTZ DEFAULT now(),
  link TEXT,
  recurring_config JSONB,
  broader_discipline TEXT NOT NULL DEFAULT 'General',
  course_code TEXT NOT NULL DEFAULT '',
  course_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (course_level = ANY (ARRAY['standard'::text, 'honors'::text, 'ap'::text, 'dual_enrollment'::text])),
  grade_display_mode TEXT NOT NULL DEFAULT 'number_and_letter'
    CHECK (grade_display_mode = ANY (ARRAY['number_only'::text, 'letter_only'::text, 'number_and_letter'::text])),
  calculation_basis TEXT NOT NULL DEFAULT 'running_ratio'
    CHECK (calculation_basis = ANY (ARRAY['running_ratio'::text, 'preset_total_points'::text])),
  preset_total_points NUMERIC(10,2) NOT NULL DEFAULT 1000,
  weighting_mode TEXT NOT NULL DEFAULT 'category_weighted'
    CHECK (weighting_mode = ANY (ARRAY['category_weighted'::text, 'raw_points'::text])),
  participation_enabled BOOLEAN NOT NULL DEFAULT false,
  participation_scope TEXT NOT NULL DEFAULT 'per_week'
    CHECK (participation_scope = ANY (ARRAY['per_class_event'::text, 'per_week'::text, 'per_module'::text, 'per_semester'::text])),
  participation_auto_behavior TEXT NOT NULL DEFAULT 'queue_for_approval'
    CHECK (participation_auto_behavior = ANY (ARRAY['auto_create'::text, 'queue_for_approval'::text, 'ignore'::text])),
  participation_points NUMERIC(8,2) NOT NULL DEFAULT 10,
  credit_calculation_mode TEXT NOT NULL DEFAULT 'fixed_preset'
    CHECK (credit_calculation_mode = ANY (ARRAY['carnegie_hours'::text, 'fixed_preset'::text])),
  preset_credits NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  grading_config JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 1.3 school.assignment_types
CREATE TABLE IF NOT EXISTS school.assignment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  scoring_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (scoring_mode = ANY (ARRAY['problems_calculator'::text, 'points'::text, 'percentage'::text, 'completion'::text, 'pass_fail'::text])),
  default_points NUMERIC(8,2) NOT NULL DEFAULT 100,
  default_weight NUMERIC(5,2) NOT NULL DEFAULT 20,
  color TEXT NOT NULL DEFAULT '#0C74E4',
  icon TEXT NOT NULL DEFAULT 'FileText',
  is_graded_by_default BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 school.academic_terms
CREATE TABLE IF NOT EXISTS school.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  name TEXT NOT NULL,
  term_type TEXT NOT NULL DEFAULT 'semester'
    CHECK (term_type = ANY (ARRAY['quarter'::text, 'semester'::text, 'trimester'::text, 'unit_block'::text, 'full_year'::text])),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.5 school.habits
CREATE TABLE IF NOT EXISTS school.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.6 school.holidays
CREATE TABLE IF NOT EXISTS school.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  category TEXT DEFAULT 'governmental'
    CHECK (category = ANY (ARRAY['governmental'::text, 'religious'::text, 'custom'::text])),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.7 school.math_syllabus
CREATE TABLE IF NOT EXISTS school.math_syllabus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INT NOT NULL UNIQUE,
  semester INT NOT NULL DEFAULT 1,
  workbook TEXT NOT NULL DEFAULT '',
  textbook TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  materials TEXT NOT NULL DEFAULT '',
  fast_facts TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.8 school.weekly_planner_settings
CREATE TABLE IF NOT EXISTS school.weekly_planner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,
  todos JSONB DEFAULT '[]'::jsonb,
  priorities JSONB DEFAULT '[]'::jsonb,
  for_next_month TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  schedule_start_hour INT DEFAULT 7,
  schedule_end_hour INT DEFAULT 19,
  subject_overrides JSONB DEFAULT '{}'::jsonb
);

-- 1.9 school.parental_notes
CREATE TABLE IF NOT EXISTS school.parental_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date DATE,
  week_start_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.10 school.parental_assignments
CREATE TABLE IF NOT EXISTS school.parental_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES school.subjects(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.11 school.parent_notes
CREATE TABLE IF NOT EXISTS school.parent_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES school.subjects(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  title TEXT
);

-- 1.12 school.recurring_assignment_templates
CREATE TABLE IF NOT EXISTS school.recurring_assignment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  title_template TEXT NOT NULL,
  instructions_template TEXT NOT NULL DEFAULT '',
  assignment_type_slug TEXT NOT NULL DEFAULT 'homework',
  grading_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (grading_mode = ANY (ARRAY['problems_calculator'::text, 'points'::text, 'percentage'::text, 'completion'::text, 'pass_fail'::text])),
  points_possible NUMERIC(8,2) NOT NULL DEFAULT 100,
  total_problems_default INT,
  days_of_week JSONB NOT NULL DEFAULT '["friday"]'::jsonb,
  linked_weekly_source TEXT NOT NULL DEFAULT 'custom'
    CHECK (linked_weekly_source = ANY (ARRAY['custom'::text, 'math_workbook'::text, 'math_fast_facts'::text, 'attend_class'::text, 'weekly_template'::text, 'syllabus_row'::text])),
  auto_behavior TEXT NOT NULL DEFAULT 'auto_create'
    CHECK (auto_behavior = ANY (ARRAY['auto_create'::text, 'queue_for_approval'::text, 'ignore'::text])),
  estimated_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.13 school.assignments
CREATE TABLE IF NOT EXISTS school.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES school.subjects(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'homework',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  instructions TEXT,
  assigned_date DATE,
  due_time TEXT,
  completed_at TIMESTAMPTZ,
  estimated_minutes INT NOT NULL DEFAULT 30,
  actual_minutes INT,
  workflow_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (workflow_status = ANY (ARRAY['staged'::text, 'ignored'::text, 'not_started'::text, 'in_progress'::text, 'submitted'::text, 'needs_grading'::text, 'completed'::text])),
  is_graded BOOLEAN NOT NULL DEFAULT true,
  grading_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (grading_mode = ANY (ARRAY['problems_calculator'::text, 'points'::text, 'percentage'::text, 'completion'::text, 'pass_fail'::text])),
  total_problems INT,
  missed_problems INT,
  points_possible NUMERIC(8,2) NOT NULL DEFAULT 100,
  points_earned NUMERIC(8,2) DEFAULT NULL,
  percentage_score NUMERIC(6,2) DEFAULT NULL,
  letter_grade TEXT,
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  is_dropped BOOLEAN NOT NULL DEFAULT false,
  requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type = ANY (ARRAY['manual'::text, 'syllabus_staged'::text, 'recurring_template'::text, 'planner_promoted'::text, 'participation_auto'::text])),
  recurring_template_id UUID REFERENCES school.recurring_assignment_templates(id) ON DELETE SET NULL,
  syllabus_day_number INT,
  linked_note_id UUID REFERENCES school.parent_notes(id) ON DELETE SET NULL,
  term_name TEXT NOT NULL DEFAULT 'Semester 1 (Fall)',
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  teacher_comments TEXT,
  resource_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_standards JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 1.14 school.tasks
CREATE TABLE IF NOT EXISTS school.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  subject_id UUID REFERENCES school.subjects(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT DEFAULT 'medium'
    CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])),
  assigned_to UUID,
  created_by TEXT,
  updated_by TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_config JSONB
);

-- 1.15 school.time_schedule_blocks
CREATE TABLE IF NOT EXISTS school.time_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  block_type TEXT NOT NULL,
  subject_id UUID REFERENCES school.subjects(id) ON DELETE SET NULL,
  color TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  link TEXT
);

-- 1.16 school.subject_term_overrides
CREATE TABLE IF NOT EXISTS school.subject_term_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  term_name TEXT NOT NULL DEFAULT 'Semester 1 (Fall)',
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  override_percentage NUMERIC(6,2) DEFAULT NULL,
  override_letter_grade TEXT,
  override_credits NUMERIC(4,2) DEFAULT NULL,
  teacher_observations TEXT NOT NULL DEFAULT '',
  portfolio_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, term_name, academic_year)
);

-- 1.17 school.attendance_logs
CREATE TABLE IF NOT EXISTS school.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'field_trip'::text, 'sick'::text, 'holiday'::text])),
  hours_logged NUMERIC(4,2) NOT NULL DEFAULT 6.0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.18 school.instructional_hours
CREATE TABLE IF NOT EXISTS school.instructional_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES school.subjects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  minutes INT NOT NULL DEFAULT 60,
  activity_description TEXT NOT NULL DEFAULT '',
  source_assignment_id UUID REFERENCES school.assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.19 school.transcript_settings
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

-- 1.20 school.google_calendar_connections
CREATE TABLE IF NOT EXISTS school.google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email VARCHAR(255) NOT NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  calendar_name VARCHAR(255) NOT NULL DEFAULT 'Google Calendar',
  color VARCHAR(32) NOT NULL DEFAULT '#4285F4',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  show_on_monthly BOOLEAN NOT NULL DEFAULT true,
  show_on_weekly BOOLEAN NOT NULL DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.21 school.google_calendar_events
CREATE TABLE IF NOT EXISTS school.google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES school.google_calendar_connections(id) ON DELETE CASCADE,
  google_event_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  event_date DATE NOT NULL,
  color VARCHAR(32) NOT NULL DEFAULT '#4285F4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, google_event_id)
);

-- 1.22 school.audit_logs
CREATE TABLE IF NOT EXISTS school.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_email TEXT,
  summary TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  old_data JSONB,
  new_data JSONB,
  reverted_at TIMESTAMPTZ,
  reverted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_name ON school.audit_logs USING btree (actor_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON school.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON school.audit_logs USING btree (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON school.audit_logs USING btree (table_name);

-- ============================================================================
-- 2. GRANTS & ROW LEVEL SECURITY (RLS)
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA school TO authenticated, service_role, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA school TO authenticated, service_role, anon;

ALTER TABLE school.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.assignment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.instructional_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.math_syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.parent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.parental_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.parental_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.recurring_assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.subject_term_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.transcript_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.weekly_planner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all academic_terms" ON school.academic_terms;
CREATE POLICY "Allow all academic_terms" ON school.academic_terms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all assignment_types" ON school.assignment_types;
CREATE POLICY "Allow all assignment_types" ON school.assignment_types FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all assignments" ON school.assignments;
CREATE POLICY "Allow all assignments" ON school.assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users on assignments" ON school.assignments;
CREATE POLICY "Allow all for authenticated users on assignments" ON school.assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all attendance_logs" ON school.attendance_logs;
CREATE POLICY "Allow all attendance_logs" ON school.attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to audit_logs" ON school.audit_logs;
CREATE POLICY "Allow public access to audit_logs" ON school.audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read/write google_calendar_connections" ON school.google_calendar_connections;
CREATE POLICY "Allow authenticated read/write google_calendar_connections" ON school.google_calendar_connections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read/write google_calendar_events" ON school.google_calendar_events;
CREATE POLICY "Allow authenticated read/write google_calendar_events" ON school.google_calendar_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read habits" ON school.habits;
CREATE POLICY "Allow read habits" ON school.habits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write habits" ON school.habits;
CREATE POLICY "Allow write habits" ON school.habits FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read holidays" ON school.holidays;
CREATE POLICY "Allow read holidays" ON school.holidays FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write holidays" ON school.holidays;
CREATE POLICY "Allow write holidays" ON school.holidays FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all instructional_hours" ON school.instructional_hours;
CREATE POLICY "Allow all instructional_hours" ON school.instructional_hours FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read math_syllabus" ON school.math_syllabus;
CREATE POLICY "Allow read math_syllabus" ON school.math_syllabus FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write math_syllabus" ON school.math_syllabus;
CREATE POLICY "Allow write math_syllabus" ON school.math_syllabus FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users on parent_notes" ON school.parent_notes;
CREATE POLICY "Allow all for authenticated users on parent_notes" ON school.parent_notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read parental_assignments" ON school.parental_assignments;
CREATE POLICY "Allow read parental_assignments" ON school.parental_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write parental_assignments" ON school.parental_assignments;
CREATE POLICY "Allow write parental_assignments" ON school.parental_assignments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read parental_notes" ON school.parental_notes;
CREATE POLICY "Allow read parental_notes" ON school.parental_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write parental_notes" ON school.parental_notes;
CREATE POLICY "Allow write parental_notes" ON school.parental_notes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all recurring_assignment_templates" ON school.recurring_assignment_templates;
CREATE POLICY "Allow all recurring_assignment_templates" ON school.recurring_assignment_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all subject_term_overrides" ON school.subject_term_overrides;
CREATE POLICY "Allow all subject_term_overrides" ON school.subject_term_overrides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read subjects" ON school.subjects;
CREATE POLICY "Allow read subjects" ON school.subjects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write subjects" ON school.subjects;
CREATE POLICY "Allow write subjects" ON school.subjects FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read tasks" ON school.tasks;
CREATE POLICY "Allow read tasks" ON school.tasks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write tasks" ON school.tasks;
CREATE POLICY "Allow write tasks" ON school.tasks FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all transcript_settings" ON school.transcript_settings;
CREATE POLICY "Allow all transcript_settings" ON school.transcript_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon write school_users" ON school.users;
CREATE POLICY "Allow anon write school_users" ON school.users FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read school_users" ON school.users;
CREATE POLICY "Allow authenticated read school_users" ON school.users FOR SELECT USING ((auth.role() = 'authenticated'::text) OR (auth.role() = 'anon'::text));
DROP POLICY IF EXISTS "Allow authenticated write school_users" ON school.users;
CREATE POLICY "Allow authenticated write school_users" ON school.users FOR ALL USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Allow read weekly_planner_settings" ON school.weekly_planner_settings;
CREATE POLICY "Allow read weekly_planner_settings" ON school.weekly_planner_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write weekly_planner_settings" ON school.weekly_planner_settings;
CREATE POLICY "Allow write weekly_planner_settings" ON school.weekly_planner_settings FOR ALL USING (true);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION school.get_schema_version()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 'school_v1.0'::text;
$function$;

CREATE OR REPLACE FUNCTION school.resolve_current_actor(fallback_name text DEFAULT NULL::text, OUT actor_id uuid, OUT actor_name text, OUT actor_email text)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'school', 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid;
  v_jwt jsonb;
  v_jwt_email text;
BEGIN
  v_uid := auth.uid();
  v_jwt := auth.jwt();
  v_jwt_email := COALESCE(v_jwt ->> 'email', NULL);

  actor_id := v_uid;
  actor_name := NULL;
  actor_email := v_jwt_email;

  -- Try school.users by auth_id first
  IF v_uid IS NOT NULL THEN
    SELECT u.full_name, u.email
      INTO actor_name, actor_email
      FROM school.users u
     WHERE u.auth_id = v_uid
     LIMIT 1;
  END IF;

  -- Try school.users by email from JWT
  IF actor_name IS NULL AND v_jwt_email IS NOT NULL THEN
    SELECT u.full_name, u.email
      INTO actor_name, actor_email
      FROM school.users u
     WHERE lower(u.email) = lower(v_jwt_email)
     LIMIT 1;
  END IF;

  -- Try auth.users metadata if still unresolved
  IF actor_name IS NULL AND v_uid IS NOT NULL THEN
    SELECT
      COALESCE(
        au.raw_user_meta_data ->> 'full_name',
        au.raw_user_meta_data ->> 'name',
        initcap(replace(split_part(au.email, '@', 1), '.', ' '))
      ),
      au.email
      INTO actor_name, actor_email
      FROM auth.users au
     WHERE au.id = v_uid
     LIMIT 1;
  END IF;

  -- If no auth session (e.g. anon client with fallback_name), check if fallback_name matches a known user
  IF actor_name IS NULL AND fallback_name IS NOT NULL AND btrim(fallback_name) <> '' THEN
    SELECT u.auth_id, u.full_name, u.email
      INTO actor_id, actor_name, actor_email
      FROM school.users u
     WHERE lower(u.full_name) = lower(btrim(fallback_name))
        OR lower(u.email) = lower(btrim(fallback_name))
     LIMIT 1;

    IF actor_name IS NULL THEN
      actor_name := btrim(fallback_name);
    END IF;
  END IF;

  IF actor_name IS NULL OR btrim(actor_name) = '' THEN
    actor_name := 'System / Automation';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION school.stamp_actor_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'school', 'public', 'auth'
AS $function$
DECLARE
  v_actor record;
  v_client_hint text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_client_hint := COALESCE(NEW.updated_by, NEW.created_by);
  ELSE
    v_client_hint := NEW.updated_by;
  END IF;

  SELECT * INTO v_actor FROM school.resolve_current_actor(v_client_hint);

  -- If authenticated via Supabase Auth, always stamp the true authenticated user's name
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := v_actor.actor_name;
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := v_actor.actor_name;
    END IF;
  ELSE
    -- Unauthenticated / service call: fill in if blank
    IF NEW.updated_by IS NULL OR btrim(NEW.updated_by) = '' THEN
      NEW.updated_by := v_actor.actor_name;
    END IF;
    IF TG_OP = 'INSERT' AND (NEW.created_by IS NULL OR btrim(NEW.created_by) = '') THEN
      NEW.created_by := v_actor.actor_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION school.log_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'school', 'public', 'auth'
AS $function$
DECLARE
  v_old_json jsonb := NULL;
  v_new_json jsonb := NULL;
  v_record_id text;
  v_client_hint text := NULL;
  v_actor record;
  v_changed_fields text[] := '{}';
  v_key text;
  v_subject_name text := NULL;
  v_subject_id text := NULL;
  v_summary text := '';
  v_action_verb text;
  v_note_date text;
  v_title text;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new_json := to_jsonb(NEW);
    v_record_id := COALESCE(v_new_json ->> 'id', '');
    v_client_hint := COALESCE(v_new_json ->> 'updated_by', v_new_json ->> 'created_by');
    v_action_verb := 'Created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_record_id := COALESCE(v_new_json ->> 'id', v_old_json ->> 'id', '');
    v_client_hint := v_new_json ->> 'updated_by';
    v_action_verb := 'Updated';

    -- Compute changed fields (ignoring metadata timestamps/actor columns)
    SELECT COALESCE(array_agg(k ORDER BY k), '{}')
      INTO v_changed_fields
      FROM (
        SELECT k
          FROM jsonb_object_keys(v_new_json) AS k
         WHERE k NOT IN ('updated_at', 'created_at', 'updated_by', 'created_by')
           AND (v_new_json -> k) IS DISTINCT FROM (v_old_json -> k)
      ) sub;

    -- Skip no-op updates
    IF array_length(v_changed_fields, 1) IS NULL OR array_length(v_changed_fields, 1) = 0 THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_record_id := COALESCE(v_old_json ->> 'id', '');
    v_client_hint := COALESCE(v_old_json ->> 'updated_by', v_old_json ->> 'created_by');
    v_action_verb := 'Deleted';
  END IF;

  SELECT * INTO v_actor FROM school.resolve_current_actor(v_client_hint);

  -- Resolve subject_name if subject_id exists on the record
  v_subject_id := COALESCE(v_new_json ->> 'subject_id', v_old_json ->> 'subject_id');
  IF v_subject_id IS NOT NULL AND v_subject_id <> '' THEN
    SELECT s.name INTO v_subject_name
      FROM school.subjects s
     WHERE s.id::text = v_subject_id
     LIMIT 1;
  END IF;

  -- Build human-readable summary per table
  IF TG_TABLE_NAME = 'parent_notes' THEN
    v_note_date := COALESCE(v_new_json ->> 'note_date', v_old_json ->> 'note_date', '');
    v_title := COALESCE(
      NULLIF(btrim(COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', '')), ''),
      left(btrim(COALESCE(v_new_json ->> 'description', v_old_json ->> 'description', '')), 60)
    );
    v_summary := format(
      '%s Weekly Planner cell for %s on %s%s',
      v_action_verb,
      COALESCE(v_subject_name, 'Subject'),
      v_note_date,
      CASE WHEN v_title IS NOT NULL AND v_title <> '' THEN format(' ("%s")', v_title) ELSE '' END
    );
  ELSIF TG_TABLE_NAME = 'assignments' THEN
    v_title := COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', 'Assignment');
    v_summary := format(
      '%s assignment "%s"%s',
      v_action_verb,
      v_title,
      CASE WHEN v_subject_name IS NOT NULL THEN format(' (%s)', v_subject_name) ELSE '' END
    );
  ELSIF TG_TABLE_NAME = 'weekly_planner_settings' THEN
    v_note_date := COALESCE(v_new_json ->> 'week_start_date', v_old_json ->> 'week_start_date', '');
    v_summary := format(
      '%s Weekly Planner sidebar & settings for week of %s',
      v_action_verb,
      v_note_date
    );
  ELSIF TG_TABLE_NAME = 'subjects' THEN
    v_title := COALESCE(v_new_json ->> 'name', v_old_json ->> 'name', 'Subject');
    v_summary := format('%s subject "%s"', v_action_verb, v_title);
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    v_title := COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', 'Task');
    v_summary := format('%s to-do task "%s"', v_action_verb, v_title);
  ELSIF TG_TABLE_NAME = 'time_schedule_blocks' THEN
    v_title := COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', 'Schedule Block');
    v_note_date := initcap(COALESCE(v_new_json ->> 'day_of_week', v_old_json ->> 'day_of_week', ''));
    v_summary := format('%s schedule block "%s" (%s)', v_action_verb, v_title, v_note_date);
  ELSIF TG_TABLE_NAME = 'holidays' THEN
    v_title := COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', 'Holiday');
    v_note_date := COALESCE(v_new_json ->> 'holiday_date', v_old_json ->> 'holiday_date', '');
    v_summary := format('%s holiday "%s" (%s)', v_action_verb, v_title, v_note_date);
  ELSIF TG_TABLE_NAME = 'habits' THEN
    v_title := COALESCE(v_new_json ->> 'title', v_old_json ->> 'title', 'Habit');
    v_summary := format('%s daily habit "%s"', v_action_verb, v_title);
  ELSIF TG_TABLE_NAME = 'recurring_assignment_templates' THEN
    v_title := COALESCE(v_new_json ->> 'title_template', v_old_json ->> 'title_template', 'Recurring Rule');
    v_summary := format(
      '%s recurring assignment rule "%s"%s',
      v_action_verb,
      v_title,
      CASE WHEN v_subject_name IS NOT NULL THEN format(' (%s)', v_subject_name) ELSE '' END
    );
  ELSIF TG_TABLE_NAME = 'math_syllabus' THEN
    v_title := COALESCE(v_new_json ->> 'day_number', v_old_json ->> 'day_number', '');
    v_summary := format('%s Math Syllabus Day %s', v_action_verb, v_title);
  ELSE
    v_summary := format('%s record in %s', v_action_verb, TG_TABLE_NAME);
  END IF;

  INSERT INTO school.audit_logs (
    table_name,
    record_id,
    action,
    actor_id,
    actor_name,
    actor_email,
    summary,
    changed_fields,
    old_data,
    new_data,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_actor.actor_id,
    v_actor.actor_name,
    v_actor.actor_email,
    v_summary,
    v_changed_fields,
    v_old_json,
    v_new_json,
    now()
  );

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION school.sync_auth_user_last_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'school', 'public'
AS $function$
BEGIN
  UPDATE school.users
  SET
    auth_id = COALESCE(auth_id, NEW.id),
    last_login_at = COALESCE(NEW.last_sign_in_at, last_login_at, now()),
    updated_at = now()
  WHERE auth_id = NEW.id OR lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA school TO anon, authenticated, service_role;

-- Triggers on school.* tables
DROP TRIGGER IF EXISTS trg_stamp_actor_assignments ON school.assignments;
CREATE TRIGGER trg_stamp_actor_assignments BEFORE INSERT OR UPDATE ON school.assignments FOR EACH ROW EXECUTE FUNCTION school.stamp_actor_columns();

DROP TRIGGER IF EXISTS trg_stamp_actor_tasks ON school.tasks;
CREATE TRIGGER trg_stamp_actor_tasks BEFORE INSERT OR UPDATE ON school.tasks FOR EACH ROW EXECUTE FUNCTION school.stamp_actor_columns();

DROP TRIGGER IF EXISTS trg_stamp_actor_time_schedule_blocks ON school.time_schedule_blocks;
CREATE TRIGGER trg_stamp_actor_time_schedule_blocks BEFORE INSERT OR UPDATE ON school.time_schedule_blocks FOR EACH ROW EXECUTE FUNCTION school.stamp_actor_columns();

DROP TRIGGER IF EXISTS trg_stamp_actor_parent_notes ON school.parent_notes;
CREATE TRIGGER trg_stamp_actor_parent_notes BEFORE INSERT OR UPDATE ON school.parent_notes FOR EACH ROW EXECUTE FUNCTION school.stamp_actor_columns();

DROP TRIGGER IF EXISTS trg_audit_log ON school.assignments;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.assignments FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.weekly_planner_settings;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.weekly_planner_settings FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.subjects;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.subjects FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.tasks;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.tasks FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.time_schedule_blocks;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.time_schedule_blocks FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.holidays;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.holidays FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.habits;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.habits FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.recurring_assignment_templates;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.recurring_assignment_templates FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.assignment_types;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.assignment_types FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.academic_terms;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.academic_terms FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.subject_term_overrides;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.subject_term_overrides FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.transcript_settings;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.transcript_settings FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.math_syllabus;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.math_syllabus FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_log ON school.parent_notes;
CREATE TRIGGER trg_audit_log AFTER INSERT OR DELETE OR UPDATE ON school.parent_notes FOR EACH ROW EXECUTE FUNCTION school.log_audit_event();

-- Trigger on auth.users to sync last_sign_in_at and link auth_id by email
DROP TRIGGER IF EXISTS on_auth_user_login_sync ON auth.users;
CREATE TRIGGER on_auth_user_login_sync AFTER INSERT OR UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW EXECUTE FUNCTION school.sync_auth_user_last_login();
