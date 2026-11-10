// Jalankan penjaga kantor sekali. Dipakai jadwal GitHub (tiap 30 menit) dan untuk uji: --uji (tidak mengubah apa pun).
import { runWatchdog } from "../lib/watchdog";

const dryRun = process.argv.includes("--uji");
// --kuota=claude: pura-pura kuota Claude habis (hanya bersama --uji).
const sim = process.argv.find(a => a.startsWith("--kuota="));
if (dryRun && sim) process.env.KANTOR_UJI_KUOTA = sim.split("=")[1];
if (!process.env.MULTICA_TOKEN && process.env.GITHUB_ACTIONS) {
  console.log("MULTICA_TOKEN belum diisi di GitHub Secrets. Penjaga dilewati.");
  process.exit(0);
}
runWatchdog({ dryRun }).then(r => {
  console.log(r.length ? r.join("\n") : "Tidak ada yang perlu dilakukan.");
}).catch(e => { console.error("Penjaga gagal:", e instanceof Error ? e.message : e); process.exit(1); });
