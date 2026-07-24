---
layout: default
title: Features
description: Hydrozoa capabilities from provider discovery through mirror recovery.
---

# Mirror operations without provider lock-in

Hydrozoa separates the source repository graph from its synchronization targets, allowing one control plane to operate across hosted and self-managed Git services.

## Mirror matrix

The synchronization matrix records each source repository, branch, interval, selected entity types, and every configured target. Operators can update matrix settings or trigger a run through the dashboard and REST API.

| Capability | Behaviour |
|---|---|
| Multipoint targets | One source repository can synchronize to multiple target providers. |
| Entity selection | Code, issues, milestones, releases, and metadata can be selected per repository. |
| Scheduled operation | Each matrix item carries its own synchronization interval. |
| Manual execution | An authenticated API request can immediately start a matrix item. |

## Provider discovery

Hydrozoa discovers accounts, organizations, groups, workspaces, and repositories through each provider API. GitHub, GitLab, Gitea, Forgejo, Gogs, and Bitbucket use provider-specific adapters while exposing a consistent Hydrozoa resource model.

<div class="screenshot-frame">
  <img src="{{ "/assets/images/screenshot-dashboard-placeholder.svg" | relative_url }}" alt="Placeholder for provider discovery screenshot">
  <span>Screenshot placeholder · provider discovery</span>
</div>

## Telemetry

The dashboard and API expose:

- Provider reachability and latency.
- Process memory, CPU, uptime, architecture, and runtime version.
- Successful synchronization activity over the previous 24 hours.
- Translated operator messages alongside technical context.
- Per-target synchronization status and progress.

## Failure recovery

Failed operations are written to a dead-letter queue. An operator can inspect the failure and replay the item using `POST /api/v1/system/dlq/:id/replay`.

## Security controls

- Provider tokens use AES-256-GCM encryption at rest.
- Administrative sessions use signed, expiring JWT bearer tokens.
- GitHub webhook payloads support HMAC-SHA256 verification when a secret is configured.
- Provider tokens returned by the API are masked.

## Headless operation

Every control-plane action used by the dashboard is available through the REST API. See the [API reference]({{ "/api-reference" | relative_url }}) for request bodies, parameters, responses, and error states.

## Configuration reference

| Setting | Type | Default | Purpose |
|---|---|---:|---|
| `sync_interval` | Integer | `15` | Minutes between scheduled synchronization runs. |
| `log_retention_days` | Integer | `7` | Requested log retention window. |
| `max_concurrent_syncs` | Integer | `5` | Requested concurrency limit. |
| `bidirectional_sync` | Boolean | `false` | Enables bidirectional behavior when supported. |
| `conflict_strategy` | String | `source_wins` | Conflict handling strategy. |
