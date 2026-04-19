import { createFileRoute } from "@tanstack/react-router"
import {
  AnimatedRoute,
  RouteTransitionOutlet,
} from "@/components/page-transition"

export const Route = createFileRoute("/sinks")({
  component: () => (
    <AnimatedRoute className="flex flex-col overflow-hidden">
      <RouteTransitionOutlet />
    </AnimatedRoute>
  ),
})
