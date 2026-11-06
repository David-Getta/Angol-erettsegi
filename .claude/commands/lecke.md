---
description: Tanórai anyag (a tanár diasora, jegyzete – PDF a data/lessons/<tantárgy>/ alatt) feldolgozása a tartalombankba (content/)
argument-hint: <tantárgy> <fájl> [témakör]
---

# /lecke – tanórai anyag feldolgozása a tartalombankba

Argumentumok: `$ARGUMENTS` – formátum: `<tantárgy> <fájl> [témakör]`.

- **tantárgy**: a `config/subjects.json` egyik `id`-je (pl. `gazdasagi-ismeretek`).
- **fájl**: a `data/lessons/<tantárgy>/` alatti PDF (vagy szöveges fájl) neve, pl. `Gazdasagi_ismeretek_20261017.pdf`.
- **témakör** (opcionális): a `config/subjects/<tantárgy>/topics.json` egyik `id`-je, ha az anyag egyértelműen egy témakörhöz tartozik;
  elhagyva a diasor címéből és fejezeteiből állapítsd meg (egy diasor több témakört is érinthet).

## Szabály: csak a `content/<tantárgy>/` mappába írhatsz. A `data/lessons/` tartalmát ne módosítsd, a configot ne írd át
(ha egy témakör vagy hibakategória hiányzik a configból, jelezd az összefoglalóban).

## 1. Felkészülés

1. Olvasd ki a fájl szövegét: `pdftotext <fájl> -` (ha nincs `pdftotext`, a Read eszközzel oldalanként, legfeljebb 20 oldal egyszerre).
   Képes diákat (ábra, táblázat) a Read eszközzel nézz meg, és a tartalmukat szavakkal írd le a feladatokban.
2. Olvasd el: `CLAUDE.md` („Tartalomséma”, „Minőségi szabályok”), `lib/content/schema.ts`, és a tantárgy configját:
   `structure.json` (mely vizsgarész-helyeket használja a tárgy, `mockTaskCount`, `features`), `task-types.json`, `topics.json`,
   `error-categories.json`, `writing-rubric-*.json`, `speaking-rubric-*.json`.
3. Nézd meg, mi van már a bankban ebből a témakörből (`ls content/<tantárgy>/*/*/ | grep <témakör>`), hogy ne ismételj.
4. Állapítsd meg, mely fejezeteket tartalmazza az anyag (egy diasor lehet egy teljes téma vagy csak egy téma első fejezetei) –
   **csak a fájlban szereplő anyagból dolgozz**: a benne lévő definíciók (az „arany Definíció dobozok”) szó szerint kerüljenek a
   kártyákra, kulcspontokra és magyarázatokba; a fájlban nem szereplő elméletet, képletet, adatot ne találj ki.

## 2. Mit kell írni (minden fájl `source: "generated"`, `createdAt` = a mai nap, `tags`-ben a forrásfájl neve, pl. `"lecke:Gazdasagi_ismeretek_20261017.pdf"`)

- **Objektív feladatok** a tárgy objektív vizsgarész-helyére (pl. `reading` = gyorskérdések / rövid feladatok): szintenként 3–5 feladat,
  6–8 itemmel, a `task-types.json` típusaiból változatosan (feleletválasztás, igaz–hamis, párosítás, fogalom felismerése, rövid
  számítás, adatsor, szövegértelmezés). Közép = a diák definíciói és egyszerű alkalmazás; emelt = összehasonlítás, alkalmazás új
  helyzetre, számítás, modell értelmezése. Minden itemnél `category` és magyar `explanation` (mi a helyes és miért, a dia szabályára
  hivatkozva); ha a rész `features.wrongOptions` igaz, a feleletválasztós itemeknél `wrongOptions`.
- **Beadós kártyák** (`writing`): a rubrika feladattípusaiból 1–2 kártya szintenként az anyaghoz illő helyzettel (pl. projektfejezet,
  kifejtendő feladat, elemzés adatokkal), teljes mintamegoldással (`modelAnswer`, `pointsCovered` szó szerinti idézetekkel, `notes`).
- **Szóbeli tételek** (`speaking`): szintenként 2–3 tétel az anyag fejezeteiből (`prompts` = a diasor ismétlő kérdései,
  `sources` = definíciós dobozok, szavakkal leírt ábra/táblázat, `keyPoints` 6–10 állítás, `sampleAnswer` legalább 200 szavas felelettel);
  a rubrika többi feladattípusából (pl. projekt védése, aktuális esemény elemzése) 1–1 feladat, ha az anyag ad hozzá alapot.
- **Fogalomkártyák** (`vocabulary`, `type: "deck"`): szintenként egy pakli (25–40 kártya) az anyag fogalmaiból; `meaning` = a dia definíciója.
- **Szabálytár** (`grammar`): ha egy hibakategóriához már van lecke, **bővítsd** azt az új anyag szabályaival, példáival és
  gyakorlóitemeivel (ne írj második leckét ugyanahhoz a kategóriához); ha nincs, írd meg.
- **Útmutatók** (`guide`): csak akkor, ha új írás- vagy szóbeli feladattípust használsz, amelyhez még nincs útmutató.

Azonosítók: `<előtag>-<rd|wr|sp|vc|gr|gd>-<szint>-<rövid-slug>` (a tantárgy `idPrefix`-ével, ékezet nélkül), a fájlnév = id.

## 3. Ellenőrzés
1. `npm run validate-content` – javíts ki minden hibát és figyelmeztetést a saját fájljaidban.
2. `npx vitest run tests/config.test.ts tests/content.test.ts` – a tantárgy lefedettségi tesztjei zöldek legyenek.
3. Ellenőrizd újra minden kulcsot: egyértelmű-e, minden elfogadható változat szerepel-e, a számítások stimmelnek-e.

## 4. Összefoglaló
Írd ki: a feldolgozott fejezeteket, a létrehozott / bővített fájlokat szakaszonként és szintenként, a validátor utolsó sorát, és azt,
mi maradt ki (pl. olyan fejezet, amelyhez nincs témakör a configban). Végül: „Kattints a Tartalom újratöltése gombra (vagy: npm run seed).”
