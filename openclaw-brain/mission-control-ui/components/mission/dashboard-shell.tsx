"use client"

import type { ReactNode } from "react"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentsRail } from "@/components/mission/agents-rail"
import { DocumentComposerDialog } from "@/components/mission/document-composer-dialog"
import { DocumentDetailSheet } from "@/components/mission/document-detail-sheet"
import { LiveFeedPanel } from "@/components/mission/live-feed-panel"
import { NavTabs } from "@/components/mission/nav-tabs"
import { TaskComposerDialog } from "@/components/mission/task-composer-dialog"
import { TaskDetailSheet } from "@/components/mission/task-detail-sheet"
import { TopCommandBar } from "@/components/mission/top-command-bar"
import { useDashboard } from "@/lib/mission/dashboard-context"

type DashboardShellProps = {
  children: ReactNode
}

/**
 * Persistent shell layout for Mission Control: TopCommandBar, nav tabs, AgentsRail,
 * LiveFeedPanel, and global dialogs. The center slot renders page content (tasks or documents).
 *
 * @param props.children - Page-specific content (TasksView or DocumentsView)
 * @returns Shell layout with children in the center column
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const {
    operator,
    activeAgentCount,
    queueSize,
    pendingNotificationCount,
    refreshing,
    streamConnected,
    lastReloadDurationMs,
    snapshot,
    documents,
    notifications,
    busy,
    error,
    loading,
    focusedAssignee,
    feedScope,
    feedAssignee,
    notificationStatusFilter,
    notificationAssigneeFilter,
    notificationsLoading,
    selectedTask,
    selectedDocument,
    taskMessagesByTaskId,
    taskMessagesLoading,
    activeMentionAssignees,
    selectedTaskLinkedDocuments,
    reload,
    setOperator,
    setSelectedTaskId,
    setSelectedDocument,
    handleFocusAssignee,
    handleCreateTask,
    handleCreateDocument,
    handleReleaseDependencies,
    handleTransitionStatus,
    handleAppendLog,
    handleCreateTaskMessage,
    handleLinkDocuments,
    handleOpenDocumentById,
    handleDeleteTask,
    handleUpdateDocument,
    handleAcknowledgeNotification,
    setFeedScope,
    setFeedAssignee,
    setNotificationStatusFilter,
    setNotificationAssigneeFilter,
  } = useDashboard()

  return (
    <main className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-[1800px] space-y-3">
        <TopCommandBar
          operator={operator}
          onOperatorChange={setOperator}
          activeAgents={activeAgentCount}
          totalAgents={(snapshot?.health ?? []).length}
          queuedTasks={queueSize}
          pendingNotifications={pendingNotificationCount}
          refreshing={refreshing}
          streamConnected={streamConnected}
          lastReloadDurationMs={lastReloadDurationMs}
          onRefresh={() => void reload()}
          actions={
            <>
              <TaskComposerDialog
                operator={operator}
                availableDocuments={documents}
                disabled={busy}
                onCreateTask={handleCreateTask}
              />
              <DocumentComposerDialog
                operator={operator}
                disabled={busy}
                defaultAssignee={focusedAssignee ?? "corey"}
                defaultAgentId={focusedAssignee ?? "corey"}
                onCreateDocument={handleCreateDocument}
              />
              <Button
                disabled={busy || refreshing}
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleReleaseDependencies}
              >
                <Link2 className="size-3.5" />
                Release deps
              </Button>
            </>
          }
        />

        <NavTabs />

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-xs text-muted-foreground">
            Loading dashboard...
          </p>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
          <AgentsRail
            health={snapshot?.health ?? []}
            focusedAssignee={focusedAssignee}
            onFocusAssignee={handleFocusAssignee}
          />

          <section className="min-w-0">{children}</section>

          <LiveFeedPanel
            activities={snapshot?.activities ?? []}
            notifications={notifications}
            feedScope={feedScope}
            feedAssignee={feedAssignee}
            notificationStatusFilter={notificationStatusFilter}
            notificationAssigneeFilter={notificationAssigneeFilter}
            loadingNotifications={notificationsLoading}
            busy={busy}
            onFeedScopeChange={setFeedScope}
            onFeedAssigneeChange={setFeedAssignee}
            onNotificationStatusFilterChange={setNotificationStatusFilter}
            onNotificationAssigneeFilterChange={setNotificationAssigneeFilter}
            onAcknowledgeNotification={handleAcknowledgeNotification}
            onOpenTask={(taskId) => setSelectedTaskId(taskId)}
          />
        </div>
      </div>

      <TaskDetailSheet
        key={selectedTask?.id ?? "no-task-selected"}
        task={selectedTask}
        operator={operator}
        busy={busy}
        taskMessages={selectedTask ? taskMessagesByTaskId[selectedTask.id] ?? [] : []}
        taskMessagesLoading={taskMessagesLoading}
        mentionCandidates={activeMentionAssignees}
        linkedDocuments={selectedTaskLinkedDocuments}
        availableDocuments={documents}
        onClose={() => setSelectedTaskId(null)}
        onTransition={handleTransitionStatus}
        onAppendLog={handleAppendLog}
        onCreateTaskMessage={handleCreateTaskMessage}
        onLinkDocuments={handleLinkDocuments}
        onOpenDocument={handleOpenDocumentById}
        onCreateDocument={handleCreateDocument}
        onDeleteTask={handleDeleteTask}
      />
      <DocumentDetailSheet
        key={selectedDocument?.id ?? "no-document-selected"}
        document={selectedDocument}
        operator={operator}
        busy={busy}
        onClose={() => setSelectedDocument(null)}
        onUpdateDocument={handleUpdateDocument}
      />
    </main>
  )
}
