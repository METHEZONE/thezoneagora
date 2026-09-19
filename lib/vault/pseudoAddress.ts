// 지갑을 아직 연결하지 않은 사용자에게도 "각 전략은 실제로 온체인 주소를 가진다"는
// 감각을 보여주기 위한 표시용 주소. 실제로 배포된 UserVault 오브젝트 ID가 아니라
// agentId를 결정적으로 해시해 만든, Sui 주소와 같은 형식(0x + 64 hex)의 예시 문자열이다
// — 새로고침해도 같은 에이전트는 항상 같은 주소를 보여준다(진짜처럼 보이되 매번 안 바뀜).
// 지갑을 연결하고 실제로 볼트를 만들면 이 자리는 진짜 vaultId로 교체된다(StrategyCard 참고).

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pseudoVaultAddress(agentId: string): string {
  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    hex += fnv1a(`agora-vault-preview:${agentId}:${i}`).toString(16).padStart(8, "0");
  }
  return `0x${hex}`;
}

/** "0x1a2b3c…f9e8" 형태로 자른다. head/tail은 "0x" 다음에 보여줄 hex 글자 수. */
export function truncateAddress(address: string, head = 6, tail = 4): string {
  const prefix = address.startsWith("0x") ? "0x" : "";
  const body = address.slice(prefix.length);
  if (body.length <= head + tail) return address;
  return `${prefix}${body.slice(0, head)}…${body.slice(-tail)}`;
}
