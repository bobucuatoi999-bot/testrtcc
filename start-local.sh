#!/bin/bash

# Bash script to start the application locally (without Docker)

echo "🚀 Starting WebRTC Mesh Video Call App Locally..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << EOF
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
EOF
    echo "✅ .env file created"
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start backend in background
echo "📦 Starting backend server..."
cd backend
PORT=3000 npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend in background
echo "📦 Starting frontend dev server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Services starting!"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "⚠️  Note: TURN server is not running. Using STUN-only mode."
echo "   This may have limited reliability in some networks."
echo ""
echo "Press Ctrl+C to stop services..."

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait

