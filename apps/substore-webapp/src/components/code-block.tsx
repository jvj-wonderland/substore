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
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme
  )

  useEffect(() => {
    if (theme !== "system") {
      setResolvedTheme(theme)
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateResolvedTheme = () => {
      setResolvedTheme(mediaQuery.matches ? "dark" : "light")
    }

    updateResolvedTheme()
    mediaQuery.addEventListener("change", updateResolvedTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateResolvedTheme)
    }
  }, [theme])

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getHighlighter().then((highlighter) => {
      if (!isMounted) return

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
  }, [code, lang, resolvedTheme])

  if (loading) {
    return (
      <div className="bg-muted/50 flex h-full w-full animate-pulse items-center justify-center rounded-md">
        <span className="text-muted-foreground text-xs">Highlighting...</span>
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
