# Start both API and UI servers in parallel
dev:
    @just dev-api & just dev-ui & wait

# Start the Go API server in development mode
dev-api:
    cd apps/substore-server && go run cmd/substore-server/main.go

# Start the Vite development server for the UI
dev-ui:
    cd apps/substore-webapp && bun run dev

# Build the Web SPA
build-ui:
    cd apps/substore-webapp && bun run build

# Build the complete server with embedded SPA
build: build-ui
    rm -rf apps/substore-server/cmd/substore-server/dist
    cp -r apps/substore-webapp/dist apps/substore-server/cmd/substore-server/dist
    mkdir -p bin
    cd apps/substore-server && go build -o ../../bin/substore-server cmd/substore-server/main.go

# Format all code
format:
    bun run format
    cd apps/substore-server && go fmt ./...

# Run all tests
test:
    cd apps/substore-server && go test ./...
    cd apps/substore-webapp && bun run typecheck
