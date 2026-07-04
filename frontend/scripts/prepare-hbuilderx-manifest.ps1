param(
    [switch]$Restore
)

$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $frontendRoot
$envPath = Join-Path $repoRoot ".env"
$manifestPath = Join-Path $frontendRoot "src\manifest.json"
$placeholder = "__AMAP_ANDROID_APP_KEY__"

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Missing local .env: $envPath"
}

$amapAndroidKey = $null
foreach ($line in Get-Content -LiteralPath $envPath -Encoding UTF8) {
    if ($line -match '^\s*AMAP_ANDROID_APP_KEY\s*=\s*(.+?)\s*$') {
        $amapAndroidKey = $Matches[1].Trim().Trim('"').Trim("'")
        break
    }
}
if ([string]::IsNullOrWhiteSpace($amapAndroidKey)) {
    throw "AMAP_ANDROID_APP_KEY is missing from the repository .env"
}

$manifest = [IO.File]::ReadAllText($manifestPath)
if ($Restore) {
    $updatedManifest = $manifest.Replace($amapAndroidKey, $placeholder)
    $action = "restored"
}
else {
    $updatedManifest = $manifest.Replace($placeholder, $amapAndroidKey)
    $action = "prepared"
}

if ($updatedManifest -ne $manifest) {
    [IO.File]::WriteAllText(
        $manifestPath,
        $updatedManifest,
        [Text.UTF8Encoding]::new($false)
    )
}

Write-Host "HBuilderX source manifest $action without printing local credentials."
