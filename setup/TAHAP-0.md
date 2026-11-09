# Tahap 0: Mesin (laptop Sarah + Multica Cloud)

Keputusan (9 Nov 2026): worker berjalan di **laptop Sarah**, bukan VPS. Kantor buka saat laptop menyala; kalau laptop dibuka di luar jam kerja, worker lembur.

## Status saat dicek (9 Nov 2026)
- [x] Multica Desktop 0.7.2 terpasang, login sebagai Ara (Multica Cloud, api.multica.ai)
- [x] Daemon berjalan, dikelola oleh Multica Desktop, runtime: **claude** dan **codex**
- [x] Claude Code 2.1.316 dan Codex CLI 0.166.0 terpasang
- [x] Workspace **Salam, Little Ones** dengan 7 agen dan 55 issue (sudah ada tanggal jatuh tempo dan assign ke member)
- [ ] **[Sarah]** Pastikan Multica Desktop terbuka otomatis saat login: System Settings → General → Login Items → tambahkan Multica
- [ ] **[Sarah]** Undang Dan ke workspace dari web Multica (Settings → Members). Dan login dengan akunnya sendiri.
- [ ] Cek paket Multica Cloud (berapa member yang boleh gratis)

## Catatan
- Worker hanya bekerja saat laptop ini menyala. Task dari Dan saat laptop tertutup akan menunggu.
- Semua worker memakai langganan Claude/ChatGPT milik Sarah. Kuotanya dipakai bersama, termasuk chat pribadi.
- Menutup laptop di tengah task menghentikan task itu; task diulang saat laptop dibuka lagi.
- Rencana VPS lama (`setup-vps.sh`) tidak dipakai dan disimpan sebagai cadangan. SSH key `~/.ssh/kantor_vps` boleh dihapus.
