import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import { Toaster } from "@/components/ui/sonner"
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </LazyMotion>
      <Toaster richColors />
      <TanStackDevtools
        plugins={[
          {
            name: "Router",
            render: () => <TanStackRouterDevtoolsPanel router={router} />,
          },
          {
            name: "Query",
            render: () => <ReactQueryDevtoolsPanel client={queryClient} />,
          },
        ]}
      />
    </QueryClientProvider>
  )
}

export default App
