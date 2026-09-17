import { describe, expect, it } from "vitest"
import {
  advanceWeek,
  allocateShipment,
  cancelShipment,
  classifyDio,
  computeDio,
  computeFinalScore,
  createInitialGame,
  currentWeekRecord,
  dioScore,
  incomingByArrivalWeek,
  isAllCorpsOk,
  nextWeekIncoming,
  pendingShipments,
  projectedNextWeekStock,
  reassignShipment,
  uncontrollableWeeks,
} from "./engine"
import { CORP_BY_ID, CORPS } from "./master-data"

describe("computeDio / classifyDio", () => {
  it("주간 판매예측을 7로 나눈 일평균으로 재고를 나눈 값이다", () => {
    expect(computeDio(1000, 700)).toBeCloseTo(10)
  })

  it("7일 미만은 shortage, 21일 초과는 excess, 그 사이는 ok다", () => {
    expect(classifyDio(6.9)).toBe("shortage")
    expect(classifyDio(7)).toBe("ok")
    expect(classifyDio(21)).toBe("ok")
    expect(classifyDio(21.1)).toBe("excess")
  })
})

describe("createInitialGame", () => {
  it("일부 판매법인 창고는 밴드를 벗어난 채로 시작한다", () => {
    const game = createInitialGame(4, 1)
    const week1 = currentWeekRecord(game)
    const statuses = CORPS.map((corp) => week1.corps[corp.id].status)
    expect(statuses).toContain("shortage")
    expect(statuses.some((status) => status !== "ok")).toBe(true)
  })

  it("같은 seed면 같은 예측 시리즈를 만든다(재현 가능)", () => {
    const a = createInitialGame(4, 42)
    const b = createInitialGame(4, 42)
    expect(a.forecastByWeek).toEqual(b.forecastByWeek)
  })

  it("리드타임 2주 이상인 법인만 시작부터 이동 중 물량이 있다", () => {
    // 리드타임 1주 이하(한국·베트남)는 1주차 이전에 출발했다면 이미 도착했어야 하므로,
    // "아직 이동 중"인 시드가 논리적으로 존재할 수 없다.
    const game = createInitialGame(4, 1)
    for (const corp of CORPS) {
      const breakdown = incomingByArrivalWeek(game, corp.id)
      if (corp.leadTimeWeeks < 2) {
        expect(breakdown).toEqual([])
      } else {
        expect(breakdown.length).toBeGreaterThan(0)
      }
    }
  })

  it("리드타임 2주 이상인 법인은 시작 재고+초기 파이프라인이 플레이어의 첫 배정이 도착하기 전까지의 판매예측을 감당한다", () => {
    // 플레이어가 1주차에 바로 배정해도 그 물량은 (1+리드타임)주차에야 도착하므로, 그 전까지는
    // 시작 재고와 초기 파이프라인만으로 버텨야 한다. 이 총량이 그 구간 수요보다 적으면 학습자가
    // 아무리 빨리 대응해도 손쓸 수 없는 결품이 시작부터 강제된다.
    const game = createInitialGame(4, 1)
    for (const corp of CORPS) {
      if (corp.leadTimeWeeks < 2) continue
      const initialPipeline = incomingByArrivalWeek(game, corp.id).reduce(
        (sum, entry) => sum + entry.quantity,
        0
      )
      let demandBeforePlayerControl = 0
      for (let week = 1; week <= corp.leadTimeWeeks; week++) {
        demandBeforePlayerControl += game.forecastByWeek[week][corp.id]
      }
      expect(game.salesWarehouseStock[corp.id] + initialPipeline).toBeGreaterThanOrEqual(
        demandBeforePlayerControl
      )
    }
  })

  it("리드타임 2주 이상인 법인은 2주차부터 리드타임 주차까지 매주 입고가 끊기지 않는다", () => {
    // 학습자가 아직 아무것도 하지 않은 구간에서도 결품이 강제되지 않도록, 초기 파이프라인이
    // 연속되어야 한다. 도착 주차는 리드타임을 넘지 않고(1주차 이전에 출발했어야 하므로), 학습자가
    // 1주차에 바로 배정하면 그 물량이 정확히 이 구간 마지막 다음 주차에 도착해 끊김 없이 이어진다.
    const game = createInitialGame(4, 1)
    for (const corp of CORPS) {
      if (corp.leadTimeWeeks < 2) continue
      const breakdown = incomingByArrivalWeek(game, corp.id)
      const weeks = breakdown.map((entry) => entry.week).sort((a, b) => a - b)
      const expectedWeeks = []
      for (let week = 2; week <= corp.leadTimeWeeks; week++) expectedWeeks.push(week)
      expect(weeks).toEqual(expectedWeeks)
    }
  })
})

describe("allocateShipment / reassignShipment", () => {
  it("생산법인 창고 물량 부족으로 출하가 막히지 않는다", () => {
    const game = createInitialGame(4, 1)
    const afterHuge = allocateShipment(game, "vn", 10_000_000)
    expect(pendingShipments(afterHuge)).toHaveLength(1)
  })

  it("생산법인 창고 재고는 판매계획만큼 매주 보충되어 다음 주에도 충분히 남는다", () => {
    const game = createInitialGame(4, 1)
    const stockBefore = game.productionStock
    const afterAllocate = allocateShipment(game, "vn", 100)
    expect(afterAllocate.productionStock).toBe(stockBefore - 100)

    const afterAdvance = advanceWeek(afterAllocate)
    const week1TotalForecast = CORPS.reduce((sum, corp) => sum + afterAdvance.forecastByWeek[1][corp.id], 0)
    expect(afterAdvance.productionStock).toBe(stockBefore - 100 + week1TotalForecast)
  })

  it("다음 주로 넘기기 전까지는 대기 중인 출하를 취소해 생산법인 재고로 되돌릴 수 있다", () => {
    const game = createInitialGame(4, 1)
    const stockBefore = game.productionStock
    const withShipment = allocateShipment(game, "vn", 300)
    const shipmentId = pendingShipments(withShipment)[0].id

    const cancelled = cancelShipment(withShipment, shipmentId)
    expect(pendingShipments(cancelled)).toHaveLength(0)
    expect(cancelled.productionStock).toBe(stockBefore)
  })

  it("이미 이동 중인 출하는 취소할 수 없다", () => {
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "br", 300)
    const shipmentId = pendingShipments(withShipment)[0].id
    const afterAdvance = advanceWeek(withShipment)

    const cancelled = cancelShipment(afterAdvance, shipmentId)
    expect(cancelled).toBe(afterAdvance)
    expect(cancelled.shipments.find((s) => s.id === shipmentId)?.status).toBe("in-transit")
  })

  it("아직 대기 중인 출하는 목적지를 바꿀 수 있다", () => {
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "vn", 100)
    const shipmentId = pendingShipments(withShipment)[0].id
    const reassigned = reassignShipment(withShipment, shipmentId, "br")
    expect(pendingShipments(reassigned)[0].destination).toBe("br")
  })

  it("이미 이동 중인(pending이 아닌) 출하는 목적지를 바꿀 수 없다", () => {
    // 브라질 리드타임 3주: 한 번만 넘겨서는 아직 도착하지 않아 in-transit 상태가 유지된다.
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "br", 100)
    const shipmentId = pendingShipments(withShipment)[0].id
    const afterAdvance = advanceWeek(withShipment)
    const reassigned = reassignShipment(afterAdvance, shipmentId, "vn")
    const shipment = reassigned.shipments.find((s) => s.id === shipmentId)!
    expect(shipment.destination).toBe("br")
    expect(shipment.status).toBe("in-transit")
  })
})

describe("advanceWeek", () => {
  it("주차를 넘기면 그 주의 판매예측만큼 재고가 빠진다", () => {
    const game = createInitialGame(4, 1)
    const week1 = currentWeekRecord(game)
    const krStockBefore = week1.corps.kr.stock
    const krForecast = week1.corps.kr.forecast
    const advanced = advanceWeek(game)
    expect(advanced.salesWarehouseStock.kr).toBe(Math.max(0, krStockBefore - krForecast))
  })

  it("출하는 출발 주차에 목적지 리드타임을 더한 주차에 도착한다", () => {
    // 베트남 리드타임 1주: 1주차에 출하하면 2주차에 도착해야 한다.
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "vn", 500)
    const shipmentId = pendingShipments(withShipment)[0].id
    const vnStockWeek1 = currentWeekRecord(game).corps.vn.stock
    const vnForecastWeek1 = currentWeekRecord(game).corps.vn.forecast
    // 베트남은 리드타임 1주라 시작부터 이동 중이던 물량도 정확히 2주차에 함께 도착한다.
    const seededIncoming = nextWeekIncoming(game, "vn")

    const afterWeek1 = advanceWeek(withShipment)
    const vnStockWeek2 = afterWeek1.salesWarehouseStock.vn
    const expectedBeforeArrival = Math.max(0, vnStockWeek1 - vnForecastWeek1)
    expect(vnStockWeek2).toBe(expectedBeforeArrival + 500 + seededIncoming)

    const shipment = afterWeek1.shipments.find((s) => s.id === shipmentId)!
    expect(shipment.status).toBe("arrived")
    expect(shipment.arrivalWeek).toBe(2)
  })

  it("리드타임 0주(한국)는 대기 단계 없이 배정한 즉시 이번 주 재고에 반영된다", () => {
    // 생산법인과 같은 나라라 이동 시간이 없으므로, 다음 주로 넘기지 않아도 바로 반영돼야 한다.
    const game = createInitialGame(4, 1)
    const krStockWeek1 = currentWeekRecord(game).corps.kr.stock

    const withShipment = allocateShipment(game, "kr", 500)
    expect(currentWeekRecord(withShipment).corps.kr.stock).toBe(krStockWeek1 + 500)
    expect(withShipment.salesWarehouseStock.kr).toBe(krStockWeek1 + 500)
    expect(pendingShipments(withShipment)).toEqual([])

    // 이미 반영됐으므로 다음 주로 넘길 때 다시 더해지지 않는다.
    const krForecastWeek1 = currentWeekRecord(game).corps.kr.forecast
    const afterWeek1 = advanceWeek(withShipment)
    expect(afterWeek1.salesWarehouseStock.kr).toBe(Math.max(0, krStockWeek1 + 500 - krForecastWeek1))
  })

  it("리드타임이 남은 기간보다 길면 이번 판에서는 도착하지 않는다", () => {
    // 브라질 리드타임 3주, 기간 2주: 1주차에 보낸 물량은 4주차에 도착해 이번 판 안에 도착하지 않는다.
    const game = createInitialGame(2, 1)
    const withShipment = allocateShipment(game, "br", 500)
    const shipmentId = pendingShipments(withShipment)[0].id

    let state = withShipment
    while (!state.finished) {
      state = advanceWeek(state)
    }

    const shipment = state.shipments.find((s) => s.id === shipmentId)!
    expect(shipment.status).toBe("in-transit")
    expect(shipment.arrivalWeek).toBe(4)
  })

  it("periodWeeks 만큼 턴을 넘기면 종료 상태가 된다", () => {
    let state = createInitialGame(2, 1)
    expect(state.finished).toBe(false)
    state = advanceWeek(state)
    expect(state.finished).toBe(false)
    state = advanceWeek(state)
    expect(state.finished).toBe(true)
  })

  it("종료 후에는 advanceWeek을 호출해도 상태가 바뀌지 않는다", () => {
    let state = createInitialGame(1, 1)
    state = advanceWeek(state)
    expect(state.finished).toBe(true)
    const again = advanceWeek(state)
    expect(again).toBe(state)
  })
})

describe("isAllCorpsOk", () => {
  it("6개 판매법인 중 하나라도 벗어나면 false다", () => {
    const game = createInitialGame(4, 1)
    expect(isAllCorpsOk(currentWeekRecord(game))).toBe(false)
  })
})

describe("uncontrollableWeeks / computeFinalScore", () => {
  it("리드타임 0주(한국)·1주(베트남)는 1주차만 손쓸 수 없다", () => {
    expect(uncontrollableWeeks(CORP_BY_ID.kr)).toBe(1)
    expect(uncontrollableWeeks(CORP_BY_ID.vn)).toBe(1)
  })

  it("리드타임 3주(브라질)는 1~3주차까지 손쓸 수 없다", () => {
    expect(uncontrollableWeeks(CORP_BY_ID.br)).toBe(3)
  })

  it("총점은 법인별로 손쓸 수 없었던 주차의 DIO 점수를 제외한 평균이다", () => {
    let game = createInitialGame(4, 1)
    while (!game.finished) {
      game = advanceWeek(game)
    }
    let expectedTotal = 0
    let expectedCount = 0
    for (const weekRecord of game.history) {
      for (const corp of CORPS) {
        if (weekRecord.week <= uncontrollableWeeks(corp)) continue
        expectedTotal += dioScore(weekRecord.corps[corp.id].dio)
        expectedCount += 1
      }
    }
    expect(computeFinalScore(game)).toBe(Math.round(expectedTotal / expectedCount))
  })
})

describe("projectedNextWeekStock / nextWeekIncoming", () => {
  it("배정한 게 없으면 다음 주 재고 = 이번 주 재고 - 이번 주 판매예측이다", () => {
    // 한국은 시작부터 이동 중인 물량이 없는 유일한 법인이라, 입고량이 정확히 0일 때를 검증할 수 있다.
    const game = createInitialGame(4, 1)
    const week1 = currentWeekRecord(game).corps.kr
    expect(nextWeekIncoming(game, "kr")).toBe(0)
    expect(projectedNextWeekStock(game, "kr")).toBe(Math.max(0, week1.stock - week1.forecast))
  })

  it("리드타임 1주(베트남)에 배정하면 다음 주 입고로 잡혀 공식이 그대로 성립한다", () => {
    // 베트남은 시작부터 이동 중이던 물량이 있으므로, 그 기준값(baseline) 대비 증가분으로 검증한다.
    const game = createInitialGame(4, 1)
    const baselineIncoming = nextWeekIncoming(game, "vn")
    const withShipment = allocateShipment(game, "vn", 300)
    const week1 = currentWeekRecord(withShipment).corps.vn

    expect(nextWeekIncoming(withShipment, "vn")).toBe(baselineIncoming + 300)
    const projected = projectedNextWeekStock(withShipment, "vn")
    expect(projected).toBe(Math.max(0, week1.stock - week1.forecast) + baselineIncoming + 300)

    // 공식이 실제 advanceWeek 결과와 정확히 같은 값을 내는지 대조한다.
    const advanced = advanceWeek(withShipment)
    expect(advanced.salesWarehouseStock.vn).toBe(projected)
  })

  it("리드타임 2주(미국)에 배정하면 다음 주에는 아직 도착하지 않아 공식에 반영되지 않는다", () => {
    const game = createInitialGame(4, 1)
    const baselineIncoming = nextWeekIncoming(game, "us")
    const withShipment = allocateShipment(game, "us", 400)

    expect(nextWeekIncoming(withShipment, "us")).toBe(baselineIncoming)
    const week1 = currentWeekRecord(withShipment).corps.us
    expect(projectedNextWeekStock(withShipment, "us")).toBe(
      Math.max(0, week1.stock - week1.forecast) + baselineIncoming
    )
  })

  it("리드타임 0주(한국)는 배정 즉시 이번 주 재고에 반영되므로 다음 주 입고로는 잡히지 않는다", () => {
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "kr", 250)
    expect(nextWeekIncoming(withShipment, "kr")).toBe(0)
  })
})

describe("incomingByArrivalWeek", () => {
  it("한국은 이동 중 물량 없이 시작해 빈 목록이다", () => {
    const game = createInitialGame(4, 1)
    expect(incomingByArrivalWeek(game, "kr")).toEqual([])
  })

  it("서로 다른 주에 도착할 출하를 도착 주차별로 묶어 오름차순으로 준다", () => {
    // 이집트 리드타임 2주: 1주차에 배정하면 3주차 도착. 시작부터 있던 이동 중 물량 기준값(baseline) 대비로 검증한다.
    const game = createInitialGame(4, 1)
    const baseline = incomingByArrivalWeek(game, "eg")
    const baselineWeek3 = baseline.find((entry) => entry.week === 3)?.quantity ?? 0
    const baselineWeek4 = baseline.find((entry) => entry.week === 4)?.quantity ?? 0

    const afterFirst = allocateShipment(game, "eg", 100)
    const afterAdvance = advanceWeek(afterFirst)
    // 2주차에 다시 배정하면 4주차 도착 예정이지만, 같은 목적지·같은 도착 주차가 아니므로 별도 항목이어야 한다.
    const afterSecond = allocateShipment(afterAdvance, "eg", 200)

    const breakdown = incomingByArrivalWeek(afterSecond, "eg")
    expect(breakdown.find((entry) => entry.week === 3)?.quantity).toBe(baselineWeek3 + 100)
    expect(breakdown.find((entry) => entry.week === 4)?.quantity).toBe(baselineWeek4 + 200)

    const weeks = breakdown.map((entry) => entry.week)
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b))
  })

  it("같은 주차에 도착하는 여러 출하는 하나로 합친다", () => {
    const game = createInitialGame(4, 1)
    const baseline = incomingByArrivalWeek(game, "us").find((entry) => entry.week === 3)?.quantity ?? 0
    const afterFirst = allocateShipment(game, "us", 100)
    const afterSecond = allocateShipment(afterFirst, "us", 50)

    const week3 = incomingByArrivalWeek(afterSecond, "us").find((entry) => entry.week === 3)
    expect(week3?.quantity).toBe(baseline + 150)
  })

  it("이미 도착한(arrived) 출하는 더 이상 포함하지 않는다", () => {
    // 베트남 리드타임 1주: 1주차에 배정하면 2주차 도착이라 한 번만 넘겨도 arrived가 된다.
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "vn", 250)
    const shipmentId = pendingShipments(withShipment)[0].id
    const afterAdvance = advanceWeek(withShipment)
    expect(afterAdvance.shipments.find((s) => s.id === shipmentId)?.status).toBe("arrived")
    expect(incomingByArrivalWeek(afterAdvance, "vn")).toEqual([])
  })

  it("리드타임 0주(한국)는 대기 출하 자체를 만들지 않으므로 이동 중 목록에 나타나지 않는다", () => {
    // 배정 즉시 재고에 반영되고 끝이라, "이동 중"이라 부를 단계 자체가 없다.
    const game = createInitialGame(4, 1)
    const withShipment = allocateShipment(game, "kr", 250)
    expect(incomingByArrivalWeek(withShipment, "kr")).toEqual([])
  })
})
