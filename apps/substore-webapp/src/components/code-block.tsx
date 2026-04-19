import { useEffect, useState, useMemo } from "react"
import { createHighlighterCore, type HighlighterGeneric } from "@shikijs/core"
import { createOnigurumaEngine } from "@shikijs/engine-oniguruma"
import bash from "@shikijs/langs/bash"
import fennel from "@shikijs/langs/fennel"
import json from "@shikijs/langs/json"
import lua from "@shikijs/langs/lua"
import yaml from "@shikijs/langs/yaml"
import getWasmInstance from "@shikijs/engine-oniguruma/wasm-inlined"
import githubDark from "@shikijs/themes/github-dark"
import githubLight from "@shikijs/themes/github-light"
import { useTheme } from "./theme-provider"
import { useMediaQuery } from "../hooks/use-media-query"

interface CodeBlockProps {
  code: string
  lang: "json" | "yaml" | "fennel" | "lua" | "bash"
  className?: string
}

function makeShikiBackgroundTransparent(html: string) {
  return html
    .replace(
      /style="([^"]*?)background-color:[^;"]+;?([^"]*?)"/g,
      (_match, before: string, after: string) => {
        const style = `${before}${after}`.trim()
        return style ? `style="${style}"` : ""
      }
    )
    .replace(/<pre([^>]*?)style=""/g, "<pre$1")
    .replace(/<code([^>]*?)style=""/g, "<code$1")
}

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null

function getHighlighter(): Promise<HighlighterGeneric<string, string>> {
  if (highlighterPromise) return highlighterPromise

  highlighterPromise = createHighlighterCore({
    themes: [githubDark, githubLight],
    langs: [json, yaml, fennel, lua, bash],
    engine: createOnigurumaEngine(getWasmInstance),
  }) as Promise<HighlighterGeneric<string, string>>

  return highlighterPromise
}

export function CodeBlock({ code, lang, className }: CodeBlockProps) {
  const { theme } = useTheme()
  const isSystemDark = useMediaQuery("(prefers-color-scheme: dark)")

  const resolvedTheme = useMemo(() => {
    if (theme !== "system") return theme
    return isSystemDark ? "dark" : "light"
  }, [theme, isSystemDark])

  const [rendered, setRendered] = useState<{
    html: string
    params: string
  } | null>(null)

  const currentParams = `${code}-${lang}-${resolvedTheme}`
  const isCurrent = rendered?.params === currentParams

  useEffect(() => {
    let isMounted = true

    getHighlighter().then((highlighter) => {
      if (!isMounted) return

      const highlighted = highlighter.codeToHtml(code, {
        lang,
        theme: resolvedTheme === "dark" ? "github-dark" : "github-light",
      })
      setRendered({
        html: makeShikiBackgroundTransparent(highlighted),
        params: currentParams,
      })
    })

    return () => {
      isMounted = false
    }
  }, [code, lang, resolvedTheme, currentParams])

  if (!isCurrent || !rendered) {
    return (
      <div className="bg-muted/50 flex h-full w-full animate-pulse items-center justify-center rounded-md">
        <span className="text-muted-foreground text-xs">Highlighting...</span>
      </div>
    )
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
      style={{
        fontSize: "13px",
        lineHeight: "1.5",
      }}
    />
  )
}
