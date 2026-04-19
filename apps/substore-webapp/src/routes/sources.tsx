import { createFileRoute } from "@tanstack/react-router"
import {
  AnimatedRoute,
  RouteTransitionOutlet,
} from "@/components/page-transition"

export const Route = createFileRoute("/sources")({
  component: () => (
    <AnimatedRoute className="overflow-hidden">
      <RouteTransitionOutlet />
    </AnimatedRoute>
  ),
})
