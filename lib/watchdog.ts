// Penjaga kantor: berjalan berkala (di laptop saat app terbuka, dan di GitHub tiap 30 menit).
// 1. Task yang gagal karena kuota AI habis dijalankan ulang otomatis setelah kuota reset.
// 2. Mengirim notifikasi Telegram: kuota habis (dan jam reset-nya), lanjut lagi, perlu review,
//    tugas untuk manusia, login AI kedaluwarsa, dan ringkasan pagi (telat & berisiko).
// Catatan "sudah dikirim / sudah diulang" disimpan di pengaturan workspace supaya tidak dobel.
import "server-only";
import { workspaces, loadWorkspace, rerunIssue, updateAgent, call_ as call, type Run, type Snapshot, type Moved } from "./multica";
import { isQuotaError, isLoginError, quotaResetAt, fmtTime, quotaStates } from "./quota";
import { friendlyTitle } from "./titles";
import { telegram, telegramReady, botFor } from "./telegram";

type Memory = { sent?: Record<string, string>; retried?: Record<string, string>; started?: string; moved?: Moved };
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
  settings.kantor_watch = { sent: prune(mem.sent), retried: prune(mem.retried), started: mem.started, moved: mem.moved ?? {} };
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
    const tg = { id: w.id, slug: w.slug, name: w.name, members: s.members.map(m => m.name) };
    const canSend = notify && telegramReady(tg);
    const firstRun = canSend && !mem.started;
    if (canSend && !mem.started) mem.started = new Date().toISOString();
    const once = async (key: string, text: string, onlyName?: string | null) => {
      if (!canSend || mem.sent![key]) return;
      if (!firstRun || key.startsWith("digest:")) await telegram(text, onlyName, tg);
      mem.sent![key] = new Date().toISOString();
    };
    const open = s.kantor.open !== false;
    const issueById = new Map(s.issues.map(i => [i.id, i]));
    const rtById = new Map(s.runtimes.map(r => [r.id, r]));
    const latest = new Map<string, Run>();
    for (const r of s.runs) if (r.issue_id && (!latest.has(r.issue_id) || Date.parse(r.created_at) > Date.parse(latest.get(r.issue_id)!.created_at))) latest.set(r.issue_id, r);

    // 1) Kuota habis → pindahkan worker ke mesin AI lain yang masih punya kuota (mis. Claude → GPT),
    //    lalu kembalikan setelah kuota mesin aslinya pulih. Kalau tidak ada mesin cadangan: tunggu reset.
    mem.moved ??= {};
    const quotas = quotaStates(s);
    const outNow = new Set(quotas.filter(q => !q.resetAt || Date.parse(q.resetAt) > now).map(q => q.runtimeId));
    const agentById = new Map(s.agents.map(a => [a.id, a]));
    const busy = (agentId: string) => s.runs.some(x => x.agent_id === agentId && ACTIVE.has(x.status));
    const switched: string[] = [];
    for (const q of quotas) {
      if (!outNow.has(q.runtimeId)) continue;
      const spare = s.runtimes.find(r => r.id !== q.runtimeId && r.provider !== q.provider && r.status === "online" && !outNow.has(r.id));
      const movers = s.agents.filter(a => a.runtime_id === q.runtimeId && !a.archived_at && !mem.moved![a.id]);
      if (spare && movers.length) {
        for (const a of movers) {
          if (dry) { report.push(`[uji] pindahkan ${a.name}: ${provName(q.provider)} → ${provName(spare.provider)}`); continue; }
          // Model & tingkat berpikir khusus mesin lama dikosongkan dulu, dan dikembalikan saat pulang.
          await updateAgent(w.id, a.id, { runtime_id: spare.id, model: "", thinking_level: "" });
          mem.moved![a.id] = { from: q.runtimeId, to: spare.id, at: new Date().toISOString(), resetAt: q.resetAt, model: a.model ?? "", thinking: a.thinking_level ?? "" };
          a.runtime_id = spare.id; switched.push(a.name);
        }
        if (switched.length) {
          const when = q.resetAt ? fmtTime(new Date(q.resetAt)) : null;
          await once(`switch:${q.runtimeId}:${q.since.slice(0, 13)}`,
            `🔁 **Kuota ${provName(q.provider)} habis** (${w.name}). ${switched.length} worker sementara pindah ke **${provName(spare.provider)}** dan task yang terhenti dilanjutkan sekarang.${when ? ` Mereka kembali ke ${provName(q.provider)} setelah kuota reset sekitar pukul **${when}**.` : ""}`);
          report.push(`pindah ke ${spare.provider}: ${switched.join(", ")}`);
        }
      } else if (!spare) {
        const when = q.resetAt ? fmtTime(new Date(q.resetAt)) : null;
        await once(`quota:${q.runtimeId}:${q.since.slice(0, 13)}`,
          `☕ **Kuota ${provName(q.provider)} habis** (${w.name}).${when ? ` Reset sekitar pukul **${when}**.` : ""} Task yang terhenti akan dilanjutkan otomatis setelah kuota pulih.`);
      }
    }
    // Pulang ke mesin asli: kuotanya sudah pulih dan worker sedang tidak di tengah pekerjaan.
    const back: string[] = [];
    for (const [agentId, m] of Object.entries(mem.moved)) {
      const a = agentById.get(agentId);
      if (!a || a.archived_at || a.runtime_id !== m.to) { if (!dry) delete mem.moved[agentId]; continue; } // diubah manual: tidak ikut campur lagi
      const resetPassed = m.resetAt ? now > Date.parse(m.resetAt) + 2 * 60000 : now > Date.parse(m.at) + 3 * 3600000;
      if (!resetPassed || outNow.has(m.from) || busy(agentId)) continue;
      if (dry) { report.push(`[uji] kembalikan ${a.name} ke mesin asli`); continue; }
      await updateAgent(w.id, agentId, { runtime_id: m.from, model: m.model, thinking_level: m.thinking });
      a.runtime_id = m.from; delete mem.moved[agentId]; back.push(a.name);
    }
    if (back.length) {
      await once(`back:${now - (now % 3600000)}`, `✅ Kuota pulih (${w.name}). ${back.join(", ")} kembali memakai mesin AI aslinya.`);
      report.push(`kembali: ${back.join(", ")}`);
    }
    for (const [issueId, r] of latest) {
      const issue = issueById.get(issueId);
      if (!issue || r.status !== "failed" || !isQuotaError(r.error) || mem.retried![r.id]) continue;
      if (["done", "cancelled", "in_review", "backlog"].includes(issue.status)) continue;
      const reset = quotaResetAt(r.error!, new Date(r.completed_at ?? r.created_at), tz());
      const readyAt = reset ? reset.getTime() + 2 * 60000 : Date.parse(r.created_at) + 60 * 60000; // tanpa jam: coba lagi setelah 1 jam
      // Worker sudah dipindah ke mesin lain → tidak perlu menunggu reset.
      const owner = issue.assignee_type === "agent" ? agentById.get(issue.assignee_id ?? "") : undefined;
      const movedAway = !!owner && owner.runtime_id !== r.runtime_id && !outNow.has(owner.runtime_id);
      const rt = rtById.get(movedAway ? owner!.runtime_id : r.runtime_id);
      if ((!movedAway && now < readyAt) || !open || rt?.status !== "online") continue;
      if (s.runs.some(x => x.issue_id === issueId && ACTIVE.has(x.status))) continue;
      if (dry) { report.push(`[uji] akan mengulang: ${friendlyTitle(issue)}`); continue; }
      await rerunIssue(w.id, issueId).catch(() => {});
      mem.retried![r.id] = new Date().toISOString();
      report.push(`ulang: ${friendlyTitle(issue)}`);
      if (!movedAway) await once(`resume:${r.id}`, `▶️ Kuota ${provName(rt?.provider ?? "")} sudah pulih. Melanjutkan: **${friendlyTitle(issue)}**.`);
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
      report.push(`[uji] telegram ${w.name}: ${!telegramReady(tg) ? "belum disambungkan" : botFor(tg)?.own ? "bot khusus kantor ini" : "bot utama (bersama)"}`);
      continue;
    }
    await writeMemory(w.id, mem);
  }
  return report;
}
