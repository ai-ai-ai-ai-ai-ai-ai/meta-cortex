# Runs against a cargo-installed native executable, with no managed tools on PATH.
# Each typed request starts a new process, exercising durable storage reopening.
[CmdletBinding()]
param([Parameter(Mandatory)][string] $Binary)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

class WindowsInstallationScenario {
    [string] $Binary
    [string] $Project
    [string] $Home
    [string] $Bun
    [string] $Evidence
    [int] $RequestNumber = 0

    WindowsInstallationScenario([hashtable] $locations) {
        $this.Binary = $locations.Binary
        $this.Project = $locations.Project
        $this.Home = $locations.Home
        $this.Bun = $locations.Bun
        $this.Evidence = $locations.Evidence
    }

    [object] Invoke([hashtable] $operation) {
        $this.RequestNumber++
        $requestPath = Join-Path $this.Evidence "request-$($this.RequestNumber).json"
        $responsePath = Join-Path $this.Evidence "response-$($this.RequestNumber).yaml"
        # JSON is a YAML subset; the CLI validates the same typed request schema.
        @{ version = 1; project = $this.Project; operation = $operation } |
            ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $requestPath -Encoding utf8
        $output = & $this.Binary run --request $requestPath
        switch ($LASTEXITCODE) {
            0 { }
            default { throw "CLI request failed ($LASTEXITCODE): $requestPath`n$($output -join "`n")" }
        }
        $output | Set-Content -LiteralPath $responsePath -Encoding utf8
        Write-Host ($output -join "`n")
        # Use the provisioned Bun YAML parser; no separate parser installation.
        $json = & $this.Bun -e 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))' $responsePath
        switch ($LASTEXITCODE) {
            0 { }
            default { throw "Unable to decode CLI response: $responsePath" }
        }
        $response = $json | ConvertFrom-Json -Depth 40
        switch ($response.result.status) {
            'success' { return $response.result.data }
            default { throw "Unexpected CLI response: $responsePath" }
        }
        throw 'CLI returned no result'
    }

    [void] Git([string[]] $arguments) {
        $output = & git -C $this.Project @arguments
        switch ($LASTEXITCODE) {
            0 { Write-Host ($output -join "`n") }
            default { throw "git $($arguments -join ' ') failed ($LASTEXITCODE)" }
        }
    }
    [void] Run() {
        $scenario = $this
        $nativeProject = $this.Project
        $managedHome = $this.Home
        $evidenceDirectory = $this.Evidence
        $linkedProject = Join-Path (Split-Path -Parent $nativeProject) 'linked worktree with spaces'
        $gitDirectory = Split-Path -Parent (Get-Command git.exe).Source
        $env:META_CORTEX_HOME = $managedHome
        # Git and Windows utilities remain available; runner-hosted mise/Bun/Vale
        # are deliberately unavailable, so Initialize must install all three.
        $env:PATH = "$env:WINDIR\System32;$env:WINDIR;$global:PSHOME;$gitDirectory"
        foreach ($tool in @('mise', 'bun', 'vale')) {
            switch (@(Get-Command $tool -ErrorAction SilentlyContinue).Count) {
                0 { }
                default { throw "Managed tool unexpectedly available before initialization: $tool" }
            }
        }
        $scenario.Git(@('init', '--initial-branch=main'))
        $scenario.Git(@('config', 'user.name', 'Windows E2E'))
        $scenario.Git(@('config', 'user.email', 'windows-e2e@example.invalid'))
        $scenario.Git(@('commit', '--allow-empty', '-m', 'Initialize E2E repository'))

        $initialized = $scenario.Invoke(@{
            group = 'Framework'; command = @{
                name = 'Initialize'; arguments = @{
                    harness = 'none'; instructions = 'skip'
                    mise = 'InstallMissing'; bun = 'InstallMissing'; vale = 'InstallMissing'
                }
            }
        })
        switch ($initialized.kind) {
            'framework_initialized' { }
            default { throw 'Framework Initialize did not complete' }
        }
        foreach ($relative in @('mise\bin\mise.exe', 'bun\bin\bun.exe', 'vale\bin\vale.exe')) {
            $toolPath = Join-Path $managedHome $relative
            switch (Test-Path -LiteralPath $toolPath -PathType Leaf) {
                $true { }
                $false { throw "Initialize did not provision $toolPath" }
            }
            & $toolPath --version
            switch ($LASTEXITCODE) {
                0 { }
                default { throw "Provisioned executable failed: $toolPath" }
            }
        }
        $env:PATH = "$(Join-Path $managedHome 'bun\bin');$env:PATH"
        Push-Location (Join-Path $nativeProject '.meta-cortex')
        try {
            & $scenario.Bun scripts/src/ts/check-library-root.ts
            switch ($LASTEXITCODE) {
                0 { }
                default { throw 'The installed framework library-root check failed natively' }
            }
        } finally {
            Pop-Location
        }
        $info = $scenario.Invoke(@{ group = 'Framework'; command = @{ name = 'Info'; arguments = @{} } })
        switch ($info.kind) {
            'framework_info' { }
            default { throw 'Framework Info failed' }
        }
        # Rust canonicalize returns Windows extended paths. Resolve the existing
        # fixture directories, then normalize the local-drive prefix for comparison.
        $reportedProject = (Get-Item -LiteralPath $info.value.paths.project -Force).FullName
        $expectedProject = (Get-Item -LiteralPath $nativeProject -Force).FullName
        switch ($reportedProject.StartsWith('\\?\')) {
            $true { $reportedProject = $reportedProject.Substring(4) }
            $false { }
        }
        switch ($reportedProject) {
            $expectedProject { }
            default { throw 'Framework Info did not retain the native project directory' }
        }
        switch (Test-Path -LiteralPath (Join-Path $nativeProject '.meta-cortex\node_modules\effect')) {
            $true { }
            $false { throw 'Initialize did not install the shared framework dependencies' }
        }
        $catalog = & $scenario.Binary list
        switch ($LASTEXITCODE) {
            0 { }
            default { throw 'Command discovery failed' }
        }
        $catalogPath = Join-Path $evidenceDirectory 'catalog.yaml'
        $catalog | Set-Content -LiteralPath $catalogPath -Encoding utf8
        $catalogJson = & $scenario.Bun -e 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))' $catalogPath
        switch ($LASTEXITCODE) {
            0 { }
            default { throw 'Catalog YAML parsing failed' }
        }
        $commands = ($catalogJson | ConvertFrom-Json -Depth 60).commands
        foreach ($group in @('framework', 'feature', 'task', 'workbench')) {
            switch (@($commands.$group).Count) {
                0 { throw "Missing command group: $group" }
                default { }
            }
        }

        $feature = $scenario.Invoke(@{ group = 'Feature'; command = @{ name = 'Initialize'; arguments = @{
            feature = 'native-windows'; objective = 'Native installed Windows workflow'
            branch = 'main'; worktree = $nativeProject
        } } })
        switch ($feature.kind) {
            'ledger' { }
            default { throw 'Feature initialization failed' }
        }
        $identityPath = Join-Path $nativeProject '.meta-cortex\repository-id'
        $identity = Get-Content -LiteralPath $identityPath -Raw
        $created = $scenario.Invoke(@{ group = 'Task'; command = @{ name = 'Create'; arguments = @{
            feature = 'native-windows'; task = 'persisted-task'; actor = @{ team = 'Gizmo'; role = 'Gizmo' }
            objective = 'Persist task through separate native CLI processes'; acceptance = @('Reopen recorded progress and history')
            dependencies = @(); workspace = @{ kind = 'read_only' }
            progress = @{ summary = 'Created on Windows'; findings = @(); next_steps = @(); checks = @(); extensions = @{} }
        } } })
        $assigned = $scenario.Invoke(@{ group = 'Task'; command = @{ name = 'Assign'; arguments = @{
            feature = 'native-windows'; task = 'persisted-task'; expected_revision = $created.value.common.revision
            actor = @{ team = 'Gizmo'; role = 'Gizmo' }
            assignment = @{ agent = @{ team = 'Sre'; role = 'CicdAgent' }; reports_to = @{ kind = 'Gizmo'; coordinator = 'Gizmo' } }
        } } })
        $claimed = $scenario.Invoke(@{ group = 'Task'; command = @{ name = 'Claim'; arguments = @{
            feature = 'native-windows'; task = 'persisted-task'; expected_revision = $assigned.value.common.revision
            agent = @{ team = 'Sre'; role = 'CicdAgent' }; ttl_seconds = 600
        } } })
        $updated = $scenario.Invoke(@{ group = 'Task'; command = @{ name = 'Update'; arguments = @{
            feature = 'native-windows'; task = 'persisted-task'; expected_revision = $claimed.value.common.revision
            agent = @{ team = 'Sre'; role = 'CicdAgent' }; attempt = $claimed.value.common.attempt
            action = @{ kind = 'progress'; ttl_seconds = 600; phase = @{ kind = 'working' }; progress = @{
                summary = 'Windows durable progress retained'; findings = @('Native PowerShell and spaced paths')
                next_steps = @('Read from linked worktree'); checks = @(); extensions = @{}
            } }
        } } })
        $getOperation = @{ group = 'Task'; command = @{ name = 'Get'; arguments = @{ feature = 'native-windows'; task = 'persisted-task' } } }
        $reopened = $scenario.Invoke($getOperation)
        switch ($reopened.value.task.common.progress.summary) {
            'Windows durable progress retained' { }
            default { throw 'Progress did not survive process restart' }
        }
        switch ($reopened.value.task.common.revision) {
            $updated.value.common.revision { }
            default { throw 'Task revision did not survive process restart' }
        }
        $scenario.Git(@('worktree', 'add', '-b', 'linked-e2e', $linkedProject))
        $scenario.Project = $linkedProject
        $linked = $scenario.Invoke($getOperation)
        switch ($linked.value.task.common.revision) {
            $updated.value.common.revision { }
            default { throw 'Linked worktree did not reopen the shared task' }
        }
        switch ($linked.value.task.state.kind) {
            'active' { }
            default { throw 'Linked worktree did not retain the claimed task state' }
        }
        $history = $scenario.Invoke(@{ group = 'Task'; command = @{ name = 'History'; arguments = @{ feature = 'native-windows'; task = 'persisted-task' } } })
        switch (@($history.value).Count) {
            4 { }
            default { throw 'History did not retain Create, Assign, Claim and Update events' }
        }
        switch (($history.value.kind | Sort-Object) -join ',') {
            'assigned,claimed,created,progress' { }
            default { throw 'History did not retain the expected lifecycle event kinds' }
        }
        $features = $scenario.Invoke(@{ group = 'Feature'; command = @{ name = 'List'; arguments = @{} } })
        switch ($features.kind) {
            'features' { }
            default { throw 'Feature discovery failed' }
        }
        switch (@($features.value).Count) {
            1 { }
            default { throw 'Feature discovery did not retain one initialized feature' }
        }
        $status = $scenario.Invoke(@{ group = 'Feature'; command = @{ name = 'Status'; arguments = @{ feature = 'native-windows' } } })
        switch ($status.value.tasks[0].task.common.revision) {
            $updated.value.common.revision { }
            default { throw 'Feature status did not reopen the durable task revision' }
        }
        $dashboard = $scenario.Invoke(@{ group = 'Workbench'; command = @{ name = 'Dashboard'; arguments = @{
            mode = 'Snapshot'; view = @{ kind = 'Task'; query = @{ feature = 'native-windows'; task = 'persisted-task' } }; page = 0
        } } })
        switch ($dashboard.kind) {
            'dashboard' { }
            default { throw 'Workbench Dashboard snapshot failed' }
        }
        foreach ($expected in @('persisted-task', 'Windows durable progress retained', 'CicdAgent')) {
            switch ($dashboard.value.content.Contains($expected)) {
                $true { }
                $false { throw "Dashboard did not retain recorded content: $expected" }
            }
        }
        $databases = @(Get-ChildItem -LiteralPath $managedHome -Filter workbench.db -Recurse)
        switch ($databases.Count) {
            1 { }
            default { throw 'Linked worktree did not reuse one repository database' }
        }
        switch (Get-Content -LiteralPath $identityPath -Raw) {
            $identity { }
            default { throw 'Linked worktree access changed repository identity' }
        }
        Write-Host "Native Windows E2E passed; evidence: $evidenceDirectory"
    }

}

# This script is the test-harness entrypoint; reusable process behavior belongs
# to the scenario fixture above. Preserve the runner environment after the test.
$originalPath = $env:PATH
$originalHome = $env:META_CORTEX_HOME
$root = Join-Path $env:RUNNER_TEMP 'meta cortex Windows E2E'
$project = Join-Path $root 'native project with spaces'
$home = Join-Path $root 'clean managed home with spaces'
$evidence = Join-Path $root 'evidence'
$scenario = [WindowsInstallationScenario]::new(@{
    Binary = [IO.Path]::GetFullPath($Binary)
    Project = $project
    Home = $home
    Bun = Join-Path $home 'bun\bin\bun.exe'
    Evidence = $evidence
})
switch ([IO.Path]::GetExtension($scenario.Binary)) {
    '.exe' { }
    default { throw 'The E2E requires an installed native Windows .exe' }
}
switch (Test-Path -LiteralPath $root) {
    $false { }
    $true { throw "Expected a clean E2E root: $root" }
}
New-Item -ItemType Directory -Path $project, $evidence | Out-Null
try {
    $scenario.Run()
} finally {
    $env:PATH = $originalPath
    $env:META_CORTEX_HOME = $originalHome
}
