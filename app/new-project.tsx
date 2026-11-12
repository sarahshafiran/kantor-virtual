"use client";
// Create a project: it shows up as a tab on the Task Board and as a room in the Office.
import { useState } from "react";
import type { Mentionable } from "@/lib/mentions";
import { Px, Emo } from "./pixel-icon";

const ICONS = ["🎨", "🔬", "⚙️", "📣", "📚", "🛍️", "💡", "🧪", "🗓️", "🚀", "🧭", "🎬"];

export default function NewProject({ ws, people, onDone }: { ws: string; people: Mentionable[]; onDone: (id: string | null) => void }) {
  const [title, setTitle] = useState(""); const [icon, setIcon] = useState("🚀");
  const [desc, setDesc] = useState(""); const [due, setDue] = useState(""); const [lead, setLead] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setErr(null);
    try {
      const [leadType, leadId] = lead ? lead.split(":") : ["", ""];
      const j = await (await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ws, title, icon, description: desc, due, leadType, leadId }) })).json();
      if (j.error) throw new Error(j.error);
      onDone(j.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="scrim" onClick={() => !busy && onDone(null)} />
      <form className="modal" role="dialog" aria-modal="true" aria-label="New project" onSubmit={e => { e.preventDefault(); submit(); }}>
        <h2><Px name="folder" /> New project</h2>
        <p className="desc">Group related tasks under one goal. It becomes a tab on the Task Board and a room in the Office.</p>
        <label className="sect" htmlFor="np-title">Name</label>
        <input id="np-title" className="input" autoFocus placeholder="e.g. Website relaunch" value={title} onChange={e => setTitle(e.target.value)} />
        <div className="sect">Icon</div>
        <div className="emojipick">{ICONS.map(x => <button type="button" key={x} aria-pressed={icon === x} onClick={() => setIcon(x)} aria-label={x}><Emo e={x} /></button>)}</div>
        <label className="sect" htmlFor="np-desc">Goal (optional)</label>
        <textarea id="np-desc" className="input" rows={3} placeholder="What does done look like?" value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="formgrid">
          <label>Lead (optional)
            <select className="input" value={lead} onChange={e => setLead(e.target.value)}>
              <option value="">Nobody yet</option>
              <optgroup label="People">{people.filter(p => p.kind === "member").map(p => <option key={p.id} value={`member:${p.id}`}>{p.name}</option>)}</optgroup>
              <optgroup label="AI agents">{people.filter(p => p.kind === "agent").map(p => <option key={p.id} value={`agent:${p.id}`}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</option>)}</optgroup>
            </select>
          </label>
          <label>Target date<input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        </div>
        {err && <div className="note bad">{err}</div>}
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
          <button className="btn primary" disabled={!title.trim() || busy}>{busy ? <><span className="spinner sm" /> Creating…</> : "Create project"}</button>
        </div>
      </form>
    </>
  );
}
