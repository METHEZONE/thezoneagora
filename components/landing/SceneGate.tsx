"use client";

import { useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { AgentCharacter } from "@/components/arena/characters";
import { DEFAULT_RISK_POLICY } from "@/lib/vault/types";
import { useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;

// 실제 온보딩 기본 정책값에서 파생 (USDC 6 decimals).
const PER_TRADE_LIMIT = Number(DEFAULT_RISK_POLICY.maxTradeAmount) / 1_000_000;
const EPOCH_LIMIT = Number(DEFAULT_RISK_POLICY.maxEpochTradeAmount) / 1_000_000;
const LOSS_LIMIT = Number(DEFAULT_RISK_POLICY.maxLossAmount) / 1_000_000;

interface LogLine {
  id: number;
  time: string;
  text: string;
  tone: "pass" | "block" | "info";
}

function now(): string {
  return new Date().toTimeString().slice(0, 8);
}

export function SceneGate() {
  const motionOk = useMotionOk();
  const laneRef = useRef<HTMLDivElement>(null);
  const token = useAnimationControls();
  const busyRef = useRef(false);
  const idRef = useRef(0);

  const [killed, setKilled] = useState(false);
  const [flash, setFlash] = useState<"" | "pass" | "block">("");
  const [log, setLog] = useState<LogLine[]>([]);

  function pushLog(text: string, tone: LogLine["tone"]) {
    idRef.current += 1;
    setLog((prev) => [{ id: idRef.current, time: now(), text, tone }, ...prev].slice(0, 4));
  }

  function flashGate(kind: "pass" | "block") {
    setFlash(kind);
    setTimeout(() => setFlash(""), 700);
  }

  async function fire(kind: "normal" | "over" | "kill") {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      if (kind === "kill") {
        setKilled(true);
        pushLog(`킬 스위치 작동 · 에이전트 PAUSED · 이후 모든 신호 거부`, "block");
        return;
      }

      const amount = kind === "normal" ? 80 : 240;
      const label = `매수 신호 ${amount} USDC`;
      const lane = laneRef.current;
      const width = lane ? lane.clientWidth : 0;
      const mid = Math.max(width / 2 - 40, 0);
      const end = Math.max(width - 80, 0);

      if (!motionOk || width === 0) {
        // 모션 없이 결과만.
        if (killed) {
          flashGate("block");
          pushLog(`${label} · 에이전트 정지 상태 · 거부`, "block");
        } else if (kind === "normal") {
          flashGate("pass");
          pushLog(`${label} · 1회 한도 ${PER_TRADE_LIMIT} USDC 이내 · 통과, 볼트에서 체결`, "pass");
        } else {
          flashGate("block");
          pushLog(`${label} · 1회 한도 ${PER_TRADE_LIMIT} USDC 초과 · 거부`, "block");
        }
        return;
      }

      token.set({ x: 0, opacity: 0, scale: 1 });
      await token.start({ opacity: 1, transition: { duration: 0.12 } });
      await token.start({ x: mid, transition: { duration: 0.55, ease: EASE } });

      if (killed) {
        flashGate("block");
        await token.start({
          x: mid - 26,
          opacity: 0,
          transition: { duration: 0.4, ease: EASE },
        });
        pushLog(`${label} · 에이전트 정지 상태 · 거부`, "block");
      } else if (kind === "normal") {
        flashGate("pass");
        await token.start({ x: end, transition: { duration: 0.55, ease: EASE } });
        await token.start({ scale: 0.4, opacity: 0, transition: { duration: 0.3 } });
        pushLog(`${label} · 1회 한도 ${PER_TRADE_LIMIT} USDC 이내 · 통과, 볼트에서 체결`, "pass");
      } else {
        flashGate("block");
        await token.start({
          x: mid - 26,
          opacity: 0,
          transition: { duration: 0.4, ease: EASE },
        });
        pushLog(`${label} · 1회 한도 ${PER_TRADE_LIMIT} USDC 초과 · 거부`, "block");
      }
    } finally {
      busyRef.current = false;
    }
  }

  function reset() {
    setKilled(false);
    pushLog("에이전트 재개 · ACTIVE", "info");
  }

  return (
    <div className="ag-gate-stage">
      <div className="ag-gate-lane" ref={laneRef}>
        <div className="ag-gate-rail" aria-hidden="true" />

        <div className="ag-gate-node" style={{ left: 40 }}>
          <div className={`ag-gate-agent${killed ? " paused" : ""}`}>
            <AgentCharacter agentId="mint" size={36} label="에이전트" />
          </div>
          <span className="lb">에이전트{killed ? " · PAUSED" : ""}</span>
        </div>

        <div className="ag-gate-node" style={{ left: "50%" }}>
          <div className={`ag-gate-bars${killed ? " closed" : ""}${flash ? ` ${flash}` : ""}`}>
            <span className="ag-gate-ring" aria-hidden="true" />
            <span className="ag-gate-shutter" aria-hidden="true" />
          </div>
          <span className="lb">정책 게이트</span>
        </div>

        <div className="ag-gate-node" style={{ left: "100%", marginLeft: -40 }}>
          <div className="ag-gate-vault">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="2" y="2" width="18" height="18" rx="4" fill="none" stroke="#11100F" strokeWidth="2" />
              <circle cx="11" cy="11" r="4" fill="none" stroke="#11100F" strokeWidth="2" />
              <line x1="11" y1="11" x2="14" y2="8" stroke="#11100F" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="lb">내 볼트</span>
        </div>

        <motion.span className="ag-gate-token" animate={token} initial={{ opacity: 0 }} aria-hidden="true" />
      </div>

      <div className="ag-gate-actions">
        <button type="button" onClick={() => fire("normal")}>
          정상 신호
        </button>
        <button type="button" onClick={() => fire("over")}>
          한도 초과 신호
        </button>
        <button type="button" onClick={() => fire("kill")} disabled={killed}>
          킬 스위치
        </button>
        {killed && (
          <button type="button" className="reset" onClick={reset}>
            에이전트 재개
          </button>
        )}
      </div>

      <div className="ag-gate-log" aria-live="polite">
        <AnimatePresence initial={false}>
          {log.map((l) => (
            <motion.div
              key={l.id}
              initial={motionOk ? { opacity: 0, y: -8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span>{l.time}</span>
              <b
                className={
                  l.tone === "pass" ? "ag-up" : l.tone === "block" ? "ag-dn" : undefined
                }
              >
                {l.text}
              </b>
            </motion.div>
          ))}
        </AnimatePresence>
        {log.length === 0 && (
          <div>
            <span>--:--:--</span>
            <b>버튼을 눌러 신호를 보내 보세요</b>
          </div>
        )}
      </div>

      <p className="ag-gate-policy">
        볼트 온보딩 기본 정책 그대로: 1회 한도 {PER_TRADE_LIMIT} USDC · epoch 누적{" "}
        {EPOCH_LIMIT} USDC · 누적 손실 {LOSS_LIMIT} USDC 도달 시 킬 스위치
      </p>
    </div>
  );
}
