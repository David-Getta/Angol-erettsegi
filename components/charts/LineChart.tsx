"use client";

import { useMemo, useState } from "react";

export type LineSeries = { id: string; name: string; points: { x: string; y: number }[] };

const W = 720;
const H = 260;
const M = { l: 36, r: 110, t: 12, b: 28 };

/**
 * Multi-series line chart over dates, one y axis (0–max). Fixed categorical
 * colour order, legend + direct end labels, crosshair tooltip on hover.
 */
export function LineChart({ series, yMax = 100, unit = "%", height = H }: { series: LineSeries[]; yMax?: number; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const iw = W - M.l - M.r;
  const ih = height - M.t - M.b;
  const xPos = (x: string) => M.l + (xs.length <= 1 ? iw / 2 : (xs.indexOf(x) / (xs.length - 1)) * iw);
  const yPos = (y: number) => M.t + ih - (Math.min(y, yMax) / yMax) * ih;
  const color = (i: number) => `var(--series-${(i % 5) + 1})`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));
  const fmtX = (x: string) => x.slice(5).replace("-", ".");
  const hoverX = hover !== null ? xs[hover] : null;

  if (!xs.length) return null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted" aria-hidden>
        {series.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: color(i) }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="w-full"
          role="img"
          aria-label={series.map((s) => `${s.name}: ${s.points.map((p) => `${p.x} ${p.y}${unit}`).join(", ")}`).join("; ")}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let bd = Infinity;
            xs.forEach((x, i) => {
              const d = Math.abs(xPos(x) - px);
              if (d < bd) {
                bd = d;
                best = i;
              }
            });
            setHover(best);
          }}
        >
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={M.l} x2={M.l + iw} y1={yPos(tk)} y2={yPos(tk)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={M.l - 6} y={yPos(tk) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                {tk}
              </text>
            </g>
          ))}
          {xs.length > 1 &&
            [0, Math.floor((xs.length - 1) / 2), xs.length - 1].map((i) => (
              <text key={i} x={xPos(xs[i]!)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {fmtX(xs[i]!)}
              </text>
            ))}
          {hoverX && <line x1={xPos(hoverX)} x2={xPos(hoverX)} y1={M.t} y2={M.t + ih} stroke="var(--muted)" strokeDasharray="3 3" />}
          {series.map((s, i) => {
            const d = s.points.map((p, j) => `${j ? "L" : "M"}${xPos(p.x).toFixed(1)},${yPos(p.y).toFixed(1)}`).join(" ");
            const last = s.points[s.points.length - 1]!;
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={color(i)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.points.map((p) => (
                  <circle key={p.x} cx={xPos(p.x)} cy={yPos(p.y)} r={hoverX === p.x ? 4.5 : 3} fill={color(i)} stroke="var(--surface)" strokeWidth={2} />
                ))}
                <text x={xPos(last.x) + 8} y={yPos(last.y) + 4} fontSize={11} fill="var(--fg)">
                  {s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name}
                </text>
              </g>
            );
          })}
        </svg>
        {hoverX && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow"
            style={{ left: `${Math.min(70, (xPos(hoverX) / W) * 100)}%` }}
          >
            <div className="font-medium">{hoverX}</div>
            {series.map((s, i) => {
              const p = s.points.find((q) => q.x === hoverX);
              return p ? (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: color(i) }} />
                  {s.name}: <b>{p.y}{unit}</b>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
