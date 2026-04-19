import { Schema } from "effect"

export const FetchMode = Schema.Literal("server", "browser")
export type FetchMode = typeof FetchMode.Type

export const SinkFormat = Schema.Literal("json", "yaml")
export type SinkFormat = typeof SinkFormat.Type

export const Source = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("local", "remote"),
  name: Schema.String,
  tags: Schema.Array(Schema.String),
  url: Schema.optional(Schema.String),
  fetch_mode: Schema.optional(FetchMode),
  update_interval: Schema.optional(Schema.Number),
  last_updated: Schema.optional(Schema.Number),
  content: Schema.String,
})
export type Source = typeof Source.Type

export const Sink = Schema.Struct({
  name: Schema.String,
  secret: Schema.String,
  sink_format: SinkFormat,
  pipeline_script: Schema.String,
})
export type Sink = typeof Sink.Type

export const AddSourcePayload = Schema.Struct({
  type: Schema.Literal("local", "remote"),
  payload: Schema.Any, // Raw message in Go
})

export const AddSinkPayload = Schema.Struct({
  name: Schema.String,
  secret: Schema.String,
  sink_format: SinkFormat,
  pipeline_script: Schema.String,
})

export const EvalRequest = Schema.Struct({
  script: Schema.String,
  sink_format: SinkFormat,
})

export const EvalResponse = Schema.Struct({
  result: Schema.Any,
  result_string: Schema.optional(Schema.String),
  compiled_script: Schema.optional(Schema.String),
  stdout: Schema.String,
  stderr: Schema.String,
  error: Schema.optional(Schema.String),
})

export const JSONToFennelRequest = Schema.Struct({
  content: Schema.String,
})

export const JSONToFennelResponse = Schema.Struct({
  fennel: Schema.String,
})
