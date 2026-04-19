import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { AnimatedRoute } from "@/components/page-transition"
import { useState } from "react"
import { SinkEditorPage } from "@/components/sinks/sink-editor-page"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/sinks/new")({
  head: () => ({
    meta: [{ title: pageTitle("New Sink") }],
  }),
  component: AddSinkPage,
})

function AddSinkPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [format, setFormat] = useState<API.SinkFormat>("json")
  const [script, setScript] = useState("*sources*")
  const [evalResult, setEvalResult] = useState<
    typeof API.EvalResponse.Type | null
  >(null)

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

  const handleSave = (e: React.MouseEvent | React.SubmitEvent) => {
    e.preventDefault()
    if (!/^[a-z0-9-]+$/.test(name)) {
      alert("Name must be a valid slug (lowercase, numbers, and hyphens only)")
      return
    }
    addMutation.mutate({
      name,
      secret: "",
      sink_format: format,
      pipeline_script: script,
    })
  }

  return (
    <AnimatedRoute className="overflow-hidden">
      <SinkEditorPage
        title="New Sink"
        subtitle={
          <p className="text-muted-foreground text-[8px] font-semibold tracking-widest uppercase sm:text-[10px]">
            Creation Mode
          </p>
        }
        name={name}
        setName={setName}
        secret=""
        format={format}
        setFormat={setFormat}
        script={script}
        setScript={setScript}
        evalResult={evalResult}
        isEvalPending={evalMutation.isPending}
        isSavePending={addMutation.isPending}
        onRun={handleRun}
        onSave={handleSave}
      />
    </AnimatedRoute>
  )
}
