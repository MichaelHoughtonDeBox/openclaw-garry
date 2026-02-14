"use client"

import { useMemo, useState } from "react"
import { AtSign, MessagesSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { MarkdownViewer } from "@/components/mission/markdown-viewer"
import type { Assignee, TaskMessage } from "@/lib/mission/types"

type TaskMessageThreadProps = {
  messages: TaskMessage[]
  busy?: boolean
  loading?: boolean
  mentionCandidates: Assignee[]
  onCreateMessage: (input: { content: string; linked_document_ids?: string[] }) => Promise<void>
}

export function TaskMessageThread({
  messages,
  busy,
  loading,
  mentionCandidates,
  onCreateMessage,
}: TaskMessageThreadProps) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)

  const mentionQuery = useMemo(() => {
    const match = draft.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [draft])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) {
      return []
    }
    const allCandidates = [...new Set(["all", ...mentionCandidates])]
    return allCandidates.filter((candidate) => candidate.toLowerCase().startsWith(mentionQuery)).slice(0, 8)
  }, [mentionCandidates, mentionQuery])

  function applyMention(candidate: string) {
    // Replace only the currently typed trailing @token so earlier message text is preserved.
    setDraft((currentDraft) => currentDraft.replace(/(?:^|\s)@[a-zA-Z0-9_-]*$/, (matched) => {
      const leadingSpace = matched.startsWith(" ") ? " " : ""
      return `${leadingSpace}@${candidate} `
    }))
    setSelectedSuggestionIndex(0)
  }

  async function submitMessage() {
    if (!draft.trim()) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreateMessage({ content: draft.trim() })
      setDraft("")
      setSelectedSuggestionIndex(0)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to post message."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-xs font-medium">
        <MessagesSquare className="size-3.5" />
        Task thread
      </p>
      <div className="space-y-2 rounded-md border p-2">
        <Textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setSelectedSuggestionIndex(0)
          }}
          onKeyDown={(event) => {
            if (mentionSuggestions.length === 0) {
              return
            }
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setSelectedSuggestionIndex((current) => (current + 1) % mentionSuggestions.length)
              return
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setSelectedSuggestionIndex((current) =>
                (current - 1 + mentionSuggestions.length) % mentionSuggestions.length,
              )
              return
            }
            if (event.key === "Enter" && !event.shiftKey) {
              // Enter selects mention when menu is open; Shift+Enter keeps multiline behavior.
              event.preventDefault()
              applyMention(mentionSuggestions[selectedSuggestionIndex] ?? mentionSuggestions[0])
            }
          }}
          rows={3}
          placeholder="Add a task comment. Use @corey or @all to notify."
        />
        {mentionSuggestions.length > 0 ? (
          <div className="space-y-1 rounded-md border p-2">
            <p className="text-[11px] text-muted-foreground">Mention suggestions (active agents)</p>
            <div className="flex flex-wrap gap-1">
              {mentionSuggestions.map((candidate, index) => (
                <Button
                  key={candidate}
                  type="button"
                  size="sm"
                  variant={index === selectedSuggestionIndex ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onMouseDown={(event) => {
                    // Keep focus in textarea; mousedown avoids blur-before-click timing issues.
                    event.preventDefault()
                    applyMention(candidate)
                  }}
                >
                  @{candidate}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Mentions trigger queued notifications on the worker heartbeat cycle.
          </p>
          <Button size="sm" disabled={busy || submitting || !draft.trim()} onClick={submitMessage}>
            <Send className="size-3.5" />
            Post
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="space-y-2">
        {loading ? <p className="text-xs text-muted-foreground">Loading thread...</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No task messages yet.</p>
        ) : null}
        {messages.map((message) => (
          <Card key={message.id}>
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {new Date(message.created_at).toLocaleString()} • {message.author}
                </p>
                {message.mentions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {/* Mention badges make delivery targets obvious during thread review. */}
                    {message.mentions.map((mention) => (
                      <Badge key={`${message.id}-${mention}`} variant="outline">
                        <AtSign className="mr-1 size-3" />
                        {mention}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rounded-md border p-2">
                <MarkdownViewer content={message.content} compact />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
