---
description: Új érettségi-szerű feladatok generálása a tartalombankba (content/)
argument-hint: <rész> <szint> <darab> [témakör] [hibakategória]
---

# /feladatok – új feladatok a tartalombankba

Argumentumok: `$ARGUMENTS`

Formátum: `<rész> <szint> <darab> [témakör] [hibakategória]` – a `-` egy kihagyott opcionális paramétert jelent.

- **rész**: `olvasas` → `reading`, `nyelvhelyesseg` → `language-use`, `hallas` → `listening`, `iras` → `writing`,
  `szobeli` → `speaking`, `szokincs` → `vocabulary`, `szabaly` → `grammar` (szabálylecke a Szabálytárba),
  `utmutato` → `guide` (útmutató az Útmutatók közé)
  (a megfeleltetés: `config/commands.json` → `sectionArgs`)
- **szint**: `kozep` vagy `emelt`
- **darab**: ennyi új fájlt írj (szókincsnél ennyi paklit)
- **témakör** (opcionális): a `config/exam/topics.json` egyik `id`-je
- **hibakategória** (opcionális, főleg nyelvhelyességhez): a `config/exam/error-categories.json` egyik `id`-je

Ha az argumentumok hiányosak vagy érvénytelenek, írd ki a helyes formát egy példával, és állj meg.

## Szabály: csak a `content/` mappába írhatsz. Mást ne módosíts.

## 1. Felkészülés (olvasd el, mielőtt írsz)

1. `CLAUDE.md` – „Tartalomséma” és „Minőségi szabályok a generáláshoz”.
2. `lib/content/schema.ts` – a pontos séma (a validátor ehhez ellenőriz).
3. `config/exam/task-types.json` – a rész hivatalos feladattípusai és szintjei (csak ezeket a `type` értékeket használd);
   `config/exam/structure.json` – `levels.<szint>.textLength` (szöveghossz) és a részek leírása;
   `config/exam/topics.json`; `config/exam/error-categories.json`; íráshoz `config/exam/writing-rubric-<szint>.json` (szóhatárok, feladattípusok);
   szóbelihez `config/exam/speaking-rubric-<szint>.json` és `structure.json` → `oral`.
4. Nézz meg 1–2 meglévő fájlt ugyanebből a részből és szintből formai mintának: `content/<rész>/<szint>/`.
5. **Leltár**: futtasd `npm run validate-content -- --no-warnings`, és nézd meg a `content/<rész>/<szint>/` fájlok `title`, `topic`, `type`
   mezőit (pl. `grep -h '"title"\|"topic"\|"type"' content/<rész>/<szint>/*.json`). Ritkábban szereplő témakört és feladattípust válassz,
   ne ismételj szöveget, helyzetet vagy szereplőt.

## 2. Generálás

- Fájl: `content/<rész>/<szint>/<id>.json`, ahol az `id` = fájlnév, formája `<előtag>-<szint>-<rövid-angol-slug>`
  (előtagok: `rd` olvasás, `lu` nyelvhelyesség, `ls` hallás, `wr` írás, `sp` szóbeli, `vc` szókincs), pl. `lu-emelt-urban-gardens-open-cloze`.
  Az id legyen egyedi (ellenőrizd `ls`-sel).
- Közös mezők: `"schemaVersion": 1`, `"source": "generated"` (**mindig**), `"createdAt": "<mai dátum ÉÉÉÉ-HH-NN>"`, `"revision": 1`, `"tags": []`.
  `official` mezőt generált feladat soha nem kaphat. `reservedFor`-t csak akkor adj, ha a felhasználó kéri.
- **Hitelesség:** középszint A2–B1, emelt B2 – szókincs, mondatszerkezet és szöveghossz is. Az utasítás (`instructions`) angolul,
  az érettségi feladatlapok stílusában; `instructionsHu` rövid magyar összefoglaló.
- **Kötelező példa (0. item)** minden objektív feladatnál, ahogy a vizsgán.
- Ha megadtak hibakategóriát, az itemek legalább kétharmada abba a kategóriába tartozzon (a többi lehet vegyes), és a `category` mező ezt tükrözze.

### Objektív feladatok (olvasás, nyelvhelyesség, hallás)

- Minden itemnél: `category` (hibakategória-id), `explanation` **magyarul: mi a helyes megoldás, és miért** (a szabály, vagy hol és hogyan derül ki a szövegből).
- Olvasás és hallás: minden itemnél `evidence` – **szó szerinti** idézet a szövegből/leiratból, ahol a válasz van (a validátor ellenőrzi);
  feleletválasztásnál (`choice`) `wrongOptions`: minden rossz opcióhoz egy mondat, miért rossz. Címillesztésnél/mondatbeillesztésnél
  (`match`) adj `wrongOptions`-t a legcsábítóbb rossz opcióhoz. A közös opciólistában legyen 1–2 zavaró (felesleges) opció.
- Olvasásnál `glossary`: 6–12 nehezebb szó/kifejezés a szövegből, magyar jelentéssel.
- Nyelvhelyesség, nyitott válasz (`text`): az `answer` tömbben **minden** elfogadható változat (összevonások, brit/amerikai írásmód,
  szinonim szerkezetek); a hibakeresésnél a helyes sor megoldása `"✓"`. Szóképzésnél és igealaknál kötelező a `cue`.
- Hallás: `listening.speakers` (nem, akcentus), `listening.script` soronként, természetes beszélt nyelv (töltelékszavak, önjavítás mértékkel);
  a formátum feleljen meg a típusnak (párbeszéd, interjú, bejelentés, rádióműsor).
- **Kulcsellenőrzés minden itemnél, a fájl megírása után újra:** egyértelmű-e a válasz; nincs-e másik opció/alak, ami szintén helyes
  lehet (ha van, vedd fel alternatívaként, vagy írd át az itemet); a T/F/NG itemeknél a „nem derül ki” tényleg nem derül-e ki;
  a `match` megoldások különbözők-e (ha nem `optionsReusable`).

### Írás (`writing`)
- `taskNumber` a rubrika szerinti 1. vagy 2. feladat; a `wordLimit`, `type` és `register` a rubrikával egyezzen.
- `situation` angolul, valósághű helyzet; `points`: a rubrika szerinti számú irányítási szempont, id-k: `p1`, `p2`, …
- `usefulPhrases`: 6–10 hasznos kifejezés magyar jelentéssel.
- `modelAnswer`: mintamegoldás a szinten (közép: magabiztos B1, emelt: B2), a szóhatáron belül, minden irányítási pontra kitérve;
  `pointsCovered`: pontonként a szöveg szó szerinti idézete; `notes`: 3–5 magyar megjegyzés, miért kapna maximális pontot.

### Szóbeli (`speaking`)
- A `config/exam/structure.json` → `oral.parts` szerinti részekhez: `interview` (6–10 kérdés, néhány `followUps`),
  `situation` (helyzet, szerepek, 3–5 cél), `picture` (2 jelenetleírás képek helyett + kérdések), emelten `debate`
  (tétel, kiosztott álláspont, 4–6 vizsgáztatói ellenérv, 3–5 ötlet) és `presentation`, ha a leírás szerint van ilyen rész.
- `instructionsHu`: a vizsgázónak szóló magyar utasítás; `usefulPhrases`; reális `speakingSeconds`.
- `sampleAnswer`: mintaválasz a szinten (`turns`: vizsgáztató/vizsgázó megszólalások – interjúnál 4–5 kérdés-válasz, szituációnál
  a teljes szerepjáték minden céllal, képnél monológ összehasonlítással és véleménnyel, vitánál érvek és válasz az ellenérvekre;
  `notes`: 3–4 magyar megjegyzés, miért jó és mit érdemes megtanulni belőle).

### Szabálylecke (`szabaly` → `grammar`)
- Hibakategóriánként egy lecke: `content/grammar/kozep/gr-<hibakategória>.json` (mindig a `kozep` mappában, `"level": "kozep"`;
  a csak emelt szinten szükséges szabályok `"emeltOnly": true` jelölést kapnak). Séma: `GrammarLessonSchema`.
- Ha megadták a hibakategóriát, ahhoz írj (ha már van lecke, bővítsd/javítsd); ha nem, a `darab` számú, még lecke nélküli
  kategóriához (`config/exam/error-categories.json`), a hibanaplóban gyakoribbakat előnyben részesítve.
- `summaryHu` (2–4 mondat), `rules` (3–7 szabály magyar magyarázattal, 2–3 angol példával és fordítással), `commonMistakes`
  (4–6 tipikus **magyar anyanyelvű** tanulói hiba: rossz → jó → miért), `examTips` (hol fordul elő az érettségin, hogyan kezeld),
  `practice` (6 item: `choice` A–D opcióval és minden rossz opcióhoz `wrongOptions`, illetve `text` `___` hiánnyal és minden
  elfogadható válasszal; mindegyiknél magyar `explanation`: a helyes megoldás és miért), `relatedCategories`.
- Szövegértési kategóriáknál (detail, gist, inference …) a lecke stratégia: a szabályok a megoldási lépések, a tipikus hibák a csapdák,
  a gyakorló itemek rövid angol szöveg + kérdés.

### Útmutató (`utmutato` → `guide`)
- Fájl: `content/guide/kozep/gd-<type>-<target>.json` (szintfüggetlen; szintfüggő tanács a `levelNotes`-ba). Séma: `GuideSchema`.
  `type`: `writing` (target = szövegtípus a `task-types.json` writing listájából), `speaking` (target = szóbeli feladattípus)
  vagy `exam` (target = vizsgarész: reading, language-use, listening, writing, speaking).
- Ha nem adtak meg mást, a `darab` számú, még hiányzó útmutatót írd meg (nézd meg, mi van már a `content/guide/kozep/` alatt).
- `summaryHu`, `steps` (4–7 lépés: felépítés bekezdésenként / a feladat menete / megoldási sorrend), `phrases` (írás és szóbeli:
  15–30 kifejezés csoportokban, magyar jelentéssel), `mistakes` (4–6 tipikus magyar tanulói hiba), `checklist` (5–8 kérdés),
  `timing` (a `structure.json` időkeretei alapján), rövid `example`. Hivatalos adatot (idő, pont, szóhatár) csak a `config/exam/`-ból vegyél.

### Szókincs (`vocabulary`)
- `type: "deck"`, témakörönként 30–50 kártya, szinthez illő szavak; `example` angol mondat, amely **tartalmazza** a szót;
  `collocation`, ahol van értelme; ne ismételj szót a meglévő paklikból.

## 3. Ellenőrzés és javítás

1. Futtasd: `npm run validate-content`.
2. Javíts ki **minden hibát** az általad írt fájlokban, és a figyelmeztetéseket is nézd át (pl. túl rövid szöveg, hiányzó zavaró opció).
3. Futtasd újra, amíg hiba nélkül le nem fut.

## 4. Összefoglaló (röviden, magyarul)

- hány fájl készült, melyik mappába, milyen típusok és témakörök;
- emlékeztető: az appban a „Tartalom újratöltése” gombbal (vagy `npm run seed`, illetve a dev szerver újraindításával) jelennek meg.
