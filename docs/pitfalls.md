---
layout: default
title: Pitfalls
---

# Potential Pitfalls

While Hydrozoa is designed for robust Git synchronization, there are some common pitfalls to be aware of.

## 1. API Rate Limiting

Git providers like GitHub and GitLab have strict API rate limits. If you're running multiple concurrent syncs or have a large number of repositories, you may hit these limits.

- **Symptom**: Sync operations fail with "403 Forbidden" or "429 Too Many Requests" errors.
- **Solution**: Increase the `sync_interval` in your settings or reduce the number of concurrent syncs.

## 2. Inconsistent Metadata

While Hydrozoa aims to sync repository metadata (issues, PRs, etc.), different Git providers have different metadata structures.

- **Symptom**: Issues or PRs are not fully synced or have missing information.
- **Solution**: Check the provider compatibility documentation and ensure your API tokens have the necessary permissions.

## 3. Conflict Resolution

In bidirectional sync scenarios, conflicts can occur if changes are made to both the source and target repositories simultaneously.

- **Symptom**: Sync operations fail or result in inconsistent data.
- **Solution**: Choose a clear conflict resolution strategy (e.g., `source_wins`) and avoid making changes to both repositories at the same time.

## 4. Resource Exhaustion

Running multiple concurrent syncs can consume significant CPU and memory resources on your host machine.

- **Symptom**: The agent becomes unresponsive or crashes.
- **Solution**: Monitor your system resources and adjust the `max_concurrent_syncs` in your settings.

## 5. API Token Expiration

If your API tokens expire or are revoked, Hydrozoa will no longer be able to sync your repositories.

- **Symptom**: Sync operations fail with "401 Unauthorized" errors.
- **Solution**: Regularly check and update your API tokens in the Hydrozoa dashboard.
