export type CorpId = "kr" | "us" | "gb" | "vn" | "br" | "eg"

export type DioStatus = "shortage" | "ok" | "excess"

export interface CorpMaster {
  id: CorpId
  name: string
  /** 한국 생산법인 창고 → 해당 판매법인 창고 리드타임(주) */
  leadTimeWeeks: number
  /** 1주차 판매예측의 기준값(주간 수량) */
  baseWeeklyForecast: number
  /** 게임 시작 시점의 목표 DIO(일). 창고별로 밴드 안팎을 다르게 시작시키는 데 쓴다. */
  startingDio: number
}

export type ShipmentStatus = "pending" | "in-transit" | "arrived"

export interface Shipment {
  id: string
  destination: CorpId
  quantity: number
  /** 생산법인 창고에서 실제로 빠져나가는 주차 */
  departWeek: number
  /** 목적지 창고 재고에 더해지는 주차 */
  arrivalWeek: number
  status: ShipmentStatus
}

export interface CorpWeekRecord {
  stock: number
  forecast: number
  dio: number
  status: DioStatus
}

export interface WeekRecord {
  week: number
  corps: Record<CorpId, CorpWeekRecord>
}

export interface GameState {
  periodWeeks: number
  currentWeek: number
  finished: boolean
  salesWarehouseStock: Record<CorpId, number>
  /**
   * 생산법인 창고 재고. 판매계획만큼 매주 보충되어 항상 충분하며, 학습자의 출하 배정을
   * 막는 데 쓰이지 않는다(단순 표시용 참고 값).
   */
  productionStock: number
  /** 전체 기간 동안 법인별·주차별 판매예측(1-based 주차 키) */
  forecastByWeek: Record<number, Record<CorpId, number>>
  shipments: Shipment[]
  history: WeekRecord[]
}
