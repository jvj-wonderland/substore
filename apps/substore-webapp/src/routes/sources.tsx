import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiAddLine, RiRefreshLine, RiUploadCloud2Line } from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useState, useCallback, useEffect } from "react"
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
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
})

function SourcesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<API.Source | null>(null)

  const {
    data: sources,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sources"],
    queryFn: () =>
      Effect.runPromise(API.getSources.pipe(Effect.provide(API.clientLayer))),
  })

  const handleEdit = (source: API.Source) => {
    setEditingSource(source)
    setOpen(true)
  }

  const handleAdd = () => {
    setEditingSource(null)
    setOpen(true)
  }

  if (isLoading) return <div className="p-8">Loading sources...</div>
  if (error)
    return (
      <div className="text-destructive p-8">
        <h2 className="text-lg font-bold">Error loading sources</h2>
        <pre className="mt-2 whitespace-pre-wrap text-sm">
          {formatError(error)}
        </pre>
      </div>
    )

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
          <Button onClick={handleAdd}>
            <RiAddLine className="mr-2 h-4 w-4" />
            Add Source
          </Button>
          <SourceDialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) setEditingSource(null)
            }}
            editingSource={editingSource}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["sources"] })
              setOpen(false)
              setEditingSource(null)
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources?.map((source) => (
          <SourceCard key={source.id} source={source} onEdit={handleEdit} />
        ))}
      </div>
    </div>
  )
}

function SourceCard({
  source,
  onEdit,
}: {
  source: API.Source
  onEdit: (s: API.Source) => void
}) {
  const fetchModeLabel =
    source.fetch_mode === "browser" ? "Browser" : "Server"

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
      <CardFooter className="flex justify-end gap-2 pt-0">
        <Button variant="outline" size="sm" onClick={() => onEdit(source)}>
          Edit
        </Button>
      </CardFooter>
    </Card>
  )
}

function SourceDialog({
  open,
  onOpenChange,
  editingSource,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editingSource: API.Source | null
  onSuccess: () => void
}) {
  const [type, setType] = useState<"local" | "remote">("local")
  const [fetchMode, setFetchMode] = useState<string>("server")
  const [content, setContent] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  // Sync state when dialog opens
  useEffect(() => {
    if (open) {
      setType(editingSource?.type ?? "local")
      setFetchMode(editingSource?.fetch_mode ?? "server")
      setContent(editingSource?.content ?? "")
    } else {
      // Clear state when closed
      setContent("")
      setIsDragging(false)
    }
  }, [open, editingSource])

  const addMutation = useMutation({
    mutationFn: (payload: any) =>
      Effect.runPromise(
        API.addSource(payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      Effect.runPromise(
        API.updateSource(id, payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess,
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
      payload.content = content
    } else {
      payload.url = formData.get("url") as string
      payload.fetch_mode = fetchMode
      payload.update_interval = parseInt(
        formData.get("update_interval") as string
      )
    }

    if (editingSource) {
      updateMutation.mutate({
        id: editingSource.id,
        payload: { type, payload },
      })
    } else {
      addMutation.mutate({ type, payload })
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setContent(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>
              {editingSource ? "Edit Source" : "Add Source"}
            </DialogTitle>
            <DialogDescription>
              {editingSource
                ? "Update your subscription source."
                : "Create a new local or remote subscription source."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as "local" | "remote")}
                name="type"
              >
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
                <div
                  className={cn(
                    "relative group rounded-md border-2 border-dashed transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                >
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste content or drag & drop file here..."
                    className="min-h-[200px] border-0 focus-visible:ring-0 resize-none bg-transparent"
                    required
                  />
                  {content === "" && !isDragging && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-muted-foreground/50">
                      <RiUploadCloud2Line className="h-8 w-8 mb-2" />
                      <p className="text-xs">Drag & drop a file to upload</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    value={fetchMode}
                    onValueChange={(v) => v && setFetchMode(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="browser">Browser</SelectItem>
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
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-0">
            <Button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {addMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : "Save Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
