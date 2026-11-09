#!/bin/bash
# Klik dua kali untuk membuka Kantor Virtual (Mac).
# 1) ambil versi terbaru dari GitHub  2) siapkan app  3) buka browser
cd "$(dirname "$0")" || exit 1
PORT=3456
URL="http://127.0.0.1:$PORT"

echo "🏢 Kantor Virtual"
echo

if curl -s -o /dev/null "$URL"; then
  echo "Kantor sudah berjalan. Membuka browser…"
  open "$URL"
  exit 0
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Mengecek versi terbaru…"
  git pull --ff-only --quiet || echo "  (tidak bisa update sekarang, lanjut dengan versi yang ada)"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js belum terpasang. Pasang dari https://nodejs.org (pilih LTS), lalu klik ikon ini lagi."
  read -r -p "Tekan Enter untuk menutup."
  exit 1
fi

HEAD=$(git rev-parse --verify -q HEAD 2>/dev/null || echo none)
STAMP=".next/.kantor-build"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Memasang komponen (sekali saja, 1–2 menit)…"
  npm install --no-audit --no-fund --silent || { read -r -p "Gagal memasang. Tekan Enter untuk menutup."; exit 1; }
  touch node_modules
fi
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HEAD" ] || [ -n "$(git status --porcelain -- app lib data 2>/dev/null)" ]; then
  echo "Menyiapkan versi terbaru (sekitar 1 menit)…"
  npm run build --silent || { read -r -p "Gagal menyiapkan app. Tekan Enter untuk menutup."; exit 1; }
  echo "$HEAD" > "$STAMP"
fi

echo "Membuka kantor di $URL"
echo "Biarkan jendela ini terbuka selama memakai kantor. Tutup jendela ini untuk mematikan kantor."
( for i in $(seq 1 30); do curl -s -o /dev/null "$URL" && { open "$URL"; break; }; sleep 1; done ) &
exec npm start --silent
