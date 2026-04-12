$ErrorActionPreference = "Stop"

$root = "c:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly"
$backend = Join-Path $root "backend"

# Start backend in background job
Start-Job -ScriptBlock {
  Set-Location -LiteralPath $using:backend
  npm run dev
} | Out-Null

# Give backend a moment to start, then show health check
Start-Sleep -Seconds 5
try {
  curl.exe -s http://localhost:5000/health | Write-Host
} catch {
  Write-Host "Backend health check failed. Verify backend logs in this terminal." -ForegroundColor Yellow
}

# Start frontend on fixed port 3000
Set-Location -LiteralPath $root
npm run dev -- --port 3000
