import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateContentDir } from "@/lib/content/validate";

describe("content bank", () => {
  it("validates without errors", () => {
    const r = validateContentDir();
    expect(r.errors.map((e) => `${e.file}: ${e.message}`)).toEqual([]);
    expect(r.files).toBeGreaterThan(0);
  });
});

describe("validator logic", () => {
  const base = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/language-use/emelt/lu-emelt-urban-beekeeping-open-cloze.json"), "utf8"),
  );
  function validate(mutate: (c: typeof base) => void) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
    const c = structuredClone(base);
    mutate(c);
    fs.mkdirSync(path.join(dir, "language-use", "emelt"), { recursive: true });
    fs.writeFileSync(path.join(dir, "language-use", "emelt", `${c.id}.json`), JSON.stringify(c));
    return validateContentDir(dir);
  }
  it("accepts the sample", () => {
    expect(validate(() => {}).errors).toEqual([]);
  });
  it("catches a gap without an item", () => {
    const r = validate((c) => {
      c.passage.blocks[0].text += " [[11]]";
    });
    expect(r.errors.some((e) => e.message.includes("[[11]]"))).toBe(true);
  });
  it("catches an unknown error category", () => {
    const r = validate((c) => {
      c.items[0].category = "nonsense";
    });
    expect(r.errors.some((e) => e.message.includes("nonsense"))).toBe(true);
  });
  it("catches duplicate accepted answers", () => {
    const r = validate((c) => {
      c.items[9].answer = ["although", "Although "];
    });
    expect(r.errors.some((e) => e.message.includes("ismétlődő"))).toBe(true);
  });
  it("requires the explanation", () => {
    const r = validate((c) => {
      c.items[0].explanation = "";
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("forbids official markers on generated tasks", () => {
    const r = validate((c) => {
      c.official = { year: 2024, session: "majus", level: "emelt" };
    });
    expect(r.errors.some((e) => e.message.includes("official"))).toBe(true);
  });
  it("checks file placement", () => {
    const r = validate((c) => {
      c.level = "kozep";
    });
    expect(r.errors.some((e) => e.message.includes("Rossz helyen"))).toBe(true);
  });
});

describe("lessons and model answers", () => {
  function validateFile(section: string, level: string, c: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
    fs.mkdirSync(path.join(dir, section, level), { recursive: true });
    fs.writeFileSync(path.join(dir, section, level, `${c.id}.json`), JSON.stringify(c));
    return validateContentDir(dir);
  }
  const lesson = {
    schemaVersion: 1,
    id: "gr-article",
    level: "kozep",
    source: "generated",
    topic: "nyelvtan",
    title: "Névelők",
    createdAt: "2026-11-05",
    tags: [],
    section: "grammar",
    type: "lesson",
    category: "article",
    summaryHu: "A névelők használata.",
    rules: [{ title: "Határozatlan névelő", explanation: "Első említéskor a/an.", examples: [{ en: "I saw a dog.", hu: "Láttam egy kutyát." }] }],
    commonMistakes: [
      { wrong: "She is teacher.", right: "She is a teacher.", why: "Foglalkozás előtt kell az a/an." },
      { wrong: "The life is hard.", right: "Life is hard.", why: "Általános értelemben nincs névelő." },
      { wrong: "I play the football.", right: "I play football.", why: "Sportágak előtt nincs névelő." },
    ],
    practice: [
      { id: "1", kind: "text", prompt: "She is ___ engineer.", answer: ["an"], category: "article", explanation: "Helyes: an, mert magánhangzóval kezdődik a szó." },
      {
        id: "2",
        kind: "choice",
        prompt: "___ Danube flows through Budapest.",
        options: [
          { key: "A", text: "The" },
          { key: "B", text: "A" },
        ],
        answer: "A",
        category: "article",
        explanation: "Helyes: The – folyók neve előtt határozott névelő áll.",
        wrongOptions: { B: "Egyedi folyónév előtt nem állhat határozatlan névelő." },
      },
    ],
  };

  it("accepts a well-formed lesson and checks its id and items", () => {
    expect(validateFile("grammar", "kozep", lesson).errors).toEqual([]);
    const bad = structuredClone(lesson) as typeof lesson & { practice: { answer: unknown; wrongOptions?: unknown }[] };
    bad.id = "gr-tense";
    bad.practice[1]!.answer = "C";
    const r = validateFile("grammar", "kozep", bad);
    expect(r.errors.some((e) => e.message.includes('"gr-article"'))).toBe(true);
    expect(r.errors.some((e) => e.message.includes("nincs az opciók között"))).toBe(true);
  });

  it("requires the model answer to stay within the word limit and to quote the text", () => {
    const card = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/writing/kozep/wr-kozep-new-phone-email.json"), "utf8"));
    card.modelAnswer = {
      text: "Hi Jamie, my new phone is great.",
      pointsCovered: card.points.map((p: { id: string }) => ({ id: p.id, quote: "not in the text" })),
      notes: ["a", "b"],
    };
    const r = validateFile("writing", "kozep", card);
    expect(r.errors.some((e) => e.message.includes("szóhatáron"))).toBe(true);
    expect(r.errors.some((e) => e.message.includes("nem található szó szerint"))).toBe(true);
  });
});

describe("guides", () => {
  function validateGuide(c: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
    fs.mkdirSync(path.join(dir, "guide", "kozep"), { recursive: true });
    fs.writeFileSync(path.join(dir, "guide", "kozep", `${c.id}.json`), JSON.stringify(c));
    return validateContentDir(dir);
  }
  const guide = {
    schemaVersion: 1,
    id: "gd-exam-reading",
    level: "kozep",
    source: "generated",
    topic: "utmutato",
    title: "Olvasott szöveg értése",
    createdAt: "2026-11-05",
    tags: [],
    section: "guide",
    type: "exam",
    target: "reading",
    summaryHu: "Stratégia.",
    steps: [
      { title: "Olvasd el az utasítást", explanation: "És a példát." },
      { title: "Fusd át a szöveget", explanation: "A fő gondolatért." },
    ],
    mistakes: [
      { wrong: "a", right: "b", why: "c" },
      { wrong: "a", right: "b", why: "c" },
      { wrong: "a", right: "b", why: "c" },
    ],
    checklist: ["x", "y", "z"],
  };

  it("accepts a guide and rejects a wrong id or an unknown target", () => {
    expect(validateGuide(guide).errors).toEqual([]);
    expect(validateGuide({ ...guide, id: "gd-exam-listening" }).errors.some((e) => e.message.includes('"gd-exam-reading"'))).toBe(true);
    expect(validateGuide({ ...guide, id: "gd-writing-poem", type: "writing", target: "poem" }).errors.some((e) => e.message.includes("szövegtípus"))).toBe(true);
  });
});
