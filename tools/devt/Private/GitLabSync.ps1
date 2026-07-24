# RavenUI Task Tracker - GitLab Synchronization Helper

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-GitLabCredentials {
    $gitRemote = git remote get-url origin
    if ($gitRemote -match 'https://([^:]+):([^@]+)@gitlab\.com/([^/]+/[^/]+?)(?:\.git)?$') {
        return @{
            User = $Matches[1]
            Token = $Matches[2]
            Project = $Matches[3]
        }
    }
    return $null
}

function Invoke-GitLabRequest([string]$method, [string]$url, [string]$token, [string]$jsonBody = $null) {
    $client = [System.Net.Http.HttpClient]::new()
    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::$method, $url)
        $request.Headers.Add("PRIVATE-TOKEN", $token)

        if ($jsonBody) {
            $request.Content = [System.Net.Http.StringContent]::new($jsonBody, [System.Text.Encoding]::UTF8, "application/json")
        }

        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        
        return @{
            StatusCode = [int]$response.StatusCode
            Success = $response.IsSuccessStatusCode
            Content = $content
        }
    }
    finally {
        $client.Dispose()
    }
}

function Get-GitLabUserId([string]$username, [string]$token) {
    $url = "https://gitlab.com/api/v4/users?username=$username"
    $res = Invoke-GitLabRequest -method "GET" -url $url -token $token
    if ($res.Success) {
        $users = ConvertFrom-Json $res.Content
        if ($users.Count -gt 0) {
            return $users[0].id
        }
    }
    return $null
}

function Get-GitLabMilestones([string]$projectEscaped, [string]$token) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/milestones?per_page=100"
    $res = Invoke-GitLabRequest -method "GET" -url $url -token $token
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return @()
}

function Create-GitLabMilestone([string]$projectEscaped, [string]$token, [string]$title) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/milestones"
    $body = @{ title = $title } | ConvertTo-Json
    $res = Invoke-GitLabRequest -method "POST" -url $url -token $token -jsonBody $body
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return $null
}

function Get-GitLabIssues([string]$projectEscaped, [string]$token) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/issues?per_page=100"
    $res = Invoke-GitLabRequest -method "GET" -url $url -token $token
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return @()
}

function Create-GitLabIssue([string]$projectEscaped, [string]$token, [string]$title, [string]$description, [int]$assigneeId, [int]$milestoneId = 0) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/issues"
    $payload = @{
        title = $title
        description = $description
        assignee_ids = @($assigneeId)
    }
    if ($milestoneId -gt 0) {
        $payload["milestone_id"] = $milestoneId
    }
    $body = $payload | ConvertTo-Json
    $res = Invoke-GitLabRequest -method "POST" -url $url -token $token -jsonBody $body
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return $null
}

function Update-GitLabIssue([string]$projectEscaped, [string]$token, [int]$issueIid, [hashtable]$params) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/issues/$issueIid"
    $body = $params | ConvertTo-Json
    $res = Invoke-GitLabRequest -method "PUT" -url $url -token $token -jsonBody $body
    return $res.Success
}

function Get-GitLabIssueNotes([string]$projectEscaped, [string]$token, [int]$issueIid) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/issues/$issueIid/notes?per_page=100"
    $res = Invoke-GitLabRequest -method "GET" -url $url -token $token
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return @()
}

function Create-GitLabIssueNote([string]$projectEscaped, [string]$token, [int]$issueIid, [string]$bodyText) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/issues/$issueIid/notes"
    $body = @{ body = $bodyText } | ConvertTo-Json
    $res = Invoke-GitLabRequest -method "POST" -url $url -token $token -jsonBody $body
    return $res.Success
}

function Create-GitLabMergeRequest([string]$projectEscaped, [string]$token, [string]$sourceBranch, [string]$targetBranch, [string]$title, [string]$description, [int]$assigneeId) {
    $url = "https://gitlab.com/api/v4/projects/$projectEscaped/merge_requests"
    $body = @{
        source_branch = $sourceBranch
        target_branch = $targetBranch
        title = $title
        description = $description
        assignee_id = $assigneeId
        remove_source_branch = $true
    } | ConvertTo-Json
    
    $res = Invoke-GitLabRequest -method "POST" -url $url -token $token -jsonBody $body
    if ($res.Success) {
        return ConvertFrom-Json $res.Content
    }
    return $null
}

function Sync-TasksToGitLab([string]$sourcePath) {
    $creds = Get-GitLabCredentials
    if (-not $creds) {
        Write-TrackerLog 'err' "Could not extract GitLab credentials from origin remote URL." "GitLabSync"
        return
    }

    $token = $creds.Token
    $project = $creds.Project
    $projectEscaped = $project.Replace("/", "%2F")

    Write-TrackerLog 'act' "Connecting to GitLab: $project" "GitLabSync"

    # Get Git User Name
    $gitUser = (git config user.name).Trim()
    if (-not $gitUser) {
        $gitUser = $env:USER
    }
    $formattedGitUser = "<u>***$gitUser***</u>"

    # Fetch User ID
    $assigneeId = Get-GitLabUserId -username "sgkens" -token $token
    if (-not $assigneeId) {
        Write-TrackerLog 'wrn' "User 'sgkens' not found on GitLab. Issues will be created without assignment." "GitLabSync"
        $assigneeId = 0
    } else {
        Write-TrackerLog 'inf' "Using assignee user ID $assigneeId for 'sgkens'." "GitLabSync"
    }

    # Fetch existing issues and milestones
    $issues = Get-GitLabIssues -projectEscaped $projectEscaped -token $token
    $milestones = Get-GitLabMilestones -projectEscaped $projectEscaped -token $token

    # Build local task structure
    $sourceParsed = Parse-TaskFile $sourcePath
    $updatedTasksCount = 0
    $createdIssuesCount = 0
    $closedIssuesCount = 0
    $commentsSyncedCount = 0

    # Process each category
    foreach ($category in $sourceParsed.CategoryOrder) {
        $cleanCategory = $category -replace '^###\s+\*\*', '' -replace '\*\*.*$', ''
        $cleanCategory = $cleanCategory -replace '\s+\(priority-\d+\)', ''
        
        # Don't sync backlog or empty categories
        if ($cleanCategory -eq "Backlog" -or $null -eq $sourceParsed.TasksByCategory[$category] -or $sourceParsed.TasksByCategory[$category].Count -eq 0) {
            continue
        }

        # Find or create GitLab Milestone for the category
        $milestone = $null
        foreach ($m in $milestones) {
            if ($m.title -eq $cleanCategory) {
                $milestone = $m
                break
            }
        }
        $milestoneId = 0
        if ($milestone) {
            $milestoneId = $milestone.id
        } else {
            Write-TrackerLog 'act' "Creating GitLab Milestone: $cleanCategory" "GitLabSync"
            $newMilestone = Create-GitLabMilestone -projectEscaped $projectEscaped -token $token -title $cleanCategory
            if ($newMilestone) {
                $milestoneId = $newMilestone.id
                $milestones += $newMilestone
            }
        }

        # Process each task
        foreach ($task in $sourceParsed.TasksByCategory[$category]) {
            # Extract title and description from RawText
            if ($task.RawText -match '^[-*]\s*\[([ xX])\]\s*(?:[🟢🔴🟡🟠🟩🟥🟧🪲🌀❓✅✔️💡🌟🦀🩹0-9️⃣🔟⏳\s]+)?\*\*(.*?)\*\*\s*-\s*(.*?)(?:\s+(?:#\d+|\[#\d+\]\(.*?\)))?$') {
                $statusChar = $Matches[1]
                $taskTitle = $Matches[2].Trim()
                $taskDesc = $Matches[3].Trim()

                $isWorking = $task.RawText -match '🌀'

                # Check if task already has a GitLab issue reference (#Iid) at the end of the line
                $issueIid = 0
                if ($task.RawText -match '#(\d+)$' -or $task.RawText -match '\[#(\d+)\]\(.*?\)$') {
                    $issueIid = [int]$Matches[1]
                }

                if ($issueIid -gt 0) {
                    # Task already synced. Check status mapping
                    $gitlabIssue = $null
                    foreach ($issue in $issues) {
                        if ($issue.iid -eq $issueIid) {
                            $gitlabIssue = $issue
                            break
                        }
                    }
                    if ($gitlabIssue) {
                        # Case A: Local is completed, GitLab is open -> Close GitLab Issue
                        if ($task.IsCompleted -and $gitlabIssue.state -eq "opened") {
                            Write-TrackerLog 'act' "Closing GitLab Issue #$issueIid ($taskTitle)" "GitLabSync"
                            if (Update-GitLabIssue -projectEscaped $projectEscaped -token $token -issueIid $issueIid -params @{ state_event = "close" }) {
                                $closedIssuesCount++
                            }
                        }
                        # Case B: Local is NOT completed, GitLab is closed -> Mark local completed (Two-way sync)
                        elseif (-not $task.IsCompleted -and $gitlabIssue.state -eq "closed") {
                            Write-TrackerLog 'act' "Marking local task completed from closed GitLab Issue #$issueIid ($taskTitle)" "GitLabSync"
                            $task.IsCompleted = $true
                            $task.RawText = $task.RawText -replace '^([-*]\s*\[)\s*(\])', '${1}x${2}'
                            $updatedTasksCount++
                        }
                        # Case C: Check working state -> update labels/status
                        if ($gitlabIssue.state -eq "opened") {
                            $labels = [System.Collections.Generic.List[string]]::new($gitlabIssue.labels)
                            if ($isWorking -and -not $labels.Contains("workflow::in-progress")) {
                                $labels.Add("workflow::in-progress")
                                $null = Update-GitLabIssue -projectEscaped $projectEscaped -token $token -issueIid $issueIid -params @{ labels = ($labels -join ",") }
                            } elseif (-not $isWorking -and $labels.Contains("workflow::in-progress")) {
                                [void]$labels.Remove("workflow::in-progress")
                                $null = Update-GitLabIssue -projectEscaped $projectEscaped -token $token -issueIid $issueIid -params @{ labels = ($labels -join ",") }
                            }
                        }
                    }
                } else {
                    # No local reference. Search by title
                    $gitlabIssue = $null
                    $titlePattern = [regex]::Escape($taskTitle)
                    foreach ($issue in $issues) {
                        if ($issue.title -match $titlePattern) {
                            $gitlabIssue = $issue
                            break
                        }
                    }
                    
                    if ($gitlabIssue) {
                        $issueIid = $gitlabIssue.iid
                        Write-TrackerLog 'inf' "Linked existing GitLab Issue #$issueIid to local task: $taskTitle" "GitLabSync"
                        
                        $issueUrl = "https://gitlab.com/$project/-/issues/$issueIid"
                        $task.RawText = "$($task.RawText) [#$issueIid]($issueUrl)"
                        $updatedTasksCount++
                    } else {
                        # Create new GitLab issue
                        $fullTitle = "$($cleanCategory): $taskTitle"
                        $fullDesc = "Task Description: $taskDesc`n`nSynced from local devtracker-pending.md by $formattedGitUser."
                        
                        Write-TrackerLog 'act' "Creating GitLab Issue for: $taskTitle" "GitLabSync"
                        $labelsStr = if ($isWorking) { "workflow::in-progress" } else { "" }
                        $newIssue = Create-GitLabIssue -projectEscaped $projectEscaped -token $token -title $fullTitle -description $fullDesc -assigneeId $assigneeId -milestoneId $milestoneId
                        
                        if ($newIssue) {
                            $issueIid = $newIssue.iid
                            $issueUrl = "https://gitlab.com/$project/-/issues/$issueIid"
                            $task.RawText = "$($task.RawText) [#$issueIid]($issueUrl)"
                            $createdIssuesCount++
                            Write-TrackerLog 'suc' "Created GitLab Issue #$issueIid" "GitLabSync"
                            
                            # Add label if working
                            if ($isWorking) {
                                $null = Update-GitLabIssue -projectEscaped $projectEscaped -token $token -issueIid $issueIid -params @{ labels = "workflow::in-progress" }
                            }
                        }
                    }
                }

                # Sync child comments (lines starting with '>') to GitLab issue notes
                if ($issueIid -gt 0) {
                    $notes = Get-GitLabIssueNotes -projectEscaped $projectEscaped -token $token -issueIid $issueIid
                    
                    foreach ($child in $task.Children) {
                        # Match lines like: > ***NOTE!*** - Content
                        if ($child -match '^\s*>\s*(.*)$') {
                            $commentContent = $Matches[1].Trim()
                            if ($commentContent -eq "") { continue }

                            # Check if comment already exists in issue notes to avoid duplicates
                            $exists = $false
                            foreach ($note in $notes) {
                                if ($note.body -match [regex]::Escape($commentContent)) {
                                    $exists = $true
                                    break
                                }
                            }

                            if (-not $exists) {
                                Write-TrackerLog 'act' "Adding comment to GitLab Issue #$issueIid" "GitLabSync"
                                $fullNoteBody = "$commentContent`n`n*Posted by $formattedGitUser*"
                                if (Create-GitLabIssueNote -projectEscaped $projectEscaped -token $token -issueIid $issueIid -bodyText $fullNoteBody) {
                                    $commentsSyncedCount++
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    # If any task was updated (issue link appended or status changed), write back
    if ($updatedTasksCount -gt 0 -or $createdIssuesCount -gt 0) {
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

        [System.IO.File]::WriteAllText($sourcePath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
        Write-TrackerLog 'suc' "Saved updated source file with GitLab issue references and status mappings." "GitLabSync"
    }

    Write-TrackerLog 'suc' "Sync complete: $createdIssuesCount created, $closedIssuesCount closed, $commentsSyncedCount comments synced, $updatedTasksCount link updates." "GitLabSync"
}

function Create-MergeRequestHelper {
    $creds = Get-GitLabCredentials
    if (-not $creds) {
        Write-TrackerLog 'err' "Could not extract GitLab credentials from origin remote URL." "GitLabSync"
        return
    }

    $token = $creds.Token
    $project = $creds.Project
    $projectEscaped = $project.Replace("/", "%2F")

    $currentBranch = (git branch --show-current).Trim()
    if ($currentBranch -eq 'develop' -or $currentBranch -eq 'main' -or $currentBranch -eq '') {
        Write-TrackerLog 'err' "You must be on a feature or fix branch to generate a Merge Request. Current: $currentBranch" "GitLabSync"
        return
    }

    Write-TrackerLog 'act' "Analyzing branch $currentBranch for Merge Request..." "GitLabSync"

    # Get commits since develop
    $commits = @(git log develop..HEAD --pretty=format:"%s%n%b")
    if ($null -eq $commits -or $commits.Count -eq 0) {
        Write-TrackerLog 'wrn' "No commits found on $currentBranch ahead of develop branch." "GitLabSync"
    }

    # Aggregate Notes, Feature Additions, Bug Fixes
    $notes = [System.Collections.Generic.List[string]]::new()
    $features = [System.Collections.Generic.List[string]]::new()
    $bugs = [System.Collections.Generic.List[string]]::new()
    $closingIssues = [System.Collections.Generic.List[string]]::new()

    $inNotes = $false
    $inFeatures = $false
    $inBugs = $false

    foreach ($line in $commits) {
        $trimmed = $line.Trim()
        
        # Parse closing issue reference
        if ($trimmed -match '(closes|fixes|resolves)\s+#(\d+)' -or $trimmed -match '#(\d+)') {
            $issueIid = $Matches[$Matches.Count - 1]
            if (-not $closingIssues.Contains($issueIid)) {
                $closingIssues.Add($issueIid)
            }
        }

        if ($trimmed -eq "Notes:") {
            $inNotes = $true; $inFeatures = $false; $inBugs = $false; continue
        }
        if ($trimmed -eq "Feature Additions:") {
            $inNotes = $false; $inFeatures = $true; $inBugs = $false; continue
        }
        if ($trimmed -eq "Bug Fixes:") {
            $inNotes = $false; $inFeatures = $false; $inBugs = $true; continue
        }
        if ($trimmed -eq "") {
            continue
        }
        # Reset on headers of commit blocks
        if ($trimmed -match '^[a-z]+\(.*\):') {
            $inNotes = $false; $inFeatures = $false; $inBugs = $false
        }

        if ($inNotes -and $trimmed -match '^[-*]\s*(.*)$') {
            $noteText = $Matches[1].Trim()
            if (-not $notes.Contains($noteText) -and $noteText -ne "None") { $notes.Add($noteText) }
        }
        if ($inFeatures -and $trimmed -match '^[-*]\s*(.*)$') {
            $featText = $Matches[1].Trim()
            if (-not $features.Contains($featText) -and $featText -ne "None") { $features.Add($featText) }
        }
        if ($inBugs -and $trimmed -match '^[-*]\s*(.*)$') {
            $bugText = $Matches[1].Trim()
            if (-not $bugs.Contains($bugText) -and $bugText -ne "None") { $bugs.Add($bugText) }
        }
    }

    # Fetch Git User
    $gitUser = (git config user.name).Trim()
    if (-not $gitUser) { $gitUser = $env:USER }
    $formattedGitUser = "<u>***$gitUser***</u>"

    # Fetch User ID
    $assigneeId = Get-GitLabUserId -username "sgkens" -token $token
    if (-not $assigneeId) { $assigneeId = 0 }

    # Format Merge Request Description
    $commitCount = 0
    try {
        $countRaw = (git rev-list --count develop..HEAD 2>$null)
        if ($null -ne $countRaw) {
            $countRaw = $countRaw.Trim()
            if ($countRaw -match '^\d+$') {
                $commitCount = [int]$countRaw
            }
        }
    } catch {}

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("## **Planned Changes & Scope**")
    [void]$sb.AppendLine("Branch: ``$currentBranch`` targeting ``develop``")
    [void]$sb.AppendLine("Commits Count: **$($commitCount)**")
    [void]$sb.AppendLine("Proposed by: $formattedGitUser`n")
    
    if ($closingIssues.Count -gt 0) {
        $issueLinks = foreach ($issue in $closingIssues) { "Closes #$issue" }
        [void]$sb.AppendLine("### **Linked Issues**")
        [void]$sb.AppendLine(($issueLinks -join ", ") + "`n")
    }

    [void]$sb.AppendLine("### **Implementation Notes**")
    if ($notes.Count -gt 0) {
        foreach ($n in $notes) { [void]$sb.AppendLine("- $n") }
    } else {
        [void]$sb.AppendLine("- Refined branch development and synced workspace structures.")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("### **Feature Additions**")
    if ($features.Count -gt 0) {
        foreach ($f in $features) { [void]$sb.AppendLine("- $f") }
    } else {
        [void]$sb.AppendLine("- None")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("### **Bug Fixes**")
    if ($bugs.Count -gt 0) {
        foreach ($b in $bugs) { [void]$sb.AppendLine("- $b") }
    } else {
        [void]$sb.AppendLine("- None")
    }

    [void]$sb.AppendLine("`n## **Zero-Touch Verification Checklist**")
    [void]$sb.AppendLine("- [ ] **Linter Check**: Run `./rvcli lint` to ensure zero-error syntax formatting.")
    [void]$sb.AppendLine("- [ ] **Build Verification**: Run `bundle exec jekyll build` to guarantee compilation passes cleanly.")
    [void]$sb.AppendLine("- [ ] **Pester Testing**: Verify helper cmdlets locally (e.g. `Invoke-Pester` in `tests/` if available).")
    [void]$sb.AppendLine("- [ ] **Task Alignment**: Run `./devt sync` and `./devt compile` to align local and remote checkmarks.")

    $mrDesc = $sb.ToString().Trim()
    
    # Generate Title
    $mrTitle = "Draft: Resolve $currentBranch"
    if ($commits.Count -gt 0) {
        $mrTitle = "Draft: " + ($commits[0] -replace '^Draft:\s*', '')
    }

    Write-Host "`n================================================================================" -ForegroundColor Gray
    Write-Host "Title: $mrTitle" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
    Write-Host $mrDesc -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Gray

    $confirm = Read-Host "Do you want to create this Draft Merge Request on GitLab? [y/N]"
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        $mr = Create-GitLabMergeRequest -projectEscaped $projectEscaped -token $token -sourceBranch $currentBranch -targetBranch "develop" -title $mrTitle -description $mrDesc -assigneeId $assigneeId
        if ($mr) {
            Write-TrackerLog 'suc' "Draft Merge Request created successfully!" "GitLabSync"
            Write-Host "🔗 MR Web URL: $($mr.web_url)" -ForegroundColor Green
        } else {
            Write-TrackerLog 'err' "Failed to create Merge Request on GitLab." "GitLabSync"
        }
    } else {
        Write-TrackerLog 'wrn' "Merge Request generation aborted." "GitLabSync"
    }
}
