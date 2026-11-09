"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskDetail } from "@/lib/detail";

const md = (text: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{text}</ReactMarkdown>;

export default function TaskPanel({ id, ws, onClose, onChanged }: { id: string; ws: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<TaskDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState<null | "approve" | "done">(null);

  useEffect(() => {
    let on = true;
    setD(null); setErr(null);
    fetch(`/api/task/${id}?ws=${ws}`).then(r => r.json()).then(j => { if (!on) return; if (j.error) setErr(j.error); else setD(j); }).catch(e => on && setErr(String(e)));
    return () => { on = false; };
  }, [id, ws]);

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null);
    try {
      const r = await fetch(`/api/task/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, action, text, ...extra }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setD(j); setText(""); setLink(""); setConfirm(null); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
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

  if (!d) return <div className="drawer wide" role="dialog" aria-modal="true">{head}<div className="dbody">{err ? <div className="note bad">{err}</div> : <p className="desc">Memuat percakapan…</p>}</div></div>;

  return (
    <div className="drawer wide" role="dialog" aria-modal="true" aria-label={d.title}>
      {head}
      <div className="dbody">
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
          {d.messages.length === 0 && <p className="desc">Belum ada percakapan. Worker akan menulis hasilnya di sini.</p>}
          {d.messages.map(m => (
            <div key={m.id} className={`msg ${m.whoKind === "member" ? "me" : "bot"}`}>
              <div className="from"><span>{m.emoji ? `${m.emoji} ` : ""}{m.who}</span><span>{m.when}</span></div>
              {m.text && <div className="md">{md(m.text)}</div>}
              {m.images.length > 0 && <div className="gallery">{m.images.map(i => <a key={i.url} href={i.url} target="_blank" rel="noreferrer"><img src={i.url} alt={i.name} /></a>)}</div>}
              {m.files.length > 0 && <div className="chips">{m.files.map(f => <a key={f.url} className="chip" href={f.url} target="_blank" rel="noreferrer">📎 {f.name}</a>)}</div>}
            </div>
          ))}
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
          {confirm ? (
            <div className="confirm">
              <span>{confirm === "approve" ? "Setujui dan tutup task ini?" : "Tandai sudah dikerjakan? Worker berikutnya bisa lanjut."}</span>
              <div className="row">
                <button className="btn" onClick={() => setConfirm(null)}>Batal</button>
                <button className="btn primary" disabled={!!busy} onClick={() => act(confirm, confirm === "done" ? { link } : {})}>{busy ? "Menyimpan…" : "Ya, lanjut"}</button>
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
                placeholder={d.mode === "review" ? "Tulis revisi sepanjang yang kamu perlu, atau kosongkan kalau langsung setuju." : d.mode === "waiting" ? "Jawab pertanyaannya di sini…" : "Tulis pesan…"} />
              <div className="row">
                {!d.assignee.online && d.assignee.kind === "agent" && <span className="hint">🌙 Kantor tutup: pesan dikerjakan saat laptop menyala.</span>}
                {d.mode === "review" && <>
                  <button className="btn" disabled={!text.trim() || !!busy} onClick={() => act("revise")}>{busy === "revise" ? "Mengirim…" : "✏️ Minta revisi"}</button>
                  <button className="btn primary" disabled={!!busy} onClick={() => setConfirm("approve")}>✅ Setujui</button>
                </>}
                {d.mode === "human" && <>
                  <button className="btn" onClick={onClose}>⏸️ Belum</button>
                  <button className="btn primary" disabled={!!busy} onClick={() => setConfirm("done")}>✅ Sudah</button>
                </>}
                {(d.mode === "working" || d.mode === "waiting") && (
                  <button className="btn primary" disabled={!text.trim() || !!busy} onClick={() => act("reply")}>{busy === "reply" ? "Mengirim…" : "Kirim"}</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
