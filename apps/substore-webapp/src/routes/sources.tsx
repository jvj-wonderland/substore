import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiAddLine, RiRefreshLine } from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
})

function SourcesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"local" | "remote">("local")
  const [editingSource, setEditingSource] = useState<API.Source | null>(null)

  const {
    data: sources,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sources"],
    queryFn: () =>
      Effect.runPromise(API.getSources.pipe(Effect.provide(API.clientLayer))),
  })

  const addSourceMutation = useMutation({
    mutationFn: (payload: any) =>
      Effect.runPromise(
        API.addSource(payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      setOpen(false)
    },
  })

  const updateSourceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      Effect.runPromise(
        API.updateSource(id, payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      setOpen(false)
      setEditingSource(null)
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const tags = (formData.get("tags") as string)
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "")

    let payload: any = { name, tags }
    if (type === "local") {
      payload.content = formData.get("content") as string
    } else {
      payload.url = formData.get("url") as string
      payload.fetch_mode = parseInt(formData.get("fetch_mode") as string)
      payload.update_interval = parseInt(
        formData.get("update_interval") as string
      )
    }

    if (editingSource) {
      updateSourceMutation.mutate({
        id: editingSource.id,
        payload: { type, payload },
      })
    } else {
      addSourceMutation.mutate({ type, payload })
    }
  }

  const handleEdit = (source: API.Source) => {
    setEditingSource(source)
    setType(source.type)
    setOpen(true)
  }

  if (isLoading) return <div className="p-8">Loading sources...</div>
  if (isError)
    return <div className="text-destructive p-8">Error loading sources.</div>

  return (
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
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) setEditingSource(null)
            }}
          >
            <DialogTrigger
              render={
                <Button
                  onClick={() => {
                    setEditingSource(null)
                    setType("local")
                  }}
                >
                  <RiAddLine className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingSource ? "Edit Source" : "Add Source"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSource
                      ? "Update your subscription source."
                      : "Create a new local or remote subscription source."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editingSource?.name}
                      placeholder="My Source"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      name="tags"
                      defaultValue={editingSource?.tags.join(", ")}
                      placeholder="tag1, tag2"
                    />
                  </div>
                  {type === "local" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        name="content"
                        defaultValue={editingSource?.content}
                        placeholder="Source content..."
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                          id="url"
                          name="url"
                          defaultValue={editingSource?.url}
                          placeholder="https://example.com/sub"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fetch_mode">Fetch Mode</Label>
                        <Select
                          name="fetch_mode"
                          defaultValue={
                            editingSource?.fetch_mode?.toString() || "0"
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Server</SelectItem>
                            <SelectItem value="1">Browser</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="update_interval">
                          Update Interval (seconds)
                        </Label>
                        <Input
                          id="update_interval"
                          name="update_interval"
                          type="number"
                          defaultValue={editingSource?.update_interval || 3600}
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      addSourceMutation.isPending ||
                      updateSourceMutation.isPending
                    }
                  >
                    {addSourceMutation.isPending ||
                    updateSourceMutation.isPending
                      ? "Saving..."
                      : "Save Source"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources?.map((source) => (
          <Card key={source.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {source.name}
                </CardTitle>
                <CardDescription className="text-xs font-medium tracking-wider uppercase">
                  {source.type}
                </CardDescription>
              </div>
              <Badge
                variant={source.type === "remote" ? "default" : "secondary"}
              >
                {source.type}
              </Badge>
            </CardHeader>
            <CardContent>
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
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(source)}
              >
                Edit
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
