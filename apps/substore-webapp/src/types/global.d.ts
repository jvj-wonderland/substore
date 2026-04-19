export {}

declare global {
  interface Window {
    SUBSTORE_CONFIG?: {
      EXECUTION_URL?: string
    }
  }
}
