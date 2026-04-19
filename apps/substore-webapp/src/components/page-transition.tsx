import type { PropsWithChildren } from "react"
import { Outlet, useMatch, useMatches } from "@tanstack/react-router"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { cn } from "@/lib/utils"

export function RouteTransitionOutlet() {
  const matches = useMatches()
  const match = useMatch({ strict: false })
  const nextMatchIndex = matches.findIndex((item) => item.id === match.id) + 1
  const nextMatch = matches[nextMatchIndex]
  const routeKey = nextMatch?.id ?? match.id

  return (
    <AnimatePresence initial={false} mode="wait">
      <Outlet key={routeKey} />
    </AnimatePresence>
  )
}

export function AnimatedRoute({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <m.div
      className={cn(
        "h-full min-h-0 overflow-auto will-change-transform",
        className
      )}
      initial={{ opacity: 0, y: 18 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
      }}
      exit={{
        opacity: 0,
        y: -12,
        transition: { duration: 0.22, ease: [0.7, 0, 0.84, 0] },
      }}
    >
      {children}
    </m.div>
  )
}
