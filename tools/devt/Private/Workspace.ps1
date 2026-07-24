Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-DevtWorkspace {
    [CmdletBinding()]
    param(
        [string]$Path = (Resolve-RepoPath 'devt.workspace.json')
    )

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    if (-not [System.IO.File]::Exists($resolvedPath)) { throw "devt workspace manifest not found: $resolvedPath" }
    $raw = [System.IO.File]::ReadAllText($resolvedPath) | ConvertFrom-Json
    if ([int]$raw.schemaVersion -notin @(1, 2)) { throw "Unsupported devt workspace schemaVersion '$($raw.schemaVersion)'." }
    if ([string]::IsNullOrWhiteSpace([string]$raw.defaultBase)) { throw 'devt workspace defaultBase is required.' }

    $components = [System.Collections.Generic.Dictionary[string, object]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($property in $raw.components.PSObject.Properties) {
        $name = [string]$property.Name
        if ($name -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') { throw "Invalid devt component name '$name'." }
        $paths = [System.Collections.Generic.List[string]]::new()
        foreach ($pathPrefix in @($property.Value.paths)) {
            $normalized = ([string]$pathPrefix).Replace('\', '/').Trim('/')
            if ([string]::IsNullOrWhiteSpace($normalized) -or [System.IO.Path]::IsPathRooted($normalized) -or $normalized -match '(^|/)\.\.(/|$)') {
                throw "Component '$name' contains invalid path prefix '$pathPrefix'."
            }
            $paths.Add($normalized)
        }
        if ($paths.Count -eq 0) { throw "Component '$name' must declare at least one path." }
        $targets = [System.Collections.Generic.Dictionary[string, object]]::new([System.StringComparer]::OrdinalIgnoreCase)
        $targetsProperty = $property.Value.PSObject.Properties['targets']
        if ($null -ne $targetsProperty -and $null -ne $targetsProperty.Value) {
            foreach ($targetProperty in $targetsProperty.Value.PSObject.Properties) {
                $targetName = [string]$targetProperty.Name
                if ($targetName -notmatch '^[a-z0-9]+(?:[-:][a-z0-9]+)*$') { throw "Component '$name' contains invalid target '$targetName'." }
                $command = [string]$targetProperty.Value.command
                if ([string]::IsNullOrWhiteSpace($command) -or $command.IndexOfAny([char[]]@("`r", "`n", [char]0)) -ge 0) { throw "Component '$name' target '$targetName' requires a valid command." }
                $workingDirectoryProperty = $targetProperty.Value.PSObject.Properties['workingDirectory']
                $workingDirectory = if ($null -eq $workingDirectoryProperty -or [string]::IsNullOrWhiteSpace([string]$workingDirectoryProperty.Value)) { '.' } else { ([string]$workingDirectoryProperty.Value).Replace('\', '/').Trim('/') }
                if ([System.IO.Path]::IsPathRooted($workingDirectory) -or $workingDirectory -match '(^|/)\.\.(/|$)') { throw "Component '$name' target '$targetName' has an invalid workingDirectory." }
                $arguments = [System.Collections.Generic.List[string]]::new()
                $argumentsProperty = $targetProperty.Value.PSObject.Properties['arguments']
                foreach ($argument in $(if ($null -eq $argumentsProperty) { @() } else { @($argumentsProperty.Value) })) {
                    $value = [string]$argument
                    if ($value.IndexOf([char]0) -ge 0) { throw "Component '$name' target '$targetName' contains an invalid argument." }
                    $arguments.Add($value)
                }
                $timeoutProperty = $targetProperty.Value.PSObject.Properties['timeoutSeconds']
                $timeoutSeconds = if ($null -eq $timeoutProperty) { 900 } else { [int]$timeoutProperty.Value }
                if ($timeoutSeconds -lt 1 -or $timeoutSeconds -gt 86400) { throw "Component '$name' target '$targetName' timeoutSeconds must be between 1 and 86400." }
                $targets.Add($targetName, [pscustomobject]@{ name=$targetName; command=$command; arguments=$arguments.ToArray(); workingDirectory=$workingDirectory; timeoutSeconds=$timeoutSeconds })
            }
        }
        $components.Add($name, [pscustomobject]@{
            name = $name
            paths = $paths.ToArray()
            dependencies = @($property.Value.dependencies | ForEach-Object { [string]$_ })
            targets = $targets
        })
    }

    foreach ($component in $components.Values) {
        foreach ($dependency in $component.dependencies) {
            if (-not $components.ContainsKey($dependency)) { throw "Component '$($component.name)' references unknown dependency '$dependency'." }
            if ($dependency -ieq $component.name) { throw "Component '$($component.name)' cannot depend on itself." }
        }
    }

    $remaining = [System.Collections.Generic.Dictionary[string, int]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($component in $components.Values) { $remaining[$component.name] = $component.dependencies.Count }
    $queue = [System.Collections.Generic.Queue[string]]::new()
    foreach ($entry in $remaining.GetEnumerator()) { if ($entry.Value -eq 0) { $queue.Enqueue($entry.Key) } }
    $visited = 0
    while ($queue.Count -gt 0) {
        $resolved = $queue.Dequeue()
        $visited++
        foreach ($candidate in $components.Values) {
            if ($candidate.dependencies -contains $resolved) {
                $remaining[$candidate.name]--
                if ($remaining[$candidate.name] -eq 0) { $queue.Enqueue($candidate.name) }
            }
        }
    }
    if ($visited -ne $components.Count) { throw 'devt workspace dependency graph contains a cycle.' }

    $topologicalOrder = [System.Collections.Generic.List[string]]::new()
    $orderRemaining = [System.Collections.Generic.Dictionary[string, int]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($component in $components.Values) { $orderRemaining[$component.name] = $component.dependencies.Count }
    $orderQueue = [System.Collections.Generic.Queue[string]]::new()
    foreach ($componentName in @($orderRemaining.Keys | Sort-Object)) { if ($orderRemaining[$componentName] -eq 0) { $orderQueue.Enqueue($componentName) } }
    while ($orderQueue.Count -gt 0) {
        $resolved = $orderQueue.Dequeue(); $topologicalOrder.Add($resolved)
        foreach ($candidate in @($components.Values | Sort-Object name)) {
            if ($candidate.dependencies -contains $resolved) {
                $orderRemaining[$candidate.name]--
                if ($orderRemaining[$candidate.name] -eq 0) { $orderQueue.Enqueue($candidate.name) }
            }
        }
    }

    [pscustomobject]@{
        path = $resolvedPath
        root = [System.IO.Path]::GetDirectoryName($resolvedPath)
        schemaVersion = [int]$raw.schemaVersion
        defaultBase = [string]$raw.defaultBase
        globalInputs = @($raw.globalInputs | ForEach-Object { ([string]$_).Replace('\', '/').Trim('/') })
        components = $components
        topologicalOrder = $topologicalOrder.ToArray()
    }
}

function Get-DevtProjectGraph {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Workspace)
    $nodes = [System.Collections.Generic.List[object]]::new(); $edges = [System.Collections.Generic.List[object]]::new()
    foreach ($name in $Workspace.topologicalOrder) {
        $component = $Workspace.components[$name]
        $nodes.Add([pscustomobject]@{ name=$name; paths=@($component.paths); targets=@($component.targets.Keys | Sort-Object) })
        foreach ($dependency in @($component.dependencies | Sort-Object)) { $edges.Add([pscustomobject]@{ from=$name; to=$dependency }) }
    }
    return [pscustomobject]@{ schemaVersion=1; nodes=$nodes.ToArray(); edges=$edges.ToArray(); topologicalOrder=@($Workspace.topologicalOrder) }
}

function Get-DevtAffectedTargetPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Workspace, [Parameter(Mandatory)][object]$Affected, [Parameter(Mandatory)][string]$Target)
    if ($Target -notmatch '^[a-z0-9]+(?:[-:][a-z0-9]+)*$') { throw "Invalid devt target '$Target'." }
    $affectedSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$Affected.affected, [StringComparer]::OrdinalIgnoreCase)
    $steps = [System.Collections.Generic.List[object]]::new()
    foreach ($name in $Workspace.topologicalOrder) {
        if (-not $affectedSet.Contains($name)) { continue }
        $component = $Workspace.components[$name]
        if (-not $component.targets.ContainsKey($Target)) { continue }
        $definition = $component.targets[$Target]
        $steps.Add([pscustomobject]@{ component=$name; target=$Target; command=$definition.command; arguments=@($definition.arguments); workingDirectory=[System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Workspace.root, $definition.workingDirectory)); timeoutSeconds=$definition.timeoutSeconds })
    }
    return [pscustomobject]@{ schemaVersion=1; base=$Affected.base; head=$Affected.head; target=$Target; affected=@($Affected.affected); steps=$steps.ToArray() }
}

function Invoke-DevtTargetPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Plan, [switch]$ContinueOnError)
    $results = [System.Collections.Generic.List[object]]::new()
    foreach ($step in $Plan.steps) {
        $info = [System.Diagnostics.ProcessStartInfo]::new(); $info.FileName=[string]$step.command; $info.WorkingDirectory=[string]$step.workingDirectory
        $info.UseShellExecute=$false; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
        foreach ($argument in $step.arguments) { $info.ArgumentList.Add([string]$argument) }
        $process=[System.Diagnostics.Process]::new(); $process.StartInfo=$info; $stopwatch=[System.Diagnostics.Stopwatch]::StartNew()
        try {
            if (-not $process.Start()) { throw "Failed to start target '$($step.component):$($step.target)'." }
            $stdoutTask=$process.StandardOutput.ReadToEndAsync(); $stderrTask=$process.StandardError.ReadToEndAsync()
            $timedOut = -not $process.WaitForExit([int]$step.timeoutSeconds * 1000)
            if ($timedOut) { $process.Kill($true); $process.WaitForExit() }
            $stdout=$stdoutTask.GetAwaiter().GetResult(); $stderr=$stderrTask.GetAwaiter().GetResult(); $stopwatch.Stop()
            $exitCode = if ($timedOut) { 124 } else { $process.ExitCode }
            $result=[pscustomobject]@{ component=$step.component; target=$step.target; exitCode=$exitCode; timedOut=$timedOut; durationMilliseconds=[math]::Round($stopwatch.Elapsed.TotalMilliseconds,2); stdout=$stdout; stderr=$stderr; succeeded=-not $timedOut -and $exitCode -eq 0 }
            $results.Add($result); if (-not $result.succeeded -and -not $ContinueOnError) { break }
        } finally { $process.Dispose(); $stopwatch.Stop() }
    }
    return [pscustomobject]@{ schemaVersion=1; target=$Plan.target; succeeded=$results.Count -eq $Plan.steps.Count -and @($results | Where-Object { -not $_.succeeded }).Count -eq 0; results=$results.ToArray() }
}

function Get-DevtAffectedComponents {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object]$Workspace,
        [string]$Base,
        [string]$Head = 'WORKTREE'
    )

    if ([string]::IsNullOrWhiteSpace($Base)) { $Base = $Workspace.defaultBase }
    Push-Location $Workspace.root
    try {
        & git rev-parse --verify "$Base^{commit}" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Git base revision not found: $Base" }
        $changedFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        $diffRange = if ($Head -eq 'WORKTREE') { $Base } else { "$Base...$Head" }
        foreach ($file in @(& git diff --name-only --diff-filter=ACDMRTUXB $diffRange)) {
            if (-not [string]::IsNullOrWhiteSpace($file)) { [void]$changedFiles.Add(([string]$file).Replace('\', '/')) }
        }
        if ($LASTEXITCODE -ne 0) { throw "git diff failed for '$diffRange'." }
        if ($Head -eq 'WORKTREE') {
            foreach ($file in @(& git ls-files --others --exclude-standard)) {
                if (-not [string]::IsNullOrWhiteSpace($file)) { [void]$changedFiles.Add(([string]$file).Replace('\', '/')) }
            }
        }

        $direct = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        $globalChange = $false
        foreach ($file in $changedFiles) {
            if ($Workspace.globalInputs -contains $file) { $globalChange = $true; continue }
            foreach ($component in $Workspace.components.Values) {
                foreach ($prefix in $component.paths) {
                    if ($file -ieq $prefix -or $file.StartsWith("$prefix/", [System.StringComparison]::OrdinalIgnoreCase)) {
                        [void]$direct.Add($component.name)
                        break
                    }
                }
            }
        }
        if ($globalChange) { foreach ($name in $Workspace.components.Keys) { [void]$direct.Add($name) } }

        $affected = [System.Collections.Generic.HashSet[string]]::new($direct, [System.StringComparer]::OrdinalIgnoreCase)
        $queue = [System.Collections.Generic.Queue[string]]::new()
        foreach ($name in $direct) { $queue.Enqueue($name) }
        while ($queue.Count -gt 0) {
            $dependency = $queue.Dequeue()
            foreach ($candidate in $Workspace.components.Values) {
                if ($candidate.dependencies -contains $dependency -and $affected.Add($candidate.name)) { $queue.Enqueue($candidate.name) }
            }
        }

        [pscustomobject]@{
            base = $Base
            head = $Head
            changedFiles = @($changedFiles | Sort-Object)
            direct = @($direct | Sort-Object)
            affected = @($affected | Sort-Object)
            globalChange = $globalChange
        }
    }
    finally {
        Pop-Location
    }
}
