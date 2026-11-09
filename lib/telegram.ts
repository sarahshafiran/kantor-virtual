// Kirim pesan ke Telegram lewat bot milik kantor.
// TELEGRAM_BOT_TOKEN = token dari @BotFather
// TELEGRAM_CHATS     = daftar penerima "Nama:chatId", dipisah koma. Contoh: "Ara:123456,Dan:789012"

export function telegramReady() {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHATS;
}

function recipients(): { name: string; chat: string }[] {
  return (process.env.TELEGRAM_CHATS ?? "").split(",").map(x => x.trim()).filter(Boolean).map(x => {
    const [name, chat] = x.includes(":") ? x.split(":") : ["", x];
    return { name: name.trim(), chat: chat.trim() };
  });
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** Kirim ke semua penerima, atau hanya ke satu nama (mis. tugas yang ditujukan ke Dan). */
export async function telegram(text: string, onlyName?: string | null) {
  if (!telegramReady()) return 0;
  const to = recipients().filter(r => !onlyName || !r.name || r.name.toLowerCase() === onlyName.toLowerCase());
  let sent = 0;
  for (const r of to) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: r.chat, text: esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"), parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (res.ok) sent++;
  }
  return sent;
}
