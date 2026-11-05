import type { Metadata } from "next";
import Link from "next/link";
import { listGuides } from "@/lib/guides";
import { taskTypeName } from "@/lib/exam/config";
import { PageHeader } from "@/components/ui";
import { sectionLabel, t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.guides.title };

const ORDER = ["writing", "speaking", "exam"] as const;
const PART_ORDER = ["reading", "language-use", "listening", "writing", "speaking"];

export default function GuidesPage() {
  const guides = listGuides();
  return (
    <div>
      <PageHeader title={t.guides.title} intro={t.guides.intro} />
      <div className="space-y-6">
        {ORDER.map((kind) => {
          const list = guides
            .filter((g) => g.type === kind)
            .sort((a, b) => (kind === "exam" ? PART_ORDER.indexOf(a.target) - PART_ORDER.indexOf(b.target) : a.title.localeCompare(b.title, "hu")));
          if (!list.length) return null;
          return (
            <section key={kind}>
              <h2 className="mb-2 text-lg font-semibold">{t.guides.groups[kind]}</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`guides-${kind}`}>
                {list.map((g) => (
                  <li key={g.id}>
                    <Link href={`/utmutatok/${g.id}`} className="block h-full rounded-xl border border-border bg-surface p-3 shadow-sm hover:bg-surface-2">
                      <div className="font-medium">{g.title}</div>
                      <div className="text-xs text-muted">
                        {kind === "exam" ? sectionLabel(g.target) : taskTypeName(kind, g.target)}
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-muted">{g.summaryHu}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
