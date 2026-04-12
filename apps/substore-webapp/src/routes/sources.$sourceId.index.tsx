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
    <div className="flex h-full flex-col">
      <div className="bg-background/95 sticky top-0 z-10 flex items-center justify-between border-b px-8 py-4 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link to="/sources" />}>
            <RiArrowLeftLine className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight">{source.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {source.type}
              </Badge>
              <div className="text-muted-foreground text-[10px] uppercase">
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

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 space-y-8 overflow-y-auto border-r p-8">
          <section className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
              Information
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label className="text-muted-foreground text-xs">Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {source.tags.length > 0 ? (
                    source.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground/50 text-xs italic">
                      No tags
                    </span>
                  )}
                </div>
              </div>

              {source.type === "remote" && (
                <>
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-xs">URL</Label>
                    <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                      {source.url}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-xs">
                      Fetch Mode
                    </Label>
                    <div className="text-sm capitalize">
                      {source.fetch_mode}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-xs">
                      Update Interval
                    </Label>
                    <div className="text-sm">
                      {source.update_interval} seconds
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-1">
                <Label className="text-muted-foreground text-xs">
                  Last Updated
                </Label>
                <div className="text-sm">
                  {source.last_updated
                    ? new Date(source.last_updated * 1000).toLocaleString()
                    : "Never"}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex w-2/3 flex-col overflow-hidden">
          <div className="grid flex-1 grid-rows-2 overflow-hidden">
            <div className="flex flex-col overflow-hidden border-b">
              <div className="bg-muted/50 flex items-center justify-between border-b px-4 py-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Original Content (YAML/JSON)
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <CodeBlock code={source.content} lang="yaml" />
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="bg-muted/50 flex items-center justify-between border-b px-4 py-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Transformed Fennel Object
                </span>
                {isFennelLoading && (
                  <span className="animate-pulse text-[10px]">
                    Transforming...
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4">
                {fennelData?.fennel ? (
                  <CodeBlock code={fennelData.fennel} lang="fennel" />
                ) : (
                  <div className="text-muted-foreground/30 flex h-full items-center justify-center text-xs italic">
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
