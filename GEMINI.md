# SubStore Project Mandates

## Core Architecture

- **Monorepo Structure**:
  - `apps/substore-server`: Go backend.
  - `apps/substore-webapp`: React frontend.
- **Data Pipeline**: Powered by **Fennel** (compiled to Lua) running on **Gopher-Lua**.
- **Storage**: Persistent storage using **bbolt** with **gob** encoding.
- **Networking**:
  - **Port 8080**: Management API (`/api/*`) and Static SPA serving (production).
  - **Port 8001**: Execution API (dedicated port for script execution).

## Backend (Go) Conventions

- **Fennel Integration**:
  - All data pipeline scripts must be compiled from Fennel to Lua.
  - The earmuffed global `*sources*` is internally mangled to `__fnl_global___2asources_2a`.
  - Use the thread-safe `fennel.Pool` for executing scripts.
- **API Responses**: Always use formal response structs (`SourceResponse`, `SinkResponse`, `EvalResponse`) with explicit JSON tags.
- **Embed**: The production SPA must be embedded using `go:embed all:dist`.

## Frontend (React) Conventions

- **Tech Stack**: BaseUI + Shadcn, React Query, Effect TS, TanStack Router.
- **Validation**: Use **Effect.Schema** for all API data structures and form validation.
- **API Client**: Use `@effect/platform/HttpClient` with `FetchHttpClient.layer`.
- **BaseUI Rendering**: Favor the `render` prop over `asChild` for component composition (e.g., `DialogTrigger`).
- **Routing**: Use TanStack Router with auto-generated route trees (`src/routeTree.gen.ts`).

## Development Workflow

- **Justfile**: Use `just` for all common tasks:
  - `just dev`: Starts both API and UI in parallel.
  - `just build`: Builds the production-ready binary with embedded UI.
- **Formatting**:
  - Go: `go fmt ./...`
  - Webapp: `bun run format` (Prettier)
- **Git**: Never commit the `apps/substore-server/cmd/substore-server/dist` directory; it is generated during build.

## Critical Lessons & Best Practices

- **Atomic File Edits**: NEVER perform multiple `replace` calls on the same file in a single conversational turn. This causes race conditions and partial application of fixes.
- **Dialog State Lifecycle**: When reusing a Dialog for Add/Edit, the parent MUST reset the selection state on close. The child should sync its local state via `useEffect` triggered by the `open` prop transition to ensure a fresh UI state.
- **Strict Type Guards**: Always guard `Select` `onValueChange` and similar callbacks against `null` or `undefined` when using them as state setters in TypeScript.
- **Effect Context**: Ensure all Effect dependencies are resolved (type `never`) before calling runners like `runPromise` in utility functions.
- **TanStack Router Generation**: When adding new routes, the route tree might not auto-update. Manually trigger generation using: `bunx @tanstack/router-cli generate --routes-directory src/routes --generated-route-tree src/routeTree.gen.ts` from the webapp root.
- **BaseUI Button Composition**: Strictly follow the project mandate of using the `render` prop for `Button` composition (e.g., `render={<Link to="..." />}`) instead of `asChild`. Using `asChild` will cause TypeScript errors and layout inconsistencies.
- **EDN Syntax Highlighting**: For Fennel EDN previews, use the native `fennel` language support in Shiki.
- **React Compiler**: This project uses the **React Compiler**. Do NOT add manual memoization hooks like `useMemo`, `useCallback`, or `React.memo` unless explicitly needed for non-performance reasons. The compiler handles optimization automatically.
- **React 19 Form Submission**: `React.FormEvent<HTMLFormElement>` is deprecated in React 19. Use `React.SubmitEvent` instead for `onSubmit` handlers, and cast `e.currentTarget` to `HTMLFormElement` when passing to `new FormData()`. Prefer React 19 **Actions** (`action` prop) for new forms where possible.
