/** Horizontal accuracy bars (one hue); value labels in text ink, sorted weakest first by the caller. */
export function HBars({ rows, empty }: { rows: { key: string; label: string; pct: number; correct: number; total: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 text-sm" title={`${r.label}: ${Math.round(r.pct)}% (${r.correct}/${r.total})`}>
          <span className="truncate">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-[var(--series-1)]" style={{ width: `${Math.max(2, r.pct)}%` }} />
          </span>
          <span className="w-24 text-right tabular-nums text-muted">
            <b className="text-fg">{Math.round(r.pct)}%</b> ({r.correct}/{r.total})
          </span>
        </li>
      ))}
    </ul>
  );
}
