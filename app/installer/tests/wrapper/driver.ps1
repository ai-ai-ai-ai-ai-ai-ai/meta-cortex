$ErrorActionPreference = 'Stop'
function Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile)
    $version = (Get-Content -LiteralPath (Join-Path (Split-Path $env:WRAPPER_TEST_SCRIPT) '.meta-cortex-version') -Raw).Trim()
    switch ($Uri) {
        "https://github.com/ai-ai-ai-ai-ai-ai-ai/meta-cortex/releases/download/v$version/meta-cortex-installer.ps1" { }
        default { throw "Unexpected pinned installer URI: $Uri" }
    }
    Add-Content -LiteralPath $env:WRAPPER_DOWNLOAD_LOG -Value $Uri
    switch ($env:WRAPPER_DOWNLOAD_FAILURE) {
        'yes' { throw 'fixture download failed' }
    }
    Copy-Item -LiteralPath $env:WRAPPER_TEST_INSTALLER -Destination $OutFile
}
$arguments = Get-Content -LiteralPath $env:WRAPPER_TEST_ARGUMENTS
& $env:WRAPPER_TEST_SCRIPT @arguments
exit $LASTEXITCODE
