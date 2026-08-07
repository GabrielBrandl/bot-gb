# Sobe só a Evolution API + Redis (precisa Docker Desktop iniciado).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Garantindo banco 'evolution'..."
node "$root\scripts\ensure-evolution-db.js"

$docker = $null
foreach ($candidate in @(
  "docker",
  "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
)) {
  try {
    if ($candidate -eq "docker") {
      $null = Get-Command docker -ErrorAction Stop
      $docker = "docker"
      break
    }
    if (Test-Path $candidate) {
      $docker = $candidate
      break
    }
  } catch {}
}

if (-not $docker) {
  Write-Host "Docker nao encontrado. Instale/abra o Docker Desktop e rode este script de novo."
  exit 1
}

Write-Host "Subindo Evolution..."
& $docker compose -f docker/docker-compose.evolution.yml up -d
Write-Host "Aguardando Evolution em http://localhost:8080 ..."
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest "http://localhost:8080" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -ge 200) {
      Write-Host "Evolution online."
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 3
  }
}
Write-Host "Evolution ainda iniciando. Aguarde ~30s e tente o QR de novo."
