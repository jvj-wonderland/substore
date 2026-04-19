import { useEffect, useState, useReducer, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Effect } from "effect"
import * as API from "@/api/client"
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
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { match } from "ts-pattern"
import { SourceEditorHeader } from "./source-editor-header"
import { LocalSourceFields } from "./source-editor-local-fields"
import { RemoteSourceFields } from "./source-editor-remote-fields"
import { SourcePreviewPanel } from "./source-preview-panel"

export interface SourceEditorInitialValues {
  type: "local" | "remote"
  name: string
  tags: readonly string[]
  content: string
  url: string
  fetchMode: API.FetchMode
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
  onDelete?: () => void
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
  onDelete,
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
              fetch_mode: state.fetchMode as API.FetchMode,
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
      <SourceEditorHeader
        title={title}
        subtitle={subtitle}
        submitLabel={submitLabel}
        submitPendingLabel={submitPendingLabel}
        isSubmitting={isSubmitting}
        onDelete={onDelete}
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
            <SourcePreviewPanel
              type={state.type}
              fennelPreview={fennelPreviewToDisplay}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </form>
  )
}
