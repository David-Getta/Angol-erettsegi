import { exportData } from "@/lib/backup";

export const dynamic = "force-dynamic";

export function GET() {
  const body = JSON.stringify(exportData(), null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="angol-erettsegi-${day}.json"`,
    },
  });
}
