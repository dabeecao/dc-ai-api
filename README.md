# DC AI API Proxy

[English](README.md) | [Tiếng Việt](README_vi.md)

[![Go Version](https://img.shields.io/github/go-mod/go-version/dabeecao/dc-ai-api?color=00ADD8&logo=go)](https://golang.org)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, resilient API Proxy built in **Go** designed to rotate multiple upstream API keys, distribute request load, perform automatic key health checks, and provide an intuitive web administration dashboard alongside a feature-rich client chat interface.

> [!NOTE]
> Detailed technical documentation, developer notes, API integration examples, and reverse proxy configurations (Nginx & Cloudflare) have been moved to [dev.md](file:///opt/dc-ai-api/dev.md).

---

## 🚀 Key Features

* **Multi-Protocol Support**: Exposes endpoints compatible with **OpenAI**, **Gemini Native**, and **Claude Native** formats, translating requests on the fly.
* **Key Rotation & Load Distribution**: Automatically rotates active API keys using a round-robin strategy based on the client's requested model and protocol.
* **Smart Failover & Cooldown**: Real-time automatic retry logic on upstream key failures. Puts rate-limited (429) or connection-failed (5xx) keys into a cooldown state before safely restoring them.
* **High Concurrency Database Queue**: Features a thread-safe, non-blocking WAL database write queue to handle high-throughput statistics logging and token tracking seamlessly.
* **Health Checks & Latency Tracking**: Validates keys on startup and logs active response latencies, visible directly in the admin dashboard.
* **Secure Web Admin Panel**: Embedded glassmorphic control panel to manage client keys, upstream provider keys, fallback settings, and view real-time token/request statistics.
* **Client Chat UI**: A responsive, modern Web interface (`/chat`) with multi-modal file uploads, localized UI translations (EN/VI), smart autoscroll, and collapsible reasoning (thought) log rendering.

---

## 📂 Project Structure

```bash
dc-ai-api/
├── main.go            # Application entrypoint & Go 1.22 wildcard routing engine
├── proxy.go           # Core proxy forwarding, streaming SSE, and rotation logic
├── store.go           # SQLite database connection & high-concurrency write queue
├── admin.go           # Admin control panel APIs and CRUD operations
├── search.go          # Keyless Web Search API (Tavily & Wikipedia fallbacks)
├── logger.go          # Custom centralized logger utility
├── dev.md             # Developer & advanced API documentation
├── Dockerfile         # Docker container image recipe
├── .goreleaser.yaml   # GoReleaser configuration for automated binary packaging
├── Makefile           # Automation scripts for compiling and running
├── go.mod             # Go module dependencies
├── package.json       # Frontend package configuration (Vite, CSS dependencies)
├── .github/
│   └── workflows/
│       └── release.yml # GitHub Actions CI/CD release workflow
└── frontend/          # Single-Page Application (SPA) source files
    ├── index.html     # Admin dashboard skeleton
    ├── chat.html      # Client chat UI skeleton
    ├── chat.js        # Chat client frontend interactive logic
    ├── chat.css       # Chat layout and custom animations styling
    ├── locales/       # Multilingual translation dictionary files (en.json, vi.json)
    └── dist/          # Compiled and minified frontend assets (embedded in Go binary)
```

---

## 🛠️ Getting Started

### Prerequisites
* **Go** (version 1.22 or higher)
* **Node.js & npm** (for compiling frontend assets)

### 1. Installation & Build

Clone the repository and compile both the frontend assets and the Go binary:

```bash
# Clone the repository
git clone https://github.com/your-username/dc-ai-api.git
cd dc-ai-api

# Install frontend dependencies
npm install

# Build frontend and compile the Go binary
make build
```

### 2. Configuration

Create a `.env` file in the root directory:

```env
PORT=8080
DATABASE_FILE=database.db
ADMIN_PASSWORD=your_secure_admin_password
TAVILY_API_KEY=your_optional_tavily_search_key
PUBLIC_DOMAIN=http://localhost:8080
```

> [!TIP]
> **How to get a Tavily API Key?**
> You can obtain a free Tavily Search API key (which includes 1,000 free search queries per month) by registering an account at [Tavily AI](https://tavily.com/). 
> If `TAVILY_API_KEY` is left blank, the web search grounding feature will automatically fall back to querying Wikipedia (both English and Vietnamese articles).

### 3. Run the Server

Start the compiled binary:

```bash
make run
```

Access the admin dashboard at `http://localhost:8080/admin` and the interactive chat client at `http://localhost:8080/chat`.

### 💬 Interactive Chat Client (`/chat`)

The interactive chat client provides an intuitive user interface to converse with the rotated model pool:
* **Guest Mode**: If enabled in the admin dashboard settings (`Enable Guest API Key`), guest users can chat immediately without entering an API key. In guest mode, model selection is locked to a virtual model (`dc-ai-model`) and file uploads are limited to 5MB.
* **Key Required Mode**: If guest mode is disabled (or no guest key is configured), the chat input field is locked, and the interface automatically prompts the user to open settings and supply a valid Client API Key (prefixed with `dc_`) generated from the admin panel to start.

### 🐳 Run with Docker

You can build and run the proxy as a lightweight container. To ensure database persistence, mount a local volume to `/data`:

```bash
# Build the Docker image (Optional build-arg: PUBLIC_DOMAIN)
docker build --build-arg PUBLIC_DOMAIN=https://yourdomain.com -t dc-ai-api .

# Run the container with persistent database mount
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e ADMIN_PASSWORD="your_secure_password" \
  -e TAVILY_API_KEY="your_tavily_key" \
  --name dc-ai-api \
  dc-ai-api
```

#### 🐙 Run with Docker Compose

Alternatively, you can deploy and run the app with Docker Compose:

```bash
docker compose up -d --build
```

This automatically builds the application, mounts a local `./data` directory for persistence, and environment configurations will be read automatically from your local `.env` file.


### 🌐 Reverse Proxy with Nginx

If you deploy this application behind Nginx, configure your server block as follows to support SSE (Server-Sent Events) streaming and avoid timeout issues:

```nginx
server {
    listen 80;
    server_name proxy.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080; # Replace with your Go server port

        # Essential for streaming responses (prevents buffering delays)
        proxy_buffering off;
        proxy_cache off;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        chunked_transfer_encoding on;

        # Standard Forwarding Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for long-running AI requests
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

---

## ⚙️ Admin Dashboard Guide

To manage your API proxy, log in to the admin panel at `http://localhost:8080/admin` (configured via `ADMIN_PASSWORD` in your `.env` file).

1. **Manage Upstream Keys**:
   * Go to the **Upstream Keys** tab to add API keys from supported providers (OpenAI, Gemini, Anthropic Claude).
   * Specify which models each key exposes and check its latency/health.
   * Toggle keys active/inactive or run manual connectivity tests.
2. **Manage Client API Keys**:
   * Go to the **Client API Keys** tab to generate secure keys prefixed with `dc_` for distribution.
   * Track individual token usage and request count for each client key.
3. **Monitor Live Statistics**:
   * Review total request count, success rates, average latency, and token consumption (both upstream pool and fallback).
4. **Settings & Fallback**:
   * Configure global fallback settings (default upstream URL, backup key, and fallback model) for high-availability.
   * Define request size limits (`max_request_size_kb`) to protect server memory.

---

## 🔒 Privacy & Terms

### Privacy Policy
* **Payload Privacy**: All conversation payloads, messages, and files are streamed directly to the respective upstream AI providers. **No chat history or prompts are logged or stored** on the proxy server.
* **Metrics & Logging**: The local database only stores system operational metadata: upstream keys, client keys, session keys, and aggregate metrics (success rate, token consumption, latency).
* **Session Security**: Session tokens are database-persisted and valid for 24 hours to secure admin access.

### Terms of Service
* **Cost Liability**: You are solely responsible for any charges incurred on the upstream keys added to the rotation pool.
* **Use at Your Own Risk**: This software is provided "as is", without warranty of any kind. Authors are not responsible for account suspensions, upstream rate limits, or service blocks.
* **Provider Compliance**: You must comply with the terms of service of OpenAI, Google Gemini, and Anthropic Claude when using this proxy.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
