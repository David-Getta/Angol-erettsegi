import path from "node:path";
import { z } from "zod";
import { paths } from "@/lib/paths";
import { examConfig, type TaskTypes } from "@/lib/exam/config";
import { CORRECT_MARKER, normalizeAnswer } from "@/lib/scoring/check";
import { listContentFiles, readRaw, SECTION_FOLDERS } from "./load";
import {
  ContentSchema,
  type Content,
  type Item,
  type GrammarLesson,
  type ObjectiveTask,
  type SpeakingTask,
  type VocabDeck,
  type WritingTask,
} from "./schema";
import { passageText, scriptText, wordCount, normalizeForSearch, gapIdsInPassage } from "./text";

export type Issue = { file: string; severity: "error" | "warning"; message: string };

export type ValidationReport = {
  files: number;
  valid: number;
  errors: Issue[];
  warnings: Issue[];
  byKind: Record<string, number>;
};

type Ctx = {
  file: string;
  issues: Issue[];
  topics: Set<string>;
  categories: Map<string, string>; // id -> group
  taskTypes: TaskTypes;
};

function err(ctx: Ctx, message: string) {
  ctx.issues.push({ file: ctx.file, severity: "error", message });
}
function warn(ctx: Ctx, message: string) {
  ctx.issues.push({ file: ctx.file, severity: "warning", message });
}

export function validateContentDir(dir: string = paths.content): ValidationReport {
  const topics = new Set(examConfig.topics().topics.map((t) => t.id));
  const categories = new Map(examConfig.errorCategories().categories.map((c) => [c.id, c.group] as const));
  const taskTypes = examConfig.taskTypes();
  const issues: Issue[] = [];
  const ids = new Map<string, string>();
  const byKind: Record<string, number> = {};
  const files = listContentFiles(dir);
  let valid = 0;
  const passages = new Map<string, string>(); // normalized first 200 chars -> file

  for (const file of files) {
    const raw = readRaw(file);
    const ctx: Ctx = { file: raw.relPath, issues, topics, categories, taskTypes };
    let json: unknown;
    try {
      json = JSON.parse(raw.text);
    } catch (e) {
      err(ctx, `Hibás JSON: ${(e as Error).message}`);
      continue;
    }
    const parsed = ContentSchema.safeParse(json);
    if (!parsed.success) {
      for (const line of z.prettifyError(parsed.error).split("\n")) if (line.trim()) err(ctx, `Séma: ${line.trim()}`);
      continue;
    }
    const c = parsed.data;
    const before = issues.filter((i) => i.severity === "error").length;

    // id uniqueness and file placement
    const prev = ids.get(c.id);
    if (prev) err(ctx, `Duplikált azonosító "${c.id}" (már szerepel: ${prev}).`);
    ids.set(c.id, raw.relPath);
    checkPlacement(ctx, dir, file, c);
    checkCommon(ctx, c);

    if (c.section === "reading" || c.section === "language-use" || c.section === "listening") {
      checkObjective(ctx, c);
      const key = normalizeForSearch(c.section === "listening" ? scriptText(c) : passageText(c)).slice(0, 200);
      if (key.length > 50) {
        const dup = passages.get(key);
        if (dup) warn(ctx, `A szöveg eleje megegyezik ezzel: ${dup} – ne ismétlődjenek a szövegek.`);
        passages.set(key, raw.relPath);
      }
    } else if (c.section === "writing") checkWriting(ctx, c);
    else if (c.section === "speaking") checkSpeaking(ctx, c);
    else if (c.section === "vocabulary") checkVocab(ctx, c);
    else if (c.section === "grammar") checkLesson(ctx, c);

    const kind = `${c.section}/${c.level}`;
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (issues.filter((i) => i.severity === "error").length === before) valid++;
  }

  return {
    files: files.length,
    valid,
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
    byKind,
  };
}

function checkPlacement(ctx: Ctx, dir: string, file: string, c: Content) {
  const relParts = path.relative(dir, file).split(path.sep);
  const expectedFolder = SECTION_FOLDERS[c.section];
  if (relParts.length !== 3 || relParts[0] !== expectedFolder || relParts[1] !== c.level) {
    err(ctx, `Rossz helyen van: content/${expectedFolder}/${c.level}/${c.id}.json kellene.`);
  }
  if (path.basename(file, ".json") !== c.id) err(ctx, `A fájlnév (${path.basename(file)}) nem egyezik az id-vel (${c.id}).`);
}

function checkCommon(ctx: Ctx, c: Content) {
  if (c.section !== "grammar" && !ctx.topics.has(c.topic)) err(ctx, `Ismeretlen témakör: "${c.topic}" (lásd config/exam/topics.json).`);
  if (c.source === "official" && !c.official) err(ctx, `Hivatalos feladatnál kötelező az "official" mező (év, időszak, szint).`);
  if (c.source === "generated" && c.official) err(ctx, `Generált feladat nem kaphat "official" mezőt.`);
  if (c.source === "official" && c.official && c.official.level !== c.level) err(ctx, `Az official.level nem egyezik a level mezővel.`);
  if (c.section !== "vocabulary" && c.section !== "grammar") {
    const types = ctx.taskTypes[c.section as keyof Omit<TaskTypes, "meta">];
    const t = types.find((x) => x.id === c.type);
    if (!t) err(ctx, `Ismeretlen feladattípus a(z) ${c.section} részben: "${c.type}" (lásd config/exam/task-types.json).`);
    else if (!t.levels.includes(c.level)) warn(ctx, `A(z) "${c.type}" típus a hivatalos leírás szerint nem jellemző ezen a szinten (${c.level}).`);
  }
}

function itemLabel(item: Item) {
  return item.id === "0" ? "a példa (0)" : `a(z) ${item.id}. item`;
}

function checkObjective(ctx: Ctx, t: ObjectiveTask) {
  const typeDef = ctx.taskTypes[t.section].find((x) => x.id === t.type);
  const all = [t.example, ...t.items];

  // ids: example is 0, items 1..n in order
  if (t.example.id !== "0") err(ctx, `A példa azonosítója "0" legyen.`);
  t.items.forEach((it, i) => {
    if (it.id !== String(i + 1)) err(ctx, `Az itemek számozása 1-től folyamatos legyen (a(z) ${i + 1}. helyen "${it.id}" áll).`);
  });

  if (t.section === "listening") {
    if (!t.listening) err(ctx, `Hallás feladatnál kötelező a "listening" mező (beszélők, leirat).`);
    else {
      const sp = new Set(t.listening.speakers.map((s) => s.id));
      t.listening.script.forEach((l, i) => {
        if (!sp.has(l.speaker)) err(ctx, `A leirat ${i + 1}. sorában ismeretlen beszélő: "${l.speaker}".`);
      });
    }
  } else if (!t.passage) {
    if (all.some((it) => !it.prompt)) err(ctx, `Szöveg ("passage") nélkül minden itemnek kell "prompt".`);
  }

  // gaps in passage
  const gapIds = t.passage ? gapIdsInPassage(t.passage) : [];
  const dupGaps = gapIds.filter((g, i) => gapIds.indexOf(g) !== i);
  if (dupGaps.length) err(ctx, `Többször szereplő hely(ek) a szövegben: ${[...new Set(dupGaps)].join(", ")}.`);
  const itemIds = new Set(all.map((i) => i.id));
  for (const g of gapIds) if (!itemIds.has(g)) err(ctx, `A szövegben lévő [[${g}]] helyhez nincs item.`);
  if (gapIds.length > 0) {
    for (const it of all) {
      if (!gapIds.includes(it.id) && !it.prompt) err(ctx, `${itemLabel(it)} nem szerepel a szövegben ([[${it.id}]]) és nincs "prompt"-ja.`);
    }
  } else if (t.passage && all.some((it) => !it.prompt)) {
    err(ctx, `Van prompt nélküli item, de a szövegben nincs [[n]] hely.`);
  }

  const source = t.section === "listening" ? scriptText(t) : passageText(t);
  const sourceNorm = normalizeForSearch(source);
  const bankKeys = new Set((t.options ?? []).map((o) => o.key));
  if (t.options) {
    const keys = t.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) err(ctx, `Duplikált kulcs a közös opciók között.`);
  }
  const usedMatchKeys: string[] = [];
  const kinds = new Set<string>();

  for (const it of all) {
    kinds.add(it.kind);
    const cat = ctx.categories.get(it.category);
    if (!cat) err(ctx, `${itemLabel(it)}: ismeretlen kategória "${it.category}".`);
    else if (t.section === "language-use" && cat === "comprehension") {
      err(ctx, `${itemLabel(it)}: nyelvhelyesség-itemnél nyelvtani/szókincs kategória kell, nem "${it.category}".`);
    }
    if (it.explanation.trim().length < 15) warn(ctx, `${itemLabel(it)}: túl rövid a magyarázat – írd le a helyes választ és az okát.`);

    if (t.section !== "language-use") {
      if (!it.evidence) err(ctx, `${itemLabel(it)}: hiányzik az "evidence" (a szövegrész, ahol a válasz található).`);
      else if (!sourceNorm.includes(normalizeForSearch(it.evidence))) {
        err(ctx, `${itemLabel(it)}: az "evidence" szó szerint nem található a ${t.section === "listening" ? "leiratban" : "szövegben"}: "${it.evidence.slice(0, 60)}…"`);
      }
    }

    if (it.kind === "choice") {
      const keys = it.options.map((o) => o.key);
      if (new Set(keys).size !== keys.length) err(ctx, `${itemLabel(it)}: duplikált opciókulcs.`);
      if (!keys.includes(it.answer)) err(ctx, `${itemLabel(it)}: a megoldás ("${it.answer}") nincs az opciók között.`);
      const texts = it.options.map((o) => normalizeAnswer(o.text));
      if (new Set(texts).size !== texts.length) err(ctx, `${itemLabel(it)}: két opció szövege azonos.`);
      const wrong = keys.filter((k) => k !== it.answer);
      if (it.wrongOptions) {
        for (const k of Object.keys(it.wrongOptions)) {
          if (!wrong.includes(k)) err(ctx, `${itemLabel(it)}: a wrongOptions "${k}" kulcsa nem rossz opció.`);
        }
      }
      if (t.section !== "language-use" && it.id !== "0") {
        const missing = wrong.filter((k) => !it.wrongOptions?.[k]);
        if (missing.length) err(ctx, `${itemLabel(it)}: hiányzik a magyarázat, miért rossz: ${missing.join(", ")}.`);
      }
    } else if (it.kind === "match") {
      if (!t.options || t.options.length === 0) err(ctx, `${itemLabel(it)}: "match" itemhez közös opciólista ("options") kell.`);
      else if (!bankKeys.has(it.answer)) err(ctx, `${itemLabel(it)}: a megoldás ("${it.answer}") nincs a közös opciók között.`);
      usedMatchKeys.push(it.answer);
      if (it.wrongOptions) {
        for (const k of Object.keys(it.wrongOptions)) {
          if (!bankKeys.has(k) || k === it.answer) err(ctx, `${itemLabel(it)}: a wrongOptions "${k}" kulcsa érvénytelen.`);
        }
      }
    } else if (it.kind === "text") {
      const norm = it.answer.map(normalizeAnswer);
      if (new Set(norm).size !== norm.length) err(ctx, `${itemLabel(it)}: ismétlődő elfogadott válasz (kis/nagybetűtől és szóköztől eltekintve azonos).`);
      if (it.maxWords) {
        for (const a of it.answer) {
          if (a !== CORRECT_MARKER && a.trim().split(/\s+/).length > it.maxWords) {
            err(ctx, `${itemLabel(it)}: a(z) "${a}" válasz hosszabb a megengedett ${it.maxWords} szónál.`);
          }
        }
      }
      if (t.section === "language-use" && t.type === "word-formation" && !it.cue) err(ctx, `${itemLabel(it)}: szóképzésnél kötelező a "cue" (a kiinduló szó).`);
      if (t.section === "language-use" && t.type === "verb-forms" && !it.cue) err(ctx, `${itemLabel(it)}: igealak-kitöltésnél kötelező a "cue" (az ige).`);
    }
  }

  if (typeDef && typeDef.itemKinds.length) {
    for (const k of kinds) {
      if (!typeDef.itemKinds.includes(k as Item["kind"])) warn(ctx, `A(z) "${t.type}" típushoz nem illik "${k}" item.`);
    }
  }

  if (usedMatchKeys.length && !t.optionsReusable) {
    const dups = usedMatchKeys.filter((k, i) => usedMatchKeys.indexOf(k) !== i);
    if (dups.length) err(ctx, `Egy opció csak egyszer használható, de ezek többször megoldások: ${[...new Set(dups)].join(", ")} (vagy állítsd: optionsReusable: true).`);
    if (t.options && t.options.length <= usedMatchKeys.length && t.section === "reading") {
      warn(ctx, `Nincs zavaró (felesleges) opció – a vizsgán általában van egy-két extra opció.`);
    }
  }

  if (t.section === "reading") {
    if (t.glossary.length === 0) err(ctx, `Olvasási feladathoz kötelező a szójegyzék ("glossary").`);
    for (const g of t.glossary) {
      if (!sourceNorm.includes(normalizeForSearch(g.term).split(" ")[0]!.slice(0, 5))) {
        warn(ctx, `A szójegyzék "${g.term}" szava nem található a szövegben.`);
      }
    }
  }

  // passage length per level (config/exam/structure.json textLength)
  const lengths = examConfig.structure().levels[t.level].textLength;
  const range = lengths[t.section];
  if (range) {
    // tasks without a passage (e.g. error correction) carry their text in the item prompts
    const wc = wordCount(source || all.map((i) => i.prompt ?? "").join(" "));
    if (wc < range.min * 0.6) warn(ctx, `A szöveg rövid a szinthez (${wc} szó, javasolt ${range.min}–${range.max}).`);
    if (wc > range.max * 1.4) warn(ctx, `A szöveg hosszú a szinthez (${wc} szó, javasolt ${range.min}–${range.max}).`);
  }
  if (t.items.length < 3) warn(ctx, `Kevés item (${t.items.length}) – a vizsgán egy feladatban általában 5–12 van.`);
}

function checkWriting(ctx: Ctx, w: WritingTask) {
  const ids = w.points.map((p) => p.id);
  if (new Set(ids).size !== ids.length) err(ctx, `Duplikált irányítási pont azonosító.`);
  if (w.wordLimit.min >= w.wordLimit.max) err(ctx, `A szóhatár minimuma kisebb legyen a maximumnál.`);
  const rubric = examConfig.writingRubric(w.level);
  const rt = rubric.tasks.find((t) => t.taskNumber === w.taskNumber);
  if (!rt) err(ctx, `A(z) ${w.level} szinten nincs ${w.taskNumber}. írásfeladat a rubrikában.`);
  else if (rt.wordLimit.min !== w.wordLimit.min || rt.wordLimit.max !== w.wordLimit.max) {
    warn(ctx, `A szóhatár (${w.wordLimit.min}–${w.wordLimit.max}) eltér a rubrikától (${rt.wordLimit.min}–${rt.wordLimit.max}).`);
  }
  const m = w.modelAnswer;
  if (m) {
    const wc = wordCount(m.text);
    if (wc < w.wordLimit.min || wc > w.wordLimit.max) err(ctx, `A mintamegoldás ${wc} szó – a szóhatáron (${w.wordLimit.min}–${w.wordLimit.max}) belül kell lennie.`);
    const textNorm = normalizeForSearch(m.text);
    for (const pc of m.pointsCovered) {
      if (!ids.includes(pc.id)) err(ctx, `A mintamegoldás pointsCovered "${pc.id}" azonosítója nem irányítási pont.`);
      if (!textNorm.includes(normalizeForSearch(pc.quote))) err(ctx, `A mintamegoldás idézete nem található szó szerint a szövegben: "${pc.quote.slice(0, 60)}…"`);
    }
    const missing = ids.filter((id) => !m.pointsCovered.some((pc) => pc.id === id));
    if (missing.length) err(ctx, `A mintamegoldás nem jelöli, hol teljesíti ezeket a pontokat: ${missing.join(", ")}.`);
    if (m.notes.length < 2) warn(ctx, `A mintamegoldáshoz legalább 2 magyar megjegyzés kell (miért jó).`);
  }
}

function checkSpeaking(ctx: Ctx, s: SpeakingTask) {
  if (s.type === "interview" && s.questions.length < 3) err(ctx, `Interjúhoz legalább 3 kérdés kell.`);
  if (s.type === "situation" && !s.situation) err(ctx, `Szituációs feladathoz kötelező a "situation" mező.`);
  if (s.type === "picture" && s.scenes.length < 1) err(ctx, `Képleírás-feladathoz legalább 1 jelenetleírás ("scenes") kell.`);
  if (s.type === "debate") {
    if (!s.debate) err(ctx, `Vitafeladathoz kötelező a "debate" mező.`);
    if (s.level !== "emelt") err(ctx, `Vitafeladat csak emelt szinten van.`);
  }
  if (s.type === "presentation" && s.prompts.length < 1) err(ctx, `Témakifejtéshez legalább 1 "prompts" elem kell.`);
}

function checkLesson(ctx: Ctx, l: GrammarLesson) {
  const group = ctx.categories.get(l.category);
  if (!group) err(ctx, `Ismeretlen hibakategória: "${l.category}" (lásd config/exam/error-categories.json).`);
  if (l.id !== `gr-${l.category}`) err(ctx, `A szabálylecke azonosítója "gr-${l.category}" legyen.`);
  if (l.level !== "kozep") err(ctx, `A szabályleckék szintfüggetlenek: level "kozep" legyen, az emelt szabályok "emeltOnly": true jelölést kapnak.`);
  for (const r of l.relatedCategories) if (!ctx.categories.has(r)) err(ctx, `relatedCategories: ismeretlen kategória "${r}".`);
  const language = group !== "comprehension";
  if (language && l.commonMistakes.length < 3) warn(ctx, `Legalább 3 tipikus hiba (commonMistakes) kell.`);
  if (language && l.practice.length < 5) warn(ctx, `Legalább 5 gyakorló item (practice) kell.`);
  l.practice.forEach((it, i) => {
    const label = `practice ${it.id}`;
    if (it.id !== String(i + 1)) err(ctx, `A gyakorló itemek számozása 1-től folyamatos legyen (a(z) ${i + 1}. helyen "${it.id}").`);
    if (!ctx.categories.has(it.category)) err(ctx, `${label}: ismeretlen kategória "${it.category}".`);
    if (it.explanation.trim().length < 15) warn(ctx, `${label}: túl rövid a magyarázat – írd le a helyes választ és az okát.`);
    if (!it.prompt?.trim()) err(ctx, `${label}: hiányzik a feladatmondat ("prompt").`);
    if (it.kind === "choice") {
      const keys = it.options.map((o) => o.key);
      if (new Set(keys).size !== keys.length) err(ctx, `${label}: duplikált opciókulcs.`);
      if (!keys.includes(it.answer)) err(ctx, `${label}: a megoldás ("${it.answer}") nincs az opciók között.`);
      const missing = keys.filter((k) => k !== it.answer && !it.wrongOptions?.[k]);
      if (missing.length) err(ctx, `${label}: hiányzik a magyarázat, miért rossz: ${missing.join(", ")}.`);
    } else {
      const norm = it.answer.map(normalizeAnswer);
      if (new Set(norm).size !== norm.length) err(ctx, `${label}: ismétlődő elfogadott válasz.`);
    }
  });
}

function checkVocab(ctx: Ctx, d: VocabDeck) {
  const seen = new Set<string>();
  for (const card of d.cards) {
    const key = normalizeAnswer(card.term);
    if (seen.has(key)) err(ctx, `Duplikált szó a pakliban: "${card.term}".`);
    seen.add(key);
    const stem = normalizeForSearch(card.term)
      .split(" ")
      .filter((w) => w.length > 2 && !["sth", "sb", "someone", "something", "one's"].includes(w))
      .map((w) => w.slice(0, Math.max(3, w.length - 3)));
    const ex = normalizeForSearch(card.example);
    if (stem.length && !stem.some((s) => ex.includes(s))) warn(ctx, `A(z) "${card.term}" példamondata nem tartalmazza a szót.`);
  }
}
