import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { AnimatedRoute } from "@/components/page-transition"
import {
  SourceEditorPage,
  type SourceEditorInitialValues,
} from "@/components/sources/source-editor-page"
import { formatError } from "@/lib/effect-utils"
import { match } from "ts-pattern"
import { pageTitle } from "@/lib/page-title"
import { toast } from "sonner"

export const Route = createFileRoute("/sources/$sourceId/edit")({
  head: ({ params }) => ({
    meta: [{ title: pageTitle(`Edit Source ${params.sourceId}`) }],
  }),
  component: EditSourcePage,
})

function EditSourcePage() {
  const { sourceId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const sourceQuery = useQuery({
    queryKey: ["sources", sourceId],
    queryFn: () =>
      Effect.runPromise(
        API.getSource(sourceId).pipe(Effect.provide(API.clientLayer))
      ),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: typeof API.AddSourcePayload.Type) =>
      Effect.runPromise(
        API.updateSource(sourceId, payload).pipe(
          Effect.provide(API.clientLayer)
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      queryClient.invalidateQueries({ queryKey: ["sources", sourceId] })
      navigate({ to: "/sources" })
    },
    onError: (error) => {
      toast.error("Failed to update source", {
        description: formatError(error),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      Effect.runPromise(
        API.deleteSource(sourceId).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      navigate({ to: "/sources" })
    },
  })

  return (
    <AnimatedRoute className="overflow-hidden">
      {match(sourceQuery)
        .with({ status: "pending" }, () => (
          <div className="p-8">Loading...</div>
        ))
        .with({ status: "error" }, () => (
          <div className="p-8">Error loading source</div>
        ))
        .with({ status: "success" }, ({ data: source }) => {
          if (!source) return <div className="p-8">Source not found</div>

          const initialValues: SourceEditorInitialValues = {
            type: source.type,
            name: source.name,
            tags: source.tags,
            content: source.content,
            url: source.url ?? "",
            fetchMode: source.fetch_mode ?? "server",
            updateInterval: source.update_interval ?? 3600,
          }

          return (
            <SourceEditorPage
              title="Edit Source"
              subtitle={`Editing: ${source.name}`}
              submitLabel="Save"
              submitPendingLabel="Saving..."
              initialValues={initialValues}
              isSubmitting={updateMutation.isPending}
              onSubmit={(payload) => updateMutation.mutate(payload)}
              onDelete={() => deleteMutation.mutate()}
            />
          )
        })
        .exhaustive()}
    </AnimatedRoute>
  )
}
