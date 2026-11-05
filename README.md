# Angol érettségi felkészítő

Lokális, egyfelhasználós gyakorló app az angol érettségire, **közép- és emelt szinten**.
A felület magyar, a feladatok angolok, a magyarázatok magyarok.

**Az app futás közben semmilyen fizetős AI API-t nem hív.** A feladatbankot és az írás- és szóbeli
javítást a [Claude Code](https://claude.com/claude-code) végzi a projektben definiált parancsokkal,
vagy a javítást a Claude appba bemásolt prompttal kérheted. Nincs fiók, nincs szerver, nincs API-kulcs.

## Mit tud?

| Modul | Röviden |
|---|---|
| **Kezdőlap** | visszaszámláló, becsült pontszám vizsgarészenként a 12%-os küszöbbel és a céloddal, Mai terv, sorozat, heti gyakorlási idő, tartalomkészlet-jelző, javításra váró beadások |
| **Szintfelmérő** | kb. 45 perces teszt mind a négy írásbeli részből → becsült CEFR-szint, erősségek és gyengeségek |
| **Olvasott szöveg** | érettségi-típusú feladatok, gyakorló és vizsga mód, magyarázat minden kérdéshez (hol van a szövegben, miért rossz a többi opció), szavak felvétele szókártyába kattintással |
| **Nyelvhelyesség** | lyukas szövegek, szóképzés, igealakok, hibakeresés …; több helyes válasz elfogadva, elírás-jelzés; célzott gyakorlás a hibanaplóból |
| **Diktálás** | mondatok a hallási leiratokból a beszélő hangján (lassítható), begépelés, szóról szóra összevetés |
| **Hallott szöveg** | a böngésző olvassa fel a szkripteket beszélőnként külön hanggal, felkészülési idő, kétszeri meghallgatás, utána leirat a válaszok kiemelésével; hivatalos mp3 is lejátszható |
| **Íráskészség** | feladatkártyák, szerkesztő élő szószámlálóval és időzítővel, önellenőrző lista, beadás javításra, javítás nézet (pontok szempontonként, kiemelt hibák magyarázattal), átírás, változatok összehasonlítása; az első beadás után mintamegoldás megjegyzésekkel |
| **Szóbeli** | kérdéskártyák, szituációk, képleírás-helyettesítő jelenetek, emelten vitatételek; felolvasás, időzítő, beszédfelismerés; vizsgáztató-prompt a Claude app hangmódjához |
| **Szókincs** | FSRS-alapú ismétlés (angol→magyar, magyar→angol, példamondat-kitöltés, kollokáció), témakörönkénti paklik; a saját hibáid is felvehetők „javítsd ki” kártyának |
| **Hibanapló** | minden hibád a helyes megoldással és a magyarázattal, kategóriánként, trenddel, „Gyakoroltasd ezt” gombbal |
| **Útmutatók** | minden írásbeli szövegtípushoz, szóbeli feladattípushoz és vizsgarészhez: felépítés, kész kifejezések, tipikus hibák, ellenőrző lista, időbeosztás |
| **Szabálytár** | minden hibakategóriához magyar szabálymagyarázat példákkal, a magyarul beszélők tipikus hibái, érettségi-tippek és mini-gyakorlás; a hibanaplóból és minden hibamagyarázatból egy kattintással elérhető |
| **Témakörök** | a tíz szóbeli témakör mindegyikénél egy helyen a feladatok minden vizsgarészből (kész / még nem) és a szókincs-pakli |
| **Kifejezéstár** | az írás- és szóbeli kártyák hasznos kifejezései szövegtípusonként, kereshetően, egy kattintással szókártyába |
| **Az érettségiről** | a vizsga felépítése, időkeretei, pontozása, jegyhatárai és a nyelvvizsga-egyenértékűség egy oldalon, a config fájlokból |
| **Próbaérettségi** | teljes írásbeli szimuláció hivatalos időkeretekkel és szigorú részenkénti időzítéssel → pontszám, százalék, 12%-os küszöbök, becsült jegy, nyelvvizsga-egyenértékűség |
| **Hivatalos feladatsorok** | a letöltött régi érettségik importálása saját használatra, egyértelmű „Hivatalos” jelöléssel |
| **Statisztika, Parancsok, Beállítások** | grafikonok és kinyomtatható haladási jelentés; a Claude Code parancsok súgója parancsépítővel; export/import, adatbázis-mentés (automatikusan is) |

## Telepítés

Kell hozzá: **Node.js 20.9 vagy újabb** (<https://nodejs.org>), és a beszédfelismeréshez **Google Chrome** (vagy Edge).

```bash
git clone <a repó címe> angol-erettsegi
cd angol-erettsegi
npm run setup      # függőségek, adatbázis (data/app.db), a feladatbank ellenőrzése és betöltése
npm run dev        # → http://localhost:3000
```

Első indításkor kezdd a **Szintfelmérővel** – ebből áll össze a Mai terv. A **Beállításokban** add meg
a szintet (közép/emelt), a vizsga dátumát és a célszázalékot.

**Telefonról** (ugyanazon a wifin): `npm run dev:lan`, majd a telefonon `http://<a gép IP-címe>:3000`.
(A vágólapra másolás és a mikrofon http-n korlátozott lehet; a gépen a localhost a kényelmesebb.)

### Böngésző és hang

- A **felolvasás** (hallás, kérdések) a böngésző beépített hangjait használja. Windowson/macOS-en több angol hang
  is van; a Beállításokban kiválaszthatod a női és a férfi hangot és a sebességet.
- A **beszédfelismerés** (szóbeli) a Web Speech API-t használja, ez **Chrome-ban/Edge-ben** működik
  (a Chrome ehhez internetkapcsolatot használ). Más böngészőben a választ be is gépelheted.

## A javítás menete lépésről lépésre

Az írás- és a szóbeli javítás **nem azonnali**: a beadás után két út közül választhatsz.

**A) Claude Code-dal (ajánlott)**
1. Az appban írd meg a szöveget, és kattints a **Beadás javításra** gombra. A beadás az `exchange/inbox/<azonosító>.json`
   fájlba kerül, állapota „Javításra vár”. Az app megmutatja a következő lépést: `/javitas`, **Másolás** gombbal.
2. Nyisd meg a projekt mappáját a Claude Code-ban (`claude` a mappában), és futtasd: `/javitas`.
   A javítás az `exchange/outbox/<azonosító>.json`-ba kerül.
3. Az appban kattints a **Javítások importálása** gombra (vagy futtasd: `npm run import-feedback`).
4. Megjelenik a javítás: pontok szempontonként indoklással, kiemelt hibák (eredeti → helyes + magyarázat), az irányítási
   pontok ellenőrzése, a 3 legfontosabb fejlesztendő terület, a szöveged feljavított változata, hasznos kifejezések
   (egy kattintással szókártyába). A hibák automatikusan a **Hibanaplóba** kerülnek.
5. **Átírás**: az „Átírás – új változat” gombbal a javítás alapján újraírhatod, és újra beadhatod. A változatok
   pontszáma és szövege egymás mellett látszik.
6. A javítás alatt megjelenik a **mintamegoldás** (kiemelve, hol teljesíti az irányítási pontokat, és miért kapna
   maximális pontot). Minden hiba mellett ott a **§ Szabály** link a Szabálytárba és a **＋ Ismétlésbe** gomb, amellyel
   a hibából „javítsd ki” szókártya lesz.

**B) A Claude appal**
1. A beadás oldalán kattints a **Prompt másolása** gombra (rubrika + feladat + szöveg + a várt JSON-formátum).
2. Illeszd be a Claude appba, és a kapott választ (JSON) másold vissza az app beillesztő mezőjébe → **Javítás mentése**.
   Ha a JSON hibás, az app pontosan megírja, mi hiányzik.

**Szóbeli**: az appban felveszed a választ (vagy élőben beszélgetsz a Claude app hangmódjában a **Vizsgáztató prompt
másolása** gombbal kapott prompttal, és visszamásolod az átiratot), majd ugyanígy adod be javításra. A saját hangodat is
visszahallgathatod (a felvétel csak a böngészőben marad), és összevetheted a felolvasott **mintaválasszal**.

## A hibákból tanulás köre

1. Minden rossz válasz és javítás a **Hibanaplóba** kerül, a helyes megoldással és a magyarázattal.
2. A **Szabálytár** az adott hibakategória szabályát magyarázza el (tipikus magyar hibákkal és mini-gyakorlással).
3. A **Hibáim újrapróbálása** legkorábban másnap újra feladja az elrontott nyelvhelyességi mondatokat, amíg nem sikerülnek.
4. A **célzott gyakorlás** a feladatbankból válogat ugyanabból a kategóriából; a javításokból **„javítsd ki” szókártya** is lehet.

## Claude Code parancsok

A parancsok a `.claude/commands/` mappában vannak; leírásuk, paramétereik és példáik az app **Parancsok** oldalán is
megtalálhatók parancsépítővel és Másolás gombokkal (forrás: `config/commands.json`).

| Parancs | Mit csinál | Példa |
|---|---|---|
| `/feladatok <rész> <szint> <darab> [témakör] [hibakategória]` | új feladatokat generál a tartalombankba (`content/`), magyarázatokkal és alternatív válaszokkal, majd validál | `/feladatok nyelvhelyesseg emelt 10` · `/feladatok olvasas kozep 4 utazas` · `/feladatok nyelvhelyesseg emelt 6 - tense` |
| `/javitas [azonosító]` | kijavítja az `exchange/inbox/` beadásait a rubrika szerint → `exchange/outbox/` | `/javitas` |
| `/szokincs [témakör] [szint] [darab]` | kiegészíti a hiányos szókártyákat; témakörrel új paklit generál | `/szokincs` · `/szokincs kornyezet emelt 40` |
| `/import-hivatalos <mappa>` | a `data/official/<mappa>/` hivatalos feladatsorát a bank formátumára alakítja | `/import-hivatalos 2024-majus-emelt` |

`<rész>`: `olvasas`, `nyelvhelyesseg`, `hallas`, `iras`, `szobeli`, `szokincs` · `<szint>`: `kozep`, `emelt` ·
a témakör- és hibakategória-azonosítók a `config/exam/topics.json` és `config/exam/error-categories.json` fájlokban vannak
(a `-` egy kihagyott paramétert jelent). Generálás után az appban: **Tartalom újratöltése** (vagy `npm run seed`, vagy a dev szerver újraindítása).

## Hivatalos feladatsorok importálása

1. Töltsd le az [Oktatási Hivatal](https://www.oktatas.hu) oldaláról (Érettségi → Korábbi évek feladatsorai) a feladatlapot (PDF),
   a javítási-értékelési útmutatót (PDF) és a hanganyagot (mp3).
2. Másold őket ide: `data/official/<év>-<időszak>-<szint>/` (pl. `data/official/2024-majus-emelt/`).
3. Claude Code: `/import-hivatalos 2024-majus-emelt` → az appban **Tartalom újratöltése**.

A `data/official/` a `.gitignore`-ban van. A hivatalos feladatok „🏛 Hivatalos”, a generáltak „✦ Generált” jelölést kapnak;
generált feladat soha nem jelenik meg hivatalosként.

## Korlátok

- Az írás- és szóbeli javítás **nem azonnali**: beadás után futtatni kell a `/javitas`-t, vagy át kell másolni a promptot a Claude appba.
- A feladatkészlet **véges**; a Kezdőlap tartalomkészlet-jelzője mutatja, mi fogy. Bővíteni a `/feladatok` paranccsal lehet
  (az app mindig kiírja a pontos parancsot).
- A Claude Code-os generálás és javítás a **Claude-előfizetés használati keretéből** megy, nem külön pénzből.
- A becsült pontszám, jegy és CEFR-szint tájékoztató jellegű: a generált feladatok és az AI-javítás nem helyettesítik a hivatalos vizsgát.
- A felolvasás minősége a böngésző és az operációs rendszer hangjaitól függ.

## A vizsga adatai

A hivatalos adatok (feladattípusok, időbeosztás, pontszámok, értékelési szempontok, jegyhatárok, nyelvvizsga-egyenértékűség,
szóbeli témakörök) a `config/exam/` JSON-fájljaiban vannak, forrásmegjelöléssel – nem a kódban. Ha a vizsgaleírás változik,
elég ezeket a fájlokat frissíteni.

## Fejlesztés

```bash
npm run check            # TypeScript + Vitest + tartalomvalidátor
npm run validate-content # a content/ minden fájljának séma- és logikai ellenőrzése
npm run test:e2e         # Playwright (külön szerver, külön adatbázis – a saját adataidat nem bántja)
npm run build            # éles build
```

A Playwright saját gépen először: `npx playwright install chromium`.

Adatok: a haladásod a `data/app.db`-ben van (a **Beállítások → Adatok** alatt exportálhatod JSON-ba, visszatöltheted,
és biztonsági mentést készíthetsz a `data/backups/` mappába). A projekt szabályai: `CLAUDE.md`, a terv és a döntések: `PLAN.md`.
