import type { Level } from "@/lib/content/schema";
import { examConfig, levelStructure } from "@/lib/exam/config";
import type { NavGroup } from "@/components/AppNav";
import { t } from "@/lib/i18n/hu";

const KIND_ICON = { objective: "📝", written: "✍", oral: "🗣" } as const;

/** Navigation of the current subject: its exam parts (from structure.json) plus the shared tools. */
export function navGroups(level: Level): NavGroup[] {
  const st = levelStructure(level);
  const subject = examConfig.subject();
  const parts = [...st.parts]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ href: `/${p.slug}`, label: p.name, icon: p.icon ?? (p.features.audio ? "🎧" : KIND_ICON[p.kind]) }));
  return [
    {
      items: [
        { href: "/kezdolap", label: t.nav.dashboard, icon: "⌂" },
        { href: "/szintfelmero", label: t.nav.diagnostic, icon: "◎" },
      ],
    },
    {
      title: t.nav.groupPractice,
      items: [
        ...parts,
        { href: "/szokincs", label: subject.language ? t.nav.vocabulary : t.nav.concepts, icon: "🗂" },
        { href: "/hibanaplo", label: t.nav.errorLog, icon: "⚑" },
        { href: "/utmutatok", label: t.nav.guides, icon: "📘" },
        { href: "/szabalytar", label: t.nav.lessons, icon: "§" },
        { href: "/kifejezesek", label: subject.language ? t.nav.phrases : t.nav.keyTerms, icon: "❝" },
        { href: "/temakorok", label: t.nav.topics, icon: "◇" },
      ],
    },
    {
      title: t.nav.groupExam,
      items: [
        { href: "/probaerettsegi", label: t.nav.mock, icon: "⏱" },
        { href: "/vizsga", label: t.nav.examInfo, icon: "ⓘ" },
        { href: "/hivatalos", label: t.nav.official, icon: "🏛" },
        { href: "/statisztika", label: t.nav.stats, icon: "📈" },
      ],
    },
    {
      title: t.nav.groupTools,
      items: [
        { href: "/parancsok", label: t.nav.commands, icon: "⌘" },
        { href: "/beallitasok", label: t.nav.settings, icon: "⚙" },
      ],
    },
  ];
}
