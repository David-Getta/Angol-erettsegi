/**
 * Runs once when the Next.js server starts. The desktop app starts the server
 * with APP_SEED_ON_START=1 so the bundled content is loaded into the user's
 * database before the window opens (the dev server does this in `npm run dev`
 * through the predev script instead).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.APP_SEED_ON_START !== "1") return;
  const { startupSeed } = await import("./lib/startup");
  try {
    await startupSeed((m) => console.log(`[indítás] ${m}`));
  } catch (e) {
    console.error("[indítás] a tartalom betöltése nem sikerült:", e);
  }
}
