import type { AgentSignalPayload } from "@/lib/live/signalApi";

// "느린 시계" — Agent의 과거 판단 이력을 보고 신뢰도(risk_score_bps)를 매긴다.
// PROGRESS.md §7의 설계 원칙 그대로: 계산은 오프체인(여기, LLM)에서 하고,
// AgoraAgent가 이 값을 온체인 UserVault.max_risk_score_bps와 비교해 강제한다 —
// 이 API는 그 "계산" 절반을 실제로 채운다(기존엔 고정값 5000bps 스텁이었다).
const MODEL = "claude-haiku-4-5-20251001";

export interface RiskAssessment {
  risk_score_bps: number;
  rationale: string;
  model: string;
}

function buildPrompt(payload: AgentSignalPayload): string {
  const rejectCount = payload.recent_signals.filter((s) => s.verdict === "REJECTED").length;
  return `당신은 온체인 자동매매 Vault에 시그널을 흘려보내도 되는지 판정하는 리스크 심사역입니다.
아래는 트레이딩 에이전트 "${payload.agent_id}"(전략: ${payload.strategy}, 대상: ${payload.symbol})의
실시간 시세 기반 페이퍼 트레이딩 최근 실적입니다.

- 현재 수익률(ROI): ${payload.roi_pct}%
- 현재 포지션: ${payload.current_position ? JSON.stringify(payload.current_position) : "없음"}
- 최근 판단 ${payload.recent_signals.length}건 중 거부(REJECTED) ${rejectCount}건
- 최근 판단 목록: ${JSON.stringify(payload.recent_signals)}

이 실적을 근거로 risk_score_bps(0~10000, 클수록 위험 — 온체인 Vault의 max_risk_score_bps와
직접 비교되어 초과 시 거래가 자동 차단됩니다)를 매기고, 왜 그렇게 판단했는지 두 문장 이내로
한국어로 설명하세요. 반드시 아래 JSON 형식으로만 답하세요, 다른 텍스트를 붙이지 마세요:
{"risk_score_bps": <정수>, "rationale": "<두 문장 이내 한국어 설명>"}`;
}

/** Anthropic Messages API를 직접 fetch로 호출한다 — SDK 없이 한 번의 호출로 충분하다. */
export async function assessRisk(payload: AgentSignalPayload): Promise<RiskAssessment> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(payload) }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API 호출 실패: HTTP ${res.status} ${text}`);
  }

  const body = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = body.content.find((b) => b.type === "text")?.text ?? "";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`LLM 응답에서 JSON을 찾을 수 없습니다: ${text}`);
  }
  const parsed = JSON.parse(match[0]) as { risk_score_bps?: unknown; rationale?: unknown };

  const score = Number(parsed.risk_score_bps);
  if (!Number.isFinite(score) || score < 0 || score > 10000) {
    throw new Error(`LLM이 유효하지 않은 risk_score_bps를 반환했습니다: ${parsed.risk_score_bps}`);
  }

  return {
    risk_score_bps: Math.round(score),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    model: MODEL,
  };
}
