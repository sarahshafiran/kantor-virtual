// Buka/Tutup kantor per workspace.
// Tutup: jadwal otomatis dijeda, antrean worker diparkir ke "backlog" (Multica tidak menjalankan task di backlog).
// Buka: jadwal jalan lagi, antrean yang diparkir dikembalikan (Multica langsung menjalankannya),
//       dan task yang terhenti karena laptop mati / kuota habis / dihentikan dijalankan ulang.
import "server-only";
import {
  loadWorkspace, autopilots, setAutopilotStatus, updateIssue, setIssueMeta, deleteIssueMeta,
  rerunIssue, cancelRun, saveKantorSettings, me, type Issue, type Run,
} from "./multica";
import { friendlyTitle } from "./titles";

export const PARK_KEY = "kantor_parked";
const ACTIVE = new Set(["queued", "dispatched", "running", "in_progress", "preparing", "started"]);
const RESUMABLE_FAIL = /offline|heartbeat|rate|limit|quota|usage|cancel|authenticat|oauth|login/i;

export type Plan = {
  action: "close" | "open";
  autopilots: string[];             // judul jadwal yang dijeda / dijalankan lagi
  park: { id: string; title: string }[];     // antrean yang diparkir (tutup)
  running: { id: string; title: string }[];  // sedang dikerjakan saat ini (tutup)
  resume: { id: string; title: string }[];   // dikembalikan dari parkir (buka)
  rerun: { id: string; title: string }[];    // dijalankan ulang (buka)
};

const parkedOf = (i: Issue) => (i.metadata ?? {})[PARK_KEY];

async function snapshot(ws: string) {
  const s = await loadWorkspace(ws);
  const runsByIssue = new Map<string, Run[]>();
  for (const r of [...s.runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (!r.issue_id) continue;
    const arr = runsByIssue.get(r.issue_id) ?? []; arr.push(r); runsByIssue.set(r.issue_id, arr);
  }
  return { s, runsByIssue };
}

export async function planOffice(ws: string, action: "close" | "open"): Promise<Plan> {
  const { s, runsByIssue } = await snapshot(ws);
  const aps = await autopilots(ws).catch(() => []);
  const agentIssues = s.issues.filter(i => i.assignee_type === "agent");
  const t = (i: Issue) => ({ id: i.id, title: friendlyTitle(i) });
  if (action === "close") {
    const running = agentIssues.filter(i => (runsByIssue.get(i.id) ?? []).some(r => ACTIVE.has(r.status)));
    const runningIds = new Set(running.map(i => i.id));
    return {
      action, autopilots: aps.filter(a => a.status === "active").map(a => a.title),
      park: agentIssues.filter(i => (i.status === "todo" || i.status === "in_progress") && !runningIds.has(i.id)).map(t),
      running: running.map(t), resume: [], rerun: [],
    };
  }
  const paused = new Set(s.kantor.pausedAutopilots ?? []);
  const resume = s.issues.filter(i => parkedOf(i) && i.status === "backlog");
  const resumeIds = new Set(resume.map(i => i.id));
  const rerun = agentIssues.filter(i => {
    if (resumeIds.has(i.id) || !(i.status === "todo" || i.status === "in_progress")) return false;
    const runs = runsByIssue.get(i.id) ?? [];
    if (runs.some(r => ACTIVE.has(r.status))) return false;
    const last = runs[0];
    return !!last && (last.status === "cancelled" || (last.status === "failed" && RESUMABLE_FAIL.test(`${last.error ?? ""} ${last.failure_reason ?? ""}`)));
  });
  return { action, autopilots: aps.filter(a => paused.has(a.id)).map(a => a.title), park: [], running: [], resume: resume.map(t), rerun: rerun.map(t) };
}

export async function closeOffice(ws: string, stopRunning: boolean) {
  const { s, runsByIssue } = await snapshot(ws);
  const who = (await me()).name;
  const aps = (await autopilots(ws).catch(() => [])).filter(a => a.status === "active");
  for (const a of aps) await setAutopilotStatus(ws, a.id, "paused");

  let parked = 0, stopped = 0;
  for (const i of s.issues.filter(x => x.assignee_type === "agent" && (x.status === "todo" || x.status === "in_progress"))) {
    const active = (runsByIssue.get(i.id) ?? []).filter(r => ACTIVE.has(r.status));
    if (active.length && !stopRunning) continue; // biarkan yang sedang jalan selesai
    for (const r of active) { await cancelRun(ws, i.id, r.id).catch(() => {}); stopped++; }
    await setIssueMeta(ws, i.id, PARK_KEY, i.status);
    await updateIssue(ws, i.id, { status: "backlog" });
    parked++;
  }
  await saveKantorSettings(ws, { ...s.kantor, open: false, changedAt: new Date().toISOString(), changedBy: who, pausedAutopilots: aps.map(a => a.id) });
  return { autopilots: aps.length, parked, stopped };
}

export async function openOffice(ws: string) {
  const plan = await planOffice(ws, "open");
  const { s } = await snapshot(ws);
  const who = (await me()).name;
  const paused = new Set(s.kantor.pausedAutopilots ?? []);
  const aps = (await autopilots(ws).catch(() => [])).filter(a => paused.has(a.id) && a.status === "paused");
  for (const a of aps) await setAutopilotStatus(ws, a.id, "active");

  for (const r of plan.resume) {
    const issue = s.issues.find(i => i.id === r.id)!;
    const back = parkedOf(issue) === "in_progress" ? "in_progress" : "todo";
    await updateIssue(ws, r.id, { status: back }); // keluar dari backlog = Multica menjalankan task
    await deleteIssueMeta(ws, r.id, PARK_KEY).catch(() => {});
  }
  for (const r of plan.rerun) await rerunIssue(ws, r.id).catch(() => {});
  await saveKantorSettings(ws, { ...s.kantor, open: true, changedAt: new Date().toISOString(), changedBy: who, pausedAutopilots: [] });
  return { autopilots: aps.length, resumed: plan.resume.length, rerun: plan.rerun.length };
}

/** Saat kantor tutup: parkir satu task supaya pesan/revisi baru menunggu sampai kantor dibuka. */
export async function parkIssue(ws: string | null, issueId: string, returnTo: "todo" | "in_progress" = "todo") {
  await setIssueMeta(ws, issueId, PARK_KEY, returnTo);
  await updateIssue(ws, issueId, { status: "backlog" });
}
