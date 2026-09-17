import worldMap from "@svg-maps/world"
import type { CorpId } from "@/lib/simulation/types"

interface Location {
  id: string
  name: string
  path: string
}

const HIGHLIGHT_IDS: Record<CorpId, true> = { kr: true, us: true, gb: true, vn: true, br: true, eg: true }

/** 실제 세계지도(@svg-maps/world, CC BY 4.0 MapSVG)에서 등장하는 6개 법인 국가만 강조한다. */
export function WorldMapBackground() {
  const { viewBox, locations } = worldMap as { viewBox: string; locations: Location[] }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {locations.map((location) => (
        <path
          key={location.id}
          id={`map-${location.id}`}
          d={location.path}
          className={
            HIGHLIGHT_IDS[location.id as CorpId]
              ? "fill-primary/25 stroke-primary/40"
              : "fill-muted-foreground/10 stroke-muted-foreground/15"
          }
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}
