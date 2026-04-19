import { RiUploadCloud2Line } from "@remixicon/react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface LocalSourceFieldsProps {
  content: string
  setContent: (val: string) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
}

export function LocalSourceFields({
  content,
  setContent,
  isDragging,
  setIsDragging,
}: LocalSourceFieldsProps) {
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
