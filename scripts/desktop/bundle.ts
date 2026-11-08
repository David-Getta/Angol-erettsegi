import { build } from "esbuild";
import path from "node:path";

/**
 * Bundles the Electron main process and the preload script into desktop/dist/
 * (one CommonJS file each; `electron` stays external, everything else –
 * electron-updater, the i18n strings – is inlined so the packaged app needs no node_modules).
 */
export async function bundleDesktop(root = process.cwd()): Promise<string[]> {
  const outdir = path.join(root, "desktop", "dist");
  await build({
    entryPoints: { main: path.join(root, "desktop", "main.ts"), preload: path.join(root, "desktop", "preload.ts") },
    outdir,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    outExtension: { ".js": ".cjs" },
    sourcemap: false,
    minify: false,
    legalComments: "none",
    logLevel: "warning",
  });
  return [path.join(outdir, "main.cjs"), path.join(outdir, "preload.cjs")];
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  bundleDesktop()
    .then((files) => console.log(`✓ Electron-csomag: ${files.map((f) => path.relative(process.cwd(), f)).join(", ")}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
