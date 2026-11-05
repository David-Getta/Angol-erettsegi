---
description: Hivatalos érettségi feladatsor (data/official/<mappa>/) átalakítása a tartalombank formátumára
argument-hint: <mappa>
---

# /import-hivatalos – hivatalos feladatsor importálása

Argumentum: `$ARGUMENTS` – a `data/official/` alatti mappa neve (pl. `2024-majus-emelt`).

## Szabály: csak a `content/` mappába írhatsz. A `data/official/` tartalmát ne módosítsd.

## 1. Felkészülés

1. Nézd meg a mappát: `ls -la data/official/<mappa>/`. Várható tartalom: feladatlap(ok) PDF-ben (olvasás + nyelvhelyesség,
   hallás + írás), javítási-értékelési útmutató PDF, hanganyag (mp3). Ha hiányzik a feladatlap vagy az útmutató, írd ki, mi hiányzik, és állj meg.
2. A mappanévből (vagy a feladatlapról) állapítsd meg: év, időszak (`majus` / `oktober` / `februar`), szint (`kozep` / `emelt`).
3. Olvasd ki a PDF-ek szövegét (pl. `pdftotext -layout <fájl> -`, ha elérhető, különben a Read eszközzel oldalanként).
4. Olvasd el: `CLAUDE.md` „Tartalomséma”, `lib/content/schema.ts`, `config/exam/task-types.json`, `config/exam/topics.json`,
   `config/exam/error-categories.json`, és egy meglévő generált fájlt mintának.
5. Ellenőrizd, nincs-e már importálva: `grep -l '"folder": "<mappa>"' -r content/` – ha igen, csak a hiányzó feladatokat írd meg.

## 2. Átalakítás – feladatonként egy fájl

- Fájl: `content/<rész>/<szint>/off-<év>-<időszak>-<szint>-<rész-rövid>-<feladatszám>.json`
  (rész-rövid: `rd`, `lu`, `ls`, `wr`).
- `"source": "official"` és kötelező az `official` mező:
  `{ "year": 2024, "session": "majus", "level": "emelt", "partNumber": 1, "taskNumber": 2, "folder": "<mappa>" }`;
  hallásnál `"audioFile": "<mp3 fájlnév>"` (ha egy fájlban van minden feladat, `audioStartSec` / `audioEndSec` a feladat elejére/végére).
- A feladat szövegét, utasítását, példáját (0.), az opciókat **szó szerint** vedd át a feladatlapról; a `type` a `task-types.json` szerinti típus.
- A megoldókulcsot a **javítási útmutatóból** vedd: minden elfogadott válasz kerüljön az `answer` tömbbe (az útmutató gyakran több
  elfogadható választ is felsorol – mindet vedd fel).
- Hallás: a leiratot az útmutatóból (a hanganyag szövegátirata) vedd át soronként, beszélőkkel; ha nincs leirat, jelezd az összefoglalóban.
- A `explanation`, `evidence`, `wrongOptions`, `glossary`, `category` mezőket **te írod** (az útmutatóban nincsenek): magyarul, hogy mi
  a helyes megoldás és miért; az `evidence` szó szerinti idézet a szövegből. Adj hozzá a `tags`-hez: `"explanations-generated"`.
- Íráskészség: írásfeladat-kártya (`writing`) a hivatalos helyzettel és irányítási pontokkal (`taskNumber` 1/2).
- A `topic` a tartalomhoz legjobban illő hivatalos témakör.
- **Soha ne jelölj generált feladatot hivatalosnak**, és hivatalos feladatot se írj át „javítva” – csak formázz.

## 3. Ellenőrzés
1. `npm run validate-content` – javíts ki minden hibát (gyakori: az `evidence` nem szó szerinti, hiányzó `wrongOptions`).
2. Vesd össze még egyszer a kulcsot az útmutatóval feladatonként.

## Összefoglaló (röviden, magyarul)
- melyik feladatok készültek el (rész, feladatszám, típus, fájl), mi maradt ki és miért (pl. nincs leirat, olvashatatlan PDF);
- „Az appban kattints a **Tartalom újratöltése** gombra; a feladatok **Hivatalos** jelöléssel jelennek meg.”
