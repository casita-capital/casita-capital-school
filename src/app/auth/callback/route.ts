import { NextResponse } from 'next/server';
import { createClient } from 'src/services/supabase/client';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const origin = requestUrl.origin;

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
  }

  if (code) {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
      }
      if (data.session?.user?.email) {
        const email = data.session.user.email;
        const res = NextResponse.redirect(`${origin}/`);
        res.cookies.set('school_active_user_email', email, { path: '/' });
        return res;
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Authentication failed';
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errText)}`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
