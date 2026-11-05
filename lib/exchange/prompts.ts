import type { Level, SpeakingTask, WritingTask } from "@/lib/content/schema";
import type { ErrorCategory, RubricCriterion, SpeakingRubric, SpeakingRubricTask, WritingRubric } from "@/lib/exam/config";

/**
 * Prompt texts for grading and for the live examiner. The same grading text is
 * stored in every inbox file (`instructions`), copied by the "Prompt másolása"
 * button and followed by /javitas, so the three paths cannot drift apart.
 */

/** What the prompts need to know about the subject. */
export type PromptSubject = { id: string; name: string; language: boolean };

function levelName(level: Level, language: boolean): string {
  if (language) return level === "emelt" ? "emelt szint (B2)" : "középszint (A2–B1)";
  return level === "emelt" ? "emelt szint" : "középszint";
}

export type RubricRef = { id: string; file: string; taskNumber: number | null; criteria: RubricCriterion[]; rules: string[] };

export function writingRubricRef(rubric: WritingRubric, taskNumber: number, subjectId: string): RubricRef {
  const task = rubric.tasks.find((t) => t.taskNumber === taskNumber) ?? rubric.tasks[0]!;
  return {
    id: `${rubric.id}-task${task.taskNumber}`,
    file: `config/subjects/${subjectId}/writing-rubric-${rubric.level}.json`,
    taskNumber: task.taskNumber,
    criteria: task.criteria,
    rules: [...task.rules, ...rubric.generalRules],
  };
}

export function speakingRubricTask(rubric: SpeakingRubric, type: string): SpeakingRubricTask {
  return rubric.tasks.find((t) => t.types.includes(type)) ?? rubric.tasks[0]!;
}

export function speakingRubricRef(rubric: SpeakingRubric, type: string, subjectId: string): RubricRef {
  const task = speakingRubricTask(rubric, type);
  return {
    id: `${rubric.id}-${task.id}`,
    file: `config/subjects/${subjectId}/speaking-rubric-${rubric.level}.json`,
    taskNumber: task.partNumber,
    criteria: task.criteria,
    rules: [
      ...rubric.generalRules,
      ...rubric.overall.map((c) => `${c.name} (${c.max} pont) – ${c.description}`),
    ],
  };
}

function rubricText(ref: RubricRef): string {
  return ref.criteria
    .map((c) => {
      const bands = c.bands.map((b) => `    - ${b.points} pont: ${b.descriptor}`).join("\n");
      return `- ${c.id} – ${c.name} (max ${c.max} pont): ${c.description}${bands ? "\n" + bands : ""}`;
    })
    .join("\n");
}

function categoriesText(cats: ErrorCategory[]): string {
  return cats
    .filter((c) => c.group !== "comprehension")
    .map((c) => `${c.id} (${c.name})`)
    .join(", ");
}

function feedbackTemplate(submissionId: string, kind: "writing" | "speaking", ref: RubricRef, pointIds: string[], language: boolean) {
  const L = language ? "angol" : "";
  return JSON.stringify(
    {
      schemaVersion: 1,
      submissionId,
      kind,
      gradedBy: "claude-app",
      rubricId: ref.id,
      wordCount: 0,
      criteria: ref.criteria.map((c) => ({ id: c.id, score: 0, max: c.max, justification: "Indoklás magyarul, a sávleírásra hivatkozva." })),
      totalScore: 0,
      maxScore: ref.criteria.reduce((s, c) => s + c.max, 0),
      taskPoints: pointIds.map((id) => ({ id, status: "covered | partial | missing", comment: "Magyarul: kifejtette-e, mennyire." })),
      corrections: [
        {
          original: "pontosan a szövegből másolt hibás rész",
          corrected: language ? "a helyes angol forma" : "a helyes megoldás / megfogalmazás",
          category: "tense",
          explanation: "Magyarul: mi a hiba, mi a helyes megoldás, és miért (a szabály).",
        },
      ],
      priorities: ["1. legfontosabb fejlesztendő terület", "2. …", "3. …"],
      improvedVersion: language ? "A tanuló saját szövege egy szinttel jobb nyelvezettel (angolul)." : "A tanuló saját megoldása kijavítva és pontosabban megfogalmazva.",
      usefulPhrases: [{ en: language ? "angol kifejezés" : "szakkifejezés / fogalom", hu: language ? "magyar jelentés" : "rövid magyarázat", example: language ? "példamondat" : "példa a használatára" }],
      summary: "Rövid összegzés magyarul.",
    },
    null,
    2,
  );
}

const COMMON_RULES = (cats: ErrorCategory[], language: boolean) => `JAVÍTÁSI SZABÁLYOK
- Szigorú és következetes pontozás a rubrika alapján. Ne kerekíts felfelé; kétes esetben az alacsonyabb sávot add. Minden szempontnál indokolj, a sávleírásra hivatkozva.
- Minden hibát javíts: az "original" mezőbe karakterre pontosan a tanuló szövegéből másold a hibás részt (elég rövid legyen ahhoz, hogy egyértelműen megtalálható legyen), a "corrected" mezőbe ${language ? "a helyes angol formát" : "a helyes megoldást, adatot vagy megfogalmazást"}.
- Az "explanation" magyarul írja le, mi a hiba, mi lenne a helyes megoldás, és MIÉRT (${language ? "a nyelvtani szabály vagy szóhasználati ok" : "a szabály, tétel, összefüggés vagy tény"}). Ne csak annyit, hogy "helyesen: …".
- A "category" értéke ezek közül egy: ${categoriesText(cats)}.
- A "priorities" pontosan 3 elem: a 3 legfontosabb fejlesztendő terület, konkrét tanáccsal, magyarul.
- Az "improvedVersion" ${language ? "a tanuló SAJÁT szövege egy szinttel jobb nyelvezettel (angolul)" : "a tanuló SAJÁT megoldása kijavítva, a hiányzó lépésekkel és pontosabb megfogalmazással"} – ugyanazok a gondolatok, nem egy teljesen új szöveg.
- A "usefulPhrases" 5–10 ${language ? "hasznos angol kifejezés magyar jelentéssel" : "kulcsfogalom, szakkifejezés vagy képlet rövid magyarázattal"}, ami ehhez a feladathoz jól jött volna.
- A magyarázatok, indoklások és az összefoglaló magyarul${language ? ", a javított változatok angolul" : ""}.
- A "totalScore" a szempontpontok összege, a "maxScore" a maximumok összege.`;

export function writingGradingPrompt(args: {
  submissionId: string;
  level: Level;
  task: WritingTask;
  rubric: WritingRubric;
  text: string;
  wordCount: number;
  categories: ErrorCategory[];
  subject: PromptSubject;
  previous?: { text: string; score: number | null; maxScore: number | null } | null;
}): string {
  const ref = writingRubricRef(args.rubric, args.task.taskNumber, args.subject.id);
  const t = args.task;
  const language = args.subject.language;
  return `Te egy szigorú, tapasztalt ${args.subject.name.toLowerCase()} érettségi vizsgáztató vagy (Magyarország, ${levelName(args.level, language)}). Javítsd ki a tanuló írásbeli munkáját a hivatalos értékelési szempontok szerint.

FELADAT (${args.level === "emelt" ? "emelt" : "közép"}szint, ${t.taskNumber}. feladat, típus: ${t.type})
${t.situation}
${t.stimulus ? `\nKiinduló szöveg:\n${t.stimulus}\n` : ""}
${language ? "Irányítási szempontok" : "Részkérdések / szempontok"} (mindegyikre ki kell térni):
${t.points.map((p) => `- [${p.id}] ${p.text}`).join("\n")}
${t.wordLimit ? `Szóhatár: ${t.wordLimit.min}–${t.wordLimit.max} szó. ` : ""}${t.register ? `Hangnem: ${t.register}.` : ""}

ÉRTÉKELÉSI SZEMPONTOK (rubrika: ${ref.id})
${rubricText(ref)}
${ref.rules.length ? `\nKülön szabályok:\n${ref.rules.map((r) => `- ${r}`).join("\n")}` : ""}

${COMMON_RULES(args.categories, language)}
- A "taskPoints" minden ${language ? "irányítási pontot" : "részkérdést / szempontot"} tartalmazzon (id: ${t.points.map((p) => p.id).join(", ")}).
${args.previous ? `\nEZ EGY ÁTÍRT VÁLTOZAT. Az előző változat (${args.previous.score ?? "?"}/${args.previous.maxScore ?? "?"} pont):\n"""\n${args.previous.text}\n"""\nAz összefoglalóban írd le, miben javult és miben nem.\n` : ""}
A TANULÓ SZÖVEGE (${args.wordCount} szó a program számlálása szerint):
"""
${args.text}
"""

VÁLASZ FORMÁTUMA: kizárólag egyetlen JSON-objektum, ebben a szerkezetben (a példaértékeket cseréld le):
${feedbackTemplate(args.submissionId, "writing", ref, t.points.map((p) => p.id), language)}`;
}

export function speakingGradingPrompt(args: {
  submissionId: string;
  level: Level;
  task: SpeakingTask;
  rubric: SpeakingRubric;
  text: string;
  wordCount: number;
  transcriptSource: string | null;
  categories: ErrorCategory[];
  subject: PromptSubject;
}): string {
  const ref = speakingRubricRef(args.rubric, args.task.type, args.subject.id);
  const t = args.task;
  const language = args.subject.language;
  const goalIds = speakingGoalIds(t);
  return `Te egy szigorú, tapasztalt ${args.subject.name.toLowerCase()} érettségi vizsgáztató vagy (Magyarország, ${levelName(args.level, language)}, szóbeli vizsga). Értékeld a tanuló szóbeli feleletének átiratát.

FELADAT (${t.partNumber}. vizsgarész, típus: ${t.type}, témakör: ${t.topic})
${speakingTaskText(t)}

FONTOS: ez ${args.transcriptSource === "app-asr" ? "a böngésző beszédfelismerőjének automatikus átirata – a központozás, kis/nagybetű és az esetleges félrehallott szavak nem a tanuló hibái, ezeket ne pontozd le; csak a valódi nyelvi hibákat javítsd" : "egy beszélgetés átirata"}. A vizsgáztató megszólalásait ne értékeld.

ÉRTÉKELÉSI SZEMPONTOK (rubrika: ${ref.id})
${rubricText(ref)}
${ref.rules.length ? `\nKülön szabályok:\n${ref.rules.map((r) => `- ${r}`).join("\n")}` : ""}

${COMMON_RULES(args.categories, language)}
- A "taskPoints" a feladat céljait/szempontjait értékelje (id: ${goalIds.join(", ")}).
- Az "improvedVersion" a tanuló felelete egy szinttel jobb${language ? ", természetes beszélt angolsággal" : ": a hiányzó tartalmi elemekkel kiegészítve, szakszerűbben megfogalmazva"}.${t.keyPoints.length ? `\n- Egy teljes felelet tartalmazza: ${t.keyPoints.map((k) => `„${k}”`).join("; ")} – ezek hiánya a feladatteljesítés pontját csökkenti.` : ""}

AZ ÁTIRAT (${args.wordCount} szó):
"""
${args.text}
"""

VÁLASZ FORMÁTUMA: kizárólag egyetlen JSON-objektum, ebben a szerkezetben (a példaértékeket cseréld le):
${feedbackTemplate(args.submissionId, "speaking", ref, goalIds, language)}`;
}

export function speakingGoalIds(t: SpeakingTask): string[] {
  if (t.type === "situation" && t.situation) return t.situation.goals.map((_, i) => `g${i + 1}`);
  if (t.type === "debate") return ["position", "arguments", "counterarguments"];
  if (t.type === "picture") return ["description", "comparison", "opinion"];
  if (t.type === "presentation") return t.prompts.map((_, i) => `p${i + 1}`);
  return ["answers", "detail"];
}

export function speakingTaskText(t: SpeakingTask): string {
  const lines: string[] = [t.title];
  if (t.questions.length) lines.push("Kérdések:", ...t.questions.map((q) => `- ${q.q}`));
  if (t.situation) {
    lines.push(
      `Helyzet: ${t.situation.context}`,
      `A vizsgázó szerepe: ${t.situation.candidateRole}`,
      `A vizsgáztató szerepe: ${t.situation.examinerRole}`,
      "Célok:",
      ...t.situation.goals.map((g, i) => `- [g${i + 1}] ${g}`),
    );
  }
  if (t.scenes.length) lines.push("Képek (leírás):", ...t.scenes.map((s, i) => `- ${i + 1}. kép: ${s.description}`));
  if (t.prompts.length) lines.push("Szempontok:", ...t.prompts.map((p, i) => `- [p${i + 1}] ${p}`));
  if (t.debate) {
    lines.push(
      `Vitatétel: "${t.debate.statement}"`,
      `A vizsgázó kiosztott álláspontja: ${t.debate.candidatePosition === "for" ? "MELLETTE érvel" : "ELLENE érvel"}`,
    );
  }
  if (t.sources.length) lines.push("Források:", ...t.sources.map((s, i) => `- ${s.title ? `${s.title}: ` : `${i + 1}. forrás: `}${s.text}`));
  if (t.followUpQuestions.length) lines.push("További kérdések:", ...t.followUpQuestions.map((q) => `- ${q}`));
  return lines.join("\n");
}

/** Prompt for a live spoken exam with the Claude app's voice mode. */
export function examinerPrompt(args: { level: Level; task: SpeakingTask; topicName: string; oralPartName: string; subject: PromptSubject }): string {
  const t = args.task;
  if (!args.subject.language) return examinerPromptHu(args);
  const debateRules = t.debate
    ? `
VITA SZABÁLYAI (emelt szint)
- A tétel: "${t.debate.statement}"
- A vizsgázó kiosztott álláspontja: ${t.debate.candidatePosition === "for" ? "a tétel MELLETT érvel" : "a tétel ELLEN érvel"}. Ezt az álláspontot a vizsgázó NEM változtathatja meg, és te sem engedheted: ha elbizonytalanodik, emlékeztesd, hogy a kiosztott oldalt kell képviselnie.
- Te végig az ellenkező álláspontot képviseled, és udvariasan, de határozottan hozz ellenérveket, például: ${t.debate.examinerArguments.join("; ")}.
- Kérdezz rá az érveire, kérj példát, és reagálj arra, amit mond. Ne add meg magad túl hamar.`
    : "";
  return `You are an examiner at the Hungarian school-leaving exam in English (angol érettségi, ${args.level === "emelt" ? "advanced level (emelt szint, B2)" : "intermediate level (középszint, A2–B1)"}), oral exam. We will do a spoken practice exam in voice mode. Stay in the examiner role for the whole conversation and speak only English (unless I ask for help in Hungarian).

Exam part: ${args.oralPartName}
Topic: ${args.topicName}
Task type: ${t.type}

TASK
${speakingTaskText(t)}
${t.situation?.examinerOpening ? `\nStart with: "${t.situation.examinerOpening}"` : ""}
${debateRules}

HOW TO BEHAVE
- Speak like a friendly but neutral examiner: short turns, natural speed, ${args.level === "emelt" ? "B2-level language" : "simple, clear language (A2–B1)"}.
- Let me do most of the talking. Ask one question at a time and follow up on what I say.
- Do not correct my mistakes during the conversation and do not give feedback until I say "vége" or "end of exam".
- Keep the exam part to about ${Math.round(t.speakingSeconds / 60)}–${Math.round(t.speakingSeconds / 60) + 2} minutes, then close it the way an examiner would.
- When I say "vége", write out the full transcript of the conversation in this format, with nothing else:
EXAMINER: ...
CANDIDATE: ...
I will paste this transcript into my practice app for grading.`;
}

/** Live oral practice prompt for a non-language subject (the whole exam is in Hungarian). */
function examinerPromptHu(args: { level: Level; task: SpeakingTask; topicName: string; oralPartName: string; subject: PromptSubject }): string {
  const t = args.task;
  return `Te a magyar érettségi ${args.subject.name.toLowerCase()} szóbeli vizsgájának vizsgáztatója vagy (${args.level === "emelt" ? "emelt szint" : "középszint"}). Hangmódban gyakorló szóbeli vizsgát tartunk. Maradj végig a vizsgáztató szerepében, magyarul beszélj.

Vizsgarész: ${args.oralPartName}
Témakör: ${args.topicName}
Feladattípus: ${t.type}

TÉTEL / FELADAT
${speakingTaskText(t)}
${t.keyPoints.length ? `\nEgy teljes felelet tartalmazza (ezt ne áruld el, csak figyeld): ${t.keyPoints.join("; ")}` : ""}

HOGYAN VISELKEDJ
- Előbb hagyd, hogy a vizsgázó összefüggően kifejtse a tételt (ne szakítsd félbe), utána tegyél fel 2–4 rávezető vagy elmélyítő kérdést, egyszerre egyet.
- Ha valami hiányzik vagy pontatlan, kérdezz rá úgy, ahogy egy vizsgáztató tenné; ne javíts és ne adj visszajelzést, amíg nem mondom, hogy „vége”.
- A felelet kb. ${Math.round(t.speakingSeconds / 60)}–${Math.round(t.speakingSeconds / 60) + 2} percig tartson, utána zárd le, ahogy a vizsgán.
- Amikor azt mondom, hogy „vége”, írd ki a teljes beszélgetés átiratát ebben a formában, semmi mást:
EXAMINER: ...
CANDIDATE: ...
Ezt az átiratot a gyakorló appba másolom javításra.`;
}
