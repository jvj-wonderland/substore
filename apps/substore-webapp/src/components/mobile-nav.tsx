import { RiMenuLine } from "@remixicon/react"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function MobileNav() {
  return (
    <div className="bg-background flex items-center gap-2 border-b px-4 py-2 md:hidden">
      <SidebarTrigger className="-ml-2 size-8 md:hidden">
        <RiMenuLine className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </SidebarTrigger>
      <span className="text-sm font-bold tracking-tight">SubStore</span>
    </div>
  )
}
