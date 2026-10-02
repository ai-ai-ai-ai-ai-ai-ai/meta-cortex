class WindowsMiseInstaller {
    static [void] Install() {
        $ErrorActionPreference = 'Stop'
        $ProgressPreference = 'SilentlyContinue'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/jdx/mise/releases/latest'
        $assetName = "mise-$($release.tag_name)-windows-$env:META_CORTEX_MISE_ARCH.exe"
        $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
        switch ($asset) {
            $null { throw "mise release does not contain $assetName" }
            default {
                Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $env:META_CORTEX_MISE_EXE
            }
        }
    }
}

[WindowsMiseInstaller]::Install()
