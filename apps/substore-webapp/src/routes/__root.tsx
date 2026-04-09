import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import {
  RiDatabase2Line,
  RiTerminalBoxLine,
  RiSettings4Line,
} from "@remixicon/react"

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen w-full">
      <aside className="bg-muted/40 flex w-64 flex-col border-r">
        <div className="border-b p-6">
          <h1 className="text-xl font-bold">SubStore</h1>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          <Link
            to="/sources"
            className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiDatabase2Line className="h-5 w-5" />
            Sources
          </Link>
          <Link
            to="/sinks"
            className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiSettings4Line className="h-5 w-5" />
            Sinks
          </Link>
          <Link
            to="/eval"
            className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiTerminalBoxLine className="h-5 w-5" />
            Eval
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
})
