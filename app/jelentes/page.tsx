import type { Metadata } from "next";
import { progressReport } from "@/lib/report";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.report.title };

const fmt = (d: Date) => d.toLocaleDateString("hu-HU");

export default function ReportPage() {
  const r = progressReport();
  return (
    <div className="space-y-5">
      <PageHeader title={`${t.report.title} – ${t.level[r.level]}`} intro={t.report.intro} actions={<PrintButton />} />
      <p className="text-sm text-muted">
        {t.report.generated(fmt(new Date()))} · {t.report.exam(r.daysLeft, new Date(r.examDate).toLocaleDateString("hu-HU"))}
      </p>

      <Card title={t.report.estimates}>
        <table className="w-full text-sm" data-testid="report-estimates">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-1">{t.report.part}</th>
              <th className="pb-1 text-right">{t.report.estimate}</th>
              <th className="pb-1 text-right">{t.report.minimum}</th>
              <th className="pb-1 text-right">{t.report.target}</th>
            </tr>
          </thead>
          <tbody>
            {r.estimates.map((e) => (
              <tr key={e.part} className="border-t border-border">
                <td className="py-1.5">{e.name}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {e.points === null ? <span className="text-muted">{t.report.noData}</span> : `${Math.round(e.points)} / ${e.maxPoints}`}
                  {e.belowMinimum && <span className="ml-1 text-bad">⚠</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums">{e.minPoints}</td>
                <td className="py-1.5 text-right tabular-nums">{e.targetPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm font-medium">{t.report.total(r.estimatedTotal.points, r.estimatedTotal.max, r.estimatedTotal.complete)}</p>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title={t.report.mock}>
          {r.lastMock ? (
            <p className="text-sm">
              {t.report.mockLast(fmt(r.lastMock.date), r.lastMock.pct, r.lastMock.grade)}
              <br />
              <span className="text-muted">{t.report.mockCount(r.mocksDone)}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">{t.report.mockNone}</p>
          )}
        </Card>
        <Card title={t.report.writing}>
          {r.writing.length ? (
            <ul className="space-y-1 text-sm">
              {r.writing.map((w, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {fmt(w.date)} · {w.title}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {w.score} / {w.max}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.report.noData}</p>
          )}
        </Card>
      </div>

      <Card title={t.report.errors}>
        {r.topErrors.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                {t.report.errorsCols.map((c, i) => (
                  <th key={i} className={`pb-1 ${i > 0 && i < 3 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.topErrors.map((e) => (
                <tr key={e.name} className="border-t border-border">
                  <td className="py-1.5">{e.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.last30}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.total}</td>
                  <td className="py-1.5 pl-3">{e.improving && <Badge tone="good">↗ {t.report.improving}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">{t.report.noData}</p>
        )}
        <p className="mt-2 text-sm">{t.report.fixed(r.fixed.all, r.fixed.last30)}</p>
      </Card>

      <Card>
        <ul className="space-y-1 text-sm">
          <li>{t.report.practice(r.practice.minutes30, r.practice.activeDays30, r.practice.streak)}</li>
          <li>{t.report.vocab(r.vocab.cards, r.vocab.reviews30)}</li>
        </ul>
      </Card>
      <p className="text-xs text-muted">{t.report.note}</p>
    </div>
  );
}
