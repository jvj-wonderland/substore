import { Link } from "@tanstack/react-router"
import {
  RiArrowLeftLine,
  RiRefreshLine,
  RiSaveLine,
  RiDeleteBinLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
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

interface SourceEditorHeaderProps {
  title: string
  subtitle: string
  submitLabel: string
  submitPendingLabel: string
  isSubmitting: boolean
  onDelete?: () => void
}

export function SourceEditorHeader({
  title,
  subtitle,
  submitLabel,
  submitPendingLabel,
  isSubmitting,
  onDelete,
}: SourceEditorHeaderProps) {
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
                    This will permanently delete this source. This action cannot
                    be undone.
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
    </div>
  )
}
