-- Create dedicated 'school' schema for Casita Capital School (school.casitacapital.com)
CREATE SCHEMA IF NOT EXISTS school;

-- Grant usage on school schema to authenticated, anon, and service_role
GRANT USAGE ON SCHEMA school TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA school GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Example: Add school schema search path confirmation function
CREATE OR REPLACE FUNCTION school.get_schema_version()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'school_v1.0'::text;
$$;

GRANT EXECUTE ON FUNCTION school.get_schema_version() TO anon, authenticated, service_role;
