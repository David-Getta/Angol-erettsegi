"use client";

import { useState } from "react";

/** A tick list for the end of a task (state only on the page). */
export function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <ul className="space-y-1.5 text-sm" data-testid="guide-checklist">
      {items.map((it, i) => (
        <li key={i}>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={done.has(i)}
              onChange={() =>
                setDone((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
            />
            <span className={done.has(i) ? "text-muted line-through" : ""}>{it}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
