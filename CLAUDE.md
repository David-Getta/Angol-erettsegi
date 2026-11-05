# CLAUDE.md – Angol érettségi felkészítő app

Lokális, egyfelhasználós Next.js app egy magyar gimnazistának (angol érettségi, 2027 tavasz, közép és emelt szint).
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

## Claude Code parancsok (`.claude/commands/`)

| Parancs | Mit csinál | Példa |
|---|---|---|
| `/feladatok <rész> <szint> <darab> [témakör] [hibakategória]` | új feladatok a `content/`-be | `/feladatok nyelvhelyesseg emelt 10` |
| `/javitas [beadás-id]` | az `exchange/inbox/` beadásainak javítása → `exchange/outbox/` | `/javitas` |
| `/szokincs [témakör] [szint] [darab]` | hiányos szókártyák kiegészítése, új pakli | `/szokincs kornyezet emelt 40` |
| `/import-hivatalos <mappa>` | hivatalos feladatsor (`data/official/<mappa>/`) → `content/` | `/import-hivatalos 2024-majus-emelt` |

A parancsok neve, paraméterei és példái a `config/commands.json`-ban vannak (ebből dolgozik a „Parancsok” oldal és a tippek is).
Ha parancsot módosítasz, a `config/commands.json`-t és a `.claude/commands/<név>.md`-t is frissítsd (teszt ellenőrzi).

**Szabályok minden parancsra:** csak a `content/` és az `exchange/` mappákba írnak; a végén lefuttatják a
`npm run validate-content`-et (vagy `npm run validate-feedback`-et), kijavítják, amit a validátor kifogásol, és röviden összefoglalják, mit csináltak.

## Mappaszerkezet

```
app/                 oldalak (magyar URL-ek: /olvasas, /nyelvhelyesseg, /hallas, /iras, /szobeli, /szokincs, /hibanaplo,
                     /szabalytar, /kifejezesek, /temakorok, /vizsga, /probaerettsegi, …)
  actions*.ts        server actionök (minden írás az adatbázisba ezeken megy át)
components/          React komponensek (exercise/ = közös feladatlejátszó)
lib/
  content/           tartalomsémák (schema.ts), betöltés, validátor, seedelés, szöveg-segédfüggvények
  db/                Drizzle séma és kapcsolat
  exam/config.ts     a config/exam/*.json betöltése és sémái
  exchange/          beadás- és feedback-séma, csere-mappa, promptok
  scoring/           ellenőrzés (alternatív válaszok, elírás), vizsgapont, százalék, jegy, küszöbök
  vocab/             szókártyák (szó, „javítsd ki” kártya), FSRS
  lessons.ts         Szabálytár (leckék, mini-gyakorlás ellenőrzése)
  targeted.ts        célzott gyakorlás, hibák újrapróbálása
  phrases.ts, topics.ts   Kifejezéstár, témakör-oldalak
  mock.ts, plan.ts   próbaérettségi / szintfelmérő, Mai terv
  i18n/hu.ts         MINDEN magyar UI-szöveg
config/
  exam/              hivatalos vizsgaadatok (szerkezet, pontok, rubrikák, témakörök, feladattípusok, jegyhatárok)
  app.json           app-beállítások (javulási küszöb, készletjelző, becslés)
  commands.json      a Claude Code parancsok leírása
content/<rész>/<szint>/<id>.json   a tartalombank (rész: reading, language-use, listening, writing, speaking, vocabulary, grammar)
exchange/inbox|outbox|archive|vocab   javítási csere-mappa (git-ignorált)
data/app.db, data/official/, data/backups/   felhasználói adatok (git-ignorált)
scripts/             CLI-szkriptek (setup, seed, validate, import)
tests/ (Vitest), e2e/ (Playwright)
```

## Konvenciók

- Kód és kommentek angolul; a UI szövegei kizárólag a `lib/i18n/hu.ts`-ben.
- Hivatalos vizsgaadat (idő, pont, rubrika, jegyhatár, egyenértékűség, témakör) **soha nincs a kódban**, csak a `config/exam/*.json`-ban, forrással.
- Adatbázis-írás csak a `lib/` függvényein keresztül, server actionből vagy szkriptből. A pontszámot mindig a szerver számolja újra.
- Sémaváltozás: `lib/db/schema.ts` → `npm run db:generate` → a migráció commitolandó.
- Kliens komponens nem importálhat Node-modult (`lib/db`, `lib/exam/config`, `fs`); a konfigurációt a szerver komponens adja át propként.
- Minden fázis végén: `npm run check`, `npm run build`, commit.

## Tartalomséma (röviden – a teljes séma: `lib/content/schema.ts`)

Közös mezők: `schemaVersion: 1`, `id` (= fájlnév), `level` (`kozep`|`emelt`), `source` (`generated`|`official`),
`official` (csak hivatalosnál: év, időszak, szint, rész, feladat), `topic` (a `config/exam/topics.json` azonosítója),
`title`, `createdAt`, `tags`, opcionálisan `reservedFor` (`mock`|`diagnostic`).

- **reading / language-use / listening** (`ObjectiveTask`): `type` (a `config/exam/task-types.json`-ból), angol `instructions`,
  `passage.blocks[]` (a hiányok helye a szövegben `[[n]]`, hiányzó címnél/bekezdéskezdésnél `gap: "n"`), hallásnál `listening`
  (beszélők hanggal, leirat soronként), közös opciólista `options` (címek, mondatok, beszélők), **kötelező példa** `example` (id `"0"`),
  `items[]` (id 1..n). Item fajták: `choice` (saját A–D opciók), `match` (közös opciólistából), `tf` (`T`/`F`/`NG`), `text`
  (elfogadott válaszok listája, `cue` a szóképzéshez/igéhez, `maxWords`). **Minden itemnél kötelező:** `category`
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
- **grammar** (Szabálytár, `/szabalytar`): hibakategóriánként egy lecke, `content/grammar/kozep/gr-<kategória>.json` (szintfüggetlen,
  mindig a `kozep` mappában, `topic: "nyelvtan"`): `summaryHu`, `rules[]` (magyar magyarázat, angol példák fordítással, `emeltOnly`),
  `commonMistakes[]` (rossz → jó → miért, magyar anyanyelvű tanulók tipikus hibái), `examTips[]`, `practice[]` (`choice`/`text` itemek
  magyar magyarázattal), `relatedCategories`. Szövegértési kategóriáknál a lecke megoldási stratégia.

Hibakategóriák: `config/exam/error-categories.json` (pl. `tense`, `article`, `preposition`, `word-order`, `collocation`,
`word-formation`, `modal`, `passive`, `conditional`, `reported-speech` …; szövegértéshez `detail`, `gist`, `inference` …).

## Minőségi szabályok a generáláshoz

- Minden objektív itemnél ellenőrizd újra a kulcsot: egyértelmű-e, nincs-e más helyes válasz, amit nem soroltál fel alternatívaként.
- Hibáknál mindig legyen leírva **a helyes megoldás és az, hogy miért** az (magyarul, a szabállyal).
- Változatos témák a hivatalos témakörökből; generálás előtt nézd meg, mi van már a bankban (ne ismétlődjenek szövegek, helyzetek).
- Hiteles szint: középszint A2–B1, emelt B2. Szöveghossz: `config/exam/structure.json` → `textLength`.
- Generált tartalom mindig `source: "generated"`. Generált feladat soha nem lehet hivatalosként jelölve.

## Szabályok a javításhoz (`/javitas`)

- Szigorú, következetes pontozás a rubrika (`config/exam/writing-rubric-*.json`, `speaking-rubric-*.json`) alapján; ne kerekíts felfelé,
  kétes esetben az alacsonyabb sáv; minden szempontnál indoklás.
- Minden hibát a hibakategóriákkal címkézz; a magyarázatok magyarul (mi a hiba, mi a helyes, miért), a javított változatok angolul.
- A feedback formátuma: `lib/exchange/schema.ts` → `FeedbackSchema`. Ellenőrzés: `npm run validate-feedback`.
