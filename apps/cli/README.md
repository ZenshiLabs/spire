# @zenshilabs/spire

Node.js CLI for Spire — broadcast a local directory so others can watch it live in real time. No accounts or sign-in; the session ID is the share link.

## Install

Requires Node.js >= 22 (active LTS lines only).

```sh
# one-off, no install
npx @zenshilabs/spire start

# or install globally for the `spire` command
npm install -g @zenshilabs/spire
```

## Commands

```
spire start [--dir <path>] [--title <text>] [--session <id>]
spire status
spire stop
```

By default the CLI talks to `http://localhost:3000`. Point it at a hosted Spire
instance by setting `SPIRE_API_URL` (e.g. `SPIRE_API_URL=https://spire.example.com spire start`).


> For how the CLI fits together with the web API and browser viewer, see the
> [architecture overview](https://github.com/ZenshiLabs/spire#architecture).

## Session ID Resolution

`spire start` resolves the session ID in priority order:

1. `--session <id>` flag (explicit override).
2. ID saved for this directory in `~/.spire/sessions.json` → **rejoin** the existing URL.
3. Freshly generated 8-character base36 ID, then saved for this directory.

Because local files are always the source of truth, every `start` re-uploads a fresh snapshot. Crashes, server restarts, and dropped connections recover by re-running the same command.

## Local State

`~/.spire/sessions.json` — registry of sessions keyed by absolute directory path. Enables the sticky session ID that makes a project's share URL permanent across CLI restarts.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPIRE_API_URL` | `http://localhost:3000` | API server base URL |
| `API_BASE_URL` | `http://localhost:3000` | Fallback (lower precedence than `SPIRE_API_URL`) |
