import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/eval")({
  component: () => <div className="p-8">Eval Page (Coming Soon)</div>,
})
