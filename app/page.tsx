import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { daysUntil, estimateParts, latestDiagnostic } from "@/lib/dashboard";
import { todayPlan } from "@/lib/plan";
import { secondsByDay, streak, weekSeconds } from "@/lib/activity";
import { contentStock } from "@/lib/tasks";
import { pendingInbox } from "@/lib/exchange/files";
import { lastImportAt } from "@/lib/submissions";
import { examConfig, levelStructure } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import { importVocabCompletions, incompleteCount } from "@/lib/vocab/cards";
import { t, sectionLabel } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, ProgressBar, Stat, btn, formatDate, formatDuration } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ImportButton } from "@/components/grading/ImportButton";

export default function DashboardPage() {
  importVocabCompletions();
  const s = getSettings();
  const structure = levelStructure(s.level);
  const days = daysUntil(s.examDate);
  const est = estimateParts(s.level, s.targetPct);
  const known = est.filter((e) => e.points !== null);
  const totalEst = known.reduce((n, e) => n + (e.points ?? 0), 0);
  const diag = latestDiagnostic(s.level);
  const plan = todayPlan(s.level, est, !!diag);
  const byDay = secondsByDay(400);
  const st = streak(byDay);
  const week = weekSeconds(byDay);
  const stock = contentStock(s.level);
  const low = stock.filter((r) => r.low);
  const pending = pendingInbox();
  const lastImport = lastImportAt();
  const incomplete = incompleteCount();
  const app = examConfig.app();
  const targetTotal = Math.round((s.targetPct / 100) * structure.totalPoints);
  const diagResult = diag?.result as { cefr?: string } | null | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.dashboard.title}
        intro={!diag ? t.dashboard.welcome : undefined}
        actions={
          !diag ? (
            <Link href="/szintfelmero" className={btn.primary}>
              {t.dashboard.startDiagnostic}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label={t.level[s.level]}
            value={days > 0 ? t.dashboard.countdown(days) : days === 0 ? "🎓" : "–"}
            hint={days === 0 ? t.dashboard.examDay : days < 0 ? t.dashboard.examPassed : new Date(s.examDate).toLocaleDateString("hu-HU")}
          />
        </Card>
        <Card>
          <Stat label={t.dashboard.streak(st)} value={`🔥 ${st}`} hint={`${t.dashboard.week}: ${formatDuration(week)}`} />
        </Card>
        <Card>
          <Stat label={t.dashboard.cefr} value={diagResult?.cefr ?? "?"} hint={diag ? formatDate(diag.createdAt) : t.dashboard.noData} />
        </Card>
        <Card>
          <Stat
            label={t.dashboard.pendingGrading}
            value={pending.length}
            hint={`${t.dashboard.lastImport}: ${lastImport ? formatDate(lastImport) : t.dashboard.never}`}
          />
        </Card>
      </div>

      {pending.length > 0 && (
        <CommandTip command="/javitas" message={`${t.dashboard.pendingCount(pending.length)}. ${t.tips.grading}`} testId="javitas-tip">
          <ImportButton variant="secondary" />
        </CommandTip>
      )}
      {incomplete > 0 && <CommandTip command="/szokincs" message={t.tips.incompleteCards(incomplete)} dismissKey={`incomplete-${incomplete}`} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title={t.dashboard.todayPlan}>
          {plan.length === 0 ? (
            <p className="text-sm text-muted">{t.dashboard.planEmpty}</p>
          ) : (
            <ol className="space-y-2" data-testid="today-plan">
              {plan.map((p) => (
                <li key={p.key}>
                  <Link href={p.href} className={`flex items-start gap-3 rounded-lg border border-border p-3 hover:border-accent ${p.done ? "opacity-60" : ""}`}>
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${p.done ? "border-good bg-good text-bg" : "border-border"}`}>
                      {p.done ? "✓" : ""}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{p.title}</span>
                      <span className="block text-xs text-muted">{p.reason}</span>
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted">~{p.minutes} p</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          title={t.dashboard.estimate}
          actions={
            <span className="text-sm tabular-nums" data-testid="estimate-total">
              {known.length ? (
                <>
                  <b>{Math.round(totalEst)}</b> / {structure.totalPoints}
                  {known.length < est.length && <span className="text-xs text-muted"> ({known.length}/{est.length} rész)</span>}
                </>
              ) : (
                t.dashboard.noData
              )}
              <span className="ml-2 text-xs text-muted">
                {t.dashboard.target}: {targetTotal}
              </span>
            </span>
          }
        >
          <p className="mb-3 text-xs text-muted">{t.dashboard.estimateHint}</p>
          <ul className="space-y-3">
            {est.map((e) => (
              <li key={e.part}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    {e.name}
                    {e.belowMinimum && (
                      <span className="ml-2">
                        <Badge tone="bad">⚠ 12%</Badge>
                      </span>
                    )}
                    {!e.belowMinimum && e.atRisk && (
                      <span className="ml-2">
                        <Badge tone="warn">⚠ 12% közelében</Badge>
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {e.points === null ? <span className="text-muted">{t.dashboard.noData}</span> : <b>{e.points}</b>} / {e.maxPoints}
                  </span>
                </div>
                <div className="relative mt-1">
                  <ProgressBar value={e.points ?? 0} max={e.maxPoints} tone={e.belowMinimum ? "bad" : e.atRisk ? "warn" : "accent"} marker={e.targetPoints} />
                  <div className="absolute inset-y-0 w-0.5 bg-bad" style={{ left: `${(e.minPoints / e.maxPoints) * 100}%` }} title={t.dashboard.threshold(e.minPoints)} />
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-muted">
                  <span>{t.dashboard.threshold(e.minPoints)}</span>
                  <span>
                    {t.dashboard.target}: {e.targetPoints}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {est.some((e) => e.belowMinimum) && (
            <div className="mt-3 rounded-md border border-bad/40 bg-bad-soft p-2 text-sm text-bad" role="alert">
              {est
                .filter((e) => e.belowMinimum)
                .map((e) => t.dashboard.warnPart(e.name))
                .join(" ")}
            </div>
          )}
        </Card>
      </div>

      <Card title={t.dashboard.stock}>
        <p className="mb-3 text-xs text-muted">{t.dashboard.stockHint}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm" data-testid="stock-table">
            <tbody>
              {stock.map((r) => (
                <tr key={`${r.section}-${r.type}`} className="border-t border-border">
                  <td className="py-1.5 pr-2 text-muted">{sectionLabel(r.section)}</td>
                  <td className="py-1.5 pr-2">{r.typeName}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    <b>{r.unused}</b> / {r.total}
                  </td>
                  <td className="py-1.5 text-right">{r.low && <Badge tone="warn">{t.dashboard.stockLow}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {[...new Set(low.map((r) => r.section))].slice(0, 3).map((sec) => (
          <CommandTip
            key={sec}
            command={feladatokCommand(sec, s.level, app.lowStock.suggestCount)}
            message={t.tips.lowStock(
              `${sectionLabel(sec)} (${low
                .filter((r) => r.section === sec)
                .map((r) => r.typeName)
                .join(", ")})`,
            )}
            dismissKey={`dash-low-${sec}-${s.level}-${low.filter((r) => r.section === sec).reduce((n, r) => n + r.unused, 0)}`}
          />
        ))}
      </Card>
    </div>
  );
}
