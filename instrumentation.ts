/**
 * Runs once when the Next.js server starts. The desktop app starts the server
 * with APP_SEED_ON_START=1 so the bundled content is loaded into the user's
 * database before the window opens (the dev server does this in `npm run dev`
 * through the predev script instead).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startupSeed, setStartupStatus, watchParent } = await import("./lib/startup");
  const parent = Number(process.env.APP_PARENT_PID);
  if (Number.isInteger(parent) && parent > 0) watchParent(parent);
  if (process.env.APP_SEED_ON_START !== "1") return;
  try {
    const r = await startupSeed((m) => console.log(`[indítás] ${m}`));
    const failed = r.seed.failed.length ? `${r.seed.failed.length} hibás tartalomfájl kimaradt` : undefined;
    setStartupStatus({ ok: !failed, error: failed, seed: r.seed, at: new Date().toISOString() });
  } catch (e) {
    console.error("[indítás] a tartalom betöltése nem sikerült:", e);
    setStartupStatus({ ok: false, error: (e as Error).message, at: new Date().toISOString() });
  }
}
