import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiAddLine, RiRefreshLine, RiEditLine, RiExternalLinkLine } from "@remixicon/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatError } from "@/lib/effect-utils"

export const Route = createFileRoute("/sinks/")({
  component: SinksIndexPage,
})

function SinksIndexPage() {
  const {
    data: sinks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sinks"],
    queryFn: () =>
      Effect.runPromise(API.getSinks.pipe(Effect.provide(API.clientLayer))),
  })

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading sinks...</div>
  if (error)
    return (
      <div className="text-destructive p-8 bg-destructive/5 rounded-lg border border-destructive/20 m-8">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Error loading sinks
        </h2>
        <pre className="mt-2 whitespace-pre-wrap text-xs bg-zinc-950 p-4 rounded overflow-auto border border-zinc-800">
          {formatError(error)}
        </pre>
      </div>
    )

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sinks</h2>
          <p className="text-muted-foreground text-sm">
            Fennel scripts that unify sources into a final configuration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RiRefreshLine className="h-4 w-4" />
          </Button>
          <Button render={<Link to="/sinks/new" />}>
            <RiAddLine className="mr-2 h-4 w-4" />
            New Sink
          </Button>
        </div>
      </div>

      {sinks?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground gap-4">
          <p className="text-sm">No sinks created yet.</p>
          <Button variant="secondary" size="sm" render={<Link to="/sinks/new" />}>
            <RiAddLine className="mr-2 h-4 w-4" />
            Create your first sink
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sinks?.map((sink) => (
            <SinkCard key={sink.name} sink={sink} />
          ))}
        </div>
      )}
    </div>
  )
}

function SinkCard({
  sink,
}: {
  sink: API.Sink
}) {
  const executionUrl = `http://localhost:8001/${sink.name}`

  return (
    <Card className="flex flex-col group/sink">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            {sink.name}
          </CardTitle>
          <CardDescription className="text-[10px] font-bold tracking-widest uppercase text-primary">
            {sink.sink_format}
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
          Sink
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-muted-foreground line-clamp-3 text-xs font-mono bg-muted/30 p-2 rounded border border-muted/50">
          {sink.pipeline_script.slice(0, 200)}
          {sink.pipeline_script.length > 200 && "..."}
        </p>
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t pt-4">
        <a 
          href={executionUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <RiExternalLinkLine className="h-3 w-3" />
          Execution API
        </a>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/sinks/$sinkId/edit"
              params={{ sinkId: sink.name }}
            />
          }
        >
          <RiEditLine className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
}
