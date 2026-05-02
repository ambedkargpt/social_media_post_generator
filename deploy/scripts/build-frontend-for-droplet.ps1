# Build Vite frontend with a pre-domain API base (same-origin /api on Nginx).
# Usage: .\build-frontend-for-droplet.ps1 -ApiUrl "http://YOUR_DROPLET_IP/api/v1"
param(
    [Parameter(Mandatory = $true)]
    [string] $ApiUrl
)
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location (Join-Path $RepoRoot "frontend")
$env:VITE_API_URL = $ApiUrl
npm ci
npm run build
Write-Host "Output: $(Join-Path $RepoRoot 'frontend\dist')"
Write-Host "Sync: scp -r dist/* root@<IP>:/var/www/ambedkar/"
