import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activity, submissions, tasks } from "@/lib/db/schema";
import type { Level } from "@/lib/content/schema";
import { examConfig } from "@/lib/exam/config";
import { categoryStats } from "@/lib/errors/log";
import { countBankItems, pickMistakes } from "@/lib/targeted";
import { dueInfo } from "@/lib/vocab/cards";
import { lessonCategories } from "@/lib/lessons";
import { usedTaskIds } from "@/lib/tasks";
import { localDay } from "@/lib/activity";
import type { PartEstimate } from "@/lib/dashboard";

export type PlanItem = {
  key: string;
  title: string;
  reason: string;
  href: string;
  section: string;
  minutes: number;
  done: boolean;
};

const SECTION_HREF: Record<string, string> = {
  reading: "/olvasas",
  "language-use": "/nyelvhelyesseg",
  listening: "/hallas",
  writing: "/iras",
  speaking: "/szobeli",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stable (per day) pick of an unsolved, non-reserved task of the section. */
function pickTask(section: string, level: Level, day: string): { id: string; title: string } | null {
  const used = usedTaskIds();
  const rows = getDb()
    .select({ id: tasks.id, title: tasks.title, reserved: tasks.reservedFor })
    .from(tasks)
    .where(and(eq(tasks.section, section), eq(tasks.level, level), eq(tasks.active, true)))
    .all();
  const fresh = rows.filter((r) => !r.reserved && !used.has(r.id));
  const pool = fresh.length ? fresh : rows.filter((r) => !r.reserved);
  if (!pool.length) return null;
  return [...pool].sort((a, b) => hash(day + a.id) - hash(day + b.id))[0]!;
}

/**
 * Today's plan: 3–5 concrete tasks from the weak parts, the due vocabulary
 * cards and the error log. Stable during the day; an item is "done" when the
 * section has practice time logged today.
 */
export function todayPlan(level: Level, estimates: PartEstimate[], hasDiagnostic: boolean): PlanItem[] {
  const db = getDb();
  const day = localDay();
  const { minTasks, maxTasks } = examConfig.app().dailyPlan;
  const todaySections = new Set(db.select({ s: activity.section }).from(activity).where(eq(activity.day, day)).all().map((r) => r.s));
  const items: PlanItem[] = [];

  if (!hasDiagnostic) {
    items.push({ key: "diag", title: "Szintfelmérő kitöltése", reason: "Ebből áll össze a személyre szabott terv.", href: "/szintfelmero", section: "diagnostic", minutes: 35, done: false });
  }

  const due = dueInfo();
  if (due.total > 0) {
    items.push({
      key: "vocab",
      title: `Szókártyák ismétlése (${due.total})`,
      reason: `${due.dueReviews} esedékes ismétlés, ${due.newAllowed} új kártya.`,
      href: "/szokincs/ismetles",
      section: "vocabulary",
      minutes: Math.max(5, Math.round(due.total * 0.25)),
      done: false,
    });
  }

  // language-use items answered wrong earlier and due again
  const { review } = examConfig.app();
  const mistakes = pickMistakes(level, review.itemsPerRound, review.minAgeHours);
  if (mistakes.due.length >= review.planMinDue) {
    items.push({
      key: "mistakes",
      title: `Hibáim újrapróbálása (${mistakes.due.length})`,
      reason: "Korábban elrontott mondatok – amíg nem sikerül, újra előkerülnek.",
      href: "/hibanaplo/ujraproba",
      section: "language-use",
      minutes: Math.max(5, Math.round(mistakes.due.length * 0.7)),
      done: false,
    });
  }

  // weakest written parts relative to the target (no data counts as weak)
  const written = estimates.filter((e) => e.part !== "speaking" && e.part !== "writing");
  const ranked = [...written].sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
  for (const e of ranked.slice(0, 2)) {
    const tk = pickTask(e.part, level, day);
    if (!tk) continue;
    items.push({
      key: `part-${e.part}`,
      title: `${e.name}: ${tk.title}`,
      reason: e.pct === null ? "Ebből a részből még nincs eredményed." : `Becslés: ${Math.round(e.pct)}% – az egyik leggyengébb részed.`,
      href: `${SECTION_HREF[e.part]}/${tk.id}`,
      section: e.part,
      minutes: 15,
      done: todaySections.has(e.part),
    });
  }

  // most frequent error category that is not improving yet
  const top = categoryStats().find((c) => !c.improving && c.last30 > 0 && countBankItems(c.category, level) >= 3);
  if (top) {
    items.push({
      key: `cat-${top.category}`,
      title: `Célzott gyakorlás: ${top.name}`,
      reason: `${top.last30} hiba az utolsó 30 napban.`,
      href: `/nyelvhelyesseg/celzott?k=${top.category}`,
      section: "language-use",
      minutes: 10,
      done: todaySections.has("language-use") && items.every((i) => i.section !== "language-use"),
    });
  }

  // the rule behind the most frequent mistake (Szabálytár), once a day
  const topAny = categoryStats().find((c) => c.last30 >= 3);
  if (topAny && lessonCategories().has(topAny.category) && !todaySections.has("grammar")) {
    items.push({
      key: `lesson-${topAny.category}`,
      title: `Szabály átismétlése: ${topAny.name}`,
      reason: `${topAny.last30} hiba az utolsó 30 napban – olvasd át a szabályt és a tipikus hibákat, és oldd meg a mini-gyakorlást.`,
      href: `/szabalytar/${topAny.category}`,
      section: "grammar",
      minutes: 8,
      done: false,
    });
  }

  // writing at least weekly
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const recentWriting = db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.kind, "writing"), gte(submissions.createdAt, weekAgo))).all();
  if (recentWriting.length === 0) {
    const tk = pickTask("writing", level, day);
    if (tk) items.push({ key: "writing", title: `Íráskészség: ${tk.title}`, reason: "Az elmúlt héten nem írtál – az írás hozza a legtöbb pontot.", href: `/iras/${tk.id}`, section: "writing", minutes: 40, done: todaySections.has("writing") });
  }
  const recentSpeaking = db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.kind, "speaking"), gte(submissions.createdAt, weekAgo))).all();
  if (recentSpeaking.length === 0 && items.length < maxTasks) {
    const tk = pickTask("speaking", level, day);
    if (tk) items.push({ key: "speaking", title: `Szóbeli: ${tk.title}`, reason: "Heti egy szóbeli gyakorlás ajánlott.", href: `/szobeli/${tk.id}`, section: "speaking", minutes: 15, done: todaySections.has("speaking") });
  }

  // fill up to the minimum with the remaining written parts
  for (const e of ranked.slice(2)) {
    if (items.length >= minTasks) break;
    const tk = pickTask(e.part, level, day);
    if (tk) items.push({ key: `part-${e.part}`, title: `${e.name}: ${tk.title}`, reason: "Kiegészítő gyakorlás.", href: `${SECTION_HREF[e.part]}/${tk.id}`, section: e.part, minutes: 15, done: todaySections.has(e.part) });
  }
  return items.slice(0, maxTasks);
}
