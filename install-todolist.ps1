# Install the local "todolist" plugin into the running DSH desktop profile.
#
#   pwsh -File .\install-todolist.ps1
#
# It copies packages/todolist into the profile's node_modules, records a file:
# dependency, and appends a loader row to the profile's cordis.patch.yml.
# Every modified file is backed up next to the original with a timestamp.

param(
  [string]$Profile = $(if ($env:DSH_PROFILE_DIR) { $env:DSH_PROFILE_DIR } else { Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles\desktop' }),
  [switch]$NoEnable
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $repoRoot 'packages\todolist'
if (-not (Test-Path $source)) { throw "plugin source not found: $source" }
if (-not (Test-Path $Profile)) { throw "profile not found: $Profile" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $Profile 'node_modules\todolist'

Write-Host "[1/4] copying plugin to $target"
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($item in @('package.json', 'cordis.patch.yml', 'icon.svg', 'README.md', 'lib')) {
  Copy-Item -Recurse -Force (Join-Path $source $item) (Join-Path $target $item)
}

Write-Host "[2/4] registering dependency in profile package.json"
$pkgPath = Join-Path $Profile 'package.json'
Copy-Item $pkgPath "$pkgPath.bak-$stamp" -Force
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if ($null -eq $pkg.dependencies) {
  $pkg | Add-Member -MemberType NoteProperty -Name dependencies -Value ([pscustomobject]@{}) -Force
}
$fileSpec = 'file:' + ($source -replace '\\', '/')
$existing = $pkg.dependencies.PSObject.Properties['todolist']
if ($null -eq $existing) {
  $pkg.dependencies | Add-Member -MemberType NoteProperty -Name todolist -Value $fileSpec -Force
} else {
  $existing.Value = $fileSpec
}
$pkg | ConvertTo-Json -Depth 40 | Set-Content -Path $pkgPath -Encoding utf8

if ($NoEnable) {
  Write-Host "[3/4] -NoEnable set; skipping cordis.patch.yml edit"
  Write-Host "[4/4] done (not enabled)"
  return
}

Write-Host "[3/4] enabling plugin row in cordis.patch.yml"
$patchPath = Join-Path $Profile 'cordis.patch.yml'
Copy-Item $patchPath "$patchPath.bak-$stamp" -Force
$patch = Get-Content $patchPath -Raw
if ($patch -match '(?m)^\s*name:\s*[''"]?todolist[''"]?\s*$') {
  Write-Host "      todolist row already present; leaving as is"
} else {
  $block = @"

# --- todolist plugin (added by install-todolist.ps1) ---
- insert:
    - id: todolist
      name: todolist
"@
  Add-Content -Path $patchPath -Value $block -Encoding utf8
  Write-Host "      row appended"
}

Write-Host "[4/4] done"
Write-Host "If the GUI does not show the new entry immediately, refresh the Web GUI page."
