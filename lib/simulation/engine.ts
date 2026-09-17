import {
  CORPS,
  CORP_BY_ID,
  DEFAULT_FORECAST_JITTER,
  DIO_EXCESS_MIN,
  DIO_SHORTAGE_MAX,
  DIO_TARGET,
  DISPLAY_WINDOW_WEEKS,
  HARDCORE_CAPACITY_MARGIN,
  HARDCORE_FORECAST_JITTER,
  MOQ,
  PERIOD_OPTIONS,
} from "./master-data"
import type { CorpId, CorpMaster, CorpWeekRecord, DioStatus, GameState, Shipment, WeekRecord } from "./types"

function mulberry32(seed: number) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function computeDio(stock: number, weeklyForecast: number): number {
  if (weeklyForecast <= 0) return Number.POSITIVE_INFINITY
  return (stock / weeklyForecast) * 7
}

export function classifyDio(dio: number): DioStatus {
  if (dio < DIO_SHORTAGE_MAX) return "shortage"
  if (dio > DIO_EXCESS_MIN) return "excess"
  return "ok"
}

function generateForecastByWeek(
  periodWeeks: number,
  rng: () => number,
  jitterAmplitude: number
): Record<number, Record<CorpId, number>> {
  const forecastByWeek: Record<number, Record<CorpId, number>> = {}
  for (let week = 1; week <= periodWeeks; week++) {
    const weekForecast = {} as Record<CorpId, number>
    for (const corp of CORPS) {
      const jitter = 1 + (rng() * 2 - 1) * jitterAmplitude
      weekForecast[corp.id] = Math.max(1, Math.round(corp.baseWeeklyForecast * jitter))
    }
    forecastByWeek[week] = weekForecast
  }
  return forecastByWeek
}

function totalForecast(forecast: Record<CorpId, number>): number {
  return CORPS.reduce((sum, corp) => sum + forecast[corp.id], 0)
}

function buildWeekRecord(
  week: number,
  stock: Record<CorpId, number>,
  forecast: Record<CorpId, number>
): WeekRecord {
  const corps = {} as Record<CorpId, CorpWeekRecord>
  for (const corp of CORPS) {
    const dio = computeDio(stock[corp.id], forecast[corp.id])
    corps[corp.id] = {
      stock: stock[corp.id],
      forecast: forecast[corp.id],
      dio,
      status: classifyDio(dio),
    }
  }
  return { week, corps }
}

/**
 * 게임을 시작하기 전부터 이미 파이프라인에 떠 있던 출하를 만든다. 1주차가 시작되는 시점에는
 * 아직 어떤 턴도 진행되지 않았으므로, 이미 출발해 이동 중인 출하는 1주차 이전(departWeek<=0)에
 * 나갔어야 논리적으로 맞다. 즉 도착 주차는 리드타임을 넘을 수 없다(departWeek<=0이면
 * arrivalWeek=departWeek+리드타임<=리드타임). 그리고 1주차 시작 시점의 재고에 이미 반영된
 * 게 아니라 "아직 이동 중"이어야 하므로 도착 주차는 최소 2주차부터다. 리드타임이 1주 이하인
 * 법인(한국·베트남)은 이 범위(2 ≤ 도착 주차 ≤ 리드타임)가 성립하지 않아 자연스럽게 시드가
 * 없다.
 *
 * 학습자가 1주차에 바로 배정해도 그 물량은 (1+리드타임)주차에야 도착하므로, 그 전(1~리드타임
 * 주차)까지는 오직 시작 재고와 이 초기 파이프라인만으로 버텨야 한다. 그 구간의 누적 판매예측을
 * 반드시 채우도록(10% 여유 포함) 파이프라인 총량을 정해, 학습자가 아무리 빨리 대응해도 손쓸 수
 * 없는 결품이 시작부터 강제되지 않게 한다.
 */
function createInitialShipments(
  forecastByWeek: Record<number, Record<CorpId, number>>,
  startingStock: Record<CorpId, number>
): Shipment[] {
  const shipments: Shipment[] = []
  for (const corp of CORPS) {
    const arrivalWeeks: number[] = []
    for (let week = 2; week <= corp.leadTimeWeeks; week++) arrivalWeeks.push(week)
    if (arrivalWeeks.length === 0) continue

    let demandBeforePlayerControl = 0
    for (let week = 1; week <= corp.leadTimeWeeks; week++) {
      demandBeforePlayerControl += forecastByWeek[week][corp.id]
    }
    const neededWithBuffer = Math.round(demandBeforePlayerControl * 1.1) - startingStock[corp.id]
    const requiredTotal = Math.max(MOQ * arrivalWeeks.length, neededWithBuffer)

    const perWeek = Math.floor(requiredTotal / arrivalWeeks.length)
    arrivalWeeks.forEach((arrivalWeek, index) => {
      const isLast = index === arrivalWeeks.length - 1
      const quantity = isLast ? requiredTotal - perWeek * (arrivalWeeks.length - 1) : perWeek
      shipments.push({
        id: `seed-${corp.id}-w${arrivalWeek}`,
        destination: corp.id,
        quantity,
        departWeek: arrivalWeek - corp.leadTimeWeeks,
        arrivalWeek,
        status: "in-transit",
      })
    })
  }
  return shipments
}

export function createInitialGame(periodWeeks: number, seed: number = Date.now()): GameState {
  const rng = mulberry32(seed)
  const hardcore = PERIOD_OPTIONS.find((option) => option.weeks === periodWeeks)?.hardcore ?? false
  const jitterAmplitude = hardcore ? HARDCORE_FORECAST_JITTER : DEFAULT_FORECAST_JITTER
  // 기간이 짧아도 "예측"·"이동중" 화면은 최소 DISPLAY_WINDOW_WEEKS주만큼 내다볼 수 있어야
  // 하므로, 실제 게임 기간보다 더 먼 주차까지 예측 데이터를 미리 만들어 둔다.
  const forecastByWeek = generateForecastByWeek(periodWeeks + DISPLAY_WINDOW_WEEKS - 1, rng, jitterAmplitude)

  const salesWarehouseStock = {} as Record<CorpId, number>
  for (const corp of CORPS) {
    const week1Forecast = forecastByWeek[1][corp.id]
    salesWarehouseStock[corp.id] = Math.round((corp.startingDio / 7) * week1Forecast)
  }

  return {
    periodWeeks,
    currentWeek: 1,
    finished: false,
    hardcore,
    shippedThisWeek: 0,
    salesWarehouseStock,
    productionStock: totalForecast(forecastByWeek[1]) * 3,
    forecastByWeek,
    shipments: createInitialShipments(forecastByWeek, salesWarehouseStock),
    history: [buildWeekRecord(1, salesWarehouseStock, forecastByWeek[1])],
  }
}

/**
 * 고인물 모드에서 생산법인이 이번 주에 실제로 내보낼 수 있는 총 출하량. 그 주 전체 판매예측
 * 합계에 여유(HARDCORE_CAPACITY_MARGIN)를 두고 MOQ 단위로 올림해, 아무리 잘해도 못 채우는
 * 결품이 나지 않게 하면서도 여섯 법인에 나눠 배정하려면 우선순위를 따지게 한다. 일반 모드는
 * 제약이 없다.
 */
export function weeklyShipCapacity(state: GameState): number {
  if (!state.hardcore) return Number.POSITIVE_INFINITY
  const total = totalForecast(state.forecastByWeek[state.currentWeek])
  return Math.ceil((total * HARDCORE_CAPACITY_MARGIN) / MOQ) * MOQ
}

/** 이번 주에 아직 배정할 수 있는 남은 출하량. */
export function remainingShipCapacity(state: GameState): number {
  if (!state.hardcore) return Number.POSITIVE_INFINITY
  return Math.max(0, weeklyShipCapacity(state) - state.shippedThisWeek)
}

/**
 * 생산법인 창고에서 destination으로 물량을 내보낸다. 물량 자체는 항상 충분해 막히지 않지만,
 * 고인물 모드에서는 이번 주 출하량이 weeklyShipCapacity를 넘으면 거부한다(state 그대로 반환).
 * 리드타임 0주(한국)는 생산법인과 같은 나라라 이동 시간이 없으므로, 대기(pending) 단계 없이
 * 배정한 즉시 판매법인 창고 재고에 반영한다 — 그래서 취소도 되지 않는다. 리드타임이 있는
 * 법인은 기존대로 pending 출하를 만들어 이후 도착 주차에 반영한다.
 */
export function allocateShipment(state: GameState, destination: CorpId, quantity: number): GameState {
  if (state.finished || quantity <= 0) return state
  if (state.hardcore && state.shippedThisWeek + quantity > weeklyShipCapacity(state)) return state

  const productionStock = state.productionStock - quantity
  const shippedThisWeek = state.shippedThisWeek + quantity

  if (CORP_BY_ID[destination].leadTimeWeeks === 0) {
    const salesWarehouseStock = {
      ...state.salesWarehouseStock,
      [destination]: state.salesWarehouseStock[destination] + quantity,
    }
    const lastRecord = state.history[state.history.length - 1]
    const updatedRecord = buildWeekRecord(lastRecord.week, salesWarehouseStock, state.forecastByWeek[lastRecord.week])
    return {
      ...state,
      productionStock,
      shippedThisWeek,
      salesWarehouseStock,
      history: [...state.history.slice(0, -1), updatedRecord],
    }
  }

  const shipment: Shipment = {
    id: `w${state.currentWeek}-${destination}-${Math.random().toString(36).slice(2, 8)}`,
    destination,
    quantity,
    departWeek: state.currentWeek,
    arrivalWeek: state.currentWeek + CORP_BY_ID[destination].leadTimeWeeks,
    status: "pending",
  }
  return { ...state, productionStock, shippedThisWeek, shipments: [...state.shipments, shipment] }
}

/**
 * 아직 대기 중(pending)인 출하만 취소해 생산법인 창고 재고로 되돌린다. 다음 주로 넘기기 전까지만
 * 가능하다. 고인물 모드에서는 이번 주 출하량 사용분도 함께 되돌려 다시 배정할 수 있게 한다.
 */
export function cancelShipment(state: GameState, shipmentId: string): GameState {
  const shipment = state.shipments.find((s) => s.id === shipmentId && s.status === "pending")
  if (!shipment) return state
  return {
    ...state,
    productionStock: state.productionStock + shipment.quantity,
    shippedThisWeek: Math.max(0, state.shippedThisWeek - shipment.quantity),
    shipments: state.shipments.filter((s) => s.id !== shipmentId),
  }
}

/** 아직 생산법인 창고에 있는(pending) 출하만 목적지를 바꿀 수 있다. */
export function reassignShipment(state: GameState, shipmentId: string, newDestination: CorpId): GameState {
  return {
    ...state,
    shipments: state.shipments.map((shipment) =>
      shipment.id === shipmentId && shipment.status === "pending"
        ? {
            ...shipment,
            destination: newDestination,
            arrivalWeek: shipment.departWeek + CORP_BY_ID[newDestination].leadTimeWeeks,
          }
        : shipment
    ),
  }
}

export function pendingShipments(state: GameState): Shipment[] {
  return state.shipments.filter((shipment) => shipment.status === "pending")
}

/**
 * 다음 주 판매법인 창고 입고량. 아직 도착하지 않은(pending 또는 in-transit) 출하 중
 * 다음 주 전환에서 실제로 도착할 물량만 더한다. advanceWeek의 도착 조건(arrivalWeek
 * <= newWeek)과 반드시 같은 기준을 써야 "다음주 재고 = 이번주 재고 - 이번주 판매예측 +
 * 다음주 입고" 공식이 실제로 성립한다.
 */
export function nextWeekIncoming(state: GameState, corpId: CorpId): number {
  const nextWeek = state.currentWeek + 1
  return state.shipments
    .filter(
      (shipment) =>
        shipment.destination === corpId &&
        shipment.status !== "arrived" &&
        shipment.arrivalWeek <= nextWeek
    )
    .reduce((sum, shipment) => sum + shipment.quantity, 0)
}

/** 다음 주 재고 = 이번 주 재고 - 이번 주 판매예측 + 다음 주 입고. */
export function projectedNextWeekStock(state: GameState, corpId: CorpId): number {
  const record = currentWeekRecord(state).corps[corpId]
  return Math.max(0, record.stock - record.forecast) + nextWeekIncoming(state, corpId)
}

/**
 * 아직 도착하지 않은 출하를 도착 예정 주차별로 묶는다. 이동 중인 물량이 정확히 언제 오는지
 * 보여주는 데 쓴다. 도착 예정 주차가 현재 주차 이상인 것만 포함한다 — 리드타임 0주(한국)로
 * 배정하면 arrivalWeek===currentWeek이 되는데, 배정한 즉시 화면에서 확인할 수 있어야 학습자가
 * 드래그가 실제로 반영됐는지 알 수 있다.
 */
export function incomingByArrivalWeek(
  state: GameState,
  corpId: CorpId
): { week: number; quantity: number }[] {
  const byWeek = new Map<number, number>()
  for (const shipment of state.shipments) {
    if (
      shipment.destination === corpId &&
      shipment.status !== "arrived" &&
      shipment.arrivalWeek >= state.currentWeek
    ) {
      byWeek.set(shipment.arrivalWeek, (byWeek.get(shipment.arrivalWeek) ?? 0) + shipment.quantity)
    }
  }
  return [...byWeek.entries()]
    .sort(([weekA], [weekB]) => weekA - weekB)
    .map(([week, quantity]) => ({ week, quantity }))
}

/** 현재 주차의 판매를 반영하고, 대기 출하를 출발시키고, 도착한 출하를 창고에 더한 뒤 다음 주로 넘긴다. */
export function advanceWeek(state: GameState): GameState {
  if (state.finished) return state

  const currentWeek = state.currentWeek
  const forecastThisWeek = state.forecastByWeek[currentWeek]

  const stockAfterSales = { ...state.salesWarehouseStock }
  for (const corp of CORPS) {
    stockAfterSales[corp.id] = Math.max(0, stockAfterSales[corp.id] - forecastThisWeek[corp.id])
  }

  const shipmentsAfterDeparture = state.shipments.map((shipment) =>
    shipment.status === "pending" ? { ...shipment, status: "in-transit" as const } : shipment
  )

  const newWeek = currentWeek + 1

  if (newWeek > state.periodWeeks) {
    return {
      ...state,
      finished: true,
      salesWarehouseStock: stockAfterSales,
      shipments: shipmentsAfterDeparture,
      shippedThisWeek: 0,
    }
  }

  const stockAfterArrivals = { ...stockAfterSales }
  const shipmentsAfterArrival = shipmentsAfterDeparture.map((shipment) => {
    if (shipment.status === "in-transit" && shipment.arrivalWeek <= newWeek) {
      stockAfterArrivals[shipment.destination] += shipment.quantity
      return { ...shipment, status: "arrived" as const }
    }
    return shipment
  })

  return {
    ...state,
    currentWeek: newWeek,
    salesWarehouseStock: stockAfterArrivals,
    productionStock: state.productionStock + totalForecast(forecastThisWeek),
    shipments: shipmentsAfterArrival,
    shippedThisWeek: 0,
    history: [...state.history, buildWeekRecord(newWeek, stockAfterArrivals, state.forecastByWeek[newWeek])],
  }
}

export function currentWeekRecord(state: GameState): WeekRecord {
  return state.history[state.history.length - 1]
}

export function isAllCorpsOk(record: WeekRecord): boolean {
  return CORPS.every((corp) => record.corps[corp.id].status === "ok")
}

/**
 * DIO가 목표치(14일)에 가까울수록 100점에 가깝게, 멀어질수록 0점까지 깎이는 점수를 매긴다.
 * 하루 차이날 때마다 5점씩 깎아, 밴드 경계(7일·21일 = 목표에서 7일 차이)에서 65점이 되도록
 * 잡았다.
 */
export function dioScore(dio: number): number {
  const deviation = Math.abs(dio - DIO_TARGET)
  return Math.max(0, 100 - deviation * 5)
}

/**
 * 이 법인의 재고가 플레이어 손을 타기 전, 이미 결과가 정해져 있는 주차 수. 1주차 기록은
 * 게임이 시작될 때 이미 고정된 상태라 그 누구도 손댈 수 없고, 리드타임이 그보다 길면(2주
 * 이상) 1주차에 바로 배정해도 도착이 (1+리드타임)주차라서 그 전 주차까지도 이미 정해져
 * 있다.
 */
export function uncontrollableWeeks(corp: CorpMaster): number {
  return Math.max(1, corp.leadTimeWeeks)
}

/**
 * 전체 주차 · 전체 법인의 DIO 점수 평균을 100점 만점 총점으로 낸다. 리드타임 때문에 플레이어가
 * 손쓸 수 없었던 주차(uncontrollableWeeks)는 실력과 무관하므로 집계에서 뺀다.
 */
export function computeFinalScore(state: GameState): number {
  let total = 0
  let count = 0
  for (const weekRecord of state.history) {
    for (const corp of CORPS) {
      if (weekRecord.week <= uncontrollableWeeks(corp)) continue
      total += dioScore(weekRecord.corps[corp.id].dio)
      count += 1
    }
  }
  return count === 0 ? 0 : Math.round(total / count)
}
