# syntax=docker/dockerfile:1.7

FROM oven/bun:1-debian AS web-build
WORKDIR /src

COPY package.json bun.lock ./
COPY apps/substore-webapp/package.json apps/substore-webapp/package.json
RUN bun install --frozen-lockfile

COPY tsconfig.json eslint.config.js .prettierrc ./
COPY apps/substore-webapp apps/substore-webapp
RUN bun run --cwd apps/substore-webapp build

FROM golang:1.26.1-bookworm AS server-build
WORKDIR /src

COPY apps/substore-server/go.mod apps/substore-server/go.sum apps/substore-server/
WORKDIR /src/apps/substore-server
RUN go mod download

WORKDIR /src
COPY apps/substore-server apps/substore-server
COPY --from=web-build /src/apps/substore-webapp/dist apps/substore-server/dist

ARG TARGETOS=linux
ARG TARGETARCH
WORKDIR /src/apps/substore-server
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" \
    -o /out/substore-server ./cmd/substore-server && \
    mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot

ENV SUBSTORE_DB_PATH=/data/substore.db
EXPOSE 8080 8001

COPY --from=server-build --chown=65532:65532 /out/substore-server /substore-server
COPY --from=server-build --chown=65532:65532 /out/data /data

USER 65532:65532
VOLUME ["/data"]
ENTRYPOINT ["/substore-server"]
