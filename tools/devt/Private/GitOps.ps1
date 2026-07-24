# RavenUI Task Tracker - Private Git Operations Helper

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NextSemVer([string]$currentVersion, [string]$incrementType) {
    if ($currentVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
        [int]$major = $Matches[1]
        [int]$minor = $Matches[2]
        [int]$patch = $Matches[3]
        switch ($incrementType) {
            'major' { $major++; $minor = 0; $patch = 0 }
            'minor' { $minor++; $patch = 0 }
            'patch' { $patch++ }
        }
        return "$major.$minor.$patch"
    }
    return $currentVersion
}

function Get-ProjectedCommitVersion([PSCustomObject]$versionResult, [string]$requestedIncrement) {
    if ($requestedIncrement -eq 'none') { return 'none' }
    $rank = @{ none = 0; patch = 1; minor = 2; major = 3 }
    $effectiveIncrement = $requestedIncrement
    if ($rank.ContainsKey([string]$versionResult.BumpType) -and $rank[[string]$versionResult.BumpType] -gt $rank[$requestedIncrement]) {
        $effectiveIncrement = [string]$versionResult.BumpType
    }
    $baseVersion = [string]$versionResult.Version
    if ([string]$versionResult.LastTag -match '^v?(\d+\.\d+\.\d+)') { $baseVersion = $Matches[1] }
    Get-NextSemVer $baseVersion $effectiveIncrement
}

function Get-GitStagedClosedIssues {
    $closedIssues = [System.Collections.Generic.List[int]]::new()
    try {
        $sourceFile = Resolve-RepoPath "devtracker-pending.md"
        if (-not [System.IO.File]::Exists($sourceFile)) { return $closedIssues }
        
        $diffLines = @(git diff --cached $sourceFile 2>$null)
        foreach ($line in $diffLines) {
            # Match added completed task line: e.g. "+- [x] 🟡🌟 **Category** - Desc [#62](...)"
            if ($line -match '^\+\s*[-*]\s*\[[xX]\]\s*(?:[🟢🔴🟡🟠🟩🟥🟧🪲🌀❓✅✔️💡🌟🦀🩹0-9️⃣🔟⏳\s]+)?\*\*(.*?)\*\*\s*-\s*(.*?)(?:\s+(?:#\d+|\[#(\d+)\]\(.*?\)))?$') {
                if ($Matches.ContainsKey(3)) {
                    $iid = [int]$Matches[3]
                    if (-not $closedIssues.Contains($iid)) {
                        $closedIssues.Add($iid)
                    }
                }
            }
        }
    } catch {
        # Ignore diff errors
    }
    return $closedIssues
}

function Invoke-GitCommitHelper {
    Write-TrackerLog 'act' "Starting Conventional Commit prompt..." "Commit"
    
    # 1. Select Type
    $types = @('feat', 'fix', 'refactor', 'docs', 'chore', 'build', 'style', 'ci', 'test')
    Write-Host "`nSelect commit type:" -ForegroundColor Gray
    for ($i = 0; $i -lt $types.Count; $i++) {
        Write-Host "  [$i] $($types[$i])" -ForegroundColor Cyan
    }
    $typeIndexInput = Read-Host "Choice [0]"
    $typeIndex = 0
    if ($typeIndexInput -match '^\d+$' -and [int]$typeIndexInput -lt $types.Count) {
        $typeIndex = [int]$typeIndexInput
    }
    $type = $types[$typeIndex]

    # 2. Scope
    $scope = (Read-Host "Enter scope (e.g. CLI/MultiTheme, Refactoring/Sass) [optional]").Trim()

    # 3. Summary
    $summary = ""
    while ($summary -eq "") {
        $summary = (Read-Host "Enter short summary (max 72 chars) [mandatory]").Trim()
    }

    # 4. Version Increment
    $increments = @('patch', 'minor', 'major', 'none')
    Write-Host "`nSelect build version increment type:" -ForegroundColor Gray
    for ($i = 0; $i -lt $increments.Count; $i++) {
        Write-Host "  [$i] $($increments[$i])" -ForegroundColor Cyan
    }
    $incIndexInput = Read-Host "Choice [0]"
    $incIndex = 0
    if ($incIndexInput -match '^\d+$' -and [int]$incIndexInput -lt $increments.Count) {
        $incIndex = [int]$incIndexInput
    }
    $increment = $increments[$incIndex]

    # Calculate new version if increment is not 'none'
    $versionLine = ""
    if ($increment -ne 'none') {
        # Resolve Get-ConventionalCommitVersion
        $currentVer = "0.1.0"
        $autoVerObj = $null
        if (Get-Command Get-ConventionalCommitVersion -ErrorAction SilentlyContinue) {
            $autoVerObj = Get-ConventionalCommitVersion
            $currentVer = $autoVerObj.Version
        } else {
            # Try to resolve relative to PSScriptRoot
            $localScript = [System.IO.Path]::Combine($PSScriptRoot, "Get-ConventionalCommitVersion.ps1")
            if (-not [System.IO.File]::Exists($localScript)) {
                $localScript = [System.IO.Path]::Combine($PSScriptRoot, "Private", "Get-ConventionalCommitVersion.ps1")
            }
            if (-not [System.IO.File]::Exists($localScript)) {
                # Fallback to global locations
                $localScript = "/home/gsnow/.gemini/antigravity-cli/scripts/pwsh/Get-ConventionalCommitVersion.ps1"
                if (-not [System.IO.File]::Exists($localScript)) {
                    $localScript = "/home/gsnow/.gemini/config/skills/fluent-ui-v1/resources/Get-ConventionalCommitVersion.ps1"
                }
            }

            if ([System.IO.File]::Exists($localScript)) {
                . $localScript
                $autoVerObj = Get-ConventionalCommitVersion
                $currentVer = $autoVerObj.Version
            } else {
                # Fallback to local VERSION file
                $resolvedVerFile = Resolve-RepoPath "VERSION"
                if ([System.IO.File]::Exists($resolvedVerFile)) {
                    $currentVer = ([System.IO.File]::ReadAllText($resolvedVerFile)).Trim()
                }
            }
        }

        $nextVer = if ($null -ne $autoVerObj) {
            Get-ProjectedCommitVersion -versionResult $autoVerObj -requestedIncrement $increment
        } else {
            Get-NextSemVer $currentVer $increment
        }
        $versionLine = "build: [$nextVer]`nBuild: $increment"
        Write-TrackerLog 'inf' "Incrementing version from $currentVer to $nextVer ($increment)" "Commit"
    } else {
        $versionLine = "build: [none]"
    }

    # 5. Notes
    Write-Host "`nEnter commit Notes (type '.' or press Enter on empty line to finish):" -ForegroundColor Gray
    $notesList = [System.Collections.Generic.List[string]]::new()
    while ($true) {
        $note = (Read-Host "- ").Trim()
        if ($note -eq "" -or $note -eq ".") { break }
        $notesList.Add("- $note")
    }
    $notesBlock = if ($notesList.Count -gt 0) { $notesList -join "`n" } else { "- None" }

    # 6. Feature Additions
    Write-Host "`nEnter Feature Additions (type '.' or press Enter on empty line to finish):" -ForegroundColor Gray
    $featsList = [System.Collections.Generic.List[string]]::new()
    while ($true) {
        $feat = (Read-Host "- ").Trim()
        if ($feat -eq "" -or $feat -eq ".") { break }
        $featsList.Add("- $feat")
    }
    $featsBlock = if ($featsList.Count -gt 0) { $featsList -join "`n" } else { "- None" }

    # 7. Bug Fixes
    Write-Host "`nEnter Bug Fixes (type '.' or press Enter on empty line to finish):" -ForegroundColor Gray
    $bugsList = [System.Collections.Generic.List[string]]::new()
    while ($true) {
        $bug = (Read-Host "- ").Trim()
        if ($bug -eq "" -or $bug -eq ".") { break }
        $bugsList.Add("- $bug")
    }
    $bugsBlock = if ($bugsList.Count -gt 0) { $bugsList -join "`n" } else { "- None" }

    $stagedClosed = @(Get-GitStagedClosedIssues)
    $closingBlock = ""
    if ($stagedClosed.Count -gt 0) {
        $issueList = foreach ($issue in $stagedClosed) { "closes #$issue" }
        $closingBlock = $issueList -join "`n"
    }

    # Build commit message
    $scopeStr = if ($scope) { "($scope)" } else { "" }
    $header = "$($type)$($scopeStr): $summary"
    
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine($header)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($versionLine)
    if ($closingBlock) {
        [void]$sb.AppendLine($closingBlock)
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("Notes:")
    [void]$sb.AppendLine($notesBlock)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("Feature Additions:")
    [void]$sb.AppendLine($featsBlock)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("Bug Fixes:")
    [void]$sb.AppendLine($bugsBlock)

    $commitMessage = $sb.ToString().Trim()

    Write-Host "`n================================================================================" -ForegroundColor Gray
    Write-Host $commitMessage -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Gray

    $confirm = Read-Host "Do you want to run: git commit -m (staged changes only)? [y/N]"
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        # Create temp file to avoid command line parsing issues with quotes/newlines
        $tempFile = [System.IO.Path]::GetTempFileName()
        [System.IO.File]::WriteAllText($tempFile, $commitMessage, [System.Text.UTF8Encoding]::new($false))
        
        try {
            git commit -F $tempFile
            Write-TrackerLog 'suc' "Commit successful!" "Commit"
        }
        catch {
            Write-TrackerLog 'err' "Commit failed: $_" "Commit"
        }
        finally {
            if ([System.IO.File]::Exists($tempFile)) {
                [System.IO.File]::Delete($tempFile)
            }
        }
    } else {
        Write-TrackerLog 'wrn' "Commit aborted." "Commit"
    }
}

function Invoke-GitDiffHelper {
    Write-TrackerLog 'act' "Showing repository diff status..." "Diff"
    Write-Host "`nStaged Files:" -ForegroundColor Green
    git diff --cached --name-status
    
    Write-Host "`nUnstaged Files:" -ForegroundColor Red
    foreach ($line in (git status -s)) {
        if ($line -notmatch '^M|^A|^D') {
            Write-Host $line
        }
    }
    
    Write-Host "`nStaged Diff Summary:" -ForegroundColor Green
    git diff --cached --stat
    
    Write-Host "`nUnstaged Diff Summary:" -ForegroundColor Red
    git diff --stat
}

function Invoke-GitBranchesHelper {
    Write-TrackerLog 'act' "Analyzing repository branch status..." "Branches"
    
    # Determine base branch
    $baseBranch = "develop"
    $hasDevelop = git branch --list "develop"
    if (-not $hasDevelop) {
        $baseBranch = "main"
        $hasMain = git branch --list "main"
        if (-not $hasMain) {
            $baseBranch = "master"
        }
    }
    
    # Get current branch
    $currentBranch = (git branch --show-current).Trim()
    
    # Get all local branches
    $branches = @(git for-each-ref --format='%(refname:short)' refs/heads/)
    if ($null -eq $branches -or $branches.Count -eq 0) {
        Write-TrackerLog 'wrn' "No local branches found." "Branches"
        return
    }

    # Calculate max branch name length dynamically (minimum 25)
    $maxBranchLen = 25
    foreach ($b in $branches) {
        $len = Get-StringDisplayWidth $b
        if ($len -gt $maxBranchLen) {
            $maxBranchLen = $len
        }
    }

    # Dynamic TUI Box width calculation
    # columns: currFlag(3) + branchName(maxBranchLen) + spaces(3) + lastActive(16) + diffText(14) + lastCommitMsg(28)
    $boxWidth = 3 + $maxBranchLen + 1 + 16 + 1 + 14 + 1 + 28

    # Parallelize git calls using a RunspacePool for extreme performance
    $sessionState = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
    $pool = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspacePool(1, 8, $sessionState, $Host)
    $pool.Open()
    
    $jobs = [System.Collections.Generic.List[PSCustomObject]]::new()
    
    foreach ($b in $branches) {
        $powershell = [PowerShell]::Create().AddScript({
            param($b, $baseBranch)
            $lastCommitTime = (git log -1 --format="%cr" $b 2>$null)
            $lastCommitTime = if ($lastCommitTime) { $lastCommitTime.Trim() } else { "Unknown" }
            
            $lastCommitMsg = (git log -1 --format="%s" $b 2>$null)
            $lastCommitMsg = if ($lastCommitMsg) { $lastCommitMsg.Trim() } else { "No message" }
            
            $ahead = 0
            $behind = 0
            if ($b -ne $baseBranch) {
                $aheadStr = (git rev-list --count "$baseBranch..$b" 2>$null)
                $behindStr = (git rev-list --count "$b..$baseBranch" 2>$null)
                if ($aheadStr -and $aheadStr.Trim() -match '^\d+$') { $ahead = [int]($aheadStr.Trim()) }
                if ($behindStr -and $behindStr.Trim() -match '^\d+$') { $behind = [int]($behindStr.Trim()) }
            }
            
            return [PSCustomObject]@{
                Branch = $b
                LastCommitTime = $lastCommitTime
                LastCommitMsg = $lastCommitMsg
                Ahead = $ahead
                Behind = $behind
            }
        }).AddArgument($b).AddArgument($baseBranch)
        
        $powershell.RunspacePool = $pool
        $handle = $powershell.BeginInvoke()
        
        $jobs.Add([PSCustomObject]@{
            PowerShell = $powershell
            Handle = $handle
        })
    }
    
    # Gather parallel results
    $branchMetadataList = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($job in $jobs) {
        $res = $job.PowerShell.EndInvoke($job.Handle)
        $branchMetadataList.Add($res)
        $job.PowerShell.Dispose()
    }
    $pool.Close()
    
    $boldWhite = 15
    $cyan = 81
    $green = 46
    $yellow = 214
    $gray = 244
    
    # Draw TUI dashboard header
    $titleText = " ◆ REPOSITORY BRANCH DASHBOARD (Base: $baseBranch) ◆ "
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
    
    # Render table headers using Format-TuiRow
    $hCols = @("   ", "Branch Name", "Last Active", "Ahead/Behind", "Last Commit Message")
    $hWidths = @(3, $maxBranchLen, 16, 14, 28)
    $hColors = @(244, $boldWhite, $boldWhite, $boldWhite, $boldWhite)
    $headerRow = Format-TuiRow -Columns $hCols -Widths $hWidths -Colors $hColors -BorderChar $borderChar -BoxWidth $boxWidth
    Write-Host $headerRow
    Write-Host (New-AsciiGradient -Type fg -Steps $steps -String $midLine)
    
    foreach ($meta in $branchMetadataList) {
        $b = $meta.Branch
        $isCurrent = ($b -eq $currentBranch)
        $currFlag = if ($isCurrent) { " * " } else { "   " }
        
        $ahead = $meta.Ahead
        $behind = $meta.Behind
        
        # Colors
        $colorBranchName = 81
        $branchFormat = @()
        if ($isCurrent) {
            $colorBranchName = 46
            $branchFormat = @('Bold')
        }
        
        $diffText = "+$ahead / -$behind"
        $diffColor = 244
        if ($ahead -gt 0 -and $behind -eq 0) { $diffColor = 46 }
        elseif ($ahead -eq 0 -and $behind -gt 0) { $diffColor = 196 }
        elseif ($ahead -gt 0 -and $behind -gt 0) { $diffColor = 214 }
        
        $maxMsgLen = 28
        $truncatedMsg = $meta.LastCommitMsg
        if ($meta.LastCommitMsg.Length -gt $maxMsgLen) {
            $truncatedMsg = $meta.LastCommitMsg.Substring(0, $maxMsgLen - 3) + "..."
        }
        
        # Render row using Format-TuiRow
        $flagColor = if ($isCurrent) { 46 } else { 244 }
        
        $rowCols = @($currFlag, $b, $meta.LastCommitTime, $diffText, $truncatedMsg)
        $rowWidths = @(3, $maxBranchLen, 16, 14, 28)
        $rowColors = @($flagColor, $colorBranchName, 244, $diffColor, 15)
        
        $row = Format-TuiRow -Columns $rowCols -Widths $rowWidths -Colors $rowColors -BorderChar $borderChar -BoxWidth $boxWidth
        Write-Host $row
    }
    
    Write-Host (New-AsciiGradient -Type fg -Steps $steps -String $bottomLine)
    Write-Host ""
}

function Invoke-GitDiffModeHelper {
    param (
        [string]$compareBranch = $null
    )
    
    # Determine base branch if not specified
    if (-not $compareBranch) {
        $compareBranch = "develop"
        $hasDevelop = git branch --list "develop"
        if (-not $hasDevelop) {
            $compareBranch = "main"
            $hasMain = git branch --list "main"
            if (-not $hasMain) {
                $compareBranch = "master"
            }
        }
    }
    
    $currentBranch = (git branch --show-current).Trim()
    Write-TrackerLog 'act' "Comparing branch '$currentBranch' with base '$compareBranch'..." "GitDiff"
    
    # Check if there are any commits ahead
    $commitsAhead = git log "$compareBranch..HEAD" --oneline
    if ($null -eq $commitsAhead -or @($commitsAhead).Count -eq 0) {
        Write-Host "No commits on '$currentBranch' ahead of '$compareBranch'." -ForegroundColor Gray
    } else {
        Write-Host "`nCommits Ahead of '$compareBranch':" -ForegroundColor Green
        foreach ($c in $commitsAhead) {
            Write-Host "  $c" -ForegroundColor Yellow
        }
    }
    
    # Show diff stat
    Write-Host "`nChanged Files Summary:" -ForegroundColor Cyan
    git diff --stat "$compareBranch..HEAD"
    
    # Show detailed code diff preview
    Write-Host "`nDetailed code diff (first 50 lines):" -ForegroundColor Cyan
    git diff "$compareBranch..HEAD" | Select-Object -First 50
    
    Write-Host "`n(Tip: Run 'git diff $compareBranch..HEAD' in your terminal for the full interactive diff.)" -ForegroundColor Gray
}

function Invoke-SemVerTagHelper {
    [CmdletBinding()]
    param(
        [switch]$CreateTag,
        [switch]$PushTag,
        [switch]$SkipConfirm,
        [ValidateNotNullOrEmpty()]
        [string]$Remote = 'origin',
        [string]$RepositoryPath = $script:repoRoot
    )

    if ($PushTag -and -not $CreateTag) {
        throw 'PushTag requires CreateTag so devt cannot push an unvalidated existing tag.'
    }

    $repository = [System.IO.Path]::GetFullPath($RepositoryPath)
    if (-not [System.IO.Directory]::Exists($repository)) { throw "Repository path not found: $repository" }

    $blockers = [System.Collections.Generic.List[string]]::new()
    Push-Location $repository
    try {
        & git rev-parse --is-inside-work-tree 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Not a Git worktree: $repository" }

        $generated = Get-ConventionalCommitVersion
        if ($null -eq $generated -or [string]::IsNullOrWhiteSpace([string]$generated.Version)) {
            throw 'Get-ConventionalCommitVersion did not return a version.'
        }
        $version = [string]$generated.Version
        $tag = "v$version"
        $branch = (& git branch --show-current).Trim()
        $status = @(& git status --porcelain=v1)
        if ($status.Count -gt 0) { $blockers.Add('The worktree contains staged, unstaged, or untracked changes.') }
        if ($branch -notin @('develop', 'main')) { $blockers.Add("Tags may only be created from develop or main; current branch is '$branch'.") }

        $manifestPath = [System.IO.Path]::Combine($repository, 'src', 'Drift', 'Drift.psd1')
        if (-not [System.IO.File]::Exists($manifestPath)) {
            $blockers.Add("Module manifest not found: $manifestPath")
        }
        else {
            $manifest = Import-PowerShellDataFile -LiteralPath $manifestPath
            if ([string]$manifest.ModuleVersion -ne $version) {
                $blockers.Add("Manifest version '$($manifest.ModuleVersion)' does not match generated version '$version'.")
            }
            if (-not [string]::IsNullOrWhiteSpace([string]$manifest.PrivateData.PSData.Prerelease)) {
                $blockers.Add("Manifest prerelease '$($manifest.PrivateData.PSData.Prerelease)' cannot be published as stable tag '$tag'.")
            }
        }

        $releaseManifestPath = [System.IO.Path]::Combine($repository, 'packaging', 'release-manifest.json')
        if (-not [System.IO.File]::Exists($releaseManifestPath)) {
            $blockers.Add("Release manifest not found: $releaseManifestPath")
        }
        else {
            $releaseManifest = [System.IO.File]::ReadAllText($releaseManifestPath) | ConvertFrom-Json
            if ([string]$releaseManifest.version -ne $version -or [string]$releaseManifest.tag -ne $tag) {
                $blockers.Add("Release manifest version/tag does not match '$version'/'$tag'.")
            }
        }

        & git show-ref --verify --quiet "refs/tags/$tag"
        if ($LASTEXITCODE -eq 0) { $blockers.Add("Local tag already exists: $tag") }

        $result = [ordered]@{
            version = $version
            tag = $tag
            branch = $branch
            lastTag = $generated.LastTag
            bumpType = $generated.BumpType
            ready = $blockers.Count -eq 0
            blockers = @($blockers)
            created = $false
            pushed = $false
            remote = $Remote
        }
        if (-not $CreateTag) { return [pscustomobject]$result }
        if ($blockers.Count -gt 0) { throw "Tag validation failed: $($blockers -join ' ')" }

        if (-not $SkipConfirm) {
            $confirmation = Read-Host "Create annotated tag $tag$(if ($PushTag) { " and push it to $Remote" })? [y/N]"
            if ($confirmation -notin @('y', 'Y')) { throw 'Tag operation cancelled.' }
        }

        & git tag --annotate $tag --message "Drift $tag"
        if ($LASTEXITCODE -ne 0) { throw "Failed to create annotated tag $tag." }
        $result.created = $true

        if ($PushTag) {
            & git remote get-url $Remote 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Git remote not found: $Remote" }
            $remoteTag = @(& git ls-remote --tags $Remote "refs/tags/$tag")
            if ($LASTEXITCODE -ne 0) { throw "Unable to query tags from remote '$Remote'." }
            if ($remoteTag.Count -gt 0) { throw "Remote tag already exists: $Remote/$tag" }
            & git push $Remote "refs/tags/$tag"
            if ($LASTEXITCODE -ne 0) { throw "Failed to push tag $tag to $Remote." }
            $result.pushed = $true
        }

        [pscustomobject]$result
    }
    finally {
        Pop-Location
    }
}

function Invoke-GitChangelogHelper {
    Write-TrackerLog 'act' "Generating automated conventional changelog..." "Changelog"
    
    # Save current location and switch to repo root
    $oldDir = Get-Location
    $repoRoot = Resolve-RepoPath "."
    Write-TrackerLog 'inf' "Resolved Repo Root: $repoRoot" "Changelog"
    Set-Location $repoRoot
    
    # Get git commits line-by-line
    $gitLogRaw = git log --format="%H%n%aI%n%s%n%b%n---COMMIT_END---" 2>&1
    
    $repoUrl = ""
    try {
        $remoteRaw = (git remote get-url origin 2>$null)
        if ($null -ne $remoteRaw) {
            $remoteRaw = $remoteRaw.Trim()
            if ($remoteRaw -match '^https?://(?:[^@:]+:[^@]+@)?([^/]+)/(.+?)(?:\.git)?$') {
                $domain = $Matches[1]
                $path = $Matches[2]
                $repoUrl = "https://$domain/$path"
            }
            elseif ($remoteRaw -match '^https?://(?:[^@]+@)?([^/]+)/(.+?)(?:\.git)?$') {
                $domain = $Matches[1]
                $path = $Matches[2]
                $repoUrl = "https://$domain/$path"
            }
            elseif ($remoteRaw -match '^git@([^:]+):(.+?)(?:\.git)?$') {
                $domain = $Matches[1]
                $path = $Matches[2]
                $repoUrl = "https://$domain/$path"
            }
            else {
                $repoUrl = $remoteRaw
            }
        }
    } catch {}
    if (-not $repoUrl) {
        $repoUrl = "https://gitlab.com/staticcanvas/ravenui-jekyll-theme"
    }
    $linkSeparator = if ($repoUrl -match "github\.com") { "/commit/" } else { "/-/commit/" }

    # Restore location
    Set-Location $oldDir

    if ($null -eq $gitLogRaw -or @($gitLogRaw).Count -eq 0 -or ($gitLogRaw -join "`n") -match "fatal:") {
        Write-TrackerLog 'err' "No git history found or Git is not initialized. Git Output: $gitLogRaw" "Changelog"
        return
    }

    $commits = [System.Collections.Generic.List[PSCustomObject]]::new()
    $currentCommit = $null
    $lineType = "none"

    foreach ($line in $gitLogRaw) {
        $lineTrim = $line.Trim()
        if ($lineTrim -match '^[0-9a-f]{40}$') {
            $currentCommit = [PSCustomObject]@{
                Hash = $lineTrim
                Date = ""
                Subject = ""
                BodyLines = [System.Collections.Generic.List[string]]::new()
            }
            $commits.Add($currentCommit)
            $lineType = "hash"
            continue
        }
        
        if ($null -eq $currentCommit) { continue }
        
        if ($lineType -eq "hash") {
            $currentCommit.Date = $lineTrim
            $lineType = "date"
            continue
        }
        
        if ($lineType -eq "date") {
            $currentCommit.Subject = $lineTrim
            $lineType = "body"
            continue
        }
        
        if ($lineTrim -eq "---COMMIT_END---") {
            $lineType = "none"
            continue
        }
        
        $currentCommit.BodyLines.Add($line)
    }

    $changelogData = @{}
    $versionOrder = [System.Collections.Generic.List[string]]::new()
    
    # Get current version from conventional commits version helper or VERSION file as fallback
    $currentVersion = "Unreleased"
    if (Get-Command Get-ConventionalCommitVersion -ErrorAction SilentlyContinue) {
        $autoVerObj = Get-ConventionalCommitVersion
        $currentVersion = $autoVerObj.Version
    } else {
        $localScript = [System.IO.Path]::Combine($PSScriptRoot, "Get-ConventionalCommitVersion.ps1")
        if (-not [System.IO.File]::Exists($localScript)) {
            $localScript = [System.IO.Path]::Combine($PSScriptRoot, "Private", "Get-ConventionalCommitVersion.ps1")
        }
        if ([System.IO.File]::Exists($localScript)) {
            . $localScript
            $autoVerObj = Get-ConventionalCommitVersion
            $currentVersion = $autoVerObj.Version
        } else {
            $resolvedVerFile = Resolve-RepoPath "VERSION"
            if ([System.IO.File]::Exists($resolvedVerFile)) {
                $currentVersion = ([System.IO.File]::ReadAllText($resolvedVerFile)).Trim()
            }
        }
    }

    $activeVersion = $currentVersion
    
    for ($i = 0; $i -lt $commits.Count; $i++) {
        $c = $commits[$i]
        
        # Check for version in this commit
        $commitVersion = $null
        $body = $c.BodyLines -join "`n"
        if ($body -match '(?i)build:\s*\[(.*?)\]') {
            $matchedVer = $Matches[1].Trim()
            if ($matchedVer -ne "none" -and $matchedVer -ne "") {
                $commitVersion = $matchedVer
            }
        }

        if ($null -ne $commitVersion) {
            $activeVersion = $commitVersion
        }

        # Format date: YYYY-MM-DD
        $commitDate = ""
        if ($c.Date -match '^(\d{4}-\d{2}-\d{2})') {
            $commitDate = $Matches[1]
        }

        if (-not $versionOrder.Contains($activeVersion)) {
            $versionOrder.Add($activeVersion)
            $changelogData[$activeVersion] = [PSCustomObject]@{
                Version = $activeVersion
                Date = $commitDate
                Features = [System.Collections.Generic.List[string]]::new()
                Bugs = [System.Collections.Generic.List[string]]::new()
                Notes = [System.Collections.Generic.List[string]]::new()
            }
        }

        # Extract closing issues and commit links
        $commitClosingIssues = [System.Collections.Generic.List[int]]::new()
        foreach ($line in $c.BodyLines) {
            if ($line -match '(?i)(?:closes|fixes|resolves)\s+#(\d+)' -or $line -match '(?i)#(\d+)') {
                $iid = [int]$Matches[1]
                if (-not $commitClosingIssues.Contains($iid)) {
                    $commitClosingIssues.Add($iid)
                }
            }
        }
        if ($c.Subject -match '(?i)#(\d+)') {
            $iid = [int]$Matches[1]
            if (-not $commitClosingIssues.Contains($iid)) {
                $commitClosingIssues.Add($iid)
            }
        }

        $closingText = ""
        if ($commitClosingIssues.Count -gt 0) {
            $issueLinks = foreach ($iid in $commitClosingIssues) {
                $issueUrl = if ($repoUrl -match "github\.com") { "$repoUrl/issues/$iid" } else { "$repoUrl/-/issues/$iid" }
                "[closes #$iid]($issueUrl)"
            }
            $closingText = " (" + ($issueLinks -join ", ") + ")"
        }

        $shortHash = $c.Hash.Substring(0, 7)
        $commitUrl = "$repoUrl$linkSeparator$shortHash"
        $commitLinkText = "([``$shortHash``]($commitUrl))"

        # Parse body sections
        $state = "none"
        $addedAny = $false

        foreach ($line in $c.BodyLines) {
            $lineTrim = $line.Trim()
            if ($lineTrim -eq "") { continue }
            if ($lineTrim -match '^Notes:') {
                $state = "notes"
                continue
            }
            if ($lineTrim -match '^Feature Additions:') {
                $state = "features"
                continue
            }
            if ($lineTrim -match '^Bug Fixes:') {
                $state = "bugs"
                continue
            }
            if ($lineTrim -match '^(build:|Build:)' -or $lineTrim -match '^====') {
                $state = "none"
                continue
            }

            if ($state -eq "notes") {
                if ($lineTrim -match '^[-*]\s*(.*)$') {
                    $val = $Matches[1].Trim()
                    if ($val -ne "None" -and $val -ne "") {
                        $changelogData[$activeVersion].Notes.Add("$val$closingText $commitLinkText")
                        $addedAny = $true
                    }
                }
            }
            elseif ($state -eq "features") {
                if ($lineTrim -match '^[-*]\s*(.*)$') {
                    $val = $Matches[1].Trim()
                    if ($val -ne "None" -and $val -ne "") {
                        $changelogData[$activeVersion].Features.Add("$val$closingText $commitLinkText")
                        $addedAny = $true
                    }
                }
            }
            elseif ($state -eq "bugs") {
                if ($lineTrim -match '^[-*]\s*(.*)$') {
                    $val = $Matches[1].Trim()
                    if ($val -ne "None" -and $val -ne "") {
                        $changelogData[$activeVersion].Bugs.Add("$val$closingText $commitLinkText")
                        $addedAny = $true
                    }
                }
            }
        }

        # Fallback to subject line parsing if no structured sections were added
        if (-not $addedAny) {
            # Skip standard merge commits
            if ($c.Subject -match '^Merge branch') { continue }
            
            if ($c.Subject -match '^(feat|fix|refactor|docs|chore|style|test|ci|build)(?:\((.*?)\))?:\s*(.*)$') {
                $type = $Matches[1].ToLower()
                $scope = if ($Matches.ContainsKey(2)) { $Matches[2] } else { $null }
                $desc = $Matches[3].Trim()
                $item = if ($scope) { "$desc ($scope)" } else { $desc }

                if ($type -eq "feat") {
                    $changelogData[$activeVersion].Features.Add("$item$closingText $commitLinkText")
                }
                elseif ($type -eq "fix") {
                    $changelogData[$activeVersion].Bugs.Add("$item$closingText $commitLinkText")
                }
                else {
                    # Group refactor/docs/chore/etc under Notes
                    $changelogData[$activeVersion].Notes.Add("${type}: $item$closingText $commitLinkText")
                }
            }
            else {
                $changelogData[$activeVersion].Notes.Add("$($c.Subject)$closingText $commitLinkText")
            }
        }
    }

    # Now generate the CHANGELOG.md content
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("# **CHANGELOG**")
    [void]$sb.AppendLine("")

    foreach ($v in $versionOrder) {
        $data = $changelogData[$v]
        $header = "## [$v]"
        if ($data.Date) {
            $header += " - $($data.Date)"
        }
        [void]$sb.AppendLine($header)
        [void]$sb.AppendLine("")

        # Deduplicate features, bugs, notes
        $uniqueFeatures = $data.Features | Select-Object -Unique
        $uniqueBugs = $data.Bugs | Select-Object -Unique
        $uniqueNotes = $data.Notes | Select-Object -Unique

        $hasContent = $false

        if ($null -ne $uniqueFeatures -and @($uniqueFeatures).Count -gt 0) {
            $hasContent = $true
            [void]$sb.AppendLine("### Feature Additions")
            foreach ($f in $uniqueFeatures) {
                [void]$sb.AppendLine("- $f")
            }
            [void]$sb.AppendLine("")
        }

        if ($null -ne $uniqueBugs -and @($uniqueBugs).Count -gt 0) {
            $hasContent = $true
            [void]$sb.AppendLine("### Bug Fixes")
            foreach ($b in $uniqueBugs) {
                [void]$sb.AppendLine("- $b")
            }
            [void]$sb.AppendLine("")
        }

        if ($null -ne $uniqueNotes -and @($uniqueNotes).Count -gt 0) {
            $hasContent = $true
            [void]$sb.AppendLine("### Notes & Improvements")
            foreach ($n in $uniqueNotes) {
                [void]$sb.AppendLine("- $n")
            }
            [void]$sb.AppendLine("")
        }

        if (-not $hasContent) {
            [void]$sb.AppendLine("- Miscellaneous updates and improvements.")
            [void]$sb.AppendLine("")
        }
    }

    $destPath = Resolve-RepoPath "CHANGELOG.md"
    [System.IO.File]::WriteAllText($destPath, $sb.ToString().Trim() + "`n", [System.Text.Encoding]::UTF8)
    Write-TrackerLog 'suc' "Changelog successfully compiled to CHANGELOG.md" "Changelog"
}
