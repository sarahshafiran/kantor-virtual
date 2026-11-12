// Klien baca-saja untuk Multica Cloud API. Hanya dipakai di server (token tidak pernah dikirim ke browser).
import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Agent = {
  id: string; name: string; description: string; avatar_url: string | null;
  runtime_id: string; status: string; model: string; archived_at: string | null; thinking_level?: string | null;
};
/** Worker yang sementara dipindah ke mesin AI lain karena kuota mesin aslinya habis. */
export type Moved = Record<string, { from: string; to: string; at: string; resetAt: string | null; model: string; thinking: string }>;
export type Project = { id: string; title: string; icon: string | null; status: string; due_date: string | null; issue_count: number; done_count: number };
export type Runtime = { id: string; name: string; provider: string; status: string; last_seen_at: string; owner_id: string; visibility?: string; shared_with?: unknown[] };
export type Issue = {
  id: string; identifier: string; title: string; status: string; status_category?: string; status_name?: string;
  priority: string; due_date: string | null; start_date: string | null; project_id: string | null;
  assignee_type: "agent" | "member" | null; assignee_id: string | null; updated_at: string; last_activity_at: string; created_at?: string;
  metadata?: Record<string, unknown>;
};
export type Run = {
  id: string; agent_id: string; issue_id: string | null; status: string; error: string | null; failure_reason?: string | null;
  created_at: string; started_at: string | null; completed_at: string | null; runtime_id: string;
};
export type Member = { id: string; user_id: string; name: string; email: string; role: string };

const API = process.env.MULTICA_API_URL || "https://api.multica.ai";
export const APP_URL = process.env.MULTICA_APP_URL || "https://multica.ai";

/** Token: MULTICA_TOKEN, atau (hanya saat lokal) login Multica Desktop di laptop ini. */
function token(): string {
  if (process.env.MULTICA_TOKEN) return process.env.MULTICA_TOKEN;
  // Saat berjalan di laptop sendiri (bukan hosting), pakai login Multica Desktop pemilik laptop.
  if (!process.env.NETLIFY && !process.env.VERCEL) {
    const dir = join(homedir(), ".multica", "profiles");
    if (existsSync(dir)) {
      for (const p of readdirSync(dir)) {
        const f = join(dir, p, "config.json");
        if (!existsSync(f)) continue;
        try {
          const cfg = JSON.parse(readFileSync(f, "utf8"));
          if (cfg.token && String(cfg.server_url || "").startsWith(API)) return cfg.token;
        } catch { /* lewati profil rusak */ }
      }
    }
  }
  throw new Error("Not signed in to Multica on this laptop. Open Multica Desktop, sign in, then reload the page.");
}

async function call<T>(method: string, path: string, workspaceId?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token()}`, Accept: "application/json" };
  if (workspaceId) headers["X-Workspace-ID"] = workspaceId;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers, cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Multica ${method} ${path} → ${res.status} ${msg.slice(0, 200)}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
const get = <T,>(path: string, workspaceId?: string) => call<T>("GET", path, workspaceId);

export type Workspace = { id: string; name: string; slug: string };
/** Semua workspace yang bisa dibuka akun ini (= gedung kantor). */
let wsList: { at: number; data: Workspace[] } | null = null;
export async function workspaces(): Promise<Workspace[]> {
  if (wsList && Date.now() - wsList.at < 60_000) return wsList.data;
  const wss = list<Workspace>(await get("/api/workspaces"), "workspaces");
  if (!wss.length) throw new Error("This account has no Multica workspace yet.");
  wsList = { at: Date.now(), data: wss };
  return wss;
}
/** Workspace yang dipilih (id atau slug); kalau kosong, yang pertama. */
export async function workspace(pick?: string | null): Promise<Workspace> {
  const wss = await workspaces();
  return wss.find(w => w.id === pick || w.slug === pick) ?? wss.find(w => w.id === process.env.MULTICA_WORKSPACE_ID) ?? wss[0];
}

export type Attachment = { id: string; filename: string; url: string; download_url: string; content_type?: string; created_at?: string; uploader_type?: string; uploader_id?: string };
export type Comment = {
  id: string; author_type: "agent" | "member" | string; author_id: string; content: string; type: string;
  parent_id: string | null; created_at: string; attachments?: Attachment[]; deleted_at?: string;
};
export type IssueFull = Issue & { description: string | null; metadata?: Record<string, unknown> };

export async function issueDetail(id: string, wsPick?: string | null) {
  const ws = await workspace(wsPick);
  const [issue, comments, attachments, me] = await Promise.all([
    get<IssueFull>(`/api/issues/${id}`, ws.id),
    get<unknown>(`/api/issues/${id}/comments`, ws.id).then(d => list<Comment>(d, "comments")),
    get<unknown>(`/api/issues/${id}/attachments`, ws.id).then(d => list<Attachment>(d, "attachments")).catch(() => [] as Attachment[]),
    get<{ id: string; name: string }>("/api/me"),
  ]);
  return { issue, comments, attachments, me };
}

export async function addComment(wsPick: string | null | undefined, issueId: string, content: string, suppressAgentIds: string[] = [], attachmentIds: string[] = []) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/issues/${issueId}/comments`, ws.id, { content, type: "comment", suppress_agent_ids: suppressAgentIds, attachment_ids: attachmentIds });
}

/** Run yang sedang berjalan / antre untuk satu task. */
export async function activeRuns(wsPick: string | null | undefined, issueId: string) {
  const ws = await workspace(wsPick);
  return get<unknown>(`/api/issues/${issueId}/active-task`, ws.id).then(d => list<Run>(d, "tasks")).catch(() => [] as Run[]);
}

/** Unggah satu file ke Multica (opsional langsung ke sebuah task). */
export async function uploadFile(wsPick: string | null | undefined, file: File, issueId?: string) {
  const ws = await workspace(wsPick);
  const form = new FormData();
  form.append("file", file, file.name);
  if (issueId) form.append("issue_id", issueId);
  const res = await fetch(API + "/api/upload-file", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "X-Workspace-ID": ws.id }, body: form });
  if (!res.ok) throw new Error(`Uploading ${file.name} failed (${res.status}) ${(await res.text().catch(() => "")).slice(0, 150)}`);
  return res.json() as Promise<{ id: string; filename: string; url: string }>;
}

/** Siapa yang sedang membuka kantor (detak tiap 2 menit dari app yang terbuka).
 *  Disimpan di metadata sebuah task tersembunyi, satu key per orang: semua anggota boleh menulisnya
 *  (pengaturan workspace hanya boleh diubah owner/admin, jadi detak anggota biasa dulu ditolak diam-diam). */
export const PRESENCE_TAG = "kantor_presence";
export const PRESENCE_TITLE = "🟢 Virtual Office · who's in";
const seenKey = (userId: string) => `kantor_seen_${userId.replace(/[^0-9a-zA-Z]/g, "_")}`;
const presenceIssueId = new Map<string, string>();
const isPresence = (i: Issue) => !!(i.metadata ?? {})[PRESENCE_TAG] || i.title === PRESENCE_TITLE;
/** Task tersembunyi milik Virtual Office (chat antar orang, papan kehadiran): tidak pernah tampil sebagai pekerjaan. */
export const isHiddenIssue = (i: Issue) => isPresence(i) || !!(i.metadata ?? {}).kantor_dm || i.title.startsWith("💬 Chat");

async function presenceIssue(wsId: string) {
  const hit = presenceIssueId.get(wsId);
  if (hit) return hit;
  const found = (await allIssues(wsId)).filter(isPresence).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0];
  let id = found?.id;
  if (!id) {
    id = (await createIssue(wsId, {
      title: PRESENCE_TITLE, status: "backlog", priority: "none",
      description: "Used by Virtual Office to show who has the office open. Please leave it unassigned and in backlog.",
    })).id;
    await setIssueMeta(wsId, id, PRESENCE_TAG, "1");
  }
  presenceIssueId.set(wsId, id);
  return id;
}

export async function heartbeat(wsPick: string | null | undefined, name: string) {
  const ws = await workspace(wsPick);
  const [mine, id] = await Promise.all([me(), presenceIssue(ws.id)]);
  try { await setIssueMeta(ws.id, id, seenKey(mine.id), `${new Date().toISOString()}|${name}`); }
  catch (e) { presenceIssueId.delete(ws.id); throw e; } // task-nya mungkin dihapus: cari/buat ulang di detak berikutnya
}

/** Kapan tiap orang terakhir membuka kantor: { nama: waktu ISO }. */
export async function presence(wsPick?: string | null, issues?: Issue[]): Promise<Record<string, string>> {
  const ws = await workspace(wsPick);
  const out: Record<string, string> = {};
  const put = (name: string, at: string) => { if (name && at && (!out[name] || at > out[name])) out[name] = at; };
  // Data lama (dari pengaturan workspace) tetap dibaca supaya tidak hilang.
  const full = await get<{ settings?: Record<string, unknown> | null }>(`/api/workspaces/${ws.id}`, ws.id).catch(() => ({ settings: null }));
  for (const [n, at] of Object.entries(((full.settings ?? {}).kantor_presence as Record<string, string>) ?? {})) put(n, at);
  for (const i of (issues ?? await allIssues(ws.id)).filter(isPresence)) {
    for (const [k, v] of Object.entries(i.metadata ?? {})) {
      if (!k.startsWith("kantor_seen_") || typeof v !== "string") continue;
      const bar = v.indexOf("|");
      if (bar > 0) put(v.slice(bar + 1), v.slice(0, bar));
    }
  }
  return out;
}
export async function updateIssue(wsPick: string | null | undefined, issueId: string, patch: Record<string, unknown>) {
  const ws = await workspace(wsPick);
  return call("PUT", `/api/issues/${issueId}`, ws.id, patch);
}
export async function setIssueMeta(wsPick: string | null | undefined, issueId: string, key: string, value: unknown) {
  const ws = await workspace(wsPick);
  return call("PUT", `/api/issues/${issueId}/metadata/${encodeURIComponent(key)}`, ws.id, { value });
}
export async function createIssue(wsPick: string | null | undefined, body: Record<string, unknown>) {
  const ws = await workspace(wsPick);
  return call<{ id: string }>("POST", "/api/issues", ws.id, body);
}
export async function me() { return get<{ id: string; name: string }>("/api/me"); }

// ---- Kabar masuk (inbox Multica milik pemilik token) ----
export type InboxItem = {
  id: string; type: string; severity?: string; issue_id: string | null; title: string; body: string | null;
  read: boolean; archived?: boolean; created_at: string; actor_type?: string | null; actor_id?: string | null;
};
export async function inbox(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  return get<unknown>("/api/inbox", ws.id).then(d => list<InboxItem>(d, "items"));
}
export async function inboxUnread(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  return get<{ count: number }>("/api/inbox/unread-count", ws.id).then(d => d?.count ?? 0).catch(() => 0);
}
export async function markInboxRead(wsPick: string | null | undefined, id: string) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/inbox/${id}/read`, ws.id, {});
}
/** Mark every notification on one issue as read. Older Multica servers (e.g. self-hosted ones) don't have the
 *  per-issue endpoint yet, so fall back to marking each unread item on that issue one by one. */
let noIssueRead = false;
export async function markIssueInboxRead(wsId: string, issueId: string) {
  if (!noIssueRead) {
    try { await call("POST", `/api/inbox/issues/${issueId}/read`, wsId, {}); return; }
    catch (e) { if (!/→ (404|405)\b/.test(String((e as Error).message))) throw e; noIssueRead = true; }
  }
  const d = await call<unknown>("GET", "/api/inbox", wsId);
  const items = (Array.isArray(d) ? d : (d as { items?: unknown[] })?.items ?? []) as { id: string; issue_id: string | null; read: boolean }[];
  await Promise.all(items.filter(i => i.issue_id === issueId && !i.read).map(i => call("POST", `/api/inbox/${i.id}/read`, wsId, {})));
}
export async function markAllInboxRead(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  return call("POST", "/api/inbox/mark-all-read", ws.id, {});
}

// ---- Anggota & rekrutmen ----
export type Invitation = { id: string; invitee_email: string; role: string; status?: string; created_at: string; expires_at?: string };
export async function invitations(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  return get<unknown>(`/api/workspaces/${ws.id}/invitations`, ws.id).then(d => list<Invitation>(d, "invitations")).catch(() => [] as Invitation[]);
}
/** Undang manusia lewat email. Multica mengirim email undangan; dia jadi anggota setelah menerima. */
export async function inviteMember(wsPick: string | null | undefined, email: string, role: "member" | "admin" = "member") {
  const ws = await workspace(wsPick);
  return call("POST", `/api/workspaces/${ws.id}/members`, ws.id, { email, role });
}
export async function createAgent(wsPick: string | null | undefined, body: Record<string, unknown>) {
  const ws = await workspace(wsPick);
  return call<Agent>("POST", "/api/agents", ws.id, body);
}
/** Create a workspace (a new office). The slug is made from the name; a short suffix is added if it is taken. */
export async function createWorkspace(name: string, description?: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "office";
  let last: unknown = null;
  for (let i = 0; i < 4; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const ws = await call<Workspace>("POST", "/api/workspaces", undefined, { name: name.trim(), slug, description: description?.trim() || null });
      wsList = null; // refresh the workspace list on the next request
      return ws;
    } catch (e) {
      last = e;
      if (!/409|already|exists|taken|duplicate|reserved/i.test(String(e))) throw e;
    }
  }
  throw last;
}
export async function createProject(wsPick: string | null | undefined, body: Record<string, unknown>) {
  const ws = await workspace(wsPick);
  return call<Project>("POST", "/api/projects", ws.id, body);
}

const list = <T,>(d: unknown, key: string): T[] =>
  Array.isArray(d) ? (d as T[]) : ((d as Record<string, unknown>)?.[key] as T[]) ?? [];

/** Data ringan (tanpa issue dan riwayat kerja), cukup untuk membuka detail task. */
export async function loadDirectory(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  const id = ws.id;
  const [agents, projects, runtimes, members] = await Promise.all([
    get<unknown>("/api/agents", id).then(d => list<Agent>(d, "agents").filter(a => !a.archived_at)),
    get<unknown>("/api/projects", id).then(d => list<Project>(d, "projects")),
    get<unknown>("/api/runtimes", id).then(d => list<Runtime>(d, "runtimes")),
    get<unknown>(`/api/workspaces/${id}/members`, id).then(d => list<Member>(d, "members")).catch(() => [] as Member[]),
  ]);
  return { workspace: ws, agents, projects, runtimes, members };
}

export async function allIssues(id: string) {
  const issues: Issue[] = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const page = await get<{ issues: Issue[]; has_more: boolean }>(`/api/issues?limit=200&offset=${offset}`, id);
    issues.push(...page.issues);
    if (!page.has_more) break;
  }
  return issues;
}

export async function loadWorkspace(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  const id = ws.id;
  // Semua permintaan berjalan bersamaan supaya kantor cepat terbuka.
  const [dir, everything] = await Promise.all([loadDirectory(id), allIssues(id)]);
  // Private chats and the presence board are stored as hidden issues; they never show up as work.
  const issues = everything.filter(i => !isHiddenIssue(i));
  const runs = (await Promise.all(
    dir.agents.map(a => get<unknown>(`/api/agents/${a.id}/tasks?limit=20`, id).then(d => list<Run>(d, "tasks")).catch(() => [] as Run[]))
  )).flat();
  const [settings, seen] = await Promise.all([
    get<WorkspaceFull>(`/api/workspaces/${id}`, id).then(f => (f.settings ?? {}) as Record<string, unknown>).catch(() => ({} as Record<string, unknown>)),
    presence(id, everything).catch(() => ({} as Record<string, string>)),
  ]);
  const kantor = (settings.kantor ?? {}) as KantorSettings;
  const moved = (((settings.kantor_watch ?? {}) as { moved?: Moved }).moved ?? {}) as Moved;
  return { ...dir, workspace: ws, issues, runs, kantor, seen, moved };
}
export type Snapshot = Awaited<ReturnType<typeof loadWorkspace>>;

// ---- Buka/Tutup kantor ----
export type KantorSettings = {
  open?: boolean; changedAt?: string; changedBy?: string;
  pausedAutopilots?: string[];
};
type WorkspaceFull = Workspace & { settings?: Record<string, unknown> | null };

export async function kantorSettings(wsPick?: string | null): Promise<KantorSettings> {
  const ws = await workspace(wsPick);
  const full = await get<WorkspaceFull>(`/api/workspaces/${ws.id}`, ws.id);
  return ((full.settings ?? {}) as Record<string, unknown>).kantor as KantorSettings ?? {};
}
/** Simpan status kantor di pengaturan workspace (digabung, pengaturan lain tidak disentuh). */
export async function saveKantorSettings(wsPick: string | null | undefined, k: KantorSettings) {
  const ws = await workspace(wsPick);
  const full = await get<WorkspaceFull>(`/api/workspaces/${ws.id}`, ws.id);
  const settings = { ...(full.settings ?? {}), kantor: k };
  return call("PATCH", `/api/workspaces/${ws.id}`, ws.id, { settings });
}

export type Autopilot = { id: string; title: string; status: string };
export async function autopilots(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  return get<unknown>("/api/autopilots", ws.id).then(d => list<Autopilot>(d, "autopilots"));
}
export async function setAutopilotStatus(wsPick: string | null | undefined, id: string, status: "active" | "paused") {
  const ws = await workspace(wsPick);
  return call("PATCH", `/api/autopilots/${id}`, ws.id, { status });
}
/** Ubah sebagian pengaturan worker (mis. pindah mesin AI). Field lain tidak disentuh. */
export async function updateAgent(workspaceId: string, agentId: string, patch: Record<string, unknown>) {
  return call("PUT", `/api/agents/${agentId}`, workspaceId, patch);
}
export async function rerunIssue(wsPick: string | null | undefined, issueId: string) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/issues/${issueId}/rerun`, ws.id, {});
}
export async function cancelRun(wsPick: string | null | undefined, issueId: string, taskId: string) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/issues/${issueId}/tasks/${taskId}/cancel`, ws.id, {});
}
export async function deleteIssueMeta(wsPick: string | null | undefined, issueId: string, key: string) {
  const ws = await workspace(wsPick);
  return call("DELETE", `/api/issues/${issueId}/metadata/${encodeURIComponent(key)}`, ws.id);
}

// ---- Ngobrol dengan worker (chat Multica) ----
export type ChatSession = { id: string; agent_id: string; project_id: string | null; title: string; status: string; updated_at: string; created_at: string; last_message?: { content?: string } | null; unread_count?: number };
export type ChatMessage = { id: string; role: string; content: string; created_at: string; failure_reason: string | null; message_kind?: string; attachments?: Attachment[]; task_id?: string | null };

export async function chatSessions(wsPick: string | null | undefined) {
  const ws = await workspace(wsPick);
  return get<unknown>("/api/chat/sessions", ws.id).then(d => list<ChatSession>(d, "sessions"));
}
export async function createChat(wsPick: string | null | undefined, agentId: string, title: string, projectId?: string | null) {
  const ws = await workspace(wsPick);
  return call<ChatSession>("POST", "/api/chat/sessions", ws.id, { agent_id: agentId, title, project_id: projectId ?? null });
}
export async function chatMessages(wsPick: string | null | undefined, sessionId: string) {
  const ws = await workspace(wsPick);
  return get<unknown>(`/api/chat/sessions/${sessionId}/messages`, ws.id).then(d => list<ChatMessage>(d, "messages"));
}
export async function chatPending(wsPick: string | null | undefined, sessionId: string) {
  const ws = await workspace(wsPick);
  return get<{ task_id?: string; status?: string }>(`/api/chat/sessions/${sessionId}/pending-task`, ws.id).catch(() => ({} as { task_id?: string; status?: string }));
}
export async function sendChat(wsPick: string | null | undefined, sessionId: string, content: string, attachmentIds: string[] = []) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/chat/sessions/${sessionId}/messages`, ws.id, { content, attachment_ids: attachmentIds });
}
export async function markChatRead(wsPick: string | null | undefined, sessionId: string) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/chat/sessions/${sessionId}/read`, ws.id, {}).catch(() => null);
}

// ---- File: isi teks (untuk pratinjau) dan file asli ----
export async function fileText(wsPick: string | null | undefined, id: string) {
  const ws = await workspace(wsPick);
  const res = await fetch(`${API}/api/attachments/${id}/content`, { headers: { Authorization: `Bearer ${token()}`, "X-Workspace-ID": ws.id }, cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
  return res.text();
}
export async function fileRaw(wsPick: string | null | undefined, id: string) {
  const ws = await workspace(wsPick);
  return fetch(`${API}/api/attachments/${id}/download`, { headers: { Authorization: `Bearer ${token()}`, "X-Workspace-ID": ws.id }, cache: "no-store", redirect: "follow" });
}
export const call_ = call;
