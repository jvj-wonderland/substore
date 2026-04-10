import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiArrowLeftLine, RiPlayLine, RiSaveLine } from "@remixicon/react"
import { useState } from "react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SinkEditorPanel } from "@/components/sinks/sink-editor-panel"
import { SinkPreviewPanel } from "@/components/sinks/sink-preview-panel"

export const Route = createFileRoute("/sinks/new")({
  component: AddSinkPage,
})

function AddSinkPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  
  const [name, setName] = useState("")
  const [format, setFormat] = useState<API.SinkFormat>("json")
  const [script, setScript] = useState("*sources*")
  const [evalResult, setEvalResult] = useState<typeof API.EvalResponse.Type | null>(null)

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

  const addMutation = useMutation({
    mutationFn: (payload: typeof API.AddSinkPayload.Type) =>
      Effect.runPromise(
        API.addSink(payload).pipe(Effect.provide(API.clientLayer))
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
    if (!/^[a-z0-9-]+$/.test(name)) {
      alert("Name must be a valid slug (lowercase, numbers, and hyphens only)")
      return
    }
    addMutation.mutate({
      name,
      sink_format: format,
      pipeline_script: script,
    })
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="border-b bg-background/95 backdrop-blur px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon-sm" render={<Link to="/sinks" />}>
            <RiArrowLeftLine className="h-4 sm:h-5 w-4 sm:w-5" />
          </Button>
          <div>
            <h2 className="text-sm sm:text-xl font-bold tracking-tight">New Sink</h2>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Creation Mode</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRun} disabled={evalMutation.isPending}>
            <RiPlayLine className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
            <span className="text-[10px] sm:text-xs">Run</span>
          </Button>
          <Button size="sm" onClick={(e) => handleSave(e as any)} disabled={addMutation.isPending}>
            <RiSaveLine className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4" />
            <span className="text-[10px] sm:text-xs">Save</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation={isDesktop ? "horizontal" : "vertical"} className="h-full">
          <ResizablePanel defaultSize={50} minSize={20}>
            <SinkEditorPanel
              name={name}
              setName={setName}
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
