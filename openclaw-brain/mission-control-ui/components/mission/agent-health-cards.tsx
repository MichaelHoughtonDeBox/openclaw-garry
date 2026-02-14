"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AgentHealth } from "@/lib/mission/types"

type AgentHealthCardsProps = {
  health: AgentHealth[]
}

function formatCountdown(secondsUntil: number) {
  if (secondsUntil <= 0) {
    return "due now"
  }
  const hours = Math.floor(secondsUntil / 3600)
  const minutes = Math.floor((secondsUntil % 3600) / 60)
  const seconds = secondsUntil % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function AgentHealthCards({ health }: AgentHealthCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {health.map((agent) => {
        // Backward-compatible fallback for pre-artifactSignals API payloads.
        const artifactSignals = agent.artifactSignals ?? {
          unlinkedDocuments: 0,
          reviewOrDoneWithoutDocuments: 0,
        }

        return (
        <Card key={agent.assignee}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm capitalize">{agent.assignee}</CardTitle>
              <Badge variant={agent.stale ? "destructive" : "secondary"}>
                {agent.stale ? "stale" : "active"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <p>todo: {agent.taskCounts.todo}</p>
              <p>in progress: {agent.taskCounts.in_progress}</p>
              <p>review: {agent.taskCounts.review}</p>
              <p>blocked: {agent.taskCounts.blocked}</p>
            </div>
            <div className="space-y-1 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
              <p>unlinked docs: {artifactSignals.unlinkedDocuments}</p>
              <p>review/done missing docs: {artifactSignals.reviewOrDoneWithoutDocuments}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              last event: {agent.lastActivityAt ? new Date(agent.lastActivityAt).toLocaleString() : "none"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              next cron:{" "}
              {agent.nextCronAt && typeof agent.nextCronInSeconds === "number"
                ? `${formatCountdown(agent.nextCronInSeconds)} (${new Date(agent.nextCronAt).toLocaleTimeString()})`
                : "unknown"}
            </p>
            <p className="text-[11px]">{agent.lastActivityMessage ?? "No activity yet."}</p>
          </CardContent>
        </Card>
        )
      })}
    </section>
  )
}
