# Changelog

All notable changes to Hydrozoa are documented in this file.

## [Unreleased]

### Security

- Require production JWT, encryption, origin, and administrator bootstrap configuration.
- Store browser sessions in secure HttpOnly cookies with login throttling and origin checks.
- Execute Git without a shell or credentials in process arguments.
- Verify webhook signatures against raw payloads with replay protection.

### Fixed

- Recover the interface after refresh and contain rendering failures.
- Verify and rotate provider credentials, including actionable authentication health.
- Restore manual synchronization, target-specific DLQ replay, source-scoped deletion, and concurrency ownership.
- Apply source-selection mutations transactionally and retain cross-source repository identity.
- Await migrations before HTTP readiness and background synchronization.

### Added

- Provider pagination, runtime API contracts, retention cleanup, production probes, and graceful shutdown.
- Multi-stage non-root Docker image and hardened Kubernetes deployment templates.
- Security and Git process release-gate tests.
- Configurable mirror-description policies with default, custom-template, and omit modes.

### Performance

- Deduplicate and visibility-gate polling, lazy-load charting, bound Git output, and remove randomized telemetry.
- Bound provider requests and database pool waits, and run retention cleanup throughout long-lived processes.
