# Validate the real published package through Scoop's normal lifecycle.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$manifest = Get-Content "$env:GITHUB_WORKSPACE\bucket\meta-cortex.json" -Raw | ConvertFrom-Json
$originalPath = $env:PATH
$originalHome = $env:META_CORTEX_HOME
$originalScoop = $env:SCOOP
$originalWrapperCache = $env:META_CORTEX_WRAPPER_CACHE
try {
  $evidence = Join-Path $env:RUNNER_TEMP 'meta cortex Windows E2E\evidence'
  $releaseZipUrl = $manifest.architecture.'64bit'.url
  $expectedZipUrl = "https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/download/v$($manifest.version)/meta-cortex-x86_64-pc-windows-msvc.zip"
  if ($releaseZipUrl -ne $expectedZipUrl) { throw 'Scoop manifest does not select the versioned public Windows ZIP' }
  $releaseZipPath = Join-Path $env:RUNNER_TEMP 'meta-cortex-public-release.zip'
  Invoke-WebRequest -Uri $releaseZipUrl -OutFile $releaseZipPath
  $releaseZipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $releaseZipPath).Hash.ToLowerInvariant()
  $zipEvidence = @("URL: $releaseZipUrl", "Expected SHA256: $($manifest.architecture.'64bit'.hash)", "Actual SHA256: $releaseZipHash")
  $zipEvidence | Set-Content (Join-Path $evidence 'public-windows-zip-sha256.txt') -Encoding utf8
  Write-Host ($zipEvidence -join "`n")
  if ($releaseZipHash -ne $manifest.architecture.'64bit'.hash) { throw 'Public Windows ZIP SHA256 differs from the Scoop manifest' }

  # Exercise the unchanged launcher against its real published installer.
  $wrapperPinPath = Join-Path $env:GITHUB_WORKSPACE '.meta-cortex-version'
  $wrapperPin = (Get-Content -LiteralPath $wrapperPinPath -Raw).Trim()
  if ($wrapperPin -ne $manifest.version) { throw 'Published wrapper pin differs from the Scoop release' }
  $wrapperProject = Join-Path $env:RUNNER_TEMP 'Public wrapper project with spaces'
  if (Test-Path -LiteralPath $wrapperProject) { throw 'Expected a fresh public wrapper project' }
  New-Item -ItemType Directory -Path $wrapperProject | Out-Null
  $wrapperScript = Join-Path $wrapperProject 'meta-cortexw.ps1'
  Copy-Item -LiteralPath (Join-Path $env:GITHUB_WORKSPACE 'meta-cortexw.ps1') -Destination $wrapperScript
  Copy-Item -LiteralPath $wrapperPinPath -Destination (Join-Path $wrapperProject '.meta-cortex-version')
  $env:META_CORTEX_WRAPPER_CACHE = Join-Path $wrapperProject 'cache with spaces'
  if (Test-Path -LiteralPath $env:META_CORTEX_WRAPPER_CACHE) { throw 'Expected an empty public wrapper cache' }
  $cachedBinary = Join-Path (Join-Path $env:META_CORTEX_WRAPPER_CACHE $wrapperPin) 'meta-cortex.exe'
  # The wrapper calls exit, so run each invocation in its own native process.
  $coldOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wrapperScript --version)
  $coldExitCode = $LASTEXITCODE
  $coldOutput | Set-Content (Join-Path $evidence 'public-wrapper-cold.txt') -Encoding utf8
  Write-Host ($coldOutput -join "`n")
  if ($coldExitCode -ne 0 -or ($coldOutput | Select-Object -Last 1) -ne "meta-cortex $wrapperPin") { throw 'Public wrapper cold bootstrap did not run the pinned release' }
  if (-not (Test-Path -LiteralPath $cachedBinary -PathType Leaf)) { throw 'Public wrapper cold bootstrap did not populate its cache' }
  $cachedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $cachedBinary).Hash
  $cachedWriteTime = (Get-Item -LiteralPath $cachedBinary).LastWriteTimeUtc
  $warmOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wrapperScript --version)
  $warmExitCode = $LASTEXITCODE
  $warmOutput | Set-Content (Join-Path $evidence 'public-wrapper-cached.txt') -Encoding utf8
  Write-Host ($warmOutput -join "`n")
  if ($warmExitCode -ne 0 -or $warmOutput.Count -ne 1 -or $warmOutput[0] -ne "meta-cortex $wrapperPin") { throw 'Public wrapper cached invocation did not run the pinned release' }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $cachedBinary).Hash -ne $cachedHash -or (Get-Item -LiteralPath $cachedBinary).LastWriteTimeUtc -ne $cachedWriteTime) { throw 'Public wrapper cached invocation replaced its executable' }
  $wrapperEvidence = @(
    "Pin: $wrapperPin"
    "Installer: https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/download/v$wrapperPin/meta-cortex-installer.ps1"
    "Cached executable: $cachedBinary"
    "SHA256: $cachedHash"
    "Unchanged last write time UTC: $($cachedWriteTime.ToString('o'))"
    "Cold exit code: $coldExitCode"
    "Cached exit code: $warmExitCode"
  )
  $wrapperEvidence | Set-Content (Join-Path $evidence 'public-wrapper-bootstrap.txt') -Encoding utf8
  Write-Host ($wrapperEvidence -join "`n")

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
  $firstFeature = @(Get-ChildItem -LiteralPath $env:META_CORTEX_HOME -Filter native-windows.db -File -Recurse)
  if ($firstFeature.Count -ne 1) { throw 'Expected one actual native-windows feature database' }
  $featureDirectory = $firstFeature[0].Directory.FullName
  if ((Split-Path -Leaf $featureDirectory) -ne 'features') { throw 'Candidate database is not in the features directory' }
  $databases = @(Get-ChildItem -LiteralPath $featureDirectory -Filter '*.db' -File)
  if ($databases.Count -ne 2) { throw 'Expected both actual candidate feature databases' }
  foreach ($name in @('native-windows.db', 'native-windows-other.db')) {
    if (-not (Test-Path -LiteralPath (Join-Path $featureDirectory $name) -PathType Leaf)) { throw "Missing candidate feature database: $name" }
  }
  # Preserve the closed databases and any engine-managed sidecars together.
  $retained += @(Get-ChildItem -LiteralPath $featureDirectory -File | ForEach-Object { $_.FullName })
  $hashes = @{}
  foreach ($path in $retained) { $hashes[$path] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
  $upgradeFrom = $manifest.version
  if ([version]$manifest.version -gt [version]'0.12.2') {
    # Install the real published baseline from its reviewed bucket manifest,
    # then restore the tracking branch before Scoop's ordinary update.
    $bucket = Join-Path $env:SCOOP 'buckets\meta-cortex'
    $bucketBranch = git -C $bucket symbolic-ref --short HEAD
    Invoke-Scoop uninstall meta-cortex
    git -C $bucket fetch https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex d9fc52eab4de7dee15fd421a6c45029cc0b655b1
    git -C $bucket switch --detach FETCH_HEAD
    $previousManifest = Get-Content (Join-Path $bucket 'bucket\meta-cortex.json') -Raw | ConvertFrom-Json
    if ($previousManifest.version -ne '0.12.2') { throw 'Upgrade baseline manifest reports the wrong version' }
    Copy-Item (Join-Path $bucket 'bucket\meta-cortex.json') (Join-Path $evidence 'scoop-upgrade-from.json')
    Invoke-Scoop install meta-cortex/meta-cortex
    $previousVersion = & $shim --version
    if ($LASTEXITCODE -ne 0 -or $previousVersion -ne 'meta-cortex 0.12.2') { throw 'Upgrade baseline executable reports the wrong version' }
    $upgradeFrom = $previousManifest.version
    git -C $bucket switch $bucketBranch
  }
  Invoke-Scoop update
  # Scoop refreshes buckets in parallel; also require Git's actual pull result.
  git -C "$env:SCOOP\buckets\meta-cortex" pull --ff-only
  $refreshedHead = git -C "$env:SCOOP\buckets\meta-cortex" rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or $refreshedHead -ne $env:GITHUB_SHA) { throw 'Bucket refresh changed the tested source' }
  if ($upgradeFrom -eq $manifest.version) {
    $upgradeEvidence = "Same-version reinstall $upgradeFrom; an older-version upgrade is not demonstrated."
    Invoke-Scoop update meta-cortex --force
  } else {
    $upgradeEvidence = "Published package upgrade $upgradeFrom -> $($manifest.version)."
    Invoke-Scoop update meta-cortex
  }
  $updatedVersion = & $shim --version
  if ($LASTEXITCODE -ne 0 -or $updatedVersion -ne "meta-cortex $($manifest.version)") { throw 'Updated Scoop shim reports the wrong executable version' }
  $updatedListing = Invoke-Scoop list meta-cortex
  if ($LASTEXITCODE -ne 0 -or @($updatedListing | Where-Object { $_ -match $installedRow }).Count -ne 1) { throw 'Updated Scoop listing did not report the expected package version and bucket' }
  @($upgradeEvidence; $updatedListing) | Set-Content (Join-Path $evidence 'scoop-upgrade.txt') -Encoding utf8
  Write-Host $upgradeEvidence
  Write-Host ($updatedListing -join "`n")
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
  $env:META_CORTEX_WRAPPER_CACHE = $originalWrapperCache
}
