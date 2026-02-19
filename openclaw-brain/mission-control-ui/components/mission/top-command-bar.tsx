"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ActivitySquare, BellRing, Cpu, LogOut, RefreshCcw, Workflow } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type TopCommandBarProps = {
  operator: string
  onOperatorChange: (value: string) => void
  activeAgents: number
  totalAgents: number
  queuedTasks: number
  pendingNotifications: number
  refreshing: boolean
  streamConnected: boolean
  lastReloadDurationMs?: number
  onRefresh: () => void
  actions?: ReactNode
}

type MetricChipProps = {
  label: string
  value: number
  icon: ReactNode
}

function MetricChip({ label, value, icon }: MetricChipProps) {
  return (
    <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-card/80 px-2.5 whitespace-nowrap">
      {icon}
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function TopCommandBar({
  operator,
  onOperatorChange,
  activeAgents,
  totalAgents,
  queuedTasks,
  pendingNotifications,
  refreshing,
  streamConnected,
  lastReloadDurationMs,
  onRefresh,
  actions,
}: TopCommandBarProps) {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<{ username: string } | null>(null)

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { user?: { id: string; username: string }; error?: string }) => {
        if (data.user) {
          setAuthUser({ username: data.user.username })
        }
      })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="rounded-2xl border border-border/60 bg-card/90 p-3 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="flex shrink-0 items-center gap-2">
          <Workflow className="size-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Mission Control</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 xl:mx-auto">
          <MetricChip
            label="Agents Active"
            value={activeAgents}
            icon={<Cpu className="size-3.5 text-emerald-500" />}
          />
          <MetricChip
            label="In Queue"
            value={queuedTasks}
            icon={<ActivitySquare className="size-3.5 text-amber-500" />}
          />
          <MetricChip
            label="Pending Mentions"
            value={pendingNotifications}
            icon={<BellRing className="size-3.5 text-sky-500" />}
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 xl:ml-auto">
          {authUser ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">{authUser.username}</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={handleLogout}>
                <LogOut className="size-3.5" />
                Logout
              </Button>
            </div>
          ) : null}
          <ThemeToggle />
          <Input
            value={operator}
            onChange={(event) => onOperatorChange(event.target.value)}
            className="h-8 w-36 shrink-0 rounded-lg text-xs"
            placeholder="operator"
          />
          {actions}
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 whitespace-nowrap"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCcw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Badge variant={streamConnected ? "secondary" : "destructive"} className="h-8 shrink-0 rounded-lg px-2 text-[10px]">
            {streamConnected ? "stream connected" : "stream reconnecting"}
          </Badge>
          <Badge variant="outline" className="h-8 shrink-0 rounded-lg px-2 text-[10px]">
            {lastReloadDurationMs ? `${lastReloadDurationMs}ms` : "--"}
          </Badge>
          <Badge variant="outline" className="h-8 shrink-0 rounded-lg px-2 text-[10px]">
            {activeAgents}/{totalAgents} live
          </Badge>
        </div>
      </div>
    </header>
  )
}
