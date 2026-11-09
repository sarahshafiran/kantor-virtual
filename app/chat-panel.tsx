"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FilePicker, { uploadAll } from "./file-picker";
import FilePreview from "./file-preview";

type Session = { id: string; title: string; updatedAt: string; unread: number; last: string };
type Msg = { id: string; mine: boolean; text: string; when: string; failed: string | null; files: { id: string; name: string; url: string }[] };

const md = (t: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{t}</ReactMarkdown>;

/** Ngobrol santai dengan satu worker: tidak menghasilkan apa-apa sampai kamu minta. */
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
  useEffect(() => { requestAnimationFrame(() => body.current && (body.current.scrollTop = body.current.scrollHeight)); }, [msgs, sending, working]);

  async function send(content = text) {
    if (!content.trim() && !files.length) return;
    setErr(null); setSending(content);
    try {
      let id = sid;
      if (!id) {
        const title = content.trim().split("\n")[0].slice(0, 60) || "Obrolan baru";
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
    <div className="drawer wide chat" role="dialog" aria-modal="true" aria-label={`Ngobrol dengan ${agent.name}`}>
      <div className="dhead">
        <span className="avatar">{agent.emoji ?? "💬"}</span>
        <div className="meta"><h2>Ngobrol dengan {agent.name}</h2><div className="role">Bebas diskusi. Tidak ada yang dikerjakan sampai kamu minta.</div></div>
        <button className="x" onClick={onClose} aria-label="Tutup">✕</button>
      </div>

      <div className="chatbar">
        <select id="chat-session" className="input" value={sid ?? ""} onChange={e => setSid(e.target.value || null)} aria-label="Pilih obrolan">
          {(sessions ?? []).map(s => <option key={s.id} value={s.id}>{s.title}{s.unread ? ` (${s.unread} baru)` : ""}</option>)}
          {!sid && <option value="">Obrolan baru</option>}
        </select>
        <button className="btn sm" onClick={() => { setSid(null); setMsgs([]); }}>+ Obrolan baru</button>
      </div>

      <div className="dbody" ref={body}>
        {err && <div className="note bad">{err}</div>}
        {msgs === null ? <div className="loading"><span className="spinner" /> Membuka obrolan…</div> : (
          <div className="thread">
            {msgs.length === 0 && !sending && (
              <div className="note"><span>Mulai saja ngobrol dengan {agent.name}: lempar ide, minta pendapat, atau minta contoh. {isMika ? "Mika tahu kondisi semua worker, jadi bisa membantu memecah ide jadi task untuk tim." : ""}</span></div>
            )}
            {msgs.map(m => (
              <div key={m.id} className={`msg ${m.mine ? "me" : "bot"}`}>
                <div className="from"><span>{m.mine ? "Kamu" : `${agent.emoji ?? ""} ${agent.name}`}</span><span>{m.when}</span></div>
                {m.text && <div className="md">{md(m.text)}</div>}
                {m.failed && <div className="note bad">{m.failed}</div>}
                {m.files.map(f => <FilePreview key={f.id} f={f} />)}
              </div>
            ))}
            {sending !== null && <div className="msg me sending"><div className="from"><span>Kamu</span><span><span className="spinner sm" /> mengirim…</span></div>{sending && <div className="md">{md(sending)}</div>}</div>}
            {working && sending === null && (
              <div className="live live-running" role="status"><span className="dots"><i /><i /><i /></span>
                {laptopOn ? `${agent.name} sedang mengetik…` : `🌙 Laptop mati. ${agent.name} menjawab saat laptop menyala.`}</div>
            )}
          </div>
        )}
      </div>

      <div className="compose">
        {lastReply && (
          <div className="chiprow proceed">
            <span className="hint">Sudah oke?</span>
            <button className="btn sm" onClick={() => onMakeTask(lastReply)}>📋 Jadikan task untuk {agent.name}</button>
            {isMika && <button className="btn sm" disabled={!!sending || working} onClick={() => send("Oke, proceed. Tolong pecah hasil diskusi kita jadi task untuk worker yang tepat (lengkap dengan tenggat dan siapa yang perlu review), lalu buat task-nya. Setelah itu sebutkan daftar task yang kamu buat.")}>🧩 Minta Mika pecah jadi task tim</button>}
          </div>
        )}
        <textarea id="chat-msg" value={text} onChange={e => setText(e.target.value)} placeholder={`Tulis pesan untuk ${agent.name}…`}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          onPaste={e => { const p = [...e.clipboardData.files]; if (p.length) { e.preventDefault(); setFiles([...files, ...p]); } }} />
        <FilePicker files={files} onChange={setFiles} />
        <div className="row">
          <span className="hint">Cmd+Enter untuk kirim</span>
          <button className="btn primary" disabled={(!text.trim() && !files.length) || sending !== null} onClick={() => send()}>{sending !== null ? <><span className="spinner sm" /> Mengirim…</> : "Kirim"}</button>
        </div>
      </div>
    </div>
  );
}
