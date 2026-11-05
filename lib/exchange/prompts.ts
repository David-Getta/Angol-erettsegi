import type { Level, SpeakingTask, WritingTask } from "@/lib/content/schema";
import type { ErrorCategory, RubricCriterion, SpeakingRubric, SpeakingRubricTask, WritingRubric } from "@/lib/exam/config";

/**
 * Prompt texts for grading and for the live examiner. The same grading text is
 * stored in every inbox file (`instructions`), copied by the "Prompt másolása"
 * button and followed by /javitas, so the three paths cannot drift apart.
 */

const LEVEL_NAME: Record<Level, string> = { kozep: "középszint (A2–B1)", emelt: "emelt szint (B2)" };

export type RubricRef = { id: string; file: string; taskNumber: number | null; criteria: RubricCriterion[]; rules: string[] };

export function writingRubricRef(rubric: WritingRubric, taskNumber: number): RubricRef {
  const task = rubric.tasks.find((t) => t.taskNumber === taskNumber) ?? rubric.tasks[0]!;
  return {
    id: `${rubric.id}-task${task.taskNumber}`,
    file: `config/exam/writing-rubric-${rubric.level}.json`,
    taskNumber: task.taskNumber,
    criteria: task.criteria,
    rules: [...task.rules, ...rubric.generalRules],
  };
}

export function speakingRubricTask(rubric: SpeakingRubric, type: string): SpeakingRubricTask {
  return rubric.tasks.find((t) => t.types.includes(type)) ?? rubric.tasks[0]!;
}

export function speakingRubricRef(rubric: SpeakingRubric, type: string): RubricRef {
  const task = speakingRubricTask(rubric, type);
  return {
    id: `${rubric.id}-${task.id}`,
    file: `config/exam/speaking-rubric-${rubric.level}.json`,
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

function feedbackTemplate(submissionId: string, kind: "writing" | "speaking", ref: RubricRef, pointIds: string[]) {
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
          corrected: "a helyes angol forma",
          category: "tense",
          explanation: "Magyarul: mi a hiba, mi a helyes megoldás, és miért (a szabály).",
        },
      ],
      priorities: ["1. legfontosabb fejlesztendő terület", "2. …", "3. …"],
      improvedVersion: "A tanuló saját szövege egy szinttel jobb nyelvezettel (angolul).",
      usefulPhrases: [{ en: "angol kifejezés", hu: "magyar jelentés", example: "példamondat" }],
      summary: "Rövid összegzés magyarul.",
    },
    null,
    2,
  );
}

const COMMON_RULES = (cats: ErrorCategory[]) => `JAVÍTÁSI SZABÁLYOK
- Szigorú és következetes pontozás a rubrika alapján. Ne kerekíts felfelé; kétes esetben az alacsonyabb sávot add. Minden szempontnál indokolj, a sávleírásra hivatkozva.
- Minden hibát javíts: az "original" mezőbe karakterre pontosan a tanuló szövegéből másold a hibás részt (elég rövid legyen ahhoz, hogy egyértelműen megtalálható legyen), a "corrected" mezőbe a helyes angol formát.
- Az "explanation" magyarul írja le, mi a hiba, mi lenne a helyes megoldás, és MIÉRT (a nyelvtani szabály vagy szóhasználati ok). Ne csak annyit, hogy "helyesen: …".
- A "category" értéke ezek közül egy: ${categoriesText(cats)}.
- A "priorities" pontosan 3 elem: a 3 legfontosabb fejlesztendő terület, konkrét tanáccsal, magyarul.
- Az "improvedVersion" a tanuló SAJÁT szövege egy szinttel jobb nyelvezettel (angolul) – ugyanazok a gondolatok, nem egy teljesen új szöveg.
- A "usefulPhrases" 5–10 hasznos angol kifejezés magyar jelentéssel, ami ehhez a feladathoz jól jött volna.
- A magyarázatok, indoklások és az összefoglaló magyarul, a javított változatok angolul.
- A "totalScore" a szempontpontok összege, a "maxScore" a maximumok összege.`;

export function writingGradingPrompt(args: {
  submissionId: string;
  level: Level;
  task: WritingTask;
  rubric: WritingRubric;
  text: string;
  wordCount: number;
  categories: ErrorCategory[];
  previous?: { text: string; score: number | null; maxScore: number | null } | null;
}): string {
  const ref = writingRubricRef(args.rubric, args.task.taskNumber);
  const t = args.task;
  return `Te egy szigorú, tapasztalt angol érettségi vizsgáztató vagy (Magyarország, ${LEVEL_NAME[args.level]}). Javítsd ki a tanuló írásbeli munkáját a hivatalos értékelési szempontok szerint.

FELADAT (${args.level === "emelt" ? "emelt" : "közép"}szint, ${t.taskNumber}. írásfeladat, típus: ${t.type})
${t.situation}
${t.stimulus ? `\nKiinduló szöveg:\n${t.stimulus}\n` : ""}
Irányítási szempontok (mindegyikre ki kell térni):
${t.points.map((p) => `- [${p.id}] ${p.text}`).join("\n")}
Szóhatár: ${t.wordLimit.min}–${t.wordLimit.max} szó. Hangnem: ${t.register}.

ÉRTÉKELÉSI SZEMPONTOK (rubrika: ${ref.id})
${rubricText(ref)}
${ref.rules.length ? `\nKülön szabályok:\n${ref.rules.map((r) => `- ${r}`).join("\n")}` : ""}

${COMMON_RULES(args.categories)}
- A "taskPoints" minden irányítási pontot tartalmazzon (id: ${t.points.map((p) => p.id).join(", ")}).
${args.previous ? `\nEZ EGY ÁTÍRT VÁLTOZAT. Az előző változat (${args.previous.score ?? "?"}/${args.previous.maxScore ?? "?"} pont):\n"""\n${args.previous.text}\n"""\nAz összefoglalóban írd le, miben javult és miben nem.\n` : ""}
A TANULÓ SZÖVEGE (${args.wordCount} szó a program számlálása szerint):
"""
${args.text}
"""

VÁLASZ FORMÁTUMA: kizárólag egyetlen JSON-objektum, ebben a szerkezetben (a példaértékeket cseréld le):
${feedbackTemplate(args.submissionId, "writing", ref, t.points.map((p) => p.id))}`;
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
}): string {
  const ref = speakingRubricRef(args.rubric, args.task.type);
  const t = args.task;
  const goalIds = speakingGoalIds(t);
  return `Te egy szigorú, tapasztalt angol érettségi vizsgáztató vagy (Magyarország, ${LEVEL_NAME[args.level]}, szóbeli vizsga). Értékeld a tanuló szóbeli válaszának átiratát.

FELADAT (${t.partNumber}. vizsgarész, típus: ${t.type}, témakör: ${t.topic})
${speakingTaskText(t)}

FONTOS: ez ${args.transcriptSource === "app-asr" ? "a böngésző beszédfelismerőjének automatikus átirata – a központozás, kis/nagybetű és az esetleges félrehallott szavak nem a tanuló hibái, ezeket ne pontozd le; csak a valódi nyelvi hibákat javítsd" : "egy beszélgetés átirata"}. A vizsgáztató megszólalásait ne értékeld.

ÉRTÉKELÉSI SZEMPONTOK (rubrika: ${ref.id})
${rubricText(ref)}
${ref.rules.length ? `\nKülön szabályok:\n${ref.rules.map((r) => `- ${r}`).join("\n")}` : ""}

${COMMON_RULES(args.categories)}
- A "taskPoints" a feladat céljait/szempontjait értékelje (id: ${goalIds.join(", ")}).
- Az "improvedVersion" a tanuló válasza egy szinttel jobb, természetes beszélt angolsággal.

AZ ÁTIRAT (${args.wordCount} szó):
"""
${args.text}
"""

VÁLASZ FORMÁTUMA: kizárólag egyetlen JSON-objektum, ebben a szerkezetben (a példaértékeket cseréld le):
${feedbackTemplate(args.submissionId, "speaking", ref, goalIds)}`;
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
  if (t.followUpQuestions.length) lines.push("További kérdések:", ...t.followUpQuestions.map((q) => `- ${q}`));
  return lines.join("\n");
}

/** Prompt for a live spoken exam with the Claude app's voice mode. */
export function examinerPrompt(args: { level: Level; task: SpeakingTask; topicName: string; oralPartName: string }): string {
  const t = args.task;
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
