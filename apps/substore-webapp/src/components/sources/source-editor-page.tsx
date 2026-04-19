import { useEffect, useState, useReducer, useCallback } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { Effect } from "effect"
import {
  RiArrowLeftLine,
  RiRefreshLine,
  RiSaveLine,
  RiUploadCloud2Line,
} from "@remixicon/react"
import * as API from "@/api/client"
import { CodeBlock } from "@/components/code-block"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { match } from "ts-pattern"

export interface SourceEditorInitialValues {
  type: "local" | "remote"
  name: string
  tags: readonly string[]
  content: string
  url: string
  fetchMode: string
  updateInterval: number
}

interface SourceEditorPageProps {
  title: string
  subtitle: string
  submitLabel: string
  submitPendingLabel: string
  initialValues: SourceEditorInitialValues
  isSubmitting: boolean
  onSubmit: (payload: typeof API.AddSourcePayload.Type) => void
}

type EditorState = {
  type: "local" | "remote"
  name: string
  tags: string
  content: string
  url: string
  fetchMode: string
  updateInterval: string
}

type EditorAction =
  | { type: "SET_FIELD"; field: keyof EditorState; value: string }
  | { type: "RESET"; values: SourceEditorInitialValues }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  return match(action)
    .with({ type: "SET_FIELD" }, ({ field, value }) => ({
      ...state,
      [field]: value,
    }))
    .with({ type: "RESET" }, ({ values }) => ({
      type: values.type,
      name: values.name,
      tags: values.tags.join(", "),
      content: values.content,
      url: values.url,
      fetchMode: values.fetchMode,
      updateInterval: String(values.updateInterval),
    }))
    .exhaustive()
}

export function SourceEditorPage({
  title,
  subtitle,
  submitLabel,
  submitPendingLabel,
  initialValues,
  isSubmitting,
  onSubmit,
}: SourceEditorPageProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const [state, dispatch] = useReducer(editorReducer, initialValues, (iv) => ({
    type: iv.type,
    name: iv.name,
    tags: iv.tags.join(", "),
    content: iv.content,
    url: iv.url,
    fetchMode: iv.fetchMode,
    updateInterval: String(iv.updateInterval),
  }))

  const [fennelPreview, setFennelPreview] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const setField = useCallback(
    (field: keyof EditorState, value: string) => {
      dispatch({ type: "SET_FIELD", field, value })
    },
    [dispatch]
  )

  useEffect(() => {
    dispatch({ type: "RESET", values: initialValues })
  }, [initialValues])

  const transformMutation = useMutation({
    mutationFn: (rawContent: string) =>
      Effect.runPromise(
        API.transformToFennel({ content: rawContent }).pipe(
          Effect.provide(API.clientLayer)
        )
      ),
    onSuccess: (data) => setFennelPreview(data.fennel),
    onError: () => setFennelPreview(""),
  })

  const fennelPreviewToDisplay =
    state.type !== "local" || state.content === "" ? "" : fennelPreview

  useEffect(() => {
    if (state.type !== "local" || state.content === "") {
      return
    }

    const timer = setTimeout(() => {
      transformMutation.mutate(state.content)
    }, 500)

    return () => clearTimeout(timer)
  }, [state.content, state.type, transformMutation])

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()

    const normalizedTags = state.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "")

    const payload =
      state.type === "local"
        ? {
            type: state.type,
            payload: {
              name: state.name,
              tags: normalizedTags,
              content: state.content,
            },
          }
        : {
            type: state.type,
            payload: {
              name: state.name,
              tags: normalizedTags,
              url: state.url,
              fetch_mode: state.fetchMode,
              update_interval: Number.parseInt(state.updateInterval, 10),
            },
          }

    onSubmit(payload)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background flex h-full flex-col overflow-hidden"
    >
      <EditorHeader
        title={title}
        subtitle={subtitle}
        submitLabel={submitLabel}
        submitPendingLabel={submitPendingLabel}
        isSubmitting={isSubmitting}
      />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          orientation={isDesktop ? "horizontal" : "vertical"}
          className="h-full"
        >
          <ResizablePanel defaultSize={50} minSize={20}>
            <div
              className={cn(
                "border-border h-full overflow-y-auto p-4 sm:p-6",
                isDesktop ? "border-r" : "border-b"
              )}
            >
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="type"
                      className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
                    >
                      Type
                    </Label>
                    <Select
                      value={state.type}
                      onValueChange={(value) =>
                        value && setField("type", value)
                      }
                    >
                      <SelectTrigger
                        id="type"
                        className="font-mono text-[10px] sm:text-xs"
                      >
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label
                      htmlFor="name"
                      className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
                    >
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={state.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="My Source"
                      required
                      className="font-mono text-[10px] sm:text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label
                    htmlFor="tags"
                    className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
                  >
                    Tags (comma separated)
                  </Label>
                  <Input
                    id="tags"
                    value={state.tags}
                    onChange={(e) => setField("tags", e.target.value)}
                    placeholder="tag1, tag2"
                    className="font-mono text-[10px] sm:text-xs"
                  />
                </div>

                {state.type === "local" ? (
                  <LocalSourceFields
                    content={state.content}
                    setContent={(val) => setField("content", val)}
                    isDragging={isDragging}
                    setIsDragging={setIsDragging}
                  />
                ) : (
                  <RemoteSourceFields
                    url={state.url}
                    setUrl={(val) => setField("url", val)}
                    fetchMode={state.fetchMode}
                    setFetchMode={(val) => setField("fetchMode", val)}
                    updateInterval={state.updateInterval}
                    setUpdateInterval={(val) => setField("updateInterval", val)}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={20}>
            <PreviewPanel
              type={state.type}
              fennelPreview={fennelPreviewToDisplay}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </form>
  )
}

function EditorHeader({
  title,
  subtitle,
  submitLabel,
  submitPendingLabel,
  isSubmitting,
}: {
  title: string
  subtitle: string
  submitLabel: string
  submitPendingLabel: string
  isSubmitting: boolean
}) {
  return (
    <div className="bg-background/95 border-b px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link to="/sources" />}
          >
            <RiArrowLeftLine className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h2 className="text-sm font-bold tracking-tight sm:text-xl">
              {title}
            </h2>
            <p className="text-muted-foreground text-[8px] font-semibold tracking-widest uppercase sm:text-[10px]">
              {subtitle}
            </p>
          </div>
        </div>

        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? (
            <RiRefreshLine className="mr-1 h-3 w-3 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
          ) : (
            <RiSaveLine className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
          )}
          <span className="text-[10px] sm:text-xs">
            {isSubmitting ? submitPendingLabel : submitLabel}
          </span>
        </Button>
      </div>
    </div>
  )
}

function LocalSourceFields({
  content,
  setContent,
  isDragging,
  setIsDragging,
}: {
  content: string
  setContent: (val: string) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
}) {
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setContent(event.target?.result as string)
    }
    reader.readAsText(file)
  }

  return (
    <div className="grid gap-2">
      <Label
        htmlFor="content"
        className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
      >
        Content (JSON or YAML)
      </Label>
      <div
        className={cn(
          "relative rounded-md border-2 border-dashed transition-colors",
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
          className="min-h-[320px] resize-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0 sm:min-h-[400px]"
          required
        />
        {content === "" && !isDragging && (
          <div className="text-muted-foreground/50 pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <RiUploadCloud2Line className="mb-2 h-8 w-8" />
            <p className="text-xs">Drag & drop a file to upload</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RemoteSourceFields({
  url,
  setUrl,
  fetchMode,
  setFetchMode,
  updateInterval,
  setUpdateInterval,
}: {
  url: string
  setUrl: (val: string) => void
  fetchMode: string
  setFetchMode: (val: string) => void
  updateInterval: string
  setUpdateInterval: (val: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label
          htmlFor="url"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          URL
        </Label>
        <Input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/sub"
          required
          className="font-mono text-[10px] sm:text-xs"
        />
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor="fetch-mode"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          Fetch Mode
        </Label>
        <Select
          value={fetchMode}
          onValueChange={(value) => value && setFetchMode(value)}
        >
          <SelectTrigger
            id="fetch-mode"
            className="font-mono text-[10px] sm:text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="server">Server</SelectItem>
            <SelectItem value="browser">Browser</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor="update-interval"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          Update Interval (seconds)
        </Label>
        <Input
          id="update-interval"
          type="number"
          min={1}
          value={updateInterval}
          onChange={(e) => setUpdateInterval(e.target.value)}
          required
          className="font-mono text-[10px] sm:text-xs"
        />
      </div>
    </div>
  )
}

function PreviewPanel({
  type,
  fennelPreview,
}: {
  type: string
  fennelPreview: string
}) {
  return (
    <div className="bg-muted/30 h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex h-full flex-col gap-2">
        <Label className="text-muted-foreground text-xs tracking-wider uppercase">
          Fennel Object Preview
        </Label>
        <div className="bg-muted/20 flex-1 rounded-lg border p-4">
          {fennelPreview ? (
            <CodeBlock code={fennelPreview} lang="fennel" />
          ) : (
            <div className="text-muted-foreground/30 flex h-full items-center justify-center text-center text-xs italic">
              {type === "local"
                ? "Enter valid JSON/YAML to see preview"
                : "Preview only available for local sources"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
