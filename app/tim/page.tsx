import { loadWorkspace, workspaces, invitations, me } from "@/lib/multica";
import { buildTeam } from "@/lib/crew";
import Shell from "../shell";
import TeamView from "./team-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team Members · Virtual Office" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  try {
    const [all, snap, who] = await Promise.all([workspaces(), loadWorkspace(ws), me().catch(() => null)]);
    const team = buildTeam(snap, await invitations(snap.workspace.id), who?.id ?? null);
    const buildings = all.map(w => ({ id: w.id, slug: w.slug, name: w.name }));
    return (
      <Shell buildings={buildings} current={buildings.find(b => b.id === snap.workspace.id)!} section="tim">
        <TeamView team={team} />
      </Shell>
    );
  } catch (e) {
    return <main className="wrap" style={{ paddingBlock: 40 }}><div className="err"><h2>The team page couldn't load</h2><p>{e instanceof Error ? e.message : String(e)}</p></div></main>;
  }
}
