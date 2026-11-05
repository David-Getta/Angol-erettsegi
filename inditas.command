#!/bin/bash
# Angol érettségi – indítás macOS-en: dupla kattintás a Finderben.
# Első alkalommal telepít (npm run setup), utána elindítja az appot és megnyitja a böngészőt.
cd "$(dirname "$0")" || exit 1

# a Finderből indított Terminálban nem mindig látszik a Homebrew / a Node telepítő útvonala
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

pause() { read -n 1 -s -r -p "$1"; echo; }

if ! command -v npm >/dev/null 2>&1; then
  echo "Nincs telepítve a Node.js (az npm parancs nem található)."
  echo "Megnyitom a letöltési oldalt: válaszd az LTS verziót, macOS Installer (.pkg), és telepítsd."
  echo "Utána kattints erre a fájlra újra."
  open "https://nodejs.org/en/download"
  pause "Nyomj meg egy gombot a kilépéshez…"
  exit 1
fi

major=$(node -p "process.versions.node.split('.')[0]")
if [ "$major" -lt 20 ]; then
  echo "A Node.js túl régi ($(node -v)). Legalább a 20-as verzió kell – telepítsd az LTS verziót a nodejs.org-ról."
  open "https://nodejs.org/en/download"
  pause "Nyomj meg egy gombot a kilépéshez…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Első indítás: telepítés (pár perc)…"
  if ! npm run setup; then
    echo
    echo "Hiba történt a telepítésnél (lásd fent). Ha a macOS a parancssori fejlesztői eszközök telepítését kéri,"
    echo "fogadd el, várd meg a végét, és indítsd újra ezt a fájlt."
    pause "Nyomj meg egy gombot a kilépéshez…"
    exit 1
  fi
fi

echo "Az app indul: http://localhost:3000 (leállítás: Ctrl+C vagy zárd be ezt az ablakot)"
( sleep 8; open "http://localhost:3000" ) &
npm run dev
