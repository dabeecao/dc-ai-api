package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type AdminServer struct {
	store *Store
}

func NewAdminServer(store *Store) *AdminServer {
	return &AdminServer{store: store}
}

func (a *AdminServer) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if adminPassword != "" {
			authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
			token := authHeader
			if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
				token = strings.TrimSpace(authHeader[7:])
			}
			if token == "" {
				token = r.Header.Get("x-admin-token")
			}
			if token == "" {
				token = r.URL.Query().Get("x-admin-token")
			}
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			// Validate session token first
			valid, err := a.store.ValidateSession(token)
			if err != nil || !valid {
				// Fallback to direct password comparison
				if subtle.ConstantTimeCompare([]byte(token), []byte(adminPassword)) != 1 {
					LogWarn("Unauthorized admin API access attempt from %s", r.RemoteAddr)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					w.Write([]byte(`{"error": "Unauthorized admin access token"}`))
					return
				}
			}
		}
		next(w, r)
	}
}

func (a *AdminServer) ListKeysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, a.store.ListKeys())
}

func (a *AdminServer) ListErrorLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	logs, err := a.store.ListErrorLogs()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

func (a *AdminServer) ClearErrorLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := a.store.ClearErrorLogs(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "All error logs cleared successfully"})
}

func (a *AdminServer) DeleteErrorLogHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	idStr := r.PathValue("id")
	if idStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing error log ID"})
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid error log ID"})
		return
	}
	if err := a.store.DeleteErrorLog(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Error log entry deleted successfully"})
}

type AddKeyRequest struct {
	Label           string   `json:"label"`
	Key             string   `json:"key"`
	UpstreamURL     string   `json:"upstream_url"`
	SupportsOpenAI  bool     `json:"supports_openai"`
	SupportsGemini  bool     `json:"supports_gemini"`
	SupportsClaude  bool     `json:"supports_claude"`
	AvailableModels []string `json:"available_models"`
	SelectedModels  []string `json:"selected_models"`
}

func (a *AdminServer) AddKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AddKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "API key is required"})
		return
	}

	supportsOpenAIVal := 0
	if req.SupportsOpenAI {
		supportsOpenAIVal = 1
	}
	supportsGeminiVal := 0
	if req.SupportsGemini {
		supportsGeminiVal = 1
	}
	supportsClaudeVal := 0
	if req.SupportsClaude {
		supportsClaudeVal = 1
	}

	availModelsJSON, _ := json.Marshal(req.AvailableModels)
	selModelsJSON, _ := json.Marshal(req.SelectedModels)

	if err := a.store.AddKey(
		req.Label,
		req.Key,
		req.UpstreamURL,
		supportsOpenAIVal,
		supportsGeminiVal,
		supportsClaudeVal,
		string(availModelsJSON),
		string(selModelsJSON),
	); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	LogInfo("Admin successfully added API key: %q", req.Label)
	writeJSON(w, http.StatusCreated, map[string]string{"message": "Key added successfully"})
}

type UpdateKeyRequest struct {
	Label           string   `json:"label"`
	Status          string   `json:"status"`
	Key             string   `json:"key"`
	UpstreamURL     string   `json:"upstream_url"`
	SupportsOpenAI  *bool    `json:"supports_openai"`
	SupportsGemini  *bool    `json:"supports_gemini"`
	SupportsClaude  *bool    `json:"supports_claude"`
	AvailableModels []string `json:"available_models"`
	SelectedModels  []string `json:"selected_models"`
}

func (a *AdminServer) UpdateKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	var req UpdateKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// Update key details if any are provided
	currentKey, err := a.store.GetKeyByID(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "API key not found"})
		return
	}

	newLabel := req.Label
	if newLabel == "" {
		newLabel = currentKey.Label
	}
	newKey := req.Key
	if newKey == "" {
		newKey = currentKey.Key
	}
	newURL := req.UpstreamURL
	if newURL == "" {
		newURL = currentKey.UpstreamURL
	}

	newSupportsOpenAI := currentKey.SupportsOpenAI
	if req.SupportsOpenAI != nil {
		if *req.SupportsOpenAI {
			newSupportsOpenAI = 1
		} else {
			newSupportsOpenAI = 0
		}
	}
	newSupportsGemini := currentKey.SupportsGemini
	if req.SupportsGemini != nil {
		if *req.SupportsGemini {
			newSupportsGemini = 1
		} else {
			newSupportsGemini = 0
		}
	}
	newSupportsClaude := currentKey.SupportsClaude
	if req.SupportsClaude != nil {
		if *req.SupportsClaude {
			newSupportsClaude = 1
		} else {
			newSupportsClaude = 0
		}
	}

	newAvailModels := currentKey.AvailableModels
	if req.AvailableModels != nil {
		availJSON, _ := json.Marshal(req.AvailableModels)
		newAvailModels = string(availJSON)
	}

	newSelModels := currentKey.SelectedModels
	if req.SelectedModels != nil {
		selJSON, _ := json.Marshal(req.SelectedModels)
		newSelModels = string(selJSON)
	}

	if err := a.store.UpdateKeyDetails(id, newLabel, newKey, newURL, newSupportsOpenAI, newSupportsGemini, newSupportsClaude, newAvailModels, newSelModels); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	LogInfo("Admin updated API key ID %s details (Label: %s, URL: %s)", id, newLabel, newURL)

	// Update Status if provided
	if req.Status != "" {
		if err := a.store.UpdateKeyStatus(id, req.Status); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		LogInfo("Admin updated API key %s status to %q", id, req.Status)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Key updated successfully"})
}

func (a *AdminServer) DeleteKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	if err := a.store.DeleteKey(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	LogInfo("Admin deleted API key ID: %s", id)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Key deleted successfully"})
}

func (a *AdminServer) TestKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	targetKey, err := a.store.GetKeyByID(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "API key not found"})
		return
	}

	upstreamURL := targetKey.UpstreamURL
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
	if targetKey.SupportsGemini == 1 {
		testURL = upstreamURL + "/v1beta/models?key=" + targetKey.Key
		reqHeaderKey = "x-goog-api-key"
		reqHeaderVal = targetKey.Key
	} else if targetKey.SupportsClaude == 1 && targetKey.SupportsOpenAI == 0 {
		// Use GET /v1/models for Claude — proper health check endpoint
		testURL = upstreamURL + "/v1/models"
		reqHeaderKey = "x-api-key"
		reqHeaderVal = targetKey.Key
		isClaudeTest = true
	} else {
		testURL = upstreamURL + "/v1/models"
		reqHeaderKey = "Authorization"
		reqHeaderVal = "Bearer " + targetKey.Key
	}

	LogInfo("Testing API key %q against %s...", targetKey.Label, testURL)

	req, err := http.NewRequestWithContext(r.Context(), "GET", testURL, nil)

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to build test request"})
		return
	}

	req.Header.Set(reqHeaderKey, reqHeaderVal)
	if reqHeaderKey == "Authorization" {
		req.Header.Set("x-api-key", targetKey.Key)
	}
	// Anthropic requires anthropic-version header on all requests
	if isClaudeTest {
		req.Header.Set("anthropic-version", "2023-06-01")
	}

	resp, err := httpClient.Do(req)
	if err == nil && resp.StatusCode != http.StatusOK && strings.HasSuffix(testURL, "/v1/models") {
		resp.Body.Close()
		fallbackURL := strings.TrimSuffix(testURL, "/v1/models") + "/models"
		reqFallback, errFallback := http.NewRequestWithContext(r.Context(), "GET", fallbackURL, nil)
		if errFallback == nil {
			reqFallback.Header.Set(reqHeaderKey, reqHeaderVal)
			if reqHeaderKey == "Authorization" {
				reqFallback.Header.Set("x-api-key", targetKey.Key)
			}
			if isClaudeTest {
				reqFallback.Header.Set("anthropic-version", "2023-06-01")
			}
			resp, err = httpClient.Do(reqFallback)
		}
	}

	if err != nil {
		reason := fmt.Sprintf("Network connection failed: %v", err)
		a.store.RecordFailure(targetKey.ID, reason, 502)
		LogWarn("API key %q verification failed: %s", targetKey.Label, reason)
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"success": false, "error": reason})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		reason := fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))
		a.store.RecordFailure(targetKey.ID, reason, resp.StatusCode)
		LogWarn("API key %q verification failed: %s", targetKey.Label, reason)
		writeJSON(w, resp.StatusCode, map[string]interface{}{"success": false, "error": reason})
		return
	}

	a.store.RecordSuccess(targetKey.ID, 0, 0, 0)
	LogInfo("API key %q verified successfully", targetKey.Label)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type FetchModelsRequest struct {
	Key            string `json:"key"`
	UpstreamURL    string `json:"upstream_url"`
	SupportsOpenAI *bool  `json:"supports_openai"`
	SupportsGemini *bool  `json:"supports_gemini"`
	SupportsClaude *bool  `json:"supports_claude"`
}

type FetchModelsResponse struct {
	Success        bool     `json:"success"`
	SupportsOpenAI bool     `json:"supports_openai"`
	SupportsGemini bool     `json:"supports_gemini"`
	SupportsClaude bool     `json:"supports_claude"`
	Models         []string `json:"models"`
	Error          string   `json:"error,omitempty"`
}

type modelsCacheEntry struct {
	response FetchModelsResponse
	expiry   time.Time
}

var (
	modelsCache   = make(map[string]modelsCacheEntry)
	modelsCacheMu sync.RWMutex
)

func getModelsCacheKey(key, url string) string {
	h := sha256.New()
	h.Write([]byte(key + "||" + url))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func (a *AdminServer) FetchModelsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req FetchModelsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "API key is required"})
		return
	}

	upstreamURL := req.UpstreamURL
	if upstreamURL == "" {
		upstreamURL = os.Getenv("UPSTREAM_URL")
		if upstreamURL == "" {
			upstreamURL = "https://api.b.ai"
		}
	}

	cacheKey := getModelsCacheKey(req.Key, upstreamURL)
	modelsCacheMu.RLock()
	cached, found := modelsCache[cacheKey]
	modelsCacheMu.RUnlock()

	if found && time.Now().Before(cached.expiry) {
		LogInfo("Returning cached models for upstream key prefix: %s", maskKey(req.Key))
		writeJSON(w, http.StatusOK, cached.response)
		return
	}
	upstreamURL = strings.TrimSuffix(upstreamURL, "/")
	if strings.HasSuffix(upstreamURL, "/v1") {
		upstreamURL = strings.TrimSuffix(upstreamURL, "/v1")
	} else if strings.HasSuffix(upstreamURL, "/v1beta") {
		upstreamURL = strings.TrimSuffix(upstreamURL, "/v1beta")
	}

	supportsOpenAI := false
	supportsGemini := false
	supportsClaude := false
	modelMap := make(map[string]bool)
	var models []string

	runOpenAI := req.SupportsOpenAI == nil || *req.SupportsOpenAI
	runGemini := req.SupportsGemini == nil || *req.SupportsGemini
	runClaude := req.SupportsClaude == nil || *req.SupportsClaude

	// 1. Try OpenAI v1/models
	if runOpenAI {
		openaiURL := upstreamURL + "/v1/models"
		openaiReq, err := http.NewRequestWithContext(r.Context(), "GET", openaiURL, nil)
		if err == nil {
			openaiReq.Header.Set("Authorization", "Bearer "+req.Key)
			openaiReq.Header.Set("x-api-key", req.Key)
			resp, err := httpClient.Do(openaiReq)
			if err == nil {
				if resp.StatusCode != http.StatusOK {
					resp.Body.Close()
					openaiURLFallback := upstreamURL + "/models"
					openaiReqFallback, errFallback := http.NewRequestWithContext(r.Context(), "GET", openaiURLFallback, nil)
					if errFallback == nil {
						openaiReqFallback.Header.Set("Authorization", "Bearer "+req.Key)
						openaiReqFallback.Header.Set("x-api-key", req.Key)
						resp, err = httpClient.Do(openaiReqFallback)
					}
				}
			}
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var result struct {
						Data []struct {
							ID string `json:"id"`
						} `json:"data"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
						supportsOpenAI = true
						for _, m := range result.Data {
							if m.ID != "" && !modelMap[m.ID] {
								modelMap[m.ID] = true
								models = append(models, m.ID)
							}
						}
					}
				}
			}
		}
	}

	// 2. Try Gemini Native v1beta/models
	if runGemini {
		geminiURL := upstreamURL + "/v1beta/models?key=" + req.Key
		geminiReq, err := http.NewRequestWithContext(r.Context(), "GET", geminiURL, nil)
		if err == nil {
			geminiReq.Header.Set("x-goog-api-key", req.Key)
			resp, err := httpClient.Do(geminiReq)
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var result struct {
						Models []struct {
							Name string `json:"name"`
						} `json:"models"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
						supportsGemini = true
						for _, m := range result.Models {
							name := strings.TrimPrefix(m.Name, "models/")
							if name != "" && !modelMap[name] {
								modelMap[name] = true
								models = append(models, name)
							}
						}
					}
				}
			}
		}
	}

	// 3. Try Claude Native: use GET /v1/models (proper Anthropic endpoint)
	if runClaude {
		claudeURL := upstreamURL + "/v1/models"
		claudeReq, err := http.NewRequestWithContext(r.Context(), "GET", claudeURL, nil)
		if err == nil {
			claudeReq.Header.Set("x-api-key", req.Key)
			claudeReq.Header.Set("anthropic-version", "2023-06-01")
			resp, err := httpClient.Do(claudeReq)
			if err == nil {
				if resp.StatusCode != http.StatusOK {
					resp.Body.Close()
					claudeURLFallback := upstreamURL + "/models"
					claudeReqFallback, errFallback := http.NewRequestWithContext(r.Context(), "GET", claudeURLFallback, nil)
					if errFallback == nil {
						claudeReqFallback.Header.Set("x-api-key", req.Key)
						claudeReqFallback.Header.Set("anthropic-version", "2023-06-01")
						resp, err = httpClient.Do(claudeReqFallback)
					}
				}
			}
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					bodyBytes, readErr := io.ReadAll(resp.Body)
					if readErr == nil {
						var rawMap map[string]interface{}
						if json.Unmarshal(bodyBytes, &rawMap) == nil {
							// OpenAI model listing response contains `"object": "list"`.
							// Claude Native /v1/models response does NOT.
							if obj, ok := rawMap["object"].(string); ok && obj == "list" {
								// This is OpenAI, not Claude!
							} else {
								supportsClaude = true
								var result struct {
									Data []struct {
										ID string `json:"id"`
									} `json:"data"`
								}
								if json.Unmarshal(bodyBytes, &result) == nil {
									for _, m := range result.Data {
										if m.ID != "" && !modelMap[m.ID] {
											modelMap[m.ID] = true
											models = append(models, m.ID)
										}
									}
								}
								// Fallback to well-known models if the endpoint returns no data
								if len(result.Data) == 0 {
									claudeModels := []string{
										"claude-opus-4-5",
										"claude-sonnet-4-5",
										"claude-3-5-sonnet-20241022",
										"claude-3-5-haiku-20241022",
										"claude-3-5-sonnet-latest",
										"claude-3-5-haiku-latest",
									}
									for _, m := range claudeModels {
										if !modelMap[m] {
											modelMap[m] = true
											models = append(models, m)
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	if !supportsOpenAI && !supportsGemini && !supportsClaude {
		writeJSON(w, http.StatusOK, FetchModelsResponse{
			Success:        false,
			SupportsOpenAI: false,
			SupportsGemini: false,
			SupportsClaude: false,
			Models:         []string{},
			Error:          "Failed to fetch models: Connection failed or invalid credentials on OpenAI, Gemini, & Claude endpoints",
		})
		return
	}

	respPayload := FetchModelsResponse{
		Success:        true,
		SupportsOpenAI: supportsOpenAI,
		SupportsGemini: supportsGemini,
		SupportsClaude: supportsClaude,
		Models:         models,
	}

	modelsCacheMu.Lock()
	modelsCache[cacheKey] = modelsCacheEntry{
		response: respPayload,
		expiry:   time.Now().Add(5 * time.Minute),
	}
	modelsCacheMu.Unlock()

	writeJSON(w, http.StatusOK, respPayload)
}

func (a *AdminServer) GetSettingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	settings, err := a.store.GetSettings()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (a *AdminServer) UpdateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if err := a.store.UpdateSettings(req); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	LogInfo("Admin successfully updated configuration settings")
	writeJSON(w, http.StatusOK, map[string]string{"message": "Settings updated successfully"})
}

func (a *AdminServer) StatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, a.store.GetStats())
}

// Client API Keys Handlers
func (a *AdminServer) ListClientKeysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, a.store.ListClientKeys())
}

type AddClientKeyRequest struct {
	Label string `json:"label"`
}

func (a *AdminServer) AddClientKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AddClientKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	key, err := a.store.AddClientKey(req.Label)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	LogInfo("Admin generated new Client API Key: %q", req.Label)
	writeJSON(w, http.StatusCreated, map[string]string{
		"key":     key,
		"message": "Client key generated successfully",
	})
}

type UpdateClientKeyRequest struct {
	Status string `json:"status"`
}

func (a *AdminServer) UpdateClientKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	var req UpdateClientKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Status != "" {
		if err := a.store.UpdateClientKeyStatus(id, req.Status); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		LogInfo("Admin updated Client API Key %s status to %q", id, req.Status)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Client key status updated successfully"})
}

func (a *AdminServer) DeleteClientKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	if err := a.store.DeleteClientKey(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	LogInfo("Admin deleted Client API Key ID: %s", id)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Client key deleted successfully"})
}

// Config & Auth Handlers
func (a *AdminServer) ConfigHandler(w http.ResponseWriter, r *http.Request) {
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"auth_required": adminPassword != "",
	})
}

type LoginRequest struct {
	Password string `json:"password"`
}

func (a *AdminServer) LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if adminPassword != "" && subtle.ConstantTimeCompare([]byte(req.Password), []byte(adminPassword)) != 1 {
		LogWarn("Failed admin login attempt from %s", r.RemoteAddr)
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"success": false,
			"error":   "Incorrect password",
		})
		return
	}

	sessionToken := ""
	if adminPassword != "" {
		token, err := a.store.GenerateAndCreateSession()
		if err != nil {
			LogWarn("Failed to generate admin session token: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   "Failed to generate session",
			})
			return
		}
		sessionToken = token
	}

	LogInfo("Admin successfully authenticated from %s", r.RemoteAddr)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   sessionToken,
	})
}

func (a *AdminServer) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	token := authHeader
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("x-admin-token")
	}

	if token != "" {
		_ = a.store.DeleteSession(token)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
