import { loadWorkspace, workspaces } from "@/lib/multica";
import { buildBoard } from "@/lib/crew";
import Shell from "../shell";
import BoardView from "./board-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Task Board · Virtual Office" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ws?: string; p?: string }> }) {
  const { ws, p } = await searchParams;
  try {
    const all = await workspaces();
    const snap = await loadWorkspace(ws);
    const board = buildBoard(snap);
    const buildings = all.map(w => ({ id: w.id, slug: w.slug, name: w.name }));
    return (
      <Shell buildings={buildings} current={buildings.find(b => b.id === snap.workspace.id)!} section="papan">
        <BoardView board={board} initialProject={p ?? "all"} />
      </Shell>
    );
  } catch (e) {
    return <main className="wrap" style={{ paddingBlock: 40 }}><div className="err"><h2>The board couldn't load</h2><p>{e instanceof Error ? e.message : String(e)}</p></div></main>;
  }
}
