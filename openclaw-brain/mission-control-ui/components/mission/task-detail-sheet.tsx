"use client"

import { useMemo, useState } from "react"
import { FileText, Link2, ListTodo, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentComposerDialog } from "@/components/mission/document-composer-dialog"
import { DocumentMultiSelect } from "@/components/mission/document-multi-select"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import { TaskMessageThread } from "@/components/mission/task-message-thread"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { TaskPriorityBadge, TaskStatusBadge, TriggerStateBadge } from "@/components/mission/status-badge"
import type { DocumentSource, MissionDocument, Task, TaskMessage, TaskStatus } from "@/lib/mission/types"

type TaskDetailSheetProps = {
  task: Task | null
  operator: string
  busy?: boolean
  taskMessages: TaskMessage[]
  taskMessagesLoading?: boolean
  mentionCandidates: Task["assignee"][]
  linkedDocuments: MissionDocument[]
  availableDocuments: MissionDocument[]
  onClose: () => void
  onTransition: (input: { taskId: string; toStatus: TaskStatus; note?: string }) => Promise<void>
  onAppendLog: (input: { taskId: string; message: string }) => Promise<void>
  onCreateTaskMessage: (input: {
    taskId: string
    content: string
    linked_document_ids?: string[]
  }) => Promise<void>
  onLinkDocuments: (input: { taskId: string; documentIds: string[] }) => Promise<void>
  onOpenDocument: (documentId: string) => Promise<void> | void
  onCreateDocument: (input: {
    title: string
    contentMd: string
    assignee: Task["assignee"]
    agentId: string
    taskId?: string
    linked_task_ids: string[]
    source: DocumentSource
    url?: string
    metadata?: Record<string, unknown>
    operator: string
  }) => Promise<void>
}

export function TaskDetailSheet({
  task,
  operator,
  busy,
  taskMessages,
  taskMessagesLoading,
  mentionCandidates,
  linkedDocuments,
  availableDocuments,
  onClose,
  onTransition,
  onAppendLog,
  onCreateTaskMessage,
  onLinkDocuments,
  onOpenDocument,
  onCreateDocument,
}: TaskDetailSheetProps) {
  const [statusNote, setStatusNote] = useState("")
  const [logMessage, setLogMessage] = useState("")
  const [documentsToLink, setDocumentsToLink] = useState<string[]>([])

  const dependencyLabel = useMemo(() => {
    if (!task || task.dependencies.length === 0) {
      return "none"
    }
    return task.dependencies.join(", ")
  }, [task])

  const linkedDocumentsById = useMemo(() => {
    return new Map(linkedDocuments.map((document) => [document.id, document]))
  }, [linkedDocuments])

  if (!task) {
    return null
  }

  const activeTask = task

  async function submitStatus(toStatus: TaskStatus) {
    await onTransition({
      taskId: activeTask.id,
      toStatus,
      note: statusNote.trim() || undefined,
    })
    setStatusNote("")
  }

  async function submitLog() {
    if (!logMessage.trim()) {
      return
    }
    await onAppendLog({
      taskId: activeTask.id,
      message: logMessage.trim(),
    })
    setLogMessage("")
  }

  async function submitTaskMessage(input: { content: string; linked_document_ids?: string[] }) {
    await onCreateTaskMessage({
      taskId: activeTask.id,
      content: input.content,
      linked_document_ids: input.linked_document_ids,
    })
  }

  async function submitDocumentLinks() {
    const deduped = [...new Set(documentsToLink)]
    const nextDocumentIds = deduped.filter((documentId) => !activeTask.linked_document_ids.includes(documentId))
    if (nextDocumentIds.length === 0) {
      return
    }
    await onLinkDocuments({
      taskId: activeTask.id,
      documentIds: nextDocumentIds,
    })
    setDocumentsToLink([])
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full border-l bg-background p-4 shadow-xl sm:w-[480px]">
      <Card className="h-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">{task.task_name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TriggerStateBadge triggerState={task.trigger_state} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto pb-6">
          <div className="text-xs text-muted-foreground">
            <p>Assignee: {task.assignee}</p>
            <p>Operator: {operator}</p>
            <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <ScrollText className="size-3.5" />
              Description
            </p>
            <div className="rounded-md border p-3">
              <MarkdownViewer content={task.description} />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Dependencies</p>
            <Input readOnly value={dependencyLabel} />
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <FileText className="size-3.5" />
              Output Summary
            </p>
            <div className="rounded-md border p-3">
              <MarkdownViewer content={task.output_data.summary || "No output yet"} />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Output Link</p>
            <Input readOnly value={task.output_data.link || "No link provided"} />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Link2 className="size-3.5" />
                Linked Documents
              </p>
              <DocumentComposerDialog
                operator={operator}
                disabled={busy}
                defaultAssignee={task.assignee}
                defaultAgentId={task.assignee}
                defaultTaskId={task.id}
                triggerLabel="Create linked document"
                onCreateDocument={onCreateDocument}
              />
            </div>
            <div className="space-y-2 rounded-md border p-2">
              <p className="text-[11px] text-muted-foreground">
                Attach existing reference documents to this task.
              </p>
              <DocumentMultiSelect
                documents={availableDocuments}
                value={documentsToLink}
                onChange={setDocumentsToLink}
                disabled={busy}
                placeholder="Search documents to link"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || documentsToLink.length === 0}
                onClick={submitDocumentLinks}
              >
                <ListTodo className="size-3.5" />
                Link selected
              </Button>
            </div>
            {task.linked_document_ids.length === 0 ? (
              <p className="text-xs text-muted-foreground">No documents linked yet.</p>
            ) : (
              <div className="space-y-2">
                {task.linked_document_ids.map((documentId) => {
                  const linkedDocument = linkedDocumentsById.get(documentId)
                  return (
                    <Card key={documentId}>
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div>
                          <p className="text-xs font-medium">{linkedDocument?.title ?? documentId}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {linkedDocument
                              ? `${linkedDocument.assignee} • ${new Date(linkedDocument.updated_at).toLocaleString()}`
                              : "Document details are outside current list filters."}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => onOpenDocument(documentId)}>
                          <FileText className="size-3.5" />
                          Open
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium">Review actions</p>
            <Textarea
              placeholder="Optional note added to audit trail."
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || task.status !== "review"}
                onClick={() => submitStatus("done")}
                size="sm"
              >
                Approve (done)
              </Button>
              <Button
                disabled={busy || task.status !== "review"}
                onClick={() => submitStatus("in_progress")}
                variant="outline"
                size="sm"
              >
                Request changes
              </Button>
              <Button
                disabled={busy || task.status === "done"}
                onClick={() => submitStatus("blocked")}
                variant="outline"
                size="sm"
              >
                Mark blocked
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium">Manual operator note</p>
            <Textarea
              placeholder="Add a manual audit note"
              value={logMessage}
              onChange={(event) => setLogMessage(event.target.value)}
              rows={2}
            />
            <Button disabled={busy || !logMessage.trim()} variant="secondary" size="sm" onClick={submitLog}>
              Append note
            </Button>
          </div>

          <Separator />

          <TaskMessageThread
            messages={taskMessages}
            loading={taskMessagesLoading}
            busy={busy}
            mentionCandidates={mentionCandidates}
            onCreateMessage={submitTaskMessage}
          />

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium">Agent log trail</p>
            <div className="space-y-2">
              {task.agent_logs.map((log, index) => (
                <Card key={`${log.timestamp}-${index}`}>
                  <CardContent className="space-y-1 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()} • {log.agent}
                    </p>
                    <p className="text-xs">{log.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
