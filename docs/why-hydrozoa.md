---
layout: default
title: Why Hydrozoa?
---

# Why Use Hydrozoa?

Hydrozoa is a specialized Git Multipoint Mirror Agent designed for developers and organizations who need robust, multi-provider synchronization.

## Pros

- **Multi-Cloud Availability**: Keep your repositories in sync across different cloud providers (GitHub, GitLab, etc.) for high availability and redundancy.
- **Migration Simplified**: Easily migrate your repositories and metadata from one provider to another.
- **Bioluminescent UI**: A visually stunning and intuitive dashboard for real-time monitoring and telemetry.
- **Self-Hosted Control**: Full control over your data, synchronization logic, and security.
- **Robust Error Handling**: Integrated Dead Letter Queue (DLQ) for managing failed sync attempts.
- **Automated Versioning**: Built-in semantic versioning for your build and release processes.

## Cons

- **Self-Hosted Maintenance**: Requires manual setup, configuration, and maintenance of the agent.
- **Resource Consumption**: Running multiple concurrent syncs can consume significant system resources.
- **API Limits**: Subject to the API rate limits of your Git providers.
- **Complexity**: Configuring complex synchronization matrices and conflict resolution strategies can be challenging for beginners.

## Caveats

- **API Token Security**: Ensure your API tokens are stored securely and have the minimum required permissions.
- **Data Consistency**: While Hydrozoa aims for real-time synchronization, there may be slight delays depending on your network and provider API performance.
- **Conflict Resolution**: Carefully choose your conflict resolution strategy to avoid data loss in bidirectional sync scenarios.
- **Provider Compatibility**: While Hydrozoa supports major Git providers, some metadata (e.g., issues, PRs) may not be fully compatible across all platforms.
