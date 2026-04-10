import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiArrowLeftLine, RiPlayLine, RiSaveLine, RiRefreshLine } from "@remixicon/react"
import { useState, useEffect } from "react"
import { formatError } from "@/lib/effect-utils"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SinkEditorPanel } from "@/components/sinks/sink-editor-panel"
import { SinkPreviewPanel } from "@/components/sinks/sink-preview-panel"

export const Route = createFileRoute("/sinks/$sinkId/edit")({
  component: EditSinkPage,
})

function EditSinkPage() {
  const { sinkId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  
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

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground font-medium uppercase tracking-widest text-xs sm:text-sm">Loading Sink Data...</div>
  if (error || !sink) return (
    <div className="p-8 text-destructive bg-destructive/5 m-8 border border-destructive/20 rounded-lg">
      <h2 className="text-lg font-bold">Error Loading Sink</h2>
      <pre className="text-[10px] sm:text-xs mt-2">{error ? formatError(error) : "Sink not found"}</pre>
      <Button variant="outline" className="mt-4" render={<Link to="/sinks" />}>Back to Sinks</Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="border-b bg-background/95 backdrop-blur px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon-sm" render={<Link to="/sinks" />}>
            <RiArrowLeftLine className="h-4 sm:h-5 w-4 sm:w-5" />
          </Button>
          <div>
            <h2 className="text-sm sm:text-xl font-bold tracking-tight">Edit Sink</h2>
            <p className="text-[8px] sm:text-[10px] text-primary uppercase tracking-widest font-bold">Editing: {sinkId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRun} disabled={evalMutation.isPending}>
            {evalMutation.isPending ? <RiRefreshLine className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 animate-spin" /> : <RiPlayLine className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />}
            <span className="text-[10px] sm:text-xs">Run</span>
          </Button>
          <Button size="sm" onClick={(e) => handleSave(e as any)} disabled={updateMutation.isPending}>
            <RiSaveLine className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
            <span className="text-[10px] sm:text-xs">Save</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation={isDesktop ? "horizontal" : "vertical"} className="h-full">
          <ResizablePanel defaultSize={50} minSize={20}>
            <SinkEditorPanel
              name={sinkId}
              nameDisabled
              format={format}
              setFormat={setFormat}
              script={script}
              setScript={setScript}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={20}>
            <SinkPreviewPanel
              evalResult={evalResult}
              isPending={evalMutation.isPending}
              format={format}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
