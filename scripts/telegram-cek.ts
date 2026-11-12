// Find the Telegram chat id of everyone who has sent /start to the bot.
// Pakai: isi TELEGRAM_BOT_TOKEN di file .env.local, lalu jalankan:  npm run telegram:cek
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.log("Isi dulu TELEGRAM_BOT_TOKEN di file .env.local (token dari @BotFather)."); process.exit(1); }
fetch(`https://api.telegram.org/bot${token}/getUpdates`).then(r => r.json()).then((j: { ok: boolean; result: { message?: { chat: { id: number; first_name?: string; username?: string } } }[] }) => {
  if (!j.ok) { console.log("Token tidak dikenali Telegram. Cek lagi tokennya."); return; }
  const chats = new Map<number, string>();
  for (const u of j.result) if (u.message) chats.set(u.message.chat.id, u.message.chat.first_name || u.message.chat.username || "Tanpa nama");
  if (!chats.size) { console.log("Belum ada pesan. Buka bot-nya di Telegram, kirim /start, lalu jalankan perintah ini lagi."); return; }
  console.log("Ditemukan:");
  for (const [id, name] of chats) console.log(`  ${name}: ${id}`);
  console.log("\nTulis di .env.local dan GitHub Secrets (ganti nama sesuai nama di Multica, mis. Ara dan Dan):");
  console.log("TELEGRAM_CHATS=" + [...chats].map(([id, name]) => `${name}:${id}`).join(","));
});
