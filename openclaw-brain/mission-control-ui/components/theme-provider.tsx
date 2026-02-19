"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Wraps the app with next-themes provider for light/dark/system theme support.
 * Uses class strategy to toggle .dark on the html element (shadcn compatible).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
