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

/** The non-part section words of /feladatok (parts use the subject's URL slug, e.g. olvasas, rovid-feladatok). */
export const SPECIAL_SECTION_ARG: Record<string, string> = {
  vocabulary: "szokincs",
  grammar: "szabaly",
  guide: "utmutato",
};

/**
 * `/feladatok <tantárgy> <rész> <szint> <darab> [témakör] [hibakategória]`.
 * `section` is the part's URL slug (or szokincs / szabaly / utmutato).
 */
export function feladatokCommand(subject: string, section: string, level: string, count: number, topic?: string | null, category?: string | null): string {
  return buildCommand("feladatok", [subject, SPECIAL_SECTION_ARG[section] ?? section, level, count, topic ?? null, category ?? null]);
}

/** `/szokincs <tantárgy> [témakör] [szint] [darab]` */
export function szokincsCommand(subject: string, topic?: string | null, level?: string | null, count?: number | null): string {
  return buildCommand("szokincs", [subject, topic ?? null, level ?? null, count ?? null]);
}
