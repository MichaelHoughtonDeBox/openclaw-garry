"use client"

import Link from "next/link"
import { ExternalLink, FileText, Search } from "lucide-react"
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
import { useDashboard } from "@/lib/mission/dashboard-context"
import type { DocumentFilters } from "@/lib/mission/dashboard-context"
import type { MissionDocument } from "@/lib/mission/types"

/**
 * Rich documents view: full-width list with filters, larger cards, and links to full-page read.
 * Renders inside DashboardShell center column.
 */
export function DocumentsView() {
  const {
    documents,
    documentFilters,
    setDocumentFilters,
    setSelectedDocument,
  } = useDashboard()

  function handleOpenInSheet(document: MissionDocument) {
    setSelectedDocument(document)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Documents
          </CardTitle>
          <div
            className="flex flex-wrap items-end gap-3"
            role="search"
            aria-label="Document filters"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[200px]">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search title/content"
                value={documentFilters.q}
                onChange={(e) =>
                  setDocumentFilters((prev) => ({ ...prev, q: e.target.value }))
                }
                className="h-9"
              />
            </div>
            <Input
              placeholder="Filter by task id"
              value={documentFilters.taskId}
              onChange={(e) =>
                setDocumentFilters((prev) => ({ ...prev, taskId: e.target.value }))
              }
              className="h-9 w-36"
            />
            <Select
              value={documentFilters.assignee ?? "__all_assignees"}
              onValueChange={(value) =>
                setDocumentFilters({
                  assignee:
                    value === "__all_assignees"
                      ? undefined
                      : (value as DocumentFilters["assignee"]),
                })
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
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
              value={documentFilters.source ?? "__all_sources"}
              onValueChange={(value) =>
                setDocumentFilters({
                  source:
                    value === "__all_sources"
                      ? undefined
                      : (value as DocumentFilters["source"]),
                })
              }
            >
              <SelectTrigger className="h-9 w-[120px]">
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
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No documents match the current filters.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onOpenInSheet={handleOpenInSheet}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type DocumentCardProps = {
  document: MissionDocument
  onOpenInSheet: (doc: MissionDocument) => void
}

/**
 * Rich document card with preview, metadata, and quick/full-page actions.
 */
function DocumentCard({ document, onOpenInSheet }: DocumentCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-medium leading-tight">
          {document.title}
        </h3>
        <div className="flex shrink-0 gap-1">
          <Badge variant="outline" className="text-[10px]">
            {document.assignee}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {document.source}
          </Badge>
        </div>
      </div>
      <div className="mt-2 max-h-20 overflow-hidden text-muted-foreground">
        <MarkdownViewer
          content={document.contentMd}
          compact
          className="text-xs [&_p]:line-clamp-3"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {new Date(document.updated_at).toLocaleString()}
        {document.taskId ? ` • task ${document.taskId}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenInSheet(document)}
          className="h-8"
        >
          Quick view
        </Button>
        <Button size="sm" variant="default" asChild className="h-8">
          <Link href={`/documents/${document.id}`}>
            <ExternalLink className="size-3.5" />
            Full page
          </Link>
        </Button>
      </div>
    </article>
  )
}
