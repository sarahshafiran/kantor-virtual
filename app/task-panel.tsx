"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskDetail } from "@/lib/detail";
import FilePicker, { uploadAll } from "./file-picker";

const md = (text: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{text}</ReactMarkdown>;
const POLL_MS = 4000;

export default function TaskPanel({ id, ws, onClose, onChanged }: { id: string; ws: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<TaskDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<{ text: string; files: string[] } | null>(null);
  const [watchUntil, setWatchUntil] = useState(0);
  const [showBrief, setShowBrief] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState<null | "approve" | "done">(null);
  const body = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const sig = useRef("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/task/${id}?ws=${ws}`); const j = await r.json();
    if (j.error) throw new Error(j.error);
    setD(j);
    // Kantor diperbarui hanya kalau ada yang berubah (pesan baru / status berubah).
    const now = `${j.messages.length}|${j.status}|${j.live.state}`;
    if (sig.current && sig.current !== now) onChanged();
    sig.current = now;
    return j as TaskDetail;
  }, [id, ws, onChanged]);

  useEffect(() => {
    setD(null); setErr(null); lastCount.current = 0;
    load().catch(e => setErr(String(e)));
  }, [load]);

  // Selalu buka di percakapan terakhir, dan turun lagi setiap ada pesan baru.
  useEffect(() => {
    const n = (d?.messages.length ?? 0) + (pending ? 1 : 0);
    if (n !== lastCount.current && body.current) {
      lastCount.current = n;
      requestAnimationFrame(() => body.current && (body.current.scrollTop = body.current.scrollHeight));
    }
  }, [d, pending]);

  // Pantau terus selama worker sedang/akan bekerja, atau sebentar setelah kamu mengirim sesuatu.
  const watching = !!d && (d.live.state === "running" || d.live.state === "queued" || Date.now() < watchUntil);
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => { load().catch(() => {}); }, POLL_MS);
    return () => clearInterval(t);
  }, [watching, load]);

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null);
    const sending = action === "revise" || action === "reply" ? text : "";
    if (sending || files.length) setPending({ text: sending, files: files.map(f => f.name) });
    try {
      const fileIds = files.length ? await uploadAll(files, ws, id) : [];
      const r = await fetch(`/api/task/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, action, text, files: fileIds, ...extra }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setD(j); setText(""); setLink(""); setFiles([]); setConfirm(null); onChanged();
      if (action === "revise" || action === "reply" || action === "rerun") setWatchUntil(Date.now() + 3 * 60_000);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); setPending(null); }
  }

  const head = (
    <div className="dhead">
      <span className="avatar">{d?.assignee.emoji ?? (d?.assignee.kind === "member" ? "🙋" : "📄")}</span>
      <div className="meta">
        {renaming ? (
          <form onSubmit={e => { e.preventDefault(); act("rename", { text: newName }).then(() => setRenaming(false)); }} style={{ display: "flex", gap: 6 }}>
            <input id="rename" className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            <button className="btn sm primary" disabled={!newName.trim() || !!busy}>Simpan</button>
            <button type="button" className="btn sm" onClick={() => setRenaming(false)}>Batal</button>
          </form>
        ) : (
          <h2>{d?.title ?? "Memuat…"}</h2>
        )}
        <div className="role">{d ? [d.assignee.name, d.project].filter(Boolean).join(" · ") : ""}</div>
      </div>
      <button className="x" onClick={onClose} aria-label="Tutup">✕</button>
    </div>
  );

  if (!d) return (
    <div className="drawer wide" role="dialog" aria-modal="true">{head}
      <div className="dbody">{err ? <div className="note bad">{err}</div> : <div className="loading"><span className="spinner" /> Membuka percakapan…</div>}</div>
    </div>
  );

  const busyLabel: Record<string, string> = { approve: "Menyetujui…", revise: "Mengirim revisi…", reply: "Mengirim pesan…", done: "Menyimpan…", rename: "Menyimpan…", rerun: "Meminta worker mencoba lagi…" };

  return (
    <div className="drawer wide" role="dialog" aria-modal="true" aria-label={d.title}>
      {head}
      <div className="dbody" ref={body}>
        <div className={`situation m-${d.mode}`}>
          <b>{d.situation}</b>
          {d.dueText && <span className={`due ${d.dueFlag ?? "ok"}`}>{d.dueFlag === "late" ? "🔴 " : d.dueFlag === "risk" ? "🟠 " : "📅 "}{d.dueText}</span>}
        </div>

        {d.brief && (
          <div className="brief">
            <button className="more" onClick={() => setShowBrief(!showBrief)}>{showBrief ? "▾ Sembunyikan brief" : "▸ Lihat brief tugas"}</button>
            {showBrief && <div className="md">{md(d.brief)}</div>}
          </div>
        )}

        <div className="sect">Percakapan</div>
        <div className="thread">
          {d.messages.length === 0 && !pending && <p className="desc">Belum ada percakapan. Worker akan menulis hasilnya di sini.</p>}
          {d.messages.map(m => (
            <div key={m.id} className={`msg ${m.whoKind === "member" ? "me" : "bot"}`}>
              <div className="from"><span>{m.emoji ? `${m.emoji} ` : ""}{m.who}</span><span>{m.when}</span></div>
              {m.text && <div className="md">{md(m.text)}</div>}
              {m.images.length > 0 && <div className="gallery">{m.images.map(i => <a key={i.url} href={i.url} target="_blank" rel="noreferrer"><img src={i.url} alt={i.name} /></a>)}</div>}
              {m.files.length > 0 && <div className="chips">{m.files.map(f => <a key={f.url} className="chip" href={f.url} target="_blank" rel="noreferrer">📎 {f.name}</a>)}</div>}
            </div>
          ))}
          {pending && (
            <div className="msg me sending">
              <div className="from"><span>Kamu</span><span><span className="spinner sm" /> mengirim…</span></div>
              {pending.text && <div className="md">{md(pending.text)}</div>}
              {pending.files.length > 0 && <div className="chips">{pending.files.map(f => <span key={f} className="chip">📎 {f}</span>)}</div>}
            </div>
          )}
          {d.live.state !== "idle" && (
            <div className={`live live-${d.live.state}`} role="status">
              {d.live.state === "running" || d.live.state === "queued" ? <span className="dots"><i /><i /><i /></span> : null}
              {d.live.label}
            </div>
          )}
          {d.live.state === "idle" && Date.now() < watchUntil && (
            <div className="live live-queued" role="status"><span className="dots"><i /><i /><i /></span>Terkirim. Menunggu {d.assignee.name ?? "worker"} merespons…</div>
          )}
        </div>

        <details className="extra">
          <summary>Info tambahan</summary>
          <p className="desc">Kode: {d.key} · Judul asli: {d.originalTitle}</p>
          <div className="chiprow">
            <button className="btn sm" onClick={() => { setNewName(d.title); setRenaming(true); }}>Ganti nama tampilan</button>
            <a className="btn sm" href={d.url} target="_blank" rel="noreferrer">Buka di Multica</a>
          </div>
        </details>
      </div>

      {d.mode !== "closed" && (
        <div className="compose">
          {err && <div className="note bad">{err}</div>}
          {busy ? (
            <div className="loading"><span className="spinner" /> {busyLabel[busy] ?? "Memproses…"}</div>
          ) : confirm ? (
            <div className="confirm">
              <span>{confirm === "approve" ? "Setujui dan tutup task ini?" : "Tandai sudah dikerjakan? Worker berikutnya bisa lanjut."}</span>
              <div className="row">
                <button className="btn" onClick={() => setConfirm(null)}>Batal</button>
                <button className="btn primary" onClick={() => act(confirm, confirm === "done" ? { link } : {})}>Ya, lanjut</button>
              </div>
            </div>
          ) : (
            <>
              {d.mode === "human" && (
                <>
                  <label htmlFor="proof" className="sect" style={{ margin: 0 }}>Link hasil (opsional)</label>
                  <input id="proof" className="input" type="url" placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} />
                </>
              )}
              <label htmlFor="msg" className="sect" style={{ margin: 0 }}>
                {d.mode === "review" ? "Catatan untuk worker" : d.mode === "human" ? "Catatan (opsional)" : "Pesan untuk worker"}
              </label>
              <textarea id="msg" value={text} onChange={e => setText(e.target.value)}
                onPaste={e => { const pasted = [...e.clipboardData.files]; if (pasted.length) { e.preventDefault(); setFiles([...files, ...pasted]); } }}
                placeholder={d.mode === "review" ? "Tulis revisi sepanjang yang kamu perlu, atau kosongkan kalau langsung setuju." : d.mode === "waiting" ? "Jawab pertanyaannya di sini…" : "Tulis pesan…"} />
              <FilePicker files={files} onChange={setFiles} />
              <div className="row">
                {!d.assignee.online && d.assignee.kind === "agent" && <span className="hint">🌙 Laptop mati: pesan dikerjakan saat laptop menyala.</span>}
                {d.mode === "review" && <>
                  <button className="btn" disabled={!text.trim() && !files.length} onClick={() => act("revise")}>✏️ Minta revisi</button>
                  <button className="btn primary" onClick={() => setConfirm("approve")}>✅ Setujui</button>
                </>}
                {d.mode === "human" && <>
                  <button className="btn" onClick={onClose}>⏸️ Belum</button>
                  <button className="btn primary" onClick={() => setConfirm("done")}>✅ Sudah</button>
                </>}
                {(d.mode === "working" || d.mode === "waiting") && (
                  <button className="btn primary" disabled={!text.trim() && !files.length} onClick={() => act("reply")}>Kirim</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
