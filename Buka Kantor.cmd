@echo off
REM Klik dua kali untuk membuka Kantor Virtual (Windows).
REM 1) ambil versi terbaru dari GitHub  2) siapkan app  3) buka browser
setlocal
cd /d "%~dp0"
set "URL=http://127.0.0.1:3456"
title Kantor Virtual
echo Kantor Virtual
echo.

curl -s -o NUL "%URL%" && (
  echo Kantor sudah berjalan. Membuka browser...
  start "" "%URL%"
  exit /b 0
)

where git >NUL 2>&1 && (
  echo Mengecek versi terbaru...
  git pull --ff-only --quiet || echo   ^(tidak bisa update sekarang, lanjut dengan versi yang ada^)
)

where node >NUL 2>&1 || (
  echo Node.js belum terpasang. Pasang dari https://nodejs.org ^(pilih LTS^), lalu klik ikon ini lagi.
  pause
  exit /b 1
)

set "HEAD=none"
for /f %%h in ('git rev-parse --verify -q HEAD 2^>NUL') do set "HEAD=%%h"
set "BUILT="
if exist ".next\.kantor-build" set /p BUILT=<".next\.kantor-build"

if not exist node_modules (
  echo Memasang komponen ^(sekali saja, 1-2 menit^)...
  call npm install --no-audit --no-fund --silent || ( echo Gagal memasang. & pause & exit /b 1 )
  set "BUILT="
)
if not "%BUILT%"=="%HEAD%" (
  echo Menyiapkan versi terbaru ^(sekitar 1 menit^)...
  call npm install --no-audit --no-fund --silent
  call npm run build --silent || ( echo Gagal menyiapkan app. & pause & exit /b 1 )
  > ".next\.kantor-build" echo %HEAD%
)

echo Membuka kantor di %URL%
echo Biarkan jendela ini terbuka selama memakai kantor. Tutup jendela ini untuk mematikan kantor.
start "" /min cmd /c "timeout /t 8 /nobreak >NUL & start %URL%"
call npm start --silent
