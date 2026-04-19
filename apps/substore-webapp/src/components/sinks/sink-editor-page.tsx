import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  RiArrowLeftLine,
  RiPlayLine,
  RiSaveLine,
  RiRefreshLine,
  RiDeleteBinLine,
} from "@remixicon/react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SinkEditorPanel } from "@/components/sinks/sink-editor-panel"
import { SinkPreviewPanel } from "@/components/sinks/sink-preview-panel"
import * as API from "@/api/client"

interface SinkEditorPageProps {
  title: string
  subtitle: React.ReactNode
  name: string
  setName?: (name: string) => void
  nameDisabled?: boolean
  secret: string
  setSecret: (secret: string) => void
  format: API.SinkFormat
  setFormat: (format: API.SinkFormat) => void
  script: string
  setScript: (script: string) => void
  evalResult: typeof API.EvalResponse.Type | null
  isEvalPending: boolean
  isSavePending: boolean
  onRun: () => void
  onSave: (e: React.MouseEvent | React.SubmitEvent) => void
  onDelete?: () => void
}

export function SinkEditorPage({
  title,
  subtitle,
  name,
  setName,
  nameDisabled,
  secret,
  setSecret,
  format,
  setFormat,
  script,
  setScript,
  evalResult,
  isEvalPending,
  isSavePending,
  onRun,
  onSave,
  onDelete,
}: SinkEditorPageProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      <div className="bg-background/95 z-10 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon-sm" render={<Link to="/sinks" />}>
            <RiArrowLeftLine className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h2 className="text-sm font-bold tracking-tight sm:text-xl">
              {title}
            </h2>
            {subtitle}
          </div>
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    <RiDeleteBinLine className="h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the sink "{name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRun}
            disabled={isEvalPending}
          >
            {isEvalPending ? (
              <RiRefreshLine className="mr-1 h-3 w-3 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
            ) : (
              <RiPlayLine className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
            )}
            <span className="text-[10px] sm:text-xs">Run</span>
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSavePending}>
            <RiSaveLine className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
            <span className="text-[10px] sm:text-xs">Save</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          orientation={isDesktop ? "horizontal" : "vertical"}
          className="h-full"
        >
          <ResizablePanel defaultSize={50} minSize={20}>
            <SinkEditorPanel
              name={name}
              setName={setName}
              nameDisabled={nameDisabled}
              secret={secret}
              setSecret={setSecret}
              format={format}
              setFormat={setFormat}
              script={script}
              setScript={setScript}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={20}>
            <SinkPreviewPanel
              evalResult={evalResult}
              isPending={isEvalPending}
              format={format}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
