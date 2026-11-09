# Kantor Virtual

Tampilan kantor visual di atas Multica untuk mengelola asisten AI per project: siapa sedang mengerjakan apa, apa yang perlu direview, dan apa yang perlu dikerjakan sendiri. Dipakai berdua: **Sarah** dan **Dan**.

- `kantor-virtual.html`: mockup yang bisa diklik (data contoh)
- `setup/TAHAP-0.md`: status mesin (laptop Sarah + Multica Cloud)
- `setup/setup-vps.sh`: cadangan kalau suatu saat pindah ke VPS

## Membuka kantor
- **Mac (Sarah):** klik dua kali `Buka Kantor.command`
- **Windows (Dan):** klik dua kali `Buka Kantor.cmd` (setup pertama: `setup/SETUP-DAN-WINDOWS.md`)

Ikon ini mengambil versi terbaru dari GitHub, menyiapkan app, lalu membuka http://127.0.0.1:3456. App memakai login Multica Desktop di laptop itu, jadi setiap persetujuan tercatat atas nama pemilik laptop. App hanya bisa dibuka dari laptop itu sendiri.

Untuk pengembangan: `npm run dev`.

## Arsitektur
- **Multica Cloud**: data, antrean, agen, issue, komentar, due date
- **Laptop Sarah**: runtime (Claude Code + Codex). Kantor buka saat laptop menyala.
- **Kantor Virtual** (web, rencananya di Vercel): bisa dibuka dari laptop Sarah dan Dan. Masing-masing login dengan akun Multica sendiri.

## Fakta Multica yang membentuk desain (dicek 9 Nov 2026)
- Tiap agen terikat ke satu runtime (satu komputer). Tidak ada failover. Kalau komputer itu mati, run menunggu.
- Run yang antre gagal kalau runtime offline lebih lama dari masa tenggang (default 3 jam). Karena itu **Kantor Virtual yang memegang antrean**: task baru dikirim ke agen saat runtime-nya online.
- Runtime lokal bersifat privat. Pemiliknya bisa membagikan runtime ke member lain, tapi login tool (Claude/Codex) tidak ikut dibagikan.
- Pengingat Telegram dan pengecekan overdue berjalan di cloud (scheduler gratis), tidak bergantung pada laptop mana pun.

## Aturan kantor
- Antrean berurutan per worker. Task berikutnya terkunci sampai "Tugas untukku" dikonfirmasi Sudah.
- Pengiriman email dan posting dikerjakan manusia (default). Auto-post hanya skill opsional nanti.
- Saat kantor buka (runtime online lagi), task yang gagal karena laptop mati (`runtime_offline`) atau kuota habis otomatis dikirim ulang. Kegagalan jenis lain dicoba ulang maksimal 2 kali, lalu masuk "Butuh bantuanmu".
- Dan: untuk sekarang hanya review dan memberi task. Meja sendiri di laptop Dan menyusul.
- Worker pulang saat antrean kosong, dan break saat kuota langganan habis, lalu lanjut otomatis setelah reset.
- Dua reviewer: Sarah dan Dan. Tiap worker atau task punya reviewer default; panel "Perlu Perhatianku" bisa difilter per orang.
- **Overdue**: 🔴 Telat (lewat due date) dan 🟠 Berisiko telat (jatuh tempo ≤ 2 hari tapi belum mulai, menunggu review atau Tugas untukku, terkunci, atau laptop lama tertutup). Ada pengingat harian ke masing-masing reviewer.

## Tahapan
0. Mesin: sudah berjalan (lihat `setup/TAHAP-0.md`)
1. Kantor (lihat saja): denah dari data Multica asli, status worker, overdue, panel per orang
2. Kantor (interaktif): setujui/revisi, Tugas untukku (Sudah/Belum), antrean berurutan, pulang & break otomatis, pengingat
3. Skill: browser, ilustrasi + storyboard (penerbit buku anak, banyak buku per project)
