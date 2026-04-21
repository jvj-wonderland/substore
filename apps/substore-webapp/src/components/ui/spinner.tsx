import type * as React from "react"
import { cn } from "@/lib/utils"
import { RiLoaderLine } from "@remixicon/react"

function Spinner({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RiLoaderLine>) {
  return (
    <RiLoaderLine
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
