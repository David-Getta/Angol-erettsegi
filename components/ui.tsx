import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n/hu";

/** Small presentational primitives (server-safe). */

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "neutral" | "accent" | "good" | "bad" | "warn";
const toneCls: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg/80 border-border",
  accent: "bg-accent-soft text-fg border-accent/30",
  good: "bg-good-soft text-good border-good/30",
  bad: "bg-bad-soft text-bad border-bad/30",
  warn: "bg-warn-soft text-warn border-warn/30",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${toneCls[tone]}`}>
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <Badge tone={source === "official" ? "accent" : "neutral"} title={t.common.sourceHint[source]}>
      {source === "official" ? "🏛 " : "✦ "}
      {t.common.source[source] ?? source}
    </Badge>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-fg",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-bad/40 bg-bad-soft px-4 py-2 text-sm font-medium text-bad hover:opacity-90",
  small:
    "inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-50",
};

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: keyof typeof btn }) {
  return (
    <Link href={href} className={btn[variant]}>
      {children}
    </Link>
  );
}

export function ProgressBar({ value, max, tone = "accent", marker }: { value: number; max: number; tone?: "accent" | "good" | "bad" | "warn"; marker?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { accent: "bg-accent", good: "bg-good", bad: "bg-bad", warn: "bg-warn" }[tone];
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      {marker !== undefined && max > 0 && (
        <div className="absolute inset-y-0 w-0.5 bg-fg/60" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} title={`${marker}`} />
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} ó ${m} p` : `${m} perc`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "–" : `${Math.round(n)}%`;
}
