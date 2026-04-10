import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiArrowLeftLine, RiEditLine } from "@remixicon/react"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/code-block"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/sources/$sourceId/")({
  component: ViewSourcePage,
})

function ViewSourcePage() {
  const { sourceId } = Route.useParams()

  const { data: source, isLoading: isSourceLoading } = useQuery({
    queryKey: ["sources", sourceId],
    queryFn: () =>
      Effect.runPromise(
        API.getSource(sourceId).pipe(Effect.provide(API.clientLayer))
      ),
  })

  const { data: fennelData, isLoading: isFennelLoading } = useQuery({
    queryKey: ["sources", sourceId, "fennel"],
    queryFn: () =>
      Effect.runPromise(
        API.transformToFennel({ content: source?.content ?? "" }).pipe(
          Effect.provide(API.clientLayer)
        )
      ),
    enabled: !!source?.content,
  })

  if (isSourceLoading) return <div className="p-8">Loading...</div>
  if (!source) return <div className="p-8">Source not found</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link to="/sources" />}>
            <RiArrowLeftLine className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight">{source.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] uppercase">
                {source.type}
              </Badge>
              <div className="text-[10px] text-muted-foreground uppercase">
                ID: {source.id}
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/sources/$sourceId/edit"
              params={{ sourceId: source.id }}
            />
          }
        >
          <RiEditLine className="mr-2 h-4 w-4" />
          Edit Source
        </Button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="w-1/3 border-r overflow-y-auto p-8 space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Information</h3>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {source.tags.length > 0 ? (
                    source.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs italic text-muted-foreground/50">No tags</span>
                  )}
                </div>
              </div>

              {source.type === "remote" && (
                <>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">URL</Label>
                    <div className="text-xs font-mono break-all bg-muted p-2 rounded">
                      {source.url}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Fetch Mode</Label>
                    <div className="text-sm capitalize">{source.fetch_mode}</div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Update Interval</Label>
                    <div className="text-sm">{source.update_interval} seconds</div>
                  </div>
                </>
              )}

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Last Updated</Label>
                <div className="text-sm">
                  {source.last_updated
                    ? new Date(source.last_updated * 1000).toLocaleString()
                    : "Never"}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="w-2/3 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden grid grid-rows-2">
            <div className="flex flex-col overflow-hidden border-b">
              <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Original Content (YAML/JSON)</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <CodeBlock code={source.content} lang="yaml" />
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transformed Fennel Object</span>
                {isFennelLoading && <span className="text-[10px] animate-pulse">Transforming...</span>}
              </div>
              <div className="flex-1 overflow-auto p-4">
                {fennelData?.fennel ? (
                  <CodeBlock code={fennelData.fennel} lang="fennel" />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xs italic">
                    Unable to transform content
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
