"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"

const DashboardContent = dynamic(
  () =>
    import("@/components/mission/dashboard-layout-client").then((mod) => ({
      default: mod.DashboardLayoutClient,
    })),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-background p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">Loading Mission Control...</p>
      </main>
    ),
  },
)

type DashboardLayoutDynamicProps = {
  children: ReactNode
}

/**
 * Client-only wrapper that dynamically loads the dashboard (no SSR).
 * Used by the (dashboard) layout to avoid server-rendering the Mission Control shell.
 */
export function DashboardLayoutDynamic({ children }: DashboardLayoutDynamicProps) {
  return <DashboardContent>{children}</DashboardContent>
}
