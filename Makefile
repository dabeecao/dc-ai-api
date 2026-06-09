.PHONY: all build clean run dev fmt tidy help

# Default target
all: help

build:
	@echo "Building frontend using npm..."
	npm run build
	@echo "Building Go binary..."
	go build -o dc-ai-api .
	@echo "Build successful! Target: ./dc-ai-api"

clean:
	@echo "Cleaning up build artifacts..."
	rm -rf dc-ai-api frontend/dist
	@echo "Clean complete."

run: build
	@echo "Starting proxy server..."
	./dc-ai-api

dev:
	@echo "Building frontend in dev mode..."
	npm run build
	@echo "Starting server in dev mode..."
	go run .

fmt:
	@echo "Formatting Go source files..."
	go fmt ./...

tidy:
	@echo "Cleaning dependencies..."
	go mod tidy

help:
	@echo "DC AI API Proxy - Makefile Commands:"
	@echo "  make build  - Build frontend assets and compile the Go binary"
	@echo "  make run    - Build binary and run the server"
	@echo "  make dev    - Build frontend and run Go server using 'go run .'"
	@echo "  make clean  - Remove compiled binary and compiled frontend assets"
	@echo "  make fmt    - Format all Go source files"
	@echo "  make tidy   - Run 'go mod tidy' to clean up imports"
	@echo "  make help   - Show this help menu (default)"
