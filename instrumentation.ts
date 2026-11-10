// Saat app berjalan di laptop, nyalakan penjaga kantor (lihat instrumentation-node.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.NETLIFY && !process.env.VERCEL && !process.env.KANTOR_NO_WATCHDOG) {
    await import("./instrumentation-node");
  }
}
