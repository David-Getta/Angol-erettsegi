import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { examConfig, examConfigProvenance, levelStructure } from "@/lib/exam/config";
import { listBackups } from "@/lib/backup";
import { t } from "@/lib/i18n/hu";
import { Card, PageHeader } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: t.settings.title };

export default function SettingsPage() {
  const s = getSettings();
  const totals = { kozep: levelStructure("kozep").totalPoints, emelt: levelStructure("emelt").totalPoints };
  const backups = listBackups().map((b) => ({ name: b.name, size: b.size, at: b.at.toISOString() }));
  return (
    <div>
      <PageHeader title={t.settings.title} />
      <SettingsForm settings={s} totals={totals} backups={backups} language={examConfig.subject().language} />
      <Card className="mt-6" title={t.settings.provenance}>
        <p className="mb-4 text-sm text-muted">{t.settings.provenanceHint}</p>
        <div className="space-y-4">
          {examConfigProvenance().map((c) => (
            <details key={c.file} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">
                <code className="font-mono">{c.file}</code>{" "}
                <span className="text-muted">· {c.verifiedAt ? t.settings.verifiedAt(c.verifiedAt) : t.settings.notVerified}</span>
              </summary>
              {c.notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {c.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              {c.sources.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.settings.sources}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {c.sources.map((src) => (
                      <li key={src.url + src.title}>
                        <a className="underline decoration-dotted underline-offset-2 hover:text-accent" href={src.url} target="_blank" rel="noreferrer">
                          {src.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
