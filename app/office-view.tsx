"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Office, Desk, TaskView, RunView } from "@/lib/office";
import TaskPanel from "./task-panel";
import type { Building } from "./page";
import OfficeSwitch from "./office-switch";
import ThemeToggle from "./theme-toggle";
import FilePicker, { uploadAll } from "./file-picker";
import ChatPanel, { MANAGER, isManager } from "./chat-panel";
import PixelDesk, { type PixelState } from "./pixel-desk";
import { Px, Emo, PxText, StateIcon, type PxName } from "./pixel-icon";
import { HandoverLayer, useHandoverDetector, type Handover } from "./handover";
import NewProject from "./new-project";
import { openChat } from "./messages";

const REFRESH_MS = 30_000;

const ago = (mins: number) => mins < 60 ? `${Math.round(mins)}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`;

function Avatar({ d, home }: { d: Desk; home?: boolean }) {
  return (
    <span className="avatar">
      {home ? <Px name="home" /> : d.avatar ? <img src={d.avatar} alt="" /> : d.emoji ? <Emo e={d.emoji} /> : d.name.slice(0, 1)}
      <span className="status-dot" />
    </span>
  );
}

/** Small chat-bubble button that opens Messages with one person. */
function ChatWith({ name, onChat, className }: { name: string; onChat: () => void; className?: string }) {
  return <button type="button" className={`chatwith ${className ?? ""}`} onClick={e => { e.stopPropagation(); onChat(); }} title={`Message ${name}`} aria-label={`Message ${name}`}><Px name="chat" /></button>;
}

function Presence({ name, at, onChat }: { name: string; at?: string; onChat?: () => void }) {
  const mins = at ? (Date.now() - Date.parse(at)) / 60000 : Infinity;
  const on = mins < 5;
  const label = on ? "in the office" : !at ? "never opened" : ago(mins);
  return (
    <span className={`person ${on ? "on" : ""}`} title={`${name}: ${on ? "has the office open" : "last opened the office " + label}`}>
      <span className="initial">{name.slice(0, 1).toUpperCase()}</span>{name} <small>{label}</small>
      {onChat && <ChatWith name={name} onChat={onChat} />}
    </span>
  );
}

function DueChip({ t }: { t: TaskView }) {
  if (!t.dueText) return null;
  return <span className={`due ${t.dueFlag ?? "ok"}`}>{t.dueFlag === "late" ? <><Px name="dot-late" /> </> : t.dueFlag === "risk" ? <><Px name="dot-risk" /> </> : t.dueFlag === "done" ? <><Px name="check" /> </> : ""}{t.dueText}</span>;
}

const pillOf = (s: string) => (s === "in_review" ? "review" : s === "in_progress" ? "doing" : "queued");

function TaskRow({ t, onOpen, showWho }: { t: TaskView; onOpen: (id: string) => void; showWho?: boolean }) {
  return (
    <button className="tasklink" onClick={() => onOpen(t.id)}>
      <span className="t"><PxText text={t.title} />{showWho && t.assignee ? <small>{t.assignee}</small> : null}</span>
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
        <span className={`bubble ${d.state}`}><StateIcon state={d.state} />{d.bubble}</span>
        <span className="pixbox">
          <PixelDesk name={d.name} state={walking ? "away" : pixOf(d.state)} />
          {(d.lateCount > 0 || d.riskCount > 0 || d.reviewCount > 0) && (
            <span className="flags tasks">
              {d.lateCount > 0 && <span className="flag late" title="Late"><Px name="dot-late" /> {d.lateCount}</span>}
              {d.riskCount > 0 && <span className="flag risk" title="At risk"><Px name="dot-risk" /> {d.riskCount}</span>}
              {d.reviewCount > 0 && <span className="flag rev" title="Waiting for review"><Px name="file" /> {d.reviewCount}</span>}
            </span>
          )}
        </span>
        <span className="who">{d.name}</span>
        <span className="model">{d.description ? d.description.split(/[.:]/)[0].slice(0, 40) : "AI agent"}</span>
      </button>
      <button className="chatbtn" onClick={onChat} aria-label={`Chat with ${d.name}`} title={`Chat with ${d.name}`}><Px name="chat" /><span>chat</span></button>
    </div>
  );
}

function HumanDesk({ name, at, review, tasks, onOpen, onChat }: { name: string; at?: string; review: number; tasks: number; onOpen: () => void; onChat?: () => void }) {
  const mins = at ? (Date.now() - Date.parse(at)) / 60000 : Infinity;
  const here = mins < 5;
  const label = here ? "in the office" : !at ? "not in yet" : `last seen ${ago(mins)}`;
  return (
    <div className="deskwrap" data-desk={"person:" + name}>
      <button className={`desk pix human ${here ? "" : "dim"}`} onClick={onOpen} aria-label={`${name}'s desk. ${label}. ${review} to review, ${tasks} to-dos.`}>
        <span className={`bubble ${here ? "here" : "closed"}`}>{label}</span>
        <span className="pixbox">
          <PixelDesk name={name} human state={here ? "present" : "away"} papers={review + tasks} />
          {(review > 0 || tasks > 0) && (
            <span className="flags">
              {review > 0 && <span className="flag rev" title="To review"><Px name="file" /> {review}</span>}
              {tasks > 0 && <span className="flag todo" title="Your to-dos"><Px name="todo" /> {tasks}</span>}
            </span>
          )}
        </span>
        <span className="who">{name}</span>
        <span className="model">Team</span>
      </button>
      {onChat && <ChatWith name={name} onChat={onChat} className="ondesk" />}
    </div>
  );
}

/** One group in "Needs attention": icon, title, short hint and count above its rows. */
function AttnGroup({ kind, icon, title, hint, count, children, extra }: { kind: string; icon: PxName; title: string; hint: string; count: number; children: React.ReactNode[]; extra?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <section className={`ag ag-${kind}`} aria-label={title}>
      <header>
        <span className="ag-ic" aria-hidden><Px name={icon} /></span>
        <span className="ag-t"><b>{title}</b><small>{hint}</small></span>
        <span className="ag-n">{count}</span>
      </header>
      {extra}
      <ul>{all ? children : children.slice(0, 4)}</ul>
      {children.length > 4 && <button className="more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${children.length}`}</button>}
    </section>
  );
}

function AttnRow({ t, onOpen }: { t: TaskView; onOpen: () => void }) {
  return (
    <li>
      <button className="ar" onClick={onOpen}>
        <b><PxText text={t.title} /></b>
        <small>{t.assignee ?? "Unassigned"}{t.dueText ? ` · ${t.dueText}` : ""}{t.project ? ` · ${t.project}` : ""}</small>
      </button>
    </li>
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
      <label htmlFor="nt-title" className="sect">New task for {desk.name}</label>
      <input id="nt-title" className="input" placeholder={detail.trim() ? "Title (optional, taken from the details)" : "e.g. Write 3 caption ideas for the Instagram teaser"} value={title} onChange={e => setTitle(e.target.value)} />
      <textarea id="nt-detail" placeholder="Details or instructions (optional)" value={detail} onChange={e => setDetail(e.target.value)}
        onPaste={e => { const p = [...e.clipboardData.files]; if (p.length) { e.preventDefault(); setFiles([...files, ...p]); } }} />
      <FilePicker files={files} onChange={setFiles} />
      <div className="chiprow">
        <label className="desc" htmlFor="nt-due">Due</label><input id="nt-due" className="input" type="date" value={due} onChange={e => setDue(e.target.value)} style={{ width: "auto" }} />
        <label className="desc" htmlFor="nt-proj">Project</label>
        <select id="nt-proj" className="input" value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: "auto" }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="">No project</option>
        </select>
      </div>
      {err && <div className="note bad">{err}</div>}
      <div className="row">
        <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
        <button type="button" className="btn" disabled={(!title.trim() && !detail.trim()) || busy} onClick={() => submit(false)}>Save for later</button>
        <button className="btn primary" disabled={(!title.trim() && !detail.trim()) || busy}>{busy ? <><span className="spinner sm" /> Saving…</> : "Start now"}</button>
      </div>
    </form>
  );
}

export default function OfficeView({ office, attention, people, seen, meId }: { office: Office; buildings: Building[]; attention: Office["attention"]; people: string[]; seen: Record<string, string>; meId?: string | null }) {
  // Chat bubble for everyone except yourself.
  const chatTo = (name: string) => { const m = office.members.find(x => x.name === name); return m && m.id !== meId ? () => openChat(m.id) : undefined; };
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const [openDesk, setOpenDesk] = useState<Desk | null>(null);
  const [openTask, setOpenTaskRaw] = useState<{ id: string; ws: string } | null>(null);
  const setOpenTask = (id: string | null, ws: string = office.workspaceId) => setOpenTaskRaw(id ? { id, ws } : null);
  const [adding, setAdding] = useState(false);
  const [chatWith, setChatWith] = useState<Desk | null>(null);
  const [openHuman, setOpenHuman] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [person, setPerson] = useState<string>("All");
  const [toast, setToast] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [newProject, setNewProject] = useState(false);
  // Mark "I'm online" every 2 minutes while this tab is open and visible.
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
      setToast(`${f.agent} is trying again: ${f.issueTitle ?? "task"}`); refresh();
    } catch (e) { setToast("Couldn't retry: " + (e instanceof Error ? e.message : String(e))); }
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
  const human = useMemo(() => (person === "All" ? a.human : a.human.filter(t => t.assignee === person)), [a.human, person]);
  const openT = (t: { id: string; ws: string }) => setOpenTask(t.id, t.ws);
  const total = a.overdue.length + a.human.length + a.review.length + a.failed.length;
  const runs: RunView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.runs ?? [] : [];
  const allTasks: TaskView[] = openDesk ? office.agentsDetail[openDesk.agentId]?.tasks ?? [] : [];
  const closeAll = () => { setOpenTask(null); setOpenDesk(null); setOpenHuman(null); setAdding(false); setChatWith(null); };
  const allDesks = [...office.rooms.flatMap(r => r.desks), ...office.idleDesks];
  const mika = allDesks.find(d => isManager(d.name));

  // Agents walk over to hand work off.
  const officeRef = useRef<HTMLElement>(null);
  const [walks, setWalks] = useState<(Handover & { key: string })[]>([]);
  const walkingIds = useMemo(() => new Set(walks.map(w => w.from)), [walks]);
  const here = (p: string) => !!seen[p] && Date.now() - Date.parse(seen[p]) < 5 * 60000;
  const reviewer = people.find(here) ?? people[0] ?? null;
  const nameOf = (k: string) => k.startsWith("person:") ? k.slice(7) : allDesks.find(d => d.agentId === k)?.name ?? "Agent";
  const startWalks = useCallback((hs: Handover[]) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setWalks(cur => [...cur, ...hs.filter(h => !cur.some(c => c.from === h.from)).map(h => ({ ...h, key: h.from + ":" + Date.now() + Math.random() }))]);
    setToast(hs.map(h => `${h.fromName} is bringing "${h.title}" to ${h.toName}${h.to.startsWith("person:") ? "'s desk" : ""}`).join(" · "));
  }, []);
  useHandoverDetector(office, reviewer, nameOf, startWalks);
  useEffect(() => {
    const f = (e: Event) => { const d = (e as CustomEvent).detail; startWalks([{ ...d, fromName: nameOf(d.from), toName: nameOf(d.to) }]); };
    addEventListener("kantor:handover", f); return () => removeEventListener("kantor:handover", f);
  });

  const cleared = [
    !a.overdue.length && "nothing late",
    !a.human.length && "no to-dos",
    !a.review.length && "nothing to review",
    !a.failed.length && "no failures",
  ].filter(Boolean) as string[];
  const width = (n: number) => ({ "--w": `${n * 210 + 48}px` } as React.CSSProperties);

  return (
    <>
      <header className="top">
        <div className="wrap hbar">
          <div className="brand"><h1><Px name="office" /> Office</h1><p className="pdesc">Who&apos;s doing what, right now.</p></div>
          <div className="chiprow">
            <OfficeSwitch key={office.workspaceId + String(office.switchOpen)} ws={office.workspaceId} name={office.workspace} switchOpen={office.switchOpen} laptopOn={office.open} parked={office.parked}
              onDone={msg => { setToast(msg); refresh(); }} />
            <span className="hgroup" aria-label="Team">
              {people.map(p => <Presence key={p} name={p} at={seen[p]} onChat={chatTo(p)} />)}
            </span>
            <ThemeToggle />
            <span className="clock">{refreshing ? <><span className="spinner sm" /> Refreshing…</> : `Updated ${office.updatedAt}`}</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="office" aria-label="Office floor plan" ref={officeRef}>
          <HandoverLayer items={walks} layer={officeRef.current} onDone={k => setWalks(w => w.filter(x => x.key !== k))} />
          <div className="legend">
            <span><i className="dot" style={{ background: "var(--ok)" }} />Working</span>
            <span><i className="dot" style={{ background: "var(--attn)" }} />Waiting for review</span>
            <span><i className="dot" style={{ background: "var(--todo)" }} />Ready</span>
            <span><i className="dot" style={{ background: "#C2412D" }} />Failed</span>
            <span><Px name="coffee" /> Break (AI quota used up)</span><span><Px name="home" /> Off duty</span><span><Px name="lock" /> Office closed</span><span><Px name="moon" /> Laptop off</span><span><Px name="dot-late" /> Late</span><span><Px name="dot-risk" /> At risk</span>
          </div>

          {office.alerts.map(x => <div key={x} className="alert" role="alert"><Px name="alert" /> {x}</div>)}

          <div className="rooms">
            <section className="room team" aria-label="Team desks" style={width(people.length)}>
              <div className="roomhead"><div><h2><Px name="desk" /> Team desks</h2><div className="sub">Finished work and to-dos for people land here</div></div></div>
              <div className="desks">{people.map(p => (
                <HumanDesk key={p} name={p} at={seen[p]} review={a.review.length} tasks={a.human.filter(t => t.assignee === p).length}
                  onOpen={() => { setOpenHuman(p); setOpenDesk(null); }} onChat={chatTo(p)} />
              ))}</div>
            </section>

            {office.rooms.map(r => (
              <section key={r.id} className="room" aria-label={r.name} style={width(r.desks.length)}>
                <div className="roomhead">
                  <div><h2>{r.icon ? <><Emo e={r.icon} /> </> : null}{r.name}</h2>{r.progress && <div className="sub">{r.progress}</div>}</div>
                </div>
                <div className="desks">{r.desks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} onChat={() => setChatWith(d)} walking={walkingIds.has(d.agentId)} />)}</div>
              </section>
            ))}

            {office.idleDesks.length > 0 && (
              <section className="room" aria-label="Lounge" style={width(office.idleDesks.length)}>
                <div className="roomhead"><div><h2><Px name="lounge" /> Lounge</h2><div className="sub">Tasks without a project, and agents who aren&apos;t on a project right now</div></div></div>
                <div className="desks">{office.idleDesks.map(d => <DeskButton key={d.agentId} d={d} onOpen={() => { setOpenDesk(d); setAdding(false); }} onChat={() => setChatWith(d)} walking={walkingIds.has(d.agentId)} />)}</div>
              </section>
            )}
            <button className="newroom" onClick={() => setNewProject(true)}><Px name="plus" /> New project<small>adds a new room to the office</small></button>
          </div>
        </section>

        <aside className="attn" aria-label="Needs attention">
          <div className="ah"><h2>Needs attention <span className="count">{total}</span></h2><p>{office.today}</p></div>
          <div className="scroll">
            {total === 0 && <p className="allclear"><Px name="party" /> All clear. Nothing needs you right now.</p>}
            {a.overdue.length > 0 && (
              <AttnGroup kind="late" icon="clock" title="Late & at risk" hint="past or close to the due date" count={a.overdue.length}>
                {a.overdue.map(t => <AttnRow key={t.id} t={t} onOpen={() => openT(t)} />)}
              </AttnGroup>
            )}
            {a.human.length > 0 && (
              <AttnGroup kind="human" icon="person" title="To-dos for people" hint="steps only a person can do" count={human.length}
                extra={people.length > 1 ? (
                  <div className="tabs">{["All", ...people].map(p => <button key={p} className="tab" aria-pressed={person === p} onClick={() => setPerson(p)}>{p}</button>)}</div>
                ) : undefined}>
                {human.map(t => <AttnRow key={t.id} t={t} onOpen={() => openT(t)} />)}
              </AttnGroup>
            )}
            {a.review.length > 0 && (
              <AttnGroup kind="review" icon="eyes" title="Waiting for review" hint="agents finished, your call" count={a.review.length}>
                {a.review.map(t => <AttnRow key={t.id} t={t} onOpen={() => openT(t)} />)}
              </AttnGroup>
            )}
            {a.failed.length > 0 && (
              <AttnGroup kind="fail" icon="failed" title="Failed" hint="last 7 days" count={a.failed.length}>
                {a.failed.map(f => (
                  <li key={f.id} className="failrow">
                    <button className="ar" onClick={() => f.issueId && setOpenTask(f.issueId, f.ws)}>
                      <b>{f.issueTitle ?? "Untitled task"}</b><small>{f.agent} · {f.error} · {f.when}</small>
                    </button>
                    {f.issueId && <button className="btn sm" disabled={rerunning === f.id} onClick={() => rerun(f)}>{rerunning === f.id ? "…" : <><Px name="refresh" /> Retry</>}</button>}
                  </li>
                ))}
              </AttnGroup>
            )}
            {total > 0 && cleared.length > 0 && <p className="clearline"><Px name="check" /> {cleared.join(" · ")}</p>}
          </div>
        </aside>
      </main>

      {(openDesk || openTask || chatWith || openHuman) && <div className="scrim" onClick={closeAll} />}

      {openDesk && !openTask && !chatWith && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label={openDesk.name}>
          <div className="dhead">
            <span className={`st-${openDesk.state}`}><Avatar d={openDesk} /></span>
            <div className="meta"><h2>{openDesk.name}</h2><div className="role">{openDesk.runtime}</div></div>
            <button className="x" onClick={closeAll} aria-label="Close"><Px name="close" size="1em" /></button>
          </div>
          <div className="dbody">
            <div className="note"><span><StateIcon state={openDesk.state} />{openDesk.bubble}</span></div>
            {adding ? (
              <NewTaskForm ws={office.workspaceId} desk={openDesk} projects={office.projects} initialDetail={draft} onDone={id => { setAdding(false); setDraft(""); refresh(); if (id) setOpenTask(id); }} />
            ) : (
              <div className="chiprow">
                <button className="btn primary" onClick={() => { setDraft(""); setAdding(true); }}><Px name="plus" size="0.9em" /> New task</button>
              </div>
            )}
            <div>
              <div className="sect">Open tasks ({allTasks.length})</div>
              <div className="tasks">{allTasks.length ? allTasks.map(t => <TaskRow key={t.id} t={t} onOpen={setOpenTask} />) : <p className="desc">No open tasks.</p>}</div>
            </div>
            <div>
              <div className="sect">Recent work</div>
              <div className="tasks">{runs.length ? runs.map(r => (
                <button key={r.id} className="tasklink" onClick={() => r.issueId && setOpenTask(r.issueId, r.ws)}>
                  <span className="t">{r.issueTitle ?? "Task"}<small>{r.when}{r.error ? ` · ${r.error}` : ""}</small></span>
                  <span className={`pill ${r.status === "failed" ? "p-review" : r.status === "completed" ? "p-done" : "p-doing"}`}>{r.status === "failed" ? "Failed" : r.status === "completed" ? "Done" : "Running"}</span>
                </button>)) : <p className="desc">Hasn&apos;t worked yet.</p>}</div>
            </div>
            {openDesk.description && <details className="extra"><summary>About {openDesk.name}</summary><p className="desc">{openDesk.description}</p></details>}
          </div>
        </div>
      )}

      {openHuman && !openTask && !chatWith && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label={`${openHuman}'s desk`}>
          <div className="dhead">
            <span className="avatar">{openHuman.slice(0, 1).toUpperCase()}</span>
            <div className="meta"><h2>{openHuman}&apos;s desk</h2><div className="role">{office.workspace}</div></div>
            <button className="x" onClick={closeAll} aria-label="Close"><Px name="close" size="1em" /></button>
          </div>
          <div className="dbody">
            <div>
              <div className="sect"><Px name="eyes" /> To review ({a.review.length})</div>
              <div className="tasks">{a.review.length ? a.review.map(t => <TaskRow key={t.id} t={t} showWho onOpen={id => setOpenTask(id, t.ws)} />) : <p className="desc">Nothing waiting for review ☕</p>}</div>
            </div>
            <div>
              <div className="sect"><Px name="person" /> To-dos for {openHuman} ({a.human.filter(t => t.assignee === openHuman).length})</div>
              <div className="tasks">{a.human.filter(t => t.assignee === openHuman).map(t => <TaskRow key={t.id} t={t} onOpen={id => setOpenTask(id, t.ws)} />)}
                {!a.human.some(t => t.assignee === openHuman) && <p className="desc">No to-dos for {openHuman}.</p>}</div>
            </div>
          </div>
        </div>
      )}

      {chatWith && (
        <ChatPanel ws={office.workspaceId} agent={{ id: chatWith.agentId, name: chatWith.name, emoji: chatWith.emoji, role: chatWith.description }}
          isMika={isManager(chatWith.name)} projectId={null} laptopOn={office.open}
          onClose={() => setChatWith(null)}
          onMakeTask={detail => { const d = chatWith; setChatWith(null); setOpenDesk(d); setDraft(detail); setAdding(true); }} />
      )}
      {/* Floating button to chat with the office manager, like a help button on a website. */}
      {mika && !chatWith && !openDesk && !openTask && !openHuman && (
        <button className="mikafab" onClick={() => setChatWith(mika)} aria-label={`Chat with ${MANAGER}, the office manager`}>
          <span className="mf-av">{mika.avatar ? <img src={mika.avatar} alt="" /> : <Emo e={mika.emoji ?? "🦄"} />}</span>
          <span className="mf-txt"><b>Ask {MANAGER}</b><small>ideas, tasks, new agents</small></span>
        </button>
      )}
      {newProject && <NewProject ws={office.workspaceId}
        people={[...office.members.map(m => ({ kind: "member" as const, id: m.id, name: m.name, emoji: null })), ...[...new Map(allDesks.map(d => [d.agentId, d])).values()].map(d => ({ kind: "agent" as const, id: d.agentId, name: d.name, emoji: d.emoji }))]}
        onDone={id => { setNewProject(false); if (id) { setToast("Project created. Its room appears once a task in it is assigned to an agent."); refresh(); } }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {openTask && <TaskPanel id={openTask.id} ws={openTask.ws} onClose={() => setOpenTask(null)} onChanged={refresh} />}
    </>
  );
}
