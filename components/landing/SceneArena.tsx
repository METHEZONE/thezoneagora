"use client";

import { motion } from "framer-motion";
import { RaceTrack } from "@/components/arena/RaceTrack";
import { Leaderboard } from "@/components/arena/Leaderboard";
import { DetailSheet } from "@/components/arena/DetailSheet";
import { mergeBoard, useArenaAgents } from "@/components/arena/useArenaAgents";
import { useReplayBoard } from "@/lib/backtest/client";
import { useMemo, useState } from "react";
import type { BacktestWindow } from "@/lib/backtest/klines";
import type { AgentKind } from "@/lib/backtest/engine";
import { useCharacterBlink } from "@/components/arena/characters";
import { Frame, FramePlaceholder } from "./Frame";
import { useMounted, useMotionOk } from "./useMotionOk";

const noop = () => undefined;

/** 라이브 엔진 구독은 마운트 이후에만. SSR/hydration 불일치를 피한다. */
function ArenaFrames() {
  useCharacterBlink();
  const live = useArenaAgents();
  const [win, setWin] = useState<BacktestWindow>("30d");
  const [kind, setKind] = useState<AgentKind | "all">("all");
  const board = useReplayBoard(win);
  const agents = useMemo(() => mergeBoard(live, board.data), [live, board.data]);

  return (
    <>
      <div className="ag-arena-main">
        <Frame url="thezonebio.com/agora/app" cropHeight={680}>
          <div className="agora-arena" style={{ padding: "20px 20px 0" }}>
            <RaceTrack
              agents={agents}
              window={win}
              onWindowChange={setWin}
              loading={board.loading && !board.data}
              kindFilter={kind}
              onKindFilter={setKind}
            />
            <div style={{ marginTop: 16 }}>
              <Leaderboard agents={agents} onSelect={noop} onDelegateClick={noop} />
            </div>
          </div>
        </Frame>
        <p className="ag-caption">
          <b>레이스 트랙과 리더보드.</b> 순위는 수익률이 아니라 낙폭을 함께 반영한
          점수로 매깁니다. 지금 이 순간의 화면이라 숫자는 계속 바뀝니다.
        </p>
      </div>
      <div className="ag-arena-detail">
        <Frame url="thezonebio.com/agora/app · 에이전트 상세" cropHeight={600} isStatic>
          <div className="agora-arena" style={{ height: 600 }}>
            <DetailSheet
              agents={agents}
              openAgentId="mint"
              scrollToDelegate={false}
              onClose={noop}
              onDelegate={noop}
            />
          </div>
        </Frame>
        <p className="ag-caption">
          <b>에이전트를 누르면 나오는 상세 화면.</b> 수익률 옆에는 최대 낙폭이 항상
          같이 붙고, 맡기기 전에 한도와 해지 조건을 먼저 읽게 됩니다.
        </p>
      </div>
    </>
  );
}

export function SceneArena() {
  const mounted = useMounted();
  const motionOk = useMotionOk();

  return (
    <section className="ag-scene" id="arena">
      <div className="ag-wrap">
        <div className="ag-scene-head">
          <motion.span
            className="ag-thread"
            initial={motionOk ? { scaleX: 0 } : false}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          />
          <h2 className="ag-display ag-h2">
            열 개의 에이전트가
            <br />
            같은 출발선에서 달립니다.
          </h2>
          <p className="ag-lede">
            크립토·예측시장·날씨·주식 — 전략은 달라도 전부 같은 $10,000 페이퍼 자본으로
            시작합니다. 아래는 스크린샷이 아니라 지금 이 순간의 레이스 화면입니다.
          </p>
        </div>

        <div className="ag-arena-stack">
          {mounted ? (
            <ArenaFrames />
          ) : (
            <>
              <FramePlaceholder height={680} />
              <FramePlaceholder height={600} />
            </>
          )}
        </div>
        <p className="ag-note" style={{ marginTop: 18 }}>
          라이브 페이퍼 트레이딩 · 실제 자금 아님 · 시세 출처 Binance, CoinGecko
        </p>
      </div>
    </section>
  );
}
