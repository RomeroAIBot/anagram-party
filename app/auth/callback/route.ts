import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The public address the player actually used. Behind nginx on the Linode, req.url
// says localhost:3010, so read the forwarded host instead.
function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim();
  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) {
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

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
  return NextResponse.redirect(new URL(safeNext, publicOrigin(req)));
}
