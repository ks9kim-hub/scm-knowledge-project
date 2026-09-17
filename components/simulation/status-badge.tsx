import { AlertTriangle, PackageCheck, PackagePlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DioStatus } from "@/lib/simulation/types"

const STATUS_META: Record<DioStatus, { label: string; variant: "destructive" | "secondary" | "default"; Icon: typeof AlertTriangle }> = {
  shortage: { label: "부족·결품 위험", variant: "destructive", Icon: AlertTriangle },
  ok: { label: "적정", variant: "secondary", Icon: PackageCheck },
  excess: { label: "과다", variant: "default", Icon: PackagePlus },
}

export function StatusBadge({ status }: { status: DioStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge variant={meta.variant} className={status === "shortage" ? "animate-pulse" : undefined}>
      <meta.Icon data-icon="inline-start" />
      {meta.label}
    </Badge>
  )
}
