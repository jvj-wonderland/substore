import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
import { Button } from "@/components/ui/button"
import { RiArrowLeftLine, RiUploadCloud2Line } from "@remixicon/react"
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
import { useState, useEffect } from "react"
import { CodeBlock } from "@/components/code-block"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/sources/$sourceId/edit")({
  component: EditSourcePage,
})

function EditSourcePage() {
  const { sourceId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: source, isLoading: isSourceLoading } = useQuery({
    queryKey: ["sources", sourceId],
    queryFn: () =>
      Effect.runPromise(
        API.getSource(sourceId).pipe(Effect.provide(API.clientLayer))
      ),
  })

  const [type, setType] = useState<"local" | "remote">("local")
  const [fetchMode, setFetchMode] = useState<string>("server")
  const [content, setContent] = useState("")
  const [fennelPreview, setFennelPreview] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (source) {
      setType(source.type)
      setFetchMode(source.fetch_mode ?? "server")
      setContent(source.content)
    }
  }, [source])

  const transformMutation = useMutation({
    mutationFn: (c: string) =>
      Effect.runPromise(
        API.transformToFennel({ content: c }).pipe(
          Effect.provide(API.clientLayer)
        )
      ),
    onSuccess: (data) => setFennelPreview(data.fennel),
    onError: () => setFennelPreview(""),
  })

  useEffect(() => {
    if (type === "local" && content) {
      const timer = setTimeout(() => {
        transformMutation.mutate(content)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setFennelPreview("")
    }
  }, [content, type])

  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      Effect.runPromise(
        API.updateSource(sourceId, payload).pipe(Effect.provide(API.clientLayer))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      queryClient.invalidateQueries({ queryKey: ["sources", sourceId] })
      navigate({ to: "/sources" })
    },
  })

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
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

    updateMutation.mutate({ type, payload })
  }

  const handleFileDrop = (e: React.DragEvent) => {
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
  }

  if (isSourceLoading) return <div className="p-8">Loading...</div>
  if (!source) return <div className="p-8">Source not found</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link to="/sources" />}>
            <RiArrowLeftLine className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold tracking-tight">Edit Source: {source.name}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex h-full">
          <div className="w-1/2 border-r overflow-y-auto p-8 space-y-6">
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
                defaultValue={source.name}
                placeholder="My Source"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={source.tags.join(", ")}
                placeholder="tag1, tag2"
              />
            </div>

            {type === "local" ? (
              <div className="grid gap-2">
                <Label htmlFor="content">Content (JSON or YAML)</Label>
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
                    className="min-h-[400px] border-0 focus-visible:ring-0 resize-none bg-transparent font-mono text-xs"
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
                    defaultValue={source.url}
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
                    defaultValue={source.update_interval || 3600}
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? "Updating..." : "Update Source"}
            </Button>
          </div>

          <div className="w-1/2 bg-muted/30 overflow-y-auto p-8">
            <div className="flex flex-col h-full gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fennel Object Preview</Label>
                <div className="flex-1 bg-zinc-950 rounded-lg overflow-auto border p-4">
                  {fennelPreview ? (
                    <CodeBlock code={fennelPreview} lang="fennel" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xs italic">
                      {type === "local" ? "Enter valid JSON/YAML to see preview" : "Preview only available for local sources"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
