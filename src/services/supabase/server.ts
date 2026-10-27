import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potzuuqaxzjupbajhbha.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_E4yMWDnJpNtt4ZGWIZmTGg_d_ZKEX0M',
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potzuuqaxzjupbajhbha.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdHp1dXFheHpqdXBiYWpoYmhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTc4MTQxMywiZXhwIjoyMTA1MzU3NDEzfQ.V0zm8IeQiP1EMKrydtZ30aJlvSWGi5wfq46kBWYntiw';

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'school' },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
