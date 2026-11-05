"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import { Badge, Card } from "../ui";

export type VersionInfo = { id: string; version: number; text: string; score: number | null; maxScore: number | null; wordCount: number; criteria: Record<string, number> };

/** Two versions of a rewrite chain side by side, with the per-criterion scores. */
export function VersionCompare({ versions, criteria }: { versions: VersionInfo[]; criteria: { id: string; name: string; max: number }[] }) {
  const [a, setA] = useState(versions.length - 2);
  const [b, setB] = useState(versions.length - 1);
  if (versions.length < 2) return null;
  const va = versions[a]!;
  const vb = versions[b]!;
  const sel = (value: number, set: (n: number) => void) => (
    <select value={value} onChange={(e) => set(Number(e.target.value))} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
      {versions.map((v, i) => (
        <option key={v.id} value={i}>
          {t.writing.version(v.version)}
        </option>
      ))}
    </select>
  );
  return (
    <Card title={t.writing.compare}>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1">{t.grading.criteria}</th>
              <th className="pb-1 text-right">{sel(a, setA)}</th>
              <th className="pb-1 text-right">{sel(b, setB)}</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const x = va.criteria[c.id];
              const y = vb.criteria[c.id];
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right tabular-nums">{x ?? "–"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {y ?? "–"}{" "}
                    {x !== undefined && y !== undefined && y !== x && <Badge tone={y > x ? "good" : "bad"}>{y > x ? `+${y - x}` : y - x}</Badge>}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border font-semibold">
              <td className="py-1">{t.grading.total}</td>
              <td className="py-1 text-right tabular-nums">{va.score !== null ? `${va.score} / ${va.maxScore}` : t.writing.pending}</td>
              <td className="py-1 text-right tabular-nums">{vb.score !== null ? `${vb.score} / ${vb.maxScore}` : t.writing.pending}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[va, vb].map((v, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-2/40 p-3">
            <div className="mb-1 text-xs text-muted">
              {t.writing.version(v.version)} · {t.writing.wordCount(v.wordCount)}
            </div>
            <div className="whitespace-pre-wrap font-reading text-[15px] leading-relaxed">{v.text}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
