$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $frontendRoot
$envPath = Join-Path $repoRoot ".env"
$manifestPath = Join-Path $frontendRoot "src\manifest.json"
$outputRoot = Join-Path $frontendRoot "dist\build\app"
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

$originalManifest = [IO.File]::ReadAllText($manifestPath)
if (-not $originalManifest.Contains($placeholder)) {
    throw "AMap Android key placeholder is missing from src/manifest.json"
}

try {
    $injectedManifest = $originalManifest.Replace($placeholder, $amapAndroidKey)
    [IO.File]::WriteAllText(
        $manifestPath,
        $injectedManifest,
        [Text.UTF8Encoding]::new($false)
    )

    Push-Location $frontendRoot
    try {
        & npm.cmd run build:app
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build:app failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    $nativePluginSource = Join-Path $frontendRoot "nativeplugins"
    $nativePluginTarget = Join-Path $outputRoot "nativeplugins"
    if (-not (Test-Path -LiteralPath $nativePluginSource)) {
        throw "Native plugin source is missing: $nativePluginSource"
    }
    Copy-Item -LiteralPath $nativePluginSource -Destination $nativePluginTarget -Recurse -Force

    # Preserve src/static paths referenced by the compiled manifest.
    $sourceStaticPath = Join-Path $frontendRoot "src\static"
    $outputSourceRootPath = Join-Path $outputRoot "src"
    if (-not (Test-Path -LiteralPath $sourceStaticPath)) {
        throw "Source static assets are missing: $sourceStaticPath"
    }
    New-Item -ItemType Directory -Path $outputSourceRootPath -Force | Out-Null
    Copy-Item -LiteralPath $sourceStaticPath -Destination $outputSourceRootPath -Recurse -Force

    $builtManifest = Join-Path $outputRoot "manifest.json"
    if (-not (Test-Path -LiteralPath $builtManifest)) {
        throw "Built manifest is missing: $builtManifest"
    }
    $builtManifestText = [IO.File]::ReadAllText($builtManifest)
    if ($builtManifestText.Contains($placeholder)) {
        throw "Built manifest still contains the AMap key placeholder"
    }
}
finally {
    [IO.File]::WriteAllText(
        $manifestPath,
        $originalManifest,
        [Text.UTF8Encoding]::new($false)
    )
}

Write-Host "App package prepared at $outputRoot"
