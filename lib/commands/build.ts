/**
 * Builds a slash command string from parameter values (client-safe).
 * Empty optional values in the middle become "-" so the positions stay right;
 * trailing empty optional values are dropped.
 */
export function buildCommand(name: string, values: Array<string | number | null | undefined>): string {
  const parts = values.map((v) => (v === null || v === undefined ? "" : String(v).trim()));
  while (parts.length && parts[parts.length - 1] === "") parts.pop();
  const args = parts.map((p) => (p === "" ? "-" : p));
  return [`/${name}`, ...args].join(" ");
}

/** Section value used in /feladatok for an app section id. */
export const SECTION_ARG: Record<string, string> = {
  reading: "olvasas",
  "language-use": "nyelvhelyesseg",
  listening: "hallas",
  writing: "iras",
  speaking: "szobeli",
  vocabulary: "szokincs",
};

export function feladatokCommand(section: string, level: string, count: number, topic?: string | null, category?: string | null): string {
  return buildCommand("feladatok", [SECTION_ARG[section] ?? section, level, count, topic ?? null, category ?? null]);
}
