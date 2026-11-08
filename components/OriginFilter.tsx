import Link from "next/link";
import { t } from "@/lib/i18n/hu";
import { TEACHER_TAG, type Origin } from "@/lib/tasks";

/**
 * "Forrás: Mind · Saját tanári anyag · Általános feladatbank" – keeps the content made from the student's
 * own teacher slides apart from the general bank. Renders nothing when the part has no teacher material.
 */
export function OriginFilter({ items, origin, href }: { items: { tags: string[] }[]; origin: Origin | undefined; href: (o: Origin | undefined) => string }) {
  const teacher = items.filter((x) => x.tags.includes(TEACHER_TAG)).length;
  if (teacher === 0) return null;
  const opts: { o: Origin | undefined; label: string; n: number }[] = [
    { o: undefined, label: t.common.origin.all, n: items.length },
    { o: "tanari", label: t.common.origin.tanari, n: teacher },
    { o: "altalanos", label: t.common.origin.altalanos, n: items.length - teacher },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm" data-testid="origin-filter">
      <span className="text-muted">{t.common.origin.label}</span>
      {opts.map((x) => (
        <Link
          key={x.o ?? "all"}
          href={href(x.o)}
          data-testid={`origin-${x.o ?? "all"}`}
          aria-current={origin === x.o ? "page" : undefined}
          className={`rounded-full border px-3 py-1 ${origin === x.o ? "border-accent bg-accent-soft font-medium" : "border-border bg-surface hover:bg-surface-2"}`}
        >
          {x.label} <span className="text-muted">({x.n})</span>
        </Link>
      ))}
    </div>
  );
}
