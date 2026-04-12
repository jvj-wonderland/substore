import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

export const Route = createRootRoute({
  component: () => (
    <div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
      <MobileNav />
      <Sidebar className="hidden w-64 border-r md:flex" />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
})
