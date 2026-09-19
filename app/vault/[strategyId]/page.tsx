import { VaultDetail } from "@/components/vault/VaultDetail";

export default async function VaultStrategyPage({
  params,
}: {
  params: Promise<{ strategyId: string }>;
}) {
  const { strategyId } = await params;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-arena-black">
      <VaultDetail strategyId={strategyId} />
    </main>
  );
}
