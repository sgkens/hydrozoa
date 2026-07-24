# RavenUI Task Tracker - Private Helper Functions

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Task Item Class definition
class TaskItem {
    [string]$RawText
    [bool]$IsCompleted
    [System.Collections.Generic.List[string]]$Children
    [string]$Category

    TaskItem([string]$rawText, [bool]$isCompleted, [string]$category) {
        $this.RawText = $rawText
        $this.IsCompleted = $isCompleted
        $this.Children = [System.Collections.Generic.List[string]]::new()
        $this.Category = $category
    }
}

# Find repository root dynamically (walk up to find .git folder, or fallback to three levels up)
$gitRoot = $null
$currentDir = [System.IO.DirectoryInfo]::new($PSScriptRoot)
while ($currentDir -ne $null) {
    $gitDir = [System.IO.Path]::Combine($currentDir.FullName, ".git")
    if ([System.IO.Directory]::Exists($gitDir) -or [System.IO.File]::Exists($gitDir)) {
        $gitRoot = $currentDir.FullName
        break
    }
    $currentDir = $currentDir.Parent
}
if ($null -eq $gitRoot) {
    $gitRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, "..", "..", ".."))
}
$script:repoRoot = $gitRoot


# Resolve paths relative to the repository root
function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) {
        return $path
    }
    return [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($script:repoRoot, $path))
}

# Logger interface wrapping Write-LazyLog
function Write-TrackerLog([string]$level, [string]$message, [string]$context) {
    $global:__logging = $true
    Write-LazyLog -Level $level -Message $message -Title "DevTracker" -Context $context
}

# Emoji resolvers and standard mappings
function Get-EmojiDifficulty([string]$diff) {
    switch ($diff) {
        'very-easy' { return '🟢' }
        'easy'      { return '🟡' }
        'moderate'  { return '🟠' }
        'very'      { return '🔴' }
        default     { return $diff }
    }
}

function Get-EmojiScope([string]$sc) {
    switch ($sc) {
        'concept'   { return '💡' }
        'feature'   { return '🌟' }
        'bug'       { return '🦀' }
        'bug-fixed' { return '🪲' }
        'fix'       { return '🩹' }
        default     { return $sc }
    }
}

function Get-EmojiPriority([string]$pri) {
    switch ($pri) {
        '0' { return '0️⃣' }
        '1' { return '1️⃣' }
        '2' { return '2️⃣' }
        '3' { return '3️⃣' }
        '4' { return '4️⃣' }
        '5' { return '5️⃣' }
        '6' { return '6️⃣' }
        '7' { return '7️⃣' }
        '8' { return '8️⃣' }
        '9' { return '9️⃣' }
        '10' { return '🔟' }
        default { return $pri }
    }
}

function Get-EmojiStatus([string]$st) {
    switch ($st) {
        'partially' { return '✔️' }
        'issues'    { return '❓' }
        'complete'  { return '✅' }
        'working'   { return '🌀' }
        'pending'   { return '⏳' }
        'incomplete'{ return '⏳' }
        default     { return $st }
    }
}

function Format-TaskLine([string]$text, [string]$categoryName, [string]$diff, [string]$sc, [string]$st, [string]$pri, [bool]$completed) {
    $diffEmoji = if ($diff) { Get-EmojiDifficulty $diff } else { "" }
    $scopeEmoji = if ($sc) { Get-EmojiScope $sc } else { "" }
    $statusEmoji = if ($st) { Get-EmojiStatus $st } else { "" }
    $priEmoji = if ($pri) { Get-EmojiPriority $pri } else { "" }

    $check = if ($completed) { "x" } else { " " }
    
    $prefix = "$diffEmoji$scopeEmoji$statusEmoji$priEmoji"
    if ($prefix -ne "") {
        $prefix = "$prefix "
    }

    # Extract clean category code
    $shortCat = $categoryName -replace '^###\s+\*\*', '' -replace '\*\*.*$', ''
    $shortCat = $shortCat -replace '\s+\(priority-\d+\)', ''
    
    switch ($shortCat.ToLower()) {
        'issues remaining'     { $catCode = 'Critical' }
        'critical path'        { $catCode = 'Critical' }
        'enhancements'         { $catCode = 'Enhancement' }
        'active enhancements'  { $catCode = 'Enhancement' }
        'features'             { $catCode = 'Feature' }
        'feature development'  { $catCode = 'Feature' }
        'bug fixes'            { $catCode = 'BugFix' }
        'refactoring'          { $catCode = 'Refactor' }
        'refactoring & qol'    { $catCode = 'Refactor' }
        'documentation'        { $catCode = 'Docs' }
        'documentation & docs' { $catCode = 'Docs' }
        'refine features'      { $catCode = 'Refine' }
        'refine documentation' { $catCode = 'Audit' }
        default                { $catCode = $shortCat }
    }

    return "- [$check] $prefix**$catCode** - $text"
}

# Normalize task description text for lookups
function Get-NormalizedTaskText([string]$text) {
    # Remove checkbox
    $text = $text -replace '^[-*]\s*\[[ xX]\]\s*', ''
    # Remove prefix emojis and symbols
    $text = $text -replace '[🟢🔴🟡🟠🟩🟥🟧🪲🌀❓✅✔️💡🌟🦀🩹0-9🔟⏳️]', ''
    # Remove markdown bold/italic tags
    $text = $text -replace '\*+', ''
    $text = $text -replace '_+', ''
    $text = $text -replace '`+', ''
    # Trim and normalize spaces
    $text = $text.Trim() -replace '\s+', ' '
    return $text.ToLower()
}

# Normalize category headings for lookups
function Get-NormalizedCategoryName([string]$cat) {
    $cat = $cat -replace '\*+', ''
    $cat = $cat -replace '_+', ''
    return $cat.Trim().ToLower()
}

# Parse a markdown task file using stateful streaming
function Parse-TaskFile([string]$filePath) {
    if (-not [System.IO.File]::Exists($filePath)) {
        throw "File not found: $filePath"
    }

    $lines = [System.IO.File]::ReadAllLines($filePath)
    
    $parsed = @{
        HeaderLines = [System.Collections.Generic.List[string]]::new()
        CategoryOrder = [System.Collections.Generic.List[string]]::new()
        TasksByCategory = @{} # Dict of string -> List[TaskItem]
        CategoryHeaders = @{} # Dict of string -> List[string]
        InstructionsLines = [System.Collections.Generic.List[string]]::new()
    }

    $inInstructions = $false
    $separatorCount = 0
    $currentCategory = ""
    $currentTask = $null
    $inTasklist = $false

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]

        # Handle instructions block bounded by ---
        if (-not $inTasklist -and $line -eq "---") {
            $separatorCount++
            if ($separatorCount -eq 1) {
                $inInstructions = $true
                $parsed.InstructionsLines.Add($line)
                continue
            } elseif ($separatorCount -eq 2) {
                $inInstructions = $false
                $parsed.InstructionsLines.Add($line)
                continue
            }
        }

        # Ignore horizontal rules inside tasklist
        if ($inTasklist -and $line -eq "---") {
            continue
        }

        if ($inInstructions) {
            $parsed.InstructionsLines.Add($line)
            continue
        }

        # Check for category headings
        if ($line -match "^##\s+\*\*Tasklist\*\*") {
            $inTasklist = $true
            $parsed.HeaderLines.Add($line)
            continue
        }

        if ($inTasklist -and $line -match "^##+\s+(.*)$") {
            $currentCategory = $line
            if (-not $parsed.CategoryOrder.Contains($currentCategory)) {
                $parsed.CategoryOrder.Add($currentCategory)
                $parsed.TasksByCategory[$currentCategory] = [System.Collections.Generic.List[TaskItem]]::new()
                $parsed.CategoryHeaders[$currentCategory] = [System.Collections.Generic.List[string]]::new()
            }
            $currentTask = $null
            continue
        }

        # Check for a task line
        if ($line -match "^([-*])\s*\[([ xX])\]\s*(.*)$") {
            $checkChar = $Matches[2]
            $isCompleted = ($checkChar -eq 'x' -or $checkChar -eq 'X')

            $currentTask = [TaskItem]::new($line, $isCompleted, $currentCategory)
            
            if ($currentCategory -eq "") {
                $currentCategory = "### **Uncategorized**"
                if (-not $parsed.CategoryOrder.Contains($currentCategory)) {
                    $parsed.CategoryOrder.Add($currentCategory)
                    $parsed.TasksByCategory[$currentCategory] = [System.Collections.Generic.List[TaskItem]]::new()
                    $parsed.CategoryHeaders[$currentCategory] = [System.Collections.Generic.List[string]]::new()
                }
            }
            $parsed.TasksByCategory[$currentCategory].Add($currentTask)
            continue
        }

        # Handle child lines (indented, note blocks, or blank separator lines)
        if ($currentTask -ne $null -and ($line -match "^\s+" -or $line -match "^>\s*" -or $line -eq "")) {
            $currentTask.Children.Add($line)
            continue
        }

        # Top-level non-task lines before categories are headers
        if ($currentCategory -eq "") {
            $parsed.HeaderLines.Add($line)
        } else {
            if (-not $parsed.CategoryHeaders.ContainsKey($currentCategory)) {
                $parsed.CategoryHeaders[$currentCategory] = [System.Collections.Generic.List[string]]::new()
            }
            $parsed.CategoryHeaders[$currentCategory].Add($line)
        }
    }

    return $parsed
}

# Helper to determine if a task should be kept based on filters
function Should-KeepTask([TaskItem]$task) {
    if ($task.IsCompleted) {
        $keep = -not $script:shouldExcludeCompleted

        foreach ($emoji in $script:KeepCompletedWithEmoji) {
            if ($task.RawText.Contains($emoji)) {
                $keep = $true
                break
            }
        }

        foreach ($emoji in $script:ExcludeCompletedWithEmoji) {
            if ($task.RawText.Contains($emoji)) {
                $keep = $false
                break
            }
        }
    } else {
        $keep = $true
    }

    if ($keep -and $script:FilterEmoji.Length -gt 0) {
        $found = $false
        foreach ($emoji in $script:FilterEmoji) {
            if ($task.RawText.Contains($emoji)) {
                $found = $true
                break
            }
        }
        if (-not $found) {
            $keep = $false
        }
    }

    if ($keep -and $script:ExcludeEmoji.Length -gt 0) {
        foreach ($emoji in $script:ExcludeEmoji) {
            if ($task.RawText.Contains($emoji)) {
                $keep = $false
                break
            }
        }
    }

    return $keep
}

# Helper to determine if a completed task should be pruned
function Should-PruneTask([TaskItem]$task) {
    if (-not $task.IsCompleted) {
        return $false
    }

    $prune = $true

    foreach ($emoji in $script:KeepCompletedWithEmoji) {
        if ($task.RawText.Contains($emoji)) {
            $prune = $false
            break
        }
    }

    foreach ($emoji in $script:ExcludeCompletedWithEmoji) {
        if ($task.RawText.Contains($emoji)) {
            $prune = $true
            break
        }
    }

    return $prune
}

# Helper to resolve CLI category inputs into full category strings
function Resolve-SourceCategory([string]$catInput, [System.Collections.IList]$existingCategories) {
    if (-not $catInput) {
        return "### **Backlog**"
    }
    
    $normInput = Get-NormalizedCategoryName $catInput
    
    # Exact match
    foreach ($cat in $existingCategories) {
        if ((Get-NormalizedCategoryName $cat) -eq $normInput) {
            return $cat
        }
    }

    # Partial match
    foreach ($cat in $existingCategories) {
        if ((Get-NormalizedCategoryName $cat).Contains($normInput)) {
            return $cat
        }
    }

    # Prefix mapping
    switch ($normInput) {
        'bug' { $target = 'bug fixes' }
        'feature' { $target = 'features' }
        'enhancement' { $target = 'enhancements' }
        'doc' { $target = 'documentation' }
        'refactor' { $target = 'refactoring' }
        'issue' { $target = 'issues remaining' }
        default { $target = $normInput }
    }
    foreach ($cat in $existingCategories) {
        if ((Get-NormalizedCategoryName $cat).Contains($target)) {
            return $cat
        }
    }

    # Dynamic creation
    return "### **$catInput**"
}

# Validate format of all tasks in the source file
function Test-TaskFileFormat([string]$filePath) {
    if (-not [System.IO.File]::Exists($filePath)) {
        throw "File not found: $filePath"
    }

    $lines = [System.IO.File]::ReadAllLines($filePath)
    $errors = [System.Collections.Generic.List[string]]::new()
    
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        $lineNum = $i + 1
        
        # Check if it looks like a task line and has difficulty emojis
        if ($line -match "^[-*]\s*\[([ xX])\]" -and $line -match "(🟢|🔴|🟡|🟠)") {
            # Standard task pattern:
            # - [ ] <difficulty-emoji><scope-emoji>[optional status][optional priority] **CategoryCode** - Description
            $pattern = '^[-*]\s*\[([ xX])\]\s*(?:(?:🟢|🔴|🟡|🟠)\s*(?:💡|🌟|🦀|🪲|🩹)\s*(?:✔️|❓|✅|🌀|⏳)?\s*(?:0️⃣|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟)?)\s*\*\*(.*?)\*\*\s*-\s*(.*)$'
            
            if ($line -notmatch $pattern) {
                # Determine what is missing or wrong
                $reason = "Format mismatch"
                if ($line -notmatch '\*\*(.*?)\*\*') {
                    $reason = "Missing bold category name: e.g. **CategoryCode**"
                } elseif ($line -notmatch '\s+-\s+') {
                    $reason = "Missing description separator ' - '"
                } elseif ($line -notmatch '(🟢|🔴|🟡|🟠)') {
                    $reason = "Missing or invalid difficulty emoji (🟢, 🔴, 🟡, 🟠)"
                } elseif ($line -notmatch '(💡|🌟|🦀|🪲|🩹)') {
                    $reason = "Missing or invalid scope emoji (💡, 🌟, 🦀, 🪲, 🩹)"
                }
                
                $errors.Add("Line $($lineNum): $($reason)`n  Raw: $($line)")
            }
        }
    }
    
    return $errors
}

# Get display width of a string taking into account emojis, CJK, variation selectors, etc.
function Get-StringDisplayWidth([string]$str) {
    if ($null -eq $str) { return 0 }
    $width = 0
    $i = 0
    while ($i -lt $str.Length) {
        $code = [char]::ConvertToUtf32($str, $i)
        
        if ([char]::IsSurrogatePair($str, $i)) {
            # Beetle emoji (🪲, U+1FABC) renders as single-width in some terminal environments
            if ($code -eq 0x1FABC) {
                $width += 1
            } else {
                $width += 2
            }
            $i += 2
        } else {
            # Check for BMP emojis and double-width symbols (e.g. U+2600 to U+27BF)
            if ($code -ge 0x2600 -and $code -le 0x27BF) {
                $width += 2
            }
            elseif ($code -eq 0xFE0F) {
                # Variation selector has 0 width
            }
            else {
                $width += 1
            }
            $i++
        }
    }
    return $width
}

# Pad a string to the right with spaces based on its visual display width instead of character length
function Get-PadRight([string]$str, [int]$targetWidth) {
    $currentWidth = Get-StringDisplayWidth $str
    $needed = $targetWidth - $currentWidth
    if ($needed -le 0) { return $str }
    return $str + (" " * $needed)
}

# Formats a single row for TUI tables with border alignment
function Format-TuiRow {
    param (
        [string[]]$Columns,
        [int[]]$Widths,
        [int[]]$Colors,
        [string]$BorderChar = "│",
        [int]$BoxWidth = 90
    )
    $plain = ""
    for ($i = 0; $i -lt $Columns.Count; $i++) {
        $val = $Columns[$i]
        $w = $Widths[$i]
        $plain += (Get-PadRight -str $val -targetWidth $w)
        if ($i -lt $Columns.Count - 1) {
            $plain += " "
        }
    }
    $plainWidth = Get-StringDisplayWidth $plain
    $padding = $BoxWidth - $plainWidth

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.Append($BorderChar)
    for ($i = 0; $i -lt $Columns.Count; $i++) {
        $val = $Columns[$i]
        $w = $Widths[$i]
        $col = $Colors[$i]
        
        $paddedVal = Get-PadRight -str $val -targetWidth $w
        $coloredVal = New-AsciiColor -string $paddedVal -color $col
        [void]$sb.Append($coloredVal)
        if ($i -lt $Columns.Count - 1) {
            [void]$sb.Append(" ")
        }
    }
    
    if ($padding -gt 0) {
        [void]$sb.Append(" " * $padding)
    }
    [void]$sb.Append($BorderChar)
    return $sb.ToString()
}

# Compile source task file content in memory
function Get-CompiledTaskContent([string]$sourcePath, [bool]$KeepInstructions) {
    if (-not [System.IO.File]::Exists($sourcePath)) {
        return ""
    }
    
    $parsed = Parse-TaskFile $sourcePath
    $output = [System.Collections.Generic.List[string]]::new()

    # Add headers
    foreach ($line in $parsed.HeaderLines) {
        $output.Add($line)
    }

    # Add instructions if kept
    if ($KeepInstructions -and $parsed.InstructionsLines.Count -gt 0) {
        $output.Add("---")
        foreach ($line in $parsed.InstructionsLines) {
            if ($line -ne "---") {
                $output.Add($line)
            }
        }
        $output.Add("---")
    }

    # Add categories and their tasks
    foreach ($category in $parsed.CategoryOrder) {
        $tasks = $parsed.TasksByCategory[$category]
        $filteredTasks = [System.Collections.Generic.List[TaskItem]]::new()
        foreach ($task in $tasks) {
            if (Should-KeepTask $task) {
                $filteredTasks.Add($task)
            }
        }

        $output.Add($category)

        if ($parsed.CategoryHeaders.ContainsKey($category)) {
            foreach ($hLine in $parsed.CategoryHeaders[$category]) {
                $output.Add($hLine)
            }
        }

        foreach ($task in $filteredTasks) {
            $output.Add($task.RawText)
            foreach ($child in $task.Children) {
                $output.Add($child)
            }
        }
    }

    # Format and collapse consecutive blank lines
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
    return $sb.ToString()
}


