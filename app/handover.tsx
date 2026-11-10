"use client";
// Tahap 2 kantor piksel: worker berjalan membawa kertas saat ada serah terima.
// - Hasil kerja masuk review  → worker berjalan ke meja manusia (yang sedang di kantor).
// - Task pindah ke worker lain → worker lama mengantarnya ke meja worker baru.
// - Task dialihkan ke manusia   → worker mengantarnya ke meja orang itu.
// Serah terima dideteksi dengan membandingkan data sebelum dan sesudah pembaruan (tiap 30 detik).
import { useEffect, useRef, useState } from "react";
import type { Office } from "@/lib/office";
import { lookOf } from "./pixel-desk";

type Holder = { who: string; status: string; title: string };
export type Handover = { from: string; to: string; title: string; fromName: string; toName: string };

function holders(office: Office): Map<string, Holder> {
  const m = new Map<string, Holder>();
  for (const [agentId, d] of Object.entries(office.agentsDetail)) for (const t of d.tasks) m.set(t.id, { who: agentId, status: t.status, title: t.title });
  for (const t of office.attention.human) if (t.assignee) m.set(t.id, { who: "person:" + t.assignee, status: t.status, title: t.title });
  return m;
}

/** Mencari serah terima baru setiap kali data kantor diperbarui. */
export function useHandoverDetector(office: Office, reviewer: string | null, nameOf: (key: string) => string, onFound: (h: Handover[]) => void) {
  const prev = useRef<{ ws: string; map: Map<string, Holder> } | null>(null);
  useEffect(() => {
    const now = holders(office);
    const before = prev.current?.ws === office.workspaceId ? prev.current.map : null;
    prev.current = { ws: office.workspaceId, map: now };
    if (!before) return;
    const found: Handover[] = [];
    for (const [id, h] of now) {
      const p = before.get(id);
      if (!p || p.who.startsWith("person:")) continue;
      let to: string | null = null;
      if (p.who !== h.who) to = h.who;
      else if (h.status === "in_review" && p.status !== "in_review" && reviewer) to = "person:" + reviewer;
      if (to) found.push({ from: p.who, to, title: h.title, fromName: nameOf(p.who), toName: nameOf(to) });
    }
    if (found.length) onFound(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office]);
}

function drawWalker(cv: HTMLCanvasElement, name: string, frame: number, carry: boolean) {
  const c = cv.getContext("2d")!; const L = lookOf(name);
  const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x * 3, y * 3, w * 3, h * 3); };
  c.clearRect(0, 0, cv.width, cv.height);
  r(1, 0, 7, 2, L.hair); r(1, 2, 1, 2, L.hair); r(7, 2, 1, 2, L.hair);
  r(2, 2, 5, 3, L.skin); r(3, 3, 1, 1, "#2b2420"); r(6, 3, 1, 1, "#2b2420");
  r(1, 5, 7, 5, L.shirt); r(0, 6, 1, 3, L.skin); r(8, 6, 1, 3, L.skin);
  const a = frame % 2; r(2, 10, 2, a ? 2 : 3, "#3d3a4a"); r(5, 10, 2, a ? 3 : 2, "#3d3a4a");
  if (carry) { r(8, 5, 4, 5, "#ffffff"); r(9, 6, 2, 1, "#b4b2a9"); r(9, 8, 2, 1, "#b4b2a9"); }
}

type Pt = [number, number];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Satu worker berjalan dari mejanya ke meja tujuan, menaruh kertas, lalu kembali. */
function Walker({ h, layer, onDone }: { h: Handover; layer: HTMLElement; onDone: () => void }) {
  const el = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [carry, setCarry] = useState(true);
  const carryRef = useRef(true);
  useEffect(() => {
    // Worker yang duduk di beberapa ruangan: pakai pasangan meja yang paling dekat.
    const desks = (key: string) => [...layer.querySelectorAll<HTMLElement>(`[data-desk="${CSS.escape(key)}"] .pixbox`)].map(e => e.getBoundingClientRect());
    const As = desks(h.from), Bs = desks(h.to), node = el.current;
    if (!As.length || !Bs.length || !node) { onDone(); return; }
    let ra = As[0], rb = Bs[0], best = Infinity;
    for (const x of As) for (const y of Bs) { const d = Math.hypot(x.left - y.left, x.top - y.top); if (d > 0 && d < best) { best = d; ra = x; rb = y; } }
    const base = layer.getBoundingClientRect();
    const rel = (x: number, y: number): Pt => [x - base.left, y - base.top];
    const seat = rel(ra.left + ra.width / 2, ra.top + 14);
    const lane = rel(0, ra.bottom + 14)[1];
    const side = rel(rb.left - 26, rb.top + 26);
    const path: Pt[] = [seat, [seat[0], lane], [side[0], lane], side];
    let frame = 0, stop = false;
    const tickTimer = setInterval(() => { frame++; if (cv.current) drawWalker(cv.current, h.fromName, frame, carryRef.current); }, 140);
    const walk = async (pts: Pt[]) => {
      const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      const total = lens.reduce((s, x) => s + x, 0) || 1;
      let acc = 0;
      const frames = pts.map((p, i) => { if (i) acc += lens[i - 1]; return { transform: `translate(${p[0] - 15}px, ${p[1] - 20}px)`, offset: acc / total }; });
      const anim = node.animate(frames, { duration: Math.min(9000, Math.max(1500, total / 0.16)), easing: "linear", fill: "forwards" });
      await anim.finished.catch(() => {});
    };
    (async () => {
      await walk(path); if (stop) return;
      carryRef.current = false; setCarry(false);
      await sleep(600); if (stop) return;
      await walk([...path].reverse()); if (stop) return;
      onDone();
    })();
    return () => { stop = true; clearInterval(tickTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={el} className="walker" title={`${h.fromName} → ${h.toName}: ${h.title}`}>
      <canvas ref={cv} width={36} height={39} />
      {carry && <span className="walktag">{h.title}</span>}
    </div>
  );
}

export function HandoverLayer({ items, layer, onDone }: { items: (Handover & { key: string })[]; layer: HTMLElement | null; onDone: (key: string) => void }) {
  if (!layer) return null;
  return <div className="walkers" aria-hidden="true">{items.map(h => <Walker key={h.key} h={h} layer={layer} onDone={() => onDone(h.key)} />)}</div>;
}
