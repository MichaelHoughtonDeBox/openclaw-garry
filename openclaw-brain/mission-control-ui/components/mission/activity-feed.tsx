"use client"

import { useMemo } from "react"
import { MessageSquareMore, Milestone, ScrollText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ASSIGNEES, FEED_SCOPES } from "@/lib/mission/constants"
import { activityMatchesScope, formatRelativeTime, type FeedScope, getAssigneeProfile } from "@/lib/mission/presentation"
import type { Activity, Assignee } from "@/lib/mission/types"

type ActivityFeedProps = {
  activities: Activity[]
  scope: FeedScope
  assignee?: Assignee
  maxItems?: number
  onScopeChange: (scope: FeedScope) => void
  onAssigneeChange: (assignee?: Assignee) => void
  onOpenTask?: (taskId: string) => void
}

function variantForStatus(status: Activity["status"]): "secondary" | "destructive" | "outline" {
  if (status === "error") {
    return "destructive"
  }
  if (status === "ok") {
    return "secondary"
  }
  return "outline"
}

export function ActivityFeed({
  activities,
  scope,
  assignee,
  maxItems,
  onScopeChange,
  onAssigneeChange,
  onOpenTask,
}: ActivityFeedProps) {
  const filteredByAssignee = useMemo(() => {
    if (!assignee) {
      return activities
    }
    return activities.filter((activity) => activity.assignee === assignee)
  }, [activities, assignee])

  const scopeCounts = useMemo(() => {
    return FEED_SCOPES.reduce<Record<FeedScope, number>>(
      (accumulator, currentScope) => {
        accumulator[currentScope] = filteredByAssignee.filter((activity) => activityMatchesScope(activity, currentScope)).length
        return accumulator
      },
      {
        all: 0,
        tasks: 0,
        comments: 0,
        decisions: 0,
      },
    )
  }, [filteredByAssignee])

  const visibleActivities = useMemo(
    () =>
      filteredByAssignee
        .filter((activity) => activityMatchesScope(activity, scope))
        .slice(0, maxItems ?? filteredByAssignee.length),
    [filteredByAssignee, maxItems, scope],
  )

  const scopeIcon = scope === "comments" ? <MessageSquareMore className="size-3.5" /> : scope === "decisions" ? <Milestone className="size-3.5" /> : <ScrollText className="size-3.5" />

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {scopeIcon}
            Live feed
          </CardTitle>
          <Select
            value={assignee ?? "__all_assignees"}
            onValueChange={(value) => onAssigneeChange(value === "__all_assignees" ? undefined : (value as Assignee))}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_assignees">All agents</SelectItem>
              {ASSIGNEES.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {getAssigneeProfile(candidate).displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1">
          {FEED_SCOPES.map((candidateScope) => (
            <Button
              key={candidateScope}
              type="button"
              size="sm"
              variant={scope === candidateScope ? "default" : "outline"}
              className="h-7 px-2 text-[11px]"
              onClick={() => onScopeChange(candidateScope)}
            >
              {candidateScope}
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {scopeCounts[candidateScope]}
              </Badge>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity events yet.</p>
        ) : (
          visibleActivities.map((activity) => (
            <div key={activity.id} className="rounded-md border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">{activity.eventType}</p>
                <Badge variant={variantForStatus(activity.status)}>{activity.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{activity.message}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(activity.created_at)} • {new Date(activity.created_at).toLocaleTimeString()}
                  {activity.assignee ? ` • ${activity.assignee}` : ""}
                  {activity.source ? ` • ${activity.source}` : ""}
                </p>
                {activity.taskId && onOpenTask ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => onOpenTask(activity.taskId!)}
                  >
                    Open task
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
