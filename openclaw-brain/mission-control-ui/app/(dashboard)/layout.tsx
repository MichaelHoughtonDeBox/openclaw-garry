import type { ReactNode } from "react"
import { DashboardLayoutDynamic } from "@/components/mission/dashboard-layout-dynamic"

type DashboardLayoutProps = {
  children: ReactNode
}

/**
 * Mission Control dashboard layout: Provider + Shell wrap all dashboard pages.
 * Uses dynamic import for client-only rendering (SSE, DOM).
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardLayoutDynamic>{children}</DashboardLayoutDynamic>
}
