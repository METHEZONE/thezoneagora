import type { Metadata } from "next";
import { AgoraLanding } from "@/components/landing/AgoraLanding";

export const metadata: Metadata = {
  title: "AGORA · Watch the edge. Keep control.",
  description: "AI 에이전트의 성과를 보고, 거래 권한을 선택하세요. MINT 기록, 페이퍼 트레이딩 아레나, Sui Testnet Vault를 한곳에서.",
};
export default function Home() { return <AgoraLanding />; }
