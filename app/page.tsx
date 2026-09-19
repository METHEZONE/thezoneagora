import "@/components/arena/arena.css";
import { ArenaHome } from "@/components/arena/ArenaHome";
import { AppHeader } from "@/components/AppHeader";

// /agora 루트가 곧 아레나(예전 /agora/app)다 — 스토리텔링형 랜딩(예전 /agora 콘텐츠)은
// /agora/story로 옮겼다. "/agora/app"도 하위호환으로 계속 살아있다 (app/app/page.tsx).
export default function Home() {
  return <><AppHeader /><ArenaHome /></>;
}
