"use client";

import { useEffect, useState } from "react";

/**
 * true면 모션을 재생해도 된다.
 * - prefers-reduced-motion: reduce
 * - 네비게이션의 "모션 정지" 토글 (document.documentElement.dataset.agoraPaused,
 *   'agora-motion-change' 이벤트)
 * 둘 중 하나라도 걸리면 false.
 */
export function useMotionOk(): boolean {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setOk(!query.matches && document.documentElement.dataset.agoraPaused !== "true");
    sync();
    query.addEventListener("change", sync);
    window.addEventListener("agora-motion-change", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("agora-motion-change", sync);
    };
  }, []);

  return ok;
}

/** SSR/hydration 안전 마운트 가드. 라이브 엔진을 쓰는 프레임은 마운트 후에만 그린다. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
