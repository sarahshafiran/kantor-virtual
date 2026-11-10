// Kirim pesan ke Telegram lewat bot milik kantor.
// TELEGRAM_BOT_TOKEN = token bot utama dari @BotFather (dipakai kantor yang belum punya bot sendiri)
// TELEGRAM_BOTS      = bot khusus per kantor, "slug-kantor=token" dipisah titik koma.
//                      Contoh: "ara-s-workspace=123:ABC;salam-little-ones=456:DEF"
// TELEGRAM_CHATS     = daftar penerima "Nama:chatId", dipisah koma. Contoh: "Ara:123456,Dan:789012"
//                      Chat id seseorang sama di semua bot, jadi cukup ditulis sekali.
//                      Pesan sebuah kantor hanya dikirim ke penerima yang menjadi anggota kantor itu.

export type TgOffice = { id: string; slug: string; name: string; members: string[] };

function bots(): Map<string, string> {
  return new Map((process.env.TELEGRAM_BOTS ?? "").split(";").map(x => x.trim()).filter(x => x.includes("="))
    .map(x => [x.slice(0, x.indexOf("=")).trim().toLowerCase(), x.slice(x.indexOf("=") + 1).trim()] as [string, string]));
}

/** Bot untuk kantor ini: bot khusus kalau ada, kalau tidak bot utama. */
export function botFor(office?: TgOffice | null): { token: string; own: boolean } | null {
  const b = bots();
  const own = office && (b.get(office.slug.toLowerCase()) ?? b.get(office.id.toLowerCase()));
  if (own) return { token: own, own: true };
  return process.env.TELEGRAM_BOT_TOKEN ? { token: process.env.TELEGRAM_BOT_TOKEN, own: false } : null;
}

export function telegramReady(office?: TgOffice | null) {
  return !!botFor(office) && !!process.env.TELEGRAM_CHATS;
}

function recipients(): { name: string; chat: string }[] {
  return (process.env.TELEGRAM_CHATS ?? "").split(",").map(x => x.trim()).filter(Boolean).map(x => {
    const [name, chat] = x.includes(":") ? x.split(":") : ["", x];
    return { name: name.trim(), chat: chat.trim() };
  });
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const same = (a: string, b: string) => {
  const x = a.toLowerCase().trim(), y = b.toLowerCase().trim();
  return x === y || x.split(/\s+/)[0] === y.split(/\s+/)[0];
};

/** Kirim ke anggota kantor ini, atau hanya ke satu nama (mis. tugas yang ditujukan ke Dan). */
export async function telegram(text: string, onlyName?: string | null, office?: TgOffice | null) {
  const bot = botFor(office);
  if (!bot || !process.env.TELEGRAM_CHATS) return 0;
  const to = recipients()
    .filter(r => !office || !r.name || office.members.some(m => same(m, r.name)))
    .filter(r => !onlyName || !r.name || same(r.name, onlyName));
  // Bot bersama dipakai beberapa kantor: tulis nama kantornya di atas pesan supaya jelas asalnya.
  const body = office && !bot.own ? `🏢 **${office.name}**\n${text}` : text;
  let sent = 0;
  for (const r of to) {
    const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: r.chat, text: esc(body).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"), parse_mode: "HTML", disable_web_page_preview: true }),
    }).catch(() => null);
    if (res?.ok) sent++;
  }
  return sent;
}
