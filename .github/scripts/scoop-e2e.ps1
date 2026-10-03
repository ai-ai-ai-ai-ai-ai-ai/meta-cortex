# Validate the real published package through Scoop's normal lifecycle.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$manifest = Get-Content "$env:GITHUB_WORKSPACE\bucket\meta-cortex.json" -Raw | ConvertFrom-Json
$originalPath = $env:PATH
$originalHome = $env:META_CORTEX_HOME
$originalScoop = $env:SCOOP
try {
  $env:SCOOP = Join-Path $env:RUNNER_TEMP 'Scoop package validation'
  $bootstrap = Join-Path $env:RUNNER_TEMP 'install-scoop.ps1'
  Invoke-WebRequest https://raw.githubusercontent.com/ScoopInstaller/Install/master/install.ps1 -OutFile $bootstrap
  & pwsh -NoProfile -File $bootstrap -ScoopDir $env:SCOOP -RunAsAdmin
  $scoopScript = Join-Path $env:SCOOP 'apps\scoop\current\bin\scoop.ps1'
  function Invoke-Scoop {
    & pwsh -NoProfile -File $scoopScript @args
  }
  $env:PATH = "$env:SCOOP\shims;$originalPath"
  if ($env:GITHUB_REF -eq 'refs/heads/main') {
    $bucketSource = 'https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex'
  } else {
    # Give the premerge local Git bucket a tracking branch for refresh.
    git -C $env:GITHUB_WORKSPACE switch -c scoop-ci $env:GITHUB_SHA
    $bucketSource = ([Uri]$env:GITHUB_WORKSPACE).AbsoluteUri
  }
  Invoke-Scoop bucket add meta-cortex $bucketSource
  $bucketHead = git -C "$env:SCOOP\buckets\meta-cortex" rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or $bucketHead -ne $env:GITHUB_SHA) { throw 'Scoop bucket source differs from this CI revision' }
  Invoke-Scoop install meta-cortex/meta-cortex
  $shim = (Get-Command meta-cortex -ErrorAction Stop).Source
  if (-not $shim.StartsWith("$env:SCOOP\shims\", [StringComparison]::OrdinalIgnoreCase)) { throw 'Command discovery did not select the Scoop shim' }
  $version = & $shim --version
  if ($LASTEXITCODE -ne 0 -or $version -ne "meta-cortex $($manifest.version)") { throw 'Scoop shim reports the wrong executable version' }
  $evidence = Join-Path $env:RUNNER_TEMP 'meta cortex Windows E2E\evidence'
  $listing = Invoke-Scoop list meta-cortex
  if ($LASTEXITCODE -ne 0) { throw 'Scoop installed-package listing failed' }
  $listing | Set-Content (Join-Path $evidence 'scoop-list.txt') -Encoding utf8
  Write-Host ($listing -join "`n")
  $installedRow = '^\s*meta-cortex\s+' + [Regex]::Escape($manifest.version) + '\s+meta-cortex(?:\s|$)'
  if (@($listing | Where-Object { $_ -match $installedRow }).Count -ne 1) { throw 'Scoop listing did not report the expected package version and bucket' }
  $catalog = & $shim list
  if ($LASTEXITCODE -ne 0) { throw 'Published Scoop executable command discovery failed' }
  $catalog | Set-Content (Join-Path $evidence 'scoop-catalog.yaml') -Encoding utf8
  Write-Host ($catalog -join "`n")
  $prefix = Invoke-Scoop prefix meta-cortex
  $binary = Join-Path ($prefix | Select-Object -Last 1) 'meta-cortex.exe'
  $candidateRoot = Join-Path $env:RUNNER_TEMP 'meta cortex Windows E2E'
  $env:META_CORTEX_HOME = Join-Path $candidateRoot 'clean managed home with spaces'
  $project = Join-Path $env:RUNNER_TEMP 'Scoop project with spaces'
  New-Item -ItemType Directory -Path $project | Out-Null
  git -C $project init --initial-branch=main
  $bun = Join-Path $env:META_CORTEX_HOME 'bun\bin\bun.exe'
  function Invoke-PackageRequest([hashtable] $operation) {
    $request = Join-Path $project 'request.json'
    $response = Join-Path $project 'response.yaml'
    @{ version = 1; project = $project; operation = $operation } | ConvertTo-Json -Depth 30 | Set-Content $request -Encoding utf8
    & $binary run --request $request | Set-Content $response -Encoding utf8
    $json = & $bun -e 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))' $response
    $result = ($json | ConvertFrom-Json -Depth 40).result
    if ($result.status -ne 'success') { throw 'Published package returned an unsuccessful response' }
    return $result.data
  }
  $initialized = Invoke-PackageRequest @{ group = 'Framework'; command = @{ name = 'Initialize'; arguments = @{
    harness = 'none'; instructions = 'skip'; mise = 'RequireExisting'; bun = 'RequireExisting'; vale = 'RequireExisting'
  } } }
  if ($initialized.kind -ne 'framework_initialized') { throw 'Published package Initialize failed' }
  $info = Invoke-PackageRequest @{ group = 'Framework'; command = @{ name = 'Info'; arguments = @{} } }
  if ($info.kind -ne 'framework_info') { throw 'Published package Info failed' }
  if ($info.value.cli_version -ne $manifest.version -or $info.value.framework_version -ne $manifest.version) { throw 'Published package Info reports an unexpected version' }
  $reportedProject = (Get-Item -LiteralPath $info.value.paths.project).FullName
  if ($reportedProject.StartsWith('\\?\')) { $reportedProject = $reportedProject.Substring(4) }
  if ($reportedProject -ne (Get-Item -LiteralPath $project).FullName) { throw 'Published package Info reports a different project' }
  $retained = @(
    (Join-Path $project '.meta-cortex\meta-cortex.toml'),
    (Join-Path $candidateRoot 'native project with spaces\.meta-cortex\repository-id')
  )
  foreach ($tool in @('mise', 'bun', 'vale')) { $retained += Join-Path $env:META_CORTEX_HOME "$tool\bin\$tool.exe" }
  $databases = @(Get-ChildItem $env:META_CORTEX_HOME -Filter workbench.db -Recurse)
  if ($databases.Count -ne 1) { throw 'Expected the actual candidate Workbench database' }
  $retained += $databases[0].FullName
  $hashes = @{}
  foreach ($path in $retained) { $hashes[$path] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
  Invoke-Scoop update
  # Scoop refreshes buckets in parallel; also require Git's actual pull result.
  git -C "$env:SCOOP\buckets\meta-cortex" pull --ff-only
  $refreshedHead = git -C "$env:SCOOP\buckets\meta-cortex" rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or $refreshedHead -ne $env:GITHUB_SHA) { throw 'Bucket refresh changed the tested source' }
  Invoke-Scoop update meta-cortex --force
  $updatedVersion = & $shim --version
  if ($LASTEXITCODE -ne 0 -or $updatedVersion -ne "meta-cortex $($manifest.version)") { throw 'Updated Scoop shim reports the wrong executable version' }
  Invoke-Scoop uninstall meta-cortex
  if (Test-Path -LiteralPath "$env:SCOOP\apps\meta-cortex") { throw 'Uninstall retained the package registration' }
  if (Get-ChildItem "$env:SCOOP\shims" -Filter 'meta-cortex*') { throw 'Uninstall retained a package shim' }
  foreach ($path in $retained) {
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $hashes[$path]) { throw "Package lifecycle modified user-owned data: $path" }
  }
} finally {
  $env:PATH = $originalPath
  $env:META_CORTEX_HOME = $originalHome
  $env:SCOOP = $originalScoop
}
