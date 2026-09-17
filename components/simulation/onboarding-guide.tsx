"use client"

import { MousePointerClick } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DIO_TARGET } from "@/lib/simulation/master-data"

/** 게임판 위에서 마우스를 올리면 드래그 앤 드롭 방법을 보여준다. 평소엔 트리거 한 줄만 차지한다. */
export function OnboardingGuide() {
  return (
    <HoverCard>
      <HoverCardTrigger className="inline-flex w-fit shrink-0 cursor-help items-center gap-1 self-start rounded-md border border-dashed border-border px-2 py-1 text-xs/relaxed whitespace-nowrap text-muted-foreground outline-none hover:border-primary hover:text-foreground">
        <MousePointerClick className="size-3.5" />
        드래그 앤 드롭 사용법 (마우스를 올려보세요)
      </HoverCardTrigger>
      <HoverCardContent className="w-[36rem]">
        <p className="font-medium text-foreground">드래그 앤 드롭으로 출하를 배정하세요</p>
        <p className="mt-1">생산법인 재고 박스를 판매법인 카드 위로 끌어다 놓으면 100개씩 배정됩니다.</p>
        <p className="mt-1">다음 주로 넘기기 전까지는 대기 중인 박스를 다시 끌어서 취소하거나 다른 법인으로 옮길 수 있어요.</p>
        <p className="mt-1">
          각 법인의 DIO가 적정 밴드(7~21일) 안에서, 목표인 {DIO_TARGET}일에 가깝도록 조절한 뒤
          &quot;다음 주&quot;를 눌러 진행하세요.
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
