# Hydrozoa - Development Notes and Workflow Instructions

## **Tasklist**

## **REPO INSTRUCTIONS**

**TASKS:** Work through task items in the **`devtracker-pending.md`** file. If a task is not in its proper category, move it to the correct section. If a task item is incomplete, relies on a temporary workaround rather than best practices, or represents a simple implementation instead of the ideal advanced method, add an inline comment block starting with `> **After Thought:**` or `> **Note!**` detailing alternatives, potential issues, or future design considerations.

**SKILL HARNESS:** Refer to the `fluent-ui-v1` skill for all UI/UX tasks. Refer to the `phellams-aa` skill for PowerShell automation, TUI design, and C# compilation tasks. Refer to the `phellams-htpine` skill for HTMX and Alpine.js dashboard development. Refer to the `context-source/` directory for extended project knowledge and architectural lessons learned.

**VERSIONING:** Refer to the `fluent-ui-v1` versioning strategy for SemVer tags and releases. **Git Workflow:** The build version can only be incremented by `major`, `minor`, or `patch` levels; otherwise, the validation process will fail.

**CHANGELOG:** Keep an active `CHANGELOG.md` file referring to `fluent-ui-v1` standards.

**CONTEXT DIRECTORY:** Use the `context-source/` folder to store AI-related PDRs, context files, and lessons learned. Maintain `extended-knowledge-lessons-learned-building-hydrozoaye.md` as the active log of project insights, which will be compiled into the v1 knowledge base for future runs.

## **MONOREPO & WORKTREE WORKFLOW:**

**MONOREPO STRUCTURE:** Drift is a monorepo. Component scopes must be used for commits and versioning following Conventional Commits conventions (e.g. `feat(core):`, `fix(waf):`, `docs(dashboard):`).

**GIT WORKTREES:** To support parallel development by humans and AI agents concurrently, Drift uses Git worktrees. This provides clean directory isolation and prevents checkout collision. Use the [tools/AgentWorktree.psm1](file:///mnt/g/devspace/projects/powershell/_repos/drift/tools/AgentWorktree.psm1) helper module:

- `New-AgentWorktree -AgentName <name> -TaskSlug <slug>`: Spins up a sibling worktree directory (e.g., `drift-<name>-<slug>`) and checks out branch `agent/<name>/<slug>`.
- `Remove-AgentWorktree -WorktreePath <path> [-DeleteBranch] [-Force]`: Cleans up the worktree folder and deletes the local agent branch.
- `Get-AgentWorktrees`: Lists all active worktree paths and branches.

**DEV ENVIRONMENT AUTOMATION (`devt`):** Use the integrated `devt` utility module located at [tools/devt](file:///mnt/g/devspace/projects/powershell/_repos/drift/tools/devt) to compile tasks, sync checkmarks/notes, generate changelogs, diff branches, and automate commit validation.

## **GIT WORKFLOW:**

**BRANCHES:** Create a new branch (e.g., `feat/`, `fix/`, etc.) from `develop` or spin up an agent worktree branch under `agent/`. Use descriptive names like `feat/component/icon-improve-hash`.

**MERGE REQUESTS:** Create a Draft Merge Request (MR) in GitLab targeting `develop`. Include details on the planned change, implementation strategy, and expected outcomes.

**LABELS & ASSIGNMENT:** Assign MRs and tasks to the user specified in the git configuration. Add appropriate workflow labels and delete the source branch after merging.

**BRANCH REMINDERS:** Run `git pull origin develop` before creating a new branch or worktree directory.

**OUTSTANDING COMMITS:** If a feature is complete, commit and push outstanding changes.

_**DIFFICULTY:**_ 🔴 - `very-hard` | 🟠 - `moderate` | 🟡 - `easy` | 🟢 - `very-easy`
_**SCOPE:**_ 💡 - `Concepts-skip-from-task-list-unless-asked` | 🌟 - `feature-appears-only-on-primary-tasks` | 🦀 - `bug-appears-only-on-primary-bug` | 🪲 - `bug-fixed-appears-only-on-primary-bugfix` | 🩹 - `fix-only-appears-on-primary-tasks`
_**COMPLETE:**_ ⏳ - `pending/not-started` | 🌀 - `working-on` | ✔️ - `partially-complete` | ❓ - `working-but-with-issues` | ✅ - `complete`
_**PRIORITY:**_ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 - `priority-of-tasks`

> Tasks should follow this convention:
>
> - [ ] {{DIFFICULTY}} {{SCOPE}} {{COMPLETE}} {{PRIORITY}} **TASK CATEGORY** - Description
>     - [ ] {{DIFFICULTY}} {{SCOPE}} {{COMPLETE}} {{PRIORITY}} _**SUB-TASK CATEGORY**_ - Description
>     > _**NOTE!**_ - Note content

### **Bug Fixes**
- [x] 🟠🪲✅1️⃣ **BugFix** - Diagnose and fix repository sourcing from configured source providers
  > **Note!** GitHub namespace routing now uses the explicit namespace type instead of inferring it from hyphens, authenticated-user discovery includes private owned repositories, and UI selection uses repository names consistently.
### **Release Blockers**
- [x] 🔴🪲✅0️⃣ **Release Blockers** - Fix repository refresh blank-screen recovery and provider authentication failures (GitLab User API 401)
  > **Note!** Refresh recovery is contained by a root error boundary. Provider credentials are trimmed, verified against the provider identity API before storage, rotatable in place, and surfaced through authenticated health checks.
- [x] 🔴🌟✅0️⃣ **Release Blockers** - Complete production-readiness audit covering performance, defects, quality of life, missing components, and security flows; convert verified findings into release-blocking work
  > **Note!** Audit completed across server routes, sync flows, React state, dependencies, and deployment artifacts. Twelve verified release-blocking tasks and epics were added below.
- [x] 🔴🩹✅0️⃣ **Release Blockers** - EPIC: Harden secrets and authentication: require production JWT/master keys, replace default admin bootstrap, add login throttling, and move browser auth away from localStorage
- [x] 🔴🩹✅0️⃣ **Release Blockers** - EPIC: Secure Git and webhook execution: replace shell-interpolated git commands, prevent credentials in process arguments/logs, verify raw webhook bodies with timing-safe comparison, and add replay protection
- [x] 🔴🪲✅0️⃣ **Release Blockers** - EPIC: Restore sync correctness: fix manual sync skipping all targets, implement real DLQ replay, align DLQ schema/UI fields, and add concurrency-safe job ownership
- [x] 🔴🩹✅0️⃣ **Release Blockers** - EPIC: Add API input contracts and transactional integrity for provider selection, settings, sync matrix mutations, provider deletion, and cross-source repository identity
- [x] 🟠🩹✅0️⃣ **Release Blockers** - EPIC: Upgrade vulnerable production dependencies and lockfiles; current audit reports 10 vulnerabilities including critical protobufjs and high postcss/vite/ws findings
  > **Note!** The clean runtime dependency audit now reports zero production vulnerabilities; the remaining low advisory is confined to the development build toolchain.
- [x] 🔴🌟✅1️⃣ **Release Blockers** - EPIC: Complete provider compatibility: authenticated credential testing, token rotation/edit flow, required-scope guidance, pagination for every provider/entity, and actionable provider health checks
- [x] 🟠🩹✅1️⃣ **Release Blockers** - EPIC: Add frontend failure containment with an application error boundary, typed API response guards, stable loading/error/empty states, request cancellation, and refresh deduplication
- [x] 🔴🩹✅0️⃣ **Release Blockers** - EPIC: Make deployment artifacts production-ready: add the referenced Dockerfile, move Kubernetes secrets out of ConfigMaps, and define probes, resources, non-root execution, persistence, and shutdown behavior
- [x] 🔴🌟✅0️⃣ **Release Blockers** - EPIC: Establish release-gate testing for authentication, provider adapters, webhook verification, sync jobs, DLQ replay, migrations, React error recovery, and end-to-end repository discovery
  > **Note!** Automated security and non-shell Git gates are supplemented by a clean container build and live PostgreSQL migration/readiness/login smoke test. Provider-specific end-to-end validation still requires disposable credentials for each external service and belongs in the pre-production environment.
- [x] 🟠🩹✅1️⃣ **Release Blockers** - EPIC: Improve performance and truthful telemetry: split the oversized frontend bundle, eliminate duplicate polling, paginate logs/data, remove randomized UI metrics, and add bounded retention/cleanup jobs
- [x] 🟡🪲✅0️⃣ **Release Blockers** - Add missing DELETE /api/v1/system/sync-matrix/:id endpoint used by mirror decommission UI and enforce source-scoped deletion
- [x] 🟠🪲✅0️⃣ **Release Blockers** - Await database migrations before starting HTTP and background sync services; fail readiness when initialization fails
- [x] 🟠🌟✅0️⃣ **Release Blockers** - Add configurable mirror description policy and correct misleading system settings controls
  > **Note!** Users can retain the Hydrozoa template, append a custom template using `{repo}` and `{url}`, or omit the suffix. Encryption is displayed as enforced, unsupported conflict choices were removed, and unimplemented destructive actions no longer report false success.
- [ ] 🔴🦀⏳0️⃣ **Release Blockers** - Persist canonical target repository identities and support a provider-specific destination namespace instead of assuming the source namespace exists on every target
- [ ] 🔴🩹⏳0️⃣ **Release Blockers** - Run multi-day soak and fault-injection gates covering provider timeouts, PostgreSQL interruption, process restart, webhook storms, DLQ growth, and disk exhaustion
- [ ] 🔴🌟⏳0️⃣ **Release Blockers** - Add automated provider-contract suites using disposable GitHub, GitLab, Gitea or Forgejo projects before declaring repository mirroring reliable
