"use client";
// Reminders drawer: upcoming Telegram reminders (made here or by an assistant), add a new one, cancel one.
import { useCallback, useEffect, useState } from "react";
import { Px } from "./pixel-icon";
import type { ReminderView } from "@/lib/reminders";

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function Reminders({ ws, onClose }: { ws: string; onClose: () => void }) {
  const [items, setItems] = useState<ReminderView[] | null>(null);
  const [tg, setTg] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const soon = new Date(Date.now() + 60 * 60000);
  const [text, setText] = useState("");
  const [date, setDate] = useState(localDay(soon));
  const [time, setTime] = useState(`${pad(soon.getHours())}:00`);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await (await fetch(`/api/reminders?ws=${ws}`)).json();
      if (j.error) throw new Error(j.error);
      setItems(j.items); setTg(j.telegram);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [onClose]);

  async function add() {
    setBusy(true); setErr(null); setSaved(null);
    try {
      const j = await (await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, text, date, time }) })).json();
      if (j.error) throw new Error(j.error);
      setText(""); setSaved(`Reminder set for ${j.item.atText}.`);
      // Multica can take a moment to list a new task, so add it here straight away.
      setItems(cur => [...(cur ?? []).filter(i => i.id !== j.item.id), j.item].sort((a, b) => (a.at ?? "9").localeCompare(b.at ?? "9")));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  async function cancel(id: string) {
    setItems(cur => cur?.filter(i => i.id !== id) ?? cur);
    const j = await (await fetch("/api/reminders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, id }) })).json().catch(() => ({ error: "Could not cancel." }));
    if (j.error) { setErr(j.error); load(); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer reminddrawer" role="dialog" aria-modal="true" aria-label="Reminders">
        <div className="dhead">
          <span className="avatar"><Px name="clock" /></span>
          <div className="meta"><h2>Reminders</h2><div className="role">sent to your Telegram at the time you pick</div></div>
          <button className="x" onClick={onClose} aria-label="Close"><Px name="close" size="1em" /></button>
        </div>
        <div className="dbody">
          {!tg && <div className="note bad">Telegram isn&apos;t connected for this office yet, so reminders can&apos;t be sent. See setup/SETUP-TELEGRAM.md.</div>}
          <form className="rm-new" onSubmit={e => { e.preventDefault(); add(); }}>
            <label className="sect" htmlFor="rm-text">Remind me to…</label>
            <input id="rm-text" className="input" placeholder="e.g. call the printer about the proofs" value={text} onChange={e => { setText(e.target.value); setSaved(null); }} maxLength={200} />
            <div className="rm-when">
              <input type="date" className="input" aria-label="Date" value={date} min={localDay(new Date())} onChange={e => setDate(e.target.value)} />
              <input type="time" className="input" aria-label="Time" value={time} onChange={e => setTime(e.target.value)} />
              <button className="btn primary" disabled={!text.trim() || !date || !time || busy}>{busy ? <span className="spinner sm" /> : <Px name="plus" size="0.9em" />} Add</button>
            </div>
            {saved && <div className="note good">{saved}</div>}
          </form>
          <p className="hint">You can also ask any assistant, e.g. &ldquo;remind me tomorrow at 3pm to send the report&rdquo;. Reminders arrive within a few minutes of the time (up to 30 minutes if no laptop has the office open).</p>
          {err && <div className="note bad">{err}</div>}
          <h3 className="sect">Coming up</h3>
          {!items && !err && <div className="loading"><span className="spinner" /> Loading reminders…</div>}
          {items && !items.length && <p className="desc">No reminders yet.</p>}
          <ul className="rm-list">
            {items?.map(r => (
              <li key={r.id}>
                <span className="rm-ic"><Px name="clock" /></span>
                <span className="rm-t"><b>{r.text}</b><small>{r.late ? "Sending now · " : ""}{r.atText}{r.who ? ` · for ${r.who}` : ""}</small></span>
                <button className="btn sm" onClick={() => cancel(r.id)} aria-label={`Cancel reminder: ${r.text}`}>Cancel</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
