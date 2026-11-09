// Saat app berjalan di laptop, penjaga kantor jalan tiap 5 menit:
// melanjutkan task setelah kuota AI pulih dan mengirim notifikasi Telegram (kalau sudah disambungkan).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NETLIFY || process.env.VERCEL || process.env.KANTOR_NO_WATCHDOG) return;
  const { runWatchdog } = await import("./lib/watchdog");
  const tick = () => runWatchdog().then(r => { if (r.length) console.log("[penjaga]", r.join("; ")); }).catch(e => console.warn("[penjaga] gagal:", String(e).slice(0, 200)));
  setTimeout(tick, 20_000);
  setInterval(tick, 5 * 60_000);
}
