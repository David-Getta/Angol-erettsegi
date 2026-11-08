import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { activeMock, availableSets, listMocks, type MockResult } from "@/lib/mock";
import { levelStructure, partPath, examConfig } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, btn, formatDate } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { StartMockButton } from "@/components/mock/StartMockButton";
import { GuideLinks } from "@/components/guides/GuideLink";

export const metadata: Metadata = { title: t.mock.title };

export default function MockLandingPage() {
  const s = getSettings();
  const st = levelStructure(s.level);
  const active = activeMock("mock", s.level);
  const history = listMocks("mock", s.level);
  const sets = { kozep: availableSets("kozep"), emelt: availableSets("emelt") };
  return (
    <div className="space-y-6">
      <PageHeader title={t.mock.title} intro={t.mock.intro} />
      <GuideLinks type="exam" title={t.guides.byPart} names={Object.fromEntries(st.parts.map((p) => [p.id, p.name]))} />
      <Card title={`${t.level[s.level]} – ${st.writtenTotalMin} perc írásbeli`}>
        <ol className="grid gap-2 text-sm sm:grid-cols-4">
          {st.parts
            .filter((p) => p.written)
            .map((p) => (
              <li key={p.id} className="rounded-lg bg-surface-2/60 p-3">
                <b>
                  {p.order}. {p.name}
                </b>
                <div className="text-muted">
                  {p.timeMin} perc · {p.maxPoints} pont
                </div>
              </li>
            ))}
        </ol>
        {st.breaks.map((b) => (
          <p key={b.afterPart} className="mt-2 text-xs text-muted">
            {t.mock.breakTitle}: {b.minutes} perc ({st.parts.find((p) => p.id === b.afterPart)?.name} után)
          </p>
        ))}
        <div className="mt-4">
          {active ? (
            <Link href={`/probaerettsegi/${active.id}`} className={btn.primary}>
              ▶ {t.mock.resume}
            </Link>
          ) : (
            <StartMockButton kind="mock" label={t.mock.start} base="/probaerettsegi" />
          )}
        </div>
      </Card>
      <Card title={t.mock.unused}>
        <div className="flex gap-6 text-sm">
          <span>
            {t.level.kozep}: <b data-testid="sets-kozep">{t.mock.sets(sets.kozep)}</b>
          </span>
          <span>
            {t.level.emelt}: <b data-testid="sets-emelt">{t.mock.sets(sets.emelt)}</b>
          </span>
        </div>
        {sets[s.level] < 2 && <CommandTip command={feladatokCommand(examConfig.subject().id, partPath("reading").slice(1), s.level, 4)} message={t.tips.lowStock(t.mock.title)} dismissKey={`mock-sets-${s.level}-${sets[s.level]}`} />}
      </Card>
      <Card title={t.mock.history}>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{t.common.empty}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {history.map((m) => {
              const r = m.result as MockResult | null;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/probaerettsegi/${m.id}`} className="font-medium hover:underline">
                    {formatDate(m.createdAt)}
                  </Link>
                  <Badge tone={m.status === "done" ? "good" : m.status === "abandoned" ? "bad" : "warn"}>{m.status}</Badge>
                  {r && (
                    <span className="text-muted">
                      írásbeli {r.writtenPct}% · {r.complete ? `${r.outcome.pct}% · jegy: ${r.outcome.grade.grade}` : t.writing.pending}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
