import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { AnimatedRoute } from "@/components/page-transition"
import {
  RiAddLine,
  RiRefreshLine,
  RiEyeLine,
  RiEditLine,
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
import { match } from "ts-pattern"

export const Route = createFileRoute("/sources/")({
  component: SourcesIndexPage,
})

function SourcesIndexPage() {
  const query = useQuery({
    queryKey: ["sources"],
    queryFn: () =>
      Effect.runPromise(API.getSources.pipe(Effect.provide(API.clientLayer))),
  })

  return (
    <AnimatedRoute>
      {match(query)
        .with({ status: "pending" }, () => (
          <SourcesPageSkeleton />
        ))
        .with({ status: "error" }, ({ error }) => (
          <div className="text-destructive p-8">
            <h2 className="text-lg font-bold">Error loading sources</h2>
            <pre className="mt-2 text-sm whitespace-pre-wrap">
              {formatError(error)}
            </pre>
          </div>
        ))
        .with({ status: "success" }, ({ data: sources, refetch }) => (
          <div className="space-y-6 p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Sources</h2>
                <p className="text-muted-foreground text-sm">
                  Manage your subscription sources.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RiRefreshLine className="h-4 w-4" />
                </Button>
                <Button render={<Link to="/sources/new" />}>
                  <RiAddLine className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>
        ))
        .exhaustive()}
    </AnimatedRoute>
  )
}

function SourcesPageSkeleton() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-64 max-w-[60vw]" />
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SourceCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function SourceCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16" />
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-10" />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-14" />
      </CardFooter>
    </Card>
  )
}

function SourceCard({ source }: { source: API.Source }) {
  const fetchModeLabel = source.fetch_mode === "browser" ? "Browser" : "Server"

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            {source.name}
          </CardTitle>
          <CardDescription className="text-xs font-medium tracking-wider uppercase">
            {source.type}
            {source.type === "remote" && ` • ${fetchModeLabel}`}
          </CardDescription>
        </div>
        <Badge variant={source.type === "remote" ? "default" : "secondary"}>
          {source.type}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-muted-foreground line-clamp-2 text-xs break-all">
          {source.type === "remote" ? source.url : "Local Content"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {source.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          render={
            <Link to="/sources/$sourceId" params={{ sourceId: source.id }} />
          }
        >
          <RiEyeLine className="mr-1 h-3 w-3" />
          View
        </Button>
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
          <RiEditLine className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
}
