import Link from "next/link";
import { guideFor, listGuides, type GuideKind } from "@/lib/guides";
import { btn } from "@/components/ui";

/** A link to the guide of a text type / speaking task type / exam part – only if that guide exists. */
export function GuideLink({ type, target, label }: { type: GuideKind; target: string; label: string }) {
  const id = guideFor(type, target);
  if (!id) return null;
  return (
    <Link href={`/utmutatok/${id}`} className={btn.secondary} data-testid="guide-link">
      {label}
    </Link>
  );
}

/** All guides of one kind as small links (e.g. every writing text type on the writing page). */
export function GuideLinks({ type, title, names }: { type: GuideKind; title: string; names: Record<string, string> }) {
  const list = listGuides().filter((g) => g.type === type);
  if (!list.length) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm" data-testid={`guide-links-${type}`}>
      <span className="text-muted">{title}</span>
      {list
        .sort((a, b) => (names[a.target] ?? a.target).localeCompare(names[b.target] ?? b.target, "hu"))
        .map((g) => (
          <Link key={g.id} href={`/utmutatok/${g.id}`} className={btn.small}>
            📘 {names[g.target] ?? g.target}
          </Link>
        ))}
    </div>
  );
}
