"use client"

import { useEffect, useState } from "react"
import {
  FilePenLine,
  Link as LinkIcon,
  Network,
  UserRound,
  Workflow,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MarkdownEditor } from "@/components/mission/markdown-editor"
import { Textarea } from "@/components/ui/textarea"
import { ASSIGNEES, DOCUMENT_SOURCES } from "@/lib/mission/constants"
import type { Assignee, DocumentSource } from "@/lib/mission/types"

type DocumentComposerDialogProps = {
  operator: string
  disabled?: boolean
  defaultAssignee?: Assignee
  defaultAgentId?: string
  defaultTaskId?: string
  triggerLabel?: string
  onCreateDocument: (input: {
    title: string
    contentMd: string
    assignee: Assignee
    agentId: string
    taskId?: string
    linked_task_ids: string[]
    source: DocumentSource
    url?: string
    metadata?: Record<string, unknown>
    operator: string
  }) => Promise<void>
}

export function DocumentComposerDialog({
  operator,
  disabled,
  defaultAssignee,
  defaultAgentId,
  defaultTaskId,
  triggerLabel,
  onCreateDocument,
}: DocumentComposerDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [contentMd, setContentMd] = useState("")
  const [assignee, setAssignee] = useState<Assignee>(defaultAssignee ?? "corey")
  const [agentId, setAgentId] = useState(defaultAgentId ?? defaultAssignee ?? "corey")
  const [taskId, setTaskId] = useState(defaultTaskId ?? "")
  const [source, setSource] = useState<DocumentSource>("agent")
  const [url, setUrl] = useState("")
  const [metadataRaw, setMetadataRaw] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setAssignee(defaultAssignee ?? "corey")
    setAgentId(defaultAgentId ?? defaultAssignee ?? "corey")
    setTaskId(defaultTaskId ?? "")
  }, [defaultAgentId, defaultAssignee, defaultTaskId, open])

  async function submit() {
    if (title.trim().length < 3 || contentMd.trim().length < 1) {
      return
    }
    setError(null)

    let metadata: Record<string, unknown> | undefined
    if (metadataRaw.trim()) {
      try {
        const parsed = JSON.parse(metadataRaw)
        // Metadata must remain a flat JSON object for safe storage/filtering.
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new Error("Metadata must be a JSON object")
        }
        metadata = parsed as Record<string, unknown>
      } catch {
        setError("Metadata must be valid JSON object syntax.")
        return
      }
    }

    setSubmitting(true)
    try {
      await onCreateDocument({
        title: title.trim(),
        contentMd: contentMd.trim(),
        assignee,
        agentId: agentId.trim() || assignee,
        taskId: taskId.trim() || undefined,
        linked_task_ids: taskId.trim() ? [taskId.trim()] : [],
        source,
        url: url.trim() || undefined,
        metadata,
        operator,
      })
      setTitle("")
      setContentMd("")
      setSource("agent")
      setUrl("")
      setMetadataRaw("")
      setError(null)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm" variant="outline" className="h-8 shrink-0 whitespace-nowrap px-2.5">
          <FilePenLine />
          {triggerLabel ?? "Create document"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Create Mission Document</AlertDialogTitle>
          <AlertDialogDescription>
            Write agent output directly to Mongo so artifacts are visible in Mission Control immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <FilePenLine className="size-3.5" />
              Title
            </p>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Q1 onboarding research draft" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <UserRound className="size-3.5" />
                Assignee
              </p>
              <Select value={assignee} onValueChange={(value) => setAssignee(value as Assignee)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEES.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {candidate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Workflow className="size-3.5" />
                Source
              </p>
              <Select value={source} onValueChange={(value) => setSource(value as DocumentSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_SOURCES.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {candidate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <UserRound className="size-3.5" />
                Agent ID
              </p>
              <Input value={agentId} onChange={(event) => setAgentId(event.target.value)} placeholder="corey" />
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Network className="size-3.5" />
                Linked Task ID (optional)
              </p>
              <Input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Mongo ObjectId" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <LinkIcon className="size-3.5" />
              External URL (optional)
            </p>
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <FilePenLine className="size-3.5" />
              Content (Markdown)
            </p>
            <MarkdownEditor value={contentMd} onChange={setContentMd} rows={10} placeholder="# Deliverable title" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Metadata JSON (optional)</p>
            <Textarea
              value={metadataRaw}
              onChange={(event) => setMetadataRaw(event.target.value)}
              rows={3}
              placeholder='{"campaign":"linkedin-scanner-sock"}'
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <Button disabled={submitting} onClick={submit}>
            {submitting ? "Saving..." : "Save document"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
