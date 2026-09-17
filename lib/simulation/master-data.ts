import type { CorpId, CorpMaster } from "./types"

/**
 * 한국 생산법인 창고 기준 리드타임과 시작 DIO는 대륙별 지리 거리에 대략 비례하게 정한
 * 마스터 데이터다. 브라질이 가장 길고(3주), 한국은 생산법인과 같은 나라라 0주(당일 국내
 * 이동)이고 베트남이 그다음으로 짧다(1주). 기본 기간이 4주뿐이라 리드타임을 너무 길게
 * 두면 학습자가 손댈 수 있는 턴이 지나치게 줄어들어, 전체적으로 짧게 잡았다. 시작 DIO는
 * 일부러 밴드(7~21일) 안팎을 섞어 일부 창고가 이미 어긋난 채로 시작하게 한다.
 */
export const CORPS: CorpMaster[] = [
  { id: "kr", name: "한국", leadTimeWeeks: 0, baseWeeklyForecast: 420, startingDio: 14 },
  { id: "us", name: "미국", leadTimeWeeks: 2, baseWeeklyForecast: 900, startingDio: 28 },
  { id: "gb", name: "영국", leadTimeWeeks: 2, baseWeeklyForecast: 380, startingDio: 15 },
  { id: "vn", name: "베트남", leadTimeWeeks: 1, baseWeeklyForecast: 260, startingDio: 5 },
  { id: "br", name: "브라질", leadTimeWeeks: 3, baseWeeklyForecast: 340, startingDio: 6 },
  { id: "eg", name: "이집트", leadTimeWeeks: 2, baseWeeklyForecast: 210, startingDio: 16 },
]

export const CORP_BY_ID: Record<CorpId, CorpMaster> = Object.fromEntries(
  CORPS.map((corp) => [corp.id, corp])
) as Record<CorpId, CorpMaster>

export const DIO_SHORTAGE_MAX = 7
export const DIO_EXCESS_MIN = 21

/** 적정 밴드(7~21일)의 정중앙. 점수는 각 법인의 DIO가 이 값에 얼마나 가까운지로 매긴다. */
export const DIO_TARGET = 14

/** 생산법인 창고에서 나가는 출하는 최소주문수량(MOQ) 단위인 100개 배수로만 나간다. */
export const MOQ = 100

export const PERIOD_OPTIONS = [
  { weeks: 4, label: "👶 입문자 모드 (1개월)", hardcore: false },
  { weeks: 8, label: "🧑 실전러 모드 (2개월)", hardcore: false },
  { weeks: 12, label: "👨 고인물 모드 (3개월)", hardcore: true },
] as const

export const DEFAULT_PERIOD_WEEKS = 4

/** 일반 모드의 주차별 판매예측 편차(±15%). */
export const DEFAULT_FORECAST_JITTER = 0.15

/**
 * 고인물 모드의 주차별 판매예측 편차(±40%). 돌발 수요 급증·급감을 흉내 내는 장치라 평소보다
 * 훨씬 크게 흔든다.
 */
export const HARDCORE_FORECAST_JITTER = 0.4

/**
 * 고인물 모드에서 생산법인이 그 주에 실제로 내보낼 수 있는 총량은 그 주 전체 판매예측
 * 합계의 이 배수까지다. 여유를 15%만 둬서 여섯 법인에 나눠 배정하려면 우선순위를 따져야
 * 하지만, 그 주 예측을 항상 웃돌게 잡아서 아무리 잘해도 못 채우는 결품이 강제되지는 않게
 * 한다.
 */
export const HARDCORE_CAPACITY_MARGIN = 1.15

/**
 * 화면에서 "예측"과 "이동중"을 몇 주치 보여줄지. 리드타임이 긴 법인(브라질 3주)의 출하도
 * 도착 주차가 항상 보이려면, 기간이 짧아도(예: 1주) 최소 이 주수만큼은 미리 내다볼 수 있어야
 * 한다.
 */
export const DISPLAY_WINDOW_WEEKS = 8
