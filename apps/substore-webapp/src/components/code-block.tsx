import { useEffect, useState } from "react"
import { createHighlighter, type Highlighter } from "shiki"

interface CodeBlockProps {
  code: string
  lang: "json" | "yaml" | "fennel"
  className?: string
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: ["json", "yaml", "clojure"], // Clojure is close enough to Fennel for basic EDN
    })
  }
  return highlighterPromise
}

export function CodeBlock({ code, lang, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getHighlighter().then((highlighter) => {
      if (!isMounted) return

      const highlighted = highlighter.codeToHtml(code, {
        lang: lang === "fennel" ? "clojure" : lang,
        theme: "github-dark",
      })
      setHtml(highlighted)
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [code, lang])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/50 rounded-md animate-pulse">
        <span className="text-xs text-muted-foreground">Highlighting...</span>
      </div>
    )
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontSize: "13px",
        lineHeight: "1.5",
      }}
    />
  )
}
