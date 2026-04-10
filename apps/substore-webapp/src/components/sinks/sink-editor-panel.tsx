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

interface SinkEditorPanelProps {
  name?: string
  setName?: (name: string) => void
  nameDisabled?: boolean
  format: API.SinkFormat
  setFormat: (format: API.SinkFormat) => void
  script: string
  setScript: (script: string) => void
}

export function SinkEditorPanel({
  name,
  setName,
  nameDisabled,
  format,
  setFormat,
  script,
  setScript,
}: SinkEditorPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="h-full flex flex-col min-h-0 bg-zinc-950/5">
      <div className="p-4 sm:p-6 space-y-4 border-b bg-background/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Sink Name (slug)
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName?.(e.target.value)}
              disabled={nameDisabled}
              placeholder="my-awesome-sink"
              required
              className="font-mono text-[10px] sm:text-xs h-8 sm:h-9 bg-background shadow-none focus-visible:ring-1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="format" className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Output Format
            </Label>
            <Select
              value={format}
              onValueChange={(v) => v && setFormat(v as API.SinkFormat)}
            >
              <SelectTrigger id="format" className="font-mono text-[10px] sm:text-xs h-8 sm:h-9 bg-background shadow-none focus-visible:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json" className="text-[10px] sm:text-xs">JSON</SelectItem>
                <SelectItem value="yaml" className="text-[10px] sm:text-xs">YAML</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="bg-muted/30 px-4 py-1 border-b flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline Script (Fennel)</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div className="absolute inset-0">
            <CodeMirror
              value={script}
              height="100%"
              theme={isDark ? githubDark : githubLight}
              extensions={[language_support]}
              onChange={(val) => setScript(val)}
              className="text-[10px] sm:text-xs h-full"
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
