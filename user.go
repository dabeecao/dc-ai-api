package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

type UserServer struct {
	store *Store
}

func NewUserServer(store *Store) *UserServer {
	return &UserServer{store: store}
}

// RequireUserAuth middleware to authenticate user sessions
func (u *UserServer) RequireUserAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-token")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		token := authHeader
		if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
			token = strings.TrimSpace(authHeader[7:])
		}
		if token == "" {
			token = r.Header.Get("x-user-token")
		}

		if token == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Authentication token required"})
			return
		}

		userID, err := u.store.ValidateUserSession(token)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid or expired session: " + err.Error()})
			return
		}

		// Inject userID into request context or headers
		r.Header.Set("x-user-id", userID)
		next(w, r)
	}
}

type UserRegisterRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	TurnstileToken string `json:"cf-turnstile-response"`
}

func (u *UserServer) RegisterHandler(w http.ResponseWriter, r *http.Request) {
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

	var req UserRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// Turnstile Verification
	if ok, err := verifyTurnstile(req.TurnstileToken, r.RemoteAddr); !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Turnstile verification failed: " + err.Error()})
		return
	}

	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Username and password are required"})
		return
	}

	if err := u.store.RegisterUser(req.Username, req.Password); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"message": "Registration successful. Please wait for admin approval."})
}

type UserLoginRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	TurnstileToken string `json:"cf-turnstile-response"`
}

func (u *UserServer) LoginHandler(w http.ResponseWriter, r *http.Request) {
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

	var req UserLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// Turnstile Verification
	if ok, err := verifyTurnstile(req.TurnstileToken, r.RemoteAddr); !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Turnstile verification failed: " + err.Error()})
		return
	}

	user, err := u.store.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	if user.Status == "pending" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Tài khoản của bạn đang chờ quản trị viên duyệt. / Your account is pending administrator approval."})
		return
	}

	if user.Status == "disabled" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Tài khoản của bạn đã bị khóa. / Your account has been disabled."})
		return
	}

	token, err := u.store.GenerateAndCreateUserSession(user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create session"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"token":    token,
		"username": user.Username,
	})
}

func (u *UserServer) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	token := authHeader
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("x-user-token")
	}

	if token != "" {
		_ = u.store.DeleteUserSession(token)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	})
}

func (u *UserServer) StatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("x-user-id")
	stats, err := u.store.GetUserStats(userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	activeKeys := u.store.ListKeys()

	openaiModels := make(map[string]bool)
	geminiModels := make(map[string]bool)
	claudeModels := make(map[string]bool)

	for _, k := range activeKeys {
		if k.Status != "active" {
			continue
		}
		var models []string
		if err := json.Unmarshal([]byte(k.SelectedModels), &models); err != nil {
			continue
		}
		for _, m := range models {
			if m == "" {
				continue
			}
			normalized := cleanModelName(m)
			if k.SupportsOpenAI == 1 {
				openaiModels[normalized] = true
			}
			if k.SupportsGemini == 1 {
				geminiModels[normalized] = true
			}
			if k.SupportsClaude == 1 {
				claudeModels[normalized] = true
			}
		}
	}

	// Fallbacks from settings
	settings, err := u.store.GetSettings()
	fallbackModel := "gemini-2.5-flash"
	fallbackAPIType := "auto"
	if err == nil {
		if settings["fallback_model"] != "" {
			fallbackModel = settings["fallback_model"]
		}
		if settings["fallback_api_type"] != "" {
			fallbackAPIType = settings["fallback_api_type"]
		}
	}

	fallbackModelClean := cleanModelName(fallbackModel)
	if len(openaiModels) == 0 && (fallbackAPIType == "auto" || fallbackAPIType == "openai") {
		openaiModels[fallbackModelClean] = true
	}
	if len(geminiModels) == 0 && (fallbackAPIType == "auto" || fallbackAPIType == "gemini") {
		geminiModels[fallbackModelClean] = true
	}
	if len(claudeModels) == 0 && (fallbackAPIType == "auto" || fallbackAPIType == "claude") {
		claudeModels[fallbackModelClean] = true
	}

	openaiList := []string{}
	for m := range openaiModels {
		openaiList = append(openaiList, m)
	}
	geminiList := []string{}
	for m := range geminiModels {
		geminiList = append(geminiList, m)
	}
	claudeList := []string{}
	for m := range claudeModels {
		claudeList = append(claudeList, m)
	}

	sort.Strings(openaiList)
	sort.Strings(geminiList)
	sort.Strings(claudeList)

	stats["available_models"] = map[string][]string{
		"openai": openaiList,
		"gemini": geminiList,
		"claude": claudeList,
	}

	writeJSON(w, http.StatusOK, stats)
}

type AddUserKeyRequest struct {
	Label string `json:"label"`
}

func (u *UserServer) AddKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("x-user-id")
	var req AddUserKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	key, err := u.store.AddUserClientKey(userID, req.Label)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"key":     key,
		"message": "API Key generated successfully",
	})
}

type UpdateUserKeyRequest struct {
	Status string `json:"status"`
}

func (u *UserServer) UpdateKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("x-user-id")
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	var req UpdateUserKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if err := u.store.UpdateUserClientKeyStatus(userID, id, req.Status); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "API Key status updated successfully"})
}

func (u *UserServer) DeleteKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Header.Get("x-user-id")
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing key ID"})
		return
	}

	if err := u.store.DeleteUserClientKey(userID, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "API Key deleted successfully"})
}

type TurnstileResponse struct {
	Success     bool      `json:"success"`
	ChallengeTS time.Time `json:"challenge_ts"`
	Hostname    string    `json:"hostname"`
	ErrorCodes  []string  `json:"error-codes"`
	Action      string    `json:"action"`
	Cdata       string    `json:"cdata"`
}

func verifyTurnstile(token string, remoteIP string) (bool, error) {
	secretKey := os.Getenv("TURNSTILE_SECRET_KEY")
	if secretKey == "" {
		return true, nil // Turnstile not enabled, bypass validation
	}

	if token == "" {
		return false, fmt.Errorf("missing turnstile verification token")
	}

	// Prepare request payload
	data := url.Values{}
	data.Set("secret", secretKey)
	data.Set("response", token)
	if remoteIP != "" {
		// Strip port if present
		if idx := strings.LastIndex(remoteIP, ":"); idx != -1 {
			remoteIP = remoteIP[:idx]
		}
		data.Set("remoteip", remoteIP)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(data.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var res TurnstileResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return false, err
	}

	if !res.Success {
		return false, fmt.Errorf("turnstile verification failed: %v", res.ErrorCodes)
	}

	return true, nil
}
