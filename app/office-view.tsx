"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Office, Desk, TaskView, RunView } from "@/lib/office";
import TaskPanel from "./task-panel";
import type { Building } from "./page";
import OfficeSwitch from "./office-switch";

const REFRESH_MS = 30_000;

function Avatar({ d, home }: { d: Desk; home?: boolean }) {
  return (
    <span className="avatar">
      {home ? "🏠" : d.avatar ? <img src={d.avatar} alt="" /> : d.emoji ?? d.name.slice(0, 1)}
      <span className="status-dot" />
    </span>
  );
}

function DueChip({ t }: { t: TaskView }) {
  if (!t.dueText) return null;
  return <span className={`due ${t.dueFlag ?? "ok"}`}>{t.dueFlag === "late" ? "🔴 " : t.dueFlag === "risk" ? "🟠 " : ""}{t.dueText}</span>;
}

const pillOf = (s: string) => (s === "in_review" ? "review" : s === "in_progress" ? "doing" : "queued");

function TaskRow({ t, onOpen, showWho }: { t: TaskView; onOpen: (id: string) => void; showWho?: boolean }) {
  return (
    <button className="tasklink" onClick={() => onOpen(t.id)}>
      <span className="t">{t.title}{showWho && t.assignee ? <small>{t.assignee}</small> : null}</span>
      <span className="meta"><span className={`pill p-${pillOf(t.status)}`}>{t.statusLabel}</span><DueChip t={t} /></span>
    </button>
  );
}

function DeskButton({ d, onOpen }: { d: Desk; onOpen: () => void }) {
  const dim = d.state === "off" || d.state === "home";
  return (
    <button className={`desk st-${d.state} ${dim ? d.state : ""}`} onClick={onOpen} aria-label={`${d.name}. ${d.bubble}`}>
      <span className={`bubble ${d.state}`}>{d.bubble}</span>
      <Avatar d={d} home={d.state === "home"} />
      <span className="surface">
        <span className="pc">💻</span>
        {(d.lateCount > 0 || d.riskCount > 0) && (
          <span className="flags">
            {d.lateCount > 0 && <span className="flag late" title="Telat">🔴 {d.lateCount}</span>}
            {d.riskCount > 0 && <span className="flag risk" title="Berisiko telat">🟠 {d.riskCount}</span>}
          </span>
        )}
        {d.reviewCount > 0 && <span className="stack">📄 {d.reviewCount}</span>}
      </span>
      <span className="who">{d.name}</span>
      <span className="model">{d.runtime}</span>
    </button>
  );
}

function AttnItem({ t, kind, onOpen, many }: { t: TaskView; kind: "late" | "risk" | "human" | "review"; onOpen: (id: string) => void; many?: boolean }) {
  const label = { late: "Telat", risk: "Berisiko", human: "Kerjakan", review: "Review" }[kind];
  return (
    <li>
      <button className="item" onClick={() => onOpen(t.id)}>
        <span><b>{t.title}</b>
          <small><span className={`kind k-${kind}`}>{label}</span>{many ? `${t.wsName} · ` : ""}{t.assignee ?? "Belum ada yang ditugaskan"}{t.dueText ? ` · ${t.dueText}` : ""}</small>
        </span>
      </button>
    </li>
  );
}

function Section({ title, count, children, empty }: { title: string; count: number; children: React.ReactNode; empty: string }) {
  const [all, setAll] = useState(false);
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      <h3><span>{title}</span><span>{count}</span></h3>
      <ul>{count ? (all ? items : items.slice(0, 5)) : <li className="empty">{empty}</li>}</ul>
      {count > 5 && <button className="more" onClick={() => setAll(!all)}>{all ? "Tampilkan lebih sedikit" : `Lihat semua (${count})`}</button>}
    </>
  );
}

function NewTaskForm({ ws, desk, projects, onDone }: { ws: string; desk: Desk; projects: Office["projects"]; onDone: (id: string | null) => void }) {
  const [title, setTitle] = useState(""); const [detail, setDetail] = useState("");
  const [due, setDue] = useState(""); const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(now: boolean) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, agentId: desk.agentId, title, detail, due, projectId, now }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      onDone(j.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <form className="newtask" onSubmit={e => { e.preventDefault(); submit(true); }}>
      <label htmlFor="nt-title" className="sect">Task baru untuk {desk.name}</label>
      <input id="nt-title" className="input" placeholder="Contoh: Tulis 3 ide caption untuk teaser Instagram" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea id="nt-detail" placeholder="Detail atau arahan (opsional)" value={detail} onChange={e => setDetail(e.target.value)} />
      <div className="chiprow">
        <label className="desc" htmlFor="nt-due">Tenggat</label><input id="nt-due" className="input" type="date" value={due} onChange={e => setDue(e.target.value)} style={{ width: "auto" }} />
        <label className="desc" htmlFor="nt-proj">Ruangan</label>
        <select id="nt-proj" className="input" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: "auto" }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {err && <div className="note bad">{err}</div>}
      <div className="row">
        <button type="button" className="btn" onClick={() => onDone(null)}>Batal</button>
        <button type="button" className="btn" disabled={!title.trim() || busy} onClick={() => submit(false)}>Simpan untuk nanti</button>
        <button className="btn primary" disabled={!title.trim() || busy}>{busy ? "Menyimpan…" : "Kerjakan sekarang"}</button>
      </div>
    </form>
  );
}

export default function OfficeView({ office, buildings, attention, people }: { office: Office; buildings: Building[]; attention: Office["attention"]; people: string[] }) {
  const router = useRouter();
  const [openDesk, setOpenDesk] = useState<Desk | null>(null);
  const [openTask, setOpenTaskRaw] = useState<{ id: string; ws: string } | null>(null);
  const setOpenTask = (id: string | null, ws: string = office.workspaceId) => setOpenTaskRaw(id ? { id, ws } : null);
  const many = buildings.length > 1;
  const [adding, setAdding] = useState(false);
  const [person, setPerson] = useState<string>("Semua");
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (openTask) setOpenTask(null); else setOpenDesk(null); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [openTask]);

  const a = attention;
  const human = useMemo(() => (person === "Semua" ? a.human : a.human.filter(t => t.assignee === person)), [a.human, person]);
  const openT = (t: { id: string; ws: string }) => setOpenTask(t.id, t.ws);
  const total = a.overdue.length + a.human.length + a.review.length + a.failed.length;
  const runs: RunView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.runs ?? [] : [];
  const allTasks: TaskView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.tasks ?? [] : [];
  const closeAll = () => { setOpenTask(null); setOpenDesk(null); setAdding(false); };

  return (
    <>
      <header className="top">
        <div className="wrap hbar">
          <div className="brand"><h1>Kantor Virtual</h1>
            {many ? (
              <nav className="buildings" aria-label="Pilih gedung">{buildings.map(b => (
                <a key={b.id} href={`/?ws=${b.slug}`} className="bld" aria-current={b.id === office.workspaceId ? "page" : undefined}>
                  {b.switchOpen ? "🏢" : "🔒"} {b.name}{b.attention ? <span className="count">{b.attention}</span> : null}
                </a>))}</nav>
            ) : <span className="tag">{office.workspace}</span>}
          </div>
          <div className="chiprow">
            <OfficeSwitch key={office.workspaceId + String(office.switchOpen)} ws={office.workspaceId} name={office.workspace} switchOpen={office.switchOpen} laptopOn={office.open} parked={office.parked}
              onDone={msg => { setToast(msg); router.refresh(); }} />
            {office.runtimes.map(r => (
              <span key={r.name} className={`rt ${r.online ? "on" : ""}`} title={`Terakhir terlihat ${r.lastSeen}`}><i />{r.name}</span>
            ))}
            <span className="clock">Diperbarui {office.updatedAt}</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="office" aria-label="Denah kantor">
          <div className="legend">
            <span><i className="dot" style={{ background: "var(--ok)" }} />Bekerja</span>
            <span><i className="dot" style={{ background: "var(--attn)" }} />Menunggu review</span>
            <span><i className="dot" style={{ background: "var(--todo)" }} />Siap mengerjakan</span>
            <span><i className="dot" style={{ background: "#C2412D" }} />Gagal</span>
            <span>🏠 Pulang</span><span>🔒 Kantor tutup</span><span>🌙 Laptop mati</span><span>🔴 Telat · 🟠 Berisiko</span>
          </div>

          {office.rooms.map(r => (
            <section key={r.id} className="room" aria-label={r.name}>
              <div className="roomhead">
                <div><h2>{r.icon ? `${r.icon} ` : ""}{r.name}</h2>{r.progress && <div className="sub">{r.progress}</div>}</div>
              </div>
              <div className="desks">{r.desks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} />)}</div>
            </section>
          ))}

          {office.idleDesks.length > 0 && (
            <section className="room" aria-label="Ruang staf">
              <div className="roomhead"><div><h2>Ruang Staf</h2><div className="sub">Worker tanpa task di project mana pun</div></div></div>
              <div className="desks">{office.idleDesks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} />)}</div>
            </section>
          )}
        </section>

        <aside className="attn" aria-label="Perlu perhatian">
          <div className="ah"><h2>Perlu Perhatian <span className="count">{total}</span></h2><p>{office.today}</p></div>
          <div className="scroll">
            <Section title="⚠️ Telat & berisiko" count={a.overdue.length} empty="Tidak ada yang telat 👍">
              {a.overdue.map(t => <AttnItem many={many} key={t.id} t={t} kind={t.dueFlag === "late" ? "late" : "risk"} onOpen={() => openT(t)} />)}
            </Section>
            <h3><span>📋 Tugas untuk manusia</span><span>{human.length}</span></h3>
            {people.length > 1 && (
              <div className="tabs">{["Semua", ...people].map(p => (
                <button key={p} className="tab" aria-pressed={person === p} onClick={() => setPerson(p)}>{p}</button>
              ))}</div>
            )}
            <ul>{human.length ? human.map(t => <AttnItem many={many} key={t.id} t={t} kind="human" onOpen={() => openT(t)} />) : <li className="empty">Tidak ada tugas untuk manusia.</li>}</ul>
            <Section title="📄 Perlu review" count={a.review.length} empty="Semua sudah direview ☕">
              {a.review.map(t => <AttnItem many={many} key={t.id} t={t} kind="review" onOpen={() => openT(t)} />)}
            </Section>
            <Section title="❗ Gagal (7 hari terakhir)" count={a.failed.length} empty="Tidak ada yang gagal.">
              {a.failed.map(f => (
                <li key={f.id}><button className="item" onClick={() => f.issueId && setOpenTask(f.issueId, f.ws)}>
                  <span><b>{f.issueTitle ?? "Tugas tanpa judul"}</b><small><span className="kind k-fail">Gagal</span>{f.agent} · {f.error} · {f.when}</small></span>
                </button></li>
              ))}
            </Section>
          </div>
        </aside>
      </main>

      {(openDesk || openTask) && <div className="scrim" onClick={closeAll} />}

      {openDesk && !openTask && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label={openDesk.name}>
          <div className="dhead">
            <span className={`st-${openDesk.state}`}><Avatar d={openDesk} /></span>
            <div className="meta"><h2>{openDesk.name}</h2><div className="role">{openDesk.runtime}</div></div>
            <button className="x" onClick={closeAll} aria-label="Tutup">✕</button>
          </div>
          <div className="dbody">
            <div className="note"><span>{openDesk.bubble}</span></div>
            {adding ? (
              <NewTaskForm ws={office.workspaceId} desk={openDesk} projects={office.projects} onDone={id => { setAdding(false); router.refresh(); if (id) setOpenTask(id); }} />
            ) : (
              <button className="btn primary" onClick={() => setAdding(true)}>+ Beri task baru</button>
            )}
            <div>
              <div className="sect">Task terbuka ({allTasks.length})</div>
              <div className="tasks">{allTasks.length ? allTasks.map(t => <TaskRow key={t.id} t={t} onOpen={setOpenTask} />) : <p className="desc">Tidak ada task terbuka.</p>}</div>
            </div>
            <div>
              <div className="sect">Riwayat kerja terakhir</div>
              <div className="tasks">{runs.length ? runs.map(r => (
                <button key={r.id} className="tasklink" onClick={() => r.issueId && setOpenTask(r.issueId, r.ws)}>
                  <span className="t">{r.issueTitle ?? "Tugas"}<small>{r.when}{r.error ? ` · ${r.error}` : ""}</small></span>
                  <span className={`pill ${r.status === "failed" ? "p-review" : r.status === "completed" ? "p-done" : "p-doing"}`}>{r.status === "failed" ? "Gagal" : r.status === "completed" ? "Selesai" : "Berjalan"}</span>
                </button>)) : <p className="desc">Belum pernah bekerja.</p>}</div>
            </div>
            {openDesk.description && <details className="extra"><summary>Tentang {openDesk.name}</summary><p className="desc">{openDesk.description}</p></details>}
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      {openTask && <TaskPanel id={openTask.id} ws={openTask.ws} onClose={() => setOpenTask(null)} onChanged={() => router.refresh()} />}
    </>
  );
}
