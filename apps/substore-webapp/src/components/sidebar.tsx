import { Link, useRouterState } from "@tanstack/react-router"
import {
  RiDatabase2Line,
  RiTerminalBoxLine,
  RiSettings4Line,
} from "@remixicon/react"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { isMobile, setOpenMobile } = useSidebar()

  const links = [
    { to: "/sources", label: "Sources", icon: RiDatabase2Line },
    { to: "/sinks", label: "Sinks", icon: RiSettings4Line },
    { to: "/eval", label: "Eval", icon: RiTerminalBoxLine },
  ]

  return (
    <UISidebar className="border-r" collapsible="offcanvas">
      <SidebarHeader className="border-b p-6">
        <h1 className="text-xl font-bold tracking-tight">SubStore</h1>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarMenu>
        {links.map((link) => (
          <SidebarMenuItem key={link.to}>
            <SidebarMenuButton
              render={<Link to={link.to} />}
              isActive={
                pathname === link.to || pathname.startsWith(`${link.to}/`)
              }
              className="gap-3 rounded-md px-3 py-2 text-sm [&_svg]:size-5"
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
    </UISidebar>
  )
}
