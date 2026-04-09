import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { RiDatabase2Line, RiTerminalBoxLine, RiSettings4Line } from "@remixicon/react"

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen w-full">
      <aside className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">SubStore</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/sources"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiDatabase2Line className="w-5 h-5" />
            Sources
          </Link>
          <Link
            to="/sinks"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiSettings4Line className="w-5 h-5" />
            Sinks
          </Link>
          <Link
            to="/eval"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
            activeProps={{ className: "bg-muted font-medium" }}
          >
            <RiTerminalBoxLine className="w-5 h-5" />
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
