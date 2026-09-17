import { supabase } from "./client"

const TABLE = "game_rankings"

/** 세션 동안 닉네임을 기억해 두 번째 판부터는 자동으로 채워 넣는 데 쓰는 키. */
const NICKNAME_SESSION_KEY = "miri-nickname"

export function loadSavedNickname(): string {
  try {
    return sessionStorage.getItem(NICKNAME_SESSION_KEY) ?? ""
  } catch {
    return ""
  }
}

export function saveNickname(nickname: string): void {
  try {
    sessionStorage.setItem(NICKNAME_SESSION_KEY, nickname)
  } catch {
    // 세션 스토리지를 쓸 수 없는 환경(프라이빗 모드 등)이면 그냥 기억을 포기한다.
  }
}

export interface TopRankingEntry {
  nickname: string
  score: number
  periodWeeks: number
}

export interface RankingResult {
  rank: number
  total: number
  topRankings: TopRankingEntry[]
}

const TOP_RANKINGS_LIMIT = 10

/**
 * 점수를 등록하고, 등록 직후 기준으로 몇 등인지와 상위 10위 순위표를 함께 돌려준다. 순위는
 * 전체 판(기간 상관없이) 통틀어 나보다 높은 점수의 개수 + 1로 매긴다 — 동점자는 같은 등수를
 * 공유한다.
 */
export async function submitRanking(
  nickname: string,
  score: number,
  periodWeeks: number
): Promise<RankingResult> {
  const { error: insertError } = await supabase
    .from(TABLE)
    .insert({ nickname, score, period_weeks: periodWeeks })
  if (insertError) throw insertError

  const { count: higherCount, error: higherError } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .gt("score", score)
  if (higherError) throw higherError

  const { count: totalCount, error: totalError } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
  if (totalError) throw totalError

  const { data: topRows, error: topError } = await supabase
    .from(TABLE)
    .select("nickname, score, period_weeks")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(TOP_RANKINGS_LIMIT)
  if (topError) throw topError

  const topRankings: TopRankingEntry[] = (topRows ?? []).map((row) => ({
    nickname: row.nickname,
    score: row.score,
    periodWeeks: row.period_weeks,
  }))

  return { rank: (higherCount ?? 0) + 1, total: totalCount ?? 0, topRankings }
}
