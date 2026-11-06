import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCommands, commandFileExists } from "@/lib/commands/config";
import { buildCommand, feladatokCommand } from "@/lib/commands/build";

describe("Claude Code commands", () => {
  const cfg = loadCommands();
  it("lists the five commands", () => {
    expect(cfg.commands.map((c) => c.name).sort()).toEqual(["feladatok", "import-hivatalos", "javitas", "lecke", "szokincs"]);
  });
  it("every command in config/commands.json has a command file", () => {
    for (const c of cfg.commands) {
      expect(commandFileExists(c), `${c.file} hiányzik`).toBe(true);
      expect(path.basename(c.file, ".md")).toBe(c.name);
    }
  });
  it("every command file belongs to a configured command", () => {
    const files = fs.readdirSync(path.join(process.cwd(), ".claude", "commands")).filter((f) => f.endsWith(".md"));
    for (const f of files) expect(cfg.commands.some((c) => c.file.endsWith(f))).toBe(true);
  });
  it("every example starts with its command name", () => {
    for (const c of cfg.commands) for (const e of c.examples) expect(e.command.startsWith(`/${c.name}`)).toBe(true);
  });
  it("command files use the arguments and mention validation", () => {
    for (const c of cfg.commands) {
      const md = fs.readFileSync(path.join(process.cwd(), c.file), "utf8");
      expect(md).toContain("$ARGUMENTS");
      expect(md).toMatch(/npm run validate-(content|feedback)/);
    }
  });
});

describe("buildCommand", () => {
  it("drops trailing empty optionals and marks skipped middle ones", () => {
    expect(buildCommand("feladatok", ["angol", "nyelvhelyesseg", "emelt", 10, "", ""])).toBe("/feladatok angol nyelvhelyesseg emelt 10");
    expect(buildCommand("feladatok", ["angol", "nyelvhelyesseg", "emelt", 6, "", "tense"])).toBe("/feladatok angol nyelvhelyesseg emelt 6 - tense");
    expect(feladatokCommand("angol", "olvasas", "kozep", 4, "utazas")).toBe("/feladatok angol olvasas kozep 4 utazas");
    expect(feladatokCommand("matematika", "grammar", "kozep", 1, null, "szamolas")).toBe("/feladatok matematika szabaly kozep 1 - szamolas");
    expect(buildCommand("javitas", [])).toBe("/javitas");
  });
});
