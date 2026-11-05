import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { paths, rel } from "@/lib/paths";
import { ContentSchema, type Content } from "./schema";

/** content/<folder>/<level>/<id>.json – folder names per section. */
export const SECTION_FOLDERS = {
  reading: "reading",
  "language-use": "language-use",
  listening: "listening",
  writing: "writing",
  speaking: "speaking",
  vocabulary: "vocabulary",
  grammar: "grammar",
  guide: "guide",
} as const;

export type RawFile = { file: string; relPath: string; text: string; hash: string };

export function listContentFiles(dir: string = paths.content): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

export function readRaw(file: string): RawFile {
  const text = fs.readFileSync(file, "utf8");
  return { file, relPath: rel(file), text, hash: crypto.createHash("sha1").update(text).digest("hex") };
}

export type LoadedContent = { file: string; relPath: string; hash: string; content: Content };

/**
 * Loads and schema-parses every content file. Files that fail parsing are
 * skipped and reported in `failed` (the validator gives the full details).
 */
export function loadAllContent(dir: string = paths.content): { items: LoadedContent[]; failed: string[] } {
  const items: LoadedContent[] = [];
  const failed: string[] = [];
  for (const file of listContentFiles(dir)) {
    const raw = readRaw(file);
    try {
      const parsed = ContentSchema.safeParse(JSON.parse(raw.text));
      if (parsed.success) items.push({ file, relPath: raw.relPath, hash: raw.hash, content: parsed.data });
      else failed.push(raw.relPath);
    } catch {
      failed.push(raw.relPath);
    }
  }
  return { items, failed };
}
