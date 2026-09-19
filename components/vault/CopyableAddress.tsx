"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/vault/pseudoAddress";

/** 볼트 카드 하단에 쓰는 주소 + 복사 아이콘. 클릭하면 전체 주소를 클립보드에 복사하고
 *  잠깐 체크 아이콘으로 바뀐다. */
export function CopyableAddress({
  address,
  label,
}: {
  address: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드 API가 막힌 환경(권한 없음 등) — 조용히 무시한다.
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
      {label && (
        <span className="flex-shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-light">
          {label}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-light" title={address}>
        {truncateAddress(address)}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "복사됨" : "주소 복사"}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-light transition-colors hover:text-warm-ivory"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.5 12L13 4.5"
              stroke="#24c77a"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M3.5 10.5H2.75A1.25 1.25 0 011.5 9.25V2.75A1.25 1.25 0 012.75 1.5h6.5a1.25 1.25 0 011.25 1.25V3.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
