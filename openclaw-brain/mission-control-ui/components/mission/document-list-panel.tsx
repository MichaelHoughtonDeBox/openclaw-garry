"use client"

import { Search, SquareArrowOutUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import { ASSIGNEES, DOCUMENT_SOURCES } from "@/lib/mission/constants"
import type { Assignee, DocumentSource, MissionDocument } from "@/lib/mission/types"

type DocumentFilters = {
  assignee?: Assignee
  source?: DocumentSource
  q: string
  taskId: string
}

type DocumentListPanelProps = {
  documents: MissionDocument[]
  filters: DocumentFilters
  onFiltersChange: (patch: Partial<DocumentFilters>) => void
  onOpenDocument: (document: MissionDocument) => void
}

export function DocumentListPanel({
  documents,
  filters,
  onFiltersChange,
  onOpenDocument,
}: DocumentListPanelProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="size-4" />
          Documents
        </CardTitle>
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Search title/content"
              value={filters.q}
              onChange={(event) => onFiltersChange({ q: event.target.value })}
            />
            <Input
              placeholder="Filter by task id"
              value={filters.taskId}
              onChange={(event) => onFiltersChange({ taskId: event.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={filters.assignee ?? "__all_assignees"}
              onValueChange={(value) =>
                onFiltersChange({
                  assignee: value === "__all_assignees" ? undefined : (value as Assignee),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_assignees">All assignees</SelectItem>
                {ASSIGNEES.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.source ?? "__all_sources"}
              onValueChange={(value) =>
                onFiltersChange({
                  source: value === "__all_sources" ? undefined : (value as DocumentSource),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_sources">All sources</SelectItem>
                {DOCUMENT_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents match the current filters.</p>
        ) : (
          documents.map((document) => (
            <div key={document.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">{document.title}</p>
                <div className="flex gap-1">
                  <Badge variant="outline">{document.assignee}</Badge>
                  <Badge variant="secondary">{document.source}</Badge>
                </div>
              </div>
              <div className="mt-1 max-h-14 overflow-hidden text-muted-foreground">
                <MarkdownViewer content={document.contentMd} compact className="text-[11px] [&_p]:line-clamp-2" />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(document.updated_at).toLocaleString()}
                {document.taskId ? ` • task ${document.taskId}` : ""}
              </p>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => onOpenDocument(document)}>
                  <SquareArrowOutUpRight className="size-3.5" />
                  Open
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
