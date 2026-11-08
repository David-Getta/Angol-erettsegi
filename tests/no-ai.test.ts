import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const AI_PACKAGES = /^(@anthropic-ai\/|openai$|ai$|@ai-sdk\/|langchain|@langchain\/|@google\/generative-ai|@google\/genai|cohere-ai|@mistralai\/|replicate$|groq-sdk|ollama$|@huggingface\/)/;
const AI_HOSTS = /(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere\.|api\.groq\.com|huggingface\.co\/api)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("no AI API at runtime", () => {
  it("has no AI SDK among the dependencies", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => AI_PACKAGES.test(d))).toEqual([]);
  });
  it("the app code does not call any AI API host", () => {
    const files = ["app", "lib", "components", "scripts"].flatMap((d) => walk(path.join(ROOT, d)));
    const hits = files.filter((f) => AI_HOSTS.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
