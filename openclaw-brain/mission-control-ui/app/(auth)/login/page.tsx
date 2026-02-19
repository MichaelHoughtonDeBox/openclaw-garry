"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { user?: { id: string } }) => {
        if (data.user) {
          router.replace(redirect)
        }
      })
      .catch(() => {})
  }, [router, redirect])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      })
      const data = (await res.json()) as { user?: { id: string; username: string }; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Login failed")
        setLoading(false)
        return
      }
      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Workflow className="size-5 text-primary" />
          Mission Control
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sign in with your operator credentials.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="username" className="text-xs font-medium">
              Username
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="operator"
              required
              disabled={loading}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="h-9"
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-sm"><CardContent className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></CardContent></Card>}>
      <LoginForm />
    </Suspense>
  )
}
