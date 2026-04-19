import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { AnimatedRoute } from "@/components/page-transition"
import { useState } from "react"
import { formatError } from "@/lib/effect-utils"
import { SinkEditorPage } from "@/components/sinks/sink-editor-page"
import { match } from "ts-pattern"
import { toast } from "sonner"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/sinks/$sinkId/edit")({
  head: ({ params }) => ({
    meta: [{ title: pageTitle(`Edit Sink ${params.sinkId}`) }],
  }),
  component: EditSinkPage,
})

function EditSinkPage() {
  const { sinkId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [format, setFormat] = useState<API.SinkFormat>("json")
  const [secret, setSecret] = useState("")
  const [script, setScript] = useState("")
  const [evalResult, setEvalResult] = useState<
    typeof API.EvalResponse.Type | null
  >(null)

  const sinkQuery = useQuery({
    queryKey: ["sinks", sinkId],
    queryFn: () =>
      Effect.runPromise(
        API.getSinks.pipe(
          Effect.map((sinks) => sinks.find((s) => s.id === sinkId)),
          Effect.provide(API.clientLayer)
        )
      ),
  })

  // Adjust state when sink data is loaded or changes
  const [prevSink, setPrevSink] = useState<typeof API.Sink.Type | null>(null)
  if (sinkQuery.data && sinkQuery.data !== prevSink) {
    setPrevSink(sinkQuery.data)
    setName(sinkQuery.data.name)
    setFormat(sinkQuery.data.sink_format)
    setSecret(sinkQuery.data.secret)
    setScript(sinkQuery.data.pipeline_script)
  }

  const evalMutation = useMutation({
    mutationFn: (payload: typeof API.EvalRequest.Type) =>
      Effect.runPromise(
        API.evalFennel(payload).pipe(Effect.provide(API.clientLayer))
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

  const deleteMutation = useMutation({
    mutationFn: () =>
      Effect.runPromise(
        API.deleteSink(sinkId).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sinks"] })
      navigate({ to: "/sinks" })
    },
  })

  const regenerateSecretMutation = useMutation({
    mutationFn: () =>
      Effect.runPromise(
        API.regenerateSinkSecret(sinkId).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: (sink) => {
      setSecret(sink.secret)
      queryClient.invalidateQueries({ queryKey: ["sinks"] })
      queryClient.invalidateQueries({ queryKey: ["sinks", sinkId] })
      toast.success("Secret regenerated")
    },
    onError: (error) => {
      toast.error("Failed to regenerate secret", {
        description: formatError(error),
      })
    },
  })

  const handleRun = () => {
    evalMutation.mutate({ script, sink_format: format })
  }

  const handleSave = (e: React.MouseEvent | React.SubmitEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      name,
      secret: "",
      sink_format: format,
      pipeline_script: script,
    })
  }

  return (
    <AnimatedRoute className="overflow-hidden">
      {match(sinkQuery)
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
            <SinkEditorPage
              title="Edit Sink"
              subtitle={
                <p className="text-primary text-[8px] font-bold tracking-widest uppercase sm:text-[10px]">
                  Editing ID: {sinkId}
                </p>
              }
              name={name}
              setName={setName}
              secret={secret}
              format={format}
              setFormat={setFormat}
              script={script}
              setScript={setScript}
              evalResult={evalResult}
              isEvalPending={evalMutation.isPending}
              isSavePending={updateMutation.isPending}
              onRun={handleRun}
              onSave={handleSave}
              onRegenerateSecret={() => regenerateSecretMutation.mutate()}
              isRegenerateSecretPending={regenerateSecretMutation.isPending}
              onDelete={() => deleteMutation.mutate()}
            />
          )
        })
        .exhaustive()}
    </AnimatedRoute>
  )
}
