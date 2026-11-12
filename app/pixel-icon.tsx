// Ikon pixel buatan sendiri (12×12), pengganti emoji supaya senada dengan kantor dan tampil sama di Mac maupun Windows.
// Setiap ikon adalah "peta pixel": satu huruf = satu warna, titik = kosong.
//   o garis (ikut warna teks, jadi tetap terlihat di mode terang/gelap)
//   w putih · g abu · x merah · p y t r v = pink, kuning, teal, oranye, ungu dari tema yang dipilih
// Gambar otomatis diletakkan di tengah kotak, jadi peta tidak harus pas di tengah.
import type { HTMLAttributes, ReactNode } from "react";

const COLORS: Record<string, string> = {
  o: "currentColor", w: "#FFFFFF", g: "var(--off)", x: "#E8264B",
  p: "var(--pink)", y: "var(--yellow)", t: "var(--teal)", r: "var(--orange)", v: "var(--purple)",
};

const MAPS = {
  agent: [".....yy.....", ".....oo.....", "..oooooooo..", "..owwwwwwo..", "..owtwwtwo..", "..owwwwwwo..", "..owwppwwo..", "..oooooooo..", ".ovvvvvvvvo.", ".ovvyyyyvvo.", ".ovvvvvvvvo.", ".oooooooooo."],
  chat: [".oooooooooo.", "owwwwwwwwwwo", "owwwwwwwwwwo", "owwowwowwowo", "owwwwwwwwwwo", "owwwwwwwwwwo", ".oowwoooooo.", "..owwo......", "..oo........"],
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
  palette: ["...oooooo...", ".ooyyyyyyoo.", "oyypyyyytyyo", "oyyyyyyyyyyo", "oyxyyyyyyvyo", "oyyyyyyyyyyo", "oyyryyyooo..", ".oyyyyyo....", "..ooooo....."],
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
  check: ["..........oo", ".........oto", "........otto", ".oo....otto.", "otto..otto..", ".ottootto...", "..otttto....", "...otto.....", "....oo......"],
  close: ["oo......oo", "ooo....ooo", ".ooo..ooo.", "..oooooo..", "...oooo...", "...oooo...", "..oooooo..", ".ooo..ooo.", "ooo....ooo", "oo......oo"],
  plus: ["....oo....", "....oo....", "....oo....", "....oo....", "oooooooooo", "oooooooooo", "....oo....", "....oo....", "....oo....", "....oo...."],
  back: ["....oo", "...ooo", "..ooo.", ".ooo..", "ooo...", "ooo...", ".ooo..", "..ooo.", "...ooo", "....oo"],
  next: ["oo....", "ooo...", ".ooo..", "..ooo.", "...ooo", "...ooo", "..ooo.", ".ooo..", "ooo...", "oo...."],
  info: ["...oooooo...", ".oottwwttoo.", ".otttwwttto.", "otttttttttto", "otttwwwtttto", "ottttwwtttto", "ottttwwtttto", "ottttwwtttto", ".ottwwwwtto.", ".oottttttoo.", "...oooooo..."],
  play: ["oo......", "oyoo....", "oyyyoo..", "oyyyyyoo", "oyyyyyyo", "oyyyyyoo", "oyyyoo..", "oyoo....", "oo......"],
  todo: ["....oooo....", ".oooyyyyooo.", ".owwoooowwo.", ".owwwwwwwwo.", ".owvwgggwwo.", ".owwwwwwwwo.", ".owvwgggwwo.", ".owwwwwwwwo.", ".owvwggwwwo.", ".owwwwwwwwo.", ".oooooooooo."],
  // Ikon project
  bag: ["....oooo....", "...o....o...", "...o....o...", ".oooooooooo.", ".oppppppppo.", ".oppppppppo.", ".opppwwpppo.", ".oppppppppo.", ".oppppppppo.", ".oooooooooo."],
  book: [".oooo..oooo.", "owwwwoowwwwo", "owggwoowggwo", "owwwwoowwwwo", "owggwoowggwo", "owwwwoowwwwo", "owggwoowggwo", "owwwwoowwwwo", "otttttttttto", ".oooooooooo."],
  books: ["....oooo....", "oooootto....", "oppoottooooo", "oppoottooyyo", "owwoowwooyyo", "oppoottoowwo", "oppoottooyyo", "oppoottooyyo", "owwoowwooyyo", "oooooooooooo"],
  flask: ["...oooooo...", "....owwo....", "....owwo....", "....owwo....", "...owwwwo...", "..owwwwwwo..", ".otttttttto.", "otttwtttttto", "ottttttwttto", "otttttttttto", ".oooooooooo."],
  compass: ["...oooooo...", ".oowwwwwwoo.", ".owwwwwxwwo.", "owwwwwxxwwwo", "owwwwxxwwwwo", "owwwwoowwwwo", "owwwggwwwwwo", "owwwggwwwwwo", ".owggwwwwwo.", ".oowwwwwwoo.", "...oooooo..."],
  clapper: ["oooooooooooo", "owwoowwoowwo", "oooooooooooo", "ovvvvvvvvvvo", "ovvvvvvvvvvo", "ovvvvvvvvvvo", "ovvvvvvvvvvo", "ovvvvvvvvvvo", "oooooooooooo"],
  // Avatar worker
  star: [".....oo.....", "....oyyo....", "....oyyo....", "ooooyyyyoooo", "oyyyyyyyyyyo", ".oyyyyyyyyo.", "..oyyyyyyo..", "..oyyyyyyo..", ".oyyyooyyyo.", ".oyyo..oyyo.", ".ooo....ooo."],
  bolt: ["......oooo..", ".....oyyo...", "....oyyo....", "...oyyo.....", "..oyyyyyyo..", "..ooooyyo...", ".....oyyo...", "....oyyo....", "...oyyo.....", "...ooo......"],
  fox: ["o..........o", "oo........oo", "oro......oro", "orro....orro", "orrroooorrro", "orrrrrrrrrro", "orrorrrrorro", "owwrrrrrrwwo", ".owwwwwwwwo.", "..owwoowwo..", "...owwwwo...", "....oooo...."],
  unicorn: [".....o......", "....oyo.....", "....oyo.....", ".oo.oooo.oo.", ".opowwwwopo.", ".owwwwwwwwo.", "owwowwwwowwo", "owwwwwwwwwwo", "owpwwwwwwpwo", ".owwwwwwwwo.", "..owwwwwwo..", "...oooooo..."],
  invader: ["..v......v..", "...v....v...", "..vvvvvvvv..", ".vvovvvvovv.", "vvvvvvvvvvvv", "v.vvvvvvvv.v", "v.v......v.v", "...vv..vv..."],
  whale: ["........t.t.", ".........t..", "..oooooo....", ".otttttto.oo", "otottttttoto", "ottttttttto.", "owwwwwwwwo..", ".owwwwwwo...", "..oooooo...."],
  penguin: ["...oooooo...", "..oooooooo..", ".oowwoowwoo.", ".owowwwwowo.", ".owwwyywwwo.", "ooowwwwwwooo", "ooowwwwwwooo", ".oowwwwwwoo.", "..oowwwwoo..", "..yy....yy.."],
  panda: [".oo......oo.", "oo.oooooo.oo", "..owwwwwwo..", ".owwwwwwwwo.", ".owoowwoowo.", "owwoowwoowwo", "owwwwwwwwwwo", "owwwwoowwwwo", ".owwwwwwwwo.", "..oooooooo.."],
  owl: [".o........o.", ".oo......oo.", ".orooooooro.", ".orrrrrrrro.", "orwwwrrwwwro", "orwowrrwowro", "orwwwyywwwro", "orrrryyrrrro", "orryrrrryrro", ".orrrrrrrro.", "...yy..yy..."],
  octopus: ["...oooooo...", "..oppppppo..", ".oppppppppo.", ".oppoppoppo.", ".oppppppppo.", ".oppppppppo.", "oppppppppppo", "opoppoppoppo", "oo.oo.oo.oo."],
  bee: ["...oo.oo....", "..owwowwo...", "..owwowwo...", ".oooooooooo.", "oyyoyyoyyyo.", "oyyoyyoyyoyo", "oyyoyyoyyyo.", ".oooooooooo."],
  turtle: ["..ooooo.....", ".ottytto....", "otyyyyyto.oo", "otttyttttoyo", "oooooooooooo", ".oy....oy..."],
  parrot: ["...oooo.....", "..oxxxxo....", ".oxxwoxo....", ".oxxxxxoo...", ".oxxxxoyyo..", ".oxxxxxoyo..", ".otttttoo...", ".ottttto....", "..otttyo....", "..oyyyo.....", "...ooo......"],
  lion: ["..oooooooo..", ".orrrrrrrro.", "orroooooorro", "oroyyyyyyoro", "oroyoyyoyoro", "oroyyyyyyoro", "oroyyooyyoro", "oroyyyyyyoro", "orroooooorro", ".orrrrrrrro.", "..oooooooo.."],
  koala: [".ooo....ooo.", "ogggo..ogggo", "oggggggggggo", ".oggggggggo.", ".ogoggggogo.", ".ogggoogggo.", ".ogggoogggo.", "..oggggggo..", "...oooooo..."],
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

// Emoji pilihan (ikon project, avatar worker) yang punya versi pixel.
const EMOJI: Record<string, PxName> = {
  "🛍": "bag", "📖": "book", "📚": "books", "🎨": "palette", "🔬": "flask", "🧪": "flask", "⚙": "gear", "📣": "mention",
  "💡": "idea", "🗓": "calendar", "📅": "calendar", "🚀": "rocket", "🧭": "compass", "🎬": "clapper", "📁": "folder", "📋": "todo",
  "🦄": "unicorn", "👾": "invader", "🐳": "whale", "🐋": "whale", "🐧": "penguin", "⭐": "star", "🌟": "star", "⚡": "bolt", "🦊": "fox",
  "🐼": "panda", "🦉": "owl", "🐙": "octopus", "🐝": "bee", "🐢": "turtle", "🦜": "parrot", "🦁": "lion", "🐨": "koala", "🤖": "agent",
  // Emoji yang sering muncul di teks (komentar, hasil agen, judul): ikut jadi pixel.
  "✅": "done", "✔": "check", "☑": "done", "✓": "check", "✏": "edit", "📝": "edit", "🔒": "lock", "🔐": "lock", "🔓": "unlock",
  "🌙": "moon", "😴": "moon", "💤": "moon", "💬": "chat", "🗨": "chat", "🔁": "refresh", "🔄": "refresh", "☕": "coffee", "🌴": "coffee",
  "⚠": "alert", "❗": "alert", "‼": "alert", "🆘": "alert", "📄": "file", "📃": "file", "📑": "file", "☀": "sun", "🌞": "sun",
  "🔴": "dot-late", "🟠": "dot-risk", "🟢": "dot-on", "🟡": "dot-wait", "⚪": "dot-off", "⚫": "dot-off", "🏢": "office", "🏬": "office",
  "🏠": "home", "🏡": "home", "👀": "eyes", "👁": "eyes", "🎉": "party", "🥳": "party", "🎊": "party", "🔨": "doing", "🛠": "gear", "🔧": "gear",
  "👋": "wave", "🙋": "person", "👤": "person", "🧑": "person", "👩": "person", "👨": "person", "👥": "team", "🤝": "team", "✨": "sparkle",
  "📎": "clip", "🖇": "clip", "🔔": "bell", "🛋": "lounge", "📊": "chart", "📈": "chart", "📉": "chart", "🖼": "image", "🌐": "web", "🔗": "web",
  "📌": "pin", "📍": "pin", "⏸": "pause", "⏰": "clock", "⏱": "clock", "🕒": "clock", "⌛": "clock", "⏳": "clock", "❌": "failed", "⛔": "failed",
  "🚫": "failed", "🔥": "busy", "💼": "hire", "📧": "mail", "✉": "mail", "📨": "mail", "📬": "mail", "📥": "mail", "🗂": "folder", "📂": "folder",
  "🖥": "monitor", "💻": "monitor", "📆": "calendar", "🧠": "idea", "🏆": "star", "💪": "bolt", "📦": "bag", "🎯": "compass", "👌": "check",
  "🚦": "todo", "🗒": "todo", "🧾": "todo", "📢": "mention",
  "ℹ": "info", "▶": "play", "⏩": "play", "➡": "next", "⬅": "back", "➕": "plus", "✖": "close", "❎": "close",
};
export const pxFor = (e?: string | null): PxName | null => (e ? EMOJI[e.replace(/\uFE0F/g, "").trim()] ?? null : null);

// Emoji di dalam teks bebas: yang punya versi pixel diganti, sisanya tetap emoji.
const EMOJI_RE = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|[✓✔]\uFE0F?)/gu;

/** Teks biasa (judul, keterangan) dengan emoji yang diganti ikon pixel. */
export function PxText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(EMOJI_RE);
  return <>{parts.map((p, i) => { const n = i % 2 ? pxFor(p) : null; return n ? <Px key={i} name={n} /> : p; })}</>;
}

// Untuk ReactMarkdown: emoji di teks hasil agen / komentar jadi ikon pixel (kode dibiarkan apa adanya).
type HNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HNode[] };
export function rehypePx() {
  const walk = (n: HNode) => {
    if (!n.children || n.tagName === "code" || n.tagName === "pre") return;
    n.children = n.children.flatMap(c => {
      if (c.type !== "text" || !c.value) { walk(c); return [c]; }
      const parts = c.value.split(EMOJI_RE);
      if (parts.length === 1) return [c];
      return parts.flatMap((p, i): HNode[] => {
        if (!p) return [];
        const name = i % 2 ? pxFor(p) : null;
        return name ? [{ type: "element", tagName: "span", properties: { dataPx: name }, children: [] }] : [{ type: "text", value: p }];
      });
    });
  };
  return (tree: HNode) => walk(tree);
}
/** Pasangan rehypePx: ubah penanda tadi jadi <Px>. */
export function PxSpan(props: Record<string, unknown> & { node?: unknown; children?: ReactNode }) {
  const { node: _n, ...rest } = props;
  const name = rest["data-px"] as PxName | undefined;
  return name ? <Px name={name} /> : <span {...(rest as HTMLAttributes<HTMLSpanElement>)} />;
}

/** Emoji pilihan orang (ikon project / avatar): tampil sebagai ikon pixel kalau ada versinya, kalau tidak tetap emoji. */
export function Emo({ e, size }: { e: string; size?: number | string }) {
  const n = pxFor(e);
  return n ? <Px name={n} size={size} /> : <>{e}</>;
}
