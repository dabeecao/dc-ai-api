# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend/ ./frontend/
COPY vite.config.js ./
RUN npm run build

# --- Stage 2: Compile Go App ---
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app

# Enable CGO_ENABLED=0 for static standalone binary
ENV CGO_ENABLED=0 GOOS=linux

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build assets
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist


# Compile the Go application with optimization flags
RUN go build -ldflags="-s -w" -o dc-ai-api .

# --- Stage 3: Clean Final Run Container ---
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary
COPY --from=backend-builder /app/dc-ai-api .

# Expose data directory for sqlite database persistence
RUN mkdir -p /data
VOLUME /data

# Default environment configuration
ENV PORT=8080
ENV DATABASE_FILE=/data/proxy.db
ENV ADMIN_PASSWORD=""
ENV TAVILY_API_KEY=""

EXPOSE 8080

CMD ["./dc-ai-api"]
