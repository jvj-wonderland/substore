# SubStore

SubStore is a powerful, self-hosted subscription management and transformation server. It allows you to aggregate multiple subscription sources, transform them using Fennel-based data pipelines, and serve them via secured sinks.

## Core Features

- **Multi-Source Support**: Local and remote subscription sources.
- **Fennel Pipelines**: Transform, filter, and merge data using a Lisp-like language that compiles to Lua.
- **Persistent Storage**: Robust data management using `bbolt` and `gob`.
- **Secured Sinks**: Access your transformed subscriptions via HTTP Basic Auth.
- **Modern UI**: A React-based web interface for managing sources and sinks.

## Quick Start

### Installation

```bash
bun install
```

### Development

Start the backend and frontend in parallel:

```bash
just dev
```

### Production Build

Build the single production binary with the embedded UI:

```bash
just build
```

The resulting binary will be located in `bin/substore-server`.

## Configuration

SubStore can be configured using the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SUBSTORE_DB_PATH` | Path to the `bbolt` database file. | `~/.local/share/substore/substore.db` |
| `SUBSTORE_ADMIN_PORT` | Port for the admin API and web interface. | `8080` |
| `SUBSTORE_EXECUTION_PORT` | Dedicated port for executing subscription sinks. | `8001` |
| `SUBSTORE_API_TARGET` | (Dev only) Target for Vite's API proxying. | `http://localhost:8080` |
| `VITE_API_URL` | (Webapp) Base URL for the admin API. | `/api` |
| `VITE_EXECUTION_API_URL`| (Webapp) Base URL for the execution API. | `window.location.protocol + "//" + window.location.hostname + ":8001"` |

## Security

Execution of sinks requires **HTTP Basic Authentication**.

- **Username**: `substore`
- **Password**: The unique **Secret Key** generated for each sink.

## License

MIT
