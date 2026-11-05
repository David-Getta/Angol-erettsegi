import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { officialFolders } from "@/lib/official";
import { buildCommand } from "@/lib/commands/build";
import type { Content } from "@/lib/content/schema";
import { t } from "@/lib/i18n/hu";
import { partName, partPath } from "@/lib/exam/config";
import { Badge, Card, PageHeader, Empty } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.official.title };


export default function OfficialPage() {
  const folders = officialFolders();
  const rows = getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.source, "official"), eq(tasks.active, true)))
    .all();
  return (
    <div className="space-y-6">
      <PageHeader title={t.official.title} intro={t.official.intro} actions={<ReloadContentButton />} />
      <Card title="Lépések">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {t.official.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">{t.official.gitignore}</p>
      </Card>
      <Card title={t.official.folders}>
        {folders.length === 0 ? (
          <Empty>{t.official.noFolders}</Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {folders.map((f) => (
              <li key={f.name} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono">data/official/{f.name}/</code>
                  {f.importedTasks > 0 ? <Badge tone="good">{t.official.imported}: {f.importedTasks}</Badge> : <Badge tone="warn">{t.official.notImported}</Badge>}
                  <span className="text-xs text-muted">{f.files.join(", ")}</span>
                </div>
                {f.importedTasks === 0 && <CommandTip command={buildCommand("import-hivatalos", [f.name])} message={t.tips.officialPending(f.name)} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`${t.official.tasks} (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t.common.empty}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => {
              const c = r.content as Content;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone="accent">🏛 {c.official?.year} {c.official?.session} {t.level[r.level as "kozep" | "emelt"]}</Badge>
                  <span className="text-muted">{partName(r.section)}</span>
                  <Link href={`${partPath(r.section)}/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
