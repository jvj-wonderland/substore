import { useSyncExternalStore } from "react"

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const result = window.matchMedia(query)
      result.addEventListener("change", callback)
      return () => result.removeEventListener("change", callback)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
