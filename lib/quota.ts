import type { Snapshot } from "./multica";
// Membaca pesan "kuota habis" dari Claude Code / Codex dan menghitung kapan kuota reset.
// Contoh pesan asli: "You've hit your 5-hour limit · resets 3:40pm (Asia/Jakarta)"

export const isQuotaError = (e?: string | null) =>
  !!e && /hit your .*limit|usage limit|rate.?limit|quota|too many requests|limit reached/i.test(e);
export const isLoginError = (e?: string | null) => !!e && /oauth|authenticat|not logged in|login/i.test(e);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Selisih jam zona waktu (menit) pada saat tertentu, mis. Asia/Jakarta = +420. */
function tzOffsetMin(tz: string, at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Jam reset kuota, dihitung dari waktu kegagalan. null kalau pesannya tidak menyebut waktu. */
export function quotaResetAt(error: string, failedAt: Date, fallbackTz = "Asia/Jakarta"): Date | null {
  // "resets 3:40pm (Asia/Jakarta)" atau "resets Nov 12, 3pm (Asia/Jakarta)"
  const m = error.match(/resets?\s+(?:at\s+)?(?:([A-Za-z]{3})\w*\s+(\d{1,2}),?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(([^)]+)\))?/i);
  if (m) {
    const [, mon, day, hh, mm, ap, tzName] = m;
    const tz = tzName && /\//.test(tzName) ? tzName : fallbackTz;
    let h = +hh % 12; if (ap?.toLowerCase() === "pm") h += 12; if (!ap) h = +hh;
    const off = tzOffsetMin(tz, failedAt);
    const local = new Date(failedAt.getTime() + off * 60000); // jam dinding di zona itu, disimpan sebagai UTC
    const y = local.getUTCFullYear();
    const mo = mon ? MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) : local.getUTCMonth();
    const d = day ? +day : local.getUTCDate();
    let ts = Date.UTC(y, mo, d, h, mm ? +mm : 0) - off * 60000;
    if (!mon && ts < failedAt.getTime()) ts += 86400000; // jam yang disebut sudah lewat → besok
    return new Date(ts);
  }
  // "try again in 2 hours 13 minutes" / "in 45 minutes"
  const r = error.match(/\bin\s+(?=\d)(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i);
  if (r && (r[1] || r[2])) return new Date(failedAt.getTime() + ((+(r[1] ?? 0)) * 60 + +(r[2] ?? 0)) * 60000);
  return null;
}

export const fmtTime = (d: Date, tz = process.env.KANTOR_TIMEZONE || "Asia/Jakarta") =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);

export type QuotaState = { runtimeId: string; provider: string; resetAt: string | null; since: string };

/** Mesin AI mana yang sedang kehabisan kuota (dilihat dari run terakhir di mesin itu). */
export function quotaStates(s: Snapshot): QuotaState[] {
  const out: QuotaState[] = [];
  for (const rt of s.runtimes) {
    const runs = s.runs.filter(r => r.runtime_id === rt.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const last = runs.find(r => r.status === "completed" || r.status === "failed");
    if (last?.status === "failed" && isQuotaError(last.error)) {
      const reset = quotaResetAt(last.error!, new Date(last.completed_at ?? last.created_at), process.env.KANTOR_TIMEZONE || "Asia/Jakarta");
      // Sudah lewat 15 menit dari jam reset: anggap kuota pulih (mesin itu mungkin tidak dipakai lagi sejak worker dipindah).
      if (reset && Date.now() > reset.getTime() + 15 * 60000) continue;
      out.push({ runtimeId: rt.id, provider: rt.provider, resetAt: reset?.toISOString() ?? null, since: last.created_at });
    }
  }
  // Simulasi untuk uji (hanya dipakai `npm run penjaga:uji -- --kuota=claude`, tidak mengubah apa pun).
  const sim = process.env.KANTOR_UJI_KUOTA;
  if (sim) for (const rt of s.runtimes.filter(r => r.provider === sim && !out.some(o => o.runtimeId === r.id)))
    out.push({ runtimeId: rt.id, provider: rt.provider, resetAt: new Date(Date.now() + 3600000).toISOString(), since: new Date().toISOString() });
  return out;
}

