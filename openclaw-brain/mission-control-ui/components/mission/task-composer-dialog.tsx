"use client"

import { useMemo, useState } from "react"
import { FileStack, Flag, GitBranch, ListChecks, UserRound } from "lucide-react"
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
import { DocumentMultiSelect } from "@/components/mission/document-multi-select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Assignee, MissionDocument, TaskPriority } from "@/lib/mission/types"

type TaskComposerDialogProps = {
  operator: string
  availableDocuments: MissionDocument[]
  disabled?: boolean
  onCreateTask: (input: {
    task_name: string
    description: string
    assignee: Assignee
    priority: TaskPriority
    dependencies: string[]
    linked_document_ids: string[]
    operator: string
  }) => Promise<void>
}

export function TaskComposerDialog({ operator, availableDocuments, disabled, onCreateTask }: TaskComposerDialogProps) {
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState("")
  const [description, setDescription] = useState("")
  const [assignee, setAssignee] = useState<Assignee>("corey")
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [dependenciesRaw, setDependenciesRaw] = useState("")
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const dependencies = useMemo(
    () =>
      dependenciesRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [dependenciesRaw],
  )

  async function submit() {
    if (taskName.trim().length < 3 || description.trim().length < 5) {
      return
    }

    setSubmitting(true)
    try {
      await onCreateTask({
        task_name: taskName.trim(),
        description: description.trim(),
        assignee,
        priority,
        dependencies,
        linked_document_ids: linkedDocumentIds,
        operator,
      })
      setTaskName("")
      setDescription("")
      setDependenciesRaw("")
      setLinkedDocumentIds([])
      setPriority("normal")
      setAssignee("corey")
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm">
          <ListChecks />
          Create Task
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Create Mission Task</AlertDialogTitle>
          <AlertDialogDescription>
            Add a task directly to Mission Control. Workers will pick it up via cron when eligible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <ListChecks className="size-3.5" />
              Task name
            </p>
            <Input
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              placeholder="Write SEO draft for alternatives page"
            />
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <FileStack className="size-3.5" />
              Description
            </p>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Execution brief, acceptance criteria, and output expectations."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <UserRound className="size-3.5" />
                Assignee
              </p>
              <Select value={assignee} onValueChange={(value) => setAssignee(value as Assignee)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="garry">garry</SelectItem>
                  <SelectItem value="corey">corey</SelectItem>
                  <SelectItem value="tony">tony</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Flag className="size-3.5" />
                Priority
              </p>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">urgent</SelectItem>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <GitBranch className="size-3.5" />
              Dependencies (optional)
            </p>
            <Input
              value={dependenciesRaw}
              onChange={(event) => setDependenciesRaw(event.target.value)}
              placeholder="comma-separated task ObjectIds"
            />
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium">
              <FileStack className="size-3.5" />
              Reference documents (optional)
            </p>
            <DocumentMultiSelect
              documents={availableDocuments}
              value={linkedDocumentIds}
              onChange={setLinkedDocumentIds}
              disabled={submitting}
              placeholder="Search document titles"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <Button disabled={submitting} onClick={submit}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
