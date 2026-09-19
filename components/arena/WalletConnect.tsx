"use client";

/**
 * 온보딩 3단계 "지갑 연결" / 상세 시트 "맡기기" 흐름에서 쓰는 지갑 연결 컨텍스트.
 * design/agora-arena.html의 지갑 모달(.modal/.w-opt/.w-skip)을 그대로 포팅한다 —
 * 실제 감지된 Sui 지갑 목록 + 맨 아래 "데모로 둘러보기" 스킵.
 * 스킵을 고르면 지갑 연결 없이 콜백을 그대로 이어간다(게스트/데모 모드).
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit";
import "@/components/arena/arena.css";

interface WalletConnectContextValue {
  connected: boolean;
  address: string | null;
  /** 지갑 연결 또는 "데모로 둘러보기" 스킵 후 onDone(connected)을 호출한다. */
  requestConnect: (onDone?: (connected: boolean) => void) => void;
  disconnect: () => void;
}

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

export function WalletConnectProvider({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connectMutate } = useConnectWallet();
  const { mutate: disconnectMutate } = useDisconnectWallet();
  const [open, setOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const pendingCb = useRef<((connected: boolean) => void) | null>(null);
  const wasConnected = useRef(false);

  useEffect(() => {
    const isConnected = !!account;
    if (isConnected && !wasConnected.current && pendingCb.current) {
      const cb = pendingCb.current;
      pendingCb.current = null;
      setOpen(false);
      const t = setTimeout(() => cb(true), 300);
      wasConnected.current = isConnected;
      return () => clearTimeout(t);
    }
    wasConnected.current = isConnected;
  }, [account]);

  function requestConnect(onDone?: (connected: boolean) => void) {
    if (account) {
      onDone?.(true);
      return;
    }
    pendingCb.current = onDone ?? null;
    setConnectError(null);
    setOpen(true);
  }

  // 실패 원인을 사람이 읽을 수 있게 다듬는다 — 지갑 확장이 잠겨있거나, 사용자가
  // 확장 팝업에서 거절했거나, 확장이 아예 설치는 됐지만 세팅(계정 생성)이 안 된
  // 경우가 전부 dapp-kit 쪽에서는 구분 없는 rejection으로만 넘어온다.
  function describeWalletError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    if (lower.includes("reject") || lower.includes("denied") || lower.includes("cancel")) {
      return "지갑 확장에서 연결 요청을 거절했어요. 확장 팝업에서 다시 승인해 주세요.";
    }
    if (lower.includes("lock")) {
      return "지갑이 잠겨 있어요. 확장 아이콘을 눌러 잠금 해제 후 다시 시도해 주세요.";
    }
    if (lower.includes("no accounts") || lower.includes("not initialized") || lower.includes("no wallet")) {
      return "지갑에 계정이 없어요. 확장에서 계정을 먼저 만들거나 가져온 뒤 다시 시도해 주세요.";
    }
    return `연결에 실패했어요 (${raw || "알 수 없는 오류"}). 확장 아이콘을 눌러 팝업이 떠 있는지 확인해 주세요.`;
  }

  function handlePick(walletName: string) {
    const wallet = wallets.find((w) => w.name === walletName);
    if (!wallet) return;
    setConnectingId(walletName);
    setConnectError(null);
    connectMutate(
      { wallet },
      {
        onSettled: () => setConnectingId(null),
        // account effect가 성공 시 콜백을 이어가므로 여기선 실패만 처리한다.
        // 예전엔 실패해도 버튼만 조용히 원상복구돼서 "아무 반응 없음"으로 보였다 —
        // 이제 실제 에러를 모달에 그대로 보여준다.
        onError: (err) => setConnectError(describeWalletError(err)),
      }
    );
  }

  function handleSkip() {
    setOpen(false);
    setConnectingId(null);
    setConnectError(null);
    const cb = pendingCb.current;
    pendingCb.current = null;
    if (cb) setTimeout(() => cb(false), 150);
  }

  function disconnect() {
    pendingCb.current = null;
    disconnectMutate();
  }

  return (
    <WalletConnectContext.Provider
      value={{
        connected: !!account,
        address: account?.address ?? null,
        requestConnect,
        disconnect,
      }}
    >
      {children}
      {/*
        헤더/온보딩/위임 등 앱 전체(모든 라우트)에서 렌더되므로 `.agora-arena` 레이아웃
        스코프에 기대지 않는다 — 필요한 CSS 변수는 arena.css의 :root에, .overlay/.modal/
        .w-opt/.w-skip 규칙도 조상 클래스 없이 전역으로 정의돼 있다.
      */}
      <div className={`overlay${open ? " on" : ""}`} onClick={handleSkip} />
      <div className={`modal${open ? " on" : ""}`} role="dialog" aria-modal="true">
        <h3>지갑 연결</h3>
        <p className="sub">
          Sui 지갑으로 30초면 끝나요. 지갑이 없어도 데모로 전부 둘러볼 수 있습니다.
        </p>
        {wallets.length === 0 && (
          <p className="sub" style={{ marginTop: -10 }}>
            브라우저에서 감지된 Sui 지갑이 없습니다 — 확장 프로그램을 설치하거나 데모로
            둘러보세요.
          </p>
        )}
        {connectError && (
          <p className="sub" style={{ marginTop: -6, color: "var(--neg)", fontWeight: 600 }}>
            {connectError}
          </p>
        )}
        {wallets.map((wallet) => (
          <button
            key={wallet.name}
            type="button"
            className="w-opt"
            disabled={connectingId !== null}
            onClick={() => handlePick(wallet.name)}
          >
            {wallet.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wallet.icon} alt="" className="wi" style={{ objectFit: "contain" }} />
            ) : (
              <span className="wi" style={{ background: "#FF5A1F22" }}>
                🌊
              </span>
            )}
            {connectingId === wallet.name ? "연결 중…" : wallet.name}
          </button>
        ))}
        <button type="button" className="w-skip" onClick={handleSkip}>
          데모로 둘러보기 →
        </button>
      </div>
    </WalletConnectContext.Provider>
  );
}

export function useWalletConnect(): WalletConnectContextValue {
  const ctx = useContext(WalletConnectContext);
  if (!ctx) throw new Error("useWalletConnect must be used within WalletConnectProvider");
  return ctx;
}
