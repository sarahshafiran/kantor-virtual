"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Team, Mate, Load } from "@/lib/crew";
import TaskPanel from "../task-panel";
import ThemeToggle from "../theme-toggle";
import ChatPanel, { isManager } from "../chat-panel";
import { openChat } from "../messages";
import { Px, Emo, StateIcon, type PxName } from "../pixel-icon";

const LEVEL: Record<Load["level"], { icon: PxName; label: string; tip: string }> = {
  santai: { icon: "dot-on", label: "Free", tip: "no open tasks" },
  pas: { icon: "done", label: "Steady", tip: "1–3 open tasks" },
  sibuk: { icon: "busy", label: "Busy", tip: "4–6 open tasks" },
  kewalahan: { icon: "alert", label: "Overloaded", tip: "7 or more open tasks" },
};
const COL_LABEL = { backlog: "Backlog", todo: "Ready", in_progress: "In progress", in_review: "Needs review", done: "Done" } as const;

function Engine({ m, team, onSaved }: { m: Mate; team: Team; onSaved: (msg: string) => void }) {
  const [val, setVal] = useState(m.runtimeId ?? "");
  const [busy, setBusy] = useState(false);
  async function change(id: string) {
    const prev = val; setVal(id); setBusy(true);
    try {
      const j = await (await fetch("/api/crew", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws: team.workspaceId, agentId: m.id, runtimeId: id }) })).json();
      if (j.error) throw new Error(j.error);
      onSaved(`${m.name}: ${j.message}`);
    } catch (e) { setVal(prev); onSaved(`Couldn't switch engine: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }
  return (
    <label className="engine"><Px name="gear" /> AI engine
      <select className="input" value={val} disabled={busy} onChange={e => change(e.target.value)}>
        {!team.runtimes.some(r => r.id === val) && <option value="">— none —</option>}
        {team.runtimes.map(r => (
          <option key={r.id} value={r.id} disabled={!r.usable && r.id !== val}>
            {r.name}{!r.usable ? ` (private${r.owner ? ` · ${r.owner}'s laptop` : ""})` : r.online ? "" : " (offline)"}
          </option>
        ))}
      </select>
      {busy && <span className="spinner sm" />}
    </label>
  );
}

function MateCard({ m, team, onOpenTask, onChat, onToast }: { m: Mate; team: Team; onOpenTask: (id: string) => void; onChat?: () => void; onToast: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const L = m.load;
  const seg = (n: number) => `${L.open ? (n / L.open) * 100 : 0}%`;
  const openTasks = m.tasks.filter(t => t.col !== "done");
  return (
    <article className={`mate ${m.kind} st-${m.state}`}>
      <div className="mate-top">
        <span className="avatar">{m.avatar ? <img src={m.avatar} alt="" /> : m.emoji ? <Emo e={m.emoji} /> : (m.kind === "agent" ? <Px name="agent" /> : m.name.slice(0, 1).toUpperCase())}<span className="status-dot" /></span>
        <div className="mate-id">
          <h3>{m.name}{m.isMe && <span className="me-tag">you</span>}</h3>
          {m.kind === "human" && <small>{[m.role, m.sub].filter(Boolean).join(" · ")}</small>}
        </div>
        <span className={`lvl l-${L.level}`} title={LEVEL[L.level].tip}><Px name={LEVEL[L.level].icon} /> {LEVEL[L.level].label}</span>
      </div>
      {m.kind === "agent" && m.sub && <p className="mate-desc">{m.sub}</p>}
      <p className="mate-status"><StateIcon state={m.state} />{m.status}</p>

      <div className="mate-load" aria-label={`Workload: ${L.open} open`}>
        <div className="loadbar" aria-hidden>
          <i className="lb-doing" style={{ width: seg(L.doing) }} /><i className="lb-review" style={{ width: seg(L.review) }} /><i className="lb-queued" style={{ width: seg(L.queued) }} />
        </div>
        <small>
          {L.open ? <><Px name="doing" /> {L.doing} in progress · <Px name="eyes" /> {L.review} in review · <Px name="queued" /> {L.queued} queued{L.late ? <b className="late-txt"> · <Px name="dot-late" /> {L.late} late</b> : null}</> : "No open tasks"}
        </small>
      </div>

      <div className="mate-proj">
        {m.projects.length ? m.projects.map(p => (
          <Link key={p.id} className="chip" href={`/papan?ws=${team.workspaceId}&p=${p.id}`}>{p.icon ? <Emo e={p.icon} /> : <Px name="folder" />} {p.name}{p.open ? <small> · {p.open}</small> : null}</Link>
        )) : <span className="desc">Not on any project yet</span>}
      </div>

      {m.kind === "agent" && <Engine m={m} team={team} onSaved={onToast} />}

      <div className="mate-actions">
        {openTasks.length > 0 && <button className="btn sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide tasks" : <><Px name="todo" /> {openTasks.length} open task{openTasks.length > 1 ? "s" : ""}</>}</button>}
        {onChat && <button className="btn sm" onClick={onChat}><Px name="chat" /> Chat</button>}
        {m.kind === "human" && !m.isMe && <button className="btn sm" onClick={() => openChat(m.id)}><Px name="chat" /> Message</button>}
      </div>
      {open && (
        <div className="tasks">
          {openTasks.map(t => (
            <button key={t.id} className="tasklink" onClick={() => onOpenTask(t.id)}>
              <span className="t">{t.title}<small>{t.project ? <>{t.projectIcon ? <Emo e={t.projectIcon} /> : <Px name="folder" />} {t.project}</> : <><Px name="loose" /> No project</>}</small></span>
              <span className="meta">
                <span className={`pill p-${t.col === "in_review" ? "review" : t.col === "in_progress" ? "doing" : "queued"}`}>{COL_LABEL[t.col]}</span>
                {t.dueText && <span className={`due ${t.dueFlag ?? "ok"}`}>{t.dueText}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

const EMOJIS = ["🦊", "🐼", "🦉", "🐙", "🦄", "🐝", "🐢", "🦜", "🐳", "🦁", "🐨", "🤖"];

function Recruit({ team, onDone }: { team: Team; onDone: (msg: string | null) => void }) {
  const [kind, setKind] = useState<"human" | "agent" | null>(null);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"member" | "admin">("member");
  const [name, setName] = useState(""); const [emoji, setEmoji] = useState("🦊"); const [desc, setDesc] = useState("");
  const [instr, setInstr] = useState(""); const [rt, setRt] = useState(team.runtimes.find(r => r.usable && r.online)?.id ?? team.runtimes.find(r => r.usable)?.id ?? "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body = kind === "human" ? { ws: team.workspaceId, kind, email, role } : { ws: team.workspaceId, kind, name, emoji, role: desc, instructions: instr, runtimeId: rt };
      const j = await (await fetch("/api/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (j.error) throw new Error(j.error);
      onDone(j.message);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="scrim" onClick={() => onDone(null)} />
      <form className="modal" role="dialog" aria-modal="true" aria-label="Add to team" onSubmit={e => { e.preventDefault(); submit(); }}>
        <h2><Px name="sparkle" /> Add to the team</h2>
        {!kind ? (
          <>
            <p className="desc">Who do you want to add to {team.workspace}?</p>
            <div className="pickkind">
              <button type="button" onClick={() => setKind("human")}><span><Px name="mail" /></span><b>Invite a person</b><small>Send an email invite. They can assign tasks, review, and be @mentioned.</small></button>
              <button type="button" onClick={() => setKind("agent")}><span><Px name="agent" /></span><b>Create an AI agent</b><small>A new AI teammate with its own role, ready for tasks.</small></button>
            </div>
          </>
        ) : kind === "human" ? (
          <>
            <label className="sect" htmlFor="rc-email">Email</label>
            <input id="rc-email" className="input" type="email" autoFocus placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <div className="chiprow">
              <label className="radio"><input type="radio" checked={role === "member"} onChange={() => setRole("member")} /> Member</label>
              <label className="radio"><input type="radio" checked={role === "admin"} onChange={() => setRole("admin")} /> Admin (can manage team & settings)</label>
            </div>
            <p className="hint">They get an email invite and show up under People once they accept.</p>
          </>
        ) : (
          <>
            <label className="sect" htmlFor="rc-name">Agent name</label>
            <input id="rc-name" className="input" autoFocus placeholder="e.g. Rara Research" value={name} onChange={e => setName(e.target.value)} />
            <div className="sect">Avatar</div>
            <div className="emojipick">{EMOJIS.map(x => <button type="button" key={x} aria-pressed={emoji === x} onClick={() => setEmoji(x)} aria-label={x}><Emo e={x} /></button>)}</div>
            <label className="sect" htmlFor="rc-desc">What do they do?</label>
            <input id="rc-desc" className="input" placeholder="e.g. UX researcher who summarises user interviews" value={desc} onChange={e => setDesc(e.target.value)} />
            <details className="extra"><summary>Working instructions (optional)</summary>
              <textarea className="input" rows={5} placeholder="Leave empty to use default instructions based on the role." value={instr} onChange={e => setInstr(e.target.value)} />
            </details>
            <label className="sect" htmlFor="rc-rt">AI engine</label>
            <select id="rc-rt" className="input" value={rt} onChange={e => setRt(e.target.value)}>
              {team.runtimes.filter(r => r.usable).map(r => <option key={r.id} value={r.id}>{r.name}{r.online ? "" : " (offline)"}</option>)}
            </select>
            {!team.runtimes.some(r => r.usable) && <p className="note bad">None of the AI engines here are yours, so you can&apos;t create an agent yet. Connect your own laptop in Multica Desktop first.</p>}
          </>
        )}
        {err && <div className="note bad">{err}</div>}
        <div className="row">
          {kind && <button type="button" className="btn" onClick={() => { setKind(null); setErr(null); }}>‹ Back</button>}
          <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
          {kind && <button className="btn primary" disabled={busy || (kind === "human" ? !email.trim() : !name.trim() || !rt)}>
            {busy ? <><span className="spinner sm" /> Working…</> : kind === "human" ? <><Px name="mail" /> Send invite</> : <><Px name="sparkle" /> Create agent</>}</button>}
        </div>
      </form>
    </>
  );
}

export default function TeamView({ team }: { team: Team }) {
  const router = useRouter();
  const [refreshing, start] = useTransition();
  const refresh = () => start(() => router.refresh());
  const [tab, setTab] = useState<"all" | "human" | "agent">("all");
  const [task, setTask] = useState<string | null>(null);
  const [chat, setChat] = useState<Mate | null>(null);
  const [recruit, setRecruit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => start(() => router.refresh()), 60_000); return () => clearInterval(t); }, [router]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const busy = [...team.humans, ...team.agents].filter(m => m.load.level === "kewalahan" || m.load.late > 0);
  return (
    <>
      <header className="top">
        <div className="wrap hbar">
          <div className="brand"><h1><Px name="team" /> Team Members</h1><p className="pdesc">Who works here, how busy they are, and which projects they&apos;re on.</p></div>
          <div className="chiprow">
            <button className="btn primary" onClick={() => setRecruit(true)}>+ Add to team</button>
            <ThemeToggle />
            <span className="clock">{refreshing ? <><span className="spinner sm" /> Refreshing…</> : `${team.humans.length} ${team.humans.length === 1 ? "person" : "people"} · ${team.agents.length} agent${team.agents.length === 1 ? "" : "s"}`}</span>
          </div>
        </div>
      </header>
      <main className="wrap pagewide">
        {busy.length > 0 && <div className="note"><span><Px name="busy" /> Could use a hand: {busy.map(m => `${m.name} (${m.load.late ? `${m.load.late} late` : LEVEL[m.load.level].label})`).join(", ")}. Try moving some tasks to someone else.</span></div>}
        <div className="tabs" style={{ padding: 0 }}>
          {([["all", "Everyone"], ["human", `People (${team.humans.length})`], ["agent", `AI agents (${team.agents.length})`]] as const).map(([k, l]) => (
            <button key={k} className="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab !== "agent" && (
          <section className="crew" aria-label="People">
            <h2><Px name="person" /> People <small>set direction, review, and step in when mentioned</small></h2>
            <div className="crewgrid">{team.humans.map(m => <MateCard key={m.id} m={m} team={team} onOpenTask={setTask} onToast={setToast} />)}</div>
            {team.invites.length > 0 && (
              <div className="invites"><b><Px name="mail" /> Pending invites</b>
                <ul>{team.invites.map(i => <li key={i.email}>{i.email} <small>· {i.role} · sent {i.when}</small></li>)}</ul>
              </div>
            )}
          </section>
        )}
        {tab !== "human" && (
          <section className="crew" aria-label="AI agents">
            <h2><Px name="agent" /> AI agents <small>jump in as soon as they&apos;re called</small></h2>
            <div className="crewgrid">{team.agents.map(m => <MateCard key={m.id} m={m} team={team} onOpenTask={setTask} onChat={() => setChat(m)} onToast={msg => { setToast(msg); refresh(); }} />)}</div>
            {!team.agents.length && <p className="desc">No agents yet. Press “+ Add to team” to create the first one.</p>}
          </section>
        )}
      </main>
      {recruit && <Recruit team={team} onDone={msg => { setRecruit(false); if (msg) { setToast(msg); refresh(); } }} />}
      {task && <div className="scrim" onClick={() => setTask(null)} />}
      {task && <TaskPanel id={task} ws={team.workspaceId} onClose={() => setTask(null)} onChanged={refresh} />}
      {chat && <div className="scrim" onClick={() => setChat(null)} />}
      {chat && (
        <ChatPanel ws={team.workspaceId} agent={{ id: chat.id, name: chat.name, emoji: chat.emoji, role: chat.sub }}
          isMika={isManager(chat.name)} projectId={null} laptopOn={chat.runtimeOnline}
          onClose={() => setChat(null)} onMakeTask={() => { setChat(null); router.push(`/papan?ws=${team.workspaceId}`); }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
