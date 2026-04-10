import { useState } from "react"
import { RiMenuLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sidebar } from "./sidebar"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="-ml-2"
        >
          <RiMenuLine className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
        <DialogContent className="fixed inset-y-0 left-0 h-full w-72 max-w-none translate-x-0 translate-y-0 rounded-none border-r p-0 duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation</DialogTitle>
          </DialogHeader>
          <Sidebar className="h-full border-none" onLinkClick={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <span className="text-sm font-bold tracking-tight">SubStore</span>
    </div>
  )
}
