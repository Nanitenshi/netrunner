$ErrorActionPreference = 'Stop'
$gameProject = Split-Path -Parent $PSScriptRoot
$gameArchive = Join-Path $gameProject 'releases/server/batusmtg-server.tar.gz'
$gameKey = 'C:\Users\Batuh\Documents\Codex\2026-10-04\ic\work\hosting\batusmtg_ed25519'
$gameTarget = 'root@2.29.40.106'
if (!(Test-Path -LiteralPath $gameArchive)) { throw 'Das vorbereitete Serverpaket fehlt.' }
if (!(Test-Path -LiteralPath $gameKey)) { throw 'Der vorhandene SSH-Schlüssel fehlt.' }
Write-Host 'Prüfe den vorhandenen Serverzugang ...'
& ssh -o IdentitiesOnly=yes -o ConnectTimeout=10 -i $gameKey $gameTarget 'docker --version && docker compose version'
if ($LASTEXITCODE -ne 0) { throw 'Serverzugang fehlgeschlagen. Bitte nur die Fehlermeldung an Codex senden.' }
Write-Host 'Übertrage das Spielpaket ohne Konten, Spielstände oder Zugangsdaten ...'
& scp -o IdentitiesOnly=yes -i $gameKey $gameArchive "${gameTarget}:/root/batusmtg-server.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Upload fehlgeschlagen.' }
& ssh -o IdentitiesOnly=yes -i $gameKey $gameTarget 'mkdir -p /opt/batusmtg && tar -xzf /root/batusmtg-server.tar.gz -C /opt/batusmtg'
if ($LASTEXITCODE -ne 0) { throw 'Entpacken fehlgeschlagen.' }
Write-Host 'Fertig hochgeladen. Die Einrichtung fragt das Discord-Secret direkt auf deinem Server ab.'
& ssh -t -o IdentitiesOnly=yes -i $gameKey $gameTarget 'bash /opt/batusmtg/deploy/first-start.sh'
if ($LASTEXITCODE -ne 0) { throw 'Start noch nicht abgeschlossen. Die letzte Fehlermeldung hilft bei der Fortsetzung.' }
