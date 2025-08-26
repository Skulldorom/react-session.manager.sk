# Simple release script for PowerShell
# Usage: .\release.ps1 [patch|minor|major]

param(
    [Parameter(Position = 0)]
    [ValidateSet("patch", "minor", "major")]
    [string]$ReleaseType = "patch"
)

Write-Host "🚀 Starting $ReleaseType release..." -ForegroundColor Green

# Make sure we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "❌ Please switch to main branch first" -ForegroundColor Red
    exit 1
}

# Make sure working directory is clean
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Working directory is not clean. Please commit your changes first." -ForegroundColor Red
    exit 1
}

# Pull latest changes
Write-Host "📥 Pulling latest changes..." -ForegroundColor Yellow
git pull origin main

# Run the release
Write-Host "🔖 Creating $ReleaseType release..." -ForegroundColor Yellow
npm run "release:$ReleaseType"

Write-Host "✅ Release completed successfully!" -ForegroundColor Green
Write-Host "📦 GitHub Actions will automatically build and publish to npm" -ForegroundColor Cyan
Write-Host "🔗 Check the Actions tab: https://github.com/Skulldorom/react-session.mananger.sk/actions" -ForegroundColor Cyan
