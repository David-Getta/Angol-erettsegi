import fs from "node:fs";
import { Readable } from "node:stream";
import { officialAudioPath } from "@/lib/official";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg" };

/** Streams an official recording from data/official/<folder>/<file> (with range support for seeking). */
export function GET(req: Request) {
  const url = new URL(req.url);
  const file = officialAudioPath(url.searchParams.get("folder") ?? "", url.searchParams.get("file") ?? "");
  if (!file) return new Response("Not found", { status: 404 });
  const size = fs.statSync(file).size;
  const type = TYPES[file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const stream = fs.createReadStream(file, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
  });
}
