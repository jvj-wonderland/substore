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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
})

function SourcesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"local" | "remote">("local")

  const { data: sources, isLoading, isError, refetch } = useQuery({
    queryKey: ["sources"],
    queryFn: () => Effect.runPromise(API.getSources.pipe(Effect.provide(API.clientLayer))),
  })

  const addSourceMutation = useMutation({
    mutationFn: (payload: any) => 
      Effect.runPromise(API.addSource(payload).pipe(Effect.provide(API.clientLayer))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] })
      setOpen(false)
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const tags = (formData.get("tags") as string).split(",").map(t => t.trim()).filter(t => t !== "")
    
    let payload: any = { name, tags }
    if (type === "local") {
      payload.content = formData.get("content") as string
    } else {
      payload.url = formData.get("url") as string
      payload.fetch_mode = parseInt(formData.get("fetch_mode") as string)
      payload.update_interval = parseInt(formData.get("update_interval") as string)
    }

    addSourceMutation.mutate({
      type,
      payload: payload
    })
  }

  if (isLoading) return <div className="p-8">Loading sources...</div>
  if (isError) return <div className="p-8 text-destructive">Error loading sources.</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sources</h2>
          <p className="text-muted-foreground text-sm">Manage your subscription sources.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RiRefreshLine className="w-4 h-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button>
                  <RiAddLine className="w-4 h-4 mr-2" />
                  Add Source
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Source</DialogTitle>
                  <DialogDescription>
                    Create a new local or remote subscription source.
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
                    <Input id="name" name="name" placeholder="My Source" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input id="tags" name="tags" placeholder="tag1, tag2" />
                  </div>
                  {type === "local" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="content">Content</Label>
                      <Textarea id="content" name="content" placeholder="Source content..." required />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="url">URL</Label>
                        <Input id="url" name="url" placeholder="https://example.com/sub" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fetch_mode">Fetch Mode</Label>
                        <Select name="fetch_mode" defaultValue="0">
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
                        <Label htmlFor="update_interval">Update Interval (seconds)</Label>
                        <Input id="update_interval" name="update_interval" type="number" defaultValue="3600" required />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addSourceMutation.isPending}>
                    {addSourceMutation.isPending ? "Adding..." : "Save Source"}
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
                <CardTitle className="text-base font-semibold">{source.name}</CardTitle>
                <CardDescription className="text-xs uppercase tracking-wider font-medium">
                  {source.type}
                </CardDescription>
              </div>
              <Badge variant={source.type === "remote" ? "default" : "secondary"}>
                {source.type}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground break-all line-clamp-2">
                {source.type === "remote" ? source.url : "Local Content"}
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {source.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
