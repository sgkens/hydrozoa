# Requires -Version 7.0
<#
.SYNOPSIS
    Compiles, synchronizes, and manages project tasks.
.DESCRIPTION
    The Invoke-Devt cmdlet compiles task items from devtracker-source.md to devtracker-pending.md,
    synchronizes completions/notes, prunes, and manages tasks directly from the shell.
.PARAMETER Mode
    The mode of execution: init, compile, comp, sync, prune, stats, list, add, remove, rm, help.
.PARAMETER SourcePath
    Path to the source tasks file. Defaults to devtracker-source.md.
.PARAMETER TargetPath
    Path to the compiled active tasks file. Defaults to devtracker-pending.md.
.PARAMETER ArchivePath
    Path to the archived completed tasks file. Defaults to devtracker-archive.md.
.PARAMETER ExcludeCompleted
    Switch to exclude completed tasks during compilation.
.PARAMETER IncludeCompleted
    Switch to force include completed tasks during compilation.
.PARAMETER KeepCompletedWithEmoji
    Emoji array. Completed tasks containing these emojis will be kept during compile/prune.
.PARAMETER ExcludeCompletedWithEmoji
    Emoji array. Completed tasks containing these emojis will be excluded during compile/prune.
.PARAMETER FilterEmoji
    Emoji array to filter list/compilation tasks by.
.PARAMETER ExcludeEmoji
    Emoji array to exclude list/compilation tasks by.
.PARAMETER KeepInstructions
    Switch to keep instructions block in compilation output.
.PARAMETER CleanTemplate
    Switch to overwrite with a clean template on init.
.PARAMETER TaskText
    The description of the task to add.
.PARAMETER Category
    The category of the task (for add/list).
.PARAMETER Difficulty
    Difficulty level for add/list: very-easy, easy, moderate, very.
.PARAMETER Scope
    Task scope for add/list: feature, bug, bug-fixed, fix, concept.
.PARAMETER Priority
    Numeric priority for adding a task: 0 to 10.
.PARAMETER CompleteStatus
    Completion status for adding/listing a task: incomplete, partially, issues, complete, working.
.PARAMETER TaskKey
    Task search key for removing a task.
.EXAMPLE
    devt -Mode stats
    devt -Mode list -Category Features -Difficulty easy
    devt -Mode add -TaskText "New feature" -Category Features
#>
function Invoke-Devt {
    [CmdletBinding()]
    [Alias('devt')]
    param(
        [Parameter(Mandatory=$false, Position=0)]
        [ValidateSet("init", "compile", "comp", "sync", "prune", "stats", "list", "add", "remove", "rm", "commit", "diff", "validate", "sync-gitlab", "create-mr", "branches", "gitdiff", "projects", "graph", "affected", "run-affected", "tag", "changelog", "capsule", "deploy:build", "deploy:container", "git:init-hooks", "git:stage-feature", "help")]
        [string]$Mode = "compile",

        [Parameter(Mandatory=$false)]
        [string]$SourcePath = "devtracker-source.md",

        [Parameter(Mandatory=$false)]
        [string]$TargetPath = "devtracker-pending.md",

        [Parameter(Mandatory=$false)]
        [string]$ArchivePath = "devtracker-archive.md",

        [Parameter(Mandatory=$false)]
        [switch]$ExcludeCompleted,

        [Parameter(Mandatory=$false)]
        [switch]$IncludeCompleted,

        [Parameter(Mandatory=$false)]
        [string[]]$KeepCompletedWithEmoji = @(),

        [Parameter(Mandatory=$false)]
        [string[]]$ExcludeCompletedWithEmoji = @(),

        [Parameter(Mandatory=$false)]
        [string[]]$FilterEmoji = @(),

        [Parameter(Mandatory=$false)]
        [string[]]$ExcludeEmoji = @(),

        [Parameter(Mandatory=$false)]
        [switch]$KeepInstructions,

        [Parameter(Mandatory=$false)]
        [switch]$CleanTemplate,

        [Parameter(Mandatory=$false)]
        [string]$TaskText,

        [Parameter(Mandatory=$false)]
        [string]$Category,

        [Parameter(Mandatory=$false)]
        [ValidateSet('very-easy', 'easy', 'moderate', 'very', '🟢', '🟡', '🟠', '🔴')]
        [string]$Difficulty,

        [Parameter(Mandatory=$false)]
        [ValidateSet('feature', 'bug', 'bug-fixed', 'fix', 'concept', '🌟', '🦀', '🪲', '🩹', '💡')]
        [string]$Scope,

        [Parameter(Mandatory=$false)]
        [ValidateSet('0','1','2','3','4','5','6','7','8','9','10', '0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟')]
        [string]$Priority,

        [Parameter(Mandatory=$false)]
        [ValidateSet('incomplete', 'partially', 'issues', 'complete', 'working', '✔️', '❓', '✅', '🌀')]
        [string]$CompleteStatus,

        [Parameter(Mandatory=$false)]
        [string]$Branch,

        [Parameter(Mandatory=$false)]
        [string]$TaskKey,

        [switch]$CreateTag,
        [switch]$PushTag,
        [switch]$SkipConfirm,
        [string]$TagRemote = 'origin',
        [string]$TagRepoPath,

        [string]$WorkspacePath,
        [string]$CompareBase,
        [string]$CompareHead = 'WORKTREE',
        [switch]$AsJson,
        [string]$Target,
        [switch]$Execute,
        [switch]$ContinueOnError
    )

    begin {
        # Set modes/aliases
        if ($Mode -eq "comp") { $Mode = "compile" }
        if ($Mode -eq "rm") { $Mode = "remove" }

        # Resolve files relative to repo root
        $resolvedSourcePath = Resolve-RepoPath $SourcePath
        $resolvedTargetPath = Resolve-RepoPath $TargetPath
        $resolvedArchivePath = Resolve-RepoPath $ArchivePath

        # Assign parameter values to module script-scope variables for helper functions
        $script:shouldExcludeCompleted = $true
        if ($PSBoundParameters.ContainsKey('IncludeCompleted') -and $IncludeCompleted) {
            $script:shouldExcludeCompleted = $false
        }
        if ($PSBoundParameters.ContainsKey('ExcludeCompleted') -and $ExcludeCompleted) {
            $script:shouldExcludeCompleted = $true
        }

        $script:KeepCompletedWithEmoji = $KeepCompletedWithEmoji
        $script:ExcludeCompletedWithEmoji = $ExcludeCompletedWithEmoji
        $script:FilterEmoji = $FilterEmoji
        $script:ExcludeEmoji = $ExcludeEmoji
    }

    process {
        switch ($Mode) {
            "init" {
                Write-TrackerLog 'act' "Preparing source task file..." "Init"
                if ([System.IO.File]::Exists($resolvedSourcePath) -and -not $CleanTemplate) {
                    Write-TrackerLog 'wrn' "Source file already exists: $resolvedSourcePath" "Init"
                    Write-Host "➡️ Use -CleanTemplate to force overwrite with a blank template."
                    return
                }

                if (-not $CleanTemplate -and [System.IO.File]::Exists($resolvedTargetPath)) {
                    Write-TrackerLog 'suc' "Copying existing $resolvedTargetPath to $resolvedSourcePath" "Init"
                    [System.IO.File]::Copy($resolvedTargetPath, $resolvedSourcePath, $true)
                } else {
                    Write-TrackerLog 'suc' "Creating a fresh task template at $resolvedSourcePath" "Init"
                    $template = @"
# Jekyll Theme RavenUI - Development Notes and Workflow Instructions

---

## **REPO INSTRUCTIONS**

*(Insert repo instructions here)*

---

## **Tasklist**

### **Issues Remaining (priority-1)**

### **Enhancements (priority-2)**

### **Features (priority-3)**

### **Bug Fixes (priority-4)**

### **Documentation (priority-5)**

### **Refactoring (priority-6)**

### **Refine Features (priority-7)**

### **Refine Documentation (priority-8)**

### **Backlog**
"@
                    [System.IO.File]::WriteAllText($resolvedSourcePath, $template, [System.Text.UTF8Encoding]::new($false))
                }
            }

            "compile" {
                Write-TrackerLog 'act' "Compiling $resolvedSourcePath to $resolvedTargetPath..." "Compile"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Compile"
                    Write-Host "➡️ Please run: devt -Mode init"
                    exit 1
                }

                $compiledContent = Get-CompiledTaskContent -sourcePath $resolvedSourcePath -KeepInstructions $KeepInstructions
                [System.IO.File]::WriteAllText($resolvedTargetPath, $compiledContent, [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Compiled tasks to $resolvedTargetPath" "Compile"
            }

            "sync" {
                Write-TrackerLog 'act' "Merging completions, notes, and new tasks from $resolvedTargetPath back to $resolvedSourcePath..." "Sync"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Sync"
                    exit 1
                }
                if (-not [System.IO.File]::Exists($resolvedTargetPath)) {
                    Write-TrackerLog 'err' "Target file not found: $resolvedTargetPath" "Sync"
                    exit 1
                }

                $sourceParsed = Parse-TaskFile $resolvedSourcePath
                $targetParsed = Parse-TaskFile $resolvedTargetPath

                # Build lookup table of target tasks using normalized text as key
                $targetLookup = @{}
                foreach ($category in $targetParsed.CategoryOrder) {
                    foreach ($task in $targetParsed.TasksByCategory[$category]) {
                        $key = Get-NormalizedTaskText $task.RawText
                        if (-not $targetLookup.ContainsKey($key)) {
                            $targetLookup[$key] = $task
                        }
                    }
                }

                # Build lookup table of source tasks using normalized text as key to identify new additions
                $sourceLookup = @{}
                foreach ($category in $sourceParsed.CategoryOrder) {
                    foreach ($task in $sourceParsed.TasksByCategory[$category]) {
                        $key = Get-NormalizedTaskText $task.RawText
                        if (-not $sourceLookup.ContainsKey($key)) {
                            $sourceLookup[$key] = $task
                        }
                    }
                }

                # Build lookup of source categories by normalized name
                $sourceCategoryLookup = @{}
                foreach ($cat in $sourceParsed.CategoryOrder) {
                    $normCat = Get-NormalizedCategoryName $cat
                    if (-not $sourceCategoryLookup.ContainsKey($normCat)) {
                        $sourceCategoryLookup[$normCat] = $cat
                    }
                }

                $mergedCount = 0
                $notesCount = 0
                $addedCount = 0

                # 1. Update existing source tasks with target completion status and children/notes
                foreach ($category in $sourceParsed.CategoryOrder) {
                    foreach ($task in $sourceParsed.TasksByCategory[$category]) {
                        $key = Get-NormalizedTaskText $task.RawText
                        if ($targetLookup.ContainsKey($key)) {
                            $targetTask = $targetLookup[$key]

                            # If target is completed but source is not, update source
                            if ($targetTask.IsCompleted -and -not $task.IsCompleted) {
                                $task.IsCompleted = $true
                                # Replace checkbox [ ] with [x] in the raw text
                                $task.RawText = $task.RawText -replace '^([-*]\s*\[)\s*(\])', '${1}x${2}'
                                $mergedCount++
                            }

                            # Sync children (subtasks/solutions/notes) if the target has any
                            if ($targetTask.Children.Count -gt 0) {
                                if ($task.Children.Count -ne $targetTask.Children.Count -or ($task.Children -join "`n") -ne ($targetTask.Children -join "`n")) {
                                    $notesCount++
                                }
                                $task.Children = $targetTask.Children
                            }
                        }
                    }
                }

                # 2. Identify and append new tasks from target file into source file
                foreach ($targetCategory in $targetParsed.CategoryOrder) {
                    $normTargetCat = Get-NormalizedCategoryName $targetCategory
                    
                    $matchedSourceCat = ""
                    if ($sourceCategoryLookup.ContainsKey($normTargetCat)) {
                        $matchedSourceCat = $sourceCategoryLookup[$normTargetCat]
                    } else {
                        # It's a brand new category! Add it to source structure
                        $matchedSourceCat = $targetCategory
                        $sourceParsed.CategoryOrder.Add($matchedSourceCat)
                        $sourceParsed.TasksByCategory[$matchedSourceCat] = [System.Collections.Generic.List[TaskItem]]::new()
                        $sourceCategoryLookup[$normTargetCat] = $matchedSourceCat
                    }

                    foreach ($targetTask in $targetParsed.TasksByCategory[$targetCategory]) {
                        $key = Get-NormalizedTaskText $targetTask.RawText
                        if (-not $sourceLookup.ContainsKey($key)) {
                            # This is a new task added directly to Target file, add it to Source
                            $sourceParsed.TasksByCategory[$matchedSourceCat].Add($targetTask)
                            $sourceLookup[$key] = $targetTask
                            $addedCount++
                        }
                    }
                }

                # Write back to source file
                $output = [System.Collections.Generic.List[string]]::new()
                foreach ($line in $sourceParsed.HeaderLines) {
                    $output.Add($line)
                }

                # Add instructions
                if ($sourceParsed.InstructionsLines.Count -gt 0) {
                    foreach ($line in $sourceParsed.InstructionsLines) {
                        $output.Add($line)
                    }
                }

                # Add categories and updated tasks
                foreach ($category in $sourceParsed.CategoryOrder) {
                    $output.Add($category)
                    if ($sourceParsed.CategoryHeaders.ContainsKey($category)) {
                        foreach ($hLine in $sourceParsed.CategoryHeaders[$category]) {
                            $output.Add($hLine)
                        }
                    }
                    foreach ($task in $sourceParsed.TasksByCategory[$category]) {
                        $output.Add($task.RawText)
                        foreach ($child in $task.Children) {
                            $output.Add($child)
                        }
                    }
                }

                # Write with collapsed blank lines
                $sb = [System.Text.StringBuilder]::new()
                $lastLineWasBlank = $false
                foreach ($line in $output) {
                    if ($line.Trim() -eq "") {
                        if (-not $lastLineWasBlank) {
                            [void]$sb.AppendLine("")
                            $lastLineWasBlank = $true
                        }
                    } else {
                        [void]$sb.AppendLine($line)
                        $lastLineWasBlank = $false
                    }
                }

                [System.IO.File]::WriteAllText($resolvedSourcePath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Synced $mergedCount completions, $notesCount notes, and added $addedCount new tasks back to $resolvedSourcePath" "Sync"
            }

            "prune" {
                Write-TrackerLog 'act' "Removing completed tasks from $resolvedSourcePath and archiving to $resolvedArchivePath..." "Prune"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Prune"
                    exit 1
                }

                $sourceParsed = Parse-TaskFile $resolvedSourcePath
                $prunedSourceTasks = @{}
                $archivedTasks = @{}

                $prunedCount = 0

                # Separate completed and incomplete tasks
                foreach ($category in $sourceParsed.CategoryOrder) {
                    $prunedSourceTasks[$category] = [System.Collections.Generic.List[TaskItem]]::new()
                    $archivedTasks[$category] = [System.Collections.Generic.List[TaskItem]]::new()

                    foreach ($task in $sourceParsed.TasksByCategory[$category]) {
                        if ($task.IsCompleted -and (Should-PruneTask $task)) {
                            $archivedTasks[$category].Add($task)
                            $prunedCount++
                        } else {
                            $prunedSourceTasks[$category].Add($task)
                        }
                    }
                }

                if ($prunedCount -eq 0) {
                    Write-TrackerLog 'suc' "No completed tasks to prune." "Prune"
                    return
                }

                # Append archived tasks to the archive file
                $archiveSB = [System.Text.StringBuilder]::new()
                if (-not [System.IO.File]::Exists($resolvedArchivePath)) {
                    [void]$archiveSB.AppendLine("# Jekyll Theme RavenUI - Completed and Archived Tasks")
                    [void]$archiveSB.AppendLine("")
                    [void]$archiveSB.AppendLine("This file contains development tasks that have been completed and archived.")
                    [void]$archiveSB.AppendLine("")
                } else {
                    [void]$archiveSB.AppendLine([System.IO.File]::ReadAllText($resolvedArchivePath))
                }

                [void]$archiveSB.AppendLine("## **Archived on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')**")
                [void]$archiveSB.AppendLine("")
                foreach ($category in $sourceParsed.CategoryOrder) {
                    $tasks = $archivedTasks[$category]
                    if ($tasks.Count -gt 0) {
                        [void]$archiveSB.AppendLine($category)
                        if ($sourceParsed.CategoryHeaders.ContainsKey($category)) {
                            foreach ($hLine in $sourceParsed.CategoryHeaders[$category]) {
                                [void]$archiveSB.AppendLine($hLine)
                            }
                        }
                        foreach ($task in $tasks) {
                            [void]$archiveSB.AppendLine($task.RawText)
                            foreach ($child in $task.Children) {
                                [void]$archiveSB.AppendLine($child)
                            }
                        }
                        [void]$archiveSB.AppendLine("")
                    }
                }

                [System.IO.File]::WriteAllText($resolvedArchivePath, $archiveSB.ToString(), [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Appended $prunedCount tasks to archive: $resolvedArchivePath" "Prune"

                # Save updated source file without the completed tasks
                $output = [System.Collections.Generic.List[string]]::new()
                foreach ($line in $sourceParsed.HeaderLines) {
                    $output.Add($line)
                }

                if ($sourceParsed.InstructionsLines.Count -gt 0) {
                    foreach ($line in $sourceParsed.InstructionsLines) {
                        $output.Add($line)
                    }
                }

                foreach ($category in $sourceParsed.CategoryOrder) {
                    $output.Add($category)
                    if ($sourceParsed.CategoryHeaders.ContainsKey($category)) {
                        foreach ($hLine in $sourceParsed.CategoryHeaders[$category]) {
                            $output.Add($hLine)
                        }
                    }
                    foreach ($task in $prunedSourceTasks[$category]) {
                        $output.Add($task.RawText)
                        foreach ($child in $task.Children) {
                            $output.Add($child)
                        }
                    }
                }

                # Write with collapsed blank lines
                $sb = [System.Text.StringBuilder]::new()
                $lastLineWasBlank = $false
                foreach ($line in $output) {
                    if ($line.Trim() -eq "") {
                        if (-not $lastLineWasBlank) {
                            [void]$sb.AppendLine("")
                            $lastLineWasBlank = $true
                        }
                    } else {
                        [void]$sb.AppendLine($line)
                        $lastLineWasBlank = $false
                    }
                }

                [System.IO.File]::WriteAllText($resolvedSourcePath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Pruned $prunedCount completed tasks from $resolvedSourcePath" "Prune"
            }

            "stats" {
                Write-TrackerLog 'act' "Aggregating task statistics..." "Stats"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Stats"
                    exit 1
                }

                $parsed = Parse-TaskFile $resolvedSourcePath
                $totalTasks = 0
                $completedTasks = 0
                $remainingTasks = 0
                
                $remainingByCategory = [System.Collections.Generic.Dictionary[string, int]]::new()
                $emojiCounts = [System.Collections.Generic.Dictionary[string, int]]::new()

                $targetEmojis = @('🔴', '🟠', '🟡', '🟢', '🌟', '🦀', '🪲', '🩹', '💡', '✔️', '❓', '✅', '🌀', '⏳')
                foreach ($emoji in $targetEmojis) {
                    $emojiCounts[$emoji] = 0
                }

                foreach ($category in $parsed.CategoryOrder) {
                    $remainingByCategory[$category] = 0
                    foreach ($task in $parsed.TasksByCategory[$category]) {
                        $totalTasks++
                        if ($task.IsCompleted) {
                            $completedTasks++
                        } else {
                            $remainingTasks++
                            $remainingByCategory[$category]++
                        }

                        foreach ($emoji in $targetEmojis) {
                            if ($task.RawText.Contains($emoji)) {
                                $emojiCounts[$emoji]++
                            }
                        }
                    }
                }

                $completedPercent = if ($totalTasks -gt 0) { [Math]::Round(($completedTasks / $totalTasks) * 100, 1) } else { 0 }
                $remainingPercent = if ($totalTasks -gt 0) { [Math]::Round(($remainingTasks / $totalTasks) * 100, 1) } else { 0 }

                $boldWhite = 15
                $cyan = 81
                $green = 46
                $yellow = 214
                $gray = 244

                $titleText = " ◆ DEVTRACKER TASK METRICS DASHBOARD ◆ "
                $metricsLine = "Total Tasks: $totalTasks  |  Completed: $completedTasks ($completedPercent%)  |  Pending: $remainingTasks ($remainingPercent%)"
                
                # Draw a nice gradient box without screen tearing
                $boxWidth = $metricsLine.Length + 4
                $topLine = "┌" + ("─" * $boxWidth) + "┐"
                $midLine = "├" + ("─" * $boxWidth) + "┤"
                $bottomLine = "└" + ("─" * $boxWidth) + "┘"
                
                $titlePadding = [Math]::Max(0, [int][Math]::Floor(($boxWidth - $titleText.Length) / 2))
                $titlePadded = (" " * $titlePadding) + $titleText + (" " * ($boxWidth - $titleText.Length - $titlePadding))
                
                $steps = @(51, 93, 201)
                
                Write-Host ""
                Write-Host (New-AsciiGradient -Type fg -Steps $steps -String $topLine)
                
                $borderChar = New-AsciiGradient -Type fg -Steps $steps -String "│"
                Write-Host "$borderChar$titlePadded$borderChar"
                
                Write-Host (New-AsciiGradient -Type fg -Steps $steps -String $midLine)
                Write-Host "$borderChar  $metricsLine  $borderChar"
                Write-Host (New-AsciiGradient -Type fg -Steps $steps -String $bottomLine)
                Write-Host ""
                Write-Host (New-AsciiColor -string " 🔹 PENDING TASKS BY CATEGORY:" -color $boldWhite -Format Bold)
                foreach ($category in $parsed.CategoryOrder) {
                    $count = $remainingByCategory[$category]
                    $cleanCategory = $category -replace '^###\s+\*\*', '' -replace '\*\*.*$', ''
                    $cleanCategory = $cleanCategory -replace '\s+\(priority-\d+\)', ''
                    
                    $paddedCat = "{0,-30}" -f $cleanCategory
                    
                    $barWidth = [Math]::Min($count, 30)
                    $bar = "█" * $barWidth
                    $barColor = if ($count -gt 10) { 196 } elseif ($count -gt 5) { 214 } else { 76 }
                    
                    Write-Host "    $paddedCat : " -NoNewline
                    Write-Host (New-AsciiColor -string "$count" -color $cyan -Format Bold) -NoNewline
                    if ($count -gt 0) {
                        Write-Host " " -NoNewline
                        Write-Host (New-AsciiColor -string $bar -color $barColor)
                    } else {
                        Write-Host " (Clean)" -ForegroundColor Gray
                    }
                }

                Write-Host ""
                Write-Host (New-AsciiColor -string " 🔸 TASKS BY EMOJI SIGNAL:" -color $boldWhite -Format Bold)
                
                $emojiDescriptions = @{
                    '🔴' = 'Very High Difficulty'
                    '🟠' = 'Moderate Difficulty'
                    '🟡' = 'Easy Difficulty'
                    '🟢' = 'Very Easy Difficulty'
                    '🌟' = 'Primary Feature'
                    '🦀' = 'Active Bug'
                    '🪲' = 'Resolved Bug'
                    '🩹' = 'Quality Fix'
                    '💡' = 'Concept/Backlog'
                    '✔️' = 'Partially Complete'
                    '❓' = 'Working with Issues'
                    '✅' = 'Verified Complete'
                    '🌀' = 'Work In Progress'
                    '⏳' = 'Pending/Not Started'
                }

                $counter = 0
                foreach ($emoji in $targetEmojis) {
                    $count = $emojiCounts[$emoji]
                    $desc = $emojiDescriptions[$emoji]
                    
                    # Align descriptions and emojis visually using Get-PadRight
                    $leftPart = "    $emoji $desc"
                    $paddedLeft = Get-PadRight -str $leftPart -targetWidth 28
                    
                    $countStr = "{0,-4}" -f $count
                    
                    if ($counter % 2 -eq 0) {
                        Write-Host $paddedLeft -NoNewline
                        Write-Host " : " -NoNewline
                        Write-Host (New-AsciiColor -string $countStr -color $cyan -Format Bold) -NoNewline
                        
                        # Pad the rest of the first column to exactly 38 display columns
                        $currentColWidth = (Get-StringDisplayWidth $paddedLeft) + 3 + (Get-StringDisplayWidth $countStr)
                        $colPaddingNeeded = 38 - $currentColWidth
                        if ($colPaddingNeeded -gt 0) {
                            Write-Host (" " * $colPaddingNeeded) -NoNewline
                        }
                        Write-Host "|  " -NoNewline
                    } else {
                        Write-Host $paddedLeft -NoNewline
                        Write-Host " : " -NoNewline
                        Write-Host (New-AsciiColor -string $countStr -color $cyan -Format Bold)
                    }
                    $counter++
                }
                if ($counter % 2 -ne 0) { Write-Host "" }
                Write-Host ""
            }

            "list" {
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "List"
                    exit 1
                }

                $parsed = Parse-TaskFile $resolvedSourcePath
                
                foreach ($cat in $parsed.CategoryOrder) {
                    if ($Category -and $cat -notmatch [regex]::Escape($Category)) {
                        continue
                    }

                    $tasks = $parsed.TasksByCategory[$cat]
                    $matchingTasks = [System.Collections.Generic.List[TaskItem]]::new()

                    foreach ($task in $tasks) {
                        if ($Difficulty -and -not $task.RawText.Contains((Get-EmojiDifficulty $Difficulty))) { continue }
                        if ($Scope -and -not $task.RawText.Contains((Get-EmojiScope $Scope))) { continue }
                        if ($CompleteStatus) {
                            $statusEmoji = Get-EmojiStatus $CompleteStatus
                            if ($statusEmoji -eq '✅' -or $statusEmoji -eq '✔️' -or $statusEmoji -eq '❓' -or $statusEmoji -eq '🌀' -or $statusEmoji -eq '⏳') {
                                if (-not $task.RawText.Contains($statusEmoji)) { continue }
                            } elseif ($CompleteStatus -eq 'incomplete' -and $task.IsCompleted) {
                                continue
                            } elseif ($CompleteStatus -eq 'complete' -and -not $task.IsCompleted) {
                                continue
                            }
                        }
                        if ($FilterEmoji.Length -gt 0) {
                            $emojiMatch = $false
                            foreach ($e in $FilterEmoji) {
                                if ($task.RawText.Contains($e)) { $emojiMatch = $true; break }
                            }
                            if (-not $emojiMatch) { continue }
                        }
                        
                        $matchingTasks.Add($task)
                    }

                    if ($matchingTasks.Count -gt 0) {
                        $catColored = New-AsciiColor -string $cat -color 226 -Format Bold
                        Write-Host "`n$catColored"
                        
                        foreach ($task in $matchingTasks) {
                            $box = if ($task.IsCompleted) {
                                New-AsciiColor -string "[x]" -color 46 -Format Bold
                            } else {
                                New-AsciiColor -string "[ ]" -color 244
                            }

                            if ($task.RawText -match '^[-*]\s*\[([ xX])\]\s*(?<Prefix>.*?)\*\*(?<CatCode>.*?)\*\*\s*-\s*(?<Desc>.*)$') {
                                $prefix = $Matches['Prefix']
                                $catCode = $Matches['CatCode']
                                $desc = $Matches['Desc']

                                $catCodeColored = New-AsciiColor -string $catCode -color 81 -Format Bold
                                $descColored = New-AsciiColor -string $desc -color 15
                                
                                Write-Host "  - $box $prefix$catCodeColored - $descColored"
                            } else {
                                Write-Host "  $($task.RawText)"
                            }

                            foreach ($child in $task.Children) {
                                if ($child.Trim() -eq "") {
                                    Write-Host ""
                                } else {
                                    $childColored = New-AsciiColor -string $child -color 244
                                    Write-Host "    $childColored"
                                }
                            }
                        }
                    }
                }
                Write-Host ""
            }

            "add" {
                Write-TrackerLog 'act' "Adding task to $resolvedSourcePath..." "Add"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Add"
                    exit 1
                }
                if (-not $TaskText) {
                    Write-TrackerLog 'err' "-TaskText is required to add a task" "Add"
                    exit 1
                }

                $sourceParsed = Parse-TaskFile $resolvedSourcePath
                $matchedCategory = Resolve-SourceCategory -catInput $Category -existingCategories $sourceParsed.CategoryOrder
                
                $taskLineText = Format-TaskLine -text $TaskText -categoryName $matchedCategory -diff $Difficulty -sc $Scope -st $CompleteStatus -pri $Priority -completed $false
                $newTask = [TaskItem]::new($taskLineText, $false, $matchedCategory)

                if (-not $sourceParsed.CategoryOrder.Contains($matchedCategory)) {
                    $sourceParsed.CategoryOrder.Add($matchedCategory)
                    $sourceParsed.TasksByCategory[$matchedCategory] = [System.Collections.Generic.List[TaskItem]]::new()
                }
                $sourceParsed.TasksByCategory[$matchedCategory].Add($newTask)

                # Write back to source file
                $output = [System.Collections.Generic.List[string]]::new()
                foreach ($line in $sourceParsed.HeaderLines) {
                    $output.Add($line)
                }
                if ($sourceParsed.InstructionsLines.Count -gt 0) {
                    foreach ($line in $sourceParsed.InstructionsLines) {
                        $output.Add($line)
                    }
                }
                foreach ($cat in $sourceParsed.CategoryOrder) {
                    $output.Add($cat)
                    if ($sourceParsed.CategoryHeaders.ContainsKey($cat)) {
                        foreach ($hLine in $sourceParsed.CategoryHeaders[$cat]) {
                            $output.Add($hLine)
                        }
                    }
                    foreach ($task in $sourceParsed.TasksByCategory[$cat]) {
                        $output.Add($task.RawText)
                        foreach ($child in $task.Children) {
                            $output.Add($child)
                        }
                    }
                }

                $sb = [System.Text.StringBuilder]::new()
                $lastLineWasBlank = $false
                foreach ($line in $output) {
                    if ($line.Trim() -eq "") {
                        if (-not $lastLineWasBlank) {
                            [void]$sb.AppendLine("")
                            $lastLineWasBlank = $true
                        }
                    } else {
                        [void]$sb.AppendLine($line)
                        $lastLineWasBlank = $false
                    }
                }

                [System.IO.File]::WriteAllText($resolvedSourcePath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Added task under '$matchedCategory': $taskLineText" "Add"
            }

            "remove" {
                Write-TrackerLog 'act' "Removing task from $resolvedSourcePath..." "Remove"
                if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
                    Write-TrackerLog 'err' "Source file not found: $resolvedSourcePath" "Remove"
                    exit 1
                }
                if (-not $TaskKey) {
                    Write-TrackerLog 'err' "-TaskKey is required to remove a task" "Remove"
                    exit 1
                }

                $sourceParsed = Parse-TaskFile $resolvedSourcePath
                $foundTask = $null
                $foundCategory = $null
                $normKey = $TaskKey.Trim().ToLower()

                foreach ($category in $sourceParsed.CategoryOrder) {
                    foreach ($task in $sourceParsed.TasksByCategory[$category]) {
                        $rawLower = $task.RawText.ToLower()
                        if ($rawLower.Contains($normKey) -or (Get-NormalizedTaskText $task.RawText).Contains($normKey)) {
                            $foundTask = $task
                            $foundCategory = $category
                            break
                        }
                    }
                    if ($foundTask -ne $null) { break }
                }

                if ($foundTask -eq $null) {
                    Write-TrackerLog 'err' "No task found matching key '$TaskKey'" "Remove"
                    exit 1
                }

                [void]$sourceParsed.TasksByCategory[$foundCategory].Remove($foundTask)

                # Write back to source file
                $output = [System.Collections.Generic.List[string]]::new()
                foreach ($line in $sourceParsed.HeaderLines) {
                    $output.Add($line)
                }
                if ($sourceParsed.InstructionsLines.Count -gt 0) {
                    foreach ($line in $sourceParsed.InstructionsLines) {
                        $output.Add($line)
                    }
                }
                foreach ($cat in $sourceParsed.CategoryOrder) {
                    $output.Add($cat)
                    if ($sourceParsed.CategoryHeaders.ContainsKey($cat)) {
                        foreach ($hLine in $sourceParsed.CategoryHeaders[$cat]) {
                            $output.Add($hLine)
                        }
                    }
                    foreach ($task in $sourceParsed.TasksByCategory[$cat]) {
                        $output.Add($task.RawText)
                        foreach ($child in $task.Children) {
                            $output.Add($child)
                        }
                    }
                }

                $sb = [System.Text.StringBuilder]::new()
                $lastLineWasBlank = $false
                foreach ($line in $output) {
                    if ($line.Trim() -eq "") {
                        if (-not $lastLineWasBlank) {
                            [void]$sb.AppendLine("")
                            $lastLineWasBlank = $true
                        }
                    } else {
                        [void]$sb.AppendLine($line)
                        $lastLineWasBlank = $false
                    }
                }

                [System.IO.File]::WriteAllText($resolvedSourcePath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Successfully removed task: $($foundTask.RawText)" "Remove"
            }

            "commit" {
                Invoke-GitCommitHelper
            }

            "deploy:build" {
                Write-TrackerLog 'act' "Running local module build..." "Deploy:Build"
                $buildProcess = Start-Process pwsh -ArgumentList "-File", "./automator-devops/localbuilder.ps1", "-Build" -Wait -NoNewWindow -PassThru
                if ($buildProcess.ExitCode -ne 0) {
                    Write-TrackerLog 'err' "Module build failed with exit code $($buildProcess.ExitCode)" "Deploy:Build"
                    return
                }
                Write-TrackerLog 'suc' "Module build completed successfully." "Deploy:Build"

                Write-TrackerLog 'act' "Compiling standalone AppImage..." "Deploy:Build"
                $appimageProcess = Start-Process bash -ArgumentList "./tools/build-appimage.sh" -Wait -NoNewWindow -PassThru
                if ($appimageProcess.ExitCode -ne 0) {
                    Write-TrackerLog 'err' "AppImage compilation failed with exit code $($appimageProcess.ExitCode)" "Deploy:Build"
                    return
                }
                Write-TrackerLog 'suc' "AppImage compiled successfully!" "Deploy:Build"
            }

            "deploy:container" {
                Write-TrackerLog 'act' "Building Docker container matrix..." "Deploy:Container"
                # Check if docker-compose is available
                if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
                    $dockerProcess = Start-Process docker-compose -ArgumentList "build" -Wait -NoNewWindow -PassThru
                } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
                    $dockerProcess = Start-Process docker -ArgumentList "compose", "build" -Wait -NoNewWindow -PassThru
                } else {
                    Write-TrackerLog 'err' "Docker/docker-compose not found on PATH." "Deploy:Container"
                    return
                }

                if ($dockerProcess.ExitCode -ne 0) {
                    Write-TrackerLog 'err' "Docker container build failed with exit code $($dockerProcess.ExitCode)" "Deploy:Container"
                    return
                }
                Write-TrackerLog 'suc' "Docker container matrix built successfully!" "Deploy:Container"
            }

            "changelog" {
                Invoke-GitChangelogHelper
            }

            "diff" {
                Invoke-GitDiffHelper
            }

            "validate" {
                Write-TrackerLog 'act' "Validating tasks format in $resolvedSourcePath..." "Validate"
                $errors = Test-TaskFileFormat $resolvedSourcePath
                $errCount = @($errors).Count
                if ($errCount -gt 0) {
                    Write-TrackerLog 'err' "Found $errCount formatting error(s) in task file:" "Validate"
                    foreach ($err in $errors) {
                        Write-Host "⚠️ $err" -ForegroundColor Red
                    }
                    exit 1
                } else {
                    Write-TrackerLog 'suc' "All tasks format validated successfully!" "Validate"
                }

                # Verify task list sync status
                if ($resolvedSourcePath -ne $resolvedTargetPath) {
                    Write-TrackerLog 'act' "Verifying task list sync status..." "Validate"
                    if (-not [System.IO.File]::Exists($resolvedTargetPath)) {
                        Write-TrackerLog 'err' "Pending task file ($TargetPath) does not exist. Please run: ./devt compile" "Validate"
                        exit 1
                    }
                    $contentCurrent = [System.IO.File]::ReadAllText($resolvedTargetPath, [System.Text.Encoding]::UTF8).Trim()
                    $contentExpected = (Get-CompiledTaskContent -sourcePath $resolvedSourcePath -KeepInstructions $KeepInstructions).Trim()
                    if ($contentCurrent -ne $contentExpected) {
                        Write-TrackerLog 'err' "Task lists are OUT OF SYNC! The compiled pending tasks file ($TargetPath) does not match source ($SourcePath). Please run './devt compile' locally and commit the updated files." "Validate"
                        exit 1
                    } else {
                        Write-TrackerLog 'suc' "Task lists are fully in sync." "Validate"
                    }
                }
            }

            "sync-gitlab" {
                Sync-TasksToGitLab $resolvedSourcePath
            }

            "create-mr" {
                Create-MergeRequestHelper
            }

            "branches" {
                Invoke-GitBranchesHelper
            }

            "gitdiff" {
                Invoke-GitDiffModeHelper -compareBranch $Branch
            }

            "tag" {
                $tagParameters = @{
                    CreateTag = $CreateTag
                    PushTag = $PushTag
                    SkipConfirm = $SkipConfirm
                    Remote = $TagRemote
                }
                if (-not [string]::IsNullOrWhiteSpace($TagRepoPath)) { $tagParameters.RepositoryPath = $TagRepoPath }
                Invoke-SemVerTagHelper @tagParameters
            }

            "projects" {
                $workspaceFile = if ($WorkspacePath) { $WorkspacePath } else { Resolve-RepoPath 'devt.workspace.json' }
                $workspace = Import-DevtWorkspace -Path $workspaceFile
                $projects = @($workspace.components.Values | Sort-Object name)
                if ($AsJson) { $projects | ConvertTo-Json -Depth 8 } else { $projects }
            }

            "graph" {
                $workspaceFile = if ($WorkspacePath) { $WorkspacePath } else { Resolve-RepoPath 'devt.workspace.json' }
                $workspace = Import-DevtWorkspace -Path $workspaceFile
                $graph = Get-DevtProjectGraph -Workspace $workspace
                if ($AsJson) { $graph | ConvertTo-Json -Depth 8 } else { $graph }
            }

            "affected" {
                $workspaceFile = if ($WorkspacePath) { $WorkspacePath } else { Resolve-RepoPath 'devt.workspace.json' }
                $workspace = Import-DevtWorkspace -Path $workspaceFile
                $affected = Get-DevtAffectedComponents -Workspace $workspace -Base $CompareBase -Head $CompareHead
                if ($AsJson) { $affected | ConvertTo-Json -Depth 8 } else { $affected }
            }

            "run-affected" {
                if ([string]::IsNullOrWhiteSpace($Target)) { throw '-Target is required for run-affected.' }
                $workspaceFile = if ($WorkspacePath) { $WorkspacePath } else { Resolve-RepoPath 'devt.workspace.json' }
                $workspace = Import-DevtWorkspace -Path $workspaceFile
                $affected = Get-DevtAffectedComponents -Workspace $workspace -Base $CompareBase -Head $CompareHead
                $plan = Get-DevtAffectedTargetPlan -Workspace $workspace -Affected $affected -Target $Target
                $result = if ($Execute) { Invoke-DevtTargetPlan -Plan $plan -ContinueOnError:$ContinueOnError } else { $plan }
                if ($AsJson) { $result | ConvertTo-Json -Depth 8 } else { $result }
                if ($Execute -and -not $result.succeeded) { throw "Affected target '$Target' failed." }
            }

            "capsule" {
                Invoke-ContextCapsuleHelper
            }

            "git:init-hooks" {
                Write-TrackerLog 'act' "Initializing standard Git hooks..." "GitHooks"
                
                if ($null -eq (Get-Command Initialize-DriftGitHooks -ErrorAction SilentlyContinue)) {
                    $workflowPath = Resolve-RepoPath "src/Drift/runtime/12-git-workflow.ps1"
                    if (Test-Path $workflowPath) {
                        . $workflowPath
                    }
                }
                if ($null -ne (Get-Command Initialize-DriftGitHooks -ErrorAction SilentlyContinue)) {
                    Initialize-DriftGitHooks
                } else {
                    throw "Error: Initialize-DriftGitHooks cmdlet not found. Ensure the Drift module is available."
                }
            }

            "git:stage-feature" {
                Write-TrackerLog 'act' "Executing Stage Feature Workflow..." "StageFeature"
                
                # 1. Validate tasks format
                Write-TrackerLog 'inf' "Step 1: Validating task tracker format..." "StageFeature"
                $errors = Test-TaskFileFormat $resolvedSourcePath
                $errCount = @($errors).Count
                if ($errCount -gt 0) {
                    Write-TrackerLog 'err' "Task tracker validation failed. Please fix task formatting before staging." "StageFeature"
                    foreach ($err in $errors) {
                        Write-Host "⚠️ $err" -ForegroundColor Red
                    }
                    exit 1
                }
                Write-TrackerLog 'suc' "Task tracker validation passed." "StageFeature"
                
                # 2. Run all unit tests
                Write-TrackerLog 'inf' "Step 2: Running all unit tests..." "StageFeature"
                $testResult = Start-Process pwsh -ArgumentList "./Invoke-Tests.ps1" -Wait -NoNewWindow -PassThru
                if ($testResult.ExitCode -ne 0) {
                    Write-TrackerLog 'err' "Unit tests failed. Aborting staging workflow." "StageFeature"
                    exit 1
                }
                Write-TrackerLog 'suc' "All unit tests passed." "StageFeature"
                
                # 3. Compile tasks
                Write-TrackerLog 'inf' "Step 3: Compiling task tracker..." "StageFeature"
                $compiledContent = Get-CompiledTaskContent -sourcePath $resolvedSourcePath -KeepInstructions $KeepInstructions
                [System.IO.File]::WriteAllText($resolvedTargetPath, $compiledContent, [System.Text.UTF8Encoding]::new($false))
                Write-TrackerLog 'suc' "Tasks compiled." "StageFeature"
                
                # 4. Stage and commit changes using Stage-DriftFeature
                Write-TrackerLog 'inf' "Step 4: Running Stage-DriftFeature..." "StageFeature"
                if ($null -eq (Get-Command Stage-DriftFeature -ErrorAction SilentlyContinue)) {
                    $workflowPath = Resolve-RepoPath "src/Drift/runtime/12-git-workflow.ps1"
                    if (Test-Path $workflowPath) {
                        . $workflowPath
                    }
                }
                if ($null -ne (Get-Command Stage-DriftFeature -ErrorAction SilentlyContinue)) {
                    $msg = $Name
                    if (-not $msg) { $msg = $TaskText }
                    if (-not $msg) {
                        $msg = Read-Host "Enter commit message"
                    }
                    if ([string]::IsNullOrWhiteSpace($msg)) {
                        throw "Error: Commit message is required."
                    }
                    Stage-DriftFeature -Message $msg
                } else {
                    throw "Error: Stage-DriftFeature cmdlet not found. Ensure the Drift module is available."
                }
            }

            "help" {
                $boldWhite = 15
                $cyan = 81
                $yellow = 214
                $gray = 244
                $green = 46

                Write-Host ""
                Write-Host (New-AsciiColor -string "DEVT(1)" -color $boldWhite -Format Bold) -NoNewline
                Write-Host "                   Jekyll Theme RavenUI Task Manual" -ForegroundColor Gray -NoNewline
                Write-Host "                   " -NoNewline
                Write-Host (New-AsciiColor -string "DEVT(1)" -color $boldWhite -Format Bold)
                Write-Host "================================================================================"
                Write-Host ""
                Write-Host (New-AsciiColor -string "NAME" -color $boldWhite -Format Bold)
                Write-Host "    devt - Branded task compilation, sync, and lifecycle module."
                Write-Host ""
                Write-Host (New-AsciiColor -string "SYNOPSIS" -color $boldWhite -Format Bold)
                Write-Host "    devt " -NoNewline
                Write-Host (New-AsciiColor -string "-Mode" -color $cyan) -NoNewline
                Write-Host " " -NoNewline
                Write-Host (New-AsciiColor -string "<mode>" -color $yellow) -NoNewline
                Write-Host " [options]" -ForegroundColor Gray
                Write-Host ""
                Write-Host (New-AsciiColor -string "DESCRIPTION" -color $boldWhite -Format Bold)
                Write-Host "    devt manages the tasklist (devtracker-pending.md) designed for the project."
                Write-Host "    This keeps agent parsing speed high and minimizes context token usage."
                Write-Host ""
                Write-Host "    The workflow operates via two main files:"
                Write-Host "        - devtracker-pending.md  : SOT containing all tasks."
                Write-Host "        - devtracker-archive.md  : Permanent storage of pruned tasks."
                Write-Host ""
                Write-Host (New-AsciiColor -string "EXECUTION MODES" -color $boldWhite -Format Bold)
                
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "init" -color $cyan) -NoNewline; Write-Host "     : Prepares a fresh devtracker-pending.md template file."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "compile" -color $cyan) -NoNewline; Write-Host "  : Compiles source tasks into the pending file, excluding completed tasks."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "sync" -color $cyan) -NoNewline; Write-Host "     : Merges completed checkboxes, notes, and new tasks back to source."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "prune" -color $cyan) -NoNewline; Write-Host "    : Moves completed tasks from source into devtracker-archive.md."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "stats" -color $cyan) -NoNewline; Write-Host "    : Renders a terminal metrics dashboard of tasks and emojis."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "list" -color $cyan) -NoNewline; Write-Host "     : Lists tasks in a clean terminal view with optional filters."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "add" -color $cyan) -NoNewline; Write-Host "      : Appends a new formatted task directly to the source tracker."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "remove" -color $cyan) -NoNewline; Write-Host "   : Deletes a task from the source file matching a TaskKey string."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "commit" -color $cyan) -NoNewline; Write-Host "   : Prompts for a conventional commit formatted message and commits."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "diff" -color $cyan) -NoNewline; Write-Host "     : Renders styled summary of staged/unstaged changes."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "validate" -color $cyan) -NoNewline; Write-Host " : Audits devtracker-pending.md format for standard task structures."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "sync-gitlab" -color $cyan) -NoNewline; Write-Host " : Maps and syncs Markdown tasks to GitLab issues and milestones."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "create-mr" -color $cyan) -NoNewline; Write-Host "   : Generates and posts a Draft Merge Request from commit differences."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "branches" -color $cyan) -NoNewline; Write-Host "    : Renders a terminal comparison dashboard of repository branches."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "gitdiff" -color $cyan) -NoNewline; Write-Host "     : Shows structured code differences between the current branch and base/compare branch."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "projects" -color $cyan) -NoNewline; Write-Host "    : Lists validated components from devt.workspace.json."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "graph" -color $cyan) -NoNewline; Write-Host "       : Emits the validated component dependency graph and target inventory."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "affected" -color $cyan) -NoNewline; Write-Host "    : Maps Git changes to components and reverse dependencies."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "run-affected" -color $cyan) -NoNewline; Write-Host " : Plans affected component targets; -Execute opts into execution."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "tag" -color $cyan) -NoNewline; Write-Host "         : Previews, creates, and explicitly pushes a guarded SemVer tag."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "changelog" -color $cyan) -NoNewline; Write-Host "   : Automatically generates CHANGELOG.md from git conventional commit history."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "capsule" -color $cyan) -NoNewline; Write-Host "     : Generates a structured workspace context-capsule.md for AI agents."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "deploy:build" -color $cyan) -NoNewline; Write-Host "  : Compiles module and builds standalone Linux AppImage."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "deploy:container" -color $cyan) -NoNewline; Write-Host "  : Compiles Docker container matrix locally."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "git:init-hooks" -color $cyan) -NoNewline; Write-Host "    : Standardizes and initializes project Git hooks locally."
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "git:stage-feature" -color $cyan) -NoNewline; Write-Host " : Validates tasks, runs tests, compiles tracker, stages and commits changes."
                Write-Host ""
                Write-Host (New-AsciiColor -string "OPTIONS & PARAMETERS" -color $boldWhite -Format Bold)
                Write-Host "    -TaskText <string>          : The description text of the task to add."
                Write-Host "    -Category <string>          : The category or search keyword for adding/filtering."
                Write-Host "    -Difficulty <string>        : difficulty level ('very-easy', 'easy', 'moderate', 'very')."
                Write-Host "    -Scope <string>             : Task scope ('feature', 'bug', 'bug-fixed', 'fix', 'concept')."
                Write-Host "    -Priority <string>          : Numeric priority level ('0' to '10')."
                Write-Host "    -CompleteStatus <string>    : Completion status ('incomplete', 'partially', 'issues', etc.)."
                Write-Host "    -TaskKey <string>           : String query used to identify a task to remove."
                Write-Host "    -Branch <string>            : Target branch to compare against in branch/diff modes."
                Write-Host "    -CreateTag                  : Creates the validated annotated tag locally."
                Write-Host "    -PushTag                    : Pushes the created tag to -TagRemote. Requires -CreateTag."
                Write-Host "    -SkipConfirm                : Bypasses the tag creation and push confirmation prompt."
                Write-Host "    -TagRemote <string>         : Git remote used by -PushTag. Default: origin."
                Write-Host "    -WorkspacePath <string>     : Optional devt workspace manifest path."
                Write-Host "    -CompareBase <string>       : Base revision for affected calculation."
                Write-Host "    -CompareHead <string>       : Head revision or WORKTREE. Default: WORKTREE."
                Write-Host "    -AsJson                     : Emits machine-readable project or affected output."
                Write-Host "    -Target <string>            : Declarative component target used by run-affected."
                Write-Host "    -Execute                    : Executes a run-affected plan; omitted means dry-run."
                Write-Host "    -ContinueOnError            : Continues remaining target steps after a failure."
                Write-Host "    -IncludeCompleted           : Force compiled output to keep completed tasks."
                Write-Host "    -KeepCompletedWithEmoji     : Keep completed tasks with these emojis in compile/prune."
                Write-Host "    -ExcludeCompletedWithEmoji  : Exclude completed tasks with these emojis in compile/prune."
                Write-Host ""
                Write-Host (New-AsciiColor -string "EXAMPLES" -color $boldWhite -Format Bold)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode compile" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode stats" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode add -TaskText 'Test hook' -Category 'Features' -Difficulty 'easy' -Scope 'feature' -Priority '3'" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode list -Difficulty 'very' -Scope 'bug'" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode remove -TaskKey 'Test hook'" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode branches" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode gitdiff -Branch develop" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode projects" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode affected -CompareBase develop -AsJson" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode tag -CreateTag -PushTag -SkipConfirm" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode capsule" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode git:init-hooks" -color $green)
                Write-Host "    " -NoNewline; Write-Host (New-AsciiColor -string "devt -Mode git:stage-feature" -color $green)
                Write-Host ""
                Write-Host "================================================================================"
                Write-Host ""
            }
        }
    }
}
