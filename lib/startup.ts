import { ensureExchangeDirs } from "@/lib/exchange/files";
import { autoBackup } from "@/lib/backup";
import { seedContent, type SeedReport } from "@/lib/content/seed";
import { examConfig } from "@/lib/exam/config";

export type StartupResult = { backup: string | null; seed: SeedReport };

/** Outcome of the start-up seed, reported by /api/health so the desktop shell can warn the user. */
export type StartupStatus = { ok: boolean; error?: string; seed?: SeedReport; at: string };
const holder = globalThis as unknown as { __startupStatus?: StartupStatus };
export function setStartupStatus(s: StartupStatus): void {
  holder.__startupStatus = s;
}
export function getStartupStatus(): StartupStatus | null {
  return holder.__startupStatus ?? null;
}

/**
 * The desktop shell passes its pid (APP_PARENT_PID): when it disappears (crash, Task Manager) the
 * server exits too instead of lingering on its port.
 */
export function watchParent(pid: number, intervalMs = 5000): NodeJS.Timeout {
  const timer = setInterval(() => {
    try {
      process.kill(pid, 0);
    } catch {
      console.log(`[indítás] a héj (${pid}) eltűnt, a szerver leáll`);
      process.exit(0);
    }
  }, intervalMs);
  timer.unref();
  return timer;
}

/**
 * What a freshly started server does before the first request when
 * APP_SEED_ON_START=1 (the desktop app sets it): creates the exchange and data
 * folders, takes the periodic automatic backup and loads the content bank into
 * the database. Idempotent – unchanged files are skipped by hash.
 */
export async function startupSeed(log: (msg: string) => void = (m) => console.log(m)): Promise<StartupResult> {
  ensureExchangeDirs();
  const backup = await autoBackup(examConfig.app().backup).catch((e: Error) => {
    log(`⚠ Az automatikus mentés nem sikerült: ${e.message}`);
    return null;
  });
  if (backup) log(`Automatikus mentés: ${backup}`);
  const seed = seedContent();
  log(
    `Tartalom betöltve: ${seed.inserted} új, ${seed.updated} frissített, ${seed.unchanged} változatlan, ${seed.deactivated} inaktivált feladat.`,
  );
  if (seed.failed.length) log(`⚠ ${seed.failed.length} tartalomfájl hibás, kimaradt: ${seed.failed.slice(0, 5).join(", ")}`);
  return { backup, seed };
}
