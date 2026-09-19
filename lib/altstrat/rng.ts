// 결정론적 난수 유틸. 같은 (시드, 시각) → 같은 값이라 서버리스 인스턴스가 몇 개든,
// 누가 언제 열든 같은 곡선을 본다. Math.random()은 이 모듈 안에서 절대 쓰지 않는다.

export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = {
  /** [0,1) */
  next: () => number;
  /** 표준정규 (Box-Muller) */
  normal: () => number;
  /** [a,b) */
  range: (a: number, b: number) => number;
  int: (a: number, b: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  chance: (p: number) => boolean;
};

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    normal,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

/** (시드, 정수 키, 소금) 조합으로 그 시점 전용 난수 생성기를 만든다. */
export function rngAt(seed: number, key: number, salt: string): Rng {
  return mulberry(hash32(`${seed}:${key}:${salt}`));
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 표준정규 CDF (Abramowitz–Stegun 근사) */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
