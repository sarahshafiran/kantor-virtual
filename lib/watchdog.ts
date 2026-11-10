// Penjaga kantor: berjalan berkala (di laptop saat app terbuka, dan di GitHub tiap 30 menit).
// 1. Task yang gagal karena kuota AI habis dijalankan ulang otomatis setelah kuota reset.
// 2. Mengirim notifikasi Telegram: kuota habis (dan jam reset-nya), lanjut lagi, perlu review,
//    tugas untuk manusia, login AI kedaluwarsa, dan ringkasan pagi (telat & berisiko).
// Catatan "sudah dikirim / sudah diulang" disimpan di pengaturan workspace supaya tidak dobel.
import "server-only";
import { workspaces, loadWorkspace, rerunIssue, call_ as call, type Run, type Snapshot } from "./multica";
import { isQuotaError, isLoginError, quotaResetAt, fmtTime, quotaStates } from "./quota";
import { friendlyTitle } from "./titles";
import { telegram, telegramReady } from "./telegram";

type Memory = { sent?: Record<string, string>; retried?: Record<string, string>; started?: string };
const ACTIVE = new Set(["queued", "dispatched", "running", "in_progress", "preparing", "started"]);
const tz = () => process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
const provName = (p: string) => (p === "claude" ? "Claude" : p === "codex" ? "ChatGPT (Codex)" : p);

async function readMemory(wsId: string): Promise<{ settings: Record<string, unknown>; mem: Memory }> {
  const full = await call<{ settings?: Record<string, unknown> | null }>("GET", `/api/workspaces/${wsId}`, wsId);
  const settings = { ...(full.settings ?? {}) };
  return { settings, mem: (settings.kantor_watch as Memory) ?? {} };
}
async function writeMemory(wsId: string, mem: Memory) {
  // Simpan hanya 7 hari terakhir supaya catatannya tidak membengkak.
  const cutoff = Date.now() - 7 * 86400000;
  const prune = (o: Record<string, string> = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => Date.parse(v) > cutoff));
  const { settings } = await readMemory(wsId);
  settings.kantor_watch = { sent: prune(mem.sent), retried: prune(mem.retried), started: mem.started };
  await call("PATCH", `/api/workspaces/${wsId}`, wsId, { settings });
}

export async function runWatchdog(opts: { notify?: boolean; dryRun?: boolean } = {}) {
  const dry = !!opts.dryRun;
  const notify = (opts.notify ?? true) && !dry;
  const report: string[] = [];
  for (const w of await workspaces()) {
    const s = await loadWorkspace(w.id);
    const { mem } = await readMemory(w.id);
    mem.sent ??= {}; mem.retried ??= {};
    const now = Date.now();
    // Notifikasi hanya kalau Telegram sudah disambungkan. Saat pertama kali tersambung,
    // keadaan yang sudah ada dicatat diam-diam supaya tidak membanjiri Telegram.
    const canSend = notify && telegramReady();
    const firstRun = canSend && !mem.started;
    if (canSend && !mem.started) mem.started = new Date().toISOString();
    const once = async (key: string, text: string, onlyName?: string | null) => {
      if (!canSend || mem.sent![key]) return;
      if (!firstRun || key.startsWith("digest:")) await telegram(text, onlyName);
      mem.sent![key] = new Date().toISOString();
    };
    const open = s.kantor.open !== false;
    const issueById = new Map(s.issues.map(i => [i.id, i]));
    const rtById = new Map(s.runtimes.map(r => [r.id, r]));
    const latest = new Map<string, Run>();
    for (const r of s.runs) if (r.issue_id && (!latest.has(r.issue_id) || Date.parse(r.created_at) > Date.parse(latest.get(r.issue_id)!.created_at))) latest.set(r.issue_id, r);

    // 1) Kuota habis → beri tahu jam reset; setelah reset → jalankan ulang otomatis.
    for (const q of quotaStates(s)) {
      const when = q.resetAt ? fmtTime(new Date(q.resetAt)) : null;
      await once(`quota:${q.runtimeId}:${q.since.slice(0, 13)}`,
        `☕ **Kuota ${provName(q.provider)} habis** (${w.name}).${when ? ` Reset sekitar pukul **${when}**.` : ""} Task yang terhenti akan dilanjutkan otomatis setelah kuota pulih.`);
    }
    for (const [issueId, r] of latest) {
      const issue = issueById.get(issueId);
      if (!issue || r.status !== "failed" || !isQuotaError(r.error) || mem.retried![r.id]) continue;
      if (["done", "cancelled", "in_review", "backlog"].includes(issue.status)) continue;
      const reset = quotaResetAt(r.error!, new Date(r.completed_at ?? r.created_at), tz());
      const readyAt = reset ? reset.getTime() + 2 * 60000 : Date.parse(r.created_at) + 60 * 60000; // tanpa jam: coba lagi setelah 1 jam
      const rt = rtById.get(r.runtime_id);
      if (now < readyAt || !open || rt?.status !== "online") continue;
      if (s.runs.some(x => x.issue_id === issueId && ACTIVE.has(x.status))) continue;
      if (dry) { report.push(`[uji] akan mengulang: ${friendlyTitle(issue)}`); continue; }
      await rerunIssue(w.id, issueId).catch(() => {});
      mem.retried![r.id] = new Date().toISOString();
      report.push(`ulang: ${friendlyTitle(issue)}`);
      await once(`resume:${r.id}`, `▶️ Kuota ${provName(rt?.provider ?? "")} sudah pulih. Melanjutkan: **${friendlyTitle(issue)}**.`);
    }

    // 2) Login AI kedaluwarsa di laptop.
    for (const rt of s.runtimes) {
      const last = s.runs.filter(r => r.runtime_id === rt.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      if (last?.status === "failed" && isLoginError(last.error))
        await once(`login:${rt.id}:${last.created_at.slice(0, 10)}`, `⚠️ **Login ${provName(rt.provider)} di laptop kedaluwarsa** (${w.name}). Worker ${provName(rt.provider)} berhenti sampai login diperbaiki. Buka Kantor untuk petunjuknya.`);
    }

    // 3) Hasil baru yang perlu direview, dan tugas baru untuk manusia.
    const memberName = (id: string | null) => s.members.find(m => m.id === id || m.user_id === id)?.name ?? null;
    for (const i of s.issues) {
      const agent = s.agents.find(a => a.id === i.assignee_id);
      if (i.status === "in_review")
        await once(`review:${i.id}:${i.updated_at.slice(0, 16)}`, `📄 **${agent?.name ?? "Worker"}** selesai mengerjakan **${friendlyTitle(i)}** dan menunggu review.`);
      if (i.assignee_type === "member" && !["done", "cancelled"].includes(i.status))
        await once(`human:${i.id}`, `📋 Tugas untukmu: **${friendlyTitle(i)}**${i.due_date ? ` (tenggat ${i.due_date})` : ""}.`, memberName(i.assignee_id));
    }

    // 4) Ringkasan pagi: yang telat & berisiko (sekali sehari, mulai jam 07.00).
    const hour = +new Intl.DateTimeFormat("en-US", { timeZone: tz(), hour: "2-digit", hourCycle: "h23" }).format(new Date());
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(new Date());
    if (hour >= 7) {
      // Task yang sudah diselesaikan workernya (menunggu review / run terakhir selesai) tidak dihitung telat.
      const finished = (i: typeof s.issues[number]) => i.status === "in_review" || (i.assignee_type === "agent" &&
        latest.get(i.id)?.status === "completed" && !s.runs.some(x => x.issue_id === i.id && ACTIVE.has(x.status)));
      const openIssues = s.issues.filter(i => !["done", "cancelled"].includes(i.status) && i.due_date && !finished(i));
      const late = openIssues.filter(i => i.due_date! < today);
      const soon = openIssues.filter(i => i.due_date! >= today && Date.parse(i.due_date!) - Date.parse(today) <= 2 * 86400000);
      if (late.length || soon.length) {
        const line = (i: typeof openIssues[number]) => `• ${friendlyTitle(i)} (${i.due_date})`;
        await once(`digest:${today}`, [`☀️ **Ringkasan pagi · ${w.name}**`,
          late.length ? `\n🔴 Telat (${late.length}):\n${late.slice(0, 8).map(line).join("\n")}` : "",
          soon.length ? `\n🟠 Tenggat ≤ 2 hari (${soon.length}):\n${soon.slice(0, 8).map(line).join("\n")}` : ""].join("\n"));
      }
    }

    if (dry) {
      for (const q of quotaStates(s)) report.push(`[uji] kuota ${q.provider} habis, reset ${q.resetAt ? fmtTime(new Date(q.resetAt)) : "?"}`);
      report.push(`[uji] telegram ${telegramReady() ? "tersambung" : "belum disambungkan"}`);
      continue;
    }
    await writeMemory(w.id, mem);
  }
  return report;
}
