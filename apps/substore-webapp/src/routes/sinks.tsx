import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/sinks")({
  component: () => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Outlet />
    </div>
  ),
})
