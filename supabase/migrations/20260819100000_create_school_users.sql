-- Migration: Create school.users table and seed initial parent users
CREATE SCHEMA IF NOT EXISTS school;

-- Create school.users table
CREATE TABLE IF NOT EXISTS school.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'parent', 'teacher', 'student')) DEFAULT 'parent',
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on school.users
ALTER TABLE school.users ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon, authenticated, service_role
GRANT ALL ON school.users TO authenticated, service_role;
GRANT SELECT ON school.users TO anon;

-- RLS policies
DROP POLICY IF EXISTS "Allow authenticated read school_users" ON school.users;
CREATE POLICY "Allow authenticated read school_users"
  ON school.users FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow authenticated write school_users" ON school.users;
CREATE POLICY "Allow authenticated write school_users"
  ON school.users FOR ALL
  USING (auth.role() = 'authenticated');
