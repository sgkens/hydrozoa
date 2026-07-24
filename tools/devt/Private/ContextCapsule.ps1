# RavenUI Task Tracker - Context Capsule Exporter Helper
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-ContextCapsuleHelper {
    Write-TrackerLog 'act' "Generating structured AI-ready workspace context capsule..." "Capsule"

    $repoRoot = Resolve-RepoPath "."
    $targetFile = [System.IO.Path]::Combine($repoRoot, "context-capsule.md")

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("# **RavenUI Workspace Context Capsule**")
    [void]$sb.AppendLine("Generated on: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))`n")

    # 1. Workspace Meta
    [void]$sb.AppendLine("## **1. Workspace Metadata**")
    $branch = (git branch --show-current 2>$null)
    if ($null -ne $branch) { $branch = $branch.Trim() } else { $branch = "unknown" }
    $commit = (git rev-parse HEAD 2>$null)
    if ($null -ne $commit) { $commit = $commit.Trim() } else { $commit = "unknown" }
    
    $version = "unknown"
    $resolvedVerFile = Resolve-RepoPath "VERSION"
    if ([System.IO.File]::Exists($resolvedVerFile)) {
        $version = ([System.IO.File]::ReadAllText($resolvedVerFile)).Trim()
    }

    [void]$sb.AppendLine("- **Active Branch:** ``$branch``")
    [void]$sb.AppendLine("- **Latest Commit:** ``$commit``")
    [void]$sb.AppendLine("- **Theme Version:** ``$version``")

    # Git status summary
    $gitStatus = git status --short 2>$null
    if ($gitStatus) {
        [void]$sb.AppendLine("- **Workspace Status:** Dirty (modified files below):")
        [void]$sb.AppendLine('```')
        foreach ($line in $gitStatus) {
            [void]$sb.AppendLine($line)
        }
        [void]$sb.AppendLine('```')
    } else {
        [void]$sb.AppendLine("- **Workspace Status:** Clean (no unstaged/staged modifications)")
    }
    [void]$sb.AppendLine("")

    # 2. Pending Tasks
    [void]$sb.AppendLine("## **2. Active Task List**")
    $pendingFile = Resolve-RepoPath "devtracker-pending.md"
    if ([System.IO.File]::Exists($pendingFile)) {
        $lines = [System.IO.File]::ReadAllLines($pendingFile)
        $inTasks = $false
        foreach ($line in $lines) {
            if ($line -match "^##\s+\*\*Tasklist\*\*") {
                $inTasks = $true
                continue
            }
            if ($inTasks) {
                [void]$sb.AppendLine($line)
            }
        }
    } else {
        [void]$sb.AppendLine("No active ``devtracker-pending.md`` file found.")
    }
    [void]$sb.AppendLine("")

    # 3. Component and Documentation Registry
    [void]$sb.AppendLine("## **3. Theme Components & Documentation**")
    [void]$sb.AppendLine("### **3.1. Reusable Components (`_includes/comps/`)**")
    $compsDir = Resolve-RepoPath "_includes/comps"
    if ([System.IO.Directory]::Exists($compsDir)) {
        $compFiles = [System.IO.Directory]::GetFiles($compsDir, "*.html")
        if ($compFiles.Count -gt 0) {
            foreach ($file in $compFiles) {
                $name = [System.IO.Path]::GetFileName($file)
                $size = (Get-Item $file).Length
                [void]$sb.AppendLine("- [``$name``](file://$($file -replace '\\', '/')) ($size bytes)")
            }
        } else {
            [void]$sb.AppendLine("- No HTML components found.")
        }
    } else {
        [void]$sb.AppendLine("- Component directory not found.")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("### **3.2. Documentation Pages (`docs/components/`)**")
    $docsCompsDir = Resolve-RepoPath "docs/components"
    if ([System.IO.Directory]::Exists($docsCompsDir)) {
        $docFiles = [System.IO.Directory]::GetFiles($docsCompsDir, "*.md")
        if ($docFiles.Count -gt 0) {
            foreach ($file in $docFiles) {
                $name = [System.IO.Path]::GetFileName($file)
                $size = (Get-Item $file).Length
                [void]$sb.AppendLine("- [``$name``](file://$($file -replace '\\', '/')) ($size bytes)")
            }
        } else {
            [void]$sb.AppendLine("- No markdown documentation files found.")
        }
    } else {
        [void]$sb.AppendLine("- Documentation directory not found.")
    }
    [void]$sb.AppendLine("")

    # 4. Engineering Context & Architecture Lessons Learned
    [void]$sb.AppendLine("## **4. Engineering Context & Architectural Guidelines**")
    $contextDir = Resolve-RepoPath "context-source"
    if ([System.IO.Directory]::Exists($contextDir)) {
        $contextFiles = [System.IO.Directory]::GetFiles($contextDir, "*.md")
        foreach ($file in $contextFiles) {
            $fileName = [System.IO.Path]::GetFileName($file)
            [void]$sb.AppendLine("### **4.1. Source: $fileName**")
            [void]$sb.AppendLine("> Reference: [source file](file://$($file -replace '\\', '/'))`n")
            $content = [System.IO.File]::ReadAllText($file)
            $content = $content -replace '^#\s+.*$', ''
            [void]$sb.AppendLine($content)
            [void]$sb.AppendLine("`n---`n")
        }
    } else {
        [void]$sb.AppendLine("No engineering context documents found.")
    }

    [System.IO.File]::WriteAllText($targetFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
    Write-TrackerLog 'suc' "Structured context capsule generated at: $targetFile" "Capsule"
}
