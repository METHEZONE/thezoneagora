import {
  DEFAULT_RISK_POLICY,
  type ExecutionPolicyUpdate,
  type VaultActivityEvent,
  type VaultActivityEventType,
  type VaultState,
} from "@/lib/vault/types";
import type {
  CreateVaultParams,
  EmergencyLiquidateAllParams,
  OwnedVaultSummary,
  VaultDataEvent,
  VaultDataSource,
  VaultSubscriber,
} from "@/lib/vault/VaultDataSource";
import { STRATEGY_CONFIGS } from "@/lib/live/strategyLogic";

const STORAGE_KEY = "agora-mock-vault-v2";

// 실시세 콜백이 아직 붙지 않았을 때 쓰는 폴백 SUI/USDC 환율.
// attachEngine으로 엔진이 붙으면 이 값 대신 엔진의 실시세를 우선 사용한다.
const FALLBACK_CRYPTO_PRICE_USDC = 3.5;

// 활동 피드가 무한정 커지지 않도록 볼트당 유지할 최근 이벤트 개수.
const MAX_ACTIVITY_LENGTH = 200;

// 게스트 데모 볼트는 항상 mint 전략 고정 (기존 데모 경험 유지).
const GUEST_STRATEGY_ID = "mint";

// STRATEGY_CONFIGS(전략 → 실시세 심볼)를 뒤집어 전략별 청산 시세 조회에 쓴다.
const SYMBOL_BY_STRATEGY: Record<string, string> = Object.fromEntries(
  STRATEGY_CONFIGS.map((c) => [c.agentId, c.symbol])
);

function symbolForStrategy(strategyId: string): string {
  return SYMBOL_BY_STRATEGY[strategyId] ?? "SUIUSDT";
}

interface StoredVaultRecord {
  state: VaultState;
  activity: VaultActivityEvent[];
}

interface StoredData {
  guest: StoredVaultRecord;
  /** owner -> strategyId -> 볼트. 지갑 1개가 전략별로 독립된 볼트를 가질 수 있다. */
  vaults: Record<string, Record<string, StoredVaultRecord>>;
}

/** LiveStrategyEngine의 ActivityEvent와 구조적으로 호환되는 최소 형태. */
interface EngineActivityLike {
  type?: string;
  agentId?: string;
  signalId?: string;
  side?: string;
  symbol?: string;
  price?: number;
  fillPrice?: number;
  quantity?: number;
  riskScoreBps?: number;
  reason?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/** subscribe 콜백에는 개별 시그널이 아니라 EngineTick({events: [...]})이 온다. */
interface EngineTickLike {
  events?: EngineActivityLike[];
  [key: string]: unknown;
}

interface EngineLike {
  subscribe?: (callback: (tick: EngineTickLike) => void) => (() => void) | void;
  getLatestPrice?: (symbol: string) => number | undefined;
  getSnapshot?: () => { prices?: Record<string, number> } | undefined;
}

// bigint는 JSON.stringify가 다루지 못하므로 마커 객체로 감싸서 저장한다.
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? { __bigint__: value.toString() } : value;
}

function bigintReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "__bigint__" in (value as Record<string, unknown>)
  ) {
    return BigInt((value as { __bigint__: string }).__bigint__);
  }
  return value;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function generateId(prefix: string): string {
  if (isBrowser() && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// 심사위원 등 지갑 미연결 방문자가 /vault에서 즉시 보는 사전 시드 데모 볼트 (mint 전략 고정).
function createGuestVaultRecord(): StoredVaultRecord {
  const now = Date.now();

  const state: VaultState = {
    vaultId: null,
    owner: null,
    fiatBalance: 6_420_000_000n, // 6,420 USDC
    cryptoBalance: 812_000_000_000n, // 812 SUI (MIST, 9 decimals)
    agentStatus: "ACTIVE",
    policy: { ...DEFAULT_RISK_POLICY },
    realizedLoss: 0n,
    windowLoss: 0n,
    dailyVolume: 320_000_000n, // 320 USDC
    isGuest: true,
  };

  const activity: VaultActivityEvent[] = [
    {
      id: "seed-1",
      type: "SignalReceived",
      timestamp: now - 9 * 60_000,
      payload: { side: "BUY", symbol: "SUIUSDT", price: 3.42 },
    },
    {
      id: "seed-2",
      type: "SignalVerified",
      timestamp: now - 9 * 60_000 + 5_000,
      payload: { side: "BUY", symbol: "SUIUSDT", price: 3.42, riskScoreBps: 2400 },
    },
    {
      id: "seed-3",
      type: "OrderExecuted",
      timestamp: now - 9 * 60_000 + 8_000,
      payload: { side: "BUY", symbol: "SUIUSDT", price: 3.42, amount: "50000000" },
    },
    {
      id: "seed-4",
      type: "SignalReceived",
      timestamp: now - 3 * 60_000,
      payload: { side: "SELL", symbol: "SUIUSDT", price: 3.5 },
    },
    {
      id: "seed-5",
      type: "SignalRejected",
      timestamp: now - 3 * 60_000 + 4_000,
      payload: {
        side: "SELL",
        symbol: "SUIUSDT",
        price: 3.5,
        reason: "max_risk_score_bps 초과",
      },
    },
  ];

  return { state, activity };
}

function createSeedData(): StoredData {
  return { guest: createGuestVaultRecord(), vaults: {} };
}

/**
 * localStorage("agora-mock-vault-v2") 지속 mock VaultDataSource.
 * 게스트 데모 볼트(mint 고정) + 지갑별 · 전략별 mock 볼트를 함께 관리한다.
 */
export class MockVaultSource implements VaultDataSource {
  private data: StoredData;
  private readonly listeners = new Set<VaultSubscriber>();
  private priceSource: ((symbol: string) => number | undefined) | null = null;
  private engineUnsubscribe: (() => void) | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): StoredData {
    if (!isBrowser()) {
      return createSeedData();
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = createSeedData();
        this.data = seeded;
        this.persist();
        return seeded;
      }
      return JSON.parse(raw, bigintReviver) as StoredData;
    } catch {
      // 손상된 저장값은 신뢰하지 않고 새로 시드한다.
      const seeded = createSeedData();
      this.data = seeded;
      this.persist();
      return seeded;
    }
  }

  private persist(): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.data, bigintReplacer)
    );
  }

  private requireVault(owner: string, strategyId: string): StoredVaultRecord {
    const record = this.data.vaults[owner]?.[strategyId];
    if (!record) {
      throw new Error(
        `No vault found for owner ${owner} / strategy ${strategyId}. Call createVault first.`
      );
    }
    return record;
  }

  private appendActivity(
    record: StoredVaultRecord,
    type: VaultActivityEventType,
    payload: Record<string, unknown>
  ): VaultActivityEvent {
    const event: VaultActivityEvent = {
      id: generateId("evt"),
      type,
      timestamp: Date.now(),
      payload,
    };
    record.activity.push(event);
    if (record.activity.length > MAX_ACTIVITY_LENGTH) {
      record.activity.splice(0, record.activity.length - MAX_ACTIVITY_LENGTH);
    }
    return event;
  }

  private commit(
    owner: string | null,
    strategyId: string,
    record: StoredVaultRecord,
    activity?: VaultActivityEvent
  ): void {
    this.persist();
    const event: VaultDataEvent = { owner, strategyId, state: record.state, activity };
    this.listeners.forEach((callback) => callback(event));
  }

  async hasVault(owner: string, strategyId: string): Promise<boolean> {
    return Boolean(this.data.vaults[owner]?.[strategyId]);
  }

  async getVaultState(owner: string, strategyId: string): Promise<VaultState> {
    return this.requireVault(owner, strategyId).state;
  }

  async listVaults(owner: string): Promise<OwnedVaultSummary[]> {
    const byStrategy = this.data.vaults[owner] ?? {};
    return Object.entries(byStrategy).map(([strategyId, record]) => ({
      strategyId,
      state: record.state,
    }));
  }

  async getActivityHistory(
    owner: string | null,
    strategyId: string
  ): Promise<VaultActivityEvent[]> {
    const record = owner
      ? this.data.vaults[owner]?.[strategyId]
      : strategyId === GUEST_STRATEGY_ID
        ? this.data.guest
        : undefined;
    if (!record) return [];
    // 저장은 시간순 push라 피드용으로는 최신순으로 뒤집어 준다.
    return [...record.activity].reverse();
  }

  async getGuestVault(strategyId: string): Promise<VaultState> {
    if (strategyId !== GUEST_STRATEGY_ID) {
      throw new Error(
        `No guest vault for strategy ${strategyId}; guest demo is fixed to "${GUEST_STRATEGY_ID}".`
      );
    }
    return this.data.guest.state;
  }

  async createVault(
    owner: string,
    strategyId: string,
    params: CreateVaultParams
  ): Promise<VaultState> {
    if (this.data.vaults[owner]?.[strategyId]) {
      throw new Error(`Vault already exists for owner ${owner} / strategy ${strategyId}.`);
    }
    if (params.depositAmount <= 0n) {
      throw new Error("depositAmount must be greater than zero.");
    }

    const state: VaultState = {
      vaultId: `mock-vault-${owner}-${strategyId}`,
      owner,
      fiatBalance: params.depositAmount,
      cryptoBalance: 0n,
      agentStatus: "ACTIVE",
      policy: { ...DEFAULT_RISK_POLICY },
      realizedLoss: 0n,
      windowLoss: 0n,
      dailyVolume: 0n,
      isGuest: false,
    };

    const record: StoredVaultRecord = { state, activity: [] };
    this.data.vaults[owner] ??= {};
    this.data.vaults[owner][strategyId] = record;
    this.commit(owner, strategyId, record);
    return state;
  }

  async depositMore(owner: string, strategyId: string, amount: bigint): Promise<VaultState> {
    if (amount <= 0n) throw new Error("amount must be greater than zero.");
    const record = this.requireVault(owner, strategyId);
    record.state.fiatBalance += amount;
    const activity = this.appendActivity(record, "DepositReceived", {
      amount: amount.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async withdrawAmount(owner: string, strategyId: string, amount: bigint): Promise<VaultState> {
    if (amount <= 0n) throw new Error("amount must be greater than zero.");
    const record = this.requireVault(owner, strategyId);
    if (amount > record.state.fiatBalance) {
      throw new Error("amount exceeds fiatBalance.");
    }
    record.state.fiatBalance -= amount;
    const activity = this.appendActivity(record, "WithdrawalExecuted", {
      fiatWithdrawn: amount.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async withdrawCrypto(owner: string, strategyId: string, amount: bigint): Promise<VaultState> {
    if (amount <= 0n) throw new Error("amount must be greater than zero.");
    const record = this.requireVault(owner, strategyId);
    if (amount > record.state.cryptoBalance) {
      throw new Error("amount exceeds cryptoBalance.");
    }
    record.state.cryptoBalance -= amount;
    const activity = this.appendActivity(record, "WithdrawalExecuted", {
      cryptoWithdrawn: amount.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async withdrawAll(owner: string, strategyId: string): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    const withdrawnFiat = record.state.fiatBalance;
    const withdrawnCrypto = record.state.cryptoBalance;
    record.state.fiatBalance = 0n;
    record.state.cryptoBalance = 0n;
    const activity = this.appendActivity(record, "WithdrawalExecuted", {
      fiatWithdrawn: withdrawnFiat.toString(),
      cryptoWithdrawn: withdrawnCrypto.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async revokeAgent(owner: string, strategyId: string): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    record.state.agentStatus = "PAUSED";
    const activity = this.appendActivity(record, "AgentRevoked", {});
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async reactivateAgent(owner: string, strategyId: string): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    record.state.agentStatus = "ACTIVE";
    const activity = this.appendActivity(record, "AgentReactivated", {});
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async setReduceOnly(
    owner: string,
    strategyId: string,
    reduceOnly: boolean
  ): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    record.state.agentStatus = reduceOnly ? "REDUCE_ONLY" : "ACTIVE";
    const activity = this.appendActivity(record, "ReduceOnlyUpdated", {
      reduceOnly,
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async configurePolicy(
    owner: string,
    strategyId: string,
    policy: ExecutionPolicyUpdate
  ): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    // allowedPool/거래시간대는 real 모드 configure_execution_policy 트랜잭션 전용 값이라
    // mock VaultState.policy(RiskPolicy)에는 반영하지 않는다 — rest로만 분리해 버린다.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { allowedPool, tradingStartMinuteUtc, tradingEndMinuteUtc, ...riskFields } = policy;
    record.state.policy = { ...record.state.policy, ...riskFields };
    const activity = this.appendActivity(record, "PolicyUpdated", {
      changed: Object.keys(riskFields),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async emergencyLiquidateAll(
    owner: string,
    strategyId: string,
    params: EmergencyLiquidateAllParams
  ): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    const cryptoAmount = record.state.cryptoBalance;
    const price = this.resolveCryptoPrice(strategyId);

    // cryptoAmount는 MIST(1e9 decimals), price는 SUI 1개당 USDC, fiat는 USDC 6 decimals.
    const fiatOut =
      (cryptoAmount * BigInt(Math.round(price * 1_000_000))) /
      1_000_000_000n;

    if (fiatOut < params.minFiatOutput) {
      throw new Error(
        "Simulated liquidation output is below minFiatOutput; aborted."
      );
    }

    // 실제 취득원가를 추적하지 않는 mock이라, 폴백 환율 대비 청산가가 낮았던 만큼만
    // realizedLoss로 근사 기록한다.
    const referenceFiatValue =
      (cryptoAmount *
        BigInt(Math.round(FALLBACK_CRYPTO_PRICE_USDC * 1_000_000))) /
      1_000_000_000n;
    const lossDelta =
      referenceFiatValue > fiatOut ? referenceFiatValue - fiatOut : 0n;

    record.state.cryptoBalance = 0n;
    record.state.fiatBalance += fiatOut;
    record.state.realizedLoss += lossDelta;
    record.state.agentStatus = "PAUSED";

    const activity = this.appendActivity(record, "EmergencyLiquidated", {
      cryptoLiquidated: cryptoAmount.toString(),
      fiatReceived: fiatOut.toString(),
      minFiatOutput: params.minFiatOutput.toString(),
      realizedLossDelta: lossDelta.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  async emergencyPauseAndWithdraw(owner: string, strategyId: string): Promise<VaultState> {
    const record = this.requireVault(owner, strategyId);
    const withdrawn = record.state.fiatBalance;
    record.state.fiatBalance = 0n;
    record.state.agentStatus = "PAUSED";
    const activity = this.appendActivity(record, "EmergencyFiatWithdrawn", {
      fiatWithdrawn: withdrawn.toString(),
    });
    this.commit(owner, strategyId, record, activity);
    return record.state;
  }

  subscribe(callback: VaultSubscriber): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** LiveStrategyEngine 등 실시세 소스가 준비되면 심볼별 가격 콜백을 주입한다. */
  setPriceSource(source: ((symbol: string) => number | undefined) | null): void {
    this.priceSource = source;
  }

  private resolveCryptoPrice(strategyId: string): number {
    if (this.priceSource) {
      try {
        const price = this.priceSource(symbolForStrategy(strategyId));
        if (typeof price === "number" && Number.isFinite(price) && price > 0) {
          return price;
        }
      } catch {
        // 시세 콜백이 실패하면 고정 폴백 환율을 사용한다.
      }
    }
    return FALLBACK_CRYPTO_PRICE_USDC;
  }

  /**
   * LiveStrategyEngine 연결 지점. import로 타입을 고정하지 않고 duck typing으로만 다룬다.
   *  - engine.getLatestPrice(symbol)/getSnapshot().prices가 있으면 긴급청산 환산 시세로 쓴다.
   *  - engine.subscribe(cb)가 있으면 이 strategyId(agentId)에 해당하는 시그널만 활동 피드로 흘려보낸다.
   */
  attachEngine(engine: unknown, options: { owner?: string | null; strategyId: string }): void {
    this.detachEngine();

    if (!engine || typeof engine !== "object") return;
    const candidate = engine as EngineLike;
    const strategyId = options.strategyId;

    if (typeof candidate.getLatestPrice === "function") {
      const getLatestPrice = candidate.getLatestPrice.bind(candidate);
      this.setPriceSource((symbol) => getLatestPrice(symbol));
    } else if (typeof candidate.getSnapshot === "function") {
      // LiveStrategyEngine은 getLatestPrice 대신 getSnapshot().prices를 노출한다.
      const getSnapshot = candidate.getSnapshot.bind(candidate);
      this.setPriceSource((symbol) => getSnapshot()?.prices?.[symbol]);
    }

    if (typeof candidate.subscribe === "function") {
      const owner = options.owner ?? null;
      const unsubscribe = candidate.subscribe((tick) =>
        this.handleEngineTick(tick, owner, strategyId)
      );
      this.engineUnsubscribe =
        typeof unsubscribe === "function" ? unsubscribe : null;
    }
  }

  detachEngine(): void {
    this.engineUnsubscribe?.();
    this.engineUnsubscribe = null;
  }

  /**
   * 엔진 subscribe 콜백은 매 가격 틱마다 EngineTick을 전달한다.
   * 실제 시그널 파이프라인 이벤트는 tick.events 배열 안에 있으므로 개별로 변환한다.
   * 이 엔진은 5개 전략 전부의 이벤트를 함께 흘려보내므로, 이 볼트(strategyId)와
   * 무관한 다른 전략의 이벤트는 걸러낸다.
   */
  private handleEngineTick(
    tick: EngineTickLike,
    owner: string | null,
    strategyId: string
  ): void {
    if (!tick || !Array.isArray(tick.events) || tick.events.length === 0) return;
    const record = owner
      ? this.data.vaults[owner]?.[strategyId]
      : strategyId === GUEST_STRATEGY_ID
        ? this.data.guest
        : undefined;
    if (!record) return;

    // 구독자(useVault)는 VaultDataEvent.activity 단위로 피드를 쌓으므로
    // 한 틱에 여러 이벤트가 와도 각각 commit해서 하나도 유실되지 않게 한다.
    for (const event of tick.events) {
      if (!event || typeof event !== "object") continue;
      if (event.agentId && event.agentId !== strategyId) continue;
      const type = ENGINE_EVENT_TYPE_MAP[event.type ?? ""];
      if (!type) continue;

      const activity = this.appendActivity(record, type, {
        agentId: event.agentId,
        signalId: event.signalId,
        side: event.side,
        symbol: event.symbol,
        // ORDER_EXECUTED는 fillPrice/quantity, 나머지는 price를 쓴다.
        price: event.price ?? event.fillPrice,
        quantity: event.quantity,
        riskScoreBps: event.riskScoreBps,
        reason: event.reason,
      });
      this.commit(owner, strategyId, record, activity);
    }
  }
}

/** LiveStrategyEngine ActivityEventType → 볼트 활동 피드 타입 매핑. */
const ENGINE_EVENT_TYPE_MAP: Record<string, VaultActivityEventType | undefined> = {
  SIGNAL_RECEIVED: "SignalReceived",
  SIGNAL_VERIFIED: "SignalVerified",
  SIGNAL_REJECTED: "SignalRejected",
  ORDER_EXECUTED: "OrderExecuted",
};
