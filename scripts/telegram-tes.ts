// Kirim satu pesan uji dari setiap kantor lewat bot-nya masing-masing.
// Pakai:  npm run telegram:tes
import { workspaces, loadDirectory } from "../lib/multica";
import { telegram, botFor } from "../lib/telegram";

(async () => {
  const only = process.argv[2]; // opsional: slug satu kantor saja
  for (const w of (await workspaces()).filter(w => !only || w.slug === only)) {
    const dir = await loadDirectory(w.id);
    const tg = { id: w.id, slug: w.slug, name: w.name, members: dir.members.map(m => m.name) };
    const bot = botFor(tg);
    if (!bot) { console.log(`${w.name}: belum ada bot.`); continue; }
    const n = await telegram(`👋 Uji notifikasi dari **${w.name}**. Mulai sekarang kabar kantor ini masuk ke sini.`, null, tg);
    console.log(`${w.name} (slug: ${w.slug}): ${bot.own ? "bot khusus" : "bot utama"}, terkirim ke ${n} orang (${tg.members.join(", ")}).`);
  }
})().catch(e => { console.error("Gagal:", e instanceof Error ? e.message : e); process.exit(1); });
