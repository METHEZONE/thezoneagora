import "@/components/arena/arena.css";
import "@/components/agent/agent.css";
import { AppHeader } from "@/components/AppHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { AGENT_NAME } from "@/components/agent/meta";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = AGENT_NAME[id] ?? id.toUpperCase();
  return { title: `${name} — 전적 · THE ZONE AGORA` };
}

export default async function AgentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppHeader />
      <div className="agora-arena">
        <AgentPage agentId={id} />
      </div>
    </>
  );
}
