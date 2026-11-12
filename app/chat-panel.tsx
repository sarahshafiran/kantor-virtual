"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FilePicker, { uploadAll } from "./file-picker";
import FilePreview from "./file-preview";
import { Px, type PxName } from "./pixel-icon";

type Session = { id: string; title: string; updatedAt: string; unread: number; last: string };
type Msg = { id: string; mine: boolean; text: string; when: string; failed: string | null; files: { id: string; name: string; url: string }[] };

const md = (t: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{t}</ReactMarkdown>;

/** Name of the office-manager agent. Set per install with NEXT_PUBLIC_KANTOR_MANAGER. */
export const MANAGER = process.env.NEXT_PUBLIC_KANTOR_MANAGER?.trim() || "Mika";
export const isManager = (name: string) => name.trim().toLowerCase() === MANAGER.toLowerCase();

/** What the office manager can help with, shown as a reminder in the chat. */
const MIKA_CAN: { icon: PxName; label: string; hint: string; prompt: string }[] = [
  { icon: "idea", label: "Brainstorm", hint: "Throw in a rough idea, we shape it together", prompt: "I want to brainstorm about: " },
  { icon: "folder", label: "Start a project", hint: "A new room with a plan to go with it", prompt: "Help me set up a new project. The goal: " },
  { icon: "todo", label: "Create a task", hint: `${MANAGER} picks the agent and due date`, prompt: "Please create a new task: " },
  { icon: "hire", label: "Hire an agent", hint: "A new agent with a specific role", prompt: "I need a new agent for this role: " },
  { icon: "skill", label: "Teach an agent", hint: "Add a skill or change instructions", prompt: "Please add this skill to an agent: " },
  { icon: "clock", label: "Set up a routine", hint: "A task that runs every day or week", prompt: "I want a routine that runs automatically: " },
  { icon: "chart", label: "Team check-in", hint: "Who is busy, what is late, what is stuck", prompt: "How is the team doing right now? Anything late, stuck, or waiting on my decision?" },
];

/** Casual chat with one agent: nothing gets done until you ask for it. */
export default function ChatPanel({ ws, agent, isMika, projectId, laptopOn, onClose, onMakeTask }: {
  ws: string; agent: { id: string; name: string; emoji: string | null; role: string };
  isMika: boolean; projectId: string | null; laptopOn: boolean;
  onClose: () => void; onMakeTask: (detail: string) => void;
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [working, setWorking] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch(`/api/chat?ws=${ws}&agent=${agent.id}`).then(r => r.json()).then(j => {
      if (j.error) throw new Error(j.error);
      setSessions(j.sessions); if (j.sessions[0]) setSid(j.sessions[0].id); else setMsgs([]);
    }).catch(e => setErr(String(e.message ?? e)));
  }, [ws, agent.id]);

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/chat/${id}?ws=${ws}`); const j = await r.json();
    if (j.error) throw new Error(j.error);
    setMsgs(j.messages); setWorking(j.working);
  }, [ws]);
  useEffect(() => { if (sid) { setMsgs(null); load(sid).catch(e => setErr(String(e.message ?? e))); } }, [sid, load]);
  useEffect(() => {
    if (!sid || !working) return;
    const t = setInterval(() => load(sid).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [sid, working, load]);
  useEffect(() => { requestAnimationFrame(() => body.current && (body.current.scrollTop = body.current.scrollHeight)); }, [msgs, sending, working, showHelp]);

  async function send(content = text) {
    if (!content.trim() && !files.length) return;
    setErr(null); setSending(content);
    try {
      let id = sid;
      if (!id) {
        const title = content.trim().split("\n")[0].slice(0, 60) || "New chat";
        const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, agentId: agent.id, title, projectId }) });
        const j = await r.json(); if (j.error) throw new Error(j.error);
        id = j.id as string; setSid(id); setSessions(s => [{ id: id!, title, updatedAt: new Date().toISOString(), unread: 0, last: "" }, ...(s ?? [])]);
      }
      const fileIds = files.length ? await uploadAll(files, ws) : [];
      const r = await fetch(`/api/chat/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, text: content, files: fileIds }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      setMsgs(j.messages); setWorking(true); setText(""); setFiles([]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSending(null); }
  }

  const lastReply = [...(msgs ?? [])].reverse().find(m => !m.mine && m.text)?.text ?? "";

  return (
    <div className="drawer wide chat" role="dialog" aria-modal="true" aria-label={`Chat with ${agent.name}`}>
      <div className="dhead">
        <span className="avatar">{agent.emoji ?? <Px name="chat" />}</span>
        <div className="meta"><h2>Chat with {agent.name}</h2><div className="role">Talk freely. Nothing gets done until you ask.</div></div>
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="chatbar">
        <select id="chat-session" className="input" value={sid ?? ""} onChange={e => setSid(e.target.value || null)} aria-label="Pick a chat">
          {(sessions ?? []).map(s => <option key={s.id} value={s.id}>{s.title}{s.unread ? ` (${s.unread} new)` : ""}</option>)}
          {!sid && <option value="">New chat</option>}
        </select>
        <button className="btn sm" onClick={() => { setSid(null); setMsgs([]); }}>+ New chat</button>
        {isMika && <button className="btn sm" onClick={() => setShowHelp(h => !h)} aria-expanded={showHelp}><Px name="idea" /> What can {MANAGER} do?</button>}
      </div>

      <div className="dbody" ref={body}>
        {err && <div className="note bad">{err}</div>}
        {msgs === null ? <div className="loading"><span className="spinner" /> Opening chat…</div> : (
          <div className="thread">
            {msgs.length === 0 && !sending && !isMika && (
              <div className="note"><span>Start chatting with {agent.name}: share an idea, ask for an opinion, or ask for an example.</span></div>
            )}
            {msgs.map(m => (
              <div key={m.id} className={`msg ${m.mine ? "me" : "bot"}`}>
                <div className="from"><span>{m.mine ? "You" : `${agent.emoji ?? ""} ${agent.name}`}</span><span>{m.when}</span></div>
                {m.text && <div className="md">{md(m.text)}</div>}
                {m.failed && <div className="note bad">{m.failed}</div>}
                {m.files.map(f => <FilePreview key={f.id} f={f} />)}
              </div>
            ))}
            {sending !== null && <div className="msg me sending"><div className="from"><span>You</span><span><span className="spinner sm" /> sending…</span></div>{sending && <div className="md">{md(sending)}</div>}</div>}
            {isMika && !sending && (msgs.length === 0 || showHelp) && (
              <div className="mikahelp">
                <b><Px name="wave" /> Hi! Here is what we can do together:</b>
                <div className="mh-grid">
                  {MIKA_CAN.map(c => (
                    <button key={c.label} className="mh-item" onClick={() => { setText(c.prompt); setShowHelp(false); document.getElementById("chat-msg")?.focus(); }}>
                      <span className="mh-ic"><Px name={c.icon} /></span><span><b>{c.label}</b><small>{c.hint}</small></span>
                    </button>
                  ))}
                </div>
                <small className="mh-foot">Pick one to start. You can edit the message before sending it.</small>
              </div>
            )}
            {working && sending === null && (
              <div className="live live-running" role="status"><span className="dots"><i /><i /><i /></span>
                {laptopOn ? `${agent.name} is typing…` : <><Px name="moon" /> Laptop off. {agent.name} replies when it is back on.</>}</div>
            )}
          </div>
        )}
      </div>

      <div className="compose">
        {lastReply && (
          <div className="chiprow proceed">
            <span className="hint">Happy with it?</span>
            <button className="btn sm" onClick={() => onMakeTask(lastReply)}><Px name="todo" /> Turn into a task for {agent.name}</button>
            {isMika && <button className="btn sm" disabled={!!sending || working} onClick={() => send("OK, proceed. Please split what we discussed into tasks for the right agents (with due dates and who should review), create them, then list the tasks you created.")}><Px name="todo" /> Ask {MANAGER} to split it into team tasks</button>}
          </div>
        )}
        <textarea id="chat-msg" value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${agent.name}…`}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          onPaste={e => { const p = [...e.clipboardData.files]; if (p.length) { e.preventDefault(); setFiles([...files, ...p]); } }} />
        <FilePicker files={files} onChange={setFiles} />
        <div className="row">
          <span className="hint">Cmd+Enter to send</span>
          <button className="btn primary" disabled={(!text.trim() && !files.length) || sending !== null} onClick={() => send()}>{sending !== null ? <><span className="spinner sm" /> Sending…</> : "Send"}</button>
        </div>
      </div>
    </div>
  );
}
