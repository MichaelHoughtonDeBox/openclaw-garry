"use client"

import type { ReactNode } from "react"
import { DashboardProvider } from "@/lib/mission/dashboard-context"
import { DashboardShell } from "@/components/mission/dashboard-shell"

type DashboardLayoutClientProps = {
  children: ReactNode
}

/**
 * Client-only wrapper for Mission Control: Provider + Shell.
 * Used by the (dashboard) layout to avoid SSR (SSE, streams require client).
 */
export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
