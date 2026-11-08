# Változásnapló (CHANGELOG)

Az Érettségi felkészítő kiadásainak emberi nyelvű összefoglalója. A kiadás
leírása (amit az asztali app a „Mi változik?” gomb alatt mutat a frissítés
előtt) ennek a fájlnak az adott verziójú szakaszából készül
(`scripts/desktop/release-notes.ts`), ezért itt a tényleges változások
álljanak, nem sablon.

Új kiadás: `npm run release -- X.Y.Z --commit --tag`, majd `git push origin vX.Y.Z`
(a GitHub Actions legyártja a telepítőket, és kiteszi a Releases oldalra).

## Kiadatlan

_(még nincs kiadatlan változás)_

## 1.0.0 – 2026-11-07

- **Asztali alkalmazás.** Az app mostantól telepíthető programként is fut
  (Windows-telepítő, macOS-app, Linux AppImage): Electron-héj, benne a
  beépített Next.js-szerver a saját gépeden, a feladatbank a csomag része.
  Nem kell Node.js, parancssor vagy böngésző.
- **Automatikus frissítés.** Induláskor és hatóránként megnézi a GitHub
  Releases-t; ha van új kiadás, arany sáv jelenik meg a lap tetején:
  „Frissítés most” → letölti, telepíti, újraindul (Windows, Linux AppImage);
  macOS-en a letöltő oldalt nyitja meg. A kiadás leírása a „Mi változik?”
  gomb alatt olvasható. Privát repóhoz frissítési kulcs adható meg.
- **Beállítások → Asztali alkalmazás.** Verzió, frissítés keresése, az
  adat-, beadás- és naplómappa megnyitása, másik beadás-mappa választása
  (pl. a Claude Code-os projekt `exchange/` mappája), megnyitás böngészőben
  (a beszédfelismeréshez).
- **Gazdasági ismeretek** (emelt szint): a tanár első két diasorából
  rövid feladatok, kifejtendő és elemző kártyák, szóbeli tételek és aktuális
  elemzések, fogalomkártyák, szabálytár, útmutatók; `/lecke` parancs a
  következő diasorokhoz.
- **Tizenegy érettségi tantárgy** egy appban, tantárgyválasztóval; a
  szintváltó egyszerre állítja minden tárgy szintjét; csak egy szinten
  tanult tárgynál (gazdasági ismeretek) a szint rögzített.
