import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { paths } from "@/lib/paths";

export const CommandParamSchema = z.object({
  name: z.string(),
  required: z.boolean(),
  valuesFrom: z.enum(["subjects", "sections", "levels", "count", "topics", "categories", "officialFolders", "free"]),
  description: z.string(),
});

export const CommandSchema = z.object({
  name: z.string().regex(/^[a-z-]+$/),
  file: z.string(),
  title: z.string(),
  summary: z.string(),
  usage: z.string(),
  params: z.array(CommandParamSchema),
  examples: z.array(z.object({ command: z.string(), description: z.string() })).min(1),
  after: z.string(),
});
export type CommandDef = z.infer<typeof CommandSchema>;

export const CommandsConfigSchema = z.object({
  note: z.string().optional(),
  sectionArgs: z.array(z.object({ value: z.string(), section: z.string(), label: z.string() })),
  commands: z.array(CommandSchema),
});
export type CommandsConfig = z.infer<typeof CommandsConfigSchema>;

export function loadCommands(): CommandsConfig {
  const raw = JSON.parse(fs.readFileSync(path.join(paths.config, "commands.json"), "utf8"));
  return CommandsConfigSchema.parse(raw);
}

export function commandFileExists(def: CommandDef): boolean {
  return fs.existsSync(path.join(paths.root, def.file));
}
