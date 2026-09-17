"use client"

import { Button } from "@/components/ui/button"
import { OnboardingGuide } from "@/components/simulation/onboarding-guide"
import { ProductionWarehouseCard } from "@/components/simulation/production-warehouse-card"
import { SalesWarehouseCard } from "@/components/simulation/sales-warehouse-card"
import { WorldMapBackground } from "@/components/simulation/world-map-background"
import {
  currentWeekRecord,
  incomingByArrivalWeek,
  nextWeekIncoming,
  pendingShipments,
  remainingShipCapacity,
  weeklyShipCapacity,
} from "@/lib/simulation/engine"
import { CORP_MAP_POSITION } from "@/lib/simulation/map-positions"
import { CORPS, DISPLAY_WINDOW_WEEKS } from "@/lib/simulation/master-data"
import type { CorpId, GameState } from "@/lib/simulation/types"

interface GameBoardProps {
  state: GameState
  onAllocate: (destination: CorpId) => void
  onReassign: (shipmentId: string, destination: CorpId) => void
  onCancel: (shipmentId: string) => void
  onAdvance: () => void
}

export function GameBoard({ state, onAllocate, onReassign, onCancel, onAdvance }: GameBoardProps) {
  const week = currentWeekRecord(state)
  const pending = pendingShipments(state)

  return (
    <div className="flex w-full max-w-6xl flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium">
            {state.currentWeek}주차 / 총 {state.periodWeeks}주
          </p>
          <OnboardingGuide />
        </div>
        <Button onClick={onAdvance}>다음 주</Button>
      </div>

      <ProductionWarehouseCard
        pending={pending}
        stock={state.productionStock}
        onCancel={onCancel}
        weeklyCapacity={weeklyShipCapacity(state)}
        remainingCapacity={remainingShipCapacity(state)}
      />

      <div className="overflow-x-auto rounded-lg">
        <div
          className="relative min-w-[1150px] overflow-hidden rounded-lg bg-background ring-1 ring-border"
          style={{ aspectRatio: "1010 / 666" }}
        >
          <WorldMapBackground />

          {CORPS.map((corp) => {
            const position = CORP_MAP_POSITION[corp.id]
            const arrivalBreakdown = incomingByArrivalWeek(state, corp.id)
            // "예측"과 "이동중"이 같은 주차 칸에 나란히 놓이도록, 두 배열 모두 같은 주차
            // 범위로 만든다. periodWeeks가 짧아도(예: 1주) 리드타임이 긴 법인의 도착 주차가
            // 잘리지 않도록 최소 DISPLAY_WINDOW_WEEKS주는 내다본다. 이동 중인 물량이 없는
            // 주차는 0으로 채운다.
            const upcomingForecast = []
            const incomingByWeek = []
            const displayWindowEnd = state.currentWeek + DISPLAY_WINDOW_WEEKS - 1
            for (let w = state.currentWeek; w <= displayWindowEnd; w++) {
              upcomingForecast.push({ week: w, forecast: state.forecastByWeek[w][corp.id] })
              incomingByWeek.push({
                week: w,
                quantity: arrivalBreakdown.find((entry) => entry.week === w)?.quantity ?? 0,
              })
            }

            return (
              <div
                key={corp.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${position.xPct}%`, top: `${position.yPct}%` }}
              >
                <SalesWarehouseCard
                  corp={corp}
                  record={week.corps[corp.id]}
                  upcomingForecast={upcomingForecast}
                  nextWeekIncoming={nextWeekIncoming(state, corp.id)}
                  incomingByWeek={incomingByWeek}
                  onAllocate={onAllocate}
                  onReassign={onReassign}
                />
              </div>
            )
          })}

          <a
            href="https://mapsvg.com/maps/world"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-1 bottom-1 text-[0.5625rem] text-muted-foreground/60 hover:text-muted-foreground"
          >
            지도: MapSVG (CC BY 4.0)
          </a>
        </div>
      </div>
    </div>
  )
}
