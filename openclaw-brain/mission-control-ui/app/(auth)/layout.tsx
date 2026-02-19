import type { ReactNode } from "react"

type AuthLayoutProps = {
  children: ReactNode
}

/**
 * Minimal layout for auth pages (login, etc.) – no dashboard shell.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {children}
    </div>
  )
}
