import {
  RiPlayLine,
  RiTerminalLine,
  RiErrorWarningLine,
  RiFileTextLine,
  RiCodeLine,
} from "@remixicon/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CodeBlock } from "@/components/code-block"
import * as API from "@/api/client"

interface SinkPreviewPanelProps {
  evalResult: typeof API.EvalResponse.Type | null
  isPending: boolean
  format: API.SinkFormat
}

export function SinkPreviewPanel({
  evalResult,
  isPending,
  format,
}: SinkPreviewPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/10 scrollbar-themed text-foreground">
      {!evalResult && !isPending && (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-4 opacity-60">
          <RiPlayLine className="h-10 sm:h-12 w-10 sm:w-12" />
          <p className="text-[10px] sm:text-xs font-medium italic">Click "Run" to preview the execution result</p>
        </div>
      )}

      {isPending && (
        <div className="h-full flex flex-col items-center justify-center text-primary/40 gap-4 animate-pulse">
          <RiTerminalLine className="h-10 sm:h-12 w-10 sm:w-12" />
          <p className="text-[10px] sm:text-xs font-bold tracking-widest uppercase">Executing Pipeline...</p>
        </div>
      )}

      {evalResult && (
        <div className="space-y-4">
          {evalResult.error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 sm:p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-bold text-[10px] uppercase tracking-wider">
                <RiErrorWarningLine className="h-4 w-4" />
                Execution Error
              </div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-zinc-950 p-2 sm:p-3 rounded border border-white/5 text-destructive-foreground">
                {evalResult.error}
              </pre>
            </div>
          )}

          <Accordion multiple defaultValue={["result", "console"]} className="gap-2 sm:gap-4">
            <AccordionItem value="result" className="border rounded-lg bg-background/50 overflow-hidden shadow-xs">
              <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <RiFileTextLine className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight">RESULT ({format.toUpperCase()})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0 border-t">
                <div className="bg-zinc-950 p-3 sm:p-4 overflow-auto max-h-[400px] sm:max-h-[500px]">
                  {evalResult.result_string ? (
                    <CodeBlock code={evalResult.result_string} lang={format} className="text-[10px] sm:text-xs" />
                  ) : (
                    <div className="text-muted-foreground/50 italic text-[10px] sm:text-xs">No result generated</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="lua" className="border rounded-lg bg-background/50 overflow-hidden shadow-xs">
              <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <RiCodeLine className="h-4 w-4 text-purple-500" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight">COMPILED LUA</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0 border-t">
                <div className="bg-zinc-950 p-3 sm:p-4 overflow-auto max-h-[400px] sm:max-h-[500px]">
                  {evalResult.compiled_script ? (
                    <CodeBlock code={evalResult.compiled_script} lang="lua" className="text-[10px] sm:text-xs" />
                  ) : (
                    <div className="text-muted-foreground/50 italic text-[10px] sm:text-xs">No lua code generated</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {(evalResult.stdout || evalResult.stderr) && (
              <AccordionItem value="console" className="border rounded-lg bg-background/50 overflow-hidden shadow-xs">
                <AccordionTrigger className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <RiTerminalLine className="h-4 w-4 text-amber-500" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight">CONSOLE OUTPUT</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t">
                  <div className="bg-zinc-950 p-3 sm:p-4 space-y-4 font-mono text-[10px] sm:text-xs">
                    {evalResult.stdout && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground/50">STDOUT</div>
                        <pre className="text-emerald-500 whitespace-pre-wrap">{evalResult.stdout}</pre>
                      </div>
                    )}
                    {evalResult.stderr && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground/50">STDERR</div>
                        <pre className="text-rose-500 whitespace-pre-wrap">{evalResult.stderr}</pre>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      )}
    </div>
  )
}
