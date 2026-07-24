<#
.SYNOPSIS
Builds a versioned Hydrozoa Docker image.

.DESCRIPTION
Calculates the repository SemVer with tools/Get-ConventionalCommitVersion.ps1
and uses it as the Docker image tag. The image is also tagged as latest when
-TagLatest is supplied.

.PARAMETER ImageName
Docker image repository/name. Defaults to skgens/hydrozoa.

.PARAMETER Dockerfile
Path to the Dockerfile. Defaults to Dockerfile in the repository root.

.PARAMETER Context
Docker build context. Defaults to the repository root.

.PARAMETER TagLatest
Also tags the image as <ImageName>:latest.

.PARAMETER Push
Pushes the versioned tag and, when requested, the latest tag.

.PARAMETER BuildArgument
Additional Docker build arguments in NAME=VALUE format.

.EXAMPLE
./build-dockerimage.ps1

.EXAMPLE
./build-dockerimage.ps1 -ImageName registry.example.com/hydrozoa -TagLatest

.EXAMPLE
./build-dockerimage.ps1 -Dockerfile ./docker/Dockerfile -BuildArgument NODE_ENV=production
#>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Low')]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ImageName = 'skgens/hydrozoa',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Dockerfile = 'Dockerfile',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Context = '.',

    [Parameter()]
    [switch]$TagLatest,

    [Parameter()]
    [switch]$Push,

    [Parameter()]
    [ValidateNotNull()]
    [string[]]$BuildArgument = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = $PSScriptRoot
$dockerfilePath = [System.IO.Path]::GetFullPath(
    [System.IO.Path]::Combine($repositoryRoot, $Dockerfile)
)
$contextPath = [System.IO.Path]::GetFullPath(
    [System.IO.Path]::Combine($repositoryRoot, $Context)
)
$versionScriptPath = [System.IO.Path]::Combine(
    $repositoryRoot,
    'tools',
    'Get-ConventionalCommitVersion.ps1'
)

if (-not [System.IO.File]::Exists($versionScriptPath)) {
    throw "Version script was not found: $versionScriptPath"
}
if (-not [System.IO.File]::Exists($dockerfilePath)) {
    throw "Dockerfile was not found: $dockerfilePath"
}
if (-not [System.IO.Directory]::Exists($contextPath)) {
    throw "Docker build context was not found: $contextPath"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found on PATH.'
}

. $versionScriptPath
$versionInfo = Get-ConventionalCommitVersion
if ($null -eq $versionInfo -or [string]::IsNullOrWhiteSpace($versionInfo.Version)) {
    throw 'Get-ConventionalCommitVersion did not return a SemVer version.'
}

$version = $versionInfo.Version
$versionedTag = "${ImageName}:$version"
$dockerArguments = [System.Collections.Generic.List[string]]::new()
$dockerArguments.Add('build')
$dockerArguments.Add('--file')
$dockerArguments.Add($dockerfilePath)
$dockerArguments.Add('--tag')
$dockerArguments.Add($versionedTag)
$dockerArguments.Add('--label')
$dockerArguments.Add("org.opencontainers.image.version=$version")
$dockerArguments.Add('--build-arg')
$dockerArguments.Add("VERSION=$version")

if ($TagLatest) {
    $dockerArguments.Add('--tag')
    $dockerArguments.Add("${ImageName}:latest")
}

foreach ($argument in $BuildArgument) {
    if ($argument -notmatch '^[A-Za-z_][A-Za-z0-9_]*=.*$') {
        throw "Invalid build argument '$argument'. Expected NAME=VALUE."
    }
    $dockerArguments.Add('--build-arg')
    $dockerArguments.Add($argument)
}

$dockerArguments.Add($contextPath)

if ($PSCmdlet.ShouldProcess($versionedTag, "Build Docker image from '$dockerfilePath'")) {
    & docker @dockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed with exit code $LASTEXITCODE."
    }
}

if ($Push -and $PSCmdlet.ShouldProcess($versionedTag, 'Push Docker image')) {
    & docker push $versionedTag
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed for '$versionedTag' with exit code $LASTEXITCODE."
    }

    if ($TagLatest) {
        & docker push "${ImageName}:latest"
        if ($LASTEXITCODE -ne 0) {
            throw "Docker push failed for '${ImageName}:latest' with exit code $LASTEXITCODE."
        }
    }
}

[PSCustomObject]@{
    Image       = $ImageName
    Version     = $version
    Tag         = $versionedTag
    LatestTag   = if ($TagLatest) { "${ImageName}:latest" } else { $null }
    Pushed      = [bool]$Push
    Dockerfile  = $dockerfilePath
    BuildContext = $contextPath
}
