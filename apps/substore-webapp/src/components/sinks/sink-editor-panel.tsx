import CodeMirror from "@uiw/react-codemirror"
import { language_support } from "@nextjournal/clojure-mode"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"
import { useTheme } from "@/components/theme-provider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as API from "@/api/client"

import { RiRefreshLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"

interface SinkEditorPanelProps {
  name?: string
  setName?: (name: string) => void
  nameDisabled?: boolean
  secret: string
  setSecret: (secret: string) => void
  format: API.SinkFormat
  setFormat: (format: API.SinkFormat) => void
  script: string
  setScript: (script: string) => void
}

export function SinkEditorPanel({
  name,
  setName,
  nameDisabled,
  secret,
  setSecret,
  format,
  setFormat,
  script,
  setScript,
}: SinkEditorPanelProps) {
  const { theme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const handleRegenerateSecret = () => {
    const newSecret = crypto.randomUUID().replace(/-/g, "")
    setSecret(newSecret)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950/5">
      <div className="bg-background/50 space-y-4 border-b p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label
              htmlFor="name"
              className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
            >
              Sink Name (slug)
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName?.(e.target.value)}
              disabled={nameDisabled}
              placeholder="my-awesome-sink"
              required
              className="bg-background h-8 font-mono text-[10px] shadow-none focus-visible:ring-1 sm:h-9 sm:text-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="format"
              className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
            >
              Output Format
            </Label>
            <Select
              value={format}
              onValueChange={(v) => v && setFormat(v as API.SinkFormat)}
            >
              <SelectTrigger
                id="format"
                className="bg-background h-8 font-mono text-[10px] shadow-none focus-visible:ring-1 sm:h-9 sm:text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json" className="text-[10px] sm:text-xs">
                  JSON
                </SelectItem>
                <SelectItem value="yaml" className="text-[10px] sm:text-xs">
                  YAML
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor="secret"
            className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
          >
            Secret Key (Basic Auth)
          </Label>
          <div className="flex gap-2">
            <Input
              id="secret"
              value={secret}
              readOnly
              placeholder="Click regenerate to create a secret"
              className="bg-background h-8 flex-1 font-mono text-[10px] shadow-none focus-visible:ring-1 sm:h-9 sm:text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:h-9"
              onClick={handleRegenerateSecret}
            >
              <RiRefreshLine className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-xs">Regenerate</span>
            </Button>
          </div>
          <p className="text-muted-foreground text-[8px] sm:text-[10px]">
            This secret is used for HTTP Basic Auth to protect your sink
            execution.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-1">
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            Pipeline Script (Fennel)
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">
            <CodeMirror
              value={script}
              height="100%"
              theme={isDark ? githubDark : githubLight}
              // @ts-expect-error - language_support is unknown but expected as Extension
              extensions={[language_support]}
              onChange={(val) => setScript(val)}
              className="h-full text-[10px] sm:text-xs"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
