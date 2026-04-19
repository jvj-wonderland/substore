import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import {
  RiArrowLeftLine,
  RiPlayLine,
  RiSaveLine,
  RiRefreshLine,
} from "@remixicon/react"
import { useState } from "react"
import { formatError } from "@/lib/effect-utils"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SinkEditorPanel } from "@/components/sinks/sink-editor-panel"
import { SinkPreviewPanel } from "@/components/sinks/sink-preview-panel"
import { match } from "ts-pattern"

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
  const [evalResult, setEvalResult] = useState<
    typeof API.EvalResponse.Type | null
  >(null)

  const sinkQuery = useQuery({
    queryKey: ["sinks", sinkId],
    queryFn: () =>
      Effect.runPromise(
        API.getSinks.pipe(
          Effect.map((sinks) => sinks.find((s) => s.name === sinkId)),
          Effect.provide(API.clientLayer)
        )
      ),
  })

  // Adjust state when sink data is loaded or changes
  const [prevSink, setPrevSink] = useState<typeof API.Sink.Type | null>(null)
  if (sinkQuery.data && sinkQuery.data !== prevSink) {
    setPrevSink(sinkQuery.data)
    setFormat(sinkQuery.data.sink_format)
    setScript(sinkQuery.data.pipeline_script)
  }

  const evalMutation = useMutation({
    mutationFn: (payload: typeof API.EvalRequest.Type) =>
      Effect.runPromise(
        API.evalScript(payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: (data) => setEvalResult(data),
    onError: (error) => {
      setEvalResult({
        result: null,
        result_string: "",
        compiled_script: "",
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error.message : "Execution failed",
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

  const handleSave = (e: React.MouseEvent | React.SubmitEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      name: sinkId,
      sink_format: format,
      pipeline_script: script,
    })
  }

  return match(sinkQuery)
    .with({ status: "pending" }, () => (
      <div className="text-muted-foreground animate-pulse p-8 text-center text-xs font-medium tracking-widest uppercase sm:text-sm">
        Loading Sink Data...
      </div>
    ))
    .with({ status: "error" }, ({ error }) => (
      <div className="text-destructive bg-destructive/5 border-destructive/20 m-8 rounded-lg border p-8">
        <h2 className="text-lg font-bold">Error Loading Sink</h2>
        <pre className="mt-2 text-[10px] sm:text-xs">
          {error ? formatError(error) : "Sink not found"}
        </pre>
        <Button
          variant="outline"
          className="mt-4"
          render={<Link to="/sinks" />}
        >
          Back to Sinks
        </Button>
      </div>
    ))
    .with({ status: "success" }, ({ data: sink }) => {
      if (!sink)
        return (
          <div className="text-destructive bg-destructive/5 border-destructive/20 m-8 rounded-lg border p-8">
            <h2 className="text-lg font-bold">Sink Not Found</h2>
            <Button
              variant="outline"
              className="mt-4"
              render={<Link to="/sinks" />}
            >
              Back to Sinks
            </Button>
          </div>
        )

      return (
        <div className="bg-background flex h-full flex-col overflow-hidden">
          <div className="bg-background/95 z-10 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="icon-sm"
                render={<Link to="/sinks" />}
              >
                <RiArrowLeftLine className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div>
                <h2 className="text-sm font-bold tracking-tight sm:text-xl">
                  Edit Sink
                </h2>
                <p className="text-primary text-[8px] font-bold tracking-widest uppercase sm:text-[10px]">
                  Editing: {sinkId}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={evalMutation.isPending}
              >
                {evalMutation.isPending ? (
                  <RiRefreshLine className="mr-1 h-3 w-3 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                ) : (
                  <RiPlayLine className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                )}
                <span className="text-[10px] sm:text-xs">Run</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <RiSaveLine className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs">Save</span>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ResizablePanelGroup
              orientation={isDesktop ? "horizontal" : "vertical"}
              className="h-full"
            >
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
    })
    .exhaustive()
}
