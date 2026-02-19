"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/", label: "Tasks", icon: ListTodo },
  { href: "/documents", label: "Documents", icon: FileText },
] as const

/**
 * Tab-style navigation for switching between Tasks and Documents views.
 * Highlights the active tab based on the current pathname.
 *
 * @returns Nav strip with Links for Tasks and Documents
 */
export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="flex gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5"
      aria-label="Mission Control sections"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        // Match /documents/[id] as Documents section
        const isDocumentsRoute = href === "/documents"
        const isActive =
          href === "/"
            ? pathname === "/"
            : isDocumentsRoute
              ? pathname === "/documents" || pathname.startsWith("/documents/")
              : pathname === href

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
