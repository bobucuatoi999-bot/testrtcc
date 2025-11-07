# PowerShell script to start backend and frontend services

Write-Host "🚀 Starting WebRTC Mesh Video Call Application" -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from template..." -ForegroundColor Yellow
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

# Start Backend
Write-Host "📦 Starting Backend Server (Port 3000)..." -ForegroundColor Cyan
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '🔧 Backend Server Starting...' -ForegroundColor Green; npm start" -PassThru -WindowStyle Normal

# Wait a bit
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "📦 Starting Frontend Server (Port 5173)..." -ForegroundColor Cyan
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '🎨 Frontend Server Starting...' -ForegroundColor Green; npm run dev" -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check services
Write-Host ""
Write-Host "🔍 Checking services..." -ForegroundColor Cyan

# Check backend
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Backend is running! (http://localhost:3000)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend might still be starting... Check the backend terminal window" -ForegroundColor Yellow
}

# Check frontend
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Frontend is running! (http://localhost:5173)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Frontend might still be starting... Check the frontend terminal window" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "🎉 SERVICES READY!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Open in browser: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host ""
Write-Host "📋 Quick Test:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:5173 in your browser" -ForegroundColor White
Write-Host "   2. Enter your name and create a room" -ForegroundColor White
Write-Host "   3. Open another browser tab and join the same room" -ForegroundColor White
Write-Host "   4. You should see both video feeds!" -ForegroundColor White
Write-Host ""
Write-Host "💡 To stop services: Close the terminal windows or press Ctrl+C" -ForegroundColor Gray
Write-Host ""



