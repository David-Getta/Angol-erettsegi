import Link from "next/link";
import { notFound } from "next/navigation";
import { getMock, mockWeakCategories, refreshMockResult, secondsLeft, type MockKind, type MockPlan, type MockResult } from "@/lib/mock";
import { getContent } from "@/lib/tasks";
import type { Level, ObjectiveTask, WritingTask } from "@/lib/content/schema";
import { labelMaps, levelStructure } from "@/lib/exam/config";
import { getSettings } from "@/lib/settings";
import { listSubmissions } from "@/lib/submissions";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, ProgressBar, btn, formatDate } from "../ui";
import { CommandTip } from "../CommandTip";
import { ImportButton } from "../grading/ImportButton";
import { MockRunner } from "./MockRunner";

/** Shared page body for /probaerettsegi/[id] and /szintfelmero/[id]. */
export function MockPage({ id, kind }: { id: number; kind: MockKind }) {
  const m = getMock(id);
  if (!m || m.kind !== kind) notFound();
  const plan = m.plan as MockPlan;
  const base = kind === "mock" ? "/probaerettsegi" : "/szintfelmero";

  if (m.status === "in-progress") {
    const p = plan.parts[m.currentPart]!;
    const s = getSettings();
    const ls = levelStructure(m.level as Level).listening;
    const contents = p.taskIds.map((tid) => getContent(tid)).filter((c): c is NonNullable<typeof c> => !!c);
    return (
      <MockRunner
        key={`${m.id}-${m.currentPart}-${m.partStartedAt?.getTime() ?? 0}`}
        mockId={m.id}
        kind={kind}
        part={{ index: m.currentPart, total: plan.parts.length, part: p.part, name: p.name, timeSec: p.timeSec, started: !!m.partStartedAt, secondsLeft: secondsLeft(m) }}
        objective={contents.filter((c) => c.section !== "writing") as ObjectiveTask[]}
        writing={contents.filter((c) => c.section === "writing") as WritingTask[]}
        categoryNames={labelMaps().categories}
        tts={{ rate: s.ttsRate, female: s.ttsVoiceFemale, male: s.ttsVoiceMale, prepSeconds: ls.prepSeconds, pauseSeconds: ls.pauseSeconds }}
      />
    );
  }

  const result = refreshMockResult(id);
  return (
    <div className="space-y-5">
      <Link href={base} className="text-sm text-muted hover:underline">
        ← {kind === "mock" ? t.mock.title : t.diagnostic.title}
      </Link>
      <h1 className="text-2xl font-semibold">
        {kind === "mock" ? t.mock.result : t.diagnostic.result} · {t.level[m.level as Level]} · {formatDate(m.createdAt)}
      </h1>
      {m.status === "abandoned" && <Badge tone="warn">{t.mock.abandon}</Badge>}
      {result && <MockResultView kind={kind} level={m.level as Level} result={result} mockId={m.id} />}
    </div>
  );
}

export function MockResultView({ kind, level, result, mockId }: { kind: MockKind; level: Level; result: MockResult; mockId: number }) {
  const o = result.outcome;
  const pendingWriting = result.parts.some((p) => p.pending);
  const subs = listSubmissions("writing").filter((s) => s.mockExamId === mockId);
  const weak = mockWeakCategories(mockId);
  return (
    <div className="space-y-5" data-testid="mock-result">
      {pendingWriting && (
        <CommandTip command="/javitas" message={t.mock.awaiting} testId="javitas-tip">
          <div className="flex flex-wrap items-center gap-3">
            <ImportButton />
            {subs.map((s) => (
              <Link key={s.id} href={`/iras/beadas/${s.id}`} className={btn.small}>
                ✍ {s.id}
              </Link>
            ))}
          </div>
        </CommandTip>
      )}
      {kind === "diagnostic" && result.cefr && (
        <Card title={t.diagnostic.estimatedLevel}>
          <div className="text-4xl font-semibold" data-testid="cefr">
            {result.cefr}
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <b>{t.diagnostic.strengths}:</b> {result.strengths?.join(", ") || "–"}
            </div>
            <div>
              <b>{t.diagnostic.weaknesses}:</b> {result.weaknesses?.join(", ") || "–"}
            </div>
          </div>
        </Card>
      )}
      <Card title={t.mock.partScores}>
        <table className="w-full text-sm" data-testid="part-scores">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2">Rész</th>
              <th className="pb-2 text-right">Nyers pont</th>
              <th className="pb-2 text-right">Vizsgapont</th>
              <th className="pb-2 pl-4">{t.mock.minimum}</th>
            </tr>
          </thead>
          <tbody>
            {result.parts.map((p) => {
              const chk = o.parts.find((x) => x.part === p.part);
              return (
                <tr key={p.part} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right tabular-nums">{p.raw === null ? (p.pending ? t.writing.pending : "–") : `${p.raw} / ${p.rawMax}`}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{p.points === null ? "–" : `${p.points} / ${p.maxPoints}`}</td>
                  <td className="py-2 pl-4">
                    {p.points === null ? (
                      <span className="text-muted">–</span>
                    ) : chk?.belowMinimum ? (
                      <Badge tone="bad">✗ {t.mock.below} (min. {chk.minPoints})</Badge>
                    ) : (
                      <Badge tone="good">✓ {t.mock.ok} (min. {chk?.minPoints})</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {kind === "mock" && (
              <tr className="border-t border-border text-muted">
                <td className="py-2">
                  {t.mock.oralEstimate} <span className="text-xs">({result.oralEstimate.source === "speaking" ? "szóbeli javításaid alapján" : "az írásbeli arányával"})</span>
                </td>
                <td />
                <td className="py-2 text-right tabular-nums">
                  ≈ {result.oralEstimate.points} / {o.parts.find((x) => x.part === "speaking")?.maxPoints}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {kind === "mock" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">{t.mock.writtenPct}</div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="written-pct">
              {result.writtenPoints} / {result.writtenMax} · {result.writtenPct}%
            </div>
            <ProgressBar value={result.writtenPoints} max={result.writtenMax} />
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">{t.mock.totalPct}</div>
            <div className="text-3xl font-semibold tabular-nums" data-testid="total-pct">
              {o.points} / {o.maxPoints} · {o.pct}%
            </div>
            <p className="mt-1 text-xs text-muted">{t.mock.oralEstimateHint}</p>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wide text-muted">{t.mock.grade}</div>
            <div className="text-3xl font-semibold" data-testid="grade">
              {result.complete ? `${o.grade.grade} (${o.grade.name})` : "–"}
            </div>
            <div className="mt-2 text-sm">
              <b>{t.mock.langExam}:</b>{" "}
              {!result.complete ? "–" : o.languageExam ? <span data-testid="lang-exam">{o.languageExam.label}</span> : <span className="text-muted">{t.mock.langExamNone}</span>}
            </div>
            {o.failedByMinimum && <p className="mt-2 text-sm text-bad">{t.dashboard.warnPart(o.parts.filter((p) => p.belowMinimum).map((p) => result.parts.find((x) => x.part === p.part)?.name ?? p.part).join(", "))}</p>}
          </Card>
        </div>
      )}
      {weak.length > 0 && (
        <Card title={t.weak.title}>
          <p className="mb-3 text-sm text-muted">{t.weak.intro}</p>
          <ul className="divide-y divide-border text-sm" data-testid="weak-categories">
            {weak.map((w) => (
              <li key={w.category} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 font-medium">{w.name}</span>
                <span className="text-muted">{t.weak.wrong(w.wrong, w.total)}</span>
                <Link href={`/szabalytar/${w.category}`} className={btn.small}>
                  § {t.weak.lesson}
                </Link>
                {w.group !== "comprehension" && w.group !== "writing" && (
                  <Link href={`/nyelvhelyesseg/celzott?k=${w.category}`} className={btn.small}>
                    ↻ {t.weak.practice}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">Szint: {t.level[level]}</p>
    </div>
  );
}
