import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { AnimatedRoute } from "@/components/page-transition"
import {
  RiAddLine,
  RiRefreshLine,
  RiEditLine,
  RiExternalLinkLine,
} from "@remixicon/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatError } from "@/lib/effect-utils"
import { pageTitle } from "@/lib/page-title"
import { match } from "ts-pattern"

export const Route = createFileRoute("/sinks/")({
  head: () => ({
    meta: [{ title: pageTitle("Sinks") }],
  }),
  component: SinksIndexPage,
})

function SinksIndexPage() {
  const query = useQuery({
    queryKey: ["sinks"],
    queryFn: () =>
      Effect.runPromise(API.getSinks.pipe(Effect.provide(API.clientLayer))),
  })

  return (
    <AnimatedRoute>
      {match(query)
        .with({ status: "pending" }, () => <SinksPageSkeleton />)
        .with({ status: "error" }, ({ error }) => (
          <div className="text-destructive bg-destructive/5 border-destructive/20 m-8 rounded-lg border p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              Error loading sinks
            </h2>
            <pre className="mt-2 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-4 text-xs whitespace-pre-wrap">
              {formatError(error)}
            </pre>
          </div>
        ))
        .with({ status: "success" }, ({ data: sinks, refetch }) => (
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

            {sinks.length === 0 ? (
              <div className="bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12">
                <p className="text-sm">No sinks created yet.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  render={<Link to="/sinks/new" />}
                >
                  <RiAddLine className="mr-2 h-4 w-4" />
                  Create your first sink
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sinks.map((sink) => (
                  <SinkCard key={sink.name} sink={sink} />
                ))}
              </div>
            )}
          </div>
        ))
        .exhaustive()}
    </AnimatedRoute>
  )
}

function SinksPageSkeleton() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-96 max-w-[60vw]" />
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SinkCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function SinkCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-14" />
      </CardHeader>
      <CardContent className="flex-1">
        <div className="border-muted/50 bg-muted/30 rounded border p-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-14" />
      </CardFooter>
    </Card>
  )
}

function SinkCard({ sink }: { sink: API.Sink }) {
  const executionApiBase =
    import.meta.env.VITE_EXECUTION_API_URL || `${window.location.hostname}:8001`
  const executionUrl = `http://${encodeURIComponent(sink.name)}:${sink.secret}@${executionApiBase}/`

  return (
    <Card className="group/sink flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{sink.name}</CardTitle>
          <CardDescription className="text-primary text-[10px] font-bold tracking-widest uppercase">
            {sink.sink_format}
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] font-bold tracking-tighter uppercase"
        >
          Sink
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-muted-foreground bg-muted/30 border-muted/50 line-clamp-3 rounded border p-2 font-mono text-xs">
          {sink.pipeline_script.slice(0, 200)}
          {sink.pipeline_script.length > 200 && "..."}
        </p>
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t pt-4">
        <a
          href={executionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary flex items-center gap-1 text-[10px] transition-colors"
        >
          <RiExternalLinkLine className="h-3 w-3" />
          Execution API
        </a>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link to="/sinks/$sinkId/edit" params={{ sinkId: sink.name }} />
          }
        >
          <RiEditLine className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
}
