# GitHub Push Script
# Run this script after providing your GitHub repository URL

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubRepoUrl
)

Write-Host "🔗 Connecting to GitHub repository..." -ForegroundColor Cyan

# Add remote repository
git remote add origin $GitHubRepoUrl

# Check if remote was added
git remote -v

Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Cyan

# Push to GitHub (use main branch if it exists, otherwise master)
try {
    git push -u origin master
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Trying 'main' branch instead..." -ForegroundColor Yellow
    git branch -M main
    git push -u origin main
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
}

Write-Host "`n🎉 Done! Your code is now on GitHub." -ForegroundColor Green
Write-Host "You can now connect it to Railway!" -ForegroundColor Green

