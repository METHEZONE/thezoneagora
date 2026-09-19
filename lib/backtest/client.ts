"use client";

import { useEffect, useState } from "react";
import type { BacktestWindow } from "@/lib/backtest/klines";
import type { BtResult } from "@/lib/backtest/engine";
import type { ReplayBoard } from "@/lib/backtest/service";

// 브라우저 측 느린 시계 클라이언트. 모듈 메모리 캐시 + 진행 중 요청 dedupe.
// basePath("/agora")는 fetch에 자동 적용되지 않으므로 직접 붙인다.

const BASE = "/agora/api";
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const TTL = 5 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const running = inflight.get(url);
  if (running) return running as Promise<T>;
  const p = (async () => {
    const res = await fetch(url);
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    cache.set(url, { at: Date.now(), data: json });
    inflight.delete(url);
    return json;
  })();
  inflight.set(url, p);
  return p;
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useReplayBoard(window: BacktestWindow): AsyncState<ReplayBoard> {
  const [state, setState] = useState<AsyncState<ReplayBoard>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getJson<ReplayBoard>(`${BASE}/replay?window=${window}`)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [window]);
  return state;
}

export function useBacktest(
  agentId: string | null,
  window: BacktestWindow,
  capital: number
): AsyncState<BtResult> {
  const [state, setState] = useState<AsyncState<BtResult>>({ data: null, error: null, loading: !!agentId });
  useEffect(() => {
    if (!agentId) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getJson<BtResult>(`${BASE}/backtest?agent=${agentId}&window=${window}&capital=${capital}`)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [agentId, window, capital]);
  return state;
}

export function fetchBacktest(agentId: string, window: BacktestWindow, capital: number): Promise<BtResult> {
  return getJson<BtResult>(`${BASE}/backtest?agent=${agentId}&window=${window}&capital=${capital}`);
}
