"use client";
// Person-to-person chat: a list of teammates, then the conversation with one of them.
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DmMessage, DmPerson } from "@/lib/dm";
import { mentionLink, keepMentionUrl } from "./mention-box";
import { Px, PxSpan, rehypePx } from "./pixel-icon";

const md = (t: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypePx]} urlTransform={keepMentionUrl} components={{ a: mentionLink, span: PxSpan }}>{t}</ReactMarkdown>;
const POLL_MS = 5000;

/** Ask the sidebar to open a chat with someone (used by the Message buttons on people cards). */
export const openChat = (userId: string) => dispatchEvent(new CustomEvent("kantor:dm", { detail: { userId } }));

export default function Messages({ ws, start, onClose, onUnread }: { ws: string; start: string | null; onClose: () => void; onUnread: (n: number) => void }) {
  const [people, setPeople] = useState<DmPerson[] | null>(null);
  const [withId, setWithId] = useState<string | null>(start);
  const [msgs, setMsgs] = useState<DmMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const other = people?.find(p => p.userId === withId) ?? null;

  const loadPeople = useCallback(async () => {
    const j = await (await fetch(`/api/dm?ws=${ws}`)).json();
    if (j.error) throw new Error(j.error);
    setPeople(j.people); onUnread(j.unread);
  }, [ws, onUnread]);
  const loadThread = useCallback(async (id: string) => {
    const j = await (await fetch(`/api/dm/${id}?ws=${ws}`)).json();
    if (j.error) throw new Error(j.error);
    setMsgs(j.messages);
  }, [ws]);

  useEffect(() => { setWithId(start); }, [start]);
  useEffect(() => { loadPeople().catch(e => setErr(String(e.message ?? e))); }, [loadPeople]);
  useEffect(() => {
    if (!withId) { setMsgs(null); return; }
    setMsgs(null); setErr(null);
    // Opening a chat marks it read, so refresh the unread counts afterwards.
    loadThread(withId).then(() => loadPeople()).catch(e => setErr(String(e.message ?? e)));
    const t = setInterval(() => loadThread(withId).catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [withId, loadThread, loadPeople]);
  useEffect(() => { requestAnimationFrame(() => body.current && (body.current.scrollTop = body.current.scrollHeight)); }, [msgs, sending]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (withId && !start) setWithId(null); else onClose(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [withId, start, onClose]);

  async function send() {
    if (!withId || !text.trim()) return;
    const t = text; setSending(t); setText(""); setErr(null);
    try {
      const j = await (await fetch(`/api/dm/${withId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, text: t }) })).json();
      if (j.error) throw new Error(j.error);
      setMsgs(j.messages); loadPeople().catch(() => {});
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setText(t); }
    finally { setSending(null); }
  }

  const initial = (n: string) => n.trim().slice(0, 1).toUpperCase();

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer dmdrawer" role="dialog" aria-modal="true" aria-label="Messages">
        <div className="dhead">
          {withId ? (
            <>
              <button className="x" onClick={() => setWithId(null)} aria-label="Back to all messages"><Px name="back" size="1em" /></button>
              <span className="avatar dm-av">{initial(other?.name ?? "?")}</span>
              <div className="meta"><h2>{other?.name ?? "Chat"}</h2><div className="role">{other?.email ?? ""}</div></div>
            </>
          ) : (
            <>
              <span className="avatar"><Px name="chat" /></span>
              <div className="meta"><h2>Messages</h2><div className="role">Chat with the people on your team</div></div>
            </>
          )}
          <button className="x" onClick={onClose} aria-label="Close"><Px name="close" size="1em" /></button>
        </div>

        {!withId ? (
          <div className="dbody">
            {err && <div className="note bad">{err}</div>}
            {!people && !err && <div className="loading"><span className="spinner" /> Loading…</div>}
            {people && !people.length && <p className="desc">Nobody else is in this workspace yet. Invite someone from Team Members.</p>}
            <ul className="dmlist">
              {people?.map(p => (
                <li key={p.userId}>
                  <button className={`dmrow ${p.unread ? "unread" : ""}`} onClick={() => setWithId(p.userId)}>
                    <span className="avatar dm-av">{initial(p.name)}</span>
                    <span className="dm-t"><b>{p.name}</b><small>{p.last ? `${p.last.mine ? "You: " : ""}${p.last.text}` : <>Say hi <Px name="wave" /></>}</small></span>
                    <span className="dm-when">{p.last?.when}{p.unread > 0 && <span className="sl-badge">{p.unread}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="dbody" ref={body}>
              {err && <div className="note bad">{err}</div>}
              {msgs === null && !err && <div className="loading"><span className="spinner" /> Opening chat…</div>}
              {msgs && msgs.length === 0 && !sending && <p className="desc">No messages yet. Say hi to {other?.name ?? "them"} <Px name="wave" /></p>}
              <div className="thread">
                {msgs?.map(m => (
                  <div key={m.id} className={`msg ${m.mine ? "me" : "bot"}`}>
                    <div className="from"><span>{m.who}</span><span>{m.when}</span></div>
                    <div className="md">{md(m.text)}</div>
                  </div>
                ))}
                {sending && <div className="msg me sending"><div className="from"><span>You</span><span><span className="spinner sm" /> sending…</span></div><div className="md">{md(sending)}</div></div>}
              </div>
            </div>
            <div className="compose">
              <textarea id="dm-msg" value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${other?.name ?? ""}…`} autoFocus
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <div className="row">
                <span className="hint">Enter to send · Shift+Enter for a new line · {other?.name?.split(/\s+/)[0] ?? "They"} gets a notification</span>
                <button className="btn primary" disabled={!text.trim() || !!sending} onClick={send}>Send</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
