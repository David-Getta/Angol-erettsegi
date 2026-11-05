import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { accuracyByCategory, accuracyByType, errorsPerWeek, scoreTrend, timePerDay, timePerWeek, writingCriteriaTrend } from "@/lib/stats";
import { examConfig, labelMaps } from "@/lib/exam/config";
import { t, sectionLabel } from "@/lib/i18n/hu";
import { Card, PageHeader } from "@/components/ui";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { HBars } from "@/components/charts/HBars";

export const metadata: Metadata = { title: t.stats.title };

export default function StatsPage() {
  const s = getSettings();
  const labels = labelMaps();
  const names: Record<string, string> = { reading: t.section.reading, "language-use": t.section["language-use"], listening: t.section.listening, writing: t.section.writing, speaking: t.section.speaking };
  const trend = scoreTrend(s.level, names);
  const byType = accuracyByType(s.level, (sec, ty) => labels.taskTypes[`${sec}:${ty}`] ?? ty, sectionLabel);
  const byCat = accuracyByCategory(labels.categories);
  const days = timePerDay(30);
  const weeks = timePerWeek(12);
  const errWeeks = errorsPerWeek(12);
  const rubric = examConfig.writingRubric(s.level);
  const critNames = Object.fromEntries(rubric.tasks.flatMap((x) => x.criteria.map((c) => [c.id, c.name])));
  const crit = writingCriteriaTrend(s.level, critNames);
  return (
    <div className="space-y-6">
      <PageHeader title={t.stats.title} intro={t.level[s.level]} />
      <Card title={t.stats.scoreTrend}>{trend.length ? <LineChart series={trend} /> : <p className="text-sm text-muted">{t.stats.noData}</p>}</Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.stats.byType}>
          <HBars rows={byType} empty={t.stats.noData} />
        </Card>
        <Card title={t.stats.byCategory}>
          <HBars rows={byCat} empty={t.stats.noData} />
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`${t.stats.time} – ${t.stats.perDay}`}>
          <BarChart points={days} unit="perc" />
        </Card>
        <Card title={`${t.stats.time} – ${t.stats.perWeek}`}>
          <BarChart points={weeks} unit="perc" />
        </Card>
      </div>
      <Card title={t.stats.errorsPerWeek}>
        {errWeeks.some((p) => p.y > 0) ? <BarChart points={errWeeks} unit="hiba" /> : <p className="text-sm text-muted">{t.stats.noData}</p>}
      </Card>

      <Card title={t.stats.writingCriteria}>{crit.length ? <LineChart series={crit} /> : <p className="text-sm text-muted">{t.stats.noData}</p>}</Card>
    </div>
  );
}
