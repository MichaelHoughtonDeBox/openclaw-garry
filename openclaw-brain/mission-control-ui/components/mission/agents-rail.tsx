"use client"

import { BadgeCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { assigneeInitials, formatRelativeTime, getAssigneeProfile } from "@/lib/mission/presentation"
import type { AgentHealth, Assignee } from "@/lib/mission/types"

type AgentsRailProps = {
  health: AgentHealth[]
  focusedAssignee?: Assignee
  onFocusAssignee: (assignee?: Assignee) => void
}

export function AgentsRail({ health, focusedAssignee, onFocusAssignee }: AgentsRailProps) {
  const activeCount = health.filter((agent) => !agent.stale).length

  return (
    <Card className="h-full min-h-[560px] border-border/60 bg-card/90">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Agents</CardTitle>
          <Badge variant="secondary" className="rounded-lg text-[10px]">
            {activeCount}/{health.length} live
          </Badge>
        </div>
        <Button
          type="button"
          variant={focusedAssignee ? "outline" : "default"}
          size="sm"
          className="h-8 justify-between rounded-lg text-xs"
          onClick={() => onFocusAssignee(undefined)}
        >
          <span className="flex items-center gap-1">
            <Sparkles className="size-3.5" />
            All agents
          </span>
          <span>{health.length}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {health.map((agent) => {
          const profile = getAssigneeProfile(agent.assignee)
          const selected = focusedAssignee === agent.assignee
          return (
            <button
              key={agent.assignee}
              type="button"
              className={`w-full rounded-xl border p-2 text-left transition ${
                selected
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-background/50 hover:border-primary/30"
              }`}
              onClick={() => onFocusAssignee(agent.assignee)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full border border-border/60 bg-muted/30 text-[11px] font-semibold">
                    {assigneeInitials(agent.assignee)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{profile.displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{profile.role}</p>
                  </div>
                </div>
                <Badge variant={agent.stale ? "destructive" : "secondary"} className="rounded-md text-[10px]">
                  {agent.stale ? "stale" : "active"}
                </Badge>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                <p>todo {agent.taskCounts.todo}</p>
                <p>progress {agent.taskCounts.in_progress}</p>
                <p>review {agent.taskCounts.review}</p>
                <p>blocked {agent.taskCounts.blocked}</p>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate">
                  {agent.lastActivityAt ? formatRelativeTime(agent.lastActivityAt) : "no heartbeat yet"}
                </span>
                {agent.lastActivityStatus === "ok" ? <BadgeCheck className="size-3.5 text-emerald-500" /> : null}
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
