$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nexusNodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nexusNodeCommand) {
    $nexusNode = $nexusNodeCommand.Source
} else {
    $nexusNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nexusNode)) { throw 'Bitte Node.js 22.18 oder neuer installieren.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite')) { throw 'Bitte zuerst pnpm install im Projektordner ausführen.' }
& $nexusNode scripts/start.mjs
