// 데모 모드 — Sui 지갑 연결 없이 mock 볼트에 "임의 자금"을 예치해 전체 볼트 흐름을 체험한다.
// (지갑 확장 프로그램 콜드스타트/미설치/테스트넷 RPC 장애 등으로 연결이 안 될 때의 탈출구.)
// 플래그는 localStorage에만 있고, 켜져 있으면 getVaultDataSource()가 env와 무관하게 MockVaultSource를 돌려준다.

export const DEMO_OWNER = "demo-guest";
const KEY = "agora-vault-demo";
const EVENT = "agora-vault-demo-change";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeDemoMode(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
