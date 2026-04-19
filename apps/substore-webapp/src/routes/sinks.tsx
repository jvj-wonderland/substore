import { createFileRoute } from "@tanstack/react-router"
import {
  AnimatedRoute,
  RouteTransitionOutlet,
} from "@/components/page-transition"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/sinks")({
  head: () => ({
    meta: [{ title: pageTitle("Sinks") }],
  }),
  component: () => (
    <AnimatedRoute className="flex flex-col overflow-hidden">
      <RouteTransitionOutlet />
    </AnimatedRoute>
  ),
})
