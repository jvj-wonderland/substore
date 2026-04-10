import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiArrowLeftLine, RiPlayLine, RiSaveLine, RiTerminalLine, RiCodeLine, RiFileTextLine, RiErrorWarningLine, RiRefreshLine } from "@remixicon/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"
import { CodeBlock } from "@/components/code-block"
import CodeMirror from "@uiw/react-codemirror"
import { language_support } from "@nextjournal/clojure-mode"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"
import { useTheme } from "@/components/theme-provider"
import { formatError } from "@/lib/effect-utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const Route = createFileRoute("/sinks/$sinkId/edit")({
  component: EditSinkPage,
})

function EditSinkPage() {
  const { sinkId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  
  const [format, setFormat] = useState<API.SinkFormat>("json")
  const [script, setScript] = useState("")
  const [evalResult, setEvalResult] = useState<typeof API.EvalResponse.Type | null>(null)

  const { data: sink, isLoading, error } = useQuery({
    queryKey: ["sinks", sinkId],
    queryFn: () => Effect.runPromise(
      API.getSinks.pipe(
        Effect.map(sinks => sinks.find(s => s.name === sinkId)),
        Effect.provide(API.clientLayer)
      )
    )
  })

  useEffect(() => {
    if (sink) {
      setFormat(sink.sink_format)
      setScript(sink.pipeline_script)
    }
  }, [sink])

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const evalMutation = useMutation({
    mutationFn: (payload: typeof API.EvalRequest.Type) =>
      Effect.runPromise(
        API.evalScript(payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: (data) => setEvalResult(data),
    onError: (error: any) => {
      setEvalResult({
        result: null,
        result_string: "",
        compiled_script: "",
        stdout: "",
        stderr: "",
        error: error.message || "Execution failed",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: typeof API.AddSinkPayload.Type) =>
      Effect.runPromise(
        API.updateSink(sinkId, payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sinks"] })
      navigate({ to: "/sinks" })
    },
  })

  const handleRun = () => {
    evalMutation.mutate({ script, sink_format: format })
  }

  const handleSave = (e: React.SubmitEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      name: sinkId,
      sink_format: format,
      pipeline_script: script,
    })
  }

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground font-medium uppercase tracking-widest">Loading Sink Data...</div>
  if (error || !sink) return (
    <div className="p-8 text-destructive bg-destructive/5 m-8 border border-destructive/20 rounded-lg">
      <h2 className="text-lg font-bold">Error Loading Sink</h2>
      <pre className="text-xs mt-2">{error ? formatError(error) : "Sink not found"}</pre>
      <Button variant="outline" className="mt-4" render={<Link to="/sinks" />}>Back to Sinks</Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-background/95 backdrop-blur px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link to="/sinks" />}>
            <RiArrowLeftLine className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Edit Sink</h2>
            <p className="text-[10px] text-primary uppercase tracking-widest font-bold">Editing: {sinkId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRun} disabled={evalMutation.isPending}>
            {evalMutation.isPending ? <RiRefreshLine className="mr-2 h-4 w-4 animate-spin" /> : <RiPlayLine className="mr-2 h-4 w-4" />}
            Run
          </Button>
          <Button onClick={(e) => handleSave(e as any)} disabled={updateMutation.isPending}>
            <RiSaveLine className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Editor Pane */}
        <div className="w-1/2 border-r flex flex-col min-h-0 bg-zinc-950/5">
          <div className="p-6 space-y-4 border-b bg-background/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2 opacity-60">
                <Label htmlFor="name">Sink Name (slug)</Label>
                <Input
                  id="name"
                  value={sinkId}
                  disabled
                  className="font-mono text-xs cursor-not-allowed bg-muted"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="format">Output Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => v && setFormat(v as API.SinkFormat)}
                >
                  <SelectTrigger id="format" className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="yaml">YAML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="bg-muted/30 px-4 py-1 border-b flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline Script (Fennel)</span>
            </div>
            <div className="flex-1 overflow-auto">
              <CodeMirror
                value={script}
                height="100%"
                theme={isDark ? githubDark : githubLight}
                extensions={[language_support]}
                onChange={(val) => setScript(val)}
                className="text-xs h-full"
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

        {/* Preview Pane */}
        <div className="w-1/2 overflow-y-auto p-6 space-y-4 bg-muted/10 scrollbar-themed text-foreground">
          {!evalResult && !evalMutation.isPending && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-4 opacity-60">
              <RiPlayLine className="h-12 w-12" />
              <p className="text-sm font-medium italic">Click "Run" to preview the execution result</p>
            </div>
          )}

          {evalMutation.isPending && (
            <div className="h-full flex flex-col items-center justify-center text-primary/40 gap-4 animate-pulse">
              <RiTerminalLine className="h-12 w-12" />
              <p className="text-sm font-bold tracking-widest uppercase">Executing Pipeline...</p>
            </div>
          )}

          {evalResult && (
            <div className="space-y-4">
              {evalResult.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider">
                    <RiErrorWarningLine className="h-4 w-4" />
                    Execution Error
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-zinc-950 p-3 rounded border border-white/5 text-destructive-foreground">
                    {evalResult.error}
                  </pre>
                </div>
              )}

              <Accordion multiple defaultValue={["result", "console"]}>
                <AccordionItem value="result">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <RiFileTextLine className="h-4 w-4 text-blue-500" />
                      <span>RESULT ({format.toUpperCase()})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-zinc-950 rounded-md p-4 overflow-auto max-h-[500px]">
                      {evalResult.result_string ? (
                        <CodeBlock code={evalResult.result_string} lang={format} />
                      ) : (
                        <div className="text-muted-foreground/50 italic">No result generated</div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="lua">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <RiCodeLine className="h-4 w-4 text-purple-500" />
                      <span>COMPILED LUA</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-zinc-950 rounded-md p-4 overflow-auto max-h-[500px]">
                      {evalResult.compiled_script ? (
                        <CodeBlock code={evalResult.compiled_script} lang="lua" />
                      ) : (
                        <div className="text-muted-foreground/50 italic">No lua code generated</div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {(evalResult.stdout || evalResult.stderr) && (
                  <AccordionItem value="console">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <RiTerminalLine className="h-4 w-4 text-amber-500" />
                        <span>CONSOLE OUTPUT</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-zinc-950 rounded-md p-4 space-y-4 font-mono text-xs">
                        {evalResult.stdout && (
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground/50">STDOUT</div>
                            <pre className="text-emerald-500 whitespace-pre-wrap">{evalResult.stdout}</pre>
                          </div>
                        )}
                        {evalResult.stderr && (
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground/50">STDERR</div>
                            <pre className="text-rose-500 whitespace-pre-wrap">{evalResult.stderr}</pre>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
