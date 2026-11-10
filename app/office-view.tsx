"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Office, Desk, TaskView, RunView } from "@/lib/office";
import TaskPanel from "./task-panel";
import type { Building } from "./page";
import OfficeSwitch from "./office-switch";
import FilePicker, { uploadAll } from "./file-picker";
import ChatPanel from "./chat-panel";
import PixelDesk, { type PixelState } from "./pixel-desk";
import { HandoverLayer, useHandoverDetector, type Handover } from "./handover";

const REFRESH_MS = 30_000;

function Avatar({ d, home }: { d: Desk; home?: boolean }) {
  return (
    <span className="avatar">
      {home ? "🏠" : d.avatar ? <img src={d.avatar} alt="" /> : d.emoji ?? d.name.slice(0, 1)}
      <span className="status-dot" />
    </span>
  );
}

function Presence({ name, at }: { name: string; at?: string }) {
  const mins = at ? (Date.now() - Date.parse(at)) / 60000 : Infinity;
  const on = mins < 5;
  const label = on ? "di kantor" : !at ? "belum pernah buka" : mins < 60 ? `${Math.round(mins)} mnt lalu` : mins < 1440 ? `${Math.round(mins / 60)} jam lalu` : `${Math.round(mins / 1440)} hari lalu`;
  return (
    <span className={`person ${on ? "on" : ""}`} title={`${name}: ${on ? "sedang membuka kantor" : "terakhir membuka kantor " + label}`}>
      <span className="initial">{name.slice(0, 1).toUpperCase()}</span>{name} <small>{label}</small>
    </span>
  );
}

function DueChip({ t }: { t: TaskView }) {
  if (!t.dueText) return null;
  return <span className={`due ${t.dueFlag ?? "ok"}`}>{t.dueFlag === "late" ? "🔴 " : t.dueFlag === "risk" ? "🟠 " : t.dueFlag === "done" ? "✓ " : ""}{t.dueText}</span>;
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

const pixOf = (st: Desk["state"]): PixelState =>
  st === "working" ? "working" : st === "failed" ? "failed" : st === "break" ? "break" : st === "review" ? "review" : st === "ready" ? "ready" : "away";

function DeskButton({ d, onOpen, onChat, walking }: { d: Desk; onOpen: () => void; onChat: () => void; walking?: boolean }) {
  const dim = d.state === "off" || d.state === "home" || d.state === "closed";
  return (
    <div className="deskwrap" data-desk={d.agentId}>
      <button className={`desk pix st-${d.state} ${dim ? "dim" : ""}`} onClick={onOpen} aria-label={`${d.name}. ${d.bubble}`}>
        <span className={`bubble ${d.state}`}>{d.bubble}</span>
        <span className="pixbox">
          <PixelDesk name={d.name} state={walking ? "away" : pixOf(d.state)} />
          {(d.lateCount > 0 || d.riskCount > 0) && (
            <span className="flags">
              {d.lateCount > 0 && <span className="flag late" title="Telat">🔴 {d.lateCount}</span>}
              {d.riskCount > 0 && <span className="flag risk" title="Berisiko telat">🟠 {d.riskCount}</span>}
            </span>
          )}
          {d.reviewCount > 0 && <span className="stack" title="Menunggu review">📄 {d.reviewCount}</span>}
        </span>
        <span className="who">{d.name}</span>
        <span className="model">{d.runtime}</span>
      </button>
      <button className="chatbtn" onClick={onChat} aria-label={`Ngobrol dengan ${d.name}`} title={`Ngobrol dengan ${d.name}`}>💬</button>
    </div>
  );
}

function HumanDesk({ name, at, review, tasks, onOpen }: { name: string; at?: string; review: number; tasks: number; onOpen: () => void }) {
  const mins = at ? (Date.now() - Date.parse(at)) / 60000 : Infinity;
  const here = mins < 5;
  const label = here ? "di kantor" : !at ? "belum datang" : mins < 60 ? `terakhir ${Math.round(mins)} mnt lalu` : mins < 1440 ? `terakhir ${Math.round(mins / 60)} jam lalu` : `terakhir ${Math.round(mins / 1440)} hari lalu`;
  return (
    <div className="deskwrap" data-desk={"person:" + name}>
      <button className={`desk pix human ${here ? "" : "dim"}`} onClick={onOpen} aria-label={`Meja ${name}. ${label}. ${review} perlu review, ${tasks} tugas.`}>
        <span className={`bubble ${here ? "here" : "closed"}`}>{label}</span>
        <span className="pixbox">
          <PixelDesk name={name} human state={here ? "present" : "away"} papers={review + tasks} />
          {(review > 0 || tasks > 0) && (
            <span className="flags">
              {review > 0 && <span className="flag rev" title="Perlu review">📄 {review}</span>}
              {tasks > 0 && <span className="flag todo" title="Tugas untukmu">📋 {tasks}</span>}
            </span>
          )}
        </span>
        <span className="who">Meja {name}</span>
        <span className="model">Tim</span>
      </button>
    </div>
  );
}

function AttnItem({ t, kind, onOpen, many }: { t: TaskView; kind: "late" | "risk" | "human" | "review"; onOpen: (id: string) => void; many?: boolean }) {
  const label = { late: "Telat", risk: "Berisiko", human: "Kerjakan", review: "Review" }[kind];
  return (
    <li>
      <button className="item" onClick={() => onOpen(t.id)}>
        <span><b>{t.title}</b>
          <small><span className={`kind k-${kind}`}>{label}</span>{t.assignee ?? "Belum ada yang ditugaskan"}{t.dueText ? ` · ${t.dueText}` : ""}</small>
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

function NewTaskForm({ ws, desk, projects, onDone, initialDetail = "" }: { initialDetail?: string; ws: string; desk: Desk; projects: Office["projects"]; onDone: (id: string | null) => void }) {
  const [title, setTitle] = useState(""); const [detail, setDetail] = useState(initialDetail);
  const [due, setDue] = useState(""); const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  async function submit(now: boolean) {
    setBusy(true); setErr(null);
    try {
      const fileIds = files.length ? await uploadAll(files, ws) : [];
      const r = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, agentId: desk.agentId, title, detail, due, projectId, now, files: fileIds }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      onDone(j.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <form className="newtask" onSubmit={e => { e.preventDefault(); submit(true); }}>
      <label htmlFor="nt-title" className="sect">Task baru untuk {desk.name}</label>
      <input id="nt-title" className="input" placeholder="Contoh: Tulis 3 ide caption untuk teaser Instagram" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea id="nt-detail" placeholder="Detail atau arahan (opsional)" value={detail} onChange={e => setDetail(e.target.value)}
        onPaste={e => { const p = [...e.clipboardData.files]; if (p.length) { e.preventDefault(); setFiles([...files, ...p]); } }} />
      <FilePicker files={files} onChange={setFiles} />
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
        <button className="btn primary" disabled={!title.trim() || busy}>{busy ? <><span className="spinner sm" /> Menyimpan…</> : "Kerjakan sekarang"}</button>
      </div>
    </form>
  );
}

export default function OfficeView({ office, buildings, attention, people, seen }: { office: Office; buildings: Building[]; attention: Office["attention"]; people: string[]; seen: Record<string, string> }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const [openDesk, setOpenDesk] = useState<Desk | null>(null);
  const [openTask, setOpenTaskRaw] = useState<{ id: string; ws: string } | null>(null);
  const setOpenTask = (id: string | null, ws: string = office.workspaceId) => setOpenTaskRaw(id ? { id, ws } : null);
  const many = buildings.length > 1;
  const [adding, setAdding] = useState(false);
  const [chatWith, setChatWith] = useState<Desk | null>(null);
  const [openHuman, setOpenHuman] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [person, setPerson] = useState<string>("Semua");
  const [toast, setToast] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  // Tandai "aku sedang online" tiap 2 menit selama tab ini terbuka dan terlihat.
  useEffect(() => {
    const beat = () => { if (document.visibilityState === "visible") fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws: office.workspaceId }) }).catch(() => {}); };
    beat(); const t = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [office.workspaceId]);
  async function rerun(f: RunView) {
    setRerunning(f.id);
    try {
      const r = await fetch(`/api/task/${f.issueId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws: f.ws, action: "rerun" }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      setToast(`${f.agent} mencoba lagi: ${f.issueTitle ?? "task"}`); refresh();
    } catch (e) { setToast("Gagal menjalankan ulang: " + (e instanceof Error ? e.message : String(e))); }
    finally { setRerunning(null); }
  }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (openTask) setOpenTask(null); else { setOpenDesk(null); setOpenHuman(null); } } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [openTask]);

  const a = attention;
  const human = useMemo(() => (person === "Semua" ? a.human : a.human.filter(t => t.assignee === person)), [a.human, person]);
  const openT = (t: { id: string; ws: string }) => setOpenTask(t.id, t.ws);
  const total = a.overdue.length + a.human.length + a.review.length + a.failed.length;
  const runs: RunView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.runs ?? [] : [];
  const allTasks: TaskView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.tasks ?? [] : [];
  const closeAll = () => { setOpenTask(null); setOpenDesk(null); setOpenHuman(null); setAdding(false); setChatWith(null); };
  const allDesks = [...office.rooms.flatMap(r => r.desks), ...office.idleDesks];
  const mika = allDesks.find(d => d.name.toLowerCase() === "mika");

  // Tahap 2: worker berjalan mengantar pekerjaan saat ada serah terima.
  const officeRef = useRef<HTMLElement>(null);
  const [walks, setWalks] = useState<(Handover & { key: string })[]>([]);
  const walkingIds = useMemo(() => new Set(walks.map(w => w.from)), [walks]);
  const here = (p: string) => !!seen[p] && Date.now() - Date.parse(seen[p]) < 5 * 60000;
  const reviewer = people.find(here) ?? people[0] ?? null;
  const nameOf = (k: string) => k.startsWith("person:") ? k.slice(7) : allDesks.find(d => d.agentId === k)?.name ?? "Worker";
  const startWalks = useCallback((hs: Handover[]) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setWalks(cur => [...cur, ...hs.filter(h => !cur.some(c => c.from === h.from)).map(h => ({ ...h, key: h.from + ":" + Date.now() + Math.random() }))]);
    setToast(hs.map(h => `${h.fromName} mengantar "${h.title}" ke ${h.to.startsWith("person:") ? "meja " : ""}${h.toName}`).join(" · "));
  }, []);
  useHandoverDetector(office, reviewer, nameOf, startWalks);
  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent).detail; startWalks([{ ...d, fromName: nameOf(d.from), toName: nameOf(d.to) }]); };
    addEventListener("kantor:handover", f); return () => removeEventListener("kantor:handover", f);
  });

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
            {mika && <button className="btn sm" onClick={() => setChatWith(mika)}>💬 Ngobrol dengan Mika</button>}
            <OfficeSwitch key={office.workspaceId + String(office.switchOpen)} ws={office.workspaceId} name={office.workspace} switchOpen={office.switchOpen} laptopOn={office.open} parked={office.parked}
              onDone={msg => { setToast(msg); refresh(); }} />
            <span className="hgroup" aria-label="Mesin AI">
              <span className="hlabel">Mesin AI</span>
              {office.runtimes.map(r => (
                <span key={r.name} className={`rt ${r.quotaOut ? "brk" : r.online ? "on" : ""}`}
                  title={r.quotaOut ? `Kuota ${r.name} habis${r.quotaReset ? `, reset sekitar ${r.quotaReset}` : ""}. Task dilanjutkan otomatis.` : r.online ? `${r.name} siap bekerja` : `Laptop mati · terakhir terlihat ${r.lastSeen}`}>
                  🤖 {r.name} <small>{r.quotaOut ? `☕ kuota habis${r.quotaReset ? ` · reset ${r.quotaReset}` : ""}` : r.online ? "siap" : "mati"}</small></span>
              ))}
            </span>
            <span className="hgroup" aria-label="Tim">
              <span className="hlabel">Tim</span>
              {people.map(p => <Presence key={p} name={p} at={seen[p]} />)}
            </span>
            <span className="clock">{refreshing ? <><span className="spinner sm" /> Memperbarui…</> : `Diperbarui ${office.updatedAt}`}</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="office" aria-label="Denah kantor" ref={officeRef}>
          <HandoverLayer items={walks} layer={officeRef.current} onDone={k => setWalks(w => w.filter(x => x.key !== k))} />
          <div className="legend">
            <span><i className="dot" style={{ background: "var(--ok)" }} />Bekerja</span>
            <span><i className="dot" style={{ background: "var(--attn)" }} />Menunggu review</span>
            <span><i className="dot" style={{ background: "var(--todo)" }} />Siap mengerjakan</span>
            <span><i className="dot" style={{ background: "#C2412D" }} />Gagal</span>
            <span>☕ Istirahat (kuota AI habis)</span><span>🏠 Pulang</span><span>🔒 Kantor tutup</span><span>🌙 Laptop mati</span><span>🔴 Telat · 🟠 Berisiko</span>
          </div>

          {office.alerts.map(a => <div key={a} className="alert" role="alert">⚠️ {a}</div>)}

          <section className="room team" aria-label="Meja tim">
            <div className="roomhead"><div><h2>🪑 Meja tim</h2><div className="sub">Hasil kerja dan tugas untuk manusia mendarat di sini</div></div></div>
            <div className="desks">{people.map(p => (
              <HumanDesk key={p} name={p} at={seen[p]} review={a.review.length} tasks={a.human.filter(t => t.assignee === p).length}
                onOpen={() => { setOpenHuman(p); setOpenDesk(null); }} />
            ))}</div>
          </section>

          {office.rooms.map(r => (
            <section key={r.id} className="room" aria-label={r.name}>
              <div className="roomhead">
                <div><h2>{r.icon ? `${r.icon} ` : ""}{r.name}</h2>{r.progress && <div className="sub">{r.progress}</div>}</div>
              </div>
              <div className="desks">{r.desks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} onChat={() => setChatWith(d)} walking={walkingIds.has(d.agentId)} />)}</div>
            </section>
          ))}

          {office.idleDesks.length > 0 && (
            <section className="room" aria-label="Ruang staf">
              <div className="roomhead"><div><h2>Ruang Staf</h2><div className="sub">Worker tanpa task di project mana pun</div></div></div>
              <div className="desks">{office.idleDesks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} onChat={() => setChatWith(d)} walking={walkingIds.has(d.agentId)} />)}</div>
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
                <li key={f.id} className="failrow"><button className="item" onClick={() => f.issueId && setOpenTask(f.issueId, f.ws)}>
                  <span><b>{f.issueTitle ?? "Tugas tanpa judul"}</b><small><span className="kind k-fail">Gagal</span>{f.agent} · {f.error} · {f.when}</small></span>
                </button>
                {f.issueId && <button className="btn sm" disabled={rerunning === f.id} onClick={() => rerun(f)}>{rerunning === f.id ? "…" : "↻ Jalankan ulang"}</button>}</li>
              ))}
            </Section>
          </div>
        </aside>
      </main>

      {(openDesk || openTask || chatWith || openHuman) && <div className="scrim" onClick={closeAll} />}

      {openDesk && !openTask && !chatWith && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label={openDesk.name}>
          <div className="dhead">
            <span className={`st-${openDesk.state}`}><Avatar d={openDesk} /></span>
            <div className="meta"><h2>{openDesk.name}</h2><div className="role">{openDesk.runtime}</div></div>
            <button className="x" onClick={closeAll} aria-label="Tutup">✕</button>
          </div>
          <div className="dbody">
            <div className="note"><span>{openDesk.bubble}</span></div>
            {adding ? (
              <NewTaskForm ws={office.workspaceId} desk={openDesk} projects={office.projects} initialDetail={draft} onDone={id => { setAdding(false); setDraft(""); refresh(); if (id) setOpenTask(id); }} />
            ) : (
              <div className="chiprow">
                <button className="btn primary" onClick={() => { setDraft(""); setAdding(true); }}>+ Beri task baru</button>
              </div>
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

      {openHuman && !openTask && !chatWith && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label={`Meja ${openHuman}`}>
          <div className="dhead">
            <span className="avatar">{openHuman.slice(0, 1).toUpperCase()}</span>
            <div className="meta"><h2>Meja {openHuman}</h2><div className="role">{office.workspace}</div></div>
            <button className="x" onClick={closeAll} aria-label="Tutup">✕</button>
          </div>
          <div className="dbody">
            <div>
              <div className="sect">📄 Perlu review ({a.review.length})</div>
              <div className="tasks">{a.review.length ? a.review.map(t => <TaskRow key={t.id} t={t} showWho onOpen={id => setOpenTask(id, t.ws)} />) : <p className="desc">Tidak ada yang menunggu review ☕</p>}</div>
            </div>
            <div>
              <div className="sect">📋 Tugas untuk {openHuman} ({a.human.filter(t => t.assignee === openHuman).length})</div>
              <div className="tasks">{a.human.filter(t => t.assignee === openHuman).map(t => <TaskRow key={t.id} t={t} onOpen={id => setOpenTask(id, t.ws)} />)}
                {!a.human.some(t => t.assignee === openHuman) && <p className="desc">Tidak ada tugas untuk {openHuman}.</p>}</div>
            </div>
          </div>
        </div>
      )}

      {chatWith && (
        <ChatPanel ws={office.workspaceId} agent={{ id: chatWith.agentId, name: chatWith.name, emoji: chatWith.emoji, role: chatWith.description }}
          isMika={chatWith.name.toLowerCase() === "mika"} projectId={null} laptopOn={office.open}
          onClose={() => setChatWith(null)}
          onMakeTask={detail => { const d = chatWith; setChatWith(null); setOpenDesk(d); setDraft(detail); setAdding(true); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      {openTask && <TaskPanel id={openTask.id} ws={openTask.ws} onClose={() => setOpenTask(null)} onChanged={refresh} />}
    </>
  );
}
