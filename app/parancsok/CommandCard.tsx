"use client";

import { useState } from "react";
import type { CommandDef } from "@/lib/commands/config";
import { buildCommand } from "@/lib/commands/build";
import { t } from "@/lib/i18n/hu";
import { CopyButton } from "@/components/CopyButton";
import { Card } from "@/components/ui";

type Opt = { value: string; label: string };
export type BuilderValues = { subjects: Opt[]; defaultSubject: string; sections: Opt[]; levels: Opt[]; topics: Opt[]; categories: Opt[]; officialFolders: Opt[] };

export function CommandCard({ def, values, defaultLevel }: { def: CommandDef; values: BuilderValues; defaultLevel: string }) {
  const initial = def.params.map((p) => {
    if (p.valuesFrom === "levels" && p.required) return defaultLevel;
    if (p.valuesFrom === "subjects") return values.defaultSubject;
    if (p.valuesFrom === "sections" && p.required) return values.sections[0]?.value ?? "";
    if (p.valuesFrom === "count" && p.required) return "5";
    if (p.valuesFrom === "officialFolders" && p.required) return values.officialFolders[0]?.value ?? "";
    return "";
  });
  const [vals, setVals] = useState<string[]>(initial);
  const cmd = buildCommand(def.name, vals);

  return (
    <Card title={<span className="font-mono">/{def.name}</span>} actions={<span className="text-sm text-muted">{def.title}</span>}>
      <div data-testid={`command-${def.name}`}>
        <p className="text-sm">{def.summary}</p>
        <div className="mt-2 font-mono text-sm text-muted">{def.usage}</div>

        <h3 className="mt-4 text-sm font-semibold">{t.commands.params}</h3>
        {def.params.length === 0 ? (
          <p className="text-sm text-muted">{t.common.none}</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {def.params.map((p) => (
              <li key={p.name}>
                <code className="rounded bg-surface-2 px-1">{p.required ? `<${p.name}>` : `[${p.name}]`}</code>{" "}
                <span className="text-xs text-muted">({p.required ? t.commands.required : t.commands.optional})</span> – {p.description}
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-4 text-sm font-semibold">{t.commands.examples}</h3>
        <ul className="mt-1 space-y-1.5">
          {def.examples.map((ex) => (
            <li key={ex.command} className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-surface-2 px-2 py-0.5 font-mono">{ex.command}</code>
              <CopyButton text={ex.command} testId={`copy-example-${def.name}`} />
              <span className="text-muted">{ex.description}</span>
            </li>
          ))}
        </ul>

        {def.params.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-surface-2/50 p-3">
            <h3 className="text-sm font-semibold">{t.commands.builder}</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {def.params.map((p, i) => {
                const opts =
                  p.valuesFrom === "subjects"
                    ? values.subjects
                    : p.valuesFrom === "sections"
                    ? values.sections
                    : p.valuesFrom === "levels"
                      ? values.levels
                      : p.valuesFrom === "topics"
                        ? values.topics
                        : p.valuesFrom === "categories"
                          ? values.categories
                          : p.valuesFrom === "officialFolders"
                            ? values.officialFolders
                            : null;
                return (
                  <label key={p.name} className="flex flex-col text-xs text-muted">
                    {p.name}
                    {p.valuesFrom === "count" ? (
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={vals[i]}
                        placeholder={p.required ? "" : t.commands.optional}
                        onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                        className="mt-0.5 w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
                      />
                    ) : opts && (opts.length > 0 || !p.required) ? (
                      <select
                        value={vals[i]}
                        onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                        className="mt-0.5 max-w-64 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
                        data-testid={`builder-${def.name}-${i}`}
                      >
                        {!p.required && <option value="">{t.commands.any}</option>}
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={vals[i]}
                        placeholder={p.name}
                        onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                        className="mt-0.5 w-56 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">{t.commands.result}:</span>
              <code className="rounded bg-surface px-2 py-1 font-mono text-sm" data-testid={`built-${def.name}`}>
                {cmd}
              </code>
              <CopyButton text={cmd} variant="primary" testId={`copy-built-${def.name}`} />
            </div>
          </div>
        )}

        <div className="mt-4 text-sm">
          <span className="font-semibold">{t.commands.after}: </span>
          {def.after}
        </div>
      </div>
    </Card>
  );
}
