"use client";
import { useState } from "react";
import type { Plan } from "@/lib/office-control";

/** Tombol Buka/Tutup kantor untuk satu gedung, dengan pratinjau sebelum dijalankan. */
export default function OfficeSwitch({ ws, name, switchOpen, laptopOn, parked, onDone }: {
  ws: string; name: string; switchOpen: boolean; laptopOn: boolean; parked: number; onDone: (msg: string) => void;
}) {
  const action: "close" | "open" = switchOpen ? "close" : "open";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [asking, setAsking] = useState(false);
  const [stopRunning, setStopRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const status = !switchOpen ? { cls: "off", text: `🔒 Tutup${parked ? ` · ${parked} task menunggu` : ""}` }
    : laptopOn ? { cls: "on", text: "🟢 Buka" } : { cls: "wait", text: "🟡 Buka · menunggu laptop menyala" };

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
        ? `Kantor ${name} ditutup. ${x.parked} task diparkir${x.stopped ? `, ${x.stopped} dihentikan` : ""}${x.autopilots ? `, ${x.autopilots} jadwal dijeda` : ""}.`
        : `Kantor ${name} dibuka. ${x.resumed} task dilanjutkan${x.rerun ? `, ${x.rerun} dijalankan ulang` : ""}${x.autopilots ? `, ${x.autopilots} jadwal aktif lagi` : ""}.`);
      setAsking(false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const List = ({ title, items }: { title: string; items: { id: string; title: string }[] | string[] }) =>
    items.length ? (
      <div><div className="sect" style={{ margin: "6px 0 4px" }}>{title} ({items.length})</div>
        <ul className="plainlist">{items.slice(0, 6).map(i => typeof i === "string" ? <li key={i}>{i}</li> : <li key={i.id}>{i.title}</li>)}
          {items.length > 6 && <li className="desc">dan {items.length - 6} lainnya</li>}</ul></div>
    ) : null;

  return (
    <>
      <span className={`openbadge ${status.cls}`}>{status.text}</span>
      <button className={`btn sm ${switchOpen ? "" : "primary"}`} onClick={preview}>{switchOpen ? "🔒 Tutup kantor" : "🔓 Buka kantor"}</button>

      {asking && (
        <>
          <div className="scrim" onClick={() => !busy && setAsking(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label={switchOpen ? "Tutup kantor" : "Buka kantor"}>
            <h2>{switchOpen ? `Tutup kantor ${name}?` : `Buka kantor ${name}?`}</h2>
            {!plan && !err && <p className="desc">Mengecek apa saja yang akan terjadi…</p>}
            {plan && action === "close" && (
              <>
                <p className="desc">Worker berhenti mengambil kerjaan baru. Pesan dan task baru tetap bisa kamu kirim, dan baru dikerjakan saat kantor dibuka lagi.</p>
                <List title="Jadwal otomatis yang dijeda" items={plan.autopilots} />
                <List title="Antrean yang diparkir" items={plan.park} />
                {plan.running.length > 0 && (
                  <div>
                    <List title="Sedang dikerjakan sekarang" items={plan.running} />
                    <label className="radio"><input type="radio" name="stop" checked={!stopRunning} onChange={() => setStopRunning(false)} /> Biarkan selesai dulu (disarankan)</label>
                    <label className="radio"><input type="radio" name="stop" checked={stopRunning} onChange={() => setStopRunning(true)} /> Hentikan sekarang (dilanjutkan saat kantor dibuka)</label>
                  </div>
                )}
                {!plan.autopilots.length && !plan.park.length && !plan.running.length && <p className="desc">Tidak ada kerjaan yang sedang antre. Kantor langsung ditutup.</p>}
                <p className="hint">Catatan: kalau laptop menyala, worker yang saling memanggil sendiri di Multica masih mungkin bekerja. Untuk benar-benar berhenti, tutup juga aplikasi Multica Desktop.</p>
              </>
            )}
            {plan && action === "open" && (
              <>
                <List title="Jadwal otomatis yang aktif lagi" items={plan.autopilots} />
                <List title="Task yang dilanjutkan" items={plan.resume} />
                <List title="Task yang terhenti dan dijalankan ulang" items={plan.rerun} />
                {!plan.autopilots.length && !plan.resume.length && !plan.rerun.length && <p className="desc">Tidak ada kerjaan yang menunggu. Worker akan bekerja begitu ada task baru.</p>}
                {!laptopOn && <p className="hint">🌙 Laptop pemilik meja sedang mati. Kerjaan langsung jalan begitu laptop menyala.</p>}
              </>
            )}
            {err && <div className="note bad">{err}</div>}
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => setAsking(false)}>Batal</button>
              <button className={`btn primary`} disabled={!plan || busy} onClick={run}>{busy ? "Memproses…" : switchOpen ? "Ya, tutup kantor" : "Ya, buka kantor"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
