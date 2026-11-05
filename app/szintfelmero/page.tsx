import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { activeMock, buildPlan, listMocks, type MockResult } from "@/lib/mock";
import { feladatokCommand } from "@/lib/commands/build";
import { partPath, examConfig } from "@/lib/exam/config";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, btn, formatDate } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { StartMockButton } from "@/components/mock/StartMockButton";

export const metadata: Metadata = { title: t.diagnostic.title };

export default function DiagnosticLanding() {
  const s = getSettings();
  const active = activeMock("diagnostic", s.level);
  const history = listMocks("diagnostic", s.level).filter((m) => m.status !== "abandoned");
  const plan = buildPlan("diagnostic", s.level);
  return (
    <div className="space-y-6">
      <PageHeader title={t.diagnostic.title} intro={t.diagnostic.intro} />
      <Card title={`${t.diagnostic.parts} (${t.level[s.level]})`}>
        {plan.ok ? (
          <ol className="grid gap-2 text-sm sm:grid-cols-4">
            {plan.plan.parts.map((p, i) => (
              <li key={p.part} className="rounded-lg bg-surface-2/60 p-3">
                <b>
                  {i + 1}. {p.name}
                </b>
                <div className="text-muted">
                  {Math.round(p.timeSec / 60)} perc · {p.taskIds.length} feladat
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <p className="text-sm text-bad">{t.diagnostic.notEnough}</p>
            {plan.missing.map((m) => (
              <CommandTip key={m.part} command={feladatokCommand(examConfig.subject().id, partPath(m.part).slice(1), s.level, 2)} message={t.mock.notEnough(m.name)} />
            ))}
          </>
        )}
        <p className="mt-3 text-xs text-muted">{t.diagnostic.writingNote}</p>
        <div className="mt-4">
          {active ? (
            <Link href={`/szintfelmero/${active.id}`} className={btn.primary}>
              ▶ {t.diagnostic.resume}
            </Link>
          ) : (
            plan.ok && <StartMockButton kind="diagnostic" label={history.length ? t.diagnostic.retake : t.diagnostic.start} base="/szintfelmero" />
          )}
        </div>
      </Card>
      {history.length > 0 && (
        <Card title={t.diagnostic.history}>
          <ul className="divide-y divide-border text-sm">
            {history.map((m) => {
              const r = m.result as MockResult | null;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/szintfelmero/${m.id}`} className="font-medium hover:underline">
                    {formatDate(m.createdAt)}
                  </Link>
                  {r?.cefr && <Badge tone="accent">{r.cefr}</Badge>}
                  {r && <span className="text-muted">{r.parts.map((p) => `${p.name}: ${p.excluded ? t.diagnostic.excluded : p.pct === null ? "–" : Math.round(p.pct) + "%"}`).join(" · ")}</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
