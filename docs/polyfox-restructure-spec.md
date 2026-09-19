# THE ZONE AGORA — Polyfox 레퍼런스 기반 프론트 재구성 스펙

작성 2026-09-19 · 목표: Blockthon 본선 데모 · 한국어 · 데스크톱 우선 · real Sui Testnet

## 0. 레퍼런스에서 가져오는 것 / 버리는 것

Polyfox(`polyfox.co/smart-wallets`) 구조에서 가져오는 것:
- 단일 종합점수(Score) 기반 리더보드 테이블 + 정렬 탭 + 기간 토글 + 집계 스트립
- "처음이세요? X가 1위 · +N% → 바로" 훅 배너
- 상세 페이지: 헤더(점수/순위/CTA 2개) · 차트 기간탭 · Returns/Risk/Activity 3카드 · 탭
- 하단 스티키 바: "$10,000 맡겼으면 → $X · +N% [지금 맡기기]"
- 백테스트: 입력(금액/기간) → 헤드라인 → 3카드 → Time Machine 리플레이 → 거래 로그 → "이 결과로 맡기기"

버리는 것: 지갑 주소 검색, 카테고리 필터(정치/스포츠), 슬리피지·카피비율·TP/SL 고급 필터, 영어, 텔레그램 CTA.

Agora에서 유지하는 것: 캐릭터 5종, 레이스트랙 히어로, 라이브 티커, 온보딩 3단 오버레이, 신뢰 섹션, 볼트 온보딩(지갑→USDC→볼트) 3단계, 리스크 정책 설정, 긴급탈출.

## 1. 데이터 레이어 — 두 시계

| 시계 | 소스 | 쓰는 곳 |
|---|---|---|
| 빠른 시계 (라이브) | `LiveStrategyEngine` (브라우저, 실시세 틱, localStorage) | 레이스트랙 위치, 라이브 티커, 활동 피드, "지금" 배지 |
| 느린 시계 (리플레이) | 서버 `lib/backtest/*` — Binance 1h klines(7D=168, 30D=720) 위에서 5개 전략 결정론적 재생 | 리더보드 7D/30D 컬럼, AGORA 점수, 상세 페이지 지표, 백테스트 |

리플레이는 결정론적이어야 한다: `verifySignal`의 `Math.random()` 노이즈는 백테스트에서 seeded PRNG(agentId+index)로 대체.

### API
- `GET /api/replay?window=7d|30d` → 5개 에이전트 요약(equity curve, 지표, 점수). 서버 캐시 5분.
- `GET /api/backtest?agent=atlas&window=30d&capital=10000` → 단일 에이전트 풀 결과(캔들, 거래 목록, equity curve, 지표, hold 벤치마크).

## 2. AGORA 점수 (0~100)

가중합, 각 항목 0~1로 정규화 후 ×가중치:
- **수익률 30**: window ROI. 정규화 `clamp((roi + 10) / 30, 0, 1)` (−10%→0, +20%→1)
- **위험조정 30**: ROI ÷ MDD (Calmar류). `clamp((calmar + 1) / 4, 0, 1)` (−1→0, 3→1). MDD<0.5%면 0.5%로 바닥.
- **일관성 20**: 승률 0.5 + 수익 난 일(日) 비율 0.5. 거래 0회면 0.25 고정(무활동 페널티).
- **최근 추세 20**: 최근 7D ROI(30D 창에선 마지막 168봉). `clamp((r7 + 5) / 15, 0, 1)`.

UI: 점수 숫자 크게, hover/클릭 시 4항목 분해 바. "점수 산정 기준" 토글에 위 공식 노출.

리스크 등급: MDD ≤ 5% 낮음 / ≤ 12% 중간 / 그 외 높음. 한 줄 문장: "최악의 경우 30일 중 −N%까지 떨어진 적 있어요".

## 3. 라우트 / 컴포넌트

```
/app                      아레나 홈 (기존) — RaceTrack 유지, Leaderboard → LeaderboardTable로 교체
/agent/[id]               에이전트 전용 페이지 (신규)
/agent/[id]/backtest      백테스트 (신규, 상세 페이지 탭으로도 접근)
/vault, /vault/[strategyId], /vault/onboarding?strategy=&amount=   기존 + amount 프리필
```

컴포넌트(신규, `components/agent/*`):
- `HookBanner` — "처음이세요? {top}가 이번 시즌 1위 · {roi} → 바로 맡기기"
- `LeaderboardTable` — 정렬탭(종합점수/수익률/안정성) · 기간토글(7D/30D=시즌) · 집계스트립 · 행: 순위/캐릭터/이름+전략칩/점수(링)/수익률/$10,000→X/리스크등급+MDD/승률·거래수/스파크라인/백커(mock)/[맡기기][백테스트]
- `AgentHero` — 캐릭터 큼, 이름, 전략, 심볼, 점수 배지, 순위, CTA(맡기기 / 백테스트)
- `PriceEquityChart` — lightweight-charts: 가격선 + 매수▲/매도▼ 마커 + (백테스트 시) 에이전트 equity vs 그냥 들고있기 벤치마크
- `MetricCards` — 수익 / 리스크 / 활동 3카드
- `ScoreBreakdown` — 4항목 바
- `StickyDelegateBar` — "$10,000 맡겼으면 → $X · +N%" + [지금 맡기기]
- `BacktestForm` — 금액 프리셋($1,000/$10,000/$50,000/직접입력) + 기간(7D/30D) + [백테스트 실행]
- `TimeMachine` — 재생/정지/스텝/속도(1×4×16×)/슬라이더, 차트 커서 + 거래로그 하이라이트 + 잔고 카운터 동기화
- `TradeLog` — 시각 · 매수/매도 · 가격 · 수량 · 손익 · 잔고 (거부된 시그널은 회색 행으로 남김)

DetailSheet: 요약 유지 + "전적 자세히 보기 →"(`/agent/[id]`) + "백테스트" 버튼.

## 4. 정직성 표기
- 푸터: "성과는 실시세 기반 페이퍼 트레이딩 · 7D/30D 지표는 Binance 1시간봉 리플레이 · 백커 수/위임 자본은 데모 시드값"
- 백테스트 결과 하단: "과거 시세 기반 시뮬레이션이며 미래 수익을 보장하지 않습니다"
- 손실 난 에이전트도 그대로 노출 (지우지 않는다).

## 5. 시즌
"시즌 1 · LIVE" 라벨 유지, 숫자는 최근 30일 롤링. 시작일 언급 제거.

## 6. 타이포
한국어는 Pretendard (CDN dynamic subset) 를 `--font-sans` 뒤 폴백으로 추가, letter-spacing −0.01em 유지. 숫자는 tabular-nums.
