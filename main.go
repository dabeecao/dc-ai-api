package main

import (
	"bufio"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

//go:embed frontend/dist
var embedFS embed.FS

var (
	adminPassword string
)

func loadEnv(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return // .env not found, skip silently
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])

			// Strip quotes
			if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
				(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
				val = val[1 : len(val)-1]
			}

			// Environment variables take precedence over .env file
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
	}
	if err := scanner.Err(); err != nil {
		fmt.Printf("WARNING: Error reading .env file: %v\n", err)
	}
}

func main() {
	// 1. Load Configurations from .env (if exists)
	loadEnv(".env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbFile := os.Getenv("DATABASE_FILE")
	if dbFile == "" {
		dbFile = "proxy.db"
	}

	adminPassword = os.Getenv("ADMIN_PASSWORD")

	// 2. Initialize Store
	store, err := NewStore(dbFile)
	if err != nil {
		fmt.Printf("CRITICAL: Failed to initialize SQLite store: %v\n", err)
		os.Exit(1)
	}
	storeInstance = store

	// Start periodic cooldown keys cleaner background task
	store.StartCooldownCleaner(context.Background())

	LogInfo("DC AI API Proxy starting up...")
	LogInfo("SQLite database file: %s", dbFile)

	go testAllKeysOnStartup(store)

	if adminPassword != "" {
		LogInfo("Admin Dashboard Portal authentication: ENABLED (locked by password)")
	} else {
		LogWarn("Admin Dashboard Portal authentication: DISABLED (public access - set ADMIN_PASSWORD in .env to secure)")
	}

	// 3. Setup embedded static file server
	webFS, err := fs.Sub(embedFS, "frontend/dist")
	if err != nil {
		fmt.Printf("CRITICAL: Failed to initialize embedded sub-fs: %v\n", err)
		os.Exit(1)
	}
	fileServerHandler := http.FileServer(http.FS(webFS))
	fileServer := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServerHandler.ServeHTTP(w, r)
	})

	// Define Routing
	mux := http.NewServeMux()

	// Admin UI Assets
	mux.Handle("GET /admin/", http.StripPrefix("/admin/", fileServer))
	mux.HandleFunc("GET /admin", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusMovedPermanently)
	})

	// Chat UI Page
	mux.HandleFunc("GET /chat", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, err := fs.ReadFile(webFS, "chat.html")
		if err != nil {
			http.Error(w, "Chat page not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})
	mux.HandleFunc("/{$}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status": "up", "message": "DC AI API Proxy is running"}`))
			return
		}

		if r.Method == http.MethodGet {
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			data, err := fs.ReadFile(webFS, "landing.html")
			if err != nil {
				// Fallback to JSON status if landing.html not found
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"status": "up", "message": "DC AI API Proxy is running"}`))
				return
			}
			w.Write(data)
			return
		}

		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	// Public Documentation routes
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, err := fs.ReadFile(webFS, "docs.html")
		if err != nil {
			http.Error(w, "Documentation page not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})

	mux.HandleFunc("GET /openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Content-Type", "application/json")
		data, err := fs.ReadFile(webFS, "openapi.json")
		if err != nil {
			http.Error(w, "OpenAPI specifications not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})

	// Public Search API route
	mux.HandleFunc("GET /api/search", handleSearch)

	// Public Guest Config route
	mux.HandleFunc("GET /api/guest-config", handleGuestConfig)

	// B.AI Proxied Client routes
	proxyHandler := NewProxyHandler(store)
	mux.Handle("/v1/", proxyHandler)
	mux.Handle("/v1beta/", proxyHandler)
	mux.Handle("/openai/", proxyHandler)
	mux.Handle("/models", proxyHandler)
	mux.Handle("/models/", proxyHandler)
	mux.Handle("/chat/completions", proxyHandler)
	mux.Handle("/messages", proxyHandler)
	mux.Handle("/messages/", proxyHandler)

	// Admin API CRUD routes (B.AI Upstream Keys)
	adminServer := NewAdminServer(store)
	mux.HandleFunc("GET /admin/api/keys", adminServer.RequireAuth(adminServer.ListKeysHandler))
	mux.HandleFunc("POST /admin/api/keys", adminServer.RequireAuth(adminServer.AddKeyHandler))
	mux.HandleFunc("PUT /admin/api/keys/{id}", adminServer.RequireAuth(adminServer.UpdateKeyHandler))
	mux.HandleFunc("DELETE /admin/api/keys/{id}", adminServer.RequireAuth(adminServer.DeleteKeyHandler))
	mux.HandleFunc("POST /admin/api/keys/{id}/test", adminServer.RequireAuth(adminServer.TestKeyHandler))
	mux.HandleFunc("POST /admin/api/keys/fetch-models", adminServer.RequireAuth(adminServer.FetchModelsHandler))
	mux.HandleFunc("GET /admin/api/error-logs", adminServer.RequireAuth(adminServer.ListErrorLogsHandler))
	mux.HandleFunc("DELETE /admin/api/error-logs", adminServer.RequireAuth(adminServer.ClearErrorLogsHandler))
	mux.HandleFunc("DELETE /admin/api/error-logs/{id}", adminServer.RequireAuth(adminServer.DeleteErrorLogHandler))

	// Admin API CRUD routes (Client API Keys)
	mux.HandleFunc("GET /admin/api/client-keys", adminServer.RequireAuth(adminServer.ListClientKeysHandler))
	mux.HandleFunc("POST /admin/api/client-keys", adminServer.RequireAuth(adminServer.AddClientKeyHandler))
	mux.HandleFunc("PUT /admin/api/client-keys/{id}", adminServer.RequireAuth(adminServer.UpdateClientKeyHandler))
	mux.HandleFunc("DELETE /admin/api/client-keys/{id}", adminServer.RequireAuth(adminServer.DeleteClientKeyHandler))

	// Config and Login (Public/Auth endpoints)
	mux.HandleFunc("GET /admin/api/config", adminServer.ConfigHandler)
	mux.HandleFunc("POST /admin/api/login", adminServer.LoginHandler)
	mux.HandleFunc("POST /admin/api/logout", adminServer.RequireAuth(adminServer.LogoutHandler))

	// Settings routes
	mux.HandleFunc("GET /admin/api/settings", adminServer.RequireAuth(adminServer.GetSettingsHandler))
	mux.HandleFunc("PUT /admin/api/settings", adminServer.RequireAuth(adminServer.UpdateSettingsHandler))

	// Stats route
	mux.HandleFunc("GET /admin/api/stats", adminServer.RequireAuth(adminServer.StatsHandler))

	// 4. Start Server with Graceful Shutdown
	addr := ":" + port
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		LogInfo("Server listening on http://localhost%s", addr)
		LogInfo("Admin Panel accessible at http://localhost%s/admin", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("CRITICAL: Server crashed: %v\n", err)
			os.Exit(1)
		}
	}()

	// Block until signal received
	<-stop
	LogInfo("Shutting down gracefully...")

	// Create a context with timeout for server shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		LogError("Server graceful shutdown failed: %v", err)
	} else {
		LogInfo("HTTP server stopped cleanly.")
	}

	// Close SQLite database
	if err := store.Close(); err != nil {
		LogError("Failed to close SQLite store: %v", err)
	} else {
		LogInfo("SQLite database connection closed safely.")
	}
}

func testAllKeysOnStartup(s *Store) {
	time.Sleep(1 * time.Second)

	rows, err := s.db.Query("SELECT id, label, key, upstream_url, supports_openai, supports_gemini, supports_claude FROM upstream_keys WHERE status != 'disabled'")
	if err != nil {
		LogError("Startup key test query failed: %v", err)
		return
	}
	defer rows.Close()

	type keyInfo struct {
		id, label, key, url string
		supportsOpenAI      int
		supportsGemini      int
		supportsClaude      int
	}
	var keys []keyInfo
	for rows.Next() {
		var k keyInfo
		if err := rows.Scan(&k.id, &k.label, &k.key, &k.url, &k.supportsOpenAI, &k.supportsGemini, &k.supportsClaude); err == nil {
			keys = append(keys, k)
		}
	}

	LogInfo("Starting background health check for %d upstream keys...", len(keys))
	for _, k := range keys {
		go func(ki keyInfo) {
			upstreamURL := ki.url
			if upstreamURL == "" {
				upstreamURL = os.Getenv("UPSTREAM_URL")
				if upstreamURL == "" {
					upstreamURL = "https://api.b.ai"
				}
			}
			upstreamURL = strings.TrimSuffix(upstreamURL, "/")
			if strings.HasSuffix(upstreamURL, "/v1") {
				upstreamURL = strings.TrimSuffix(upstreamURL, "/v1")
			} else if strings.HasSuffix(upstreamURL, "/v1beta") {
				upstreamURL = strings.TrimSuffix(upstreamURL, "/v1beta")
			}

			var testURL string
			var reqHeaderKey, reqHeaderVal string
			var isClaudeTest bool
			if ki.supportsGemini == 1 {
				testURL = upstreamURL + "/v1beta/models?key=" + ki.key
				reqHeaderKey = "x-goog-api-key"
				reqHeaderVal = ki.key
			} else if ki.supportsClaude == 1 && ki.supportsOpenAI == 0 {
				// Use GET /v1/models for Claude — proper health check endpoint
				testURL = upstreamURL + "/v1/models"
				reqHeaderKey = "x-api-key"
				reqHeaderVal = ki.key
				isClaudeTest = true
			} else {
				testURL = upstreamURL + "/v1/models"
				reqHeaderKey = "Authorization"
				reqHeaderVal = "Bearer " + ki.key
			}

			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			req, err := http.NewRequestWithContext(ctx, "GET", testURL, nil)

			if err != nil {
				s.RecordFailure(ki.id, "Failed to build test request: "+err.Error(), 500)
				LogWarn("API key %q startup verification failed: failed to build test request", ki.label)
				return
			}
			req.Header.Set(reqHeaderKey, reqHeaderVal)
			if reqHeaderKey == "Authorization" {
				req.Header.Set("x-api-key", ki.key)
			}
			// Anthropic requires anthropic-version header on all requests
			if isClaudeTest {
				req.Header.Set("anthropic-version", "2023-06-01")
			}

			resp, err := httpClient.Do(req)
			if err == nil && resp.StatusCode != http.StatusOK && strings.HasSuffix(testURL, "/v1/models") {
				resp.Body.Close()
				fallbackURL := strings.TrimSuffix(testURL, "/v1/models") + "/models"
				reqFallback, errFallback := http.NewRequestWithContext(ctx, "GET", fallbackURL, nil)
				if errFallback == nil {
					reqFallback.Header.Set(reqHeaderKey, reqHeaderVal)
					if reqHeaderKey == "Authorization" {
						reqFallback.Header.Set("x-api-key", ki.key)
					}
					if isClaudeTest {
						reqFallback.Header.Set("anthropic-version", "2023-06-01")
					}
					resp, err = httpClient.Do(reqFallback)
				}
			}

			if err != nil {
				reason := fmt.Sprintf("Network connection failed: %v", err)
				s.RecordFailure(ki.id, reason, 502)
				LogWarn("API key %q startup verification failed: %s", ki.label, reason)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
				reason := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))
				s.RecordFailure(ki.id, reason, resp.StatusCode)
				LogWarn("API key %q startup verification failed: %s", ki.label, reason)
				return
			}

			s.RecordSuccess(ki.id, 0, 0, 0)
			LogInfo("API key %q startup verified successfully", ki.label)
		}(k)
	}
}

func handleGuestConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	settings, err := storeInstance.GetSettings()
	guestKey := ""
	if err == nil && settings["enable_guest_key"] != "0" {
		guestKey = settings["guest_api_key"]
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"guest_api_key": guestKey,
		"guest_model":   "dc-ai-model",
	})
}
