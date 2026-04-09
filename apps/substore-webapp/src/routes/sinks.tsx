import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/sinks")({
  component: () => <div className="p-8">Sinks Page (Coming Soon)</div>,
})
