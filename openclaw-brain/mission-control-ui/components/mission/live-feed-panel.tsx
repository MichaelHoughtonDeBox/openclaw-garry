"use client"

import { ActivityFeed } from "@/components/mission/activity-feed"
import { NotificationsPanel } from "@/components/mission/notifications-panel"
import type { FeedScope } from "@/lib/mission/presentation"
import type { Activity, Assignee, Notification } from "@/lib/mission/types"

type NotificationStatusFilter = "all" | "pending" | "delivered" | "failed"

type LiveFeedPanelProps = {
  activities: Activity[]
  notifications: Notification[]
  feedScope: FeedScope
  feedAssignee?: Assignee
  notificationStatusFilter: NotificationStatusFilter
  notificationAssigneeFilter?: Assignee
  loadingNotifications?: boolean
  busy?: boolean
  onFeedScopeChange: (scope: FeedScope) => void
  onFeedAssigneeChange: (assignee?: Assignee) => void
  onNotificationStatusFilterChange: (status: NotificationStatusFilter) => void
  onNotificationAssigneeFilterChange: (assignee?: Assignee) => void
  onAcknowledgeNotification: (input: {
    notificationId: string
    status: "delivered" | "failed"
    error?: string
  }) => Promise<void>
  onOpenTask: (taskId: string) => void
}

export function LiveFeedPanel({
  activities,
  notifications,
  feedScope,
  feedAssignee,
  notificationStatusFilter,
  notificationAssigneeFilter,
  loadingNotifications,
  busy,
  onFeedScopeChange,
  onFeedAssigneeChange,
  onNotificationStatusFilterChange,
  onNotificationAssigneeFilterChange,
  onAcknowledgeNotification,
  onOpenTask,
}: LiveFeedPanelProps) {
  return (
    <section className="space-y-3">
      <NotificationsPanel
        notifications={notifications}
        loading={loadingNotifications}
        busy={busy}
        statusFilter={notificationStatusFilter}
        assigneeFilter={notificationAssigneeFilter}
        onStatusFilterChange={onNotificationStatusFilterChange}
        onAssigneeFilterChange={onNotificationAssigneeFilterChange}
        onAcknowledge={onAcknowledgeNotification}
        onOpenTask={onOpenTask}
      />
      <ActivityFeed
        activities={activities}
        scope={feedScope}
        assignee={feedAssignee}
        maxItems={24}
        onScopeChange={onFeedScopeChange}
        onAssigneeChange={onFeedAssigneeChange}
        onOpenTask={onOpenTask}
      />
    </section>
  )
}
