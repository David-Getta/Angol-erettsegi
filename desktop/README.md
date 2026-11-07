# Asztali alkalmazás — fejlesztői jegyzet

Ez a mappa az **Érettségi felkészítő** Electron-héja: ebből lesz a laikusnak is
telepíthető program (Windows-telepítő, macOS-app, Linux AppImage), amely magától
frissül a GitHub Releases-ből. A végfelhasználó élménye: *letölt egy fájlt →
dupla kattintás → használ*. Nincs Node.js, nincs parancssor, nincs böngésző.
A felhasználói útmutató: [`../TELEPITES.md`](../TELEPITES.md).

> A telepítőt **az adott operációs rendszeren** kell építeni (Windows-telepítő
> csak Windowson, macOS-app csak macOS-en). Kiadáskor ezt a GitHub Actions végzi
> mind a három rendszeren (`.github/workflows/release.yml`); helyben csak a saját
> rendszered csomagját tudod kipróbálni.

## Áttekintés

A csomag két részből áll:

1. **Szerver** – a meglévő Next.js app `next build` standalone kimenete
   (`DESKTOP_BUILD=1`, dist-mappa: `.next-desktop`), a feladatbankkal
   (`content/`), a configgal, a migrációkkal és a parancsleírásokkal együtt a
   csomag `resources/` mappájában. A better-sqlite3 natív modulját az Electron
   ABI-jához illő **előre fordított** binárisra cseréljük (nem fordítunk).
2. **Héj** – az Electron főfolyamat (`main.ts`) és a preload (`preload.ts`),
   esbuilddel egy-egy `.cjs` fájlba csomagolva. A héj induláskor
   **gyerekfolyamatként** indítja a szervert (`ELECTRON_RUN_AS_NODE=1`, tehát az
   Electron saját Node-futtatójával, egy szabad 127.0.0.1-es porton,
   `APP_SEED_ON_START=1`-gyel), megvárja, míg a `/api/health` válaszol, és csak
   akkor nyitja meg az ablakot. Addig egy kis splash látszik („Az app indítása…”
   → „A feladatbank betöltése…”).

A héj **nem importál Next-et, és nem nyúl az adatbázishoz**: a szerverrel csak
http-n beszél. A szerver a mappáit a `lib/paths.ts` meglévő env-változóin kapja
(`APP_ROOT`, `APP_CONFIG_DIR`, `APP_CONTENT_DIR`, `APP_DATA_DIR`,
`APP_EXCHANGE_DIR`); `APP_SEED_ON_START=1` esetén az első kérés előtt létrehozza
a mappákat, elkészíti az időszakos mentést, és beseedeli a tartalmat
(`instrumentation.ts` → `lib/startup.ts`), így a frissítéssel érkező új és
módosult feladatok a haladás megtartásával kerülnek az adatbázisba.

## Mi hol van

| Hely | Mi az |
|---|---|
| `desktop/main.ts` | Electron főfolyamat: szerverindítás, várakozás a `/api/health`-re, ablak, magyar menü, `electron-updater`, IPC-kezelők, a héj saját beállításai (beadás-mappa, frissítési kulcs `safeStorage`-zal titkosítva) |
| `desktop/preload.ts` | `contextBridge` → `window.desktop` |
| `desktop/shared.ts` | a típusos szerződés a héj és az oldal között: `UpdateState`, `DesktopInfo`, `DesktopApi`, az IPC-csatornák nevei |
| `desktop/build/icon.svg`, `icon.png` | az app ikonja (electron-builder `buildResources`) |
| `desktop/dist/` | build-kimenet: `main.cjs`, `preload.cjs`, `server/` – git-ignorált |
| `desktop/out/` | a telepítők és a kicsomagolt app (`<os>-unpacked`) – git-ignorált |
| `electron-builder.yml` | csomagolás: appId `hu.davidgetta.erettsegi-felkeszito`; `files` = csak a két bundle + `package.json`; `extraResources` = server, content, config, drizzle, `.claude/commands`, ikon; `publish` = GitHub `David-Getta/Angol-erettsegi`; NSIS per-user segített telepítő magyarul; mac aláíratlan; Linux AppImage |
| `scripts/desktop/bundle.ts` | a main/preload csomagolása esbuilddel (ezt futtatja a CI is minden pushnál) |
| `scripts/desktop/build.ts` | a teljes build (lásd a parancsokat) |
| `scripts/desktop/smoke.ts` | füstteszt a kicsomagolt appon |
| `scripts/desktop/release-notes.ts` | a CHANGELOG adott verziójú szakasza → a GitHub-kiadás szövege |
| `scripts/release.ts` | verzióemelés + CHANGELOG + commit + címke |
| `instrumentation.ts`, `lib/startup.ts` | induláskori mappák, mentés, seed (`APP_SEED_ON_START=1`) |
| `app/api/health/route.ts` | életjel (`{ ok: true }`) – erre vár a héj |
| `components/desktop/` | `bridge.ts` (hookok a `window.desktop`-ra), `UpdateBar.tsx` (az arany sáv), `TopbarUpdateButton.tsx` (a ⭳ ikon a fejlécben), `DesktopSettings.tsx` (az „Asztali alkalmazás” kártya a Beállításokban) – böngészőben, ahol `window.desktop` nincs, mind `null`-t ad |
| `next.config.ts` | `output: "standalone"` csak `DESKTOP_BUILD=1` esetén |
| `.github/workflows/ci.yml`, `release.yml` | ellenőrzés minden pushnál (`npm run check` + `npm run desktop:bundle`); telepítő-build és kiadás |
| `CHANGELOG.md` | változásnapló – a „## Kiadatlan” szakaszból lesz a kiadás szövege |
| `tests/desktop.test.ts`, `tests/startup.test.ts` | őrök: Electron-verzió 39–42, minden IPC-csatorna le van kezelve, a csomagolás és a workflow konzisztens, van „Kiadatlan” szakasz; a szerver indulásakor seedel és válaszol az életjelre |

Felhasználói mappák (a programon kívül, így a frissítés nem bántja őket):

- adat: Windows `%APPDATA%\erettsegi-felkeszito\data\app.db` (mellette
  `data\backups\` és `logs\`), macOS `~/Library/Application Support/erettsegi-felkeszito/`,
  Linux `~/.config/erettsegi-felkeszito/`;
- beadás-mappa (inbox/outbox/archive): alapból `Dokumentumok/Érettségi felkészítő/exchange`,
  a Beállításokban átállítható (pl. a projekt `exchange/` mappájára, hogy a
  `/javitas` parancs közvetlenül lássa a beadásokat; a szerver újraindul az új mappával).

Mindhárom mappa a Beállítások „Asztali alkalmazás” kártyájáról és az
„Alkalmazás” menüből nyitható.

## Parancsok

| Parancs | Mit csinál |
|---|---|
| `npm run desktop:dev` | összecsomagolja a héjat, és megnyitja a **futó** `npm run dev` szerver ellen (http://localhost:3000) – előbb indítsd el az `npm run dev`-et. Csomagolatlan futás: a frissítés kikapcsolva („Fejlesztői futás”). |
| `npm run desktop:build` | teljes build a kicsomagolt mappába (`desktop/out/<os>-unpacked`): `next build` standalone a `.next-desktop`-ba → `desktop/dist/server` összeállítása → az Electron-ABI better-sqlite3 prebuilt letöltése → main/preload esbuilddel → `electron-builder --dir` |
| `npm run desktop:dist` | ugyanaz, de a telepítőt készíti el az aktuális OS-re a `desktop/out/` mappába |
| `npm run desktop:smoke` | a kész kicsomagolt appot `--smoke-test`-tel indítja egy ideiglenes adatmappában, megvárja a kezdőképernyőt, képernyőképet ment (`-- --shot <fájl>`), és 0-val kilép – ezt futtatja a release workflow mind a három OS-en |
| `npm run release -- X.Y.Z --commit --tag` | `package.json` verzió emelése, a CHANGELOG „## Kiadatlan” szakaszából „## X.Y.Z – dátum”, commit „Kiadás: vX.Y.Z”, címke `vX.Y.Z` |
| `npm run release:notes -- X.Y.Z --out file.md` | az adott verzió CHANGELOG-szakasza fájlba (ez a GitHub-kiadás szövege; az app a „Mi változik?” alatt mutatja) |

További kapcsolók a `scripts/desktop/build.ts`-hez: `--skip-next` (a már kész
standalone szerverrel, pl. telepítő után a kicsomagolt mappához),
`--win | --mac | --linux`, `--publish never|always`.

## Helyi build rendszerenként

Mindenhol: Node.js 20.9+, `npm ci` (vagy `npm run setup`), és mivel nincs
aláíró tanúsítvány, `CSC_IDENTITY_AUTO_DISCOVERY=false` (a workflow is így
futtatja).

**Windows** (PowerShell):

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run desktop:dist      # → desktop\out\Erettsegi-felkeszito-Setup-<verzió>.exe (+ .blockmap, latest.yml)
npm run desktop:build     # kicsomagolt app: desktop\out\win-unpacked\
npm run desktop:smoke
```

**macOS**:

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run desktop:dist      # → desktop/out/Erettsegi-felkeszito-<verzió>-mac-arm64.dmg és -mac-x64.dmg (+ .zip, latest-mac.yml)
npm run desktop:build && npm run desktop:smoke
```

Apple Developer aláírás nincs (`identity: null`): első indításnál jobb klikk →
Megnyitás kell, és az app nem tudja kicserélni önmagát – ezért macOS-en a
frissítés gombja („Letöltés”) a Releases oldalt nyitja meg.

**Linux** (Ubuntu/Debian):

```bash
sudo apt-get install -y libfuse2 xvfb   # AppImage futtatásához; xvfb a kijelző nélküli füstteszthez
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run desktop:dist      # → desktop/out/Erettsegi-felkeszito-<verzió>.AppImage (+ latest-linux.yml)
npm run desktop:build && npm run desktop:smoke
```

## Mi kerül a Releases oldalra

- Windows: `Erettsegi-felkeszito-Setup-<verzió>.exe` (+ `.blockmap`, `latest.yml`)
- macOS: `Erettsegi-felkeszito-<verzió>-mac-arm64.dmg` (Apple Silicon),
  `Erettsegi-felkeszito-<verzió>-mac-x64.dmg` (Intel), a `.zip` változatok, `latest-mac.yml`
- Linux: `Erettsegi-felkeszito-<verzió>.AppImage`, `latest-linux.yml`

A `latest*.yml` fájlokból veszi észre a telepített app, hogy van új verzió –
ezek nélkül nincs automatikus frissítés, ezért a workflow mindig feltölti őket.

## Automatikus frissítés – hogy működik

`electron-updater`, forrás: GitHub Releases (`publish` az
`electron-builder.yml`-ben, `owner/repo` a `main.ts`-ben – a teszt ellenőrzi,
hogy egyeznek). Ellenőrzés induláskor ~4 másodperc után és utána hatóránként.
Új verziónál a héj `UpdateState`-et küld az oldalnak, az `UpdateBar` arany
sávot mutat: „Mi változik?” (a kiadás szövege), „Később” (a következő
indításig), „Frissítés most”. Windows és Linux AppImage: letöltés haladással,
csendes telepítés, újraindítás (a per-user NSIS-telepítő nem kér rendszergazdát,
az adatok a programon kívül maradnak). macOS: „Letöltés” → a Releases oldal.
Kézi keresés: menü „Alkalmazás → Programfrissítés keresése…”, a fejléc ⭳ ikonja
(arany pont = frissítés vár), Beállítások → Asztali alkalmazás. Privát repóhoz
fine-grained token (Contents: Read-only) a Beállításokban, `safeStorage`-zal
titkosítva, csak azon a gépen.

## Kiadás – ellenőrző lista

1. A `CHANGELOG.md` „## Kiadatlan” szakasza **valódi**, a tanulónak szóló
   változásokat ír le – ebből lesz a kiadás szövege, amit a „Mi változik?”
   alatt a frissítés előtt elolvas.
2. `npm run check` zöld; helyben `npm run desktop:build && npm run desktop:smoke`
   lefut.
3. `npm run release -- X.Y.Z --commit --tag` (az első asztali kiadás az
   `1.0.0`; a verziót csak ez a parancs emeli, kézzel nem írjuk át).
4. `git push origin HEAD && git push origin vX.Y.Z` → a `release` workflow:
   tesztek → három OS-en `desktop:dist` + `desktop:build -- --skip-next` +
   füstteszt → Releases a telepítőkkel és a `latest*.yml`-ekkel, a leírás a
   CHANGELOG-ból. (Kézi indítás: Actions → release → Run workflow → version;
   üres verzióval csak próba-build készül, kiadás nélkül.)
5. Ellenőrzés: a Releases oldalon ott a három rendszer csomagja és a
   `latest.yml`, `latest-mac.yml`, `latest-linux.yml`; egy telepített régebbi
   verzió induláskor felajánlja a frissítést.

## Szabályok

- Az Electron major **39 és 42 között** marad: a better-sqlite3 12.x csak
  ezekhez ad előre fordított binárist (ABI 140–146); `tests/desktop.test.ts` őrzi.
- Az Electron-folyamat soha nem importál Next-et vagy `lib/db`-t – a szerverrel
  csak http-n beszél.
- Minden asztali UI-szöveg (a menü és a splash is) a `lib/i18n/hu.ts`-ben,
  `t.desktop` alatt.
- Az oldal az asztali appot csak a `window.desktop`-on ismeri fel (böngészőben
  `undefined`), minden asztali komponens ott `null`-t ad.
- A héj sem hív semmilyen AI API-t.
- Verzió = a `package.json` verziója (egyetlen forrás), csak az `npm run release`
  emeli.
