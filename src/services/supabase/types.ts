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
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          color?: string;
          created_at?: string;
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
          subject_id: string | null;
          due_date: string;
          priority: 'low' | 'medium' | 'high';
          category: 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
          status: 'pending' | 'in_progress' | 'completed';
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          subject_id?: string | null;
          due_date: string;
          priority?: 'low' | 'medium' | 'high';
          category?: 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
          status?: 'pending' | 'in_progress' | 'completed';
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          subject_id?: string | null;
          due_date?: string;
          priority?: 'low' | 'medium' | 'high';
          category?: 'homework' | 'project' | 'test' | 'quiz' | 'reading' | 'paper';
          status?: 'pending' | 'in_progress' | 'completed';
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
