package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var httpClient = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 90 * time.Second, // Allow slower reasoning models up to 90s to start response, then stream indefinitely
	},
}

type ProxyHandler struct {
	store *Store
}

func NewProxyHandler(store *Store) *ProxyHandler {
	return &ProxyHandler{store: store}
}

func (p *ProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// 1. Authenticate proxy client using the Client API Keys pool
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	token := authHeader
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("x-api-key")
	}
	if token == "" {
		token = r.Header.Get("x-goog-api-key")
	}
	if token == "" {
		token = r.URL.Query().Get("key")
	}

	var guestKey, guestModel string
	enableGuestKey := "1"
	if settings, err := p.store.GetSettings(); err == nil {
		guestKey = settings["guest_api_key"]
		guestModel = settings["guest_model"]
		if val, ok := settings["enable_guest_key"]; ok {
			enableGuestKey = val
		}
	}

	isGuest := guestKey != "" && token == guestKey && enableGuestKey != "0"
	isValid := false
	if isGuest {
		isValid = true
	} else {
		isValid = p.store.ValidateClientKey(token)
	}

	if !isValid {
		masked := "none"
		if token != "" {
			masked = maskKey(token)
		}
		LogWarn("Unauthorized access attempt to proxy from %s (using key: %s)", r.RemoteAddr, masked)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error": {"message": "Unauthorized: Invalid or missing client proxy API key", "type": "auth_error", "param": null, "code": "unauthorized"}}`))
		return
	}

	// 1.1 Custom handler for GET /v1/models or /models to return union of selected models of active keys
	if (r.URL.Path == "/v1/models" || r.URL.Path == "/models") && r.Method == http.MethodGet {
		if isGuest {
			mergedModels := []interface{}{
				map[string]interface{}{
					"id":       "dc-ai-model",
					"object":   "model",
					"created":  1677610602,
					"owned_by": "proxy-guest",
				},
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"object": "list",
				"data":   mergedModels,
			})
			return
		}
		var mergedModels []interface{}
		modelMap := make(map[string]bool)

		activeKeys := p.store.ListKeys()
		for _, k := range activeKeys {
			if k.Status == "active" {
				var models []string
				if err := json.Unmarshal([]byte(k.SelectedModels), &models); err == nil {
					for _, m := range models {
						if m != "" {
							normalized := cleanModelName(m)
							if !modelMap[normalized] {
								modelMap[normalized] = true
								mergedModels = append(mergedModels, map[string]interface{}{
									"id":       normalized,
									"object":   "model",
									"created":  1677610602,
									"owned_by": "proxy",
								})
							}
						}
					}
				}
			}
		}

		if len(mergedModels) == 0 {
			// fallback to the default fallback model from settings
			settings, err := p.store.GetSettings()
			fallbackModel := "gemini-2.5-flash"
			if err == nil && settings["fallback_model"] != "" {
				fallbackModel = settings["fallback_model"]
			}
			mergedModels = append(mergedModels, map[string]interface{}{
				"id":       fallbackModel,
				"object":   "model",
				"created":  1677610602,
				"owned_by": "proxy-fallback",
			})
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"object": "list",
			"data":   mergedModels,
		})
		return
	}

	// 2. Read the body into memory to allow multiple retry attempts, enforcing limits to prevent OOM
	var bodyBytes []byte
	if r.Body != nil {
		maxLimitBytes := int64(100 * 1024 * 1024) // absolute fallback limit of 100MB to prevent memory exhaustion
		settings, err := p.store.GetSettings()
		if err == nil && settings["max_request_size_kb"] != "" {
			if limitKb, parseErr := strconv.Atoi(settings["max_request_size_kb"]); parseErr == nil && limitKb > 0 {
				maxLimitBytes = int64(limitKb) * 1024
			}
		}

		var errRead error
		bodyBytes, errRead = io.ReadAll(http.MaxBytesReader(w, r.Body, maxLimitBytes))
		if errRead != nil {
			if strings.Contains(errRead.Error(), "too large") {
				LogWarn("Request from %s rejected: payload size exceeds limit of %d KB", r.RemoteAddr, maxLimitBytes/1024)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusRequestEntityTooLarge)
				w.Write([]byte(fmt.Sprintf(`{"error": {"message": "Request payload size exceeds the configured proxy limit of %d KB.", "type": "invalid_request_error", "param": null, "code": "request_too_large"}}`, maxLimitBytes/1024)))
				return
			}
			LogError("Failed to read request body: %v", errRead)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": {"message": "Failed to read request body", "type": "invalid_request_error", "param": null, "code": "bad_request"}}`))
			return
		}
	}

	isNativeGemini := strings.HasPrefix(r.URL.Path, "/v1beta/") || strings.Contains(r.URL.Path, ":generateContent") || strings.Contains(r.URL.Path, ":streamGenerateContent")

	apiType := "openai"
	if isNativeGemini {
		apiType = "gemini"
	} else if strings.Contains(r.URL.Path, "/messages") {
		apiType = "claude"
	}

	var reqMap map[string]interface{}
	if !isNativeGemini && len(bodyBytes) > 0 {
		_ = json.Unmarshal(bodyBytes, &reqMap)
	}

	// Check if this is a streaming request
	isStream := false
	if isNativeGemini {
		if strings.Contains(r.URL.Path, ":streamGenerateContent") {
			isStream = true
		}
	} else if reqMap != nil {
		if streamVal, ok := reqMap["stream"].(bool); ok && streamVal {
			isStream = true
		}
	}

	// Resolve the requested model
	requestedModel := ""
	contentType := r.Header.Get("Content-Type")
	isMultipart := strings.Contains(strings.ToLower(contentType), "multipart/form-data")
	if isMultipart && len(bodyBytes) > 0 {
		boundary := ""
		params := strings.Split(contentType, ";")
		for _, param := range params {
			param = strings.TrimSpace(param)
			if strings.HasPrefix(param, "boundary=") {
				boundary = strings.TrimPrefix(param, "boundary=")
				break
			}
		}
		if boundary != "" {
			mr := multipart.NewReader(bytes.NewReader(bodyBytes), boundary)
			for {
				p, err := mr.NextPart()
				if err != nil {
					break
				}
				if p.FormName() == "model" {
					slurp, err := io.ReadAll(p)
					if err == nil {
						requestedModel = string(slurp)
					}
					p.Close()
					break
				}
				p.Close()
			}
		}
	}

	if isNativeGemini {
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) >= 4 && parts[2] == "models" {
			modelPart := parts[3]
			if idx := strings.Index(modelPart, ":"); idx != -1 {
				requestedModel = modelPart[:idx]
			} else {
				requestedModel = modelPart
			}
		}
	} else if reqMap != nil {
		if mVal, ok := reqMap["model"].(string); ok {
			requestedModel = mVal
		}
		// If both temperature and top_p are present, remove top_p to prevent API errors
		// This applies to Claude models accessed via native Claude or OpenAI-compatible endpoint
		isClaudeModel := apiType == "claude" || strings.Contains(strings.ToLower(requestedModel), "claude")
		if isClaudeModel {
			_, hasTemp := reqMap["temperature"]
			_, hasTopP := reqMap["top_p"]
			if hasTemp && hasTopP {
				delete(reqMap, "top_p")
				if updatedBytes, err := json.Marshal(reqMap); err == nil {
					bodyBytes = updatedBytes
				}
			}
		}
	} else if r.Method == http.MethodGet {
		if strings.HasPrefix(r.URL.Path, "/v1/models/") {
			requestedModel = strings.TrimPrefix(r.URL.Path, "/v1/models/")
		} else if strings.HasPrefix(r.URL.Path, "/models/") {
			requestedModel = strings.TrimPrefix(r.URL.Path, "/models/")
		}
	}

	if isGuest && requestedModel != "" && !strings.EqualFold(requestedModel, "dc-ai-model") && !strings.EqualFold(requestedModel, guestModel) {
		LogWarn("Unauthorized model request from guest key: %s (only allowed: dc-ai-model)", requestedModel)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error": {"message": "Forbidden: Guest API key can only access model 'dc-ai-model'.", "type": "auth_error", "param": null, "code": "forbidden"}}`))
		return
	}

	isDcAIModel := strings.EqualFold(requestedModel, "dc-ai-model")
	targetModel := guestModel
	if targetModel == "" {
		targetModel = "gemini-2.5-flash-lite"
	}

	if isDcAIModel {
		requestedModel = targetModel
		if isNativeGemini {
			oldSegment := "/models/dc-ai-model"
			newSegment := "/models/" + targetModel
			if strings.Contains(r.URL.Path, oldSegment+":") {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment+":", newSegment+":", 1)
			} else if strings.Contains(r.URL.Path, oldSegment) {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment, newSegment, 1)
			}
		} else {
			if r.Method == http.MethodGet {
				oldPathSegment := "/models/dc-ai-model"
				newPathSegment := "/models/" + targetModel
				if strings.Contains(r.URL.Path, oldPathSegment) {
					r.URL.Path = strings.Replace(r.URL.Path, oldPathSegment, newPathSegment, 1)
				}
			} else if len(bodyBytes) > 0 && reqMap != nil {
				reqMap["model"] = targetModel
				if updatedBytes, err := json.Marshal(reqMap); err == nil {
					bodyBytes = updatedBytes
				}
			}
		}
	}

	isDcAssistant := strings.EqualFold(requestedModel, "dc-assistant")
	if isDcAssistant {
		requestedModel = "gemini-2.5-flash-lite"
		if isNativeGemini {
			oldSegment := "/models/dc-assistant"
			newSegment := "/models/gemini-2.5-flash-lite"
			if strings.Contains(r.URL.Path, oldSegment+":") {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment+":", newSegment+":", 1)
			} else if strings.Contains(r.URL.Path, oldSegment) {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment, newSegment, 1)
			}
		} else {
			if r.Method == http.MethodGet {
				oldPathSegment := "/models/dc-assistant"
				newPathSegment := "/models/gemini-2.5-flash-lite"
				if strings.Contains(r.URL.Path, oldPathSegment) {
					r.URL.Path = strings.Replace(r.URL.Path, oldPathSegment, newPathSegment, 1)
				}
			} else if len(bodyBytes) > 0 && reqMap != nil {
				reqMap["model"] = "gemini-2.5-flash-lite"
				if updatedBytes, err := json.Marshal(reqMap); err == nil {
					bodyBytes = updatedBytes
				}
			}
		}
	}

	// Clean up unsupported schema fields (like enumDescriptions, enum_descriptions, and items in non-arrays) from JSON body if present to prevent Gemini API 400 errors
	if len(bodyBytes) > 0 {
		var parsedBody interface{}
		if err := json.Unmarshal(bodyBytes, &parsedBody); err == nil {
			parsedBody = sanitizeGeminiPayload(parsedBody)
			if cleanedBytes, err := json.Marshal(parsedBody); err == nil {
				bodyBytes = cleanedBytes
			} else {
				LogWarn("Failed to marshal cleaned body: %v", err)
			}
		}
	}

	maxAttempts := 3
	var lastErr error
	isFallbackMode := false
	var excludedIDs []string
	resourceFailures := 0

	// Load fallback settings upfront from database (configured via Admin settings)
	fallbackSettings, _ := p.store.GetSettings()
	fallbackKey := fallbackSettings["fallback_key"]
	fallbackModel := fallbackSettings["fallback_model"]
	fallbackUpstreamURL := fallbackSettings["fallback_upstream_url"]
	fallbackAPIType := fallbackSettings["fallback_api_type"]

	if requestedModel != "" {
		exists, err := p.store.ModelExists(requestedModel)
		if err != nil {
			LogError("Failed to check if model exists in database: %v", err)
		}
		isFallbackModel := fallbackModel != "" && strings.EqualFold(requestedModel, fallbackModel)
		if !exists && !isFallbackModel {
			LogWarn("Requested model %s does not exist in configurations and is not the fallback model. Rejecting immediately.", requestedModel)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			if apiType == "gemini" {
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error": {"message": "models/%s is not found or not supported.", "status": "NOT_FOUND", "code": 404}}`, requestedModel)))
			} else if apiType == "claude" {
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error": {"type": "not_found_error", "message": "model: %s not found"}}`, requestedModel)))
			} else {
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error": {"message": "The model '%s' does not exist or you do not have access to it.", "type": "invalid_request_error", "param": null, "code": "model_not_found"}}`, requestedModel)))
			}
			return
		}
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if r.Context().Err() != nil {
			LogWarn("Client disconnected/cancelled context before attempt %d. Aborting request rotation.", attempt)
			return
		}

		var key APIKey
		var keyErr error

		if !isFallbackMode {
			if resourceFailures >= 3 {
				LogWarn("Encountered %d resource failures (429, 5xx, or network errors). Activating fallback to prevent further key exhaustion...", resourceFailures)
				isFallbackMode = true
			} else {
				key, keyErr = p.store.GetNextKeyForModelAndType(requestedModel, apiType, excludedIDs)
				if keyErr != nil {
					LogWarn("No matching active upstream keys for model %s (format: %s). Activating fallback...", requestedModel, apiType)
					isFallbackMode = true
				} else {
					matchedModel := findMatchingModel(key.SelectedModels, requestedModel)
					if matchedModel != requestedModel {
						translateModelName(requestedModel, matchedModel, isNativeGemini, r, &bodyBytes)
						requestedModel = matchedModel
					}
				}
			}
		}

		if isFallbackMode {
			// Setup fallback key details
			key = APIKey{
				ID:          "",
				Label:       "Default-Fallback",
				Key:         fallbackKey,
				UpstreamURL: fallbackUpstreamURL,
			}
			keyErr = nil

			if fallbackAPIType != "" {
				apiType = fallbackAPIType
			}

			// Determine if we should translate the model name.
			// We always translate, EXCEPT when the request is a tool response AND we are falling back within the Gemini family
			// (to avoid Google's thought_signature validation errors).
			shouldTranslate := true
			if isToolResponse(bodyBytes, isNativeGemini) {
				originalIsGemini := isNativeGemini || strings.Contains(strings.ToLower(requestedModel), "gemini")
				fallbackIsGemini := apiType == "gemini" || strings.Contains(strings.ToLower(fallbackModel), "gemini")
				if originalIsGemini && fallbackIsGemini {
					shouldTranslate = false
				}
			}

			// Transform the model name in the request (only if a specific model was requested)
			if requestedModel != "" && fallbackModel != "" && shouldTranslate {
				translateModelName(requestedModel, fallbackModel, isNativeGemini, r, &bodyBytes)
				// Update requestedModel reference for logging
				requestedModel = fallbackModel
			}
		}

		if isFallbackMode {
			p.store.RecordGCLIRequest() // track fallback request count
		}

		// Determine target URL
		finalUpstreamURL := strings.TrimSuffix(key.UpstreamURL, "/")
		if strings.HasSuffix(finalUpstreamURL, "/v1") {
			finalUpstreamURL = strings.TrimSuffix(finalUpstreamURL, "/v1")
		} else if strings.HasSuffix(finalUpstreamURL, "/v1beta") {
			finalUpstreamURL = strings.TrimSuffix(finalUpstreamURL, "/v1beta")
		}
		upstreamPath := r.URL.Path
		if strings.HasPrefix(upstreamPath, "/openai/") {
			upstreamPath = strings.TrimPrefix(upstreamPath, "/openai")
		}
		if isFallbackMode && fallbackAPIType == "gemini" {
			if strings.HasPrefix(upstreamPath, "/v1/models") {
				upstreamPath = strings.Replace(upstreamPath, "/v1/models", "/v1beta/models", 1)
			} else if strings.HasPrefix(upstreamPath, "/models") {
				upstreamPath = "/v1beta" + upstreamPath
			}
		} else if isFallbackMode && fallbackAPIType == "openai" {
			if strings.HasPrefix(upstreamPath, "/v1beta/models") {
				upstreamPath = strings.Replace(upstreamPath, "/v1beta/models", "/v1/models", 1)
			}
		} else {
			if strings.HasPrefix(upstreamPath, "/chat/completions") {
				upstreamPath = "/v1" + upstreamPath
			} else if strings.HasPrefix(upstreamPath, "/models") {
				upstreamPath = "/v1" + upstreamPath
			} else if upstreamPath == "/messages" || upstreamPath == "/messages/" {
				upstreamPath = "/v1/messages"
			}
		}
		targetURL := finalUpstreamURL + upstreamPath
		q := r.URL.Query()
		if q.Get("key") != "" {
			q.Set("key", key.Key)
			targetURL += "?" + q.Encode()
		} else if r.URL.RawQuery != "" {
			targetURL += "?" + r.URL.RawQuery
		}

		LogInfo("[Attempt %d/%d] Proxying %s (Model: %s) using key: %s (%s) to %s", attempt, maxAttempts, r.URL.Path, requestedModel, key.Label, maskKey(key.Key), targetURL)

		ctx := r.Context()
		outReq, err := http.NewRequestWithContext(ctx, r.Method, targetURL, bytes.NewReader(bodyBytes))
		if err != nil {
			LogError("Failed to create upstream request: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error": {"message": "Failed to construct proxy request", "type": "server_error"}}`))
			return
		}

		// Copy request headers except host, client auth, and hop-by-hop/connection-specific headers
		for k, vv := range r.Header {
			lowerK := strings.ToLower(k)
			if lowerK == "authorization" || lowerK == "host" || lowerK == "x-api-key" ||
				lowerK == "x-goog-api-key" || lowerK == "content-length" || lowerK == "accept-encoding" ||
				lowerK == "connection" || lowerK == "upgrade" || lowerK == "keep-alive" ||
				lowerK == "proxy-connection" || lowerK == "proxy-authenticate" ||
				lowerK == "proxy-authorization" || lowerK == "te" || lowerK == "trailers" ||
				lowerK == "transfer-encoding" {
				continue
			}
			for _, v := range vv {
				outReq.Header.Add(k, v)
			}
		}

		// Apply key credentials
		outReq.Header.Set("Authorization", "Bearer "+key.Key)
		outReq.Header.Set("x-api-key", key.Key)
		outReq.Header.Set("x-goog-api-key", key.Key)

		// Anthropic requires the anthropic-version header on all Claude API requests
		if apiType == "claude" {
			if outReq.Header.Get("anthropic-version") == "" {
				outReq.Header.Set("anthropic-version", "2023-06-01")
			}
		}

		startTime := time.Now()
		resp, err := httpClient.Do(outReq)
		duration := time.Since(startTime)

		if err != nil {
			if ctx.Err() != nil {
				LogInfo("Client disconnected. Aborting request.")
				return
			}

			if key.ID != "" {
				p.store.RecordFailure(key.ID, err.Error(), 502)
				excludedIDs = append(excludedIDs, key.ID)
			}
			if isFallbackMode {
				p.store.RecordGCLIFailure()
				LogWarn("Upstream connection failure with fallback key %s: %v. Aborting retry.", key.Label, err)
				lastErr = err
				break
			}
			LogWarn("Upstream connection failure with key %s: %v. Retrying...", key.Label, err)
			lastErr = err

			resourceFailures++

			if !isFallbackMode {
				if attempt == maxAttempts {
					maxAttempts++
				}
			}
			continue
		}

		defer resp.Body.Close()

		promptTokens := estimatePromptTokens(bodyBytes, apiType)

		if resp.StatusCode != http.StatusOK {
			errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			errorStr := string(errBody)
			if errorStr == "" {
				errorStr = resp.Status
			}

			if key.ID != "" {
				p.store.RecordFailure(key.ID, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, errorStr), resp.StatusCode)
				excludedIDs = append(excludedIDs, key.ID)
			}

			if r.Context().Err() != nil {
				LogInfo("Client disconnected during attempt %d (HTTP %d). Aborting request.", attempt, resp.StatusCode)
				return
			}

			if isRequestSpecificError(resp.StatusCode, errorStr) {
				LogWarn("Request-specific error encountered (HTTP %d). Aborting retry to avoid credit drain. Error: %s", resp.StatusCode, errorStr)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(resp.StatusCode)
				w.Write(errBody)
				return
			}

			if isFallbackMode {
				p.store.RecordGCLIFailure()
				LogWarn("Upstream returned error %d for fallback key %s. Error: %s. Aborting retry.", resp.StatusCode, key.Label, errorStr)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(resp.StatusCode)
				w.Write(errBody)
				return
			}
			LogWarn("Upstream returned error %d for key %s. Error: %s", resp.StatusCode, key.Label, errorStr)

			if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusForbidden {
				resourceFailures++
			}

			if !isFallbackMode {
				if attempt == maxAttempts {
					maxAttempts++
				}
				continue
			}

			if attempt < maxAttempts {
				continue
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(resp.StatusCode)
			w.Write(errBody)
			return
		}

		// Success
		LogInfo("Request succeeded using key %s in %v", key.Label, duration)

		// Copy upstream headers
		for k, vv := range resp.Header {
			lowerK := strings.ToLower(k)
			if lowerK == "connection" || lowerK == "upgrade" || lowerK == "keep-alive" ||
				lowerK == "proxy-connection" || lowerK == "transfer-encoding" ||
				strings.HasPrefix(lowerK, "access-control-") ||
				(isStream && lowerK == "content-length") {
				continue
			}
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(resp.StatusCode)

		// Stream response if applicable
		if isStream {
			flusher, ok := w.(http.Flusher)
			if !ok {
				LogWarn("Streaming requested but response writer doesn't support flushing, falling back to full buffer")
				respBytes, _ := io.ReadAll(resp.Body)
				pTokens, cTokens, _ := parseResponseTokens(respBytes, apiType)
				if pTokens > 0 {
					promptTokens = pTokens
				}
				completionTokens := cTokens
				if completionTokens == 0 {
					isTextGen := strings.Contains(r.URL.Path, "/chat/completions") ||
						strings.Contains(r.URL.Path, "/messages") ||
						strings.Contains(r.URL.Path, "generateContent")
					if isTextGen {
						completionTokens = int64(len(respBytes)) / 3
					} else {
						completionTokens = 0
					}
				}
				if key.ID != "" {
					p.store.RecordSuccess(key.ID, promptTokens, completionTokens, duration.Milliseconds())
				}
				if isFallbackMode {
					p.store.RecordGCLISuccess(promptTokens, completionTokens)
				}
				if token != "" {
					p.store.RecordClientKeyTokens(token, promptTokens, completionTokens)
				}
				if isDcAssistant {
					respBytes = bytes.ReplaceAll(respBytes, []byte("gemini-2.5-flash-lite"), []byte("dc-assistant"))
				}
				if isDcAIModel && targetModel != "" {
					respBytes = bytes.ReplaceAll(respBytes, []byte(targetModel), []byte("dc-ai-model"))
				}
				_, _ = w.Write(respBytes)
				return
			}

			var completionTokens int64
			buffer := make([]byte, 4096)
			var residual []byte
			for {
				n, err := resp.Body.Read(buffer)
				if n > 0 {
					chunk := buffer[:n]
					if isDcAssistant {
						chunk = bytes.ReplaceAll(chunk, []byte("gemini-2.5-flash-lite"), []byte("dc-assistant"))
					}
					if isDcAIModel && targetModel != "" {
						chunk = bytes.ReplaceAll(chunk, []byte(targetModel), []byte("dc-ai-model"))
					}
					_, writeErr := w.Write(chunk)
					if writeErr != nil {
						LogWarn("Client disconnected during stream writing: %v", writeErr)
						// Still record tokens successfully streamed
						if key.ID != "" {
							p.store.RecordSuccess(key.ID, promptTokens, completionTokens, duration.Milliseconds())
						}
						if isFallbackMode {
							p.store.RecordGCLISuccess(promptTokens, completionTokens)
						}
						if token != "" {
							p.store.RecordClientKeyTokens(token, promptTokens, completionTokens)
						}
						return
					}
					flusher.Flush()

					// Accumulate for line-by-line event token estimation
					residual = append(residual, buffer[:n]...)
					for {
						idx := bytes.IndexByte(residual, '\n')
						if idx == -1 {
							break
						}
						line := residual[:idx]
						residual = residual[idx+1:]

						lineStr := string(line)
						if strings.HasPrefix(lineStr, "data: ") {
							dataContent := strings.TrimPrefix(lineStr, "data: ")
							dataContent = strings.TrimSpace(dataContent)
							if dataContent != "" && dataContent != "[DONE]" {
								completionTokens += estimateTokensFromSSELine(dataContent, apiType)
							}
						}
					}
				}
				if err != nil {
					if err != io.EOF {
						LogError("Error reading stream from upstream: %v", err)
					}
					break
				}
			}

			// Finalize stats for successful stream
			if key.ID != "" {
				p.store.RecordSuccess(key.ID, promptTokens, completionTokens, duration.Milliseconds())
			}
			if isFallbackMode {
				p.store.RecordGCLISuccess(promptTokens, completionTokens)
			}
			if token != "" {
				p.store.RecordClientKeyTokens(token, promptTokens, completionTokens)
			}
		} else {
			respBytes, readErr := io.ReadAll(resp.Body)
			if readErr == nil {
				// Parse actual token counts if present in response
				pTokens, cTokens, _ := parseResponseTokens(respBytes, apiType)
				if pTokens > 0 {
					promptTokens = pTokens
				}
				completionTokens := cTokens
				if completionTokens == 0 {
					isTextGen := strings.Contains(r.URL.Path, "/chat/completions") ||
						strings.Contains(r.URL.Path, "/messages") ||
						strings.Contains(r.URL.Path, "generateContent")
					if isTextGen {
						completionTokens = int64(len(respBytes)) / 3
					} else {
						completionTokens = 0
					}
				}

				// Record stats
				if key.ID != "" {
					p.store.RecordSuccess(key.ID, promptTokens, completionTokens, duration.Milliseconds())
				}
				if isFallbackMode {
					p.store.RecordGCLISuccess(promptTokens, completionTokens)
				}
				if token != "" {
					p.store.RecordClientKeyTokens(token, promptTokens, completionTokens)
				}

				if isDcAssistant {
					respBytes = bytes.ReplaceAll(respBytes, []byte("gemini-2.5-flash-lite"), []byte("dc-assistant"))
				}
				if isDcAIModel && targetModel != "" {
					respBytes = bytes.ReplaceAll(respBytes, []byte(targetModel), []byte("dc-ai-model"))
				}
				w.Write(respBytes)
			} else {
				// Fallback if read error
				if key.ID != "" {
					p.store.RecordSuccess(key.ID, promptTokens, 0, duration.Milliseconds())
				}
				if isFallbackMode {
					p.store.RecordGCLISuccess(promptTokens, 0)
				}
				if token != "" {
					p.store.RecordClientKeyTokens(token, promptTokens, 0)
				}
			}
		}
		return
	}

	LogError("All proxy key attempts failed. Last error: %v", lastErr)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadGateway)
	w.Write([]byte(`{"error": {"message": "All proxy key attempts failed. Please contact the administrator.", "type": "server_error"}}`))
}

func isNonNullSchema(s interface{}) bool {
	m, ok := s.(map[string]interface{})
	if !ok {
		return false
	}
	typeVal, exists := m["type"]
	if !exists {
		return true
	}
	switch t := typeVal.(type) {
	case string:
		return strings.ToLower(t) != "null"
	case []interface{}:
		for _, item := range t {
			if itemStr, ok := item.(string); ok {
				if strings.ToLower(itemStr) != "null" {
					return true
				}
			}
		}
		return false
	}
	return true
}

func sanitizeGeminiPayload(val interface{}) interface{} {
	switch m := val.(type) {
	case map[string]interface{}:
		// 1. Resolve anyOf and oneOf
		for _, unionKey := range []string{"anyOf", "oneOf"} {
			if unionVal, exists := m[unionKey]; exists {
				if unionSlice, ok := unionVal.([]interface{}); ok && len(unionSlice) > 0 {
					var chosenSchema map[string]interface{}
					for _, item := range unionSlice {
						if itemMap, ok := item.(map[string]interface{}); ok {
							if isNonNullSchema(itemMap) {
								chosenSchema = itemMap
								break
							}
						}
					}
					if chosenSchema == nil {
						if firstMap, ok := unionSlice[0].(map[string]interface{}); ok {
							chosenSchema = firstMap
						}
					}
					if chosenSchema != nil {
						for k, v := range chosenSchema {
							m[k] = v
						}
					}
				}
				delete(m, unionKey)
			}
		}

		// 2. Resolve allOf
		if allOfVal, exists := m["allOf"]; exists {
			if allOfSlice, ok := allOfVal.([]interface{}); ok {
				for _, item := range allOfSlice {
					if itemMap, ok := item.(map[string]interface{}); ok {
						for k, v := range itemMap {
							m[k] = v
						}
					}
				}
			}
			delete(m, "allOf")
		}

		// 3. Simplify array types (e.g. ["string", "null"] -> "string")
		if typeVal, exists := m["type"]; exists {
			if typeSlice, ok := typeVal.([]interface{}); ok {
				var chosenType interface{}
				for _, item := range typeSlice {
					if itemStr, ok := item.(string); ok {
						if strings.ToLower(itemStr) != "null" {
							chosenType = item
							break
						}
					}
				}
				if chosenType == nil && len(typeSlice) > 0 {
					chosenType = typeSlice[0]
				}
				if chosenType != nil {
					m["type"] = chosenType
				}
			}
		}

		// 4. Strip target keys
		delete(m, "enumDescriptions")
		delete(m, "enum_descriptions")

		// 5. Strip "items" if type is explicitly present and is not "array"
		if _, hasItems := m["items"]; hasItems {
			if typeVal, hasType := m["type"]; hasType {
				isArrayType := false
				switch tVal := typeVal.(type) {
				case string:
					if strings.ToLower(tVal) == "array" {
						isArrayType = true
					}
				case []interface{}:
					for _, item := range tVal {
						if itemStr, ok := item.(string); ok {
							if strings.ToLower(itemStr) == "array" {
								isArrayType = true
								break
							}
						}
					}
				}
				if !isArrayType {
					delete(m, "items")
				}
			}
		}

		// 6. Recursively sanitize children
		for k, v := range m {
			m[k] = sanitizeGeminiPayload(v)
		}
	case []interface{}:
		for i, v := range m {
			m[i] = sanitizeGeminiPayload(v)
		}
	}
	return val
}

func isToolResponse(bodyBytes []byte, isNativeGemini bool) bool {
	if len(bodyBytes) == 0 {
		return false
	}
	var parsed interface{}
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return false
	}
	m, ok := parsed.(map[string]interface{})
	if !ok {
		return false
	}
	if isNativeGemini {
		contents, ok := m["contents"].([]interface{})
		if !ok {
			return false
		}
		for _, content := range contents {
			cMap, ok := content.(map[string]interface{})
			if !ok {
				continue
			}
			parts, ok := cMap["parts"].([]interface{})
			if !ok {
				continue
			}
			for _, part := range parts {
				pMap, ok := part.(map[string]interface{})
				if !ok {
					continue
				}
				if _, hasFuncResp := pMap["functionResponse"]; hasFuncResp {
					return true
				}
			}
		}
	} else {
		messages, ok := m["messages"].([]interface{})
		if !ok {
			return false
		}
		for _, msg := range messages {
			msgMap, ok := msg.(map[string]interface{})
			if !ok {
				continue
			}
			role, ok := msgMap["role"].(string)
			if !ok {
				continue
			}
			if role == "tool" || role == "function" {
				return true
			}
		}
	}
	return false
}

func isRequestSpecificError(statusCode int, body string) bool {
	// 400 Bad Request: client error
	if statusCode == http.StatusBadRequest {
		// Check if it's actually a billing or quota limit error rather than a bad client request.
		lowerBody := strings.ToLower(body)
		if strings.Contains(lowerBody, "insufficient balance") ||
			strings.Contains(lowerBody, "insufficient_user_quota") ||
			strings.Contains(lowerBody, "insufficient quota") ||
			strings.Contains(lowerBody, "out of credit") ||
			strings.Contains(lowerBody, "billing") ||
			strings.Contains(lowerBody, "quota") {
			return false // This is a key/billing failure, so rotate/fallback instead of returning immediately!
		}
		return true
	}
	// 413 Payload Too Large / Request Entity Too Large
	if statusCode == http.StatusRequestEntityTooLarge {
		return true
	}
	// 415 Unsupported Media Type
	if statusCode == http.StatusUnsupportedMediaType {
		return true
	}
	// 422 Unprocessable Entity
	if statusCode == http.StatusUnprocessableEntity {
		return true
	}
	// 404 Not Found (e.g. model not found, invalid API path)
	if statusCode == http.StatusNotFound {
		return true
	}

	// For 429 (Too Many Requests) or 503 (Service Unavailable), if it's token/context limit related:
	if statusCode == http.StatusTooManyRequests || statusCode == http.StatusServiceUnavailable {
		lowerBody := strings.ToLower(body)
		indicators := []string{
			"context_length",
			"context length",
			"token limit",
			"token_limit",
			"too many tokens",
			"maximum context",
			"maximum token",
			"exceeds the limit",
			"exceeds context",
			"exceeds the maximum",
			"payload too large",
			"request too large",
			"request size",
			"size limit",
			"string too long",
			"prompt is too long",
			"prompt length",
		}
		for _, ind := range indicators {
			if strings.Contains(lowerBody, ind) {
				return true
			}
		}
	}
	return false
}

// estimatePromptTokens estimates the token count of a request JSON body.
func estimatePromptTokens(bodyBytes []byte, apiType string) int64 {
	if len(bodyBytes) == 0 {
		return 0
	}
	trimmed := bytes.TrimSpace(bodyBytes)
	if len(trimmed) == 0 || (trimmed[0] != '{' && trimmed[0] != '[') {
		return 0
	}
	var charCount int64
	if apiType == "gemini" {
		var parsed struct {
			Contents []struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"contents"`
		}
		if err := json.Unmarshal(bodyBytes, &parsed); err == nil {
			for _, c := range parsed.Contents {
				for _, p := range c.Parts {
					charCount += int64(len(p.Text))
				}
			}
		}
	} else {
		var parsed struct {
			Messages []struct {
				Content interface{} `json:"content"`
			} `json:"messages"`
		}
		if err := json.Unmarshal(bodyBytes, &parsed); err == nil {
			for _, m := range parsed.Messages {
				switch v := m.Content.(type) {
				case string:
					charCount += int64(len(v))
				case []interface{}:
					for _, item := range v {
						if itemMap, ok := item.(map[string]interface{}); ok {
							if textVal, ok := itemMap["text"].(string); ok {
								charCount += int64(len(textVal))
							}
						}
					}
				}
			}
		}
	}

	if charCount == 0 {
		charCount = int64(len(bodyBytes)) / 2
	}

	tokens := charCount / 3
	if tokens < 1 && charCount > 0 {
		tokens = 1
	}
	return tokens
}

// parseResponseTokens extracts the exact token usage returned in non-streaming responses.
func parseResponseTokens(respBytes []byte, apiType string) (int64, int64, int64) {
	if len(respBytes) == 0 {
		return 0, 0, 0
	}

	// OpenAI structure
	var openAIUsage struct {
		Usage struct {
			PromptTokens     int64 `json:"prompt_tokens"`
			CompletionTokens int64 `json:"completion_tokens"`
			TotalTokens      int64 `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBytes, &openAIUsage); err == nil && openAIUsage.Usage.TotalTokens > 0 {
		return openAIUsage.Usage.PromptTokens, openAIUsage.Usage.CompletionTokens, openAIUsage.Usage.TotalTokens
	}

	// Gemini structure
	var geminiUsage struct {
		UsageMetadata struct {
			PromptTokenCount     int64 `json:"promptTokenCount"`
			CandidatesTokenCount int64 `json:"candidatesTokenCount"`
			TotalTokenCount      int64 `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(respBytes, &geminiUsage); err == nil && geminiUsage.UsageMetadata.TotalTokenCount > 0 {
		return geminiUsage.UsageMetadata.PromptTokenCount, geminiUsage.UsageMetadata.CandidatesTokenCount, geminiUsage.UsageMetadata.TotalTokenCount
	}

	// Claude structure
	var claudeUsage struct {
		Usage struct {
			InputTokens  int64 `json:"input_tokens"`
			OutputTokens int64 `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBytes, &claudeUsage); err == nil && (claudeUsage.Usage.InputTokens > 0 || claudeUsage.Usage.OutputTokens > 0) {
		return claudeUsage.Usage.InputTokens, claudeUsage.Usage.OutputTokens, claudeUsage.Usage.InputTokens + claudeUsage.Usage.OutputTokens
	}

	return 0, 0, 0
}

// estimateTokensFromSSELine parses a single complete SSE JSON line to find choices/delta/text and counts characters.
func estimateTokensFromSSELine(line string, apiType string) int64 {
	var text string
	switch apiType {
	case "gemini":
		var g struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal([]byte(line), &g); err == nil {
			for _, cand := range g.Candidates {
				for _, part := range cand.Content.Parts {
					text += part.Text
				}
			}
		}
	case "claude":
		var c struct {
			Delta struct {
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(line), &c); err == nil {
			text = c.Delta.Text
		}
	default: // openai
		var o struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(line), &o); err == nil {
			for _, choice := range o.Choices {
				text += choice.Delta.Content
			}
		}
	}

	charCount := int64(len(text))
	tokens := charCount / 3
	if tokens < 1 && charCount > 0 {
		tokens = 1
	}
	return tokens
}

func findMatchingModel(selectedModelsJSON string, requestedModel string) string {
	var models []string
	if err := json.Unmarshal([]byte(selectedModelsJSON), &models); err == nil {
		for _, m := range models {
			if strings.EqualFold(cleanModelName(m), cleanModelName(requestedModel)) {
				return m
			}
		}
	}
	return requestedModel
}

func translateModelName(requestedModel string, targetModel string, isNativeGemini bool, r *http.Request, bodyBytes *[]byte) {
	if requestedModel == "" || targetModel == "" || strings.EqualFold(requestedModel, targetModel) {
		return
	}
	if isNativeGemini {
		reqSub := cleanModelName(requestedModel)
		tgtSub := cleanModelName(targetModel)
		if reqSub != tgtSub {
			oldSegment := "/models/" + reqSub
			newSegment := "/models/" + tgtSub
			if strings.Contains(r.URL.Path, oldSegment+":") {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment+":", newSegment+":", 1)
			} else if strings.Contains(r.URL.Path, oldSegment) {
				r.URL.Path = strings.Replace(r.URL.Path, oldSegment, newSegment, 1)
			}
		}
	} else {
		if r.Method == http.MethodGet {
			oldPathSegment := "/models/" + requestedModel
			newPathSegment := "/models/" + targetModel
			if strings.Contains(r.URL.Path, oldPathSegment) {
				r.URL.Path = strings.Replace(r.URL.Path, oldPathSegment, newPathSegment, 1)
			}
		} else if len(*bodyBytes) > 0 {
			var bodyMap map[string]interface{}
			if err := json.Unmarshal(*bodyBytes, &bodyMap); err == nil {
				bodyMap["model"] = targetModel
				// Clean up top_p for Claude models to prevent API errors (if temperature is also present)
				if strings.Contains(strings.ToLower(targetModel), "claude") {
					_, hasTemp := bodyMap["temperature"]
					_, hasTopP := bodyMap["top_p"]
					if hasTemp && hasTopP {
						delete(bodyMap, "top_p")
					}
				}
				if updatedBytes, err := json.Marshal(bodyMap); err == nil {
					*bodyBytes = updatedBytes
				}
			}
		}
	}
}
