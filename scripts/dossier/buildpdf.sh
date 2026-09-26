#!/bin/bash
# Сборка PDF досье: ./buildpdf.sh ../../kognitivnaya_sistema_red6.md ../../kognitivnaya_sistema_red6.pdf
# Нужны: python3 (markdown, pyphen, pymupdf), node + playwright (Chromium).
set -e
M=$(realpath "$1"); O=$(realpath -m "$2"); cd "$(dirname "$0")"
mkdir -p fonts
for f in ptserif/PT_Serif-Web-Regular ptserif/PT_Serif-Web-Bold ptserif/PT_Serif-Web-Italic ptserif/PT_Serif-Web-BoldItalic ptsans/PT_Sans-Web-Regular ptsans/PT_Sans-Web-Bold; do
  [ -f fonts/$(basename $f).ttf ] || curl -sfL -o fonts/$(basename $f).ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/$f.ttf"
done
NODE=${NODE:-node}
python3 build.py "$M" $PWD/k.html >/dev/null
$NODE render.js $PWD/k.html $PWD/k.pdf
python3 -W ignore pages.py k.pdf k.html pages.json >/dev/null
for i in 1 2 3 4; do
  python3 build.py "$M" $PWD/k.html pages.json >/dev/null
  $NODE render.js $PWD/k.html $PWD/k.pdf
  python3 -W ignore pages.py k.pdf k.html pages2.json >/dev/null
  if cmp -s pages.json pages2.json; then echo "оглавление стабильно после прохода $i"; break; fi
  cp pages2.json pages.json
done
cp k.pdf "$O"; rm -f k.html k.pdf pages.json pages2.json
