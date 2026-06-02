# Spire Monorepo

Spire is a Turborepo workspace for a Node.js CLI plus a Next.js web application.

## Workspace Map

### Apps

- `apps/web`: Next.js app
- `apps/docs`: Next.js docs app (kept as-is)
- `apps/cli`: Node.js CLI package published as `@spire/cli`

### Packages

- `packages/ui`: shared React UI components
- `packages/types`: shared Zod schemas and TypeScript types
- `packages/stores`: shared Zustand stores for web state
- `packages/eslint-config`: shared ESLint flat configs
- `packages/typescript-config`: shared TypeScript configs

## Getting Started

Install dependencies:

```sh
pnpm install
```

Run all development tasks:

```sh
pnpm dev
```

Build all workspaces:

```sh
pnpm build
```

Run type checks:

```sh
pnpm check-types
```

Run lint:

```sh
pnpm lint
```

## Notes

- The CLI is distributed through npm (`@spire/cli`) and runs on Node.js (no Bun binary build).
- Turborepo task orchestration is configured in `turbo.json`.
