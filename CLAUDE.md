# CLAUDE.md – Érettségi felkészítő app

Lokális, egyfelhasználós Next.js app egy magyar gimnazistának (érettségi 2027 tavasz, közép és emelt szint) **minden
vizsgatárgyból**: a kezdőképernyőn tantárgyat választ (`config/subjects.json`: magyar, matematika, történelem, angol, német, fizika,
kémia, biológia, földrajz, digitális kultúra, gazdasági ismeretek), és minden tantárgynál ugyanazt a felületet kapja. Minden tantárgy a saját hivatalos
vizsgaszerkezetét követi: `config/subjects/<tantárgy>/` (szerkezet, pontok, rubrikák, témakörök, hibakategóriák), a tartalom
`content/<tantárgy>/` alatt. Az öt vizsgarész-hely (`reading`, `language-use`, `listening` = objektív; `writing` = beadás;
`speaking` = szóbeli) tantárgyanként más nevet, URL-részt és funkciókat kap a `structure.json`-ból (pl. matematika: `rovid-feladatok`,
`kidolgozott-feladatok`, `szobeli`). Az aktuális tantárgy a beállításokban van (`examConfig` = az aktuális, `configFor(id)` = bármelyik).
**Az app futás közben semmilyen AI API-t nem hív.** Minden AI-munkát Claude Code végez a `.claude/commands/` parancsokkal:
a feladatbankot fájlokba generálja (`content/`), az írás- és szóbeli javítást a csere-mappán keresztül végzi (`exchange/`).

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) + Tailwind CSS 4
- SQLite (`better-sqlite3`) + Drizzle ORM, migrációk a `drizzle/` mappában, adatbázis: `data/app.db`
- Zod 4 a tartalom-, konfigurációs és feedback-sémákhoz
- `ts-fsrs` 5.x (FSRS) a szókártyákhoz
- Web Speech API (böngészős TTS és beszédfelismerés) – nincs külső szolgáltatás
- Vitest (logika), Playwright (fő folyamatok, a gépre telepített Chromiummal)

## Parancsok

| Parancs | Mit csinál |
|---|---|
| `npm run setup` | telepítés, migrálás, tartalom ellenőrzése és betöltése |
| `npm run dev` | dev szerver (előtte automatikusan betölti a `content/` változásait) |
| `npm run dev:lan` | dev szerver a helyi hálózaton (telefonról: `http://<gép-ip>:3000`) |
| `npm run validate-content` | minden `content/` fájl séma- és logikai ellenőrzése |
| `npm run validate-feedback` | az `exchange/outbox/` javításainak ellenőrzése (adatbázis nélkül) |
| `npm run import-feedback` | az `exchange/outbox/` javításainak és a szókártya-kiegészítéseknek a beolvasása |
| `npm run exchange-status` | a javításra váró beadások listája |
| `npm run seed` | a `content/` betöltése az adatbázisba (idempotens) |
| `npm run typecheck` / `npm test` / `npm run test:e2e` | TypeScript, Vitest, Playwright |
| `npm run check` | typecheck + teszt + tartalomvalidálás együtt |
| `npm run db:generate` | új migráció a `lib/db/schema.ts` változása után |
| `npm run desktop:dev` | Electron-héj a futó `npm run dev` szerver ellen (http://localhost:3000; előbb az `npm run dev`) |
| `npm run desktop:build` | asztali app kicsomagolt mappába (`desktop/out/<os>-unpacked`): standalone `next build`, szerver, natív modul, héj, `electron-builder --dir` |
| `npm run desktop:dist` | ugyanaz, de telepítő az aktuális OS-re (`desktop/out/`) |
| `npm run desktop:smoke` | a kész kicsomagolt app füsttesztje (`--smoke-test`, ideiglenes adatmappa, képernyőkép, exit 0) |
| `npm run release -- X.Y.Z --commit --tag` | verzióemelés, CHANGELOG „Kiadatlan” → „X.Y.Z – dátum”, commit, címke; utána `git push origin vX.Y.Z` indítja a kiadást |

## Claude Code parancsok (`.claude/commands/`)

| Parancs | Mit csinál | Példa |
|---|---|---|
| `/feladatok <rész> <szint> <darab> [témakör] [hibakategória]` | új feladatok a `content/`-be | `/feladatok nyelvhelyesseg emelt 10` |
| `/javitas [beadás-id]` | az `exchange/inbox/` beadásainak javítása → `exchange/outbox/` | `/javitas` |
| `/szokincs [témakör] [szint] [darab]` | hiányos szókártyák kiegészítése, új pakli | `/szokincs kornyezet emelt 40` |
| `/import-hivatalos <mappa>` | hivatalos feladatsor (`data/official/<mappa>/`) → `content/` | `/import-hivatalos 2024-majus-emelt` |
| `/lecke <tantárgy> <fájl> [témakör]` | a tanár diasora (`data/lessons/<tantárgy>/<fájl>`) → feladatok, tételek, kártyák, szabálytár a `content/`-be | `/lecke gazdasagi-ismeretek Gazdasagi_ismeretek_20261017.pdf` |

A parancsok neve, paraméterei és példái a `config/commands.json`-ban vannak (ebből dolgozik a „Parancsok” oldal és a tippek is).
Ha parancsot módosítasz, a `config/commands.json`-t és a `.claude/commands/<név>.md`-t is frissítsd (teszt ellenőrzi).

**Szabályok minden parancsra:** csak a `content/` és az `exchange/` mappákba írnak; a végén lefuttatják a
`npm run validate-content`-et (vagy `npm run validate-feedback`-et), kijavítják, amit a validátor kifogásol, és röviden összefoglalják, mit csináltak.

## Mappaszerkezet

```
app/                 oldalak (magyar URL-ek: /olvasas, /nyelvhelyesseg, /hallas, /iras, /szobeli, /szokincs, /hibanaplo,
                     /szabalytar, /utmutatok, /kifejezesek, /temakorok, /vizsga, /probaerettsegi, …)
  actions*.ts        server actionök (minden írás az adatbázisba ezeken megy át)
  api/health/        életjel-végpont – az Electron-héj erre vár induláskor
components/          React komponensek (exercise/ = közös feladatlejátszó)
  desktop/           az asztali app UI-ja (bridge.ts hookok, UpdateBar arany sáv, TopbarUpdateButton, DesktopSettings kártya) – böngészőben null
lib/
  content/           tartalomsémák (schema.ts), betöltés, validátor, seedelés, szöveg-segédfüggvények
  db/                Drizzle séma és kapcsolat
  exam/config.ts     a config/subjects.json és a config/subjects/<tantárgy>/*.json betöltése és sémái (examConfig = az aktuális tantárgy, configFor(id) = bármelyik)
  exchange/          beadás- és feedback-séma, csere-mappa, promptok
  scoring/           ellenőrzés (alternatív válaszok, elírás), vizsgapont, százalék, jegy, küszöbök
  vocab/             szókártyák (szó, „javítsd ki” kártya), FSRS
  lessons.ts         Szabálytár (leckék, mini-gyakorlás ellenőrzése)
  guides.ts          Útmutatók
  targeted.ts        célzott gyakorlás, hibák újrapróbálása
  phrases.ts, topics.ts   Kifejezéstár, témakör-oldalak
  mock.ts, plan.ts   próbaérettségi / szintfelmérő, Mai terv
  i18n/hu.ts         MINDEN magyar UI-szöveg (az asztali app szövegei is: t.desktop)
  startup.ts         induláskori mappák, automatikus mentés, seed (APP_SEED_ON_START=1; az instrumentation.ts hívja)
config/
  exam/              hivatalos vizsgaadatok (szerkezet, pontok, rubrikák, témakörök, feladattípusok, jegyhatárok)
  app.json           app-beállítások (javulási küszöb, készletjelző, becslés)
  commands.json      a Claude Code parancsok leírása
content/<rész>/<szint>/<id>.json   a tartalombank (rész: reading, language-use, listening, writing, speaking, vocabulary, grammar, guide)
exchange/inbox|outbox|archive|vocab   javítási csere-mappa (git-ignorált)
data/app.db, data/official/, data/backups/   felhasználói adatok (git-ignorált)
scripts/             CLI-szkriptek (setup, seed, validate, import); release.ts = verzióemelés + CHANGELOG + commit + címke
  desktop/           bundle.ts, build.ts, smoke.ts, release-notes.ts (asztali build, füstteszt, a kiadás szövege a CHANGELOG-ból)
tests/ (Vitest), e2e/ (Playwright)
desktop/             Electron-héj: main.ts (főfolyamat), preload.ts (window.desktop), shared.ts (IPC-szerződés), build/ (ikon),
                     README.md (fejlesztői jegyzet); dist/ (main.cjs, preload.cjs, server/) és out/ (telepítők) git-ignorált build-kimenet
electron-builder.yml csomagolás (appId, fájlok, extraResources, NSIS / dmg / AppImage, publish = GitHub Releases)
instrumentation.ts   a Next-szerver indulásakor fut: APP_SEED_ON_START=1 esetén lib/startup.ts
.github/workflows/   ci.yml (check + desktop:bundle minden pushnál), release.yml (telepítők v* címkére vagy kézi indításra → Releases)
CHANGELOG.md         változásnapló – a „Kiadatlan” szakaszból lesz a kiadás szövege
TELEPITES.md         laikus telepítési útmutató az asztali apphoz
```

## Konvenciók

- Kód és kommentek angolul; a UI szövegei kizárólag a `lib/i18n/hu.ts`-ben.
- Hivatalos vizsgaadat (idő, pont, rubrika, jegyhatár, egyenértékűség, témakör) **soha nincs a kódban**, csak a `config/subjects/<tantárgy>/*.json`-ban, forrással.
- Adatbázis-írás csak a `lib/` függvényein keresztül, server actionből vagy szkriptből. A pontszámot mindig a szerver számolja újra.
- Sémaváltozás: `lib/db/schema.ts` → `npm run db:generate` → a migráció commitolandó.
- Kliens komponens nem importálhat Node-modult (`lib/db`, `lib/exam/config`, `fs`); a konfigurációt a szerver komponens adja át propként.
- Minden fázis végén: `npm run check`, `npm run build`, commit.

## Asztali alkalmazás (Electron)

Az app telepíthető programként is fut (Windows NSIS-telepítő, macOS dmg, Linux AppImage), önfrissítéssel a GitHub Releases-ből
(`github.com/David-Getta/Angol-erettsegi`). A héj (`desktop/main.ts`) a Next standalone szervert (`desktop/dist/server`; `next build`
`DESKTOP_BUILD=1`-gyel, `output: "standalone"` csak ekkor) **gyerekfolyamatként** indítja `ELECTRON_RUN_AS_NODE`-dal egy szabad 127.0.0.1-es
porton, `APP_SEED_ON_START=1`-gyel (→ `instrumentation.ts` → `lib/startup.ts`: mappák, automatikus mentés, seed az első kérés előtt), megvárja
a `/api/health`-et, és akkor nyitja az ablakot (addig splash); magyar menü, `electron-updater`, IPC-kezelők. A szerver a mappáit a `lib/paths.ts`
meglévő env-változóin kapja (`APP_ROOT`, `APP_CONFIG_DIR`, `APP_CONTENT_DIR`, `APP_DATA_DIR`, `APP_EXCHANGE_DIR`): adat Windowson
`%APPDATA%\erettsegi-felkeszito\data` (+ `backups\`, `logs\`), macOS-en `~/Library/Application Support/erettsegi-felkeszito/`, Linuxon
`~/.config/erettsegi-felkeszito/`; beadás-mappa alapból `Dokumentumok/Érettségi felkészítő/exchange`, a Beállításokban átállítható (pl. a projekt
`exchange/` mappájára, hogy a `/javitas` lássa; a szerver újraindul). `desktop/preload.ts` → `window.desktop` (`contextBridge`); a típusos
szerződés (`UpdateState`, `DesktopInfo`, `DesktopApi`, IPC-csatornanevek) a `desktop/shared.ts`-ben. UI: `components/desktop/` (`bridge.ts`
hookok, `UpdateBar.tsx` arany sáv, `TopbarUpdateButton.tsx` ⭳ ikon, `DesktopSettings.tsx` kártya a Beállításokban: verzió, frissítés, mappák,
másik beadás-mappa, frissítési kulcs, „Megnyitás böngészőben” – a beszédfelismerés csak böngészőben megy, az Electronban nincs).
Csomagolás: `electron-builder.yml` (appId `hu.davidgetta.erettsegi-felkeszito`; az asar-ban csak `main.cjs`, `preload.cjs`, `package.json`;
`extraResources` = server, content, config, drizzle, `.claude/commands`, ikon; NSIS per-user segített telepítő magyarul; mac aláíratlan;
Linux AppImage). A Claude Code parancsok továbbra is a projektmappában futnak; az új tartalom app-frissítésként ér a tanulóhoz.

**Parancsok:** `npm run desktop:dev` (héj a futó `npm run dev` ellen), `npm run desktop:build` (kicsomagolt mappa `desktop/out/<os>-unpacked`:
standalone build `.next-desktop`-ba, `desktop/dist/server` összeállítása, Electron-ABI better-sqlite3 prebuilt letöltése, esbuild, `electron-builder --dir`),
`npm run desktop:dist` (telepítő az aktuális OS-re `desktop/out/`-ba), `npm run desktop:smoke` (a kész app `--smoke-test`-tel ideiglenes adatmappában,
képernyőkép, exit 0). Telepítőt csak a cél-OS-en lehet építeni – a GitHub Actions mindhármat megépíti.

**Kiadás:** a változások a `CHANGELOG.md` „## Kiadatlan” szakaszába → `npm run release -- X.Y.Z --commit --tag` (package.json verzió, a szakaszból
„## X.Y.Z – dátum”, commit „Kiadás: vX.Y.Z”, címke) → `git push origin vX.Y.Z` → `.github/workflows/release.yml` (`npm run check`, három OS-en
`desktop:dist` + füstteszt, Releases-feltöltés a `latest*.yml`-ekkel – ezekből veszi észre a telepített app az új verziót; a kiadás szövege
`npm run release:notes -- X.Y.Z --out file.md`). Kézi indítás: Actions → release → Run workflow → version. `ci.yml` minden pushnál: `npm run check` +
`npm run desktop:bundle`. Frissítés: induláskor (~4 s) és hatóránként; Windows/Linux az appon belül letölt, csendben telepít, újraindul;
macOS-en (nincs Apple Developer aláírás) a gomb a Releases oldalt nyitja meg. Az első asztali kiadás az 1.0.0.

**Szabályok:**
- Az Electron major **39–42** között marad (a better-sqlite3 12.x csak ezekhez ad előre fordított binárist, ABI 140–146); `tests/desktop.test.ts` őrzi.
- Az Electron-folyamat **soha nem importál** Next-et vagy `lib/db`-t – a szerverrel csak http-n beszél.
- Minden asztali UI-szöveg (menü, splash is) a `lib/i18n/hu.ts`-ben, `t.desktop` alatt.
- Az oldal az asztali appot csak a `window.desktop`-on ismeri fel (böngészőben `undefined`), ezért minden asztali komponens ott `null`-t ad.
- A héj sem hív semmilyen AI API-t.
- Verzió = a `package.json` verziója (egyetlen forrás), csak az `npm run release` emeli.
- A CHANGELOG „Kiadatlan” szakasza valódi változásokat írjon le: ebből lesz a kiadás szövege, amit a tanuló a frissítés előtt olvas („Mi változik?”).

## Tartalomséma (röviden – a teljes séma: `lib/content/schema.ts`)

Közös mezők: `schemaVersion: 1`, `id` (= fájlnév; a tantárgy `idPrefix`-ével kezdődik, pl. `mat-rd-kozep-…`, `mat-gr-<kategória>` – az angolnak nincs előtagja, az azonosítók az adatbázisban globálisak), `level` (`kozep`|`emelt`), `source` (`generated`|`official`),
`official` (csak hivatalosnál: év, időszak, szint, rész, feladat), `subject` (tantárgy, = a mappa), `topic` (a tantárgy `topics.json`-jának azonosítója),
`title`, `createdAt`, `tags`, opcionálisan `reservedFor` (`mock`|`diagnostic`).

- **reading / language-use / listening** (`ObjectiveTask`): `type` (a `config/subjects/<tantárgy>/task-types.json`-ból), angol `instructions`,
  `passage.blocks[]` (a hiányok helye a szövegben `[[n]]`, hiányzó címnél/bekezdéskezdésnél `gap: "n"`), hallásnál `listening`
  (beszélők hanggal, leirat soronként), közös opciólista `options` (címek, mondatok, beszélők), **kötelező példa** `example` (id `"0"`),
  `items[]` (id 1..n). Item fajták: `choice` (saját A–D opciók), `match` (közös opciólistából), `tf` (`T`/`F`/`NG`), `text`
  (elfogadott válaszok listája, `cue` a szóképzéshez/igéhez, `maxWords`; `caseSensitive: true`, ha a kis-/nagybetű számít – genotípus Aa, vegyjel Co/CO, német főnév; ilyenkor a nagybetűt tartalmazó válaszok pontosan, a csupa kisbetűsek bármilyen írásmóddal egyeznek; nem nyelvi tárgyaknál a tizedesvessző = pont, a számok és jelek körüli szóköz nem számít). **Minden itemnél kötelező:** `category`
  (hibakategória), `explanation` (magyarul: mi a helyes megoldás és MIÉRT); olvasásnál és hallásnál `evidence`
  (szó szerinti idézet a szövegből/leiratból) és feleletválasztásnál `wrongOptions` (miért rossz a többi opció).
  Olvasásnál kötelező a `glossary` (nehezebb szavak magyar jelentéssel).
- **writing**: `taskNumber` (1|2), `type`, `register`, `situation`, `points[]` (irányítási szempontok), `wordLimit`, `suggestedMinutes`, `usefulPhrases`,
  `modelAnswer` (mintamegoldás a szóhatáron belül; `pointsCovered`: pontonként szó szerinti idézet; `notes`: magyarul, miért maximális pontos –
  az első beadás után látszik, a javítási anyagba nem kerül be).
- **speaking**: `type` (`interview`|`situation`|`picture`|`debate`|`presentation`), `partNumber`, magyar `instructionsHu`,
  típustól függően `questions`, `situation`, `scenes` (képleírást helyettesítő jelenetleírás), `prompts`, `debate` (tétel, kiosztott álláspont, vizsgáztatói ellenérvek),
  `sampleAnswer` (`turns`: vizsgáztató/vizsgázó megszólalások, `notes` magyarul – a javítási anyagba nem kerül be).
- **vocabulary**: `type: "deck"`, `cards[]` (`term`, `meaning`, `example` – a szót tartalmazó angol mondat, `collocation`, `pos`).
- **grammar** (Szabálytár, `/szabalytar`): hibakategóriánként egy lecke, `content/<tantárgy>/grammar/kozep/<előtag>gr-<kategória>.json` (szintfüggetlen,
  mindig a `kozep` mappában, `topic: "nyelvtan"`): `summaryHu`, `rules[]` (magyar magyarázat, angol példák fordítással, `emeltOnly`),
  `commonMistakes[]` (rossz → jó → miért, magyar anyanyelvű tanulók tipikus hibái), `examTips[]`, `practice[]` (`choice`/`text` itemek
  magyar magyarázattal), `relatedCategories`. Szövegértési kategóriáknál a lecke megoldási stratégia.
- **guide** (Útmutatók, `/utmutatok`): `content/<tantárgy>/guide/kozep/<előtag>gd-<type>-<target>.json` (szintfüggetlen, `topic: "utmutato"`):
  `type` `writing` (szövegtípus) | `speaking` (szóbeli feladattípus) | `exam` (vizsgarész); `summaryHu`, `steps[]`, `phrases[]`
  (csoport, angol, magyar), `mistakes[]`, `checklist[]`, `timing`, `example`, `levelNotes`.

Hibakategóriák: `config/subjects/<tantárgy>/error-categories.json` (pl. `tense`, `article`, `preposition`, `word-order`, `collocation`,
`word-formation`, `modal`, `passive`, `conditional`, `reported-speech` …; szövegértéshez `detail`, `gist`, `inference` …).

## Minőségi szabályok a generáláshoz

- Minden objektív itemnél ellenőrizd újra a kulcsot: egyértelmű-e, nincs-e más helyes válasz, amit nem soroltál fel alternatívaként.
- Hibáknál mindig legyen leírva **a helyes megoldás és az, hogy miért** az (magyarul, a szabállyal).
- Változatos témák a hivatalos témakörökből; generálás előtt nézd meg, mi van már a bankban (ne ismétlődjenek szövegek, helyzetek).
- Hiteles szint: középszint A2–B1, emelt B2. Szöveghossz: `config/subjects/<tantárgy>/structure.json` → `textLength`.
- Generált tartalom mindig `source: "generated"`. Generált feladat soha nem lehet hivatalosként jelölve.

## Szabályok a javításhoz (`/javitas`)

- Szigorú, következetes pontozás a rubrika (`config/subjects/<tantárgy>/writing-rubric-*.json`, `speaking-rubric-*.json`) alapján; ne kerekíts felfelé,
  kétes esetben az alacsonyabb sáv; minden szempontnál indoklás.
- Minden hibát a hibakategóriákkal címkézz; a magyarázatok magyarul (mi a hiba, mi a helyes, miért), a javított változatok angolul.
- A feedback formátuma: `lib/exchange/schema.ts` → `FeedbackSchema`. Ellenőrzés: `npm run validate-feedback`.
