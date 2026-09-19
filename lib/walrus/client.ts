// Walrus(Sui 기반 탈중앙 블롭 스토리지) 클라이언트. SDK 없이 공개 HTTP API만 쓴다.
// publisher(쓰기)/aggregator(읽기) 둘 다 커뮤니티가 운영하는 testnet 공개 엔드포인트다.
// 2026-09-19 curl로 실제 저장→조회 왕복 검증 완료 (blob_id: wlTwq76rJNW9Mhcmdta2tiB5iSVq_0n91SpLb4LWmME).
const PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

export interface WalrusStoreResult {
  blobId: string;
  /** 이 blob을 추적하는 온체인 Sui object ID (있으면). */
  suiObjectId: string | null;
  /** 브라우저에서 바로 열어볼 수 있는 aggregator URL. */
  url: string;
}

interface WalrusPublishResponse {
  newlyCreated?: { blobObject: { id: string; blobId: string } };
  alreadyCertified?: { blobId: string };
}

export function walrusBlobUrl(blobId: string): string {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

/** JSON 직렬화 가능한 값을 Walrus에 blob으로 저장한다. epochs는 보관 기간(에폭 수). */
export async function storeJsonBlob(
  data: unknown,
  epochs = 1
): Promise<WalrusStoreResult> {
  const body = JSON.stringify(data);
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    body,
  });
  if (!res.ok) {
    throw new Error(`Walrus 저장 실패: HTTP ${res.status}`);
  }
  const parsed = (await res.json()) as WalrusPublishResponse;
  const blobId = parsed.newlyCreated?.blobObject.blobId ?? parsed.alreadyCertified?.blobId;
  if (!blobId) {
    throw new Error("Walrus 응답에 blobId가 없습니다.");
  }
  return {
    blobId,
    suiObjectId: parsed.newlyCreated?.blobObject.id ?? null,
    url: walrusBlobUrl(blobId),
  };
}

export async function readJsonBlob<T = unknown>(blobId: string): Promise<T> {
  const res = await fetch(walrusBlobUrl(blobId));
  if (!res.ok) {
    throw new Error(`Walrus 조회 실패: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
