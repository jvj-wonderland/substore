import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  FetchHttpClient,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import * as Schemas from "./schemas"

export * from "./schemas"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

const baseClient = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  return client.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(API_BASE)),
    HttpClient.filterStatusOk
  )
})

export const getSources = Effect.gen(function* () {
  const client = yield* baseClient
  const response = yield* client.get("/sources")
  return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Schemas.Source))(
    response
  )
})

export const getSource = (id: string) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* client.get(`/sources/${id}`)
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Source)(response)
  })

export const addSource = (payload: typeof Schemas.AddSourcePayload.Type) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.post("/sources").pipe(
      HttpClientRequest.bodyJson(payload),
      Effect.flatMap(client.execute)
    )
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Source)(response)
  })

export const updateSource = (
  id: string,
  payload: typeof Schemas.AddSourcePayload.Type
) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.patch(`/sources/${id}`).pipe(
      HttpClientRequest.bodyJson(payload),
      Effect.flatMap(client.execute)
    )
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Source)(response)
  })

export const getSinks = Effect.gen(function* () {
  const client = yield* baseClient
  const response = yield* client.get("/sinks")
  return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Schemas.Sink))(
    response
  )
})

export const addSink = (payload: typeof Schemas.AddSinkPayload.Type) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.post("/sinks").pipe(
      HttpClientRequest.bodyJson(payload),
      Effect.flatMap(client.execute)
    )
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Sink)(response)
  })

export const updateSink = (
  name: string,
  payload: typeof Schemas.AddSinkPayload.Type
) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.patch(`/sinks/${name}`).pipe(
      HttpClientRequest.bodyJson(payload),
      Effect.flatMap(client.execute)
    )
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Sink)(response)
  })

export const regenerateSinkSecret = (name: string) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* client.post(`/sinks/${name}/secret`)
    return yield* HttpClientResponse.schemaBodyJson(Schemas.Sink)(response)
  })

export const deleteSink = (name: string) =>
  baseClient.pipe(
    Effect.flatMap((client) =>
      client.execute(HttpClientRequest.del(`/sinks/${name}`))
    ),
    Effect.asVoid
  )

export const deleteSource = (id: string) =>
  baseClient.pipe(
    Effect.flatMap((client) =>
      client.execute(HttpClientRequest.del(`/sources/${id}`))
    ),
    Effect.asVoid
  )

export const evalScript = (payload: typeof Schemas.EvalRequest.Type) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.post("/eval").pipe(
      HttpClientRequest.bodyJson(payload),
      Effect.flatMap(client.execute)
    )
    return yield* HttpClientResponse.schemaBodyJson(Schemas.EvalResponse)(
      response
    )
  })

export const transformToFennel = (
  payload: typeof Schemas.JSONToFennelRequest.Type
) =>
  Effect.gen(function* () {
    const client = yield* baseClient
    const response = yield* HttpClientRequest.post(
      "/utils/json-to-fennel"
    ).pipe(HttpClientRequest.bodyJson(payload), Effect.flatMap(client.execute))
    return yield* HttpClientResponse.schemaBodyJson(
      Schemas.JSONToFennelResponse
    )(response)
  })

export const clientLayer = FetchHttpClient.layer
