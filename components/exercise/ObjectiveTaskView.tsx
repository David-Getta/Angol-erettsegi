"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { Block, GlossaryEntry, Item, ObjectiveTask, Option } from "@/lib/content/schema";
import type { ItemResult } from "@/lib/scoring/check";
import { findLoose, segmentText, GAP_RE } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { ItemFeedback } from "./ItemFeedback";
import { btn } from "@/components/ui";
import { useContentLang } from "@/components/ContentLang";

export type ViewProps = {
  task: ObjectiveTask;
  answers: Record<string, string>;
  onAnswer: (itemId: string, value: string) => void;
  /** Per-item results that should be shown (practice: checked items; after finishing: all). */
  results: Record<string, ItemResult | undefined>;
  locked: Record<string, boolean>;
  activeItem: string | null;
  onActivate: (itemId: string) => void;
  /** Practice: per-item check button for text answers. */
  onCheckItem?: (itemId: string) => void;
  /** Evidence of these items is highlighted in the passage. */
  highlight: string[];
  onWordClick?: (word: string, sentence: string) => void;
  categoryNames: Record<string, string>;
  hidePassage?: boolean;
};

const TF_KEYS = ["T", "F", "NG"] as const;

export function tfKeysFor(task: ObjectiveTask): string[] {
  const usesNg = [task.example, ...task.items].some((i) => i.kind === "tf" && i.answer === "NG") || /not given|doesn.t say/i.test(task.instructions);
  return usesNg ? [...TF_KEYS] : ["T", "F"];
}

/** Keys an item can take, in display order (used by the 1–9 shortcuts). */
export function itemKeys(task: ObjectiveTask, item: Item): string[] {
  if (item.kind === "choice") return item.options.map((o) => o.key);
  if (item.kind === "match") return (task.options ?? []).map((o) => o.key);
  if (item.kind === "tf") return tfKeysFor(task);
  return [];
}

export function ObjectiveTaskView(p: ViewProps) {
  const contentLang = useContentLang();
  const { task } = p;
  const allItems = useMemo(() => [task.example, ...task.items], [task]);
  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const inlineGaps = useMemo(() => {
    const s = new Set<string>();
    for (const b of task.passage?.blocks ?? []) {
      if (b.gap) s.add(b.gap);
      for (const m of b.text.matchAll(GAP_RE)) s.add(m[1]!);
    }
    return s;
  }, [task]);
  const usedMatch = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of allItems) {
      if (it.kind !== "match") continue;
      const v = it.id === "0" ? it.answer : p.answers[it.id];
      if (v) m.set(v, it.id);
    }
    return m;
  }, [allItems, p.answers]);

  const evidence = p.highlight
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i && !!i.evidence)
    .map((i) => ({ id: i.id, text: i.evidence! }));

  const passage = task.passage && !p.hidePassage && (
    <article lang={contentLang} className="reading-text" data-testid="passage">
      {task.passage.title && <h2 className="mb-1 font-sans text-xl font-semibold">{task.passage.title}</h2>}
      {task.passage.subtitle && <p className="mb-3 font-sans text-sm text-muted">{task.passage.subtitle}</p>}
      {task.passage.blocks.map((b, i) => (
        <PassageBlock key={i} block={b} view={p} byId={byId} evidence={evidence} />
      ))}
      {task.passage.sourceNote && <p className="mt-4 font-sans text-xs text-muted">{task.passage.sourceNote}</p>}
    </article>
  );

  const bank = task.options && task.options.length > 0 && (
    <OptionBank options={task.options} used={usedMatch} reusable={task.optionsReusable} />
  );

  const itemList = (
    <ol className="space-y-3" data-testid="items">
      {allItems.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          view={p}
          inline={inlineGaps.has(it.id)}
          usedMatch={usedMatch}
        />
      ))}
    </ol>
  );

  if (!passage) {
    return (
      <div className="space-y-4">
        {bank}
        {itemList}
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">{passage}</div>
      <div className="space-y-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        {bank}
        {itemList}
      </div>
    </div>
  );
}

function OptionBank({ options, used, reusable }: { options: Option[]; used: Map<string, string>; reusable: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-sm" data-testid="option-bank">
      <ul className="space-y-1">
        {options.map((o) => {
          const u = used.get(o.key);
          return (
            <li key={o.key} className={`flex gap-2 ${u && !reusable ? "text-muted" : ""}`}>
              <b className="w-6 shrink-0">{o.key}</b>
              <span className={u && !reusable ? "line-through decoration-muted/60" : ""}>{o.text}</span>
              {u && !reusable && <span className="ml-auto shrink-0 text-xs">→ {u === "0" ? t.task.example : u}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PassageBlock({
  block,
  view,
  byId,
  evidence,
}: {
  block: Block;
  view: ViewProps;
  byId: Map<string, Item>;
  evidence: { id: string; text: string }[];
}) {
  const parts = block.text.split(/(\[\[\d{1,3}\]\])/g);
  return (
    <div className="mt-3 first:mt-0">
      {block.gap && <HeadingGap id={block.gap} view={view} item={byId.get(block.gap)} />}
      {block.heading && <h3 className="mb-1 font-sans font-semibold">{block.heading}</h3>}
      <p>
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(\d{1,3})\]\]$/);
          if (m) {
            const item = byId.get(m[1]!);
            return item ? <InlineGap key={i} item={item} view={view} /> : <Fragment key={i}>{part}</Fragment>;
          }
          return <HighlightedText key={i} text={part} evidence={evidence} onWordClick={view.onWordClick} />;
        })}
      </p>
    </div>
  );
}

function HighlightedText({
  text,
  evidence,
  onWordClick,
}: {
  text: string;
  evidence: { id: string; text: string }[];
  onWordClick?: (word: string, sentence: string) => void;
}) {
  const ranges = evidence.map((e) => findLoose(text, e.text));
  const segs = segmentText(text, ranges);
  return (
    <>
      {segs.map((s, i) =>
        s.mark !== undefined ? (
          <mark key={i} data-evidence={evidence[s.mark]!.id}>
            <Words text={s.text} context={text} onWordClick={onWordClick} />
            <sup className="ml-0.5 font-sans text-[10px] font-bold text-accent">{evidence[s.mark]!.id}</sup>
          </mark>
        ) : (
          <Words key={i} text={s.text} context={text} onWordClick={onWordClick} />
        ),
      )}
    </>
  );
}

function sentenceAround(text: string, word: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return (sentences.find((s) => s.includes(word)) ?? text).trim();
}

export function Words({ text, context, onWordClick }: { text: string; context: string; onWordClick?: (word: string, sentence: string) => void }) {
  if (!onWordClick) return <>{text}</>;
  const tokens = text.split(/([\p{L}][\p{L}'’-]*)/u);
  return (
    <>
      {tokens.map((tok, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            role="button"
            tabIndex={-1}
            className="cursor-pointer rounded-sm hover:bg-accent-soft"
            onClick={() => onWordClick(tok.replace(/['’]s$/, ""), sentenceAround(context, tok))}
          >
            {tok}
          </span>
        ) : (
          <Fragment key={i}>{tok}</Fragment>
        ),
      )}
    </>
  );
}

function statusCls(r: ItemResult | undefined): string {
  if (!r) return "border-accent/50 bg-accent-soft/40";
  return r.correct ? "border-good/50 bg-good-soft" : "border-bad/50 bg-bad-soft";
}

function InlineGap({ item, view }: { item: Item; view: ViewProps }) {
  const isExample = item.id === "0";
  const r = view.results[item.id];
  const value = isExample ? exampleAnswer(item) : view.answers[item.id] ?? "";
  const active = view.activeItem === item.id;
  if (item.kind === "text" && !isExample) {
    const width = Math.max(6, Math.min(22, Math.max(...item.answer.map((a) => a.length)) + 3));
    return (
      <span className="mx-0.5 inline-flex items-baseline gap-0.5 font-sans">
        <sup className="text-[10px] font-bold text-muted">{item.id}</sup>
        <input
          data-testid={`gap-${item.id}`}
          aria-label={`${item.id}.`}
          value={value}
          disabled={view.locked[item.id]}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onFocus={() => view.onActivate(item.id)}
          onChange={(e) => view.onAnswer(item.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              view.onCheckItem?.(item.id);
            }
          }}
          style={{ width: `${width}ch` }}
          className={`rounded border px-1 py-0 text-base ${statusCls(r)} ${active ? "ring-2 ring-accent/40" : ""}`}
        />
        {item.cue && <span className="text-sm text-muted">({item.cue})</span>}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => view.onActivate(item.id)}
      className={`mx-0.5 inline-flex min-w-12 items-baseline justify-center gap-1 rounded border px-1.5 font-sans text-base ${
        isExample ? "border-border bg-surface-2" : statusCls(r)
      } ${active ? "ring-2 ring-accent/40" : ""}`}
      data-testid={`gapbtn-${item.id}`}
    >
      <sup className="text-[10px] font-bold text-muted">{item.id}</sup>
      <span className={value ? "font-semibold" : "text-muted"}>{value || "____"}</span>
    </button>
  );
}

function HeadingGap({ id, view, item }: { id: string; view: ViewProps; item?: Item }) {
  if (!item) return null;
  const isExample = id === "0";
  const r = view.results[id];
  const value = isExample ? exampleAnswer(item) : view.answers[id] ?? "";
  return (
    <button
      type="button"
      onClick={() => view.onActivate(id)}
      className={`mb-1 inline-flex items-center gap-2 rounded border px-2 py-0.5 font-sans text-sm ${isExample ? "border-border bg-surface-2" : statusCls(r)} ${
        view.activeItem === id ? "ring-2 ring-accent/40" : ""
      }`}
    >
      <b>{id}</b>
      <span className={value ? "font-semibold" : "text-muted"}>{value || "______"}</span>
    </button>
  );
}

function exampleAnswer(item: Item): string {
  return item.kind === "text" ? item.answer[0]! : item.answer;
}

function ItemRow({ item, view, inline, usedMatch }: { item: Item; view: ViewProps; inline: boolean; usedMatch: Map<string, string> }) {
  const { task } = view;
  const isExample = item.id === "0";
  const r = view.results[item.id];
  const locked = isExample || !!view.locked[item.id];
  const value = isExample ? exampleAnswer(item) : view.answers[item.id] ?? "";
  const active = view.activeItem === item.id;

  let control: ReactNode = null;
  if (item.kind === "choice") {
    control = (
      <div className="mt-1.5 grid gap-1">
        {item.options.map((o, idx) => (
          <OptionButton
            key={o.key}
            label={o.key}
            text={o.text}
            hotkey={idx + 1}
            selected={value === o.key}
            disabled={locked}
            state={r ? (o.key === r.expected ? "good" : value === o.key ? "bad" : undefined) : undefined}
            onClick={() => view.onAnswer(item.id, o.key)}
            testId={`opt-${item.id}-${o.key}`}
          />
        ))}
      </div>
    );
  } else if (item.kind === "match") {
    control = (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {(task.options ?? []).map((o, idx) => {
          const usedBy = usedMatch.get(o.key);
          const taken = !task.optionsReusable && usedBy !== undefined && usedBy !== item.id;
          return (
            <button
              key={o.key}
              type="button"
              disabled={locked}
              title={taken ? `${o.text} (${t.task.optionUsed})` : o.text}
              onClick={() => view.onAnswer(item.id, value === o.key ? "" : o.key)}
              data-testid={`opt-${item.id}-${o.key}`}
              className={`min-w-9 rounded-md border px-2 py-1 text-sm font-semibold ${
                r && o.key === r.expected
                  ? "border-good bg-good-soft text-good"
                  : r && value === o.key
                    ? "border-bad bg-bad-soft text-bad"
                    : value === o.key
                      ? "border-accent bg-accent text-accent-fg"
                      : taken
                        ? "border-border bg-surface-2 text-muted line-through"
                        : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              {o.key}
              <span className="sr-only"> {idx + 1}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (item.kind === "tf") {
    control = (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {tfKeysFor(task).map((k, idx) => (
          <OptionButton
            key={k}
            label={t.task.tfShort[k]!}
            text={t.task.trueFalse[k]!}
            hotkey={idx + 1}
            compact
            selected={value === k}
            disabled={locked}
            state={r ? (k === r.expected ? "good" : value === k ? "bad" : undefined) : undefined}
            onClick={() => view.onAnswer(item.id, k)}
            testId={`opt-${item.id}-${k}`}
          />
        ))}
      </div>
    );
  } else if (!inline && !isExample) {
    control = (
      <div className="mt-1.5 flex items-center gap-2">
        <input
          data-testid={`input-${item.id}`}
          value={value}
          disabled={locked}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onFocus={() => view.onActivate(item.id)}
          onChange={(e) => view.onAnswer(item.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              view.onCheckItem?.(item.id);
            }
          }}
          className={`w-full rounded-md border px-2 py-1.5 ${statusCls(r)}`}
          placeholder={task.type === "error-correction" ? t.task.errorLineHint : item.maxWords ? `max. ${item.maxWords} ${t.common.words}` : ""}
        />
        {task.type === "error-correction" && !locked && (
          <button
            type="button"
            title={t.task.lineCorrect}
            data-testid={`tick-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              view.onAnswer(item.id, "✓");
            }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 font-semibold hover:bg-surface-2"
          >
            ✓
          </button>
        )}
      </div>
    );
  }

  const showCheck = !!view.onCheckItem && !isExample && !locked && item.kind === "text";

  return (
    <li
      id={`item-${item.id}`}
      onClick={() => !isExample && view.onActivate(item.id)}
      className={`rounded-lg border p-3 ${isExample ? "border-dashed border-border bg-surface-2/60" : "border-border bg-surface"} ${
        active ? "ring-2 ring-accent/40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${isExample ? "bg-border" : "bg-accent-soft"}`}>
          {item.id}
        </span>
        <div className="min-w-0 flex-1">
          {isExample && <div className="text-xs font-medium uppercase tracking-wide text-muted">{t.task.example}</div>}
          {item.prompt && (
            <div className="whitespace-pre-line">
              {item.prompt}
              {item.kind === "text" && item.cue && <span className="ml-1 font-semibold">({item.cue})</span>}
            </div>
          )}
          {!item.prompt && inline && item.kind === "text" && !isExample && (
            <div className="text-sm text-muted">
              {value ? <span className="font-medium text-fg">{value}</span> : "…"}
              {item.cue && <span className="ml-1">({item.cue})</span>}
            </div>
          )}
          {control}
          {isExample && item.kind !== "choice" && item.kind !== "tf" && (
            <div className="mt-1 text-sm">
              → <b>{exampleAnswer(item)}</b>
            </div>
          )}
          {showCheck && (
            <button
              type="button"
              className="mt-2 rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface-2"
              onClick={(e) => {
                e.stopPropagation();
                view.onCheckItem?.(item.id);
              }}
              data-testid={`check-${item.id}`}
            >
              {t.task.checkItem} (Enter)
            </button>
          )}
          {r && !isExample && <ItemFeedback item={item} result={r} categoryName={view.categoryNames[item.category]} />}
        </div>
      </div>
    </li>
  );
}

function OptionButton({
  label,
  text,
  hotkey,
  selected,
  disabled,
  state,
  onClick,
  compact,
  testId,
}: {
  label: string;
  text: string;
  hotkey: number;
  selected: boolean;
  disabled: boolean;
  state?: "good" | "bad";
  onClick: () => void;
  compact?: boolean;
  testId?: string;
}) {
  const cls =
    state === "good"
      ? "border-good bg-good-soft"
      : state === "bad"
        ? "border-bad bg-bad-soft"
        : selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface hover:bg-surface-2";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      data-testid={testId}
      aria-pressed={selected}
      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm disabled:cursor-default ${cls} ${compact ? "min-w-24" : ""}`}
    >
      <b className="shrink-0">{label}</b>
      <span className={compact ? "text-muted" : ""}>{text}</span>
      <kbd className="ml-auto hidden shrink-0 sm:inline">{hotkey}</kbd>
    </button>
  );
}

export function GlossaryList({ glossary, onAdd }: { glossary: GlossaryEntry[]; onAdd?: (g: GlossaryEntry) => void | Promise<void> }) {
  const contentLang = useContentLang();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  if (!glossary.length) return null;
  const add = async (g: GlossaryEntry) => {
    if (!onAdd || added.has(g.term)) return;
    await onAdd(g);
    setAdded((s) => new Set(s).add(g.term));
  };
  const rest = glossary.filter((g) => !added.has(g.term));
  return (
    <details className="rounded-xl border border-border bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {t.task.glossary} ({glossary.length})
      </summary>
      {onAdd && rest.length > 1 && (
        <button
          type="button"
          className={`${btn.small} mt-2`}
          disabled={busy}
          data-testid="glossary-add-all"
          onClick={async () => {
            setBusy(true);
            for (const g of rest) await add(g);
            setBusy(false);
          }}
        >
          + {t.task.addAllCards(rest.length)}
        </button>
      )}
      <ul className="mt-2 divide-y divide-border">
        {glossary.map((g) => (
          <li key={g.term} className="flex items-center gap-2 py-1">
            <b lang={contentLang}>{g.term}</b>
            <span className="text-muted">– {g.meaning}</span>
            {onAdd &&
              (added.has(g.term) ? (
                <span className="ml-auto text-xs text-good">✓</span>
              ) : (
                <button type="button" className="ml-auto text-xs text-accent hover:underline" disabled={busy} onClick={() => void add(g)}>
                  + {t.task.addCard}
                </button>
              ))}
          </li>
        ))}
      </ul>
    </details>
  );
}
