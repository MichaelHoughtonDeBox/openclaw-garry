"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import { fetchDocument } from "@/lib/mission/client"
import { useDashboard } from "@/lib/mission/dashboard-context"
import type { MissionDocument } from "@/lib/mission/types"

type DocumentPageViewProps = {
  documentId: string
}

/**
 * Full-page document reading view with readable typography and metadata.
 * Fetches document by ID if not in context (supports deep links).
 */
export function DocumentPageView({ documentId }: DocumentPageViewProps) {
  const { documents, setSelectedDocument } = useDashboard()
  const [document, setDocument] = useState<MissionDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocument = useCallback(async () => {
    const fromContext = documents.find((d) => d.id === documentId)
    if (fromContext) {
      setDocument(fromContext)
      setLoading(false)
      return
    }
    try {
      const loaded = await fetchDocument(documentId)
      setDocument(loaded)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load document."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [documentId, documents])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading document...</p>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-sm text-destructive">{error ?? "Document not found."}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/documents">
            <ArrowLeft className="size-3.5" />
            Back to documents
          </Link>
        </Button>
      </div>
    )
  }

  function handleOpenInSheet() {
    setSelectedDocument(document)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/documents" className="inline-flex items-center gap-2">
            <ArrowLeft className="size-3.5" />
            Back to documents
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-tight">
            {document.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInSheet}
            className="shrink-0"
          >
            <PencilLine className="size-3.5" />
            Edit in sheet
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{document.assignee}</Badge>
          <Badge variant="secondary">{document.source}</Badge>
          <Badge variant="outline">{document.agentId}</Badge>
        </div>

        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>Created: {new Date(document.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(document.updated_at).toLocaleString()}</p>
          {document.taskId ? (
            <p>Task: {document.taskId}</p>
          ) : null}
          {document.linked_task_ids.length > 0 ? (
            <p>Linked tasks: {document.linked_task_ids.join(", ")}</p>
          ) : null}
        </div>

        {document.url ? (
          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-sm text-primary underline underline-offset-2"
          >
            {document.url}
          </a>
        ) : null}
      </header>

      <hr className="border-border" />

      <article className="prose prose-sm dark:prose-invert max-w-none">
        <MarkdownViewer content={document.contentMd} />
      </article>

      {document.metadata ? (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            Metadata
          </summary>
          <pre className="overflow-x-auto border-t border-border bg-muted/30 p-3 text-[11px]">
            {JSON.stringify(document.metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
