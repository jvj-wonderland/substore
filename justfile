# Start both API and UI servers in parallel
dev:
    @just dev-api & just dev-ui & wait

# Start the Go API server in development mode
dev-api:
    mkdir -p apps/substore-server/dist
    touch apps/substore-server/dist/index.html
    cd apps/substore-server && go run cmd/substore-server/main.go

# Start the Vite development server for the UI
dev-ui:
    pnpm --filter substore-webapp dev

# Build the Web SPA
build-ui:
    pnpm --filter substore-webapp build

# Build the complete server with embedded SPA
build: build-ui
    rm -rf apps/substore-server/dist
    cp -r apps/substore-webapp/dist apps/substore-server/dist
    mkdir -p bin
    cd apps/substore-server && go build -o ../../bin/substore-server cmd/substore-server/main.go

# Format all code
format:
    pnpm format
    cd apps/substore-server && go fmt ./...

# Run all tests
test:
    cd apps/substore-server && go test ./...

# Lint all code
lint:
    cd apps/substore-server && go vet ./...
    pnpm lint
    pnpm --filter substore-webapp typecheck
