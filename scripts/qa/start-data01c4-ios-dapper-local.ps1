param(
  [switch]$SkipInstall,
  [switch]$KeepSupabase,
  [string]$AllowedEmail = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not installed or not available in PATH."
  }
}

function Parse-EnvValue([string]$Text, [string]$Name) {
  $match = [regex]::Match($Text, "(?m)^" + [regex]::Escape($Name) + "=(.*)$")
  if (-not $match.Success) {
    throw "Supabase local status did not expose $Name."
  }
  return $match.Groups[1].Value.Trim().Trim('"')
}

function New-HexSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function Stop-Tree([System.Diagnostics.Process]$Process) {
  if ($null -eq $Process -or $Process.HasExited) { return }
  try {
    taskkill /PID $Process.Id /T /F | Out-Null
  } catch {
    try { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}

Require-Command git
Require-Command node
Require-Command npm.cmd
Require-Command npx.cmd
Require-Command python
Require-Command docker
Require-Command cloudflared

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw "Run this script inside the MFL Front Office repository." }
Set-Location $repoRoot

$branch = (& git branch --show-current).Trim()
if ($branch -ne "main") {
  throw "DATA-01C4 real-device QA must run from branch 'main'. Current branch: '$branch'."
}
$dirty = (& git status --porcelain)
if ($dirty) {
  throw "Working tree must be clean before DATA-01C4 real-device QA."
}
$head = (& git rev-parse HEAD).Trim().ToLowerInvariant()
if ($head -notmatch '^[0-9a-f]{40}$') { throw "Could not resolve the current Git HEAD." }

$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -ne 22) {
  throw "Node.js 22.x is required; found major version $nodeMajor."
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop/container runtime is not available." }

$dbPath = Join-Path $repoRoot "api\data-files\mfl_database.db"
if (-not (Test-Path $dbPath)) {
  throw "Missing runtime SQLite database at $dbPath."
}

if (-not $SkipInstall) {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
}

Write-Host "[DATA-01C4] Preparing local SQLite runtime database..."
& python -m scripts.database.prepare_runtime_database $dbPath
if ($LASTEXITCODE -ne 0) { throw "Local SQLite preparation failed." }

Write-Host "[DATA-01C4] Starting isolated local Supabase stack..."
$env:SUPABASE_TELEMETRY_DISABLED = "1"
& npx.cmd --yes supabase start
if ($LASTEXITCODE -ne 0) { throw "Local Supabase start failed." }

$appProcess = $null
$tunnelProcess = $null
$tempRoot = Join-Path $env:TEMP ("mfl-data01c4-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  Write-Host "[DATA-01C4] Resetting LOCAL Supabase only and replaying repository migrations..."
  & npx.cmd --yes supabase db reset
  if ($LASTEXITCODE -ne 0) { throw "Local Supabase db reset failed." }

  $statusEnv = (& npx.cmd --yes supabase status -o env | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "Could not read local Supabase status." }
  $apiUrl = Parse-EnvValue $statusEnv "API_URL"
  $serviceRole = Parse-EnvValue $statusEnv "SERVICE_ROLE_KEY"
  $anonKey = Parse-EnvValue $statusEnv "ANON_KEY"

  $apiUri = [uri]$apiUrl
  if ($apiUri.Scheme -ne "http" -or @("127.0.0.1","localhost") -notcontains $apiUri.Host) {
    throw "Refusing non-local Supabase URL: $apiUrl"
  }

  $tunnelStdout = Join-Path $tempRoot "cloudflared.stdout.log"
  $tunnelStderr = Join-Path $tempRoot "cloudflared.stderr.log"
  $tunnelArgs = @("tunnel","--url","http://127.0.0.1:4000","--no-autoupdate")
  if ($AllowedEmail) {
    $tunnelArgs += @("--allowed-mail",$AllowedEmail)
  }
  Write-Host "[DATA-01C4] Starting temporary HTTPS tunnel..."
  $tunnelProcess = Start-Process -FilePath "cloudflared" -ArgumentList $tunnelArgs -PassThru -RedirectStandardOutput $tunnelStdout -RedirectStandardError $tunnelStderr

  $origin = ""
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    if ($tunnelProcess.HasExited) {
      throw "cloudflared exited before creating a Quick Tunnel."
    }
    $logs = ((Get-Content $tunnelStdout -Raw -ErrorAction SilentlyContinue) + [Environment]::NewLine + (Get-Content $tunnelStderr -Raw -ErrorAction SilentlyContinue))
    $match = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) {
      $origin = $match.Value.TrimEnd("/")
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $origin) {
    throw "Could not discover the temporary trycloudflare.com origin."
  }

  # Override any .env.local production values with isolated local services.
  $env:SUPABASE_URL = $apiUrl
  $env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRole
  $env:SUPABASE_ANON_KEY = $anonKey
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
  $env:WALLET_CHALLENGE_SECRET = New-HexSecret
  $env:WALLET_CHALLENGE_ORIGIN = $origin
  $env:MFL_DATABASE_PATH = $dbPath
  $env:VERCEL_URL = ""

  Write-Host "[DATA-01C4] Building exact current checkout $head ..."
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

  $appStdout = Join-Path $tempRoot "next.stdout.log"
  $appStderr = Join-Path $tempRoot "next.stderr.log"
  $appProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run","start") -PassThru -RedirectStandardOutput $appStdout -RedirectStandardError $appStderr

  $localIdentity = $null
  for ($attempt = 1; $attempt -le 80; $attempt++) {
    if ($appProcess.HasExited) {
      throw "Next production server exited before becoming ready."
    }
    try {
      $localIdentity = Invoke-RestMethod "http://127.0.0.1:4000/api/identity" -TimeoutSec 3
      break
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if ($null -eq $localIdentity) { throw "Next production server did not become ready." }
  if ([string]$localIdentity.runtime.commit -ne $head) {
    throw "Local identity mismatch: expected $head, received $($localIdentity.runtime.commit)."
  }

  $publicIdentity = Invoke-RestMethod "$origin/api/identity" -TimeoutSec 15
  if ([string]$publicIdentity.runtime.commit -ne $head) {
    throw "Tunnel identity mismatch: expected $head, received $($publicIdentity.runtime.commit)."
  }

  $challenge = Invoke-RestMethod "$origin/api/wallet-session" -TimeoutSec 15
  if ([string]$challenge.appIdentifier -ne $origin) {
    throw "Wallet challenge origin mismatch: expected $origin, received $($challenge.appIdentifier)."
  }

  Write-Host ""
  Write-Host "DATA-01C4 LOCAL QA READY" -ForegroundColor Green
  Write-Host "Git HEAD:           $head"
  Write-Host "Runtime version:    $($publicIdentity.runtime.version)"
  Write-Host "Database generated: $($publicIdentity.database.generatedAt)"
  Write-Host "iPhone URL:         $origin" -ForegroundColor Cyan
  Write-Host "Supabase:           LOCAL ONLY ($apiUrl)"
  Write-Host ""
  Write-Host "On iPhone Safari:"
  Write-Host "  1. Open the iPhone URL above and confirm Home renders."
  Write-Host "  2. Exercise cold load, SPA navigation, back/forward and foreground/resume."
  Write-Host "  3. Select Opt In and complete the real Dapper account-proof/signature flow."
  Write-Host "  4. Reload; verify linked state, Watchlist, Planner dirty state and Settings."
  Write-Host "  5. Exercise Player/Evaluation and image scroll/decode checks."
  Write-Host "  6. Select Opt Out and verify the linked session is revoked locally."
  Write-Host ""
  Write-Host "Do NOT use production Supabase credentials. This launcher overrides them with the local Docker stack."
  [void](Read-Host "Press ENTER only after the iPhone/Dapper checks are finished; local services will then stop")
}
finally {
  Stop-Tree $appProcess
  Stop-Tree $tunnelProcess
  if (-not $KeepSupabase) {
    try { & npx.cmd --yes supabase stop --no-backup | Out-Null } catch {}
  }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
