export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  school: {
    Tables: {
      calendar_events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          is_all_day?: boolean;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          is_all_day?: boolean;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          status: 'pending' | 'in_progress' | 'completed';
          priority: 'low' | 'medium' | 'high';
          assigned_to: string | null;
          is_recurring: boolean;
          recurrence_config: Json | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          status?: 'pending' | 'in_progress' | 'completed';
          priority?: 'low' | 'medium' | 'high';
          assigned_to?: string | null;
          is_recurring?: boolean;
          recurrence_config?: Json | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          status?: 'pending' | 'in_progress' | 'completed';
          priority?: 'low' | 'medium' | 'high';
          assigned_to?: string | null;
          is_recurring?: boolean;
          recurrence_config?: Json | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          full_name: string;
          role: 'admin' | 'parent' | 'teacher' | 'student';
          avatar_url: string | null;
          preferences: Json;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email: string;
          full_name: string;
          role?: 'admin' | 'parent' | 'teacher' | 'student';
          avatar_url?: string | null;
          preferences?: Json;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          email?: string;
          full_name?: string;
          role?: 'admin' | 'parent' | 'teacher' | 'student';
          avatar_url?: string | null;
          preferences?: Json;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          color: string;
          link: string | null;
          recurring_config: Json | null;
          broader_discipline?: string;
          course_code?: string;
          course_level?: 'standard' | 'honors' | 'ap' | 'dual_enrollment';
          grade_display_mode?: 'number_only' | 'letter_only' | 'number_and_letter';
          calculation_basis?: 'running_ratio' | 'preset_total_points';
          preset_total_points?: number;
          weighting_mode?: 'category_weighted' | 'raw_points';
          participation_enabled?: boolean;
          participation_scope?: 'per_class_event' | 'per_week' | 'per_module' | 'per_semester';
          participation_auto_behavior?: 'auto_create' | 'queue_for_approval' | 'ignore';
          participation_points?: number;
          credit_calculation_mode?: 'carnegie_hours' | 'fixed_preset';
          preset_credits?: number;
          grading_config?: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          color?: string;
          link?: string | null;
          recurring_config?: Json | null;
          broader_discipline?: string;
          course_code?: string;
          course_level?: 'standard' | 'honors' | 'ap' | 'dual_enrollment';
          grade_display_mode?: 'number_only' | 'letter_only' | 'number_and_letter';
          calculation_basis?: 'running_ratio' | 'preset_total_points';
          preset_total_points?: number;
          weighting_mode?: 'category_weighted' | 'raw_points';
          participation_enabled?: boolean;
          participation_scope?: 'per_class_event' | 'per_week' | 'per_module' | 'per_semester';
          participation_auto_behavior?: 'auto_create' | 'queue_for_approval' | 'ignore';
          participation_points?: number;
          credit_calculation_mode?: 'carnegie_hours' | 'fixed_preset';
          preset_credits?: number;
          grading_config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          color?: string;
          link?: string | null;
          recurring_config?: Json | null;
          broader_discipline?: string;
          course_code?: string;
          course_level?: 'standard' | 'honors' | 'ap' | 'dual_enrollment';
          grade_display_mode?: 'number_only' | 'letter_only' | 'number_and_letter';
          calculation_basis?: 'running_ratio' | 'preset_total_points';
          preset_total_points?: number;
          weighting_mode?: 'category_weighted' | 'raw_points';
          participation_enabled?: boolean;
          participation_scope?: 'per_class_event' | 'per_week' | 'per_module' | 'per_semester';
          participation_auto_behavior?: 'auto_create' | 'queue_for_approval' | 'ignore';
          participation_points?: number;
          credit_calculation_mode?: 'carnegie_hours' | 'fixed_preset';
          preset_credits?: number;
          grading_config?: Json;
          created_at?: string;
        };
      };
      math_syllabus: {
        Row: {
          id: string;
          day_number: number;
          semester: number;
          workbook: string;
          textbook: string;
          topic: string;
          materials: string;
          fast_facts: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_number: number;
          semester?: number;
          workbook?: string;
          textbook?: string;
          topic?: string;
          materials?: string;
          fast_facts?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          day_number?: number;
          semester?: number;
          workbook?: string;
          textbook?: string;
          topic?: string;
          materials?: string;
          fast_facts?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      parental_assignments: {
        Row: {
          id: string;
          subject_id: string;
          assignment_date: string;
          description: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          assignment_date: string;
          description: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          assignment_date?: string;
          description?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      parent_notes: {
        Row: {
          id: string;
          subject_id: string;
          note_date: string;
          title: string | null;
          description: string;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          note_date: string;
          title?: string | null;
          description: string;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          note_date?: string;
          title?: string | null;
          description?: string;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assignments: {
        Row: {
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
          workflow_status?: 'staged' | 'ignored' | 'not_started' | 'in_progress' | 'submitted' | 'needs_grading' | 'completed';
          is_graded?: boolean;
          grading_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          total_problems?: number | null;
          missed_problems?: number | null;
          points_possible?: number;
          points_earned?: number | null;
          percentage_score?: number | null;
          letter_grade?: string | null;
          is_exempt?: boolean;
          is_dropped?: boolean;
          requires_manual_review?: boolean;
          source_type?: 'manual' | 'syllabus_staged' | 'recurring_template' | 'planner_promoted' | 'participation_auto';
          recurring_template_id?: string | null;
          syllabus_day_number?: number | null;
          linked_note_id?: string | null;
          term_name?: string;
          academic_year?: string;
          teacher_comments?: string | null;
          resource_urls?: Json;
          submission_files?: Json;
          state_standards?: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          instructions?: string | null;
          subject_id?: string | null;
          assigned_date?: string | null;
          due_date: string;
          due_time?: string | null;
          completed_at?: string | null;
          estimated_minutes?: number;
          actual_minutes?: number | null;
          priority?: 'low' | 'medium' | 'high';
          category?: string;
          status?: 'pending' | 'in_progress' | 'completed';
          workflow_status?: 'staged' | 'ignored' | 'not_started' | 'in_progress' | 'submitted' | 'needs_grading' | 'completed';
          is_graded?: boolean;
          grading_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          total_problems?: number | null;
          missed_problems?: number | null;
          points_possible?: number;
          points_earned?: number | null;
          percentage_score?: number | null;
          letter_grade?: string | null;
          is_exempt?: boolean;
          is_dropped?: boolean;
          requires_manual_review?: boolean;
          source_type?: 'manual' | 'syllabus_staged' | 'recurring_template' | 'planner_promoted' | 'participation_auto';
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
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          instructions?: string | null;
          subject_id?: string | null;
          assigned_date?: string | null;
          due_date?: string;
          due_time?: string | null;
          completed_at?: string | null;
          estimated_minutes?: number;
          actual_minutes?: number | null;
          priority?: 'low' | 'medium' | 'high';
          category?: string;
          status?: 'pending' | 'in_progress' | 'completed';
          workflow_status?: 'staged' | 'ignored' | 'not_started' | 'in_progress' | 'submitted' | 'needs_grading' | 'completed';
          is_graded?: boolean;
          grading_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          total_problems?: number | null;
          missed_problems?: number | null;
          points_possible?: number;
          points_earned?: number | null;
          percentage_score?: number | null;
          letter_grade?: string | null;
          is_exempt?: boolean;
          is_dropped?: boolean;
          requires_manual_review?: boolean;
          source_type?: 'manual' | 'syllabus_staged' | 'recurring_template' | 'planner_promoted' | 'participation_auto';
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
        };
      };
      holidays: {
        Row: {
          id: string;
          title: string;
          holiday_date: string;
          category: 'governmental' | 'religious' | 'custom';
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          holiday_date: string;
          category?: 'governmental' | 'religious' | 'custom';
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          holiday_date?: string;
          category?: 'governmental' | 'religious' | 'custom';
          is_enabled?: boolean;
          created_at?: string;
        };
      };
      habits: {
        Row: {
          id: string;
          title: string;
          sort_order: number;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          sort_order?: number;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          sort_order?: number;
          is_enabled?: boolean;
          created_at?: string;
        };
      };
      weekly_planner_settings: {
        Row: {
          id: string;
          week_start_date: string;
          todos: Json;
          priorities: Json;
          for_next_month: string;
          notes: string;
          subject_overrides?: Json;
          schedule_start_hour?: number;
          schedule_end_hour?: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          week_start_date: string;
          todos?: Json;
          priorities?: Json;
          for_next_month?: string;
          notes?: string;
          subject_overrides?: Json;
          schedule_start_hour?: number;
          schedule_end_hour?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          week_start_date?: string;
          todos?: Json;
          priorities?: Json;
          for_next_month?: string;
          notes?: string;
          subject_overrides?: Json;
          schedule_start_hour?: number;
          schedule_end_hour?: number;
          created_at?: string;
        };
      };
      time_schedule_blocks: {
        Row: {
          id: string;
          day_of_week: string;
          start_time: string;
          end_time: string;
          title: string;
          block_type: 'class' | 'homework' | 'custom';
          subject_id: string | null;
          color: string | null;
          note: string | null;
          link: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_of_week: string;
          start_time: string;
          end_time: string;
          title: string;
          block_type: 'class' | 'homework' | 'custom';
          subject_id?: string | null;
          color?: string | null;
          note?: string | null;
          link?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          day_of_week?: string;
          start_time?: string;
          end_time?: string;
          title?: string;
          block_type?: 'class' | 'homework' | 'custom';
          subject_id?: string | null;
          color?: string | null;
          note?: string | null;
          link?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      google_calendar_connections: {
        Row: {
          id: string;
          user_id: string | null;
          google_email: string;
          calendar_id: string;
          calendar_name: string;
          color: string;
          is_enabled: boolean;
          show_on_monthly: boolean;
          show_on_weekly: boolean;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          google_email: string;
          calendar_id?: string;
          calendar_name?: string;
          color?: string;
          is_enabled?: boolean;
          show_on_monthly?: boolean;
          show_on_weekly?: boolean;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          google_email?: string;
          calendar_id?: string;
          calendar_name?: string;
          color?: string;
          is_enabled?: boolean;
          show_on_monthly?: boolean;
          show_on_weekly?: boolean;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      google_calendar_events: {
        Row: {
          id: string;
          connection_id: string;
          google_event_id: string;
          title: string;
          description: string | null;
          start_time: string | null;
          end_time: string | null;
          is_all_day: boolean;
          event_date: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connection_id: string;
          google_event_id: string;
          title: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          is_all_day?: boolean;
          event_date: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          connection_id?: string;
          google_event_id?: string;
          title?: string;
          description?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          is_all_day?: boolean;
          event_date?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      assignment_types: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          scoring_mode: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          default_points: number;
          default_weight: number;
          color: string;
          icon: string;
          is_graded_by_default: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          scoring_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          default_points?: number;
          default_weight?: number;
          color?: string;
          icon?: string;
          is_graded_by_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string;
          scoring_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          default_points?: number;
          default_weight?: number;
          color?: string;
          icon?: string;
          is_graded_by_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      recurring_assignment_templates: {
        Row: {
          id: string;
          subject_id: string;
          title_template: string;
          instructions_template: string;
          assignment_type_slug: string;
          grading_mode: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          points_possible: number;
          total_problems_default: number | null;
          days_of_week: Json;
          linked_weekly_source: 'custom' | 'math_workbook' | 'math_fast_facts' | 'attend_class' | 'weekly_template' | 'syllabus_row';
          auto_behavior: 'auto_create' | 'queue_for_approval' | 'ignore';
          estimated_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          title_template: string;
          instructions_template?: string;
          assignment_type_slug?: string;
          grading_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          points_possible?: number;
          total_problems_default?: number | null;
          days_of_week?: Json;
          linked_weekly_source?: 'custom' | 'math_workbook' | 'math_fast_facts' | 'attend_class' | 'weekly_template' | 'syllabus_row';
          auto_behavior?: 'auto_create' | 'queue_for_approval' | 'ignore';
          estimated_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          title_template?: string;
          instructions_template?: string;
          assignment_type_slug?: string;
          grading_mode?: 'problems_calculator' | 'points' | 'percentage' | 'completion' | 'pass_fail';
          points_possible?: number;
          total_problems_default?: number | null;
          days_of_week?: Json;
          linked_weekly_source?: 'custom' | 'math_workbook' | 'math_fast_facts' | 'attend_class' | 'weekly_template' | 'syllabus_row';
          auto_behavior?: 'auto_create' | 'queue_for_approval' | 'ignore';
          estimated_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      academic_terms: {
        Row: {
          id: string;
          academic_year: string;
          name: string;
          term_type: 'quarter' | 'semester' | 'trimester' | 'unit_block' | 'full_year';
          start_date: string;
          end_date: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          academic_year?: string;
          name: string;
          term_type?: 'quarter' | 'semester' | 'trimester' | 'unit_block' | 'full_year';
          start_date: string;
          end_date: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          academic_year?: string;
          name?: string;
          term_type?: 'quarter' | 'semester' | 'trimester' | 'unit_block' | 'full_year';
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      subject_term_overrides: {
        Row: {
          id: string;
          subject_id: string;
          term_name: string;
          academic_year: string;
          override_percentage: number | null;
          override_letter_grade: string | null;
          override_credits: number | null;
          teacher_observations: string;
          portfolio_notes: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          term_name?: string;
          academic_year?: string;
          override_percentage?: number | null;
          override_letter_grade?: string | null;
          override_credits?: number | null;
          teacher_observations?: string;
          portfolio_notes?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          term_name?: string;
          academic_year?: string;
          override_percentage?: number | null;
          override_letter_grade?: string | null;
          override_credits?: number | null;
          teacher_observations?: string;
          portfolio_notes?: string;
          updated_at?: string;
        };
      };
      attendance_logs: {
        Row: {
          id: string;
          attendance_date: string;
          status: 'present' | 'absent' | 'field_trip' | 'sick' | 'holiday';
          hours_logged: number;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_date: string;
          status?: 'present' | 'absent' | 'field_trip' | 'sick' | 'holiday';
          hours_logged?: number;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          attendance_date?: string;
          status?: 'present' | 'absent' | 'field_trip' | 'sick' | 'holiday';
          hours_logged?: number;
          notes?: string;
          created_at?: string;
        };
      };
      instructional_hours: {
        Row: {
          id: string;
          subject_id: string;
          log_date: string;
          minutes: number;
          activity_description: string;
          source_assignment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          log_date: string;
          minutes?: number;
          activity_description?: string;
          source_assignment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          log_date?: string;
          minutes?: number;
          activity_description?: string;
          source_assignment_id?: string | null;
          created_at?: string;
        };
      };
      transcript_settings: {
        Row: {
          id: string;
          student_legal_name: string;
          date_of_birth: string;
          student_id_number: string;
          anticipated_graduation_date: string;
          current_grade_level: string;
          school_name: string;
          school_address: string;
          school_phone: string;
          school_email: string;
          administrator_name: string;
          administrator_title: string;
          attestation_statement: string;
          standardized_tests: Json;
          honors_and_awards: Json;
          historical_courses: Json;
          grading_scale: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_legal_name?: string;
          date_of_birth?: string;
          student_id_number?: string;
          anticipated_graduation_date?: string;
          current_grade_level?: string;
          school_name?: string;
          school_address?: string;
          school_phone?: string;
          school_email?: string;
          administrator_name?: string;
          administrator_title?: string;
          attestation_statement?: string;
          standardized_tests?: Json;
          honors_and_awards?: Json;
          historical_courses?: Json;
          grading_scale?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_legal_name?: string;
          date_of_birth?: string;
          student_id_number?: string;
          anticipated_graduation_date?: string;
          current_grade_level?: string;
          school_name?: string;
          school_address?: string;
          school_phone?: string;
          school_email?: string;
          administrator_name?: string;
          administrator_title?: string;
          attestation_statement?: string;
          standardized_tests?: Json;
          honors_and_awards?: Json;
          historical_courses?: Json;
          grading_scale?: Json;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          actor_id: string | null;
          actor_name: string;
          actor_email: string | null;
          summary: string;
          changed_fields: string[];
          old_data: Json | null;
          new_data: Json | null;
          reverted_at: string | null;
          reverted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          actor_id?: string | null;
          actor_name: string;
          actor_email?: string | null;
          summary: string;
          changed_fields?: string[];
          old_data?: Json | null;
          new_data?: Json | null;
          reverted_at?: string | null;
          reverted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          action?: 'INSERT' | 'UPDATE' | 'DELETE';
          actor_id?: string | null;
          actor_name?: string;
          actor_email?: string | null;
          summary?: string;
          changed_fields?: string[];
          old_data?: Json | null;
          new_data?: Json | null;
          reverted_at?: string | null;
          reverted_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_schema_version: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
