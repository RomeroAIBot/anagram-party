import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Finishes the email sign-in link.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  // Relative redirect: behind nginx on the Linode, req.url says localhost:3010,
  // so an absolute URL built from it would send players to localhost.
  return new NextResponse(null, { status: 303, headers: { Location: safeNext, 'Cache-Control': 'no-store' } });
}
