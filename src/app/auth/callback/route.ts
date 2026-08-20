import { NextResponse } from 'next/server';
import { createClient } from 'src/services/supabase/client';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = createClient();
    try {
      const { data } = await supabase.auth.exchangeCodeForSession(code);
      if (data.session?.user?.email) {
        // Save active user email for session consistency
        const email = data.session.user.email;
        const res = NextResponse.redirect(`${origin}/`);
        res.cookies.set('school_active_user_email', email, { path: '/' });
        return res;
      }
    } catch {
      // Fallback redirect
    }
  }

  // URL hash fallback or clean redirect
  return NextResponse.redirect(`${origin}/`);
}
