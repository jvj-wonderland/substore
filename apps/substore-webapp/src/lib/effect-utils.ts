import { Effect, ParseResult } from "effect"

export const formatError = (error: unknown): string => {
  if (ParseResult.isParseError(error)) {
    return ParseResult.TreeFormatter.formatErrorSync(error)
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const runQuery = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(effect)
