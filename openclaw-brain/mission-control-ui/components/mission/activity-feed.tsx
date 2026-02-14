"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Activity } from "@/lib/mission/types"

type ActivityFeedProps = {
  activities: Activity[]
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

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity events yet.</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="rounded-md border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">{activity.eventType}</p>
                <Badge variant={variantForStatus(activity.status)}>{activity.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{activity.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(activity.created_at).toLocaleString()}
                {activity.assignee ? ` • ${activity.assignee}` : ""}
                {activity.source ? ` • ${activity.source}` : ""}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
