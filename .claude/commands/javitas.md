---
description: Az exchange/inbox/ írás- és szóbeli beadásainak javítása a rubrika szerint → exchange/outbox/
argument-hint: [beadás-azonosító]
---

# /javitas – beadások javítása

Argumentum (opcionális): `$ARGUMENTS` – ha megadtak egy beadás-azonosítót, csak azt javítsd; különben mindet.

## Szabály: csak az `exchange/outbox/` mappába írhatsz. Mást ne módosíts.

## Lépések

1. Futtasd: `npm run exchange-status` – ez listázza a javításra váró beadásokat (amelyekhez még nincs outbox-fájl).
   Ha nincs ilyen, írd ki, hogy nincs mit javítani, és állj meg.
2. Minden beadásnál olvasd el az `exchange/inbox/<id>.json` fájlt:
   - `instructions`: **a teljes javítási utasítás** (rubrika sávleírásokkal, feladat, irányítási pontok, a tanuló szövege, a válasz pontos JSON-formája).
     Ezt kövesd – ugyanez a prompt megy a Claude appba is, ezért a két út eredménye összevethető.
   - `subject`: a tantárgy; `rubric.file`: a rubrika teljes JSON-ja (pl. `config/subjects/angol/writing-rubric-emelt.json`) – nézd meg a sávleírásokat és a szabályokat
     (szóhatár, témától eltérés stb.). Szóbelinél a rubrika `tasks` listájából a feladat típusához (`task.type`) tartozó
     szempontok érvényesek (az inbox-fájl `rubric.id`-je ezt jelöli); a kiejtés (`overall`) átiratból nem ítélhető meg, nem pontozod.
   - `task.card`: a feladatkártya; `previousVersion`: átírásnál az előző változat.
   - `kind: "speaking"` esetén `transcriptSource: "app-asr"`: a böngésző beszédfelismerőjének átirata – a központozás, kis/nagybetű és
     a félrehallott szavak nem a tanuló hibái.
3. Javíts **szigorúan és következetesen**:
   - Ne kerekíts felfelé; kétes esetben az alacsonyabb sávot add. Minden szempontnál indokolj, a sávleírásra hivatkozva.
   - Minden hibát vegyél fel a `corrections`-be: `original` = karakterre pontosan a tanuló szövegéből (rövid, egyértelműen megtalálható rész),
     `corrected` = a helyes forma / megoldás (nyelvnél a célnyelven, más tantárgynál magyarul), `category` = a `config/subjects/<subject>/error-categories.json` egyik id-je,
     `explanation` = **magyarul: mi a hiba, mi a helyes megoldás és miért** (a szabály).
   - `taskPoints`: minden irányítási pont (`p1`, `p2`, …) / szóbeli cél értékelése (`covered` / `partial` / `missing` + magyar megjegyzés).
   - `priorities`: pontosan 3 konkrét fejlesztendő terület magyarul.
   - `improvedVersion`: a tanuló **saját** szövege egy szinttel jobb nyelvezettel (ugyanazok a gondolatok, nem új szöveg), angolul.
   - `usefulPhrases`: 5–10 hasznos kifejezés magyar jelentéssel.
   - `summary`: rövid magyar összegzés; átírásnál írd le, miben javult az előző változathoz képest.
4. Írd az eredményt ide: `exchange/outbox/<id>.json` – pontosan a `instructions` végén megadott szerkezetben, ezekkel az értékekkel:
   `"schemaVersion": 1`, `"submissionId": "<id>"`, `"kind"` a beadás szerint, `"gradedBy": "claude-code"`,
   `"gradedAt": "<most, ISO>"`, `"rubricId"` = az inbox-fájl `rubric.id` értéke, a `criteria` id-k és maximumok a rubrikából.
   A `totalScore` a szempontpontok összege, a `maxScore` a maximumok összege.
5. Futtasd: `npm run validate-feedback` – javíts ki minden hibát, amit kifogásol, és futtasd újra, amíg minden fájl ✓.
   (A „nem található szó szerint” figyelmeztetésnél javítsd az `original` mezőt, hogy pontosan egyezzen a szöveggel.)

## Ha az argumentum nem azonosító, hanem a tanuló beillesztett szövege

Előfordul, hogy a beadás a tanuló saját gépén van (pl. ez egy felhős munkamenet), és az argumentumban maga a szöveg érkezik.
Ekkor nincs inbox-fájl, és az outboxba írt fájlt az app nem látná. Teendő:
1. Keresd meg a feladatkártyát a `content/` alatt a szöveg alapján (téma, megszólítás, irányító pontok); ha nem egyértelmű, kérdezz rá.
2. Építsd fel ugyanazt a javítási promptot, amit az app is használ (`lib/exchange/prompts.ts` → `writingGradingPrompt` / `speakingGradingPrompt`,
   a szószám a `lib/content/text.ts` `wordCount` függvényével), és javíts a fenti 3. pont szabályai szerint.
3. Ellenőrizd a JSON-t a `FeedbackSchema`-val, és hogy minden `original` szó szerint szerepel-e a szövegben.
4. A JSON-t a chatben add át (kódblokkban vagy fájlként): a tanuló az appban a beadás oldalán a **Javítás beillesztése** mezőbe másolja
   – az app a saját beadás-azonosítóját írja bele, a `submissionId` bármi lehet.

## Összefoglaló (röviden, magyarul)

Beadásonként: azonosító, feladat címe, pontszám (x / max), a 3 fejlesztendő terület egy-egy szóban.
A végén: „Az appban kattints a **Javítások importálása** gombra (vagy futtasd: `npm run import-feedback`).”
