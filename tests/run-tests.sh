#!/bin/bash

set -e

echo "Starting E2E tests..."

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "webrtc-backend.*Up"; then
    echo "Starting Docker Compose services..."
    docker-compose up -d
    
    echo "Waiting for services to be ready..."
    sleep 10
    
    # Wait for backend health check
    MAX_RETRIES=30
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            echo "Backend is ready!"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "Backend failed to start"
        exit 1
    fi
    
    # Wait for frontend
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f http://localhost:5173 > /dev/null 2>&1; then
            echo "Frontend is ready!"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting for frontend... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "Frontend failed to start"
        exit 1
    fi
fi

# Install test dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing test dependencies..."
    npm install puppeteer jest
fi

# Run tests
echo "Running tests..."
npm test -- tests/e2e.test.js

echo "Tests completed!"

