import type { Metadata } from "next";
import Link from "next/link";
import { examConfig, levelStructure, WRITTEN_PARTS } from "@/lib/exam/config";
import { minPointsFor } from "@/lib/scoring/exam";
import { getSettings } from "@/lib/settings";
import type { Level } from "@/lib/content/schema";
import { Badge, Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.examInfo.title };

function LevelInfo({ level }: { level: Level }) {
  const s = levelStructure(level);
  const grading = examConfig.grading();
  const writing = examConfig.writingRubric(level);
  const speaking = examConfig.speakingRubric(level);
  const written = s.parts.filter((p) => WRITTEN_PARTS.includes(p.id));
  const oralPart = s.parts.find((p) => p.id === "speaking");
  const brk = s.breaks[0];
  return (
    <div className="space-y-5">
      <Card title={`${t.examInfo.written} (${s.writtenTotalMin} ${t.examInfo.minutes})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm" data-testid={`exam-parts-${level}`}>
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-1">{t.examInfo.part}</th>
                <th className="pb-1 text-right">{t.examInfo.time}</th>
                <th className="pb-1 text-right">{t.examInfo.points}</th>
                <th className="pb-1 text-right">{t.examInfo.minimum}</th>
              </tr>
            </thead>
            <tbody>
              {[...written, ...(oralPart ? [oralPart] : [])].map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-1.5">
                    {p.name}
                    {p.notes.length > 0 && <span className="block text-xs text-muted">{p.notes.join(" ")}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{p.timeMin ? `${p.timeMin} ${t.examInfo.minutes}` : s.oral.durationMin ? `~${s.oral.durationMin} ${t.examInfo.minutes}` : "–"}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.maxPoints}</td>
                  <td className="py-1.5 text-right tabular-nums">{minPointsFor(p.maxPoints, grading)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5">{t.examInfo.total}</td>
                <td />
                <td className="py-1.5 text-right tabular-nums">{s.totalPoints}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {brk && <p className="mt-2 text-sm text-muted">{t.examInfo.break(brk.minutes)}</p>}
      </Card>

      <Card title={t.examInfo.oral(s.oral.durationMin)}>
        <ol className="space-y-2 text-sm">
          {s.oral.parts.map((p) => (
            <li key={p.number}>
              <b>
                {p.number}. {p.name}
              </b>
              {p.minutes && <span className="text-muted"> · {p.minutes} {t.examInfo.minutes}</span>}
              <span className="block">{p.description}</span>
            </li>
          ))}
        </ol>
        {speaking.officialScoring.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {speaking.officialScoring.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t.examInfo.writing}>
        <div className="grid gap-4 md:grid-cols-2">
          {writing.tasks.map((task) => (
            <div key={task.taskNumber}>
              <h3 className="font-semibold">
                {t.examInfo.task(task.taskNumber)}: {task.name}
              </h3>
              <p className="text-sm text-muted">
                {t.examInfo.words(task.wordLimit.min, task.wordLimit.max)} · {task.guidingPoints} irányító szempont · {task.maxRaw} pont
              </p>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {task.criteria.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-1">{c.name}</td>
                      <td className="py-1 text-right tabular-nums">{c.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {task.rules.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {task.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {writing.generalRules.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {writing.generalRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function ExamInfoPage() {
  const level = getSettings().level;
  const grading = examConfig.grading();
  const other: Level = level === "emelt" ? "kozep" : "emelt";
  return (
    <div>
      <PageHeader title={t.examInfo.title} intro={t.examInfo.intro} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            {levelStructure(level).name} <Badge tone="accent">{levelStructure(level).cefr}</Badge>
          </h2>
          <LevelInfo level={level} />
          <details className="mt-6">
            <summary className="cursor-pointer text-lg font-semibold">
              {levelStructure(other).name} <span className="text-sm font-normal text-muted">({levelStructure(other).cefr})</span>
            </summary>
            <div className="mt-3">
              <LevelInfo level={other} />
            </div>
          </details>
        </div>
        <aside className="space-y-5">
          <Card title={t.examInfo.grades}>
            {(["kozep", "emelt"] as const).map((lv) => (
              <div key={lv} className="mb-3 last:mb-0">
                <div className="mb-1 text-sm font-medium">{levelStructure(lv).name}</div>
                <table className="w-full text-sm" data-testid={`grades-${lv}`}>
                  <tbody>
                    {grading.gradeBoundaries[lv].map((b) => (
                      <tr key={b.grade} className="border-t border-border">
                        <td className="py-1">
                          {b.grade} ({b.name})
                        </td>
                        <td className="py-1 text-right tabular-nums">{b.minPct}%-tól</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </Card>
          <Card title={t.examInfo.langExam}>
            <p className="text-sm">{grading.languageExamNote}</p>
          </Card>
          <Card title={t.examInfo.rules}>
            <p className="text-sm">{grading.minPartNote}</p>
          </Card>
          <p className="text-xs text-muted">
            <Link href="/beallitasok" className="hover:underline">
              {t.examInfo.sources}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
