# PowerShell script to start the application locally (without Docker)

Write-Host "🚀 Starting WebRTC Mesh Video Call App Locally..." -ForegroundColor Green
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    @"
APPHOST=0.0.0.0
APPPORT=3000
PUBLIC_URL=http://localhost:5173
NODE_ENV=development
CORS_ALLOW_ORIGIN=*
MAX_PARTICIPANTS=4
TURNHOST=
TURNPORT=3478
TURN_SECRET=local-dev-secret-key-change-in-production-12345
TURN_REALM=webrtc
JWT_SECRET=local-dev-jwt-secret-change-in-production-67890
MONITORING_ENABLED=false
PROMETHEUS_PORT=9100
RATE_LIMIT_WS_PER_MINUTE=600
VITE_API_URL=http://localhost:3000
VITE_PUBLIC_URL=http://localhost:5173
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ .env file created" -ForegroundColor Green
}

# Start backend
Write-Host "📦 Starting backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; `$env:PORT=3000; npm start" -WindowStyle Normal

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "📦 Starting frontend dev server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Services starting!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Note: TURN server is not running. Using STUN-only mode." -ForegroundColor Yellow
Write-Host "   This may have limited reliability in some networks." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to stop services..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

