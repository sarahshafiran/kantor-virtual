// Mengubah data Multica menjadi "kantor": ruangan, meja, status worker, dan daftar yang perlu perhatian.
import type { Snapshot, Issue, Run, Agent } from "./multica";
import { friendlyTitle } from "./titles";

export type Due = "late" | "risk" | null;
export type TaskView = {
  id: string; key: string; title: string; status: string; statusLabel: string; due: string | null; dueFlag: Due;
  dueText: string | null; url: string; ws: string; wsName: string; assignee: string | null; assigneeType: "agent" | "member" | null; project: string | null;
};
export type DeskState = "working" | "failed" | "review" | "ready" | "home" | "off" | "closed";
export type Desk = {
  agentId: string; name: string; emoji: string | null; avatar: string | null; description: string;
  runtime: string; state: DeskState; bubble: string; reviewCount: number; lateCount: number; riskCount: number; tasks: TaskView[];
};
export type Room = { id: string; name: string; icon: string | null; progress: string | null; desks: Desk[] };
export type RunView = { id: string; issueId: string | null; ws: string; agent: string; status: string; when: string; error: string | null; issueTitle: string | null; url: string | null };
export type Office = {
  workspace: string; workspaceId: string; workspaceSlug: string; today: string; updatedAt: string; open: boolean;
  switchOpen: boolean; parked: number; changedBy: string | null;
  runtimes: { name: string; provider: string; online: boolean; lastSeen: string }[];
  rooms: Room[]; idleDesks: Desk[];
  attention: { overdue: TaskView[]; human: TaskView[]; review: TaskView[]; failed: RunView[] };
  people: string[];
  agentsDetail: Record<string, { runs: RunView[]; tasks: TaskView[] }>;
  projects: { id: string; name: string }[];
};

const CLOSED = new Set(["done", "cancelled", "canceled", "completed", "duplicate"]);
const isClosed = (i: Issue) => CLOSED.has(i.status) || CLOSED.has(String(i.status_category || ""));
const ACTIVE_RUN = new Set(["queued", "dispatched", "running", "in_progress", "preparing", "started"]);
const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", todo: "Siap dikerjakan", in_progress: "Dikerjakan", in_review: "Perlu review", done: "Selesai", cancelled: "Batal",
};

function todayIn(tz: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fmtDate = (s: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(s + "T00:00:00"));

function relTime(iso: string, tz: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} jam lalu`;
  return new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const emojiOf = (a: Agent) => (a.avatar_url?.startsWith("emoji:") ? a.avatar_url.slice(6) : null);
const imgOf = (a: Agent) => (a.avatar_url && /^https?:/.test(a.avatar_url) ? a.avatar_url : null);

function shortError(e: string | null) {
  if (!e) return "alasan tidak diketahui";
  if (/oauth|authenticat|login/i.test(e)) return "login AI kedaluwarsa";
  if (/rate|limit|quota|usage/i.test(e)) return "kuota AI habis";
  if (/offline|heartbeat/i.test(e)) return "laptop mati saat bekerja";
  return e.length > 60 ? e.slice(0, 57) + "…" : e;
}

export function buildOffice(s: Snapshot): Office {
  const tz = process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
  const today = todayIn(tz);
  const memberName = (id: string | null) => s.members.find(m => m.id === id || m.user_id === id)?.name ?? "Anggota";
  const agentById = new Map(s.agents.map(a => [a.id, a]));
  const issueById = new Map(s.issues.map(i => [i.id, i]));
  const projectById = new Map(s.projects.map(p => [p.id, p]));
  const runtimeById = new Map(s.runtimes.map(r => [r.id, r]));
  const url = (i: Issue) => `${process.env.MULTICA_APP_URL || "https://multica.ai"}/${s.workspace.slug}/issues/${i.identifier}`;

  const open = s.issues.filter(i => !isClosed(i));
  const switchOpen = s.kantor.open !== false;

  const view = (i: Issue): TaskView => {
    let dueFlag: Due = null, dueText: string | null = null;
    if (i.due_date) {
      const d = daysBetween(today, i.due_date);
      const notStarted = i.status === "backlog" || i.status === "todo";
      if (d < 0) { dueFlag = "late"; dueText = `Telat ${-d} hari`; }
      else if (d <= 2) {
        dueFlag = "risk";
        dueText = (d === 0 ? "Jatuh tempo hari ini" : d === 1 ? "Jatuh tempo besok" : `Jatuh tempo ${fmtDate(i.due_date)}`) +
          (i.status === "in_review" ? " · menunggu review" : i.assignee_type === "member" ? " · menunggu manusia" : notStarted ? " · belum mulai" : "");
      } else dueText = fmtDate(i.due_date);
    }
    const assignee = i.assignee_type === "agent" ? agentById.get(i.assignee_id || "")?.name ?? "Agen"
      : i.assignee_type === "member" ? memberName(i.assignee_id) : null;
    return {
      id: i.id, key: i.identifier, title: friendlyTitle(i), status: i.status,
      statusLabel: i.status === "backlog" && (i.metadata ?? {}).kantor_parked ? "Menunggu kantor buka" : i.status_name || STATUS_LABEL[i.status] || i.status,
      due: i.due_date, dueFlag, dueText, url: url(i), ws: s.workspace.id, wsName: s.workspace.name, assignee, assigneeType: i.assignee_type,
      project: i.project_id ? projectById.get(i.project_id)?.title ?? null : null,
    };
  };

  const runView = (r: Run): RunView => {
    const iss = r.issue_id ? issueById.get(r.issue_id) : undefined;
    return { id: r.id, ws: s.workspace.id, agent: agentById.get(r.agent_id)?.name ?? "Agen", status: r.status, when: relTime(r.completed_at || r.started_at || r.created_at, tz),
      error: r.status === "failed" ? shortError(r.error) : null, issueTitle: iss ? friendlyTitle(iss) : null, issueId: iss?.id ?? null, url: iss ? url(iss) : null };
  };

  const runsByAgent = new Map<string, Run[]>();
  for (const r of [...s.runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    const arr = runsByAgent.get(r.agent_id) ?? []; arr.push(r); runsByAgent.set(r.agent_id, arr);
  }

  // Status worker (global), dihitung dari runtime, run terakhir, dan antrean issue.
  const deskBase = (a: Agent) => {
    const rt = runtimeById.get(a.runtime_id);
    const online = rt?.status === "online";
    const runs = runsByAgent.get(a.id) ?? [];
    const active = runs.find(r => ACTIVE_RUN.has(r.status));
    const last = runs[0];
    const mine = open.filter(i => i.assignee_type === "agent" && i.assignee_id === a.id);
    const review = mine.filter(i => i.status === "in_review");
    const ready = mine.filter(i => i.status === "todo" || i.status === "in_progress");
    let state: DeskState, bubble: string;
    const parkedMine = mine.filter(i => (i.metadata ?? {}).kantor_parked).length;
    if (!switchOpen && !active) { state = "closed"; bubble = parkedMine ? `🔒 Kantor tutup · ${parkedMine} task menunggu` : "🔒 Kantor tutup"; }
    else if (!online) { state = "off"; bubble = "🌙 Laptop mati · lanjut saat menyala"; }
    else if (active) { state = "working"; const ai = issueById.get(active.issue_id || ""); bubble = "Mengerjakan: " + (ai ? friendlyTitle(ai) : "tugas"); }
    else if (last?.status === "failed" && Date.now() - Date.parse(last.created_at) < 86400000 * 3) { state = "failed"; bubble = "⚠️ Gagal: " + shortError(last.error); }
    else if (review.length) { state = "review"; bubble = `Menunggu review-mu (${review.length})`; }
    else if (ready.length) { state = "ready"; bubble = `Siap mengerjakan ${ready.length} task`; }
    else {
      state = "home";
      const backlog = mine.filter(i => i.status === "backlog").length;
      bubble = backlog ? `🏠 Pulang · ${backlog} backlog belum dimulai` : "🏠 Pulang · tidak ada task";
    }
    return {
      agentId: a.id, name: a.name, emoji: emojiOf(a), avatar: imgOf(a), description: a.description || "",
      runtime: rt ? `${rt.provider === "claude" ? "Claude" : rt.provider === "codex" ? "GPT (Codex)" : rt.provider}${a.model ? " · " + a.model : ""}` : "Tanpa runtime",
      state, bubble,
    };
  };

  const order: Record<string, number> = { in_review: 0, in_progress: 1, todo: 2, backlog: 3 };
  const sortTasks = (t: TaskView[]) => t.sort((a, b) =>
    (a.dueFlag === "late" ? 0 : a.dueFlag === "risk" ? 1 : 2) - (b.dueFlag === "late" ? 0 : b.dueFlag === "risk" ? 1 : 2) ||
    (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.due).localeCompare(String(b.due)));

  const makeDesk = (a: Agent, issues: Issue[]): Desk => {
    const tasks = sortTasks(issues.map(view));
    return { ...deskBase(a), tasks, reviewCount: tasks.filter(t => t.status === "in_review").length,
      lateCount: tasks.filter(t => t.dueFlag === "late").length, riskCount: tasks.filter(t => t.dueFlag === "risk").length };
  };

  const agentIssues = open.filter(i => i.assignee_type === "agent" && i.assignee_id);
  const rooms: Room[] = s.projects.map(p => {
    const inRoom = agentIssues.filter(i => i.project_id === p.id);
    const ids = [...new Set(inRoom.map(i => i.assignee_id!))].filter(id => agentById.has(id));
    return {
      id: p.id, name: p.title, icon: p.icon,
      progress: p.issue_count ? `${p.done_count}/${p.issue_count} selesai` + (p.due_date ? ` · target ${fmtDate(p.due_date)}` : "") : null,
      desks: ids.map(id => makeDesk(agentById.get(id)!, inRoom.filter(i => i.assignee_id === id)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }).filter(r => r.desks.length);

  const seated = new Set(rooms.flatMap(r => r.desks.map(d => d.agentId)));
  const idleDesks = s.agents.filter(a => !seated.has(a.id))
    .map(a => makeDesk(a, agentIssues.filter(i => i.assignee_id === a.id && !i.project_id)));

  const allViews = open.map(view);
  const failed = s.runs.filter(r => r.status === "failed" && Date.now() - Date.parse(r.created_at) < 86400000 * 7)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 8).map(runView);

  const agentsDetail: Office["agentsDetail"] = {};
  for (const a of s.agents) agentsDetail[a.id] = {
    runs: (runsByAgent.get(a.id) ?? []).slice(0, 6).map(runView),
    tasks: sortTasks(agentIssues.filter(i => i.assignee_id === a.id).map(view)),
  };

  return {
    workspace: s.workspace.name, workspaceId: s.workspace.id, workspaceSlug: s.workspace.slug,
    today: new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()),
    updatedAt: new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date()),
    open: s.runtimes.some(r => r.status === "online"),
    switchOpen, parked: s.issues.filter(i => (i.metadata ?? {}).kantor_parked && i.status === "backlog").length,
    changedBy: s.kantor.changedBy ?? null,
    runtimes: s.runtimes.map(r => ({ name: r.provider === "claude" ? "Claude" : r.provider === "codex" ? "GPT (Codex)" : r.name, provider: r.provider, online: r.status === "online", lastSeen: relTime(r.last_seen_at, tz) })),
    rooms, idleDesks,
    attention: {
      overdue: sortTasks(allViews.filter(t => t.dueFlag)),
      human: sortTasks(allViews.filter(t => t.assigneeType === "member")),
      review: sortTasks(allViews.filter(t => t.status === "in_review")),
      failed,
    },
    people: [...new Set(s.members.map(m => m.name))],
    projects: s.projects.map(p => ({ id: p.id, name: p.title })),
    agentsDetail,
  };
}
