"use client";

import { useState } from "react";

/** Single-series vertical bar chart (e.g. minutes per day) with hover tooltips. */
export function BarChart({ points, unit, height = 160, fmtX }: { points: { x: string; y: number }[]; unit: string; height?: number; fmtX?: (x: string) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const M = { l: 32, r: 8, t: 10, b: 22 };
  const iw = W - M.l - M.r;
  const ih = height - M.t - M.b;
  const max = Math.max(10, ...points.map((p) => p.y));
  const step = iw / Math.max(1, points.length);
  const bw = Math.max(2, step - 2);
  const label = fmtX ?? ((x: string) => x.slice(5).replace("-", "."));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={points.map((p) => `${p.x}: ${p.y} ${unit}`).join(", ")} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={M.l} x2={W - M.r} y1={M.t + ih - f * ih} y2={M.t + ih - f * ih} stroke="var(--chart-grid)" />
            <text x={M.l - 5} y={M.t + ih - f * ih + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {Math.round(f * max)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const h = (p.y / max) * ih;
          const x = M.l + i * step + 1;
          return (
            <g key={p.x} onMouseEnter={() => setHover(i)}>
              <rect x={M.l + i * step} y={M.t} width={step} height={ih} fill="transparent" />
              {h > 0 && <rect x={x} y={M.t + ih - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill="var(--series-1)" opacity={hover === null || hover === i ? 1 : 0.55} />}
            </g>
          );
        })}
        {points.length > 1 &&
          [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
            <text key={i} x={M.l + i * step + step / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {label(points[i]!.x)}
            </text>
          ))}
      </svg>
      {hover !== null && points[hover] && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow" style={{ left: `${Math.min(80, ((M.l + hover * step) / W) * 100)}%` }}>
          {points[hover]!.x}: <b>{points[hover]!.y} {unit}</b>
        </div>
      )}
    </div>
  );
}
