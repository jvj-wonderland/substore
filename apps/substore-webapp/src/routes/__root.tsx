import { HeadContent, createRootRoute } from "@tanstack/react-router"
import { createPortal } from "react-dom"
import { AppSidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { RouteTransitionOutlet } from "@/components/page-transition"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { pageTitle } from "@/lib/page-title"

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: pageTitle() }],
  }),
  component: () => (
    <SidebarProvider>
      <DocumentHead />
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

function DocumentHead() {
  if (typeof document === "undefined") {
    return null
  }

  return createPortal(<HeadContent />, document.head)
}
