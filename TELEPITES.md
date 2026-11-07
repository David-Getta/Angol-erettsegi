# Érettségi felkészítő — Telepítés (egyszerű útmutató)

Ez az útmutató **bárkinek** szól, informatikai tudás nélkül is. A cél: pár perc
alatt működjön a program a gépeden, és utána ne kelljen vele foglalkozni – a
frissítéseket magától észreveszi.

Nem kell hozzá Node.js, parancssor, se böngésző. A program **a te gépeden fut**,
minden adatod ott marad. Internet csak a letöltéshez és a frissítések
ellenőrzéséhez kell (meg a beszédfelismeréshez – erről lent).

A letöltések mindig itt vannak:
**<https://github.com/David-Getta/Angol-erettsegi/releases/latest>**

---

## Windows

1. **Töltsd le** az `Erettsegi-felkeszito-Setup-<verzió>.exe` fájlt a fenti
   **Releases** oldalról (pl. `Erettsegi-felkeszito-Setup-1.0.0.exe`). A többi
   fájlra (`.blockmap`, `latest.yml`) nincs szükséged – azokat a program
   használja a frissítéshez.
2. **Kattints rá duplán.** A Windows valószínűleg figyelmeztetést ad:
   „A Windows megvédte a számítógépet” / „Ismeretlen kiadó”. Kattints a
   **További információ** → **Futtatás mindenképp** gombra. (Ez normális egy új
   programnál, amelynek nincs megvásárolt kiadói tanúsítványa.)
3. Kövesd a telepítőt: **Tovább → Tovább → Telepítés**. Pár másodperc. Nem kér
   rendszergazdai jelszót, mert csak a saját felhasználód alá települ
   (`%LOCALAPPDATA%\Programs\Érettségi felkészítő`).
4. A végén hagyd bepipálva az indítást, majd **Befejezés**. Az asztalon és a
   Start menüben megjelenik az **Érettségi felkészítő** ikon – legközelebb innen
   indítsd.

Első indításkor egy kis ablak jelenik meg: „Az app indítása…”, majd
„A feladatbank betöltése…” – pár másodperc. Ilyenkor a beépített szerver elindul,
és betölti a feladatokat a te adatbázisodba. Utána megnyílik a program.

---

## Mac

1. **Töltsd le** a Macednek megfelelő `.dmg` fájlt a **Releases** oldalról:
   - **Apple Silicon** (M1, M2, M3, M4 … chip): `Erettsegi-felkeszito-<verzió>-mac-arm64.dmg`
   - **Intel**: `Erettsegi-felkeszito-<verzió>-mac-x64.dmg`

   (Nem tudod, melyik a tiéd? Apple menü → **Erről a Macről**: ha a „Chip”
   sorban *Apple* áll, az arm64; ha *Intel*, az x64.)
2. **Kattints rá duplán** – megnyílik egy ablak az app ikonjával.
3. **Húzd át** az **Érettségi felkészítő** alkalmazást a **Programok**
   (Applications) mappába, és onnan indítsd.
4. Első indításnál a Mac szólhat, hogy nem azonosított fejlesztőtől származik:
   **jobb klikk (vagy Ctrl+kattintás) az ikonon → Megnyitás → Megnyitás**.
   Ezt csak egyszer kell. (Ha „sérült” üzenetet adna: nyiss egy Terminált,
   illeszd be ezt, és nyomj Entert:
   `xattr -cr "/Applications/Érettségi felkészítő.app"` – majd indítsd újra.)
5. Első indításkor „Az app indítása…”, majd „A feladatbank betöltése…” jelenik
   meg pár másodpercig – ez normális.

---

## Linux

1. **Töltsd le** az `Erettsegi-felkeszito-<verzió>.AppImage` fájlt a
   **Releases** oldalról.
2. Tedd futtathatóvá, és indítsd el (terminálban, a letöltési mappában):
   ```bash
   chmod +x Erettsegi-felkeszito-<verzió>.AppImage
   ./Erettsegi-felkeszito-<verzió>.AppImage
   ```
   (A fájlkezelőből is megy: jobb klikk → Tulajdonságok → „Futtatható” pipa,
   majd dupla kattintás.)
3. Ha nem indul, és `libfuse`-ról szóló hibát ír, néhány disztribúción
   telepíteni kell a `libfuse2` csomagot (Ubuntu/Debian:
   `sudo apt install libfuse2`), aztán indítsd újra.

---

## Mit tudsz csinálni a programban?

Pontosan ugyanazt, amit a böngészős változatban – ugyanaz az app, csak saját
ablakban, telepítés és terminál nélkül:

1. **Tantárgy választása** a kezdőképernyőn (magyar, matematika, történelem,
   angol, német, fizika, kémia, biológia, földrajz, digitális kultúra, gazdasági
   ismeretek), aztán szint (közép/emelt), vizsgadátum, cél.
2. **Szintfelmérő** → ebből áll össze a **Mai terv** a Kezdőlapon.
3. **Gyakorlás vizsgarészenként**: olvasás, nyelvhelyesség, hallás (a gép
   olvassa fel), írás, szóbeli – minden feladatnál magyarázat, hogy miért az a
   helyes megoldás.
4. **Hibanapló, Szabálytár, Útmutatók, Szókincs** – a saját hibáidból tanulsz,
   az ismétlést az app ütemezi.
5. **Próbaérettségi** hivatalos időkeretekkel → pont, százalék, becsült jegy.
6. **Beállítások → Asztali alkalmazás**: itt látod a verziót, kereshetsz
   frissítést, megnyithatod a mappáidat, és megnyithatod az appot böngészőben is.

**Hol vannak az adataid?** Nem a program mappájában – így a frissítés nem
bántja őket:

- Windows: `%APPDATA%\erettsegi-felkeszito\data\app.db` (mellette a
  `data\backups\` a biztonsági mentésekkel és a `logs\` a naplókkal)
- Mac: `~/Library/Application Support/erettsegi-felkeszito/`
- Linux: `~/.config/erettsegi-felkeszito/`

A javításra beadott írásaid és szóbeli válaszaid a **beadás-mappába** kerülnek
(`inbox`, `outbox`, `archive`), ami alapból a
**Dokumentumok / Érettségi felkészítő / exchange** mappa. Mindhárom mappát egy
kattintással megnyithatod: **Beállítások → Asztali alkalmazás** (a
**Megnyitás** gombokkal), vagy a felső menüben **Alkalmazás → Adatmappa
megnyitása / Beadás-mappa megnyitása / Naplók megnyitása**.

**Ha Claude Code-dal javíttatsz:** a **Másik beadás-mappa…** gombbal
átállíthatod a beadás-mappát a saját projektmásolatod `exchange/` mappájára –
így a `/javitas` parancs rögtön látja a beadásaidat, nem kell semmit másolgatni.
Az app ezután újraindítja a beépített szervert az új mappával; a haladásod nem
változik.

**Beszédfelismerés (diktálás):** a szóbeli gyakorlás diktálása és a
hallás → diktálás beszédfelismerése az asztali appban **nem működik** (az
Electronban nincs beszédfelismerő szolgáltatás) – a felolvasás viszont igen.
A megoldás be van építve: **Beállítások → Asztali alkalmazás → Megnyitás
böngészőben** (vagy a menüben **Alkalmazás → Megnyitás böngészőben**). Ugyanez
az app, ugyanazokkal az adatokkal megnyílik a böngésződben
(`http://127.0.0.1:<port>`); ott **Chrome-ot vagy Edge-et** használj. A szóbeli
oldal ezt magától is jelzi, ha a felismerés nem elérhető.

---

## Automatikus frissítés

A programot **csak egyszer** kell telepíteni. Utána **magától észreveszi**, ha
új verzió jelent meg: induláskor (pár másodperc után) és utána hatóránként
megnézi a GitHub Releases oldalt.

1. Ha van újabb verzió, a lap tetején megjelenik egy **arany sáv**:
   *„Új verzió érhető el: X.Y.Z”*, három gombbal:
   - **Mi változik?** – megmutatja, mi új a kiadásban.
   - **Később** – eltünteti a sávot a következő indításig.
   - **Frissítés most** – letölti és telepíti.
2. **Windows** (és Linux AppImage): a **Frissítés most** gombra a program
   letölti az új telepítőt (haladásjelzővel: „Letöltés: 42%”), csendben
   telepíti, és **magától újraindul**. Semmi mást nem kell tenned, az adataid
   megmaradnak.
3. **Mac**: a program nincs Apple Developer tanúsítvánnyal aláírva, ezért nem
   tudja kicserélni önmagát. Itt a gomb neve **Letöltés**, és a Releases oldalt
   nyitja meg: töltsd le az új `.dmg`-t, és húzd az appot a régi helyére a
   Programok mappában („Cserél”). Az adataid megmaradnak, mert nem a
   programban vannak.

Kézzel is kereshetsz frissítést: a menüben **Alkalmazás → Programfrissítés
keresése…**, a fejléc **⭳** ikonjával (ha arany pont van rajta, frissítés
vár), vagy **Beállítások → Asztali alkalmazás → Programfrissítés keresése**.

(Ha fejlesztőként a forrásból, csomagolás nélkül futtatod, a sáv ezt írja:
„Fejlesztői futás – az automatikus frissítés kikapcsolva.”)

### Privát repónál: frissítési kulcs (egyszeri beállítás)

A repó ma **nyilvános**, ezért ezt a részt nyugodtan átugorhatod. Ha egyszer
**privát** lesz, a program csak egy GitHub-kulccsal (token) látja a kiadásokat.
Ezt **egyszer** kell megadni:

1. Böngészőben: **github.com → jobb felül a profilképed → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
2. Beállítások a tokenhez:
   - **Repository access:** *Only select repositories* → válaszd ki az
     `Angol-erettsegi` repót.
   - **Permissions → Repository permissions → Contents:** *Read-only*.
   - Lejárat: állítsd hosszúra – lejáratkor újat kell megadni.
3. **Generate token** → másold ki a `github_pat_…` kezdetű kulcsot.
4. A programban: **Beállítások → Asztali alkalmazás → Frissítési kulcs (privát
   repóhoz)** → illeszd be → **Mentés**. A program rögtön ellenőrzi, hogy
   működik-e.

A kulcs **csak a te gépeden** tárolódik – ahol lehet, az operációs rendszer
kulcstárával titkosítva –, és csak olvasásra jó ehhez az egy repóhoz. Törlés:
hagyd üresen a mezőt → **Mentés**. Ezután az automatikus frissítés privát
repóval is ugyanúgy működik.

---

## Gyakori kérdések

**Nem indul el / „Az app nem tudott elindulni.”** Zárd be, és indítsd újra a
programot. Ha marad, nyisd meg a naplókat (menü **Alkalmazás → Naplók
megnyitása**) – a legfrissebb fájl végén ott a hibaüzenet; ezt küldd el, ha
segítséget kérsz.

**A Windows / a Mac nem engedi megnyitni.** Lásd fent: Windowson **További
információ → Futtatás mindenképp**, Macen **jobb klikk → Megnyitás**. Ezt csak
az első indításnál kéri. A program azért „ismeretlen kiadó”, mert nincs
megvásárolt aláíró tanúsítványa – a telepítőt a GitHub építi a nyilvános
forráskódból.

**Elveszik-e a haladásom frissítéskor vagy újratelepítéskor?** Nem. Az adataid
a fenti adatmappában vannak, nem a programban; a frissítés csak a programot
cseréli. Induláskor ráadásul automatikus biztonsági mentés készül a
`data/backups/` mappába (a **Beállítások → Adatok** alatt kézzel is menthetsz
és exportálhatsz).

**Kell hozzá internet?** A letöltéshez és a frissítések ellenőrzéséhez igen.
Maga a gyakorlás internet nélkül is megy – kivéve a beszédfelismerést, amihez a
Chrome internetet használ (és ami egyébként is csak böngészőben működik, lásd
fent).

**Hogyan kerül új feladat a programba?** A feladatbank a program része:
frissítéskor az új és a javított feladatok bekerülnek az adatbázisodba, a
haladásod megmarad. A Claude Code-os parancsok (`/feladatok`, `/javitas`,
`/szokincs`, `/import-hivatalos`, `/lecke`) továbbra is a projektmappában (a
git-klónban) futnak, ahogy eddig – az asztali app a mindennapi gyakorláshoz van.

**Nem működik a mikrofon / a diktálás.** Az asztali appban nem is fog: nyisd meg
az appot böngészőben (**Beállítások → Asztali alkalmazás → Megnyitás
böngészőben**), és Chrome-ban vagy Edge-ben gyakorold a szóbelit – ugyanazt
látod, ugyanazokkal az adatokkal.

**Hol látom, melyik verzió fut?** **Beállítások → Asztali alkalmazás**
(„Verzió: …”). Ugyanitt a **Programfrissítés keresése** gomb azonnal megnézi,
van-e újabb.
