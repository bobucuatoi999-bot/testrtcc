#!/bin/bash

echo "🚀 Mediasoup Video Call Backend - Deployment Script"
echo "=================================================="

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Create logs directory
mkdir -p logs

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and set the following:"
    echo "   - MEDIASOUP_ANNOUNCED_IP: Your server's public IP"
    echo "   - FRONTEND_URL: Your frontend URL"
    echo ""
    echo "To get your public IP, run:"
    echo "   curl ifconfig.me"
    echo ""
    read -p "Press Enter after you've configured .env file..."
fi

# Check if MEDIASOUP_ANNOUNCED_IP is set
if grep -q "YOUR_SERVER_PUBLIC_IP" .env 2>/dev/null; then
    echo "⚠️  WARNING: MEDIASOUP_ANNOUNCED_IP is not set in .env!"
    echo "   This is CRITICAL for global access."
    echo "   Get your IP with: curl ifconfig.me"
    echo ""
    read -p "Press Enter to continue anyway (NOT RECOMMENDED)..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "   npm run pm2:start"
echo ""
echo "To view logs:"
echo "   npm run pm2:logs"
echo ""
echo "To stop the server:"
echo "   npm run pm2:stop"
echo ""

