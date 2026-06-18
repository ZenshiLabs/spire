# apps/web

Next.js 16 application serving the Spire landing page, session viewer UI, and the REST + SSE API consumed by both the CLI broadcaster and browser viewers.

## Architecture

```mermaid
flowchart TB
    subgraph pages["Pages (App Router)"]
        HOME["/ — landing + session join form"]
        SESSION["/session/[sessionId] — viewer"]
    end

    subgraph api["API Routes"]
        direction LR
        R1["PUT    /api/sessions/:id\ncreate or reactivate"]
        R2["DELETE /api/sessions/:id\nend session"]
        R3["POST   /api/sessions/:id/snapshot\ningest full tree"]
        R4["POST   /api/sessions/:id/checkpoint\ningest save burst"]
        R5["GET    /api/sessions/:id/state\ninitial viewer payload"]
        R6["GET    /api/sessions/:id/stream\nSSE live events"]
        R7["GET    /api/sessions/:id/file\nlazy content fetch"]
        R8["GET    /api/sessions/:id/checkpoints\nhistory list"]
        R9["GET    /api/sessions/:id/checkpoints/:seq\nsingle checkpoint"]
    end

    subgraph lib["State Layer (app/api/_lib/)"]
        STATE_MOD["state.ts\nsession · snapshot · checkpoint logic\nin-process SSE fan-out"]
        HTTP_MOD["http.ts\ntyped response helpers"]
    end

    subgraph viewer["Viewer (Client Components)"]
        STREAM["useSessionStream\nhydrate stores + subscribe to SSE"]
        STORES["Zustand stores\nsession · file-tree · history · editor · theme"]
        MONACO["Monaco Editor\n+ Shiki syntax highlighting"]
        TREE["Virtualized file tree\nwith context menus"]
        TIMELINE["Checkpoint timeline\n+ inline Monaco diffs"]
    end

    DB[(Postgres\nvia @spire/db)]

    R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8 & R9 --> STATE_MOD
    STATE_MOD --> DB
    SESSION --> STREAM
    STREAM --> STORES
    STORES --> MONACO & TREE & TIMELINE
```

## Viewer Data Flow

```mermaid
sequenceDiagram
    participant Hook as useSessionStream
    participant State as /api/.../state
    participant SSE as /api/.../stream
    participant Stores as Zustand Stores
    participant Cache as ContentCache (LRU)

    Hook->>State: fetch initial payload
    State-->>Hook: session + snapshot + checkpoints + contents?
    Hook->>Stores: hydrate all stores
    Hook->>Cache: prefill (eager mode only)
    Hook->>SSE: EventSource subscribe

    loop Live updates
        SSE-->>Hook: checkpoint event
        Hook->>Stores: applyChanges + addLive
        SSE-->>Hook: snapshot event
        Hook->>Stores: setTree
    end
```

## Key Files

| Path | Description |
|------|-------------|
| `src/app/api/_lib/state.ts` | Core session/snapshot/checkpoint business logic + SSE pub/sub |
| `src/app/api/_lib/http.ts` | `success` / `failure` / `readJsonBody` response helpers |
| `src/app/session/[sessionId]/session-viewer.tsx` | Top-level viewer layout (panels, status bar, quick-open) |
| `src/app/session/[sessionId]/file-tree.tsx` | Virtualized file tree with context menus |
| `src/app/session/[sessionId]/code-viewer.tsx` | Monaco tabs, diff mode, breadcrumbs |
| `src/app/session/[sessionId]/history-panel.tsx` | Checkpoint timeline with inline Monaco diffs |
| `src/components/monaco-viewer.tsx` | Monaco viewer and diff-viewer wrappers |
| `src/lib/use-session-stream.ts` | Store hydration + SSE subscription hook |
| `src/lib/use-file-content.ts` | Cache-first file content hook with hover prefetch |
| `src/lib/content-cache.ts` | Content-addressed LRU cache (~120 entries / ~12 MB) |
| `src/lib/session-api.ts` | Typed fetch helpers for all viewer-side API calls |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon/Postgres connection string |
| `SPIRE_EAGER_MAX_BYTES` | No | Max total session size for eager mode (default: 1.5 MB) |
| `SPIRE_EAGER_MAX_FILES` | No | Max file count for eager mode (default: 400) |
