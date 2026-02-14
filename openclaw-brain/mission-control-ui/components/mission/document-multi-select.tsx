"use client"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import type { MissionDocument } from "@/lib/mission/types"
import { cn } from "@/lib/utils"

type DocumentMultiSelectProps = {
  documents: MissionDocument[]
  value: string[]
  onChange: (nextValue: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DocumentMultiSelect({
  documents,
  value,
  onChange,
  placeholder = "Search and select documents",
  disabled,
  className,
}: DocumentMultiSelectProps) {
  const anchorRef = useComboboxAnchor()
  const options = documents.map((document) => ({
    id: document.id,
    title: document.title,
    meta: `${document.assignee} • ${new Date(document.updated_at).toLocaleString()}`,
  }))
  const optionsById = new Map(options.map((option) => [option.id, option]))

  return (
    <div className={cn("space-y-1", className)}>
      <Combobox
        multiple
        items={options.map((option) => option.id)}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => onChange((nextValue as string[]) ?? [])}
      >
        <ComboboxChips ref={anchorRef}>
          {value.map((documentId) => {
            const option = optionsById.get(documentId)
            return (
              <ComboboxChip key={documentId}>
                {option?.title ?? documentId}
              </ComboboxChip>
            )
          })}
          <ComboboxChipsInput placeholder={placeholder} />
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No matching documents found.</ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              const option = optionsById.get(item)
              if (!option) {
                return null
              }
              return (
                <ComboboxItem key={item} value={item}>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{option.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{option.meta}</p>
                  </div>
                </ComboboxItem>
              )
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
