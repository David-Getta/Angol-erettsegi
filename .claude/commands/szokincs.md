---
description: Hiányos szókártyák kiegészítése, és kérésre témakörönkénti szókincs-pakli generálása
argument-hint: <tantárgy> [témakör] [szint] [darab]
---

# /szokincs – szókártyák kiegészítése és szókincs generálása

Argumentumok: `$ARGUMENTS` (formátum: `<tantárgy> [témakör] [szint] [darab]`, a `-` kihagyott paramétert jelent; a tantárgy a `config/subjects.json` egyik `id`-je)

## Szabály: csak az `exchange/vocab/` és a `content/<tantárgy>/vocabulary/` mappákba írhatsz.

## A) Hiányos kártyák kiegészítése (mindig fusson le)

1. Futtasd: `npm run vocab-requests` – ez frissíti az `exchange/vocab/incomplete.json`-t az adatbázisból
   (a szövegekből kattintással felvett, jelentés nélküli szavak; minden kérésnél ott a `subject`, csak a megadott tantárgyét dolgozd fel).
2. Ha a `words` lista üres, írd ki, hogy nincs hiányos kártya, és ugorj a B) részre (ha van témakör-argumentum), különben állj meg.
3. Minden szóhoz (a `context` mező mutatja, melyik mondatban találkozott vele a tanuló):
   - `term`: a szó szótári alakja (pl. „went” → „go”, „children” → „child”; kifejezésnél a teljes kifejezés),
   - `meaning`: a **szövegkörnyezetnek megfelelő** magyar jelentés (több jelentésnél a környezethez illőt írd előre),
   - `example`: természetes angol példamondat a tanuló szintjén (`level`), amely **tartalmazza** a szót,
   - `collocation` (ha van gyakori): pl. „make a decision”.
4. Írd ide: `exchange/vocab/completions.json`:
   ```json
   { "schemaVersion": 1, "words": [ { "key": "<a kérés key mezője változatlanul>", "term": "...", "meaning": "...", "example": "...", "collocation": "..." } ] }
   ```
5. Futtasd: `npm run validate-feedback` (a completions.json-t is ellenőrzi), és javítsd a hibákat.

## B) Új pakli generálása (csak ha van témakör-argumentum)

1. Olvasd el: `lib/content/schema.ts` (`VocabDeckSchema`), `config/subjects/<tantárgy>/topics.json` (a témakör `subtopics` listája),
   és a `content/<tantárgy>/vocabulary/<szint>/` meglévő paklijait – **ne ismételj szót**, ami már szerepel bármelyik ugyanilyen szintű pakliban.
   Nyelvnél a kártya: idegen szó → magyar jelentés + célnyelvi példamondat; más tantárgynál fogalom / képlet / évszám → rövid magyar
   magyarázat (`meaning`) + egy mondat, amely a fogalmat használja (`example`), `collocation` helyett a tipikus szókapcsolat vagy képlet.
2. Szint alapból: a `data` nélkül nem tudod a beállítást, ezért ha nincs megadva, kérdezz rá, vagy használd az `emelt`-et.
   Darab alapból 40.
3. Írd: `content/<tantárgy>/vocabulary/<szint>/vc-<szint>-<témakör>[-2|-3…].json` (más tantárgynál `<tantárgy-rövidítés>-vc-…`) –
   `"subject": "<tantárgy>"`, `"source": "generated"`, `"type": "deck"`,
   `"section": "vocabulary"`, szinthez illő szavak (közép A2–B1, emelt B2), alszócsoportokra figyelve; minden kártyán `example`
   (a szót tartalmazó mondat), ahol lehet `collocation` és `pos`.
4. Futtasd: `npm run validate-content`, és javíts ki minden hibát/figyelmeztetést az új fájlban.

## Összefoglaló (röviden, magyarul)
- hány hiányos kártyát egészítettél ki → „Az appban a Szókincs oldalon kattints a **Kiegészítések betöltése** gombra (vagy `npm run import-feedback`).”
- ha új pakli készült: hány szó, melyik fájl → „**Tartalom újratöltése**, majd a Szókincs oldalon **Pakli felvétele**.”
