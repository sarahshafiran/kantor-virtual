"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Board, Card } from "@/lib/crew";
import { COLS } from "@/lib/board-cols";
import TaskPanel from "../task-panel";
import ThemeToggle from "../theme-toggle";
import NewProject from "../new-project";
import { Px } from "../pixel-icon";

const LOOSE = "none";

function CardItem({ c, showProject, onOpen }: { c: Card; showProject: boolean; onOpen: () => void }) {
  return (
    <button className={`kcard ${c.dueFlag ?? ""}`} onClick={onOpen}>
      <b className="kc-t">{c.title}</b>
      {showProject && <span className="kc-proj">{c.project ? <>{c.projectIcon ?? <Px name="folder" />} {c.project}</> : <><Px name="loose" /> No project</>}</span>}
      <span className="kc-foot">
        {c.who ? <span className={`kc-who ${c.who.kind}`}><i>{c.who.emoji ?? (c.who.kind === "agent" ? <Px name="agent" /> : c.who.name.slice(0, 1).toUpperCase())}</i>{c.who.name}</span>
          : <span className="kc-who none"><i>?</i>Unassigned</span>}
        {c.dueText && <span className={`due ${c.dueFlag ?? "ok"}`}>{c.dueFlag === "late" ? <><Px name="dot-late" /> </> : c.dueFlag === "risk" ? <><Px name="dot-risk" /> </> : <><Px name="calendar" /> </>}{c.dueText}</span>}
      </span>
    </button>
  );
}

function NewCard({ board, project, onDone }: { board: Board; project: string; onDone: (id: string | null) => void }) {
  const [title, setTitle] = useState(""); const [detail, setDetail] = useState("");
  const [who, setWho] = useState(""); const [due, setDue] = useState("");
  const [proj, setProj] = useState(project === "all" ? (board.projects[0]?.id ?? "") : project === LOOSE ? "" : project);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(now: boolean) {
    setBusy(true); setErr(null);
    try {
      const [type, id] = who ? who.split(":") : [null, null];
      const r = await fetch("/api/task", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ws: board.workspaceId, title, detail, due, projectId: proj, now, assigneeType: type, assigneeId: id }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      onDone(j.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="scrim" onClick={() => onDone(null)} />
      <form className="modal" role="dialog" aria-modal="true" aria-label="New task" onSubmit={e => { e.preventDefault(); submit(true); }}>
        <h2><Px name="edit" /> New task</h2>
        <input className="input" autoFocus placeholder="What needs doing? e.g. Tidy up the button components" value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" />
        <textarea className="input" rows={4} placeholder="Details or instructions (optional)" value={detail} onChange={e => setDetail(e.target.value)} aria-label="Details" />
        <div className="formgrid">
          <label>Who takes it?
            <select className="input" value={who} onChange={e => setWho(e.target.value)}>
              <option value="">Nobody yet (decide later)</option>
              <optgroup label="AI agents">{board.people.filter(p => p.kind === "agent").map(p => <option key={p.id} value={`agent:${p.id}`}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</option>)}</optgroup>
              <optgroup label="People">{board.people.filter(p => p.kind === "member").map(p => <option key={p.id} value={`member:${p.id}`}>{p.name}</option>)}</optgroup>
            </select>
          </label>
          <label>Project
            <select className="input" value={proj} onChange={e => setProj(e.target.value)}>
              {board.projects.map(p => <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ""}{p.name}</option>)}
              <option value="">No project</option>
            </select>
          </label>
          <label>Due date<input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        </div>
        {who.startsWith("agent:") && <p className="hint">“Start now” puts it in the agent’s queue right away. “Save for later” parks it in Backlog.</p>}
        {err && <div className="note bad">{err}</div>}
        <div className="row">
          <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="btn" disabled={(!title.trim() && !detail.trim()) || busy} onClick={() => submit(false)}>Save for later</button>
          <button className="btn primary" disabled={(!title.trim() && !detail.trim()) || busy}>{busy ? <><span className="spinner sm" /> Saving…</> : <><Px name="rocket" /> Start now</>}</button>
        </div>
      </form>
    </>
  );
}

export default function BoardView({ board, initialProject }: { board: Board; initialProject: string }) {
  const router = useRouter();
  const [refreshing, start] = useTransition();
  const refresh = () => start(() => router.refresh());
  const [proj, setProj] = useState(initialProject);
  const [who, setWho] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newProject, setNewProject] = useState(false);
  useEffect(() => { const t = setInterval(() => start(() => router.refresh()), 30_000); return () => clearInterval(t); }, [router]);
  // Keep the chosen project in the URL so it can be shared or reloaded.
  useEffect(() => {
    const u = new URL(location.href);
    if (proj === "all") u.searchParams.delete("p"); else u.searchParams.set("p", proj);
    history.replaceState(null, "", u);
  }, [proj]);

  const shown = useMemo(() => board.cards.filter(c =>
    (proj === "all" || (proj === LOOSE ? !c.projectId : c.projectId === proj)) &&
    (who === "all" || (who === "agents" ? c.who?.kind === "agent" : who === "humans" ? c.who?.kind === "member" : who === "nobody" ? !c.who : c.who?.id === who))
  ), [board.cards, proj, who]);
  const current = board.projects.find(p => p.id === proj);
  const total = board.cards.filter(c => c.col !== "done").length;

  return (
    <>
      <header className="top">
        <div className="wrap hbar">
          <div className="brand"><h1><Px name="board" /> Task Board</h1><p className="pdesc">Every task in this workspace, by project.</p></div>
          <div className="chiprow">
            <button className="btn primary" onClick={() => setAdding(true)}>+ New task</button>
            <ThemeToggle />
            <span className="clock">{refreshing ? <><span className="spinner sm" /> Refreshing…</> : `${total} open task${total === 1 ? "" : "s"}`}</span>
          </div>
        </div>
      </header>
      <main className="wrap pagewide">
        <nav className="projtabs" aria-label="Pick a project">
          <button className="ptab" aria-pressed={proj === "all"} onClick={() => setProj("all")}>
            <span className="pt-ic"><Px name="all" /></span><span className="pt-t"><b>All</b><small>{total} open</small></span>
          </button>
          {board.projects.map(p => (
            <button key={p.id} className="ptab" aria-pressed={proj === p.id} onClick={() => setProj(p.id)}>
              <span className="pt-ic">{p.icon ?? <Px name="folder" />}</span>
              <span className="pt-t"><b>{p.name}</b><small>{p.done}/{p.total} done</small></span>
              <span className="pt-bar" aria-hidden><i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} /></span>
            </button>
          ))}
          <button className="ptab" aria-pressed={proj === LOOSE} onClick={() => setProj(LOOSE)}>
            <span className="pt-ic"><Px name="loose" /></span><span className="pt-t"><b>No project</b><small>{board.loose} open</small></span>
          </button>
          <button className="ptab ptab-new" onClick={() => setNewProject(true)}>
            <span className="pt-ic">＋</span><span className="pt-t"><b>New project</b><small>group tasks under a goal</small></span>
          </button>
        </nav>

        <div className="boardbar">
          <p className="desc">
            {proj === "all" ? `${total} open across ${board.projects.length} project${board.projects.length === 1 ? "" : "s"}, plus ${board.loose} without one.` :
              proj === LOOSE ? "Loose tasks that don't belong to a project yet." :
              current ? `${current.icon ? current.icon + " " : ""}${current.name}: ${current.open} open, ${current.done} done${current.due ? ` · due ${new Date(current.due + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.` : ""}
          </p>
          <label className="whofilter">Show tasks for
            <select className="input" value={who} onChange={e => setWho(e.target.value)}>
              <option value="all">everyone</option>
              <option value="agents">All agents</option>
              <option value="humans">All people</option>
              <option value="nobody">Unassigned</option>
              {board.people.map(p => <option key={p.id} value={p.id}>{p.kind === "agent" && p.emoji ? `${p.emoji} ` : ""}{p.name}</option>)}
            </select>
          </label>
        </div>

        <div className="kanban">
          {COLS.map(col => {
            const cs = shown.filter(c => c.col === col.id);
            const list = col.id === "done" ? cs.slice(0, 20) : cs;
            return (
              <section key={col.id} className={`kcol c-${col.id}`} aria-label={col.title}>
                <div className="kc-head"><b><Px name={col.icon} /> {col.title}</b><span className="count">{cs.length}</span><small>{col.sub}</small></div>
                <div className="kc-list">
                  {list.map(c => <CardItem key={c.id} c={c} showProject={proj === "all"} onOpen={() => setOpen(c.id)} />)}
                  {!cs.length && <p className="kc-empty">{col.id === "in_review" ? <>Nothing to review <Px name="coffee" /></> : col.id === "done" ? "Nothing finished yet. Keep going!" : "Empty"}</p>}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      {newProject && <NewProject ws={board.workspaceId} people={board.people} onDone={id => { setNewProject(false); if (id) { setProj(id); refresh(); } }} />}
      {adding && <NewCard board={board} project={proj} onDone={id => { setAdding(false); refresh(); if (id) setOpen(id); }} />}
      {open && <div className="scrim" onClick={() => setOpen(null)} />}
      {open && <TaskPanel id={open} ws={board.workspaceId} onClose={() => setOpen(null)} onChanged={refresh} />}
    </>
  );
}
