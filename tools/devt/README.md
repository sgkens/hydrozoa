# 🛠️ **devt — Branded Task Lifecycle & Git Automation Module**

`devt` is an artisan-grade, self-contained PowerShell utility module built specifically for **StaticCanvas** projects. It automates development workflows by bridging local, file-based Markdown task tracking with remote GitLab work items, milestones, and Conventional Commits.

|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|
|:---|:---|:---|
| 💼 **Workspace Mode** | Local-First (SOT) | GitLab Connected |
| 🛡️ **Execution** | PowerShell 7.0+ Cross-Platform | Extreme .NET Performance |
| 🎨 **UI Engine** | ANSI 256-Color Gradients | TUI Metrics Dashboard |

---

## **Why It Was Created**

1. **Context Capsule Efficiency**: Large project task lists consume significant AI context tokens. `devt` compiles a comprehensive task source file into a compact, pending-only task list to keep AI processing speeds high and token usage low.
2. **Local-First Source of Truth (SOT)**: Keeps the task list in plain Markdown committed to Git, avoiding heavy project management web app overhead while retaining full version control history.
3. **Automation Bridge**: Automates Git conventional commits, branch diffing, and two-way status/comment syncing with GitLab issues, milestones, and Merge Requests.

---

## **File Lifecycle Architecture**

`devt` manages tasks across three canonical files in the repository root:

*   **`devtracker-source.md`**: The local Source of Truth (SOT) containing all active tasks, historical notes, and completed records.
*   **`devtracker-pending.md`**: The compiled active task list. Completed items are filtered out to keep it lightweight for AI agents.
*   **`devtracker-archive.md`**: Permanent archival file for completed tasks that have been pruned from the active source.

---

## **Directory Structure**

The module is structured according to clean PowerShell automation standards:

```text
tools/devt/
├── devt.psd1                         # Module manifest defining exports and metadata
├── devt.psm1                         # Root module loader (sources all scripts dynamically)
├── README.md                         # Documentation (this file)
├── Public/
│   └── Invoke-Devt.ps1               # Main cmdlet orchestrator (aliased to 'devt')
└── Private/
    ├── Get-ConventionalCommitVersion.ps1 # Tag-anchored conventional commits versioning engine
    ├── GitLabSync.ps1                # GitLab REST API interaction & MR generation
    ├── GitOps.ps1                    # Conventional Commit helper & diff formatting
    ├── Helpers.ps1                   # Text parsers, dynamic root resolution & validators
    ├── New-AsciiColor.ps1            # Standard terminal color helper
    ├── New-AsciiGradient.ps1         # Native ANSI 256-color gradient generator
    └── lazylog.ps1                   # Structured execution logger
```

---

## **Execution Modes**

The primary cmdlet is `Invoke-Devt` (aliased to `devt`). You can execute it with the `-Mode` parameter:

```powershell
devt -Mode <mode-name> [options]
```

### **Available Modes**

| Mode | Alias | Description |
| :--- | :--- | :--- |
| **`init`** | - | Prepares a fresh `devtracker-source.md` template file or copies an existing pending file. |
| **`compile`** | `comp` | Filters and compiles active tasks from the source file into `devtracker-pending.md`. |
| **`sync`** | - | Merges completed task checkmarks and developer notes from the pending file back into the source file. |
| **`prune`** | - | Moves completed tasks from the source file to `devtracker-archive.md`. |
| **`stats`** | - | Renders a high-fidelity terminal dashboard with task metrics and progress bars using ANSI gradients. |
| **`list`** | - | Lists tasks in a clean terminal view with optional filters (`-Category`, `-Difficulty`, etc.). |
| **`add`** | - | Formats and appends a new task line to the source tracker. |
| **`remove`** | `rm` | Deletes a task from the source file matching a search key. |
| **`validate`** | - | Audits the source task list to ensure it conforms to the canonical emoji and category formatting. |
| **`sync-gitlab`** | - | Performs two-way synchronization between local tasks and GitLab issues & milestones. |
| **`commit`** | - | Prompts for Conventional Commit metadata and commits staged changes. |
| **`diff`** | - | Renders a styled summary of staged/unstaged changes. |
| **`branches`** | - | Renders a terminal comparison dashboard of local repository branches using concurrent processes. |
| **`gitdiff`** | - | Shows structured code differences between the current branch and a compare branch. |
| **`projects`** | - | Validates and lists components declared in `devt.workspace.json`. |
| **`graph`** | - | Emits component nodes, dependency edges, topological order, and target inventory. |
| **`affected`** | - | Maps Git changes to directly changed components and their reverse dependencies. |
| **`run-affected`** | - | Builds an affected-target plan and executes it only when `-Execute` is supplied. |
| **`tag`** | - | Previews release readiness, creates an annotated SemVer tag, and pushes only when explicitly requested. |
| **`changelog`** | - | Automatically generates/compiles `CHANGELOG.md` from git conventional commit history. |
| **`help`** | - | Renders a man-page style terminal help guide with usage examples. |

---

## **Parameter Reference**

### **`Invoke-Devt`**

| Parameter | Type | Position | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Mode`** | `String` | 0 | False | `compile` | The execution mode, including task lifecycle, Git workflow, `tag`, and changelog modes. |
| **`SourcePath`** | `String` | Named | False | `devtracker-source.md` | Path to the source tasks file. |
| **`TargetPath`** | `String` | Named | False | `devtracker-pending.md` | Path to compiled active tasks file. |
| **`ArchivePath`** | `String` | Named | False | `devtracker-archive.md` | Path to archived completed tasks file. |
| **`ExcludeCompleted`** | `Switch` | Named | False | `$false` | Excludes completed tasks during compilation. |
| **`IncludeCompleted`** | `Switch` | Named | False | `$false` | Forces inclusion of completed tasks during compilation. |
| **`KeepCompletedWithEmoji`** | `String[]` | Named | False | `@()` | Emojis array. Completed tasks containing these emojis will be kept during compile/prune. |
| **`ExcludeCompletedWithEmoji`** | `String[]` | Named | False | `@()` | Emojis array. Completed tasks containing these emojis will be excluded during compile/prune. |
| **`FilterEmoji`** | `String[]` | Named | False | `@()` | Emoji array to filter list/compilation tasks by. |
| **`ExcludeEmoji`** | `String[]` | Named | False | `@()` | Emoji array to exclude list/compilation tasks by. |
| **`KeepInstructions`** | `Switch` | Named | False | `$false` | Keeps the repo instructions block in compiled output. |
| **`CleanTemplate`** | `Switch` | Named | False | `$false` | Overwrites `devtracker-source.md` with a blank template on `init`. |
| **`TaskText`** | `String` | Named | False | None | The description of the task to add. |
| **`Category`** | `String` | Named | False | None | The category heading or query string (for add/list). |
| **`Difficulty`** | `String` | Named | False | None | Difficulty level for adding/filtering. Valid: `very-easy`, `easy`, `moderate`, `very`, `🟢`, `🟡`, `🟠`, `🔴`. |
| **`Scope`** | `String` | Named | False | None | Task scope for adding/filtering. Valid: `feature`, `bug`, `bug-fixed`, `fix`, `concept`, `🌟`, `🦀`, `🪲`, `🩹`, `💡`. |
| **`Priority`** | `String` | Named | False | None | Numeric priority for adding a task (0 to 10, or emojis like `0️⃣` to `🔟`). |
| **`CompleteStatus`** | `String` | Named | False | None | Completion status for adding/listing a task. Valid: `incomplete`, `partially`, `issues`, `complete`, `working`, `✔️`, `❓`, `✅`, `🌀`. |
| **`Branch`** | `String` | Named | False | None | Target branch to compare against in branch/diff modes. |
| **`TaskKey`** | `String` | Named | False | None | Task search keyword query used to target a task for removal. |
| **`CreateTag`** | `Switch` | Named | False | `$false` | Creates the validated annotated tag locally in `tag` mode. |
| **`PushTag`** | `Switch` | Named | False | `$false` | Pushes the created tag to `TagRemote`; requires `CreateTag`. |
| **`SkipConfirm`** | `Switch` | Named | False | `$false` | Bypasses the interactive tag confirmation. |
| **`TagRemote`** | `String` | Named | False | `origin` | Remote used for an explicit tag push. |
| **`WorkspacePath`** | `String` | Named | False | `devt.workspace.json` | Overrides the workspace manifest. |
| **`CompareBase`** | `String` | Named | False | Workspace `defaultBase` | Base Git revision for affected calculation. |
| **`CompareHead`** | `String` | Named | False | `WORKTREE` | Head Git revision; `WORKTREE` includes tracked and untracked local changes. |
| **`AsJson`** | `Switch` | Named | False | `$false` | Emits machine-readable project or affected output. |
| **`Target`** | `String` | Named | False | None | Target name required by `run-affected`. |
| **`Execute`** | `Switch` | Named | False | `$false` | Executes the affected plan. Omit it for a read-only plan. |
| **`ContinueOnError`** | `Switch` | Named | False | `$false` | Continues target steps after a non-zero exit code. |

## **Workspace Graph and Targets**

`devt.workspace.json` schema version 2 adds optional component targets. Commands and arguments are separate values and execute without a shell parser.

```json
{
  "schemaVersion": 2,
  "defaultBase": "develop",
  "components": {
    "ci": {
      "paths": ["tools/devt"],
      "dependencies": [],
      "targets": {
        "test": {
          "command": "pwsh",
          "arguments": ["-NoProfile", "-Command", "Invoke-Pester -Path ./test/unit/Devt.Tests.ps1"],
          "workingDirectory": ".",
          "timeoutSeconds": 120
        }
      }
    }
  }
}
```

```powershell
# Environment: PowerShell 7, repository root
./devt -Mode graph -AsJson
./devt -Mode run-affected -Target test -AsJson
./devt -Mode run-affected -Target test -Execute -AsJson
```

Plans follow dependency-first topological order. Components without the requested target are reported as affected but do not create execution steps. `timeoutSeconds` defaults to `900`; a timeout terminates the target process tree and reports exit code `124`.

---

## **Task Format Conventions**

To be parsed and validated correctly by `devt`, task lines in the Markdown files must conform to the following schema:

```markdown
- [ ] <difficulty><scope>[status][priority] **Category/SubCategory** - Task Description
```

### **Metadata Emojis**

*   **Difficulty**: `🟢` (Very Easy), `🟡` (Easy), `🟠` (Moderate), `🔴` (Very High)
*   **Scope**: `💡` (Concept), `🌟` (Feature), `🦀` (Active Bug), `🪲` (Resolved Bug), `🩹` (Fix)
*   **Status**: `✔️` (Partially Complete), `❓` (Working with Issues), `✅` (Verified Complete), `🌀` (Work in Progress)
*   **Priority**: Keycap digits `0️⃣` to `🔟`

*Example:*
```markdown
- [ ] 🟠🌟🌀 **CLI/TaskTracker** - Implement GitLab sync logic
```

---

## **Technical Implementation Details**

### **1. Dynamic Git Root Resolution**
To ensure `devt` remains fully reusable and independent of the folder path in which it is installed, the module resolves the repository root dynamically by walking up the directory tree from the module's location until it locates a `.git` directory. If none is found, it falls back to three directory levels above the helper directory.

### **2. Version Engine: `Get-ConventionalCommitVersion`**
`devt` integrates the `Get-ConventionalCommitVersion` engine to calculate project semantic versions (SemVer). 
*   **Tag-Anchored Analysis**: The engine locates the most recent Git tag (e.g., `v1.2.3`) to establish a version baseline, scanning only the commit logs generated since that tag.
*   **Fallback Scanning**: If no tags are found in the repository history, the engine scans the full repository history starting from `0.1.0`.
*   **Commit Parsing**: It inspects subject lines for conventional types (`feat` minor bump, `fix` or `perf` patch bump) and checks commit bodies for `BREAKING CHANGE:` keywords to trigger major version bumps.

### **3. GitLab Auto-Authentication**
`devt` automatically extracts the credentials needed for the GitLab REST API by parsing the repository's Git remote origin URL:
```text
https://username:token@gitlab.com/namespace/project.git
```
This avoids hardcoding or maintaining separate environment configuration files, enabling secure API interactions for `sync-gitlab` and `create-mr` commands.

### **4. Concurrent Branch Status (RunspacePool)**
The `branches` execution mode evaluates all local branch relationships compared to the base branch (`develop` or `main`/`master`) in parallel. By utilizing a PowerShell `RunspacePool`, it runs background git calls concurrently to output the ahead/behind count, age, and last message in seconds, even for repositories with large counts of branches.

### **5. High-Performance .NET Disk I/O**
The module is designed with high-performance .NET classes under the hood:
*   Utilizes `[System.IO.File]` and `[System.IO.Path]` for direct disk I/O, bypassing slow PowerShell disk cmdlets.
*   Implements `[System.Text.StringBuilder]` for layout compiling to minimize memory allocation.
*   Uses `[System.Collections.Generic.List[type]]` for in-memory collections.

---

## **How to Setup & Use**

### **Installation**

1. Copy the `tools/devt` directory into your target repository.
2. In the target repository root, create an entry script named `devt.ps1` (or add an alias to your shell profile):
   ```powershell
   #!/usr/bin/env pwsh
   $scriptPath = [System.IO.Path]::GetDirectoryName($MyInvocation.MyCommand.Path)
   Import-Module ([System.IO.Path]::Combine($scriptPath, "tools/devt/devt.psd1")) -Force
   Invoke-Devt @args
   ```
3. Create a bash wrapper in the root named `devt` to allow easy Unix execution:
   ```bash
   #!/usr/bin/env bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   pwsh -File "$SCRIPT_DIR/devt.ps1" "$@"
   ```
4. Initialize the task structure:
   ```bash
   ./devt init
   ```
5. Update `devtracker-source.md` with your repository-specific tasks.

### **Common Workflow Commands**

*   **View Dashboard**:
    ```bash
    ./devt stats
    ```
*   **Add a Task**:
    ```bash
    ./devt add -TaskText "Explore custom Liquid tags to simplify asset resolution" -Category "Features/Liquid" -Difficulty "easy" -Scope "feature"
    ```
*   **Compile Tasklist for AI agent**:
    ```bash
    ./devt compile
    ```
*   **Sync GitLab remote tasks**:
    ```bash
    ./devt sync-gitlab
    ```
*   **Commit staged files**:
    ```bash
    ./devt commit
    ```
