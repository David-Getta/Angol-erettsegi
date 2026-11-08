import type { Metadata } from "next";
import { loadCommands } from "@/lib/commands/config";
import { examConfig, levelStructure, subjects } from "@/lib/exam/config";
import { officialFolders } from "@/lib/official";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { PageHeader } from "@/components/ui";
import { CommandCard, type BuilderValues } from "./CommandCard";

export const metadata: Metadata = { title: t.commands.title };

export default function CommandsPage() {
  const cfg = loadCommands();
  const s = getSettings();
  const values: BuilderValues = {
    subjects: subjects().map((x) => ({ value: x.id, label: `${x.name} (${x.id})` })),
    defaultSubject: s.subject,
    sections: [
      ...levelStructure(s.level).parts.map((p) => ({ value: p.slug, label: `${p.name} (${p.slug})` })),
      ...cfg.sectionArgs.filter((a) => a.section !== "part").map((a) => ({ value: a.value, label: a.label })),
    ],
    levels: [
      { value: "kozep", label: t.level.kozep },
      { value: "emelt", label: t.level.emelt },
    ],
    topics: examConfig.topics().topics.map((x) => ({ value: x.id, label: `${x.name} (${x.id})` })),
    categories: examConfig
      .errorCategories()
      .categories.filter((c) => c.group !== "comprehension")
      .map((c) => ({ value: c.id, label: `${c.name} (${c.id})` })),
    officialFolders: officialFolders().map((f) => ({ value: f.name, label: f.name })),
  };
  return (
    <div>
      <PageHeader title={t.commands.title} intro={t.commands.intro} />
      <div className="grid gap-5">
        {cfg.commands.map((c) => (
          <CommandCard key={c.name} def={c} values={values} defaultLevel={s.level} />
        ))}
      </div>
    </div>
  );
}
