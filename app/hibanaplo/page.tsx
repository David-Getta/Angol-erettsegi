import type { Metadata } from "next";
import Link from "next/link";
import { categoryStats, recentErrors, weeklyTrend } from "@/lib/errors/log";
import { countBankItems } from "@/lib/targeted";
import { examConfig } from "@/lib/exam/config";
import { getSettings } from "@/lib/settings";
import { buildCommand } from "@/lib/commands/build";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, Empty, PageHeader, btn, formatDate } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { SparkBars } from "@/components/charts/SparkBars";

export const metadata: Metadata = { title: t.errorLog.title };

export default async function ErrorLogPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const s = getSettings();
  const app = examConfig.app();
  const stats = categoryStats();
  const trend = weeklyTrend(8);
  const recent = recentErrors(60, k || undefined);
  const names = Object.fromEntries(examConfig.errorCategories().categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader title={t.errorLog.title} intro={t.errorLog.intro} />
      {stats.length === 0 ? (
        <Empty>{t.errorLog.empty}</Empty>
      ) : (
        <div className="space-y-6">
          <Card title={t.errorLog.byCategory}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm" data-testid="category-table">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2">Kategória</th>
                    <th className="pb-2 text-right">{t.errorLog.total}</th>
                    <th className="pb-2 text-right">{t.errorLog.last30}</th>
                    <th className="pb-2 pl-4">{t.errorLog.trend}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {stats.map((c) => {
                    const bank = countBankItems(c.category, s.level);
                    const enough = bank >= app.targeted.minBankItems;
                    const delta = c.last30 - c.prev30;
                    return (
                      <tr key={c.category} className="border-t border-border align-middle">
                        <td className="py-2 pr-2">
                          <Link href={`/hibanaplo?k=${c.category}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>{" "}
                          <Link href={`/szabalytar/${c.category}`} className="text-xs text-accent hover:underline" title={t.lessons.lessonLinkTitle} data-testid={`lesson-link-${c.category}`}>
                            § {t.lessons.lessonLink}
                          </Link>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            <Badge>{t.errorLog.groups[c.group]}</Badge>
                            {c.improving && (
                              <Badge tone="good" title={t.errorLog.improvingHint(app.improving.lastN, app.improving.minPct)}>
                                ↗ {t.errorLog.improving}
                              </Badge>
                            )}
                            {c.targetedPct !== null && !c.improving && (
                              <Badge title={t.errorLog.improvingHint(app.improving.lastN, app.improving.minPct)}>
                                célzott: {Math.round(c.targetedPct)}% ({c.targetedTried})
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums">{c.total}</td>
                        <td className="py-2 text-right tabular-nums">
                          {c.last30}{" "}
                          {c.prev30 > 0 && delta !== 0 && (
                            <span className={`text-xs ${delta < 0 ? "text-good" : "text-bad"}`} title={`${t.errorLog.prev30}: ${c.prev30}`}>
                              {delta < 0 ? "▼" : "▲"}
                              {Math.abs(delta)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pl-4">
                          <SparkBars values={trend.map((w) => ({ label: w.weekStart, value: w.counts[c.category] ?? 0 }))} />
                        </td>
                        <td className="py-2 text-right">
                          {enough ? (
                            <Link href={`/nyelvhelyesseg/celzott?k=${c.category}`} className={btn.small} data-testid={`practice-${c.category}`}>
                              ▶ {t.errorLog.practice}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted" title={t.errorLog.notEnough}>
                              {bank} item
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stats
              .filter((c) => countBankItems(c.category, s.level) < app.targeted.minBankItems && c.group !== "comprehension")
              .slice(0, 3)
              .map((c) => (
                <CommandTip
                  key={c.category}
                  command={buildCommand("feladatok", ["nyelvhelyesseg", s.level, 10, null, c.category])}
                  message={`${c.name}: ${t.tips.notEnoughTargeted}`}
                  dismissKey={`targeted-${c.category}-${s.level}`}
                />
              ))}
          </Card>

          <Card
            title={`${t.errorLog.recent}${k ? ` – ${names[k] ?? k}` : ""}`}
            actions={
              k ? (
                <Link href="/hibanaplo" className={btn.small}>
                  {t.errorLog.filterAll}
                </Link>
              ) : null
            }
          >
            <ul className="divide-y divide-border" data-testid="recent-errors">
              {recent.map((e) => (
                <li key={e.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Link href={`/szabalytar/${e.category}`} title={t.lessons.lessonLinkTitle}>
                      <Badge>{names[e.category] ?? e.category}</Badge>
                    </Link>
                    <span>{t.errorLog.source[e.sourceType] ?? e.sourceType}</span>
                    <span>{formatDate(e.createdAt)}</span>
                  </div>
                  {e.context && (
                    <div className="mt-1 font-reading text-[15px] text-muted">
                      {t.errorLog.context}: {e.context}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="text-muted">{t.errorLog.yourAnswer}:</span> <s className="text-bad">{e.original}</s>
                    <span className="mx-2">→</span>
                    <span className="text-muted">{t.errorLog.correct}:</span> <b className="text-good">{e.corrected}</b>
                  </div>
                  <div className="mt-1 whitespace-pre-line">
                    <span className="font-medium">{t.errorLog.why}: </span>
                    {e.explanation}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
