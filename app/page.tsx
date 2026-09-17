"use client"

import { useState } from "react"

import { Warehouse } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GameBoard } from "@/components/simulation/game-board"
import { PeriodPicker } from "@/components/simulation/period-picker"
import { Recap } from "@/components/simulation/recap"
import {
  advanceWeek,
  allocateShipment,
  cancelShipment,
  createInitialGame,
  reassignShipment,
} from "@/lib/simulation/engine"
import { DEFAULT_PERIOD_WEEKS, MOQ } from "@/lib/simulation/master-data"
import type { CorpId, GameState } from "@/lib/simulation/types"

export default function Home() {
  const [periodWeeks, setPeriodWeeks] = useState(DEFAULT_PERIOD_WEEKS)
  const [game, setGame] = useState<GameState | null>(null)

  if (!game) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-50 p-6 dark:bg-black">
        <Warehouse
          aria-hidden
          strokeWidth={0.75}
          className="pointer-events-none absolute size-96 text-primary/50"
        />
        <Card className="relative w-full max-w-md">
          <CardHeader>
            <CardTitle>재고밸런스 마스터</CardTitle>
            <CardDescription>
              LG SCM 신입을 위한 재고관리 퀘스트 오픈!
              <br />
              매주 창고 간 출하를 조정해 판매법인의 재고 밸런스를 맞춰보세요. 드래그 한 번으로
              품절 위기 탈출, 과재고 리스크 컷. 당신의 재고 운영 센스를 테스트해보세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PeriodPicker value={periodWeeks} onChange={setPeriodWeeks} />
            <Button onClick={() => setGame(createInitialGame(periodWeeks))}>시작하기</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (game.finished) {
    return (
      <div className="flex flex-1 justify-center bg-zinc-50 p-6 dark:bg-black">
        <Recap state={game} onRestart={() => setGame(null)} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 p-6 dark:bg-black">
      <GameBoard
        state={game}
        onAllocate={(destination: CorpId) =>
          setGame((prev) => (prev ? allocateShipment(prev, destination, MOQ) : prev))
        }
        onReassign={(shipmentId, destination) =>
          setGame((prev) => (prev ? reassignShipment(prev, shipmentId, destination) : prev))
        }
        onCancel={(shipmentId) => setGame((prev) => (prev ? cancelShipment(prev, shipmentId) : prev))}
        onAdvance={() => setGame((prev) => (prev ? advanceWeek(prev) : prev))}
      />
    </div>
  )
}
