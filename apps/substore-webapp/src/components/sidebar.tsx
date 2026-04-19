import { Link, useRouterState } from "@tanstack/react-router"
import { RiDatabase2Line, RiSettings4Line } from "@remixicon/react"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { isMobile, setOpenMobile } = useSidebar()

  const links = [
    { to: "/sources", label: "Sources", icon: RiDatabase2Line },
    { to: "/sinks", label: "Sinks", icon: RiSettings4Line },
  ]

  return (
    <UISidebar className="border-r" collapsible="icon">
      <SidebarHeader className="h-14 border-b p-2">
        <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md group-data-[collapsible=icon]:hidden">
            <RiDatabase2Line className="size-4" />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            SubStore
          </h1>
          <SidebarTrigger className="size-8 shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.to}>
              <SidebarMenuButton
                render={<Link to={link.to} />}
                tooltip={link.label}
                isActive={
                  pathname === link.to || pathname.startsWith(`${link.to}/`)
                }
                className="h-9 gap-3 rounded-md px-3 text-sm [&_svg]:size-5"
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(false)
                  }
                }}
              >
                <link.icon className="shrink-0" />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </UISidebar>
  )
}
