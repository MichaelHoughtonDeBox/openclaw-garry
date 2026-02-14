"use client"

import dynamic from "next/dynamic"

// Keep Mission Control client-only in environments that instrument DOM before hydration.
const MissionControlDashboard = dynamic(
  () => import("@/components/mission/dashboard").then((module) => module.MissionControlDashboard),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-background p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">Loading Mission Control...</p>
      </main>
    ),
  },
)

export function MissionControlDashboardNoSSR() {
  return <MissionControlDashboard />
}
