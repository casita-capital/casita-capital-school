import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://engratmfsfifqwvluepy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wH6y0FgdcLsYMIMXY_e1DA_96PLYlxL';

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'school' },
  auth: {
    lock: async (_name, _acquireTimeout, fn) => {
      return await fn();
    },
  },
});

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'school' },
    auth: {
      lock: async (_name, _acquireTimeout, fn) => {
        return await fn();
      },
    },
  });
}
