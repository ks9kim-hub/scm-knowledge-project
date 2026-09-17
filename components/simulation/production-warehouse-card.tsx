"use client"

import { useRef, useState } from "react"

import { Factory, Tv } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CORP_BY_ID, MOQ } from "@/lib/simulation/master-data"
import { readDragPayload, setDragPayload } from "@/lib/simulation/drag-payload"
import type { CorpId, Shipment } from "@/lib/simulation/types"
import { cn } from "cn"

/** 같은 목적지로 가는 대기 중 출하를 하나의 박스로 모아 보여준다. */
function groupPendingByDestination(pending: Shipment[]): { destination: CorpId; shipments: Shipment[] }[] {
  const order: CorpId[] = []
  const byDestination = new Map<CorpId, Shipment[]>()
  for (const shipment of pending) {
    const list = byDestination.get(shipment.destination)
    if (list) {
      list.push(shipment)
    } else {
      byDestination.set(shipment.destination, [shipment])
      order.push(shipment.destination)
    }
  }
  return order.map((destination) => ({ destination, shipments: byDestination.get(destination)! }))
}

interface ProductionWarehouseCardProps {
  pending: Shipment[]
  stock: number
  onCancel: (shipmentId: string) => void
  /** 고인물 모드가 아니면 Number.POSITIVE_INFINITY라 제약 표시가 나타나지 않는다. */
  weeklyCapacity: number
  remainingCapacity: number
}

export function ProductionWarehouseCard({
  pending,
  stock,
  onCancel,
  weeklyCapacity,
  remainingCapacity,
}: ProductionWarehouseCardProps) {
  const [dragOver, setDragOver] = useState(false)
  const tvDragImageRef = useRef<HTMLDivElement>(null)
  const isCapacityLimited = Number.isFinite(weeklyCapacity)
  const capacityExhausted = isCapacityLimited && remainingCapacity < MOQ

  function applyTvDragImage(event: React.DragEvent) {
    // setDragImage 실패가 실제 배정(setDragPayload)까지 막으면 안 되므로 절대 던지지 않는다.
    try {
      if (tvDragImageRef.current && typeof event.dataTransfer.setDragImage === "function") {
        event.dataTransfer.setDragImage(tvDragImageRef.current, 24, 24)
      }
    } catch {
      // 드래그 미리보기는 장식일 뿐이니 실패해도 무시한다.
    }
  }

  return (
    <>
      {/* 드래그 중에 브라우저 기본 미리보기 대신 보여줄 LG TV 모양. 화면 밖에 그려두고
          setDragImage로 이 요소를 캡처해서 쓴다. */}
      <div
        ref={tvDragImageRef}
        aria-hidden
        className="pointer-events-none fixed top-[-999px] left-[-999px] flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <Tv className="size-7" />
      </div>

      <Card
        size="sm"
        onDragOver={(event) => {
        // 이 페이지엔 우리 출하 박스 말고 다른 드래그 가능한 요소가 없으므로, dragover는 항상
        // 허용하고 실제 판정(취소 대상인지)은 drop 시점에서 한다. dragover 단계에서 커스텀
        // MIME 타입을 미리 걸러내려 하면 브라우저에 따라 preventDefault가 호출되지 않아 "허용
        // 안 됨" 커서만 뜨고 드롭이 아예 막히는 문제가 있었다.
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        const payload = readDragPayload(event)
        if (payload?.type === "pending") onCancel(payload.shipmentId)
      }}
      title="대기 중인 출하를 여기로 다시 끌어다 놓으면 취소됩니다"
      className={cn(
        "w-full flex-row items-center gap-3 border-2 border-dashed border-border transition-colors",
        dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <CardHeader className="w-max shrink-0" style={{ containerType: "normal" }}>
        <CardTitle className="flex items-center gap-1 text-[0.6875rem] whitespace-nowrap">
          <Factory className="size-3" />
          생산법인 · 한국
        </CardTitle>
        {isCapacityLimited && (
          <p
            className={cn(
              "text-[0.5625rem] whitespace-nowrap",
              capacityExhausted ? "text-destructive" : "text-muted-foreground"
            )}
          >
            이번 주 출하 가능 {remainingCapacity.toLocaleString("ko-KR")} / {weeklyCapacity.toLocaleString("ko-KR")}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div
          draggable={!capacityExhausted}
          title={
            capacityExhausted
              ? "이번 주 출하 가능량을 다 썼습니다. 다음 주로 넘기면 다시 배정할 수 있어요."
              : "드래그해서 판매법인 창고로 출하 (1회 100개)"
          }
          onDragStart={(event) => {
            applyTvDragImage(event)
            setDragPayload(event, { type: "production" })
          }}
          className={cn(
            "flex h-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-primary px-4 text-primary-foreground select-none",
            capacityExhausted ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"
          )}
        >
          <Tv className="size-3.5" />
          <span className="text-[0.6875rem] font-semibold leading-none whitespace-nowrap">
            {stock.toLocaleString("ko-KR")}
          </span>
        </div>

        {groupPendingByDestination(pending).map(({ destination, shipments }) => {
          const totalQuantity = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0)
          const representative = shipments[0]
          return (
            <div
              key={destination}
              draggable
              title={`대기 중 · ${CORP_BY_ID[destination].name}로 총 ${totalQuantity}개 — 드래그하면 100개씩 목적지를 바꿉니다`}
              onDragStart={(event) => {
                applyTvDragImage(event)
                setDragPayload(event, { type: "pending", shipmentId: representative.id })
              }}
              className="flex h-12 shrink-0 cursor-grab flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-secondary px-3 text-secondary-foreground select-none active:cursor-grabbing"
            >
              <span className="text-[0.625rem] leading-none whitespace-nowrap">
                {CORP_BY_ID[destination].name}
              </span>
              <Badge variant="outline" className="h-3.5 px-1 text-[0.5rem]">
                {totalQuantity.toLocaleString("ko-KR")}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
    </>
  )
}
