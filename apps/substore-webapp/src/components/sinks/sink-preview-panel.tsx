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
import { match, P } from "ts-pattern"

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
    <div className="bg-muted/10 scrollbar-themed text-foreground h-full space-y-4 overflow-y-auto p-4 sm:p-6">
      {match({ evalResult, isPending })
        .with({ isPending: true }, () => (
          <div className="text-primary/40 flex h-full animate-pulse flex-col items-center justify-center gap-4">
            <RiTerminalLine className="h-10 w-10 sm:h-12 sm:w-12" />
            <p className="text-[10px] font-bold tracking-widest uppercase sm:text-xs">
              Executing Pipeline...
            </p>
          </div>
        ))
        .with({ evalResult: null }, () => (
          <div className="text-muted-foreground/40 flex h-full flex-col items-center justify-center gap-4 opacity-60">
            <RiPlayLine className="h-10 w-10 sm:h-12 sm:w-12" />
            <p className="text-[10px] font-medium italic sm:text-xs">
              Click "Run" to preview the execution result
            </p>
          </div>
        ))
        .with({ evalResult: { error: P.string } }, ({ evalResult }) => (
          <div className="space-y-4">
            <div className="bg-destructive/10 border-destructive/20 space-y-2 rounded-lg border p-3 sm:p-4">
              <div className="text-destructive flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase">
                <RiErrorWarningLine className="h-4 w-4" />
                Execution Error
              </div>
              <pre className="text-destructive-foreground rounded border border-white/5 bg-zinc-950 p-2 font-mono text-[10px] break-all whitespace-pre-wrap sm:p-3">
                {evalResult.error}
              </pre>
            </div>
            <ResultAccordions evalResult={evalResult} format={format} />
          </div>
        ))
        .otherwise(({ evalResult }) =>
          evalResult ? (
            <div className="space-y-4">
              <ResultAccordions evalResult={evalResult} format={format} />
            </div>
          ) : null
        )}
    </div>
  )
}

function ResultAccordions({
  evalResult,
  format,
}: {
  evalResult: typeof API.EvalResponse.Type
  format: API.SinkFormat
}) {
  return (
    <Accordion
      multiple
      defaultValue={["result", "console"]}
      className="gap-2 sm:gap-4"
    >
      <AccordionItem
        value="result"
        className="bg-background/50 overflow-hidden rounded-lg border shadow-xs"
      >
        <AccordionTrigger className="hover:bg-muted/50 px-3 py-2 transition-colors sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <RiFileTextLine className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-bold tracking-tight uppercase sm:text-xs">
              RESULT ({format.toUpperCase()})
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t p-0">
          <div className="bg-muted/20 max-h-[400px] overflow-auto p-3 sm:max-h-[500px] sm:p-4">
            {evalResult.result_string ? (
              <CodeBlock
                code={evalResult.result_string}
                lang={format}
                className="[&_pre]:!border-border text-[10px] sm:text-xs [&_pre]:!m-0 [&_pre]:!rounded-md [&_pre]:!border [&_pre]:!bg-transparent [&_pre]:!p-3 sm:[&_pre]:!p-4"
              />
            ) : (
              <div className="text-muted-foreground/50 text-[10px] italic sm:text-xs">
                No result generated
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="lua"
        className="bg-background/50 overflow-hidden rounded-lg border shadow-xs"
      >
        <AccordionTrigger className="hover:bg-muted/50 px-3 py-2 transition-colors sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <RiCodeLine className="h-4 w-4 text-purple-500" />
            <span className="text-[10px] font-bold tracking-tight uppercase sm:text-xs">
              COMPILED LUA
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t p-0">
          <div className="bg-muted/20 max-h-[400px] overflow-auto p-3 sm:max-h-[500px] sm:p-4">
            {evalResult.compiled_script ? (
              <CodeBlock
                code={evalResult.compiled_script}
                lang="lua"
                className="[&_pre]:!border-border text-[10px] sm:text-xs [&_pre]:!m-0 [&_pre]:!rounded-md [&_pre]:!border [&_pre]:!bg-transparent [&_pre]:!p-3 sm:[&_pre]:!p-4"
              />
            ) : (
              <div className="text-muted-foreground/50 text-[10px] italic sm:text-xs">
                No lua code generated
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      {(evalResult.stdout || evalResult.stderr) && (
        <AccordionItem
          value="console"
          className="bg-background/50 overflow-hidden rounded-lg border shadow-xs"
        >
          <AccordionTrigger className="hover:bg-muted/50 px-3 py-2 transition-colors sm:px-4 sm:py-3">
            <div className="flex items-center gap-2">
              <RiTerminalLine className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-bold tracking-tight uppercase sm:text-xs">
                CONSOLE OUTPUT
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-t p-0">
            <div className="space-y-4 bg-zinc-950 p-3 font-mono text-[10px] sm:p-4 sm:text-xs">
              {evalResult.stdout && (
                <div className="space-y-1">
                  <div className="text-muted-foreground/50 text-[10px] font-bold uppercase">
                    STDOUT
                  </div>
                  <pre className="whitespace-pre-wrap text-emerald-500">
                    {evalResult.stdout}
                  </pre>
                </div>
              )}
              {evalResult.stderr && (
                <div className="space-y-1">
                  <div className="text-muted-foreground/50 text-[10px] font-bold uppercase">
                    STDERR
                  </div>
                  <pre className="whitespace-pre-wrap text-rose-500">
                    {evalResult.stderr}
                  </pre>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  )
}
