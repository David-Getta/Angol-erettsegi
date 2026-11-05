"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Countdown (limitSec set) or stopwatch (limitSec null) that can be paused.
 * Calls onExpire once. `startedAt` (ms) resumes a timer that started earlier,
 * e.g. a mock exam part after a page reload.
 */
export function useTimer(opts: { limitSec: number | null; running: boolean; onExpire?: () => void; startedAt?: number | null }) {
  const { limitSec, running, onExpire, startedAt } = opts;
  const accRef = useRef(0);
  const startRef = useRef<number | null>(running ? startedAt ?? Date.now() : null);
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);
  const cb = useRef(onExpire);
  useEffect(() => {
    cb.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (running) {
      if (startRef.current === null) startRef.current = Date.now();
      const id = setInterval(() => setNow(Date.now()), 250);
      return () => clearInterval(id);
    }
    if (startRef.current !== null) {
      accRef.current += Date.now() - startRef.current;
      startRef.current = null;
    }
  }, [running]);

  const live = startRef.current !== null ? Math.max(0, now - startRef.current) : 0;
  const elapsedSec = Math.floor((accRef.current + live) / 1000);
  const remainingSec = limitSec === null ? null : Math.max(0, limitSec - elapsedSec);

  useEffect(() => {
    if (remainingSec === 0 && !expired.current && running) {
      expired.current = true;
      cb.current?.();
    }
  }, [remainingSec, running]);

  return { elapsedSec, remainingSec };
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function TimerDisplay({ sec, label, warnBelow = 300 }: { sec: number; label: string; warnBelow?: number }) {
  const warn = sec <= warnBelow;
  return (
    <div
      className={`rounded-md border px-3 py-1 font-mono text-sm tabular-nums ${warn ? "border-bad/40 bg-bad-soft text-bad" : "border-border bg-surface"}`}
      role="timer"
      aria-live="off"
      data-testid="timer"
    >
      <span className="mr-1 font-sans text-xs text-muted">{label}</span>
      {fmtClock(sec)}
    </div>
  );
}
