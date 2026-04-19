import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { AnimatedRoute } from "@/components/page-transition"
import {
  SourceEditorPage,
  type SourceEditorInitialValues,
} from "@/components/sources/source-editor-page"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/sources/new")({
  head: () => ({
    meta: [{ title: pageTitle("New Source") }],
  }),
  component: AddSourcePage,
})

function AddSourcePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: (payload: typeof API.AddSourcePayload.Type) =>
      Effect.runPromise(
        API.addSource(payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      navigate({ to: "/sources" })
    },
  })

  const initialValues: SourceEditorInitialValues = {
    type: "local",
    name: "",
    tags: [],
    content: "",
    url: "",
    fetchMode: "server",
    updateInterval: 3600,
  }

  return (
    <AnimatedRoute className="overflow-hidden">
      <SourceEditorPage
        title="New Source"
        subtitle="Creation Mode"
        submitLabel="Save"
        submitPendingLabel="Saving..."
        initialValues={initialValues}
        isSubmitting={addMutation.isPending}
        onSubmit={(payload) => addMutation.mutate(payload)}
      />
    </AnimatedRoute>
  )
}
