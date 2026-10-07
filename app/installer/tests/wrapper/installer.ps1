$ErrorActionPreference = 'Stop'
switch ($env:META_CORTEX_INSTALL_DIR + $env:CARGO_DIST_FORCE_INSTALL_DIR + $env:META_CORTEX_DOWNLOAD_URL + $env:INSTALLER_DOWNLOAD_URL) {
    '' { }
    default { throw 'inherited installer override was not cleared' }
}
Copy-Item -LiteralPath $env:WRAPPER_TEST_BINARY -Destination (Join-Path $env:META_CORTEX_UNMANAGED_INSTALL 'meta-cortex.exe')
