# Casita Capital School — Architecture & Supabase Integration Guide

Welcome to **Casita Capital School** (`school.casitacapital.com`), a dedicated web application for creating and managing weekly school calendars, assignments, homework tasks, and parent management workflows.

This repository is built using the core **Casita Capital Design System**, extracted UI component primitives, and a dedicated `"school"` PostgreSQL schema on the existing Supabase database.

---

## 1. What's Included in This Project

### Tech Stack & Libraries
- **Framework**: Next.js 16 (App Router) + React 18
- **Language**: TypeScript (configured with strict type-checking)
- **Styling & Theme Engine**: Tailwind CSS v4 + Material UI (MUI v5) + Emotion
- **Database Client**: `@supabase/ssr` + `@supabase/supabase-js`
- **Calendar & Scheduling**: FullCalendar v6 (`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`)
- **Icons & Typography**: Lucide Icons + Inter Font (`@fontsource/inter`)

### Design System & Theme Engine (`src/theme/`)
- **11 Accent Color Presets**: Supports dynamic accent switching (`monacoBlue` default, `livingCoral`, `emerald`, `darkViolet`, etc.).
- **Typography Scale**: Standardized Inter rem sizes (`h1` through `h6`, `subtitle1`, `body1`, `caption`).
- **Geometries & Spacing**: 8px grid system, 6px border radius (`BORDER_RADIUS = 6`), 288px sidebar width, 54px header height.
- **Dual Palette Modes**: Complete Light Mode and Dark Mode support with elevation shadow systems.

### Layout & Page Architecture
- **Root Providers** (`src/components/base/root-theme-provider.tsx`): Manages SSR Emotion styling cache and dynamic MUI themes.
- **Layout Shell** (`src/layouts/`): Responsive left sidebar navigation, top application header bar, theme mode switcher, and container wrappers.
- **Starter Pages**:
  - `src/app/page.tsx` — Main Dashboard overview (`/`)
  - `src/app/calendar/page.tsx` — Weekly Calendar starting view (`/calendar`)
  - `src/app/tasks/page.tsx` — To-Do List & Task Management starting view (`/tasks`)
  - `src/app/settings/page.tsx` — Student & Parent Preferences (`/settings`)

---

## 2. Supabase Integration Architecture

This application connects to your existing shared Supabase database instance while isolating all school-related tables under the dedicated `"school"` schema.

### Database Connection & Credentials
Environment configuration is defined in `.env.local` (and `.env.example` for templates):

```env
NEXT_PUBLIC_SUPABASE_URL=https://engratmfsfifqwvluepy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wH6y0FgdcLsYMIMXY_e1DA_96PLYlxL
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://school.casitacapital.com
```

### Schema Isolation (`db: { schema: 'school' }`)
Rather than polluting the default `public` schema, all table queries and mutations in this project automatically target the `"school"` schema.

- `supabase/config.toml` is configured with:
  ```toml
  schemas = ["public", "graphql_public", "school"]
  extra_search_path = ["public", "extensions", "school"]
  ```
- An initial migration script `supabase/migrations/20260819000000_init_school_schema.sql` creates the schema and grants usage permissions:
  ```sql
  CREATE SCHEMA IF NOT EXISTS school;
  GRANT USAGE ON SCHEMA school TO anon, authenticated, service_role;
  ```

---

## 3. How to Interact with Supabase in Code

The Supabase services located in `src/services/supabase/` pre-configure the schema target for both browser and server execution.

### A. Client Components (Browser)
Import `createClient` from `src/services/supabase/client`:

```typescript
'use client';

import { createClient } from 'src/services/supabase/client';
import { useEffect, useState } from 'react';

export function CalendarEventsList() {
  const [events, setEvents] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadEvents() {
      // Automatically queries the 'school' schema ('school.calendar_events')
      const { data, error } = await supabase.from('calendar_events').select('*');
      if (data) setEvents(data);
    }
    loadEvents();
  }, []);

  return <div>{/* Render events */}</div>;
}
```

### B. Server Components, Server Actions & API Routes
Import `createClient` (for user session requests) or `createAdminClient` (for administrative bypass) from `src/services/supabase/server`:

```typescript
import { createClient, createAdminClient } from 'src/services/supabase/server';

// Server Component or Route Handler
export async function getWeeklyTasks() {
  const supabase = await createClient();
  
  // Queries school.tasks table
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true });

  return tasks;
}

// Service role operation (e.g. background sync or webhooks)
export function getAdminClient() {
  const adminSupabase = createAdminClient();
  return adminSupabase;
}
```

---

## 4. How to Add New Tables to the `"school"` Schema

When adding new tables for the weekly calendar or to-do list creator, always specify the `school` schema prefix in your SQL migrations.

### Step 1: Create a Migration Script
Add a new `.sql` file in `supabase/migrations/` (e.g., `20260819100000_create_school_tables.sql`):

```sql
-- Create weekly calendar events table
CREATE TABLE IF NOT EXISTS school.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create task / to-do list items table
CREATE TABLE IF NOT EXISTS school.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE school.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE school.tasks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage calendar events & tasks
CREATE POLICY "Allow authenticated read calendar_events" ON school.calendar_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert calendar_events" ON school.calendar_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update calendar_events" ON school.calendar_events FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read tasks" ON school.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert tasks" ON school.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update tasks" ON school.tasks FOR UPDATE USING (auth.role() = 'authenticated');
```

### Step 2: Update TypeScript Types
Define or update database interfaces in `src/services/supabase/types.ts` to match your new schema:

```typescript
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
        Insert: { /* ... */ };
        Update: { /* ... */ };
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
          created_at: string;
          updated_at: string;
        };
        Insert: { /* ... */ };
        Update: { /* ... */ };
      };
    };
  };
}
```

---

## 5. Development & Type-Check Verification Commands

### Start Local Development Server
Runs Next.js on port `3002` (`http://localhost:3002`):
```bash
npm run dev
```

### Validate TypeScript Strict Compliance
Before finalizing code changes or committing, verify that there are no type errors:
```bash
npm run typecheck
```

---

## 6. Single Source of Truth Guidelines

- **UI Components**: Check `src/components/base/` before creating custom headers, cards, scrollbars, or dialog wrappers.
- **Theme Palette & Colors**: Never hardcode hex values like `#0C74E4` inline. Always use `theme.palette.primary.main` or standard MUI tokens.
- **Type Strictness**: Avoid the `any` type at all times. Use explicit TypeScript interfaces or generics.
