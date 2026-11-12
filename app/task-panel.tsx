"use client";
// Task pop-up: the agent's output on the left, "your part" on the right (summary, question cards, instructions, actions).
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskDetail } from "@/lib/detail";
import FilePicker, { uploadAll } from "./file-picker";
import FilePreview, { kindOf, ICON } from "./file-preview";
import { Px } from "./pixel-icon";
import MentionBox, { mentionLink, keepMentionUrl } from "./mention-box";
import { encodeMentions, type Mentionable } from "@/lib/mentions";
import { answersToText } from "@/lib/digest";

const md = (text: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={keepMentionUrl} components={{ a: mentionLink }}>{text}</ReactMarkdown>;
const POLL_MS = 4000;
type Tab = "chat" | "files" | "brief";

export default function TaskPanel({ id, ws, onClose, onChanged }: { id: string; ws: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<TaskDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<{ text: string; files: string[] } | null>(null);
  const [watchUntil, setWatchUntil] = useState(0);
  const [tab, setTab] = useState<Tab>("chat");
  const [pick, setPick] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState<null | "approve" | "done">(null);
  const body = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const seenKey = `kantor-seen:${id}`;
  const markSeen = (ids: string[]) => {
    const next = new Set([...(seen ?? []), ...ids]); setSeen(next);
    try { localStorage.setItem(seenKey, JSON.stringify([...next])); } catch { /* browser storage unavailable */ }
  };

  const sig = useRef("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/task/${id}?ws=${ws}`); const j = await r.json();
    if (j.error) throw new Error(j.error);
    setD(j);
    // Refresh the office only when something changed (new message / status).
    const now = `${j.messages.length}|${j.status}|${j.live.state}`;
    if (sig.current && sig.current !== now) onChanged();
    sig.current = now;
    return j as TaskDetail;
  }, [id, ws, onChanged]);

  useEffect(() => { setD(null); setErr(null); lastCount.current = 0; load().catch(e => setErr(String(e))); }, [load]);
  useEffect(() => { setAnswers({}); }, [d?.digest?.messageId]);

  // Files you have already seen (stored in this browser). The first time a task opens, everything counts as seen.
  useEffect(() => {
    if (!d || seen) return;
    let stored: string[] | null = null;
    try { const raw = localStorage.getItem(seenKey); stored = raw ? JSON.parse(raw) : null; } catch { stored = null; }
    if (stored) setSeen(new Set(stored)); else markSeen(d.artifacts.map(a => a.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  useEffect(() => {
    if (tab === "files" && d && seen && d.artifacts.some(a => !seen.has(a.id))) {
      setFreshIds(new Set(d.artifacts.filter(a => !seen.has(a.id)).map(a => a.id)));
      markSeen(d.artifacts.map(a => a.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, d]);

  // Always open at the latest message, and follow new ones.
  useEffect(() => {
    const n = (d?.messages.length ?? 0) + (pending ? 1 : 0);
    if (n !== lastCount.current && body.current && tab === "chat") {
      lastCount.current = n;
      requestAnimationFrame(() => body.current && (body.current.scrollTop = body.current.scrollHeight));
    }
  }, [d, pending, tab]);

  const watching = !!d && (d.live.state === "running" || d.live.state === "queued" || Date.now() < watchUntil);
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => { load().catch(() => {}); }, POLL_MS);
    return () => clearInterval(t);
  }, [watching, load]);

  const answerText = d?.digest?.open ? answersToText(d.digest.questions, answers) : "";
  const answered = d?.digest?.open ? d.digest.questions.filter(q => answers[q.n]?.trim()).length : 0;

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null);
    const typed = encodeMentions(text, picked).trim();
    const out = action === "rename" ? extra.text ?? "" : [answerText, typed].filter(Boolean).join("\n\n");
    const shown = action === "revise" || action === "reply" ? out : "";
    if (shown || files.length) setPending({ text: shown, files: files.map(f => f.name) });
    try {
      const fileIds = files.length ? await uploadAll(files, ws, id) : [];
      const r = await fetch(`/api/task/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, action, ...extra, text: out, files: fileIds }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setD(j); setText(""); setPicked([]); setAnswers({}); setLink(""); setFiles([]); setConfirm(null); onChanged();
      if (action === "revise" || action === "reply" || action === "rerun") setWatchUntil(Date.now() + 3 * 60_000);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); setPending(null); }
  }

  const jumpTo = (mid: string) => {
    setTab("chat");
    requestAnimationFrame(() => document.getElementById(`m-${mid}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const head = (
    <div className="tp-head">
      <span className="avatar">{d?.assignee.emoji ?? <Px name={d?.assignee.kind === "member" ? "person" : "file"} />}</span>
      <div className="meta">
        {renaming ? (
          <form onSubmit={e => { e.preventDefault(); act("rename", { text: newName }).then(() => setRenaming(false)); }} style={{ display: "flex", gap: 6 }}>
            <input id="rename" className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            <button className="btn sm primary" disabled={!newName.trim() || !!busy}>Save</button>
            <button type="button" className="btn sm" onClick={() => setRenaming(false)}>Cancel</button>
          </form>
        ) : <h2>{d?.title ?? "Loading…"}</h2>}
        <div className="role">{d ? [d.assignee.name ?? "Unassigned", d.project ?? "No project"].join(" · ") : ""}
          {d?.dueText && <span className={`due ${d.dueFlag ?? "ok"}`}>{d.dueFlag === "late" ? <><Px name="dot-late" /> </> : d.dueFlag === "risk" ? <><Px name="dot-risk" /> </> : d.dueFlag === "done" ? "✓ " : <><Px name="calendar" /> </>}{d.dueText}</span>}
        </div>
      </div>
      <button className="x" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );

  if (!d) return (
    <div className="taskmodal" role="dialog" aria-modal="true">{head}
      <div className="tp-loading">{err ? <div className="note bad">{err}</div> : <div className="loading"><span className="spinner" /> Opening task…</div>}</div>
    </div>
  );

  const busyLabel: Record<string, string> = { approve: "Approving…", revise: "Sending changes…", reply: "Sending…", done: "Saving…", rename: "Saving…", rerun: "Asking the agent to retry…" };
  const fresh = seen ? d.artifacts.filter(a => !seen.has(a.id)).length : 0;
  const canSend = !!text.trim() || files.length > 0 || answered > 0;
  const dg = d.digest;

  return (
    <div className="taskmodal" role="dialog" aria-modal="true" aria-label={d.title}>
      {head}
      <div className="tp-grid">
        {/* ---- Left: what the agent produced ---- */}
        <section className="tp-out" aria-label="Agent output">
          <div className="tp-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}><Px name="chat" /> Conversation <small>{d.messages.length}</small></button>
            {d.artifacts.length > 0 && <button role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}><Px name="folder" /> Files <small>{d.artifacts.length}</small>{fresh > 0 && <span className="newbadge">{fresh} new</span>}</button>}
            {d.brief && <button role="tab" aria-selected={tab === "brief"} onClick={() => setTab("brief")}><Px name="todo" /> Brief</button>}
          </div>
          <div className="tp-scroll" ref={body}>
            {tab === "chat" && (
              <div className="thread">
                {d.messages.length === 0 && !pending && <p className="desc">No messages yet. The agent will post results here.</p>}
                {d.messages.map(m => (
                  <div key={m.id} id={`m-${m.id}`} className={`msg ${m.whoKind === "member" ? "me" : "bot"} ${dg?.messageId === m.id ? "hl" : ""}`}>
                    <div className="from"><span>{m.emoji ? `${m.emoji} ` : ""}{m.who}</span><span>{m.when}</span></div>
                    {m.text && <div className="md">{md(m.text)}</div>}
                    {(m.images.length > 0 || m.files.length > 0) && (
                      <div className="minifiles">
                        {m.images.map(f => <button key={f.id} className="mini-img" onClick={() => { setPick(f.id); setTab("files"); }} title={`View ${f.name}`}><img src={f.url} alt={f.name} /></button>)}
                        {m.files.map(f => <button key={f.id} className="chip" onClick={() => { setPick(f.id); setTab("files"); }}><Px name="clip" /> {f.name}</button>)}
                      </div>
                    )}
                  </div>
                ))}
                {pending && (
                  <div className="msg me sending">
                    <div className="from"><span>You</span><span><span className="spinner sm" /> sending…</span></div>
                    {pending.text && <div className="md">{md(pending.text)}</div>}
                    {pending.files.length > 0 && <div className="chips">{pending.files.map(f => <span key={f} className="chip"><Px name="clip" /> {f}</span>)}</div>}
                  </div>
                )}
                {d.live.state !== "idle" && (
                  <div className={`live live-${d.live.state}`} role="status">
                    {d.live.state === "running" || d.live.state === "queued" ? <span className="dots"><i /><i /><i /></span> : null}{d.live.label}
                  </div>
                )}
                {d.live.state === "idle" && Date.now() < watchUntil && (
                  <div className="live live-queued" role="status"><span className="dots"><i /><i /><i /></span>Sent. Waiting for {d.assignee.name ?? "the agent"} to respond…</div>
                )}
              </div>
            )}
            {tab === "files" && (
              <div className="pinpanel flat">
                <div className="tiles">
                  {d.artifacts.map((a, i) => (
                    <button key={a.id} className="tile" aria-pressed={(pick ?? d.artifacts[0].id) === a.id} onClick={() => setPick(a.id)} title={a.name}>
                      {a.image ? <img src={a.url} alt="" /> : <span className="tile-icon"><Px name={ICON[kindOf(a.name)]} /></span>}
                      {freshIds.has(a.id) && <span className="newbadge tile-new">New</span>}
                      <span className="tile-name">{a.name}</span>
                      <small>{i === 0 ? "Latest · " : ""}{a.from} · {a.when}</small>
                    </button>
                  ))}
                </div>
                {(() => { const a = d.artifacts.find(x => x.id === (pick ?? d.artifacts[0].id)) ?? d.artifacts[0]; return <FilePreview key={a.id} f={a} />; })()}
              </div>
            )}
            {tab === "brief" && <div className="md tp-brief">{md(d.brief)}</div>}
            <details className="extra">
              <summary>More info</summary>
              <p className="desc">Code: {d.key} · Original title: {d.originalTitle}</p>
              <div className="chiprow">
                <button className="btn sm" onClick={() => { setNewName(d.title); setRenaming(true); }}>Rename</button>
                <a className="btn sm" href={d.url} target="_blank" rel="noreferrer">Open in Multica</a>
              </div>
            </details>
          </div>
        </section>

        {/* ---- Right: your part ---- */}
        <section className="tp-you" aria-label="Your part">
          <div className="tp-scroll">
            <div className={`situation m-${d.mode}`}><b>{d.situation}</b></div>

            {dg && dg.summary.length > 0 && (
              <div className="digest">
                <div className="dg-head"><b><Px name="sparkle" /> Summary</b><small>from {dg.from} · {dg.when}</small></div>
                <ul>{dg.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <button className="more" onClick={() => jumpTo(dg.messageId)}>Read the full output ›</button>
              </div>
            )}

            {dg?.open && dg.questions.length > 0 && d.mode !== "closed" && (
              <div className="qcards">
                <div className="dg-head"><b><Px name="person" /> {dg.from} needs your answer</b><small>{answered}/{dg.questions.length} answered</small></div>
                {dg.questions.map(q => {
                  const a = answers[q.n] ?? "";
                  const set = (v: string) => setAnswers(cur => ({ ...cur, [q.n]: v }));
                  return (
                    <div key={q.n} className={`qcard ${a.trim() ? "done" : ""}`}>
                      <div className="qc-q"><span className="qc-n">{q.n}</span><span>{q.text}</span></div>
                      {q.options.length > 0 && (
                        <div className="qc-opts">{q.options.map(o => <button key={o} type="button" aria-pressed={a === o} onClick={() => set(a === o ? "" : o)}>{o}</button>)}</div>
                      )}
                      <input className="input" placeholder={q.options.length ? "Or type your own answer…" : "Your answer…"} value={q.options.includes(a) ? "" : a} onChange={e => set(e.target.value)} />
                    </div>
                  );
                })}
              </div>
            )}

            {d.mode !== "closed" && (
              <div className="tp-compose">
                {err && <div className="note bad">{err}</div>}
                {busy ? <div className="loading"><span className="spinner" /> {busyLabel[busy] ?? "Working…"}</div>
                  : confirm ? (
                    <div className="confirm">
                      <span>{confirm === "approve" ? "Approve and close this task?" : "Mark as done? The next agent can continue."}</span>
                      <div className="row">
                        <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
                        <button className="btn primary" onClick={() => act(confirm, confirm === "done" ? { link } : {})}>Yes, continue</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {d.mode === "human" && (
                        <>
                          <label htmlFor="proof" className="sect">Link to the result (optional)</label>
                          <input id="proof" className="input" type="url" placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} />
                        </>
                      )}
                      <label htmlFor="msg" className="sect">{dg?.open && dg.questions.length ? "Anything else? (optional)" : d.mode === "review" ? "Feedback for the agent" : d.mode === "human" ? "Note (optional)" : "Instructions"}</label>
                      <MentionBox id="msg" value={text} onChange={setText} people={d.people} picked={picked} onPick={setPicked}
                        onPaste={e => { const p = [...e.clipboardData.files]; if (p.length) { e.preventDefault(); setFiles([...files, ...p]); } }}
                        placeholder={d.mode === "review" ? "Ask for changes, or leave empty to approve. Type @ to bring someone in." : "Type a message… Type @ to bring someone in."} />
                      {picked.some(p => text.includes("@" + p.name)) && (
                        <p className="hint"><Px name="mention" /> Mentioning: {picked.filter(p => text.includes("@" + p.name)).map(p => `${p.name} (${p.kind === "agent" ? "will reply right away" : "gets a notification"})`).join(", ")}</p>
                      )}
                      <FilePicker files={files} onChange={setFiles} />
                      <div className="row">
                        {!d.assignee.online && d.assignee.kind === "agent" && <span className="hint"><Px name="moon" /> Laptop off: the agent picks this up when it&apos;s back on.</span>}
                        {d.mode === "review" && <>
                          <button className="btn" disabled={!canSend} onClick={() => act("revise")}><Px name="edit" /> Request changes</button>
                          <button className="btn primary" onClick={() => setConfirm("approve")}><Px name="done" /> Approve</button>
                        </>}
                        {d.mode === "human" && <>
                          <button className="btn" onClick={onClose}><Px name="pause" /> Not yet</button>
                          <button className="btn primary" onClick={() => setConfirm("done")}><Px name="done" /> Done</button>
                        </>}
                        {(d.mode === "working" || d.mode === "waiting") && (
                          <button className="btn primary" disabled={!canSend} onClick={() => act("reply")}>{answered ? `Send ${answered} answer${answered > 1 ? "s" : ""}` : "Send"}</button>
                        )}
                      </div>
                    </>
                  )}
              </div>
            )}
            {d.mode === "closed" && <p className="desc">This task is closed. Reopen it in Multica if you need more work on it.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
