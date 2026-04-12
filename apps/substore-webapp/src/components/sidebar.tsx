import { Link } from "@tanstack/react-router"
import {
  RiDatabase2Line,
  RiTerminalBoxLine,
  RiSettings4Line,
} from "@remixicon/react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
  onLinkClick?: () => void
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const links = [
    { to: "/sources", label: "Sources", icon: RiDatabase2Line },
    { to: "/sinks", label: "Sinks", icon: RiSettings4Line },
    { to: "/eval", label: "Eval", icon: RiTerminalBoxLine },
  ]

  return (
    <aside className={cn("bg-muted/40 flex flex-col", className)}>
      <div className="border-b p-6">
        <h1 className="text-xl font-bold tracking-tight">SubStore</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={onLinkClick}
            className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
            activeProps={{ className: "bg-muted font-medium text-primary" }}
          >
            <link.icon className="h-5 w-5 shrink-0" />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}
