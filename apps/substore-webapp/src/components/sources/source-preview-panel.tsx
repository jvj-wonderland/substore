import { CodeBlock } from "@/components/code-block"
import { Label } from "@/components/ui/label"

interface SourcePreviewPanelProps {
  type: string
  fennelPreview: string
}

export function SourcePreviewPanel({ type, fennelPreview }: SourcePreviewPanelProps) {
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
