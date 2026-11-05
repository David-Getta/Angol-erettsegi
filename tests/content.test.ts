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
