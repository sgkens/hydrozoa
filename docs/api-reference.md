---
layout: default
title: API Reference
description: Complete REST API reference for headless Hydrozoa operation.
---

<div class="api-intro">
  <div><span class="eyebrow">REST API · v1</span><h1>Hydrozoa REST API</h1><p>Configure providers, select repositories, run mirrors, inspect telemetry, and recover failed operations without using the dashboard.</p></div>
  <code class="api-base">http://localhost:3000</code>
</div>

## Authentication

All `/api/v1/*` operations except login and incoming webhooks require an HS256 JWT in the `Authorization` header. The public `/health` endpoint also requires no token. Tokens issued by the login endpoint expire after 24 hours.

```bash
curl --request POST http://localhost:3000/api/v1/auth/login \
  --header 'Content-Type: application/json' \
  --data '{"email":"admin@hydrozoa.io","password":"hydrozoa-default"}'
```

```bash
export HYDROZOA_TOKEN='returned-token'
curl --header "Authorization: Bearer $HYDROZOA_TOKEN" \
  http://localhost:3000/api/v1/system/sync-matrix
```

| Status | Meaning |
|---:|---|
| `400` | Request validation or current-state failure. |
| `401` | Credentials, bearer token, or webhook signature are missing/invalid. |
| `403` | Bearer token is malformed, expired, inactive, or has an invalid signature. |
| `404` | Requested provider, matrix item, or DLQ item does not exist. |
| `500` | Hydrozoa could not complete an internal operation. |
| `502` | An upstream Git provider rejected or failed the operation. |

<details class="endpoint" open><summary><span class="method post">POST</span><code>/api/v1/auth/login</code><small>Create an administrative session</small></summary><div class="endpoint-body" markdown="1">

No bearer token is required.

| Body field | Type | Required | Description |
|---|---|---|---|
| `email` | String | Yes | Administrative user email. |
| `password` | String | Yes | Administrative password. |

```json
{"token":"eyJ...","user":{"email":"admin@hydrozoa.io","name":"Hydrozoa Admin","isDefaultPassword":true}}
```
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/auth/reset-password</code><small>Replace the current administrator password</small></summary><div class="endpoint-body" markdown="1">
<span class="auth-badge">Bearer token required</span>

Body: `{ "currentPassword": "string", "newPassword": "string" }`. Returns `200` with a confirmation message or `400` when the current password is invalid.
</div></details>

## Providers

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/auth/providers</code><small>List configured providers with masked tokens</small></summary><div class="endpoint-body" markdown="1">
<span class="auth-badge">Bearer token required</span>

Returns an array of provider objects. `token` is always returned as `ENCRYPTED`; `baseUrl` aliases the stored `url`.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/auth/providers</code><small>Register a provider adapter</small></summary><div class="endpoint-body" markdown="1">
<span class="auth-badge">Bearer token required</span>

| Body field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Display name. |
| `type` | String | Yes | `github`, `gitlab`, `gitea`, `forgejo`, `gogs`, or `bitbucket`. |
| `url` / `baseUrl` | URL | Yes* | Provider API base URL. Standard GitHub/Bitbucket URLs are normalized. |
| `token` | String | Yes | Provider access token; encrypted before storage. |
| `isSource` | Boolean | No | Makes this the single discovery source. |
| `webhookSecret` | String | No | HMAC secret for incoming webhook verification. |

Returns `201` with the registered provider and masked credentials.
</div></details>

<details class="endpoint"><summary><span class="method delete">DELETE</span><code>/api/v1/auth/providers/:id</code><small>Delete a provider</small></summary><div class="endpoint-body" markdown="1">
<span class="auth-badge">Bearer token required</span>

`id` is the provider UUID. Returns `200` after deletion or `404`.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/auth/providers/:id/set-source</code><small>Set the exclusive source provider</small></summary><div class="endpoint-body" markdown="1">
<span class="auth-badge">Bearer token required</span>

Clears the source flag from other providers and sets it on `:id`.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/ping/:id</code><small>Measure provider reachability</small></summary><div class="endpoint-body" markdown="1">
Returns `{ "latency": "42ms", "status": "healthy" }`; unreachable providers return `timeout` and `offline`.
</div></details>

## Source discovery and selection

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/source/refresh</code><small>Request source repository refresh</small></summary><div class="endpoint-body" markdown="1">
Requires a configured source provider. Returns `400` if none exists.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/source/namespaces</code><small>Discover source namespaces</small></summary><div class="endpoint-body" markdown="1">
Returns normalized `{ id, name, type, repo_count }` objects for users, organizations, groups, or workspaces.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/source/namespaces/:id/repos</code><small>List repositories in a namespace</small></summary><div class="endpoint-body" markdown="1">

| Query | Type | Default | Description |
|---|---|---:|---|
| `page` | Integer | `1` | Provider result page. |
| `per_page` | Integer | `100` | Requested page size. |

Returns normalized repository objects with ID, name, description, web URL, and visibility.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/source/selection</code><small>Provision and persist repository targets</small></summary><div class="endpoint-body" markdown="1">

```json
{
  "selectedRepos": [{"id":"repo-id","name":"group/repository","branch":"main","visibility":"private","entities":["code","issues"]}],
  "targetProviderIds": ["provider-uuid"],
  "entities": ["code"]
}
```

Deselected repositories are removed from the source matrix. Selected repositories are provisioned at each target and inserted or updated in the matrix.
</div></details>

## Synchronization and recovery

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/sync-matrix</code><small>Read every synchronization relationship</small></summary><div class="endpoint-body" markdown="1">
Returns `{ "sync_matrix": [...] }` with source, branch, interval, entity, outcome, and target state.
</div></details>

<details class="endpoint"><summary><span class="method patch">PATCH</span><code>/api/v1/system/sync-matrix/:id</code><small>Update a matrix item</small></summary><div class="endpoint-body" markdown="1">
Body fields: `entities` (string array), `sync_interval` (integer minutes), and `branch` (string). Omitted values retain current settings.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/sync/manual/:id</code><small>Start a matrix item immediately</small></summary><div class="endpoint-body" markdown="1">
Marks all targets as `syncing`, starts background processing, and returns the updated item.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/dlq</code><small>List dead-letter queue items</small></summary><div class="endpoint-body" markdown="1">
Returns `{ "dlq_items": [...] }`.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/system/dlq/:id/replay</code><small>Replay and remove a failed item</small></summary><div class="endpoint-body" markdown="1">
Returns `200` when replay begins or `404` when the item does not exist.
</div></details>

## Telemetry and settings

<details class="endpoint"><summary><span class="method">GET</span><code>/health</code><small>Check database and Git availability</small></summary><div class="endpoint-body" markdown="1">
Public endpoint. Returns `200` with status, database, Git version, and timestamp; returns `503` when a dependency check fails.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/stats</code><small>Read process resource telemetry</small></summary><div class="endpoint-body" markdown="1">
Returns memory usage, uptime, CPU time, platform, runtime version, and architecture.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/providers-info</code><small>Read supported adapter versions</small></summary><div class="endpoint-body" markdown="1">
Returns the known Git provider adapters, API versions, and connection labels.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/logs/translated</code><small>Read operator and technical logs</small></summary><div class="endpoint-body" markdown="1">

| Query | Type | Default | Description |
|---|---|---:|---|
| `verbosity` | String | `human` | `human` returns translated fields; other values return complete rows. |
| `limit` | Integer | `100` | Maximum newest log rows. |
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/analytics/sync-metrics</code><small>Read 24-hour success series</small></summary><div class="endpoint-body" markdown="1">
Returns 24 hourly `{ "x": "ISO timestamp", "y": count }` points, including zero-value gaps.
</div></details>

<details class="endpoint"><summary><span class="method">GET</span><code>/api/v1/system/settings</code><small>Read system settings</small></summary><div class="endpoint-body" markdown="1">
Returns the active settings row.
</div></details>

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/system/settings</code><small>Replace system settings</small></summary><div class="endpoint-body" markdown="1">
Body fields: `sync_interval`, `log_retention_days`, `max_concurrent_syncs`, `bidirectional_sync`, and `conflict_strategy`.
</div></details>

## Webhooks

<details class="endpoint"><summary><span class="method post">POST</span><code>/api/v1/webhooks/incoming/:providerId</code><small>Trigger synchronization from a provider event</small></summary><div class="endpoint-body" markdown="1">
No JWT is required. If the provider has a webhook secret, GitHub calls must include `X-Hub-Signature-256` using the `sha256=&lt;hex digest&gt;` format. A valid call returns `202`.
</div></details>

## API configuration reference

| Environment variable | Required | Default | API effect |
|---|---|---|---|
| `DATABASE_URL` | Yes | None | PostgreSQL connection used by every persisted resource. |
| `JWT_SECRET` | Production: Yes | Development fallback | Signs and verifies administrative bearer tokens. |
| `HYDROZOA_MASTER_KEY` | Production: Yes | Development fallback | Derives the AES-256-GCM provider-token encryption key. |
| `PORT` | No | `3000` | Documentation currently reflects the fixed application port. |
