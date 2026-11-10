"use client";
// Meja bergaya piksel: tokoh duduk di meja, layar menyala saat bekerja, cangkir kopi saat istirahat,
// kursi kosong saat pulang. Semua gambar dibuat di sini (tanpa aset dari luar).
import { useEffect, useRef } from "react";

const W = 48, H = 34, S = 3;

// Satu detak bersama untuk semua meja, supaya animasinya hemat.
const subs = new Set<(t: number) => void>();
let tick = 0, timer: ReturnType<typeof setInterval> | null = null;
function subscribe(fn: (t: number) => void) {
  subs.add(fn);
  if (!timer) timer = setInterval(() => { tick++; subs.forEach(f => f(tick)); }, 110);
  return () => { subs.delete(fn); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
}

const HAIR = ["#2a1a14", "#1c1c22", "#4a2e1f", "#8a3b1c", "#9a9a96", "#5b3a29", "#c9a26b"];
const SKIN = ["#f0c8a4", "#e8b894", "#d9a07a", "#c98e66", "#a8714a"];
const SHIRT = ["#7F77DD", "#D85A30", "#1D9E75", "#EF9F27", "#D4537E", "#378ADD", "#639922", "#993556"];
function hash(s: string) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
export function lookOf(name: string) {
  const h = hash(name);
  return { hair: HAIR[h % HAIR.length], skin: SKIN[(h >> 3) % SKIN.length], shirt: SHIRT[(h >> 6) % SHIRT.length] };
}

export type PixelState = "working" | "ready" | "review" | "failed" | "break" | "away" | "present";

export default function PixelDesk({ name, state, human, papers = 0 }: { name: string; state: PixelState; human?: boolean; papers?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const lo = document.createElement("canvas"); lo.width = W; lo.height = H;
    const c = lo.getContext("2d")!, X = cv.getContext("2d")!;
    const look = lookOf(name);
    const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const seated = state !== "away";
    const draw = (t: number) => {
      c.clearRect(0, 0, W, H);
      // kursi
      r(22, 8, 13, 10, "#5f5e5a"); r(23, 9, 11, 8, "#7a7873");
      // tokoh
      if (seated) {
        const y = 7 + (state === "working" && Math.floor(t / 4) % 2 ? 1 : 0), x = 24;
        r(x + 1, y, 7, 2, look.hair); r(x + 1, y + 2, 1, 2, look.hair); r(x + 7, y + 2, 1, 2, look.hair);
        r(x + 2, y + 2, 5, 3, look.skin); r(x + 3, y + 3, 1, 1, "#2b2420"); r(x + 6, y + 3, 1, 1, "#2b2420");
        r(x + 1, y + 5, 7, 5, look.shirt); r(x, y + 6, 1, 4, look.skin); r(x + 8, y + 6, 1, 4, look.skin);
      }
      // meja
      r(3, 18, 42, 4, "#c08a55"); r(3, 22, 42, 7, "#9a6538"); r(5, 29, 3, 4, "#7a4d2a"); r(40, 29, 3, 4, "#7a4d2a");
      if (!human) {
        // layar
        r(7, 8, 13, 10, "#2c2c2a");
        const blink = Math.floor(t / 6) % 2;
        const screen = state === "working" ? (Math.floor(t / 3) % 2 ? "#85B7EB" : "#B5D4F4")
          : state === "failed" ? (blink ? "#E24B4A" : "#791F1F")
          : state === "away" ? "#444441" : "#9fb3c8";
        r(8, 9, 11, 7, screen); r(12, 17, 3, 1, "#2c2c2a");
        if (state === "working") for (let i = 0; i < 3; i++) r(9 + i * 3, 10 + ((t + i) % 4), 2, 1, "#185FA5");
      } else {
        // laptop & lampu meja
        r(8, 14, 12, 4, "#d3d1c7"); r(9, 15, 10, 2, seated ? "#B5D4F4" : "#888780");
        r(41, 10, 1, 8, "#5f5e5a"); r(38, 8, 7, 3, seated ? "#FAC775" : "#888780");
      }
      if (state === "break") { r(36, 15, 4, 3, "#ffffff"); r(40, 16, 1, 1, "#ffffff"); r(37, 12 - (t % 3), 1, 1, "#d3d1c7"); r(38, 13 - ((t + 1) % 3), 1, 1, "#d3d1c7"); }
      if (state === "review") { r(36, 15, 6, 3, "#ffffff"); r(37, 14, 6, 1, "#f1efe8"); }
      for (let i = 0; i < Math.min(papers, 4); i++) { r(24 + i, 16 - i, 7, 2, "#ffffff"); r(30 + i, 16 - i, 1, 1, "#E24B4A"); }
      X.clearRect(0, 0, cv.width, cv.height); X.imageSmoothingEnabled = false; X.drawImage(lo, 0, 0, W * S, H * S);
    };
    draw(tick);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || !["working", "failed", "break"].includes(state);
    if (still) return;
    return subscribe(draw);
  }, [name, state, human, papers]);
  return <canvas ref={ref} width={W * S} height={H * S} className="pixdesk" aria-hidden="true" />;
}
