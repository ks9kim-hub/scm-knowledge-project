const MIME_TYPE = "application/x-miri-shipment"

export type DragPayload = { type: "production" } | { type: "pending"; shipmentId: string }

export function setDragPayload(event: React.DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(MIME_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = "move"
}

export function readDragPayload(event: React.DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(MIME_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}
