import 'server-only';
import { NextResponse } from 'next/server';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Best-effort per-instance rate limit. Enough to slow down scripted guessing.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimited(key: string, max = 40, windowMs = 10_000): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  h.n++;
  return h.n > max;
}

export function clientKey(req: Request, userId?: string | null) {
  return userId ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
}
