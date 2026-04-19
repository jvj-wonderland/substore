import { createRootRoute } from "@tanstack/react-router"
import { AppSidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { RouteTransitionOutlet } from "@/components/page-transition"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const Route = createRootRoute({
  component: () => (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden">
          <MobileNav />
          <main className="min-h-0 flex-1 overflow-hidden">
            <RouteTransitionOutlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  ),
})
