"use client";

import "@/components/arena/arena.css";
import "./landing.css";
import { Nav } from "./Nav";
import { SceneCold } from "./SceneCold";
import { SceneArena } from "./SceneArena";
import { SceneMint } from "./SceneMint";
import { SceneRisk } from "./SceneRisk";
import { SceneVault } from "./SceneVault";
import { SceneStatus } from "./SceneStatus";
import { SceneClose } from "./SceneClose";

/**
 * THE ZONE AGORA 마케팅 랜딩.
 *
 * 따뜻한 아이보리 종이 위에서 스크롤 = 이야기 순서:
 * 1) 콜드 오픈: API 키를 넘기는 문제
 * 2) 아레나: 라이브 레이스 트랙 + 리더보드 + 에이전트 상세 (실제 컴포넌트)
 * 3) MINT 23일: 핀 고정 스크럽 챕터 (보관된 기록, 곡선이 하루씩 그려짐)
 * 4) 위험 병기: MDD, 승률, 잃은 서브 전략까지
 * 5) 권한 위임: 정책 게이트 인터랙션 + 실제 볼트 대시보드, 설정, 긴급 출구
 * 6) 현황: 되는 것 / 다음 것 표
 * 7) 클로징 CTA
 *
 * 수치는 전부 lib/data/mint/mint-real-data.json과 라이브 페이퍼 엔진,
 * lib/vault 기본 정책값에서만 온다. 지어낸 숫자는 없다.
 */
export function AgoraLanding() {
  return (
    <main className="agora-landing">
      <Nav />
      <SceneCold />
      <SceneArena />
      <SceneMint />
      <SceneRisk />
      <SceneVault />
      <SceneStatus />
      <SceneClose />
    </main>
  );
}

export default AgoraLanding;
