"use client";
import { useState } from "react";
import type { Plan } from "@/lib/office-control";
import { Px } from "./pixel-icon";

/** Open/close the office for one workspace, with a preview before it runs. */
export default function OfficeSwitch({ ws, name, switchOpen, laptopOn, parked, onDone }: {
  ws: string; name: string; switchOpen: boolean; laptopOn: boolean; parked: number; onDone: (msg: string) => void;
}) {
  const action: "close" | "open" = switchOpen ? "close" : "open";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [asking, setAsking] = useState(false);
  const [stopRunning, setStopRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const status = !switchOpen ? { cls: "off", icon: "lock" as const, text: `Closed${parked ? ` · ${parked} waiting` : ""}` }
    : laptopOn ? { cls: "on", icon: "dot-on" as const, text: "Open" } : { cls: "wait", icon: "dot-wait" as const, text: "Open · waiting for a laptop" };

  async function preview() {
    setAsking(true); setPlan(null); setErr(null);
    try {
      const r = await fetch(`/api/office?ws=${ws}&action=${action}`); const j = await r.json();
      if (j.error) throw new Error(j.error); setPlan(j);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/office", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ws, action, stopRunning }) });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      const x = j.result;
      onDone(action === "close"
        ? `${name} is closed. ${x.parked} task(s) parked${x.stopped ? `, ${x.stopped} stopped` : ""}${x.autopilots ? `, ${x.autopilots} schedule(s) paused` : ""}.`
        : `${name} is open. ${x.resumed} task(s) resumed${x.rerun ? `, ${x.rerun} restarted` : ""}${x.autopilots ? `, ${x.autopilots} schedule(s) back on` : ""}.`);
      setAsking(false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const List = ({ title, items }: { title: string; items: { id: string; title: string }[] | string[] }) =>
    items.length ? (
      <div><div className="sect" style={{ margin: "6px 0 4px" }}>{title} ({items.length})</div>
        <ul className="plainlist">{items.slice(0, 6).map(i => typeof i === "string" ? <li key={i}>{i}</li> : <li key={i.id}>{i.title}</li>)}
          {items.length > 6 && <li className="desc">and {items.length - 6} more</li>}</ul></div>
    ) : null;

  return (
    <>
      <span className={`openbadge ${status.cls}`}><Px name={status.icon} /> {status.text}</span>
      <button className={`btn sm ${switchOpen ? "" : "primary"}`} onClick={preview}>{switchOpen ? <><Px name="lock" /> Close office</> : <><Px name="unlock" /> Open office</>}</button>

      {asking && (
        <>
          <div className="scrim" onClick={() => !busy && setAsking(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label={switchOpen ? "Close office" : "Open office"}>
            <h2>{switchOpen ? `Close ${name}?` : `Open ${name}?`}</h2>
            {!plan && !err && <p className="desc">Checking what will happen…</p>}
            {plan && action === "close" && (
              <>
                <p className="desc">Agents stop picking up new work. You can still send messages and tasks; they start when the office opens again.</p>
                <List title="Schedules to pause" items={plan.autopilots} />
                <List title="Queued work to park" items={plan.park} />
                {plan.running.length > 0 && (
                  <div>
                    <List title="Running right now" items={plan.running} />
                    <label className="radio"><input type="radio" name="stop" checked={!stopRunning} onChange={() => setStopRunning(false)} /> Let it finish (recommended)</label>
                    <label className="radio"><input type="radio" name="stop" checked={stopRunning} onChange={() => setStopRunning(true)} /> Stop now (resumes when the office opens)</label>
                  </div>
                )}
                {!plan.autopilots.length && !plan.park.length && !plan.running.length && <p className="desc">Nothing is queued. The office closes right away.</p>}
                <p className="hint">Note: while a laptop is on, agents that call each other inside Multica may still work. To stop completely, also quit Multica Desktop.</p>
              </>
            )}
            {plan && action === "open" && (
              <>
                <List title="Schedules to turn back on" items={plan.autopilots} />
                <List title="Tasks to resume" items={plan.resume} />
                <List title="Stopped tasks to restart" items={plan.rerun} />
                {!plan.autopilots.length && !plan.resume.length && !plan.rerun.length && <p className="desc">Nothing is waiting. Agents start as soon as there is a new task.</p>}
                {!laptopOn && <p className="hint"><Px name="moon" /> The laptop is off. Work starts as soon as it is back on.</p>}
              </>
            )}
            {err && <div className="note bad">{err}</div>}
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
              <button className={`btn primary`} disabled={!plan || busy} onClick={run}>{busy ? "Working…" : switchOpen ? "Yes, close it" : "Yes, open it"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
