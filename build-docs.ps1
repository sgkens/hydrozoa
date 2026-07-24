<#
.SYNOPSIS
Builds or serves the Hydrozoa Jekyll documentation.

.DESCRIPTION
Runs the repository documentation through Bundler and Jekyll. Use -Build for
a static build, -Serve for the local documentation server, or -LiveReload to
start the server with browser reload support. -Trace enables Jekyll stack
traces for any operation.

.PARAMETER Build
Builds the documentation into the destination directory.

.PARAMETER Serve
Starts the local Jekyll documentation server.

.PARAMETER LiveReload
Starts the documentation server with Jekyll live reload enabled.

.PARAMETER Trace
Adds Jekyll's --trace option.

.PARAMETER Destination
Static build destination. Defaults to _site in the repository root.

.PARAMETER HostName
Host address used by -Serve or -LiveReload. Defaults to 127.0.0.1.

.PARAMETER Port
Port used by -Serve or -LiveReload. Defaults to 4000.

.EXAMPLE
./build-docs.ps1 -Build

.EXAMPLE
./build-docs.ps1 -Build -Trace

.EXAMPLE
./build-docs.ps1 -Serve

.EXAMPLE
./build-docs.ps1 -LiveReload -Trace
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$Build,

    [Parameter()]
    [switch]$Serve,

    [Parameter()]
    [switch]$LiveReload,

    [Parameter()]
    [switch]$Trace,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Destination = '_site',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$HostName = '127.0.0.1',

    [Parameter()]
    [ValidateRange(1, 65535)]
    [int]$Port = 4000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Build -and ($Serve -or $LiveReload)) {
    throw '-Build cannot be combined with -Serve or -LiveReload.'
}
if (-not ($Build -or $Serve -or $LiveReload)) {
    throw 'Select an operation: -Build, -Serve, or -LiveReload.'
}
if (-not (Get-Command bundle -ErrorAction SilentlyContinue)) {
    throw 'Bundler was not found on PATH. Install it with: gem install bundler'
}

$repositoryRoot = $PSScriptRoot
$docsPath = [System.IO.Path]::Combine($repositoryRoot, 'docs')
$gemfilePath = [System.IO.Path]::Combine($docsPath, 'Gemfile')
$destinationPath = [System.IO.Path]::GetFullPath(
    [System.IO.Path]::Combine($repositoryRoot, $Destination)
)

if (-not [System.IO.File]::Exists($gemfilePath)) {
    throw "Documentation Gemfile was not found: $gemfilePath"
}

$jekyllArguments = [System.Collections.Generic.List[string]]::new()
$jekyllArguments.Add('exec')
$jekyllArguments.Add('jekyll')

if ($Build) {
    $jekyllArguments.Add('build')
    $jekyllArguments.Add('--destination')
    $jekyllArguments.Add($destinationPath)
}
else {
    $jekyllArguments.Add('serve')
    $jekyllArguments.Add('--destination')
    $jekyllArguments.Add($destinationPath)
    $jekyllArguments.Add('--host')
    $jekyllArguments.Add($HostName)
    $jekyllArguments.Add('--port')
    $jekyllArguments.Add($Port.ToString([System.Globalization.CultureInfo]::InvariantCulture))
    if ($LiveReload) {
        $jekyllArguments.Add('--livereload')
    }
}

if ($Trace) {
    $jekyllArguments.Add('--trace')
}

Push-Location $docsPath
try {
    & bundle @jekyllArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Jekyll exited with code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
