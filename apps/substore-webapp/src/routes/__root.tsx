import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden">
      <MobileNav />
      <Sidebar className="hidden md:flex w-64 border-r" />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
})
