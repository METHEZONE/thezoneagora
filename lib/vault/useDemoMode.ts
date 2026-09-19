"use client";

import { useEffect, useState } from "react";
import { isDemoMode, subscribeDemoMode } from "@/lib/vault/demo";

/** localStorage 데모 플래그를 React 상태로. SSR에서는 항상 false, 마운트 후 실제 값으로. */
export function useDemoMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isDemoMode());
    return subscribeDemoMode(() => setOn(isDemoMode()));
  }, []);
  return on;
}
