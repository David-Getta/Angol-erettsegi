import { describe, expect, it } from "vitest";
import { getSettings, settingsFor, updateSettings } from "@/lib/settings";
import { subjects } from "@/lib/exam/config";

describe("settings", () => {
  it("the level switch changes every subject at once; other per-subject settings stay per subject", () => {
    updateSettings({ subject: "matematika" });
    updateSettings({ targetPct: 77 });
    updateSettings({ level: "emelt" });
    for (const s of subjects()) expect(settingsFor(s.id).level, s.id).toBe("emelt");
    updateSettings({ subject: "angol" });
    updateSettings({ level: "kozep" });
    // a subject studied at one level only keeps that level
    for (const s of subjects()) expect(settingsFor(s.id).level, s.id).toBe(s.levels.includes("kozep") ? "kozep" : s.levels[0]);
    expect(settingsFor("gazdasagi-ismeretek").level).toBe("emelt");
    updateSettings({ subject: "gazdasagi-ismeretek" });
    updateSettings({ level: "kozep" });
    expect(getSettings().level).toBe("emelt");
    expect(settingsFor("matematika").level).toBe("kozep");
    updateSettings({ subject: "angol" });
    expect(settingsFor("matematika").targetPct).toBe(77);
    expect(getSettings().subject).toBe("angol");
    expect(settingsFor("angol").targetPct).not.toBe(77);
  });
});
