import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/sinks")({
  component: () => (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Outlet />
    </div>
  ),
})
