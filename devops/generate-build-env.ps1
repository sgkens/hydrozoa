Import-Module ./Get-GitAutoversion.psm1

$versionInfo = Get-GitAutoversion
$version = $versionInfo.version

"BUILD_VERSION=$version" | Out-File -FilePath ./build.env -Encoding utf8
"DOCKER_TAG=hydrozoa-v$version" | Out-File -FilePath ./build.env -Encoding utf8 -Append
"RELEASE_ZIP=hydrozoa-v$version.zip" | Out-File -FilePath ./build.env -Encoding utf8 -Append

Write-Host "Generated build.env with version $version"
