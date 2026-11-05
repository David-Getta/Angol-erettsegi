import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { getSettings } from "@/lib/settings";
import { taskTypeName } from "@/lib/exam/config";
import { Badge, Card, PageHeader } from "@/components/ui";
import { GuidePhrases } from "@/components/guides/GuidePhrases";
import { Checklist } from "@/components/guides/Checklist";
import { sectionLabel, t } from "@/lib/i18n/hu";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const g = getGuide(id);
  return { title: `${g?.title ?? id} – ${t.guides.title}` };
}

export default async function GuidePage({ params }: Props) {
  const { id } = await params;
  const g = getGuide(id);
  if (!g) notFound();
  const level = getSettings().level;
  const levelNote = g.levelNotes[level];
  const otherNote = g.levelNotes[level === "emelt" ? "kozep" : "emelt"];
  const kindLabel = g.type === "exam" ? sectionLabel(g.target) : taskTypeName(g.type, g.target);

  return (
    <div>
      <PageHeader
        title={g.title}
        intro={g.summaryHu}
        actions={
          <Link href="/utmutatok" className="text-sm text-muted hover:underline">
            ← {t.guides.title}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{t.guides.groups[g.type]}</Badge>
        <Badge tone="accent">{kindLabel}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {levelNote && (
            <Card title={`${t.guides.levelNote} (${t.level[level]})`}>
              <p className="text-sm">{levelNote}</p>
              {otherNote && (
                <details className="mt-2 text-sm text-muted">
                  <summary className="cursor-pointer">{t.level[level === "emelt" ? "kozep" : "emelt"]}</summary>
                  <p className="mt-1">{otherNote}</p>
                </details>
              )}
            </Card>
          )}

          <Card title={t.guides.steps}>
            <ol className="space-y-4" data-testid="guide-steps">
              {g.steps.map((s, i) => (
                <li key={i} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-[15px]">{s.explanation}</p>
                  {s.tips.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-muted">
                      {s.tips.map((tip, j) => (
                        <li key={j}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </Card>

          {g.phrases.length > 0 && (
            <Card title={t.guides.phrases}>
              <GuidePhrases phrases={g.phrases} guideId={g.id} />
            </Card>
          )}

          {g.example && (
            <Card title={g.example.title ? `${t.guides.example}: ${g.example.title}` : t.guides.example}>
              <div lang="en" className="reading-text whitespace-pre-wrap rounded-lg border border-border p-3">
                {g.example.text}
              </div>
              {g.example.notes.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {g.example.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {g.mistakes.length > 0 && (
            <Card title={t.guides.mistakes}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="pb-1 pr-2">{t.guides.wrong}</th>
                      <th className="pb-1 pr-2">{t.guides.right}</th>
                      <th className="pb-1">{t.guides.why}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.mistakes.map((m, i) => (
                      <tr key={i} className="border-t border-border align-top">
                        <td lang="en" className="py-1.5 pr-2 font-reading text-bad line-through decoration-bad/50">
                          {m.wrong}
                        </td>
                        <td lang="en" className="py-1.5 pr-2 font-reading font-medium text-good">
                          {m.right}
                        </td>
                        <td className="py-1.5">{m.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          {g.checklist.length > 0 && (
            <Card title={t.guides.checklist}>
              <p className="mb-2 text-xs text-muted">{t.guides.checklistHint}</p>
              <Checklist items={g.checklist} />
            </Card>
          )}
          {g.timing && (
            <Card title={t.guides.timing}>
              <p className="text-sm">{g.timing}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
