.PHONY: setup up down build test clean deploy logs

# Setup: Install dependencies
setup:
	@echo "Setting up backend dependencies..."
	cd backend && npm install
	@echo "Setting up frontend dependencies..."
	cd frontend && npm install
	@echo "Setup complete!"

# Start services
up:
	@echo "Starting Docker Compose services..."
	docker-compose up -d
	@echo "Services started! Frontend: http://localhost:5173, Backend: http://localhost:3000"

# Stop services
down:
	@echo "Stopping Docker Compose services..."
	docker-compose down -v
	@echo "Services stopped!"

# Build images
build:
	@echo "Building Docker images..."
	docker-compose build
	@echo "Build complete!"

# Run tests
test:
	@echo "Running E2E tests..."
	cd tests && chmod +x run-tests.sh && ./run-tests.sh

# Clean up
clean:
	@echo "Cleaning up..."
	docker-compose down -v
	docker system prune -f
	@echo "Cleanup complete!"

# View logs
logs:
	docker-compose logs -f

# Production build
build-prod:
	@echo "Building production images..."
	docker-compose -f docker-compose.prod.yml build

# Production up
up-prod:
	@echo "Starting production services..."
	docker-compose -f docker-compose.prod.yml up -d

# Production down
down-prod:
	@echo "Stopping production services..."
	docker-compose -f docker-compose.prod.yml down

# Production logs
logs-prod:
	docker-compose -f docker-compose.prod.yml logs -f

# Deploy instructions
deploy:
	@echo "=== Railway Deployment Instructions ==="
	@echo "1. Push your code to GitHub"
	@echo "2. Create a new Railway project"
	@echo "3. Connect your GitHub repository"
	@echo "4. Create two services:"
	@echo "   - Backend: Use backend/Dockerfile, Port 3000"
	@echo "   - Frontend: Use frontend/Dockerfile, Port 5173"
	@echo "5. Set environment variables from .env.example"
	@echo "6. Set PUBLIC_URL to your Railway domain (HTTPS)"
	@echo "7. Configure TURN server (see README for options)"
	@echo "8. Deploy and test!"
	@echo ""
	@echo "For detailed instructions, see README.md"

