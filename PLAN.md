# PLAN.md – fázisterv

Minden fázis végén: `npm run check` (typecheck + Vitest + tartalomvalidátor), `npm run build`, commit, rövid összefoglaló.
A fázisok után az app mindig futtatható; ami kész, az használható.

## 1. Alap
- [x] Projektváz: Next.js 16, TypeScript strict, Tailwind 4, Vitest, Playwright
- [x] SQLite + Drizzle séma, első migráció (`drizzle/0000_init.sql`), automatikus migrálás induláskor
- [x] Beállítások (szint, vizsgadátum, cél, szókártya-limitek, felolvasás, téma) + globális szintválasztó
- [x] Tartalomsémák (`lib/content/schema.ts`) és validátor (`npm run validate-content`)
- [x] Vizsga-config (`config/exam/*.json`) az Oktatási Hivatal aktuális leírásával ellenőrizve (forrásokkal, `meta.verifiedAt`; a nyitott pontokat a fájlok `meta.notes` mezője jelöli)
- [x] Navigáció, sötét/világos téma, üres dashboard
- Ellenőrzés: `npm run setup && npm run dev`, a szintváltó működik, `npm run validate-content` lefut

## 2. Claude Code parancsok + kezdő tartalom
- [x] `.claude/commands/{feladatok,javitas,szokincs,import-hivatalos}.md`
- [x] `config/commands.json`, „Parancsok” oldal parancsépítővel, Másolás gombok
- [x] Helyzetfüggő tipp-komponens (`components/CommandTip.tsx`)
- [x] Kezdő tartalombank szintenként, validálva, seedelve (167 fájl)
- Ellenőrzés: a Parancsok oldalon mind a 4 parancs másolható; teszt: minden parancshoz van fájl

## 3. Íráskészség + hibanapló
- [x] Feladatkártyák, szerkesztő élő szószámlálóval, időzítővel, vizsga módban kikapcsolt helyesírás-ellenőrzéssel
- [x] Önellenőrző lista, beadás → `exchange/inbox/<id>.json`
- [x] Javítás: `/javitas` → outbox → „Javítások importálása” / `npm run import-feedback`; vagy prompt másolása → beillesztés
- [x] Javítás nézet (kiemelt hibák, szempontonkénti pontok), átírási kör, változatok egymás mellett
- [x] Hibanapló: kategóriák, trend, legutóbbi hibák, „Gyakoroltasd ezt”
- Ellenőrzés: beadás → javítás → import → átírás → hibanapló végigvihető (Playwright)

## 4. Nyelvhelyesség
- [x] Lyukas szöveg (nyitott, feleletválasztós), szóképzés, igealakok, kimaradt szavak, hibakeresés, mondatrész-beillesztés
- [x] Ellenőrzés alternatív megoldásokkal, kis/nagybetű és szóköz nélkül, elírás-jelzés
- [x] Célzott gyakorlás a hibanapló kategóriáiból

## 5. Szókincs
- [x] FSRS (`ts-fsrs` 5), kártyák szövegből, javításból, paklikból; 4 kártyatípus; napi limit; ismétlő felület

## 6. Olvasott szöveg értése
- [x] Feladattípusok, gyakorlás/vizsga mód, kattintható szavak, szójegyzék

## 7. Hallott szöveg értése
- [x] TTS-lejátszás beszélőnkénti hanggal, felkészülési idő, kétszeri meghallgatás, leirat kiemeléssel, hivatalos mp3

## 8. Szóbeli
- [x] Kérdéskártyák, szituációk, jelenetleírások, vita; felolvasás, időzítő, beszédfelismerés; vizsgáztató-prompt; beadás javításra

## 9. Dashboard, szintfelmérő, Mai terv, statisztika
- [x] Visszaszámláló, becsült pontszám + 12%-os küszöb + cél, Mai terv, streak, heti idő, készletjelző, javításra vár
- [x] Szintfelmérő (CEFR-becslés, erősségek/gyengeségek)
- [x] Statisztika

## 10. Próbaérettségi + hivatalos feladatsorok
- [x] Teljes írásbeli szimuláció részenkénti szigorú időzítéssel, eredmény (pont, %, küszöbök, jegy, nyelvvizsga)
- [x] `data/official/` kezelése, `/import-hivatalos`, hivatalos/generált jelölés

## 11. Csiszolás
- [x] Export/import JSON, adatbázis-mentés
- [x] Playwright-tesztek a fő folyamatokra
- [x] README magyarul

## 12. Továbbfejlesztés
- [x] Szabálytár (`/szabalytar`): hibakategóriánként magyar szabálymagyarázat, tipikus hibák, érettségi-tippek, mini-gyakorlás; link minden hibából
- [x] Mintamegoldás minden írásfeladathoz (az első beadás után), mintaválasz a szóbeli feladatokhoz
- [x] Hibák újrapróbálása (`/hibanaplo/ujraproba`) és „javítsd ki” szókártyák a javításokból
- [x] Az érettségiről (`/vizsga`), Kifejezéstár (`/kifejezesek`), Témakörök (`/temakorok`)
- [x] Több gyakorlófeladat: +4 olvasás és +3 hallás szintenként
- [x] E2E: próbaérettségi, Szabálytár, minden oldal betöltése hiba nélkül; mobil elrendezés javítása; web manifest

---

## Döntések

| # | Döntés | Indok |
|---|---|---|
| D1 | **Next.js 16.4** (App Router, Turbopack), React 19 | a legfrissebb stabil verzió; a `params` Promise, server actionök |
| D2 | **better-sqlite3** + Drizzle 0.45, migráció futásidőben (`getDb()` első hívásakor) | szinkron, gyors, egyfelhasználós; friss gépen nincs külön migrálási lépés |
| D3 | A `tasks` tábla a `content/` tükre (hash alapján idempotens seed, törölt fájl → `active=false`) | a próbálkozások hivatkoznak a feladatokra, ezért nem törlünk |
| D4 | Egy tartalomfájl = egy feladat (`content/<rész>/<szint>/<id>.json`), a fájlnév = id | könnyű generálni, diffelni, validálni |
| D5 | Hiányok jelölése a szövegben `[[n]]`, cím/bekezdéskezdés hiánya `gap: "n"` | egyszerű, generálásnál nehéz elrontani, a validátor ellenőrzi |
| D6 | Az objektív feladatot a kliens is ellenőrzi (azonnali visszajelzés), de a mentett pontszámot a szerver számolja újra | lokális, egyfelhasználós app; a statisztika mégis megbízható |
| D7 | Elírás-tűrés: Levenshtein ≤1 (4–7 betű) / ≤2 (8+); alapból **nem** fogad el, csak jelez (`config/app.json`) | a vizsgán a helyesírási hiba hibának számít a nyelvhelyességben |
| D8 | Claude Code parancsok a **`.claude/commands/*.md`** formában | a jelenlegi Claude Code-ban működik `$ARGUMENTS`-szel, egyszerű |
| D9 | A javítási prompt egyetlen helyen (`lib/exchange/prompts.ts`) készül, és minden inbox-fájlba bekerül (`instructions`) | a `/javitas`, a „Prompt másolása” és az inbox nem térhet el egymástól |
| D10 | Import után az inbox- és outbox-fájl az `exchange/archive/`-ba kerül | az inbox mindig a ténylegesen javításra várókat mutatja |
| D11 | Hiányos szókártyák: az app karbantartja az `exchange/vocab/incomplete.json`-t, a `/szokincs` az `exchange/vocab/completions.json`-ba ír, az app ezt betölti | a parancsok csak `content/`-be és `exchange/`-be írhatnak |
| D12 | **ts-fsrs 5.x** (nem 6) | a 6.x Node ≥24-et kér, a projekt Node ≥20-on fusson |
| D13 | Vitest 3.2 (nem 4) | az npm 10 a Vitest 4 peer-függőségeinél összeomlik („edgesOut”) |
| D14 | Playwright 1.63.0 pontosan rögzítve | a gépre telepített Chromiumhoz illik; a felhasználó gépén `npx playwright install chromium` |
| D15 | A próbaérettségi a szóbelit nem tartalmazza; a teljes %-hoz a szóbelit a legutóbbi szóbeli javításokból becsli, ennek híján az írásbeli arányával | a spec csak írásbeli szimulációt kér, de jegyet és egyenértékűséget is |
| D16 | A próbaérettségihez és a szintfelmérőhöz a bank feladatai `reservedFor` jelölést kaphatnak; a gyakorló listák ezeket alapból elrejtik | így marad „még nem használt” szett a próbaérettségire |
| D17 | Vizsgapont-átváltás: arányos, felfelé kerekítve 0,5-től (`convertToExamPoints`); ha a configban van pontos táblázat és a nyers maximum egyezik, a táblázat | a hivatalos útmutatók feladatsoronkénti táblázatot adnak, a generált szettek nyers maximuma eltérhet |
| D18 | Nincs ESLint (a Next 16 kivette a `next lint`-et); a minőségkapu a `tsc --noEmit` strict módban + tesztek | kevesebb függőség |
| D19 | Hang: Web Speech API; beszélőnként a böngésző angol hangjai közül nem/akcentus szerint választ; ha csak egy hang van, hangmagassággal különít el | ingyenes, offline is működik Chrome-ban (a beszédfelismeréshez internet kell a Chrome-nak) |
| D20 | Ha a Web Speech beszédfelismerés nem elérhető, a szóbeli választ be is lehet gépelni (`transcriptSource: "typed"`) | Firefox/Safari alatt is használható maradjon |
| D21 | A próbaérettségi hallási részének ideje legalább a becsült TTS-hanganyag (2 meghallgatás + felkészülés + szünetek) + 2 perc | a felolvasás sebessége gépenként eltér; a rész ne érjen véget, mielőtt a hanganyag kétszer elhangzik |
| D22 | Szintenként egy teljes szett `reservedFor: "mock"`, egy rövid szett `"diagnostic"` jelölést kapott; a próbaérettségi először a fenntartottakat, majd a többi megoldatlant használja | így gyakorlás közben sem fogy el a próbaérettségi szettje |
| D23 | Párhuzamosan generált tartalomnál utólag kiszűrtük az azonos szintű, ugyanazt a témát feldolgozó szövegeket (6 nyelvhelyességi szöveg új témát kapott) | „ne ismétlődjenek szövegek és helyzetek” |
| D24 | A hivatalos vizsgaadatokat a 2024–2026-os OH javítási-értékelési útmutatók (Nat2020) keresőben indexelt szövegéből és Eduline-cikkekből ellenőriztük; minden config fájl `meta.sources`/`verifiedAt`/`notes` mezőt kapott, a Beállítások oldal megmutatja | a futtató környezet hálózata nem engedte az OH-oldalak és PDF-ek közvetlen letöltését; ami így sem igazolható, az a `notes`-ban „NEM ellenőrzött” jelölést kapott |
| D25 | Íráskészség: a szempontok és pontok a hivatalos táblázat szerint (közép 11 + 22, emelt 15 + 15 nyers pont = vizsgapont, `conversion: identity`); a középszintű 1. feladat szóhatára 80–100 szó lett (a 7 kártya is) | a korábbi ideiglenes 50–80 szó és 10 + 20 pont nem felelt meg a hivatalos útmutatónak |
| D26 | Szóbeli: feladattípusonkénti rubrika (`tasks[].types`), feladatonként 4 + 3 + 3 pont; a kiejtést (3 pont, `overall`) az app nem pontozza, mert átiratból nem ítélhető meg; emelten a feladatonkénti hivatalos bontás nem volt ellenőrizhető, ezért a középszintű szerkezet arányosan 30 pontra számolva | a gyakorló feladat egy-egy vizsgafeladatnak felel meg, így a pontozás a hivatalos szerkezetet követi |
| D27 | Emelt szinten az elégséges határa 25% (2024 óta), a középszinttel azonos | a 2026-os pontozási szabályok szerint |
| D28 | A szabályleckék külön tartalomrész (`grammar`), hibakategóriánként egy fájl, szintfüggetlen (`kozep` mappa, `emeltOnly` jelölés) | a szabály nem függ a szinttől; így a validátor, a seed és a /feladatok parancs ugyanúgy kezeli, mint a többi tartalmat |
| D29 | A minta- és mintaválaszok (`modelAnswer`, `sampleAnswer`) nem kerülnek be a javítási anyagba (inbox `task.card`) | ne horgonyozzák le a pontozást |
| D30 | Írásnál a mintamegoldás csak az első beadás után látszik, szóbelinél összecsukva mindig elérhető | írásnál a saját próbálkozás a lényeg; szóbelin a minta a felkészülést segíti |
| D31 | Hibák újrapróbálása csak nyelvhelyességi itemekre, legkorábban 20 óra múlva (`config/app.json → review`) | ezek önmagukban is megoldhatók; a késleltetés a felidézést gyakoroltatja |
| D32 | A javításokból „fix” típusú FSRS-kártya lesz, de csak kérésre (gomb) | nem minden javítás érdemes ismétlésre; a tanuló dönti el |
