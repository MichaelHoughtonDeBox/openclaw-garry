"use client"

import { useState } from "react"
import { Check, PencilLine, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MarkdownEditor } from "@/components/mission/markdown-editor"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import { DOCUMENT_SOURCES } from "@/lib/mission/constants"
import type { DocumentSource, MissionDocument } from "@/lib/mission/types"

type DocumentDetailSheetProps = {
  document: MissionDocument | null
  operator: string
  busy?: boolean
  onClose: () => void
  onUpdateDocument: (input: {
    documentId: string
    title?: string
    contentMd?: string
    source?: DocumentSource
    url?: string | null
    operator: string
  }) => Promise<void>
}

export function DocumentDetailSheet({
  document,
  operator,
  busy,
  onClose,
  onUpdateDocument,
}: DocumentDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(document?.title ?? "")
  const [contentDraft, setContentDraft] = useState(document?.contentMd ?? "")
  const [sourceDraft, setSourceDraft] = useState<DocumentSource>(document?.source ?? "agent")
  const [urlDraft, setUrlDraft] = useState(document?.url ?? "")
  const [error, setError] = useState<string | null>(null)

  if (!document) {
    return null
  }
  const activeDocument = document

  async function saveEdits() {
    if (titleDraft.trim().length < 3) {
      setError("Title must be at least 3 characters.")
      return
    }
    if (contentDraft.trim().length < 1) {
      setError("Markdown content cannot be empty.")
      return
    }
    setError(null)
    await onUpdateDocument({
      documentId: activeDocument.id,
      title: titleDraft.trim(),
      contentMd: contentDraft.trim(),
      source: sourceDraft,
      url: urlDraft.trim() ? urlDraft.trim() : null,
      operator,
    })
    setIsEditing(false)
  }

  function resetEdits() {
    setTitleDraft(activeDocument.title)
    setContentDraft(activeDocument.contentMd)
    setSourceDraft(activeDocument.source)
    setUrlDraft(activeDocument.url ?? "")
    setError(null)
    setIsEditing(false)
  }

  function startEditing() {
    setTitleDraft(activeDocument.title)
    setContentDraft(activeDocument.contentMd)
    setSourceDraft(activeDocument.source)
    setUrlDraft(activeDocument.url ?? "")
    setError(null)
    setIsEditing(true)
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full border-l border-border bg-background p-4 shadow-xl sm:w-[640px]">
      <Card className="h-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">{document.title}</CardTitle>
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" disabled={busy} onClick={resetEdits}>
                    <X />
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy} onClick={saveEdits}>
                    <Check />
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={startEditing}>
                  <PencilLine />
                  Edit
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{document.assignee}</Badge>
            <Badge variant="secondary">{document.source}</Badge>
            <Badge variant="outline">{document.agentId}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto pb-6">
          <div className="text-xs text-muted-foreground">
            <p>Created: {new Date(document.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(document.updated_at).toLocaleString()}</p>
            <p>Task: {document.taskId ?? "unlinked"}</p>
            <p>
              Linked tasks: {document.linked_task_ids.length > 0 ? document.linked_task_ids.join(", ") : "none"}
            </p>
          </div>

          {isEditing ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1">
                <p className="text-xs font-medium">Title</p>
                <Input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Source</p>
                <Select value={sourceDraft} onValueChange={(value) => setSourceDraft(value as DocumentSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">External URL (optional)</p>
                <Input value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Content (Markdown)</p>
                <MarkdownEditor
                  value={contentDraft}
                  onChange={setContentDraft}
                  rows={12}
                  placeholder="# Reference document title"
                />
              </div>
            </div>
          ) : null}

          {!isEditing && document.url ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">External URL</p>
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-xs text-primary underline underline-offset-2"
              >
                {document.url}
              </a>
            </div>
          ) : null}

          {document.metadata ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">Metadata</p>
              <pre className="overflow-x-auto rounded-md border bg-muted p-2 text-[11px]">
                {JSON.stringify(document.metadata, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs font-medium">Content</p>
            <div className="rounded-md border p-3">
              <MarkdownViewer content={isEditing ? contentDraft : document.contentMd} />
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </aside>
  )
}
