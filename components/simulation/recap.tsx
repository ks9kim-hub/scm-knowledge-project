"use client"

import { PartyPopper, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RankingRegistration } from "@/components/simulation/ranking-registration"
import { StatusBadge } from "@/components/simulation/status-badge"
import { computeFinalScore, isAllCorpsOk, uncontrollableWeeks } from "@/lib/simulation/engine"
import { CORPS, DIO_TARGET } from "@/lib/simulation/master-data"
import type { GameState } from "@/lib/simulation/types"
import { cn } from "cn"

interface RecapProps {
  state: GameState
  onRestart: () => void
}

export function Recap({ state, onRestart }: RecapProps) {
  const finalWeek = state.history[state.history.length - 1]
  const allOk = isAllCorpsOk(finalWeek)
  const finalScore = computeFinalScore(state)

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            {allOk && <PartyPopper data-icon="inline-start" />}
            {allOk
              ? "완주! 6개 판매법인이 모두 적정 재고입니다"
              : "완주했지만 아직 적정하지 않은 창고가 있어요"}
          </CardTitle>
          <CardDescription>
            {state.periodWeeks}주차 기준 최종 상태입니다. 아래에서 주차별로 어디가 벗어났는지 되짚어보세요.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>주차별 되짚기</CardTitle>
          <CardDescription>
            DIO는 적정 밴드(7~21일)의 정중앙인 {DIO_TARGET}일에 가까울수록 좋습니다. 회색으로
            표시된 칸은 리드타임 때문에 그 주차까지 플레이어가 손쓸 수 없었던 구간이라 총점에서
            제외했습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-xs/relaxed">
            <thead>
              <tr>
                <th className="p-1 text-left font-medium text-muted-foreground">주차</th>
                {CORPS.map((corp) => (
                  <th key={corp.id} className="p-1 text-left font-medium text-muted-foreground">
                    {corp.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.history.map((weekRecord) => (
                <tr key={weekRecord.week} className="border-t border-border">
                  <td className="p-1 font-medium">{weekRecord.week}주차</td>
                  {CORPS.map((corp) => {
                    const uncontrollable = weekRecord.week <= uncontrollableWeeks(corp)
                    return (
                      <td
                        key={corp.id}
                        className={cn("p-1", uncontrollable && "bg-muted/70")}
                        title={uncontrollable ? "리드타임상 아직 손쓸 수 없었던 주차" : undefined}
                      >
                        <div className="flex items-center gap-1">
                          <StatusBadge status={weekRecord.corps[corp.id].status} />
                          <span className="text-muted-foreground tabular-nums">
                            {weekRecord.corps[corp.id].dio.toFixed(1)}일
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-border font-medium">
                <td className="p-1">총점</td>
                <td className="p-1" colSpan={CORPS.length}>
                  {finalScore}점 / 100점
                  <span className="ml-1 font-normal text-muted-foreground">
                    (전 주차 · 전 법인의 DIO가 {DIO_TARGET}일에 얼마나 가까웠는지 평균)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <RankingRegistration score={finalScore} periodWeeks={state.periodWeeks} />

      <Button onClick={onRestart} className="self-start">
        <RotateCcw data-icon="inline-start" />
        새 판 시작하기
      </Button>
    </div>
  )
}
