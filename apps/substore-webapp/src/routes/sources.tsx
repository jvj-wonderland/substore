import { createFileRoute } from "@tanstack/react-router"
import {
  AnimatedRoute,
  RouteTransitionOutlet,
} from "@/components/page-transition"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [{ title: pageTitle("Sources") }],
  }),
  component: () => (
    <AnimatedRoute className="overflow-hidden">
      <RouteTransitionOutlet />
    </AnimatedRoute>
  ),
})
