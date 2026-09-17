"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PERIOD_OPTIONS } from "@/lib/simulation/master-data"

interface PeriodPickerProps {
  value: number
  onChange: (weeks: number) => void
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(next: string[]) => {
        const selected = next[0]
        if (selected) onChange(Number(selected))
      }}
      variant="outline"
    >
      {PERIOD_OPTIONS.map((option) => (
        <ToggleGroupItem key={option.weeks} value={String(option.weeks)}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
