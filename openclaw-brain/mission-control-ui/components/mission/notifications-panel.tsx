"use client"

import { BellRing, CheckCircle2, CircleX, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ASSIGNEES, NOTIFICATION_STATUSES } from "@/lib/mission/constants"
import { formatRelativeTime, getAssigneeProfile } from "@/lib/mission/presentation"
import type { Assignee, Notification } from "@/lib/mission/types"

type NotificationStatusFilter = (typeof NOTIFICATION_STATUSES)[number] | "all"

type NotificationsPanelProps = {
  notifications: Notification[]
  loading?: boolean
  busy?: boolean
  statusFilter: NotificationStatusFilter
  assigneeFilter?: Assignee
  onStatusFilterChange: (status: NotificationStatusFilter) => void
  onAssigneeFilterChange: (assignee?: Assignee) => void
  onAcknowledge: (input: {
    notificationId: string
    status: "delivered" | "failed"
    error?: string
  }) => Promise<void>
  onOpenTask?: (taskId: string) => void
}

function statusVariant(status: Notification["status"]): "secondary" | "destructive" | "outline" {
  if (status === "delivered") {
    return "secondary"
  }
  if (status === "failed") {
    return "destructive"
  }
  return "outline"
}

export function NotificationsPanel({
  notifications,
  loading,
  busy,
  statusFilter,
  assigneeFilter,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onAcknowledge,
  onOpenTask,
}: NotificationsPanelProps) {
  const pendingCount = notifications.filter((notification) => notification.status === "pending").length

  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BellRing className="size-4" />
            Notifications
          </CardTitle>
          <Badge variant={pendingCount > 0 ? "default" : "outline"} className="rounded-md text-[10px]">
            {pendingCount} pending
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as NotificationStatusFilter)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all statuses</SelectItem>
              {NOTIFICATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={assigneeFilter ?? "__all_assignees"}
            onValueChange={(value) =>
              onAssigneeFilterChange(value === "__all_assignees" ? undefined : (value as Assignee))
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_assignees">all assignees</SelectItem>
              {ASSIGNEES.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {getAssigneeProfile(candidate).displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading notifications...
          </p>
        ) : null}

        {!loading && notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notifications for the selected filters.</p>
        ) : null}

        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-lg border border-border/70 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium">{getAssigneeProfile(notification.mentionedAssignee).displayName}</p>
              <Badge variant={statusVariant(notification.status)}>{notification.status}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{notification.content}</p>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {formatRelativeTime(notification.created_at)} • attempts {notification.attempts}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {notification.taskId && onOpenTask ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onOpenTask(notification.taskId)}
                >
                  Open task
                </Button>
              ) : null}
              {notification.status === "pending" ? (
                <>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={busy}
                    onClick={() => onAcknowledge({ notificationId: notification.id, status: "delivered" })}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Mark delivered
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={busy}
                    onClick={() =>
                      onAcknowledge({
                        notificationId: notification.id,
                        status: "failed",
                        error: "Delivery skipped from Mission Control UI",
                      })
                    }
                  >
                    <CircleX className="size-3.5" />
                    Mark failed
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
