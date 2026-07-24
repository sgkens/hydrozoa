# RavenUI Task Tracker Module - Root Loader

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Load Private Helpers
$privateDir = [System.IO.Path]::Combine($PSScriptRoot, "Private")
if ([System.IO.Directory]::Exists($privateDir)) {
    $privateFiles = [System.IO.Directory]::GetFiles($privateDir, "*.ps1", [System.IO.SearchOption]::AllDirectories)
    foreach ($file in $privateFiles) {
        . $file
    }
}

# Load Public Cmdlets
$publicDir = [System.IO.Path]::Combine($PSScriptRoot, "Public")
if ([System.IO.Directory]::Exists($publicDir)) {
    $publicFiles = [System.IO.Directory]::GetFiles($publicDir, "*.ps1", [System.IO.SearchOption]::AllDirectories)
    foreach ($file in $publicFiles) {
        . $file
    }
}

# Define and Export Public Functions and Aliases
Set-Alias -Name devt -Value Invoke-Devt -Description "RavenUI Task Tracker CMD shortcut"

if ($publicFiles) {
    $publicFunctions = foreach ($f in $publicFiles) {
        [System.IO.Path]::GetFileNameWithoutExtension($f)
    }
    Export-ModuleMember -Function $publicFunctions -Alias devt
}

# Dynamic Argument Completers for Tab Completion
if (Get-Command Register-ArgumentCompleter -ErrorAction SilentlyContinue) {
    # Category Completer
    $categoryCompleter = {
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        
        $sourcePath = "devtracker-source.md"
        if ($fakeBoundParameters.ContainsKey('SourcePath')) {
            $sourcePath = $fakeBoundParameters['SourcePath']
        }
        
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
            $gitRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, ".."))
        }
        
        $resolvedSourcePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($gitRoot, $sourcePath))
        if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
            return
        }
        
        $lines = [System.IO.File]::ReadAllLines($resolvedSourcePath)
        $categories = [System.Collections.Generic.List[string]]::new()
        foreach ($line in $lines) {
            if ($line -match "^###?\s+\*\*(.*?)\*\*") {
                $catName = $Matches[1].Trim()
                if (-not $categories.Contains($catName)) {
                    $categories.Add($catName)
                }
            } elseif ($line -match "^###?\s+(.*)") {
                $catName = $Matches[1].Trim()
                if (-not $categories.Contains($catName)) {
                    $categories.Add($catName)
                }
            }
        }
        
        foreach ($cat in $categories) {
            if ($cat -like "$wordToComplete*") {
                [System.Management.Automation.CompletionResult]::new($cat, $cat, [System.Management.Automation.CompletionResultType]::ParameterValue, $cat)
            }
        }
    }
    
    # Branch Completer
    $branchCompleter = {
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        $branches = git branch --format="%(refname:short)" 2>$null
        if ($null -ne $branches) {
            foreach ($b in $branches) {
                $b = $b.Trim()
                if ($b -like "$wordToComplete*") {
                    [System.Management.Automation.CompletionResult]::new($b, $b, [System.Management.Automation.CompletionResultType]::ParameterValue, $b)
                }
            }
        }
    }
    
    # TaskKey Completer
    $taskKeyCompleter = {
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        
        $sourcePath = "devtracker-source.md"
        if ($fakeBoundParameters.ContainsKey('SourcePath')) {
            $sourcePath = $fakeBoundParameters['SourcePath']
        }
        
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
            $gitRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, ".."))
        }
        
        $resolvedSourcePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($gitRoot, $sourcePath))
        if (-not [System.IO.File]::Exists($resolvedSourcePath)) {
            return
        }
        
        $lines = [System.IO.File]::ReadAllLines($resolvedSourcePath)
        $tasks = [System.Collections.Generic.List[string]]::new()
        foreach ($line in $lines) {
            if ($line -match "^([-*])\s*\[([ xX])\]\s*(.*)$") {
                $rawText = $Matches[3].Trim()
                $taskClean = $rawText -replace '^\s*([🟢🔴🟡🟠🟩🟥🟧🪲🌀❓✅✔️💡🌟🦀🩹0-9🔟⏳️\s]*)\s*', ''
                $taskClean = $taskClean -replace '\*+', ''
                $taskClean = $taskClean -replace '`+', ''
                $taskClean = $taskClean.Trim()
                if (-not $tasks.Contains($taskClean)) {
                    $tasks.Add($taskClean)
                }
            }
        }
        
        foreach ($task in $tasks) {
            if ($task -like "*$wordToComplete*") {
                [System.Management.Automation.CompletionResult]::new($task, $task, [System.Management.Automation.CompletionResultType]::ParameterValue, $task)
            }
        }
    }

    $targetCommands = @('Invoke-Devt', 'devt', './devt.ps1', 'devt.ps1')
    foreach ($cmd in $targetCommands) {
        Register-ArgumentCompleter -CommandName $cmd -ParameterName 'Category' -ScriptBlock $categoryCompleter
        Register-ArgumentCompleter -CommandName $cmd -ParameterName 'Branch' -ScriptBlock $branchCompleter
        Register-ArgumentCompleter -CommandName $cmd -ParameterName 'TaskKey' -ScriptBlock $taskKeyCompleter
    }
}
