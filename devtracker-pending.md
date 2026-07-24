# Hydrozoa - Development Notes and Workflow Instructions

---

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

## **Tasklist**
### **Bug Fixes**
- [x] 🟠🪲✅1️⃣ **BugFix** - Diagnose and fix repository sourcing from configured source providers
  > **Note!** GitHub namespace routing now uses the explicit namespace type instead of inferring it from hyphens, authenticated-user discovery includes private owned repositories, and UI selection uses repository names consistently.
---
