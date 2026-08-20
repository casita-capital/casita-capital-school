import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://engratmfsfifqwvluepy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wH6y0FgdcLsYMIMXY_e1DA_96PLYlxL',
    {
      db: { schema: 'school' },
      auth: {
        lock: async (_name, _acquireTimeout, fn) => {
          return await fn();
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component cookie set fallback
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://engratmfsfifqwvluepy.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZ3JhdG1mc2ZpZnF3dmx1ZXB5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA1NTg2NywiZXhwIjoyMDg3NjMxODY3fQ.vI8m5qfH8iyA-yU8BTyiwLSgl-8GHlu-VtdovPk0Z6k';

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'school' },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
