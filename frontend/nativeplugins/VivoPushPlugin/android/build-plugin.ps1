param(
    [string]$AndroidSdk = "D:\000MyWorkSpace\001Tools\AndroidSdk",
    [string]$JavaHome = "D:\000MyWorkSpace\001Tools\HBuilderX\plugins\amazon-corretto"
)

$ErrorActionPreference = "Stop"
$androidDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $androidDir "..\..\..\..")).Path
$envFile = Join-Path $repoRoot ".env"
$work = Join-Path $env:TEMP "daoyou-nativeplugin-build"
$classes = Join-Path $work "classes"
$vivo = Join-Path $work "vivo"
$aar = Join-Path $androidDir "VivoPushPlugin-release.aar"
$androidJar = Join-Path $AndroidSdk "platforms\android-34\android.jar"
$vivoAar = Join-Path $androidDir "vpush_clientSdk_v4.1.5.0_515.aar"
$javac = Join-Path $JavaHome "bin\javac.exe"
$jar = Join-Path $JavaHome "bin\jar.exe"

function Read-DotEnv {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing environment file: $Path"
    }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$matches[1]] = $value
        }
    }
    return $values
}

$environment = Read-DotEnv -Path $envFile
$vivoAppId = $environment["VIVO_PUSH_APP_ID"]
$vivoAppKey = $environment["VIVO_PUSH_APP_KEY"]
if ([string]::IsNullOrWhiteSpace($vivoAppId) -or
    [string]::IsNullOrWhiteSpace($vivoAppKey)) {
    throw "VIVO_PUSH_APP_ID and VIVO_PUSH_APP_KEY must be set in $envFile"
}

if (Test-Path $work) {
    Remove-Item -LiteralPath $work -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $classes, $vivo | Out-Null
Expand-Archive -LiteralPath $vivoAar -DestinationPath $vivo

$vivoClasspath = @(
    (Join-Path $vivo "classes.jar")
    (Get-ChildItem (Join-Path $vivo "libs") -Filter *.jar | ForEach-Object FullName)
) -join ";"

$sources = @(
    Get-ChildItem (Join-Path $androidDir "src\main\java") -Recurse -Filter *.java
    Get-ChildItem (Join-Path $androidDir "build-support") -Recurse -Filter *.java
) | ForEach-Object FullName

& $javac -source 11 -target 11 -encoding UTF-8 `
    -classpath "$androidJar;$vivoClasspath" `
    -d $classes $sources
if ($LASTEXITCODE -ne 0) {
    throw "javac failed with exit code $LASTEXITCODE"
}

# compile-only stubs must not be bundled; HBuilderX supplies these at runtime.
Remove-Item (Join-Path $classes "io") -Recurse -Force
Remove-Item (Join-Path $classes "com\alibaba") -Recurse -Force

$aarRoot = Join-Path $work "aar"
New-Item -ItemType Directory -Force -Path $aarRoot | Out-Null
$sourceManifest = Join-Path $androidDir "src\main\AndroidManifest.xml"
$targetManifest = Join-Path $aarRoot "AndroidManifest.xml"
$manifestContent = Get-Content -LiteralPath $sourceManifest -Raw
if (-not $manifestContent.Contains("__VIVO_PUSH_APP_ID__") -or
    -not $manifestContent.Contains("__VIVO_PUSH_APP_KEY__")) {
    throw "Source AndroidManifest.xml must contain vivo credential placeholders"
}
$manifestContent = $manifestContent.Replace("__VIVO_PUSH_APP_ID__", $vivoAppId)
$manifestContent = $manifestContent.Replace("__VIVO_PUSH_APP_KEY__", $vivoAppKey)
Set-Content -LiteralPath $targetManifest -Value $manifestContent -Encoding UTF8
& $jar --create --file (Join-Path $aarRoot "classes.jar") -C $classes .
Set-Content -Path (Join-Path $aarRoot "R.txt") -Value "" -NoNewline
$zip = [System.IO.Path]::ChangeExtension($aar, ".zip")
if (Test-Path $aar) {
    Remove-Item -LiteralPath $aar -Force
}
if (Test-Path $zip) {
    Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $aarRoot "*") -DestinationPath $zip
Move-Item -LiteralPath $zip -Destination $aar

Write-Output $aar
