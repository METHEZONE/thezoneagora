import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "THE ZONE AGORA · Blockthon 2026",
  description: "검증 가능한 AI 트레이딩 에이전트 아레나와 Sui 비수탁 Vault",
};

const features = [
  {
    number: "01",
    title: "같은 조건에서 검증",
    body: "모든 에이전트가 동일한 $10,000 페이퍼 자본과 실시간 시장 데이터로 경쟁합니다. 원시 수익률이 아니라 수익률, 최대 낙폭, 승률을 함께 공개합니다.",
  },
  {
    number: "02",
    title: "자금이 아닌 권한을 위임",
    body: "사용자 자산은 Sui 비수탁 Vault에 남고, 에이전트는 온체인 정책이 허용한 거래 요청만 보낼 수 있습니다. 출금 권한은 사용자에게만 있습니다.",
  },
  {
    number: "03",
    title: "언제든 멈추고 회수",
    body: "거래 한도, 손실 상한, 긴급 정지를 Move 객체에 기록합니다. 에이전트가 오작동하거나 키가 노출되어도 권한을 즉시 회수할 수 있습니다.",
  },
];

const built = [
  "SUI · BTC · ETH · SOL 실시간 시세 기반 5개 전략 엔진",
  "위험 조정 성과 리더보드와 에이전트 상세 전적",
  "Sui Testnet 지갑 연결 및 게스트 데모 모드",
  "입금 · 출금 · Agent 교체 · Kill Switch를 포함한 Vault UI",
  "Move 기반 Agent Market / Vault 트랜잭션 빌더",
  "x402 결제 요청 및 온체인 수익 분배 흐름",
  "FastAPI · PostgreSQL · Redis 기반 에이전트 등록 API",
  "16개 프론트엔드 회귀 테스트와 재현 가능한 Docker 배포",
];

export default function SubmissionPage() {
  return (
    <main
      className="min-h-screen bg-[#11100F] text-[#FFF8ED]"
      style={{
        fontFamily:
          "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        letterSpacing: "-0.025em",
      }}
    >
      <section className="border-b border-white/10 px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.16em] text-[#FF5A1F]">
            <span>BLOCKTHON 2026</span>
            <span className="h-px w-8 bg-[#FF5A1F]" />
            <span>SUI TESTNET · AI × BLOCKCHAIN</span>
          </div>
          <h1 className="max-w-5xl text-5xl font-extrabold leading-[1.04] md:text-8xl">
            AI에게 돈을 맡기지 않고,
            <br />
            <span className="text-[#FF5A1F]">거래 권한만 맡깁니다.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-[#B9B0A5] md:text-xl">
            THE ZONE AGORA는 AI 트레이딩 에이전트를 같은 조건에서 검증하고,
            사용자가 선택한 에이전트에 제한된 온체인 권한만 위임하는 아레나형
            투자 인프라입니다.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/agora"
              className="rounded-xl bg-[#FF5A1F] px-6 py-3 font-bold text-[#11100F] transition hover:brightness-110"
            >
              라이브 데모 열기
            </a>
            <a
              href="https://github.com/TheZoneAgora"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/20 px-6 py-3 font-bold transition hover:border-white/50"
            >
              GitHub 전체 코드
            </a>
          </div>
          <p className="mt-4 text-sm text-[#8D857B]">
            지갑 확장이 없어도 “데모로 둘러보기”를 선택하면 전체 제품을 확인할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-[0.14em] text-[#FF5A1F]">THE PROBLEM</p>
          <h2 className="mt-4 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
            화려한 백테스트만으로는 어떤 에이전트를 믿어야 할지 알 수 없습니다.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#B9B0A5]">
            전략마다 자본, 기간, 수수료 가정이 달라 성과 비교가 불가능하고, API 키를
            넘긴 에이전트가 사용자의 자금을 어디까지 움직일 수 있는지도 불투명합니다.
            Agora는 성과 비교 기준과 자산 권한을 동시에 표준화합니다.
          </p>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="rounded-2xl border border-white/10 bg-[#1B1917] p-7">
                <div className="text-sm font-bold text-[#FF5A1F]">{feature.number}</div>
                <h3 className="mt-8 text-2xl font-bold">{feature.title}</h3>
                <p className="mt-4 leading-7 text-[#B9B0A5]">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#171513] px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-[#FF5A1F]">HOW IT WORKS</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">랭킹에서 Vault까지 하나의 흐름</h2>
          </div>
          <ol className="space-y-3">
            {[
              "실시간 시장 데이터로 모든 Agent의 신호를 같은 조건에서 재생합니다.",
              "수익률과 MDD를 함께 계산해 위험 조정 순위를 만듭니다.",
              "사용자가 Agent를 선택하고 자신의 거래 한도를 정합니다.",
              "Sui Vault가 소유자, Agent, 자산 유형, 거래 한도를 온체인에서 검사합니다.",
              "조건을 통과한 거래만 실행되고 결과 자산은 다시 사용자 Vault에 귀속됩니다.",
            ].map((step, index) => (
              <li key={step} className="flex gap-5 rounded-xl border border-white/10 bg-[#1B1917] p-5">
                <span className="font-mono text-sm font-bold text-[#FF5A1F]">0{index + 1}</span>
                <span className="leading-7 text-[#E7DED2]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-[0.14em] text-[#FF5A1F]">WHAT WE BUILT</p>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">아이디어가 아니라, 지금 작동하는 MVP</h2>
            <span className="w-fit rounded-full border border-[#24C77A]/40 bg-[#24C77A]/10 px-4 py-2 text-sm font-bold text-[#24C77A]">
              BUILD · TEST · LIVE
            </span>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-0 md:grid-cols-2">
            {built.map((item) => (
              <div key={item} className="flex gap-4 border-b border-white/10 py-5">
                <span className="mt-1 text-[#24C77A]">✓</span>
                <span className="leading-7 text-[#E7DED2]">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-[#F6B73C]/30 bg-[#F6B73C]/5 p-6">
            <p className="font-bold text-[#F6B73C]">현재 범위에 대한 정직한 설명</p>
            <p className="mt-3 leading-7 text-[#B9B0A5]">
              리더보드는 실제 시장 데이터에 반응하는 페이퍼 트레이딩입니다. Sui Testnet
              Vault와 x402 트랜잭션 경로는 코드와 테스트로 구현했으며, 실제 DEX 체결과
              Walrus 영속 메모리는 본선 빌딩에서 완성할 다음 단계입니다.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[#FF5A1F] p-8 text-[#11100F] md:p-14">
          <p className="text-sm font-extrabold tracking-[0.14em]">WHY SUI</p>
          <h2 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight md:text-5xl">
            객체 중심 권한 모델이 “에이전트에게 어디까지 맡길 것인가”를 코드로 만듭니다.
          </h2>
          <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-[#3A231A]">
            Vault, Agent 권한, 위험 정책을 독립된 Move 객체로 구성하면 사용자는 자산
            소유권을 유지하면서도 자동화된 거래를 허용할 수 있습니다. 빠른 Testnet과
            Programmable Transaction Block은 이 흐름을 하나의 검증 가능한 트랜잭션으로
            조합하기에 적합합니다.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 text-center text-sm text-[#8D857B]">
        THE ZONE AGORA · 박민성 · 김진웅 · 손형권 · Blockthon 2026
      </footer>
    </main>
  );
}
