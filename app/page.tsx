import { loadWorkspace, workspaces } from "@/lib/multica";
import { buildOffice, type Office } from "@/lib/office";
import OfficeView from "./office-view";

export const dynamic = "force-dynamic";

export type Building = { id: string; slug: string; name: string; attention: number; open: boolean; switchOpen: boolean };

export default async function Page({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  try {
    const all = await workspaces();
    // Semua gedung dimuat supaya panel "Perlu Perhatian" mencakup semuanya.
    const offices: Office[] = await Promise.all(all.map(w => loadWorkspace(w.id).then(buildOffice)));
    const current = offices.find(o => o.workspaceSlug === ws || o.workspaceId === ws) ?? offices[0];
    const count = (o: Office) => o.attention.overdue.length + o.attention.human.length + o.attention.review.length + o.attention.failed.length;
    const buildings: Building[] = offices.map(o => ({ id: o.workspaceId, slug: o.workspaceSlug, name: o.workspace, attention: count(o), open: o.open, switchOpen: o.switchOpen }));
    const merged: Office["attention"] = {
      overdue: offices.flatMap(o => o.attention.overdue),
      human: offices.flatMap(o => o.attention.human),
      review: offices.flatMap(o => o.attention.review),
      failed: offices.flatMap(o => o.attention.failed),
    };
    const people = [...new Set(offices.flatMap(o => o.people))];
    return <OfficeView office={current} buildings={buildings} attention={merged} people={people} />;
  } catch (e) {
    return (
      <main className="wrap" style={{ paddingBlock: 40 }}>
        <div className="err">
          <h2>Kantor belum bisa dibuka</h2>
          <p>{e instanceof Error ? e.message : String(e)}</p>
          <p className="desc">Cek koneksi internet dan login Multica, lalu muat ulang halaman.</p>
        </div>
      </main>
    );
  }
}
