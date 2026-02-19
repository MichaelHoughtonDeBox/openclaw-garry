"use client"

import { KanbanBoard } from "@/components/mission/kanban-board"
import { ReviewQueuePanel } from "@/components/mission/review-queue-panel"
import { useDashboard } from "@/lib/mission/dashboard-context"

/**
 * Tasks-only view: Kanban board and review queue. Renders inside DashboardShell center column.
 */
export function TasksView() {
  const {
    snapshot,
    busy,
    boardFilter,
    boardSearch,
    focusedAssignee,
    selectedTaskId,
    setBoardFilter,
    setBoardSearch,
    setSelectedTaskId,
    handleDropStatusChange,
  } = useDashboard()

  return (
    <div className="space-y-3">
      <KanbanBoard
        grouped={
          snapshot?.tasks.grouped ?? {
            todo: [],
            in_progress: [],
            blocked: [],
            review: [],
            done: [],
          }
        }
        allTasks={snapshot?.tasks.tasks ?? []}
        boardFilter={boardFilter}
        search={boardSearch}
        assigneeFilter={focusedAssignee}
        busy={busy}
        selectedTaskId={selectedTaskId ?? undefined}
        onBoardFilterChange={setBoardFilter}
        onSearchChange={setBoardSearch}
        onSelectTask={(task) => setSelectedTaskId(task.id)}
        onDropStatusChange={handleDropStatusChange}
      />

      <ReviewQueuePanel
        tasks={(snapshot?.reviewQueue ?? []).filter((task) =>
          focusedAssignee ? task.assignee === focusedAssignee : true,
        )}
        onOpenTask={(task) => setSelectedTaskId(task.id)}
      />
    </div>
  )
}
