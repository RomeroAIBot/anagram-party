'use client';
import { useEffect, useState } from 'react';
import { msUntilReset } from '@/lib/time';

export function Countdown() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setMs(msUntilReset());
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);
  if (ms === null) return <>New puzzle every day at 1:00 AM Eastern</>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return (
    <>
      Next puzzle in {h} hr {m} min
    </>
  );
}
