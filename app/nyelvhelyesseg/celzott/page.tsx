import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { pickTargeted, countBankItems } from "@/lib/targeted";
import { categoryStats } from "@/lib/errors/log";
import { examConfig } from "@/lib/exam/config";
import { buildCommand } from "@/lib/commands/build";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { TargetedRunner } from "./TargetedRunner";

export const metadata: Metadata = { title: t.languageUse.targeted };

export default async function TargetedPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const s = getSettings();
  const app = examConfig.app();
  const cats = examConfig.errorCategories().categories;
  const names = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  const selected = (k ?? "").split(",").filter((c) => names[c]);

  if (selected.length === 0) {
    const stats = new Map(categoryStats().map((c) => [c.category, c]));
    return (
      <div>
        <PageHeader title={t.languageUse.targeted} intro={t.languageUse.targetedIntro} />
        <Card title={t.languageUse.targetedPick}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cats
              .filter((c) => c.group === "grammar" || c.group === "vocabulary")
              .map((c) => {
                const n = countBankItems(c.id, s.level);
                const errs = stats.get(c.id)?.total ?? 0;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/nyelvhelyesseg/celzott?k=${c.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent ${n === 0 ? "opacity-60" : ""}`}
                    >
                      <span>{c.name}</span>
                      <span className="flex gap-1">
                        {errs > 0 && <Badge tone="bad">{errs} hiba</Badge>}
                        <Badge>{n} item</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </Card>
      </div>
    );
  }

  const items = pickTargeted(selected, s.level, app.targeted.itemsPerRound);
  const lowCats = selected.filter((c) => countBankItems(c, s.level) < app.targeted.minBankItems);
  return (
    <div>
      <PageHeader title={`${t.languageUse.targeted}: ${selected.map((c) => names[c]).join(", ")}`} intro={t.languageUse.targetedIntro} />
      {lowCats.map((c) => (
        <CommandTip
          key={c}
          command={buildCommand("feladatok", ["nyelvhelyesseg", s.level, 10, null, c])}
          message={`${names[c]}: ${t.tips.notEnoughTargeted}`}
          dismissKey={`targeted-${c}-${s.level}`}
        />
      ))}
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.languageUse.targetedNone}</p>
        </Card>
      ) : (
        <TargetedRunner items={items} categoryNames={names} />
      )}
    </div>
  );
}
