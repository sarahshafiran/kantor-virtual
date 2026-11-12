// Ikon pixel buatan sendiri (12×12), pengganti emoji supaya senada dengan kantor dan tampil sama di Mac maupun Windows.
// Setiap ikon adalah "peta pixel": satu huruf = satu warna, titik = kosong.
//   o garis (ikut warna teks, jadi tetap terlihat di mode terang/gelap)
//   w putih · g abu · x merah · p y t r v = pink, kuning, teal, oranye, ungu dari tema yang dipilih
// Gambar otomatis diletakkan di tengah kotak, jadi peta tidak harus pas di tengah.

const COLORS: Record<string, string> = {
  o: "currentColor", w: "#FFFFFF", g: "var(--off)", x: "#E8264B",
  p: "var(--pink)", y: "var(--yellow)", t: "var(--teal)", r: "var(--orange)", v: "var(--purple)",
};

const MAPS = {
  agent: [".....yy.....", ".....oo.....", "..oooooooo..", "..owwwwwwo..", "..owtwwtwo..", "..owwwwwwo..", "..owwppwwo..", "..oooooooo..", ".ovvvvvvvvo.", ".ovvyyyyvvo.", ".ovvvvvvvvo.", ".oooooooooo."],
  chat: [".oooooooooo.", "otttttttttto", "otttttttttto", "ottwttwttwto", "otttttttttto", "otttttttttto", ".oottoooooo.", "..otto......", "..oo........"],
  lock: ["....oooo....", "...o....o...", "...o....o...", "...o....o...", ".oooooooooo.", ".oyyyyyyyyo.", ".oyyyooyyyo.", ".oyyyooyyyo.", ".oyyyyyyyyo.", ".oooooooooo."],
  unlock: ["......oooo..", ".....o....o.", ".....o....o.", ".....o......", ".oooooooooo.", ".oyyyyyyyyo.", ".oyyyooyyyo.", ".oyyyooyyyo.", ".oyyyyyyyyo.", ".oooooooooo."],
  coffee: ["...g..g.....", "....g..g....", "...g..g.....", "............", ".ooooooooo..", ".owwwwwwwooo", ".ottttttto.o", ".owwwwwwwo.o", ".owwwwwwwooo", "..owwwwwo...", "..ooooooo..."],
  file: [".oooooo....", ".owwwwoo...", ".owwwwowo..", ".owwwwoooo.", ".owwwwwwwo.", ".owgggggwo.", ".owwwwwwwo.", ".owgggggwo.", ".owwwwwwwo.", ".owgggwwwo.", ".owwwwwwwo.", ".ooooooooo."],
  folder: [".oooo.......", "oyyyyo......", "oyyyyyoooooo", "oyyyyyyyyyyo", "orrrrrrrrrro", "orrrrrrrrrro", "orrrrrrrrrro", "orrrrrrrrrro", "oooooooooooo"],
  bell: [".....oo.....", "....oyyo....", "...oyyyyo...", "...oyyyyo...", "..oyyyyyyo..", "..oyyyyyyo..", "..oyyyyyyo..", ".oyyyyyyyyo.", "oooooooooooo", ".....rr....."],
  done: [".oooooooooo.", "otttttttttto", "ottttttttwto", "otttttttwwto", "ottttttwwtto", "otwwttwwttto", "ottwwwwtttto", "otttwwttttto", "otttttttttto", ".oooooooooo."],
  calendar: ["..o....o....", ".oooooooooo.", ".oppppppppo.", ".oooooooooo.", ".owwwwwwwwo.", ".owvwwvwwvo.", ".owwwwwwwwo.", ".owvwwvwwwo.", ".owwwwwwwwo.", ".oooooooooo."],
  alert: [".....oo.....", "....oyyo....", "....oyyo....", "...oyooyo...", "...oyooyo...", "..oyyooyyo..", "..oyyooyyo..", ".oyyyyyyyyo.", ".oyyyooyyyo.", "oyyyyyyyyyyo", "oooooooooooo"],
  eyes: [".oooo..oooo.", "owwwwoowwwwo", "owwvvoowwvvo", "owwvvoowwvvo", "owwwwoowwwwo", ".oooo..oooo."],
  office: ["..oooooooo..", "..oppppppo..", "..opwppwpo..", "..oppppppo..", "..opwppwpo..", "..oppppppo..", "..opwppwpo..", "..oppppppo..", "..oppyyppo..", "..oppyyppo..", "oooooooooooo"],
  board: ["oooooooooooo", "owwwowwwowwo", "opppotttoyyo", "owwwowwwowwo", "opppotttowwo", "owwwowwwowwo", "opppowwwowwo", "owwwowwwowwo", "oooooooooooo"],
  team: ["..oo....oo..", ".oyyo..oyyo.", ".oyyo..oyyo.", "..oo....oo..", ".oooo..oooo.", "oppppootttto", "oppppootttto", "oppppootttto", "oooooooooooo"],
  person: ["....oooo....", "...oyyyyo...", "...oyyyyo...", "...oyyyyo...", "....oooo....", "..oooooooo..", ".oppppppppo.", ".oppppppppo.", ".oppppppppo.", ".oooooooooo."],
  nobody: ["....oooo....", "...oggggo...", "...oggggo...", "...oggggo...", "....oooo....", "..oooooooo..", ".oggggggggo.", ".oggggggggo.", ".oggggggggo.", ".oooooooooo."],
  home: [".....oo.....", "....orro....", "...orrrro...", "..orrrrrro..", ".orrrrrrrro.", "oooooooooooo", ".owwwwwwwwo.", ".owttwwyywo.", ".owttwwyywo.", ".owwwwwyywo.", ".oooooooooo."],
  moon: ["....oooo....", "..ooyyo.....", ".oyyyo......", ".oyyo.......", "oyyyo.......", "oyyyo.......", "oyyyo.......", "oyyyyo......", ".oyyyyo...o.", ".oyyyyyoooo.", "..ooyyyyyo..", "....ooooo..."],
  sun: [".....rr.....", ".r........r.", "............", "....oooo....", "...oyyyyo...", "rr.oyyyyo.rr", "rr.oyyyyo.rr", "...oyyyyo...", "....oooo....", "............", ".r........r.", ".....rr....."],
  monitor: ["oooooooooooo", "otttttttttto", "otttttttttto", "ottwttttttto", "otttttttttto", "otttttttttto", "oooooooooooo", ".....oo.....", "...oooooo..."],
  palette: ["...oooooo...", ".oowwwwwwoo.", "owwpwwwwtwwo", "owwwwwwwwwwo", "owywwwwwwvwo", "owwwwwwwwwwo", "owwrwwwooo..", ".owwwwwo....", "..ooooo....."],
  idea: ["...oooooo...", "..oyyyyyyo..", ".oyywyyyyyo.", ".oyywyyyyyo.", ".oyyyyyyyyo.", "..oyyyyyyo..", "...oyyyyo...", "...oooooo...", "...oggggo...", "...oooooo...", "....oooo...."],
  wave: ["..o.o.o.....", ".oyoyoyo....", ".oyoyoyo.o..", ".oyyyyyooyo.", ".oyyyyyyyo..", ".oyyyyyyo...", "..oyyyyyo...", "...ooooo...."],
  party: ["..t...p...y.", "......p.....", "....p....t..", ".....ooo....", "....oyyyo..y", "...oyrryo...", "..oyyyyo....", ".oyrryo.....", "oyyyyo......", "ooooo......."],
  clock: ["...oooooo...", "..owwwwwwo..", ".owwwwowwwo.", "owwwwwowwwwo", "owwwwwowwwwo", "owwwwwowwwwo", "owwwwwoooowo", "owwwwwwwwwwo", ".owwwwwwwwo.", "..owwwwwwo..", "...oooooo..."],
  failed: [".oooooooooo.", "oxxxxwwxxxxo", "oxxxxwwxxxxo", "oxxxxwwxxxxo", "oxxxxwwxxxxo", "oxxxxwwxxxxo", "oxxxxxxxxxxo", "oxxxxwwxxxxo", "oxxxxxxxxxxo", ".oooooooooo."],
  sparkle: ["....o.......", "...oyo......", "...oyo......", ".ooyyyoo....", "oyyyyyyyo...", ".ooyyyoo..y.", "...oyo...yyy", "...oyo....y.", "....o.......", "........p...", ".......ppp..", "........p..."],
  hire: ["....oooo....", "....o..o....", "oooooooooooo", "orrrrrrrrrro", "orrrrrrrrrro", "oooooyyooooo", "orrrryyrrrro", "orrrrrrrrrro", "oooooooooooo"],
  skill: [".....oo.....", "...oovvoo...", ".oovvvvvvoo.", "ovvvvvvvvvvo", ".oovvvvvvoo.", "..ovvvvvvo.y", "..ovvvvvvo.y", "..oooooooo.y"],
  chart: ["........ooo.", "........oto.", "....ooo.oto.", "....opo.oto.", "....opo.oto.", "ooo.opo.oto.", "oyo.opo.oto.", "oyo.opo.oto.", "oyo.opo.oto.", "oooooooooooo"],
  clip: [".....vvv....", "....v...v...", "....v.v.v...", "....v.v.v...", "....v.v.v...", "....v.v.v...", "....v.v.v...", "....v.v.v...", "....v...v...", ".....vvv...."],
  image: ["oooooooooooo", "owwwwwwwwwwo", "owwwwwwwyywo", "owwwwwwwyywo", "owwwwwwwwwwo", "owwwtwwwwwwo", "owwtttwwtwwo", "owttttttttto", "otttttttttto", "oooooooooooo"],
  pdf: [".oooooooooo.", ".oxxxxxxxxo.", ".oxwwwwwwxo.", ".oxxxxxxxxo.", ".oxxxxxxxxo.", ".oxxxxxxxxo.", ".oxxxxxxxxo.", ".oxxxxxxxxo.", ".oowwwwwwwo.", ".oooooooooo."],
  web: ["...oooooo...", ".oottyyttoo.", ".otyyyyttto.", "otttyyytttto", "ottttyttttto", "otttttttyyto", "ottttttyyyto", ".otttttyyto.", ".oottttttoo.", "...oooooo..."],
  edit: [".........oo.", "........oppo", ".......oyoo.", "......oyyo..", ".....oyyo...", "....oyyo....", "...oyyo.....", "..owyo......", "..ooo......."],
  rocket: ["........oooo", ".......owwwo", "......owwtwo", ".....owwwwo.", "..o.owwwwo..", "..oowwwwo...", "..owwwwo....", "...owwoo....", "..ryoo......", ".ry.........", "r..........."],
  mention: ["........oo..", "......oopo..", ".ooooopppo..", ".oyyoppppo..", ".oyyoppppo..", ".ooooopppo..", "...o..oopo..", "...o....oo..", "...oo......."],
  pause: ["..oooo.oooo.", "..ovvo.ovvo.", "..ovvo.ovvo.", "..ovvo.ovvo.", "..ovvo.ovvo.", "..ovvo.ovvo.", "..ovvo.ovvo.", "..oooo.oooo."],
  loose: ["..oooooooo..", "..o......o..", ".o........o.", "oooo....oooo", "oyyyo..oyyyo", "oyyyyooyyyyo", "oyyyyyyyyyyo", "oooooooooooo"],
  all: [".oooo..oooo.", ".oppo..otto.", ".oppo..otto.", ".oooo..oooo.", "............", ".oooo..oooo.", ".oyyo..ovvo.", ".oyyo..ovvo.", ".oooo..oooo."],
  busy: [".....o......", "....oro.....", "....orro....", "...orrro.o..", "..orrrrooro.", ".orrryrrrro.", ".orryyyrrro.", ".oryyyyyrro.", ".oryyyyyyro.", "..oryyyyro..", "...oooooo..."],
  gear: ["....oooo....", ".oo.ovvo.oo.", ".ovoovvoovo.", "..ovvvvvvo..", "oovvvoovvvoo", "ovvvo..ovvvo", "ovvvo..ovvvo", "oovvvoovvvoo", "..ovvvvvvo..", ".ovoovvoovo.", ".oo.ovvo.oo.", "....oooo...."],
  doing: ["..ooooooo...", ".ogggggggo..", ".ogggggggo..", "..ooooooo...", ".....oro....", ".....oro....", ".....oro....", ".....oro....", ".....oro....", ".....ooo...."],
  queued: [".......vvvv.", ".........v..", "........v...", ".......vvvv.", ".vvvvv......", "....v.......", "...v........", "..v.........", ".vvvvv......"],
  mail: ["oooooooooooo", "oowwwwwwwwoo", "owowwwwwwowo", "owwowwwwowwo", "owwwoppowwwo", "owwwwoowwwwo", "owwwwwwwwwwo", "oooooooooooo"],
  pin: ["....oooo....", "...oxxxxo...", "...oxwxxo...", "...oxxxxo...", "....oxxo....", "...oooooo...", ".....oo.....", ".....oo.....", ".....oo.....", ".....oo....."],
  refresh: ["...tttttt...", "..t......t.t", ".t........tt", ".t......ttt.", ".t..........", "..........t.", ".ttt......t.", "tt........t.", "t.t......t..", "...tttttt..."],
  desk: ["..oooooooo..", "..otttttto..", "..otttttto..", "..oooooooo..", ".....oo.....", "oooooooooooo", "oppppppppppo", "oooooooooooo", ".o........o.", ".o........o."],
  lounge: ["..oooooooo..", "..ovvvvvvo..", "..ovvvvvvo..", "ooovvvvvvooo", "ovoooooooovo", "ovvvvvvvvvvo", "oooooooooooo", ".o........o."],
  todo: ["....oooo....", ".oooyyyyooo.", ".owwoooowwo.", ".owwwwwwwwo.", ".owvwgggwwo.", ".owwwwwwwwo.", ".owvwgggwwo.", ".owwwwwwwwo.", ".owvwggwwwo.", ".owwwwwwwwo.", ".oooooooooo."],
  dot: ["..oooo..", ".oXXXXo.", "oXwXXXXo", "oXXXXXXo", "oXXXXXXo", "oXXXXXXo", ".oXXXXo.", "..oooo.."],
} as const;

// Titik status dalam beberapa warna dari satu peta.
const DOTS = { late: "x", risk: "r", on: "t", wait: "y", off: "g" } as const;

export type PxName = Exclude<keyof typeof MAPS, "dot"> | `dot-${keyof typeof DOTS}`;

type Run = { x: number; y: number; w: number; c: string };
const cache = new Map<string, Run[]>();

function build(name: PxName): Run[] {
  const hit = cache.get(name);
  if (hit) return hit;
  let rows: readonly string[];
  if (name.startsWith("dot-")) rows = MAPS.dot.map(r => r.replace(/X/g, DOTS[name.slice(4) as keyof typeof DOTS]));
  else rows = MAPS[name as keyof typeof MAPS];
  // Taruh gambar di tengah kotak 12×12.
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (COLORS[c]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const dx = Math.floor((12 - (x1 - x0 + 1)) / 2) - x0, dy = Math.floor((12 - (y1 - y0 + 1)) / 2) - y0;
  const runs: Run[] = [];
  rows.forEach((r, y) => {
    const cs = [...r];
    for (let x = 0; x < cs.length;) {
      const c = cs[x];
      let w = 1; while (cs[x + w] === c) w++;
      if (COLORS[c]) runs.push({ x: x + dx, y: y + dy, w, c: COLORS[c] });
      x += w;
    }
  });
  cache.set(name, runs);
  return runs;
}

/** Ikon pixel. Ukuran bawaan mengikuti besar huruf di sekitarnya. */
export function Px({ name, size, label, className }: { name: PxName; size?: number | string; label?: string; className?: string }) {
  const s = size ?? "1.2em";
  return (
    <svg className={`px ${className ?? ""}`} viewBox="0 0 12 12" width={s} height={s} shapeRendering="crispEdges"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {build(name).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} fill={r.c} />)}
    </svg>
  );
}

/** Ikon kecil di depan status meja (tutup, laptop mati, istirahat, gagal, pulang). */
const STATE_ICON: Partial<Record<string, PxName>> = { closed: "lock", off: "moon", break: "coffee", failed: "alert", home: "home" };
export function StateIcon({ state }: { state: string }) {
  const n = STATE_ICON[state];
  return n ? <><Px name={n} /> </> : null;
}
