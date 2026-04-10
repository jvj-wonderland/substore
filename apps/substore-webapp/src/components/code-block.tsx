import { useEffect, useState } from "react"
import { createHighlighter, type Highlighter } from "shiki"
import { useTheme } from "./theme-provider"

interface CodeBlockProps {
  code: string
  lang: "json" | "yaml" | "fennel" | "lua"
  className?: string
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: ["json", "yaml", "fennel", "lua"],
    })
  }
  return highlighterPromise
}

export function CodeBlock({ code, lang, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getHighlighter().then((highlighter) => {
      if (!isMounted) return

      // Determine the theme to use
      let resolvedTheme = theme
      if (theme === "system") {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
      }

      const highlighted = highlighter.codeToHtml(code, {
        lang,
        theme: resolvedTheme === "dark" ? "github-dark" : "github-light",
      })
      setHtml(highlighted)
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [code, lang, theme])

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
