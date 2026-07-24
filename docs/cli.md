---
layout: default
title: CLI
description: Operate Hydrozoa from a terminal or CI job.
---

# Hydrozoa CLI

The CLI exposes the same operational API used by the dashboard. It requires
Bun 1.2 or later and does not install a background service.

## Run with bunx

```bash
bunx @skgens/hydrozoa login \
  --url https://hydrozoa.example.com \
  --email admin@example.com \
  --password "$HYDROZOA_PASSWORD"

bunx @skgens/hydrozoa status
bunx @skgens/hydrozoa matrix
bunx @skgens/hydrozoa sync --matrix production
```

`sync --matrix` accepts either a matrix ID or an exact source repository name.
The CLI resolves repository names through the synchronization matrix before
calling the manual-sync endpoint.

## Commands

| Command | Description |
|---|---|
| `login` | Authenticate and save the URL and JWT with user-only permissions. |
| `health` | Check HTTP, database, and Git availability. |
| `status` | Summarize health, configured mirrors, and dead-letter failures. |
| `matrix` | List synchronization matrix items and target state. |
| `sync --matrix <value>` | Start a configured mirror immediately. |
| `providers` | List configured provider adapters. |
| `dlq` | List dead-letter queue items. |
| `dlq --replay <id>` | Replay a failed operation. |
| `logs` | Read recent translated logs. |

Add `--json` to an operational command for structured output.

## Non-interactive use

CI jobs can avoid the local configuration file:

```bash
export HYDROZOA_URL=https://hydrozoa.example.com
export HYDROZOA_TOKEN="$CI_HYDROZOA_TOKEN"

bunx @skgens/hydrozoa status --json
```

The CLI also reads `HYDROZOA_EMAIL` and `HYDROZOA_PASSWORD` during login.
Do not place passwords or tokens directly in a CI configuration file.

## Configuration

Interactive login writes:

```text
~/.config/hydrozoa/config.json
```

The directory and file are created with user-only permissions. Set
`HYDROZOA_CONFIG` to use a different location, or pass `--url` and `--token`
for a single invocation.

## AI functionality

Hydrozoa does not currently implement AI-assisted features. An earlier project
scaffold included an unused Gemini dependency and installation note; neither
was connected to the server, dashboard, synchronization engine, or API. Those
placeholders have been removed to avoid suggesting an unsupported capability
or exposing an API key in browser configuration.
