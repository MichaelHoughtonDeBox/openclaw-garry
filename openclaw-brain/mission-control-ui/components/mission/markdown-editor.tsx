"use client"

import { useState } from "react"
import { Eye, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import { cn } from "@/lib/utils"

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  previewClassName?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 10,
  className,
  previewClassName,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit")

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Markdown supports headings, lists, links, and tables.</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "edit" ? "secondary" : "outline"}
            onClick={() => setMode("edit")}
          >
            <PencilLine />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "preview" ? "secondary" : "outline"}
            onClick={() => setMode("preview")}
          >
            <Eye />
            Preview
          </Button>
        </div>
      </div>

      {mode === "edit" ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <div className={cn("min-h-32 rounded-md border bg-background p-3", previewClassName)}>
          <MarkdownViewer content={value} emptyMessage="Nothing to preview yet." />
        </div>
      )}
    </div>
  )
}
