# Menyambungkan Telegram

Setelah tersambung, kamu dan Dan mendapat pesan Telegram untuk:
- ☕ kuota Claude/GPT habis, beserta jam reset-nya, dan ▶️ saat task dilanjutkan otomatis
- 📄 hasil kerja baru yang menunggu review
- 📋 tugas baru untukmu atau untuk Dan (dikirim ke orangnya saja)
- ⚠️ login Claude/GPT di laptop kedaluwarsa
- ☀️ ringkasan pagi (07.00): task yang telat dan yang tenggatnya ≤ 2 hari

Pesan dikirim dari dua tempat, tanpa dobel:
- **laptop**, saat app Kantor sedang terbuka (dicek tiap 5 menit)
- **GitHub**, tiap 30 menit pukul 07.00–23.30, **walaupun semua laptop mati**

Waktu: sekitar 15 menit. Semua token dan kode diisi olehmu sendiri. Jangan kirim token ke chat.

## 1. Buat bot (Telegram)
1. Di Telegram, cari **@BotFather**, lalu kirim `/newbot`.
2. Beri nama, misalnya `Kantor Salam`, lalu username yang diakhiri `bot`, misalnya `kantor_salam_bot`.
3. BotFather memberi **token** (bentuknya `123456789:ABC...`). Salin token itu.

## 2. Mulai obrolan dengan bot
- Kamu **dan Dan**: buka bot-nya (link `t.me/username_bot` dari BotFather), lalu tekan **Start**.

## 3. Isi token di laptop
1. Buka file `.env.local` di folder **kantor-virtual** (pakai TextEdit).
2. Tempel token setelah `TELEGRAM_BOT_TOKEN=`, lalu simpan.
3. Kabari Claude. Claude akan menjalankan `npm run telegram:cek` untuk menemukan nomor chat kamu dan Dan, lalu mengisi baris `TELEGRAM_CHATS`.

## 4. Token Multica untuk penjaga di GitHub
1. Buka web Multica → **Settings → API tokens** → buat token baru, misalnya bernama `Penjaga kantor`, dengan masa berlaku 1 tahun.
2. Salin token-nya (diawali `mul_`). Token hanya tampil sekali.

## 5. Simpan rahasia di GitHub
Buka https://github.com/sarahshafiran/kantor-virtual/settings/secrets/actions → **New repository secret**, lalu buat tiga rahasia:

| Name | Isi |
|---|---|
| `MULTICA_TOKEN` | token Multica dari langkah 4 |
| `TELEGRAM_BOT_TOKEN` | token bot dari langkah 1 |
| `TELEGRAM_CHATS` | baris `Ara:...,Dan:...` dari langkah 3 |

## 6. Uji
- Buka tab **Actions** di repo → **Penjaga kantor** → **Run workflow**. Kalau berhasil, tanda centang hijau muncul dalam 1–2 menit.
- Pesan pertama yang akan datang biasanya ringkasan pagi. Keadaan yang sudah ada saat pertama tersambung dicatat diam-diam supaya Telegram tidak kebanjiran.

Biaya: gratis. Jadwal ini memakai sekitar 1.000 dari 2.000 menit gratis GitHub per bulan.
