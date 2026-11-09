# Memasang Kantor Virtual di laptop Dan (Windows)

Cukup sekali. Setelah ini, Dan hanya perlu klik dua kali ikon **Buka Kantor**.
Perkiraan waktu: 20–30 menit.

## Sebelum mulai (dikerjakan Sarah)
- [ ] Undang Dan ke workspace di Multica (Settings → Members).
- [ ] Undang akun GitHub Dan ke repo: https://github.com/sarahshafiran/kantor-virtual/settings/access → **Add people**.

## 1. Pasang tiga aplikasi
Unduh dan pasang seperti aplikasi biasa (klik Next sampai selesai; pilihan bawaan sudah tepat):

| Aplikasi | Unduh dari | Untuk apa |
|---|---|---|
| **Git** | https://git-scm.com/download/win | Mengambil versi terbaru app dari GitHub |
| **Node.js (LTS)** | https://nodejs.org | Menjalankan app |
| **Multica Desktop** | https://multica.ai (bagian Download) | Login Multica. Nanti juga dipakai untuk meja Dan sendiri. |

Setelah Multica Desktop terpasang, **login dengan akun Multica milik Dan** (bukan akun Sarah) dan terima undangan workspace.

## 2. Ambil app dari GitHub
1. Buka menu Start, ketik **Git Bash**, lalu buka.
2. Ketik perintah ini, lalu tekan Enter:
   ```
   cd ~/Documents && git clone https://github.com/sarahshafiran/kantor-virtual.git
   ```
3. Kalau diminta login GitHub, pilih **Sign in with your browser** dan login dengan akun GitHub Dan.

## 3. Buka kantor
1. Buka folder **Documents → kantor-virtual** di File Explorer.
2. Klik dua kali **Buka Kantor** (file `Buka Kantor.cmd`).
   - Kalau muncul peringatan biru "Windows protected your PC", klik **More info → Run anyway**. Ini hanya muncul sekali.
3. Pembukaan pertama butuh 2–3 menit untuk persiapan. Setelah itu browser terbuka sendiri di `http://127.0.0.1:3456`.
4. Biarkan jendela hitam tetap terbuka selama memakai kantor. Tutup jendela itu untuk mematikan kantor.

**Biar gampang:** klik kanan `Buka Kantor.cmd` → *Show more options* → *Send to* → **Desktop (create shortcut)**.

## Cara kerja sehari-hari
- Setiap kali dibuka, ikon otomatis mengambil versi terbaru dari GitHub.
- Semua persetujuan dan revisi dari laptop Dan tercatat atas nama Dan.
- Laptop Dan tidak perlu menyala supaya worker Sarah bekerja, dan sebaliknya.

## Kalau ada masalah
| Muncul pesan | Artinya |
|---|---|
| "Node.js belum terpasang" | Pasang Node.js (langkah 1), lalu klik ikon lagi |
| "Belum login Multica di laptop ini" | Buka Multica Desktop, login, lalu muat ulang browser |
| Browser tidak terbuka sendiri | Buka browser dan ketik `http://127.0.0.1:3456` |
