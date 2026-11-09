// Klien baca-saja untuk Multica Cloud API. Hanya dipakai di server (token tidak pernah dikirim ke browser).
import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Agent = {
  id: string; name: string; description: string; avatar_url: string | null;
  runtime_id: string; status: string; model: string; archived_at: string | null;
};
export type Project = { id: string; title: string; icon: string | null; status: string; due_date: string | null; issue_count: number; done_count: number };
export type Runtime = { id: string; name: string; provider: string; status: string; last_seen_at: string; owner_id: string };
export type Issue = {
  id: string; identifier: string; title: string; status: string; status_category?: string; status_name?: string;
  priority: string; due_date: string | null; start_date: string | null; project_id: string | null;
  assignee_type: "agent" | "member" | null; assignee_id: string | null; updated_at: string; last_activity_at: string;
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
  throw new Error("Belum login Multica di laptop ini. Buka Multica Desktop dan login dulu, lalu muat ulang halaman.");
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
  if (!wss.length) throw new Error("Akun ini belum punya workspace Multica.");
  wsList = { at: Date.now(), data: wss };
  return wss;
}
/** Workspace yang dipilih (id atau slug); kalau kosong, yang pertama. */
export async function workspace(pick?: string | null): Promise<Workspace> {
  const wss = await workspaces();
  return wss.find(w => w.id === pick || w.slug === pick) ?? wss.find(w => w.id === process.env.MULTICA_WORKSPACE_ID) ?? wss[0];
}

export type Attachment = { id: string; filename: string; url: string; download_url: string; content_type?: string };
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

export async function addComment(wsPick: string | null | undefined, issueId: string, content: string, suppressAgentIds: string[] = []) {
  const ws = await workspace(wsPick);
  return call("POST", `/api/issues/${issueId}/comments`, ws.id, { content, type: "comment", suppress_agent_ids: suppressAgentIds });
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

async function allIssues(id: string) {
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
  const [dir, issues] = await Promise.all([loadDirectory(id), allIssues(id)]);
  const runs = (await Promise.all(
    dir.agents.map(a => get<unknown>(`/api/agents/${a.id}/tasks?limit=20`, id).then(d => list<Run>(d, "tasks")).catch(() => [] as Run[]))
  )).flat();
  return { ...dir, workspace: ws, issues, runs };
}
export type Snapshot = Awaited<ReturnType<typeof loadWorkspace>>;
