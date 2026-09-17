"use client"

import { useState } from "react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/simulation/status-badge"
import { readDragPayload } from "@/lib/simulation/drag-payload"
import type { CorpMaster, CorpWeekRecord } from "@/lib/simulation/types"
import { cn } from "cn"

interface SalesWarehouseCardProps {
  corp: CorpMaster
  record: CorpWeekRecord
  upcomingForecast: { week: number; forecast: number }[]
  nextWeekIncoming: number
  incomingByWeek: { week: number; quantity: number }[]
  onAllocate: (destination: CorpMaster["id"]) => void
  onReassign: (shipmentId: string, destination: CorpMaster["id"]) => void
}

export function SalesWarehouseCard({
  corp,
  record,
  upcomingForecast,
  nextWeekIncoming,
  incomingByWeek,
  onAllocate,
  onReassign,
}: SalesWarehouseCardProps) {
  const [dragOver, setDragOver] = useState(false)

  // 다음 주 재고 = 이번 주 재고 - 이번 주 판매예측 + 다음 주 입고. 재고는 0 밑으로
  // 내려가지 않으므로, 뺄셈만으로 음수가 나오면 그 사실을 그대로 드러낸다.
  const rawAfterSales = record.stock - record.forecast
  const stockAfterSales = Math.max(0, rawAfterSales)
  const projectedNextWeek = stockAfterSales + nextWeekIncoming

  return (
    <Card
      size="sm"
      onDragOver={(event) => {
        // dataTransfer.types 존재 여부로 우리 출하 드래그인지 미리 걸러내려 했지만, 브라우저에
        // 따라 dragover 시점에 커스텀 MIME 타입이 안정적으로 읽히지 않아 preventDefault가
        // 호출되지 않고 "허용 안 됨" 커서만 뜨는 문제가 있었다. 이 페이지에 다른 드래그 가능한
        // 요소가 없으므로, dragover는 항상 허용하고 실제 판정은 drop 시점(getData가 항상
        // 안정적으로 동작)에서 한다.
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        const payload = readDragPayload(event)
        if (!payload) return
        if (payload.type === "production") onAllocate(corp.id)
        else onReassign(payload.shipmentId, corp.id)
      }}
      className={cn(
        "w-56 bg-card/78 transition-colors",
        dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <CardHeader>
        <CardTitle className="text-[0.6875rem]">{corp.name}</CardTitle>
        <CardAction>
          <StatusBadge status={record.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <dl className="grid grid-cols-2 gap-x-1.5 gap-y-1 text-[0.625rem]/relaxed">
          <dt className="text-muted-foreground">재고</dt>
          <dd className="text-right font-medium">{record.stock.toLocaleString("ko-KR")}</dd>
          <dt className="text-muted-foreground">판매예측</dt>
          <dd className="text-right font-medium">{record.forecast.toLocaleString("ko-KR")}</dd>
          <dt className="text-muted-foreground">DIO</dt>
          <dd className="text-right font-medium">{record.dio.toFixed(1)}일</dd>
          <dt className="text-muted-foreground">리드타임</dt>
          <dd className="text-right font-medium">{corp.leadTimeWeeks}주</dd>
        </dl>

        <div className="rounded-sm bg-muted px-1.5 py-1">
          <p className="text-[0.5rem] text-muted-foreground">다음 주 예상 재고</p>
          <p
            className="text-[0.5625rem] font-medium tabular-nums"
            title="다음 주 재고 = 이번 주 재고 − 이번 주 판매예측 + 다음 주 입고"
          >
            {record.stock.toLocaleString("ko-KR")} − {record.forecast.toLocaleString("ko-KR")}
            {rawAfterSales < 0 ? `→0` : ""} + {nextWeekIncoming.toLocaleString("ko-KR")} ={" "}
            <span className="text-foreground">{projectedNextWeek.toLocaleString("ko-KR")}</span>
          </p>
        </div>

        {upcomingForecast.length > 1 && (
          <div className="flex flex-col gap-1">
            <p className="text-[0.5625rem] text-muted-foreground">
              예측 (리드 {corp.leadTimeWeeks}주)
            </p>
            <div className="grid grid-cols-4 gap-1">
              {upcomingForecast.map(({ week, forecast }) => (
                <div
                  key={week}
                  className="flex flex-col items-center rounded-sm bg-muted px-0.5 py-0.5"
                >
                  <span className="text-[0.5rem] leading-none text-muted-foreground">{week}</span>
                  <span className="text-[0.5625rem] leading-tight font-medium tabular-nums">
                    {forecast.toLocaleString("ko-KR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {incomingByWeek.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[0.5625rem] text-muted-foreground">이동중 (도착 주차별)</p>
            <div className="grid grid-cols-4 gap-1">
              {incomingByWeek.map(({ week, quantity }) => (
                <div
                  key={week}
                  className="flex flex-col items-center rounded-sm bg-secondary px-0.5 py-0.5"
                >
                  <span className="text-[0.5rem] leading-none text-muted-foreground">{week}</span>
                  <span className="text-[0.5625rem] leading-tight font-medium tabular-nums">
                    {quantity.toLocaleString("ko-KR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
