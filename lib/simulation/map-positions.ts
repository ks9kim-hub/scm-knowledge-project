import type { CorpId } from "./types"

/**
 * 카드가 실제 국가 좌표(getBBox 실측)를 그대로 쓰면, 화면을 1920×1080 안에 넣기 위해 지도를
 * 작게 유지해야 하는 조건에서 카드 6개가 서로 겹친다(카드 크기 224×327px 기준). 그래서 정확한
 * 지도 좌표 대신 겹치지 않는 3열×2행 그리드로 배치하되, 실제 대략의 위치 관계(미국·브라질은
 * 서반구, 영국·이집트는 유럽·아프리카, 한국·베트남은 동아시아라 서로 같은 열)는 유지했다.
 */
export const CORP_MAP_POSITION: Record<CorpId, { xPct: number; yPct: number }> = {
  us: { xPct: 16.7, yPct: 25 },
  gb: { xPct: 50, yPct: 25 },
  kr: { xPct: 83.3, yPct: 25 },
  br: { xPct: 16.7, yPct: 75 },
  eg: { xPct: 50, yPct: 75 },
  vn: { xPct: 83.3, yPct: 75 },
}
