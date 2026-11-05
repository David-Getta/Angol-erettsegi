"use client";

import { useState } from "react";
import type { Correction } from "@/lib/exchange/schema";
import { locateAll, segmentText } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";

/** The student's text with every correction highlighted; click/hover shows the fix and the reason. */
export function AnnotatedText({ text, corrections, categoryNames }: { text: string; corrections: Correction[]; categoryNames: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const ranges = locateAll(text, corrections.map((c) => c.original));
  const segs = segmentText(text, ranges);
  const c = open !== null ? corrections[open] : null;
  return (
    <div>
      <div className="reading-text whitespace-pre-wrap" data-testid="annotated-text">
        {segs.map((s, i) =>
          s.mark === undefined ? (
            <span key={i}>{s.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(open === s.mark ? null : s.mark!)}
              onMouseEnter={() => setOpen(s.mark!)}
              className={`rounded-sm border-b-2 border-bad bg-bad-soft px-0.5 text-left ${open === s.mark ? "ring-2 ring-bad/40" : ""}`}
              title={`${corrections[s.mark]!.corrected} – ${corrections[s.mark]!.explanation}`}
            >
              <span className="line-through decoration-bad/60">{s.text}</span>
              <span className="ml-1 font-sans text-sm font-semibold text-good">{corrections[s.mark]!.corrected}</span>
            </button>
          ),
        )}
      </div>
      {c && (
        <div className="sticky bottom-2 mt-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
          <div>
            <span className="text-muted">{t.grading.original}:</span> <s>{c.original}</s> → <span className="text-muted">{t.grading.corrected}:</span>{" "}
            <b className="text-good">{c.corrected}</b> <span className="text-xs text-muted">· {categoryNames[c.category] ?? c.category}</span>
          </div>
          <div className="mt-1">{c.explanation}</div>
        </div>
      )}
    </div>
  );
}
