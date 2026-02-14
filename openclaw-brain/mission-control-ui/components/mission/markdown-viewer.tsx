"use client"

import ReactMarkdown from "react-markdown"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

type MarkdownViewerProps = {
  content: string
  className?: string
  compact?: boolean
  emptyMessage?: string
}

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
}

export function MarkdownViewer({
  content,
  className,
  compact = false,
  emptyMessage = "No markdown content yet.",
}: MarkdownViewerProps) {
  const normalizedContent = content.trim()
  if (!normalizedContent) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <article
      className={cn(
        "min-w-0 text-xs leading-relaxed text-foreground",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]",
        "[&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold",
        "[&_hr]:my-3 [&_hr]:border-border",
        "[&_img]:max-w-full [&_img]:rounded-md [&_img]:border",
        "[&_li]:ml-4 [&_li]:list-disc",
        "[&_ol>li]:list-decimal",
        "[&_p]:my-2",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:border",
        "[&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5 [&_th]:text-left",
        compact ? "[&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-1 [&_p]:my-1 [&_pre]:my-1 [&_table]:my-1" : "",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        components={{
          // Force safe external-link behavior on rendered markdown anchors.
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
            />
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </article>
  )
}
