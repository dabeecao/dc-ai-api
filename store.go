package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type APIKey struct {
	ID               string    `json:"id"`
	Label            string    `json:"label"`
	Key              string    `json:"key"`
	Status           string    `json:"status"` // "active", "failed", "disabled", "cooldown"
	ErrorReason      string    `json:"error_reason"`
	SuccessCount     int64     `json:"success_count"`
	FailureCount     int64     `json:"failure_count"`
	TotalRequests    int64     `json:"total_requests"`
	LastUsed         time.Time `json:"last_used"`
	CooldownUntil    time.Time `json:"cooldown_until"`
	UpstreamURL      string    `json:"upstream_url"`
	SupportsOpenAI   int       `json:"supports_openai"`  // sqlite lacks bool, use 1/0
	SupportsGemini   int       `json:"supports_gemini"`  // sqlite lacks bool, use 1/0
	SupportsClaude   int       `json:"supports_claude"`  // sqlite lacks bool, use 1/0
	AvailableModels  string    `json:"available_models"` // JSON array string
	SelectedModels   string    `json:"selected_models"`  // JSON array string
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	LastLatencyMs    int64     `json:"last_latency_ms"`
	AvgLatencyMs     int64     `json:"avg_latency_ms"`
}

type APIKeySafe struct {
	ID               string    `json:"id"`
	Label            string    `json:"label"`
	KeyMasked        string    `json:"key_masked"`
	Key              string    `json:"key"`
	Status           string    `json:"status"`
	ErrorReason      string    `json:"error_reason"`
	SuccessCount     int64     `json:"success_count"`
	FailureCount     int64     `json:"failure_count"`
	TotalRequests    int64     `json:"total_requests"`
	LastUsed         time.Time `json:"last_used"`
	CooldownUntil    time.Time `json:"cooldown_until"`
	UpstreamURL      string    `json:"upstream_url"`
	SupportsOpenAI   int       `json:"supports_openai"`
	SupportsGemini   int       `json:"supports_gemini"`
	SupportsClaude   int       `json:"supports_claude"`
	AvailableModels  string    `json:"available_models"`
	SelectedModels   string    `json:"selected_models"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	LastLatencyMs    int64     `json:"last_latency_ms"`
	AvgLatencyMs     int64     `json:"avg_latency_ms"`
}

type ClientKey struct {
	ID               string    `json:"id"`
	Label            string    `json:"label"`
	Key              string    `json:"key"`    // pk_...
	Status           string    `json:"status"` // "active", "disabled"
	TotalRequests    int64     `json:"total_requests"`
	LastUsed         time.Time `json:"last_used"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
}

type ClientKeySafe struct {
	ID               string    `json:"id"`
	Label            string    `json:"label"`
	KeyMasked        string    `json:"key_masked"`
	Key              string    `json:"key"`
	Status           string    `json:"status"`
	TotalRequests    int64     `json:"total_requests"`
	LastUsed         time.Time `json:"last_used"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
}

type UpstreamErrorLog struct {
	ID           int64     `json:"id"`
	KeyID        string    `json:"key_id"`
	KeyLabel     string    `json:"key_label"`
	ErrorMessage string    `json:"error_message"`
	StatusCode   int       `json:"status_code"`
	Timestamp    time.Time `json:"timestamp"`
}

type Store struct {
	db              *sql.DB
	mu              sync.Mutex // Mutex to serialize writes to avoid SQLite concurrent locks
	clientKeysMu    sync.RWMutex
	clientKeysCache map[string]bool
	writeChan       chan func()
	writerWg        sync.WaitGroup
}

func formatTimeUTC(t time.Time) string {
	return t.UTC().Format("2006-01-02 15:04:05")
}

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS upstream_keys (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	key TEXT UNIQUE NOT NULL,
	status TEXT NOT NULL,
	error_reason TEXT,
	success_count INTEGER DEFAULT 0,
	failure_count INTEGER DEFAULT 0,
	total_requests INTEGER DEFAULT 0,
	last_used DATETIME,
	cooldown_until DATETIME,
	upstream_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS client_keys (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	key TEXT UNIQUE NOT NULL,
	status TEXT NOT NULL,
	total_requests INTEGER DEFAULT 0,
	last_used DATETIME
);

CREATE TABLE IF NOT EXISTS upstream_error_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	key_id TEXT NOT NULL,
	key_label TEXT NOT NULL,
	error_message TEXT NOT NULL,
	status_code INTEGER,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
	token TEXT PRIMARY KEY,
	expires_at DATETIME NOT NULL
);
`

var ErrNoKeysAvailable = errors.New("no active api keys available in the rotation pool")

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	// Enable WAL mode and busy timeout for concurrent access support
	_, _ = db.Exec("PRAGMA journal_mode=WAL;")
	_, _ = db.Exec("PRAGMA busy_timeout=5000;")

	// Support concurrent read connections under WAL mode
	db.SetMaxOpenConns(10)

	// Execute migrations
	if _, err := db.Exec(createTablesSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %v", err)
	}

	// Run migrations to add missing columns to upstream_keys if they don't exist
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN upstream_url TEXT DEFAULT ''")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN supports_openai INTEGER DEFAULT 1")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN supports_gemini INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN supports_claude INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN available_models TEXT DEFAULT '[]'")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN selected_models TEXT DEFAULT '[]'")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN completion_tokens INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN total_tokens INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN last_latency_ms INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN avg_latency_ms INTEGER DEFAULT 0")

	// Add missing columns to client_keys
	_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN completion_tokens INTEGER DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN total_tokens INTEGER DEFAULT 0")

	// Create gcli_stats table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS gcli_stats (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			total_requests INTEGER DEFAULT 0,
			success_count INTEGER DEFAULT 0,
			failure_count INTEGER DEFAULT 0
		)
	`)
	if err == nil {
		_, _ = db.Exec("ALTER TABLE gcli_stats ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
		_, _ = db.Exec("ALTER TABLE gcli_stats ADD COLUMN completion_tokens INTEGER DEFAULT 0")
		_, _ = db.Exec("ALTER TABLE gcli_stats ADD COLUMN total_tokens INTEGER DEFAULT 0")
	}
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create gcli_stats table: %v", err)
	}

	// Initialize GCLI stats row if it doesn't exist
	var gcliCount int
	err = db.QueryRow("SELECT COUNT(*) FROM gcli_stats").Scan(&gcliCount)
	if err == nil && gcliCount == 0 {
		_, _ = db.Exec("INSERT INTO gcli_stats (id, total_requests, success_count, failure_count) VALUES (1, 0, 0, 0)")
	}

	// Create settings table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)
	`)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create settings table: %v", err)
	}

	// Initialize default settings if missing
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('fallback_key', '')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('fallback_model', '')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('fallback_upstream_url', '')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('fallback_api_type', 'gemini')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_request_size_kb', '0')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('guest_api_key', '')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('guest_model', '')")
	_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('enable_guest_key', '1')")

	s := &Store{
		db:              db,
		clientKeysCache: make(map[string]bool),
		writeChan:       make(chan func(), 10000),
	}
	s.writerWg.Add(1)
	go s.startDBWriter()

	if err := s.loadClientKeysCache(); err != nil {
		close(s.writeChan)
		s.writerWg.Wait()
		db.Close()
		return nil, fmt.Errorf("failed to load client keys cache: %v", err)
	}

	return s, nil
}

func (s *Store) startDBWriter() {
	defer s.writerWg.Done()
	for fn := range s.writeChan {
		fn()
	}
}

func (s *Store) queueWrite(fn func()) {
	defer func() {
		if r := recover(); r != nil {
			LogError("Failed to queue database write: %v", r)
		}
	}()
	select {
	case s.writeChan <- fn:
	default:
		LogError("Database write queue full, dropping stats update")
	}
}

func (s *Store) runSyncWrite(fn func() error) error {
	errChan := make(chan error, 1)
	s.queueWrite(func() {
		errChan <- fn()
	})
	return <-errChan
}

func (s *Store) loadClientKeysCache() error {
	rows, err := s.db.Query("SELECT key, status FROM client_keys")
	if err != nil {
		return err
	}
	defer rows.Close()

	s.clientKeysMu.Lock()
	defer s.clientKeysMu.Unlock()
	for rows.Next() {
		var key, status string
		if err := rows.Scan(&key, &status); err == nil {
			s.clientKeysCache[key] = (status == "active")
		}
	}
	return nil
}

func (s *Store) Close() error {
	close(s.writeChan)
	s.writerWg.Wait()
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}

func generateID() string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}

func maskKey(k string) string {
	if len(k) <= 8 {
		return "********"
	}
	return k[:4] + "..." + k[len(k)-4:]
}

func maskClientKey(k string) string {
	prefix := "dc_"
	if strings.HasPrefix(k, "pk_") {
		prefix = "pk_"
	}
	if len(k) <= 12 {
		return prefix + "********"
	}
	return k[:6] + "..." + k[len(k)-4:]
}

// B.AI Upstream Keys Methods
func (s *Store) ListKeys() []APIKeySafe {
	rows, err := s.db.Query(`
		SELECT id, label, key, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms
		FROM upstream_keys
	`)
	if err != nil {
		LogError("Failed to list keys: %v", err)
		return nil
	}
	defer rows.Close()

	safeKeys := []APIKeySafe{}
	now := time.Now()

	for rows.Next() {
		var k APIKey
		var lastUsed, cooldownUntil sql.NullTime
		var errReason sql.NullString

		err := rows.Scan(
			&k.ID, &k.Label, &k.Key, &k.Status, &errReason,
			&k.SuccessCount, &k.FailureCount, &k.TotalRequests,
			&lastUsed, &cooldownUntil, &k.UpstreamURL,
			&k.SupportsOpenAI, &k.SupportsGemini, &k.SupportsClaude, &k.AvailableModels, &k.SelectedModels,
			&k.PromptTokens, &k.CompletionTokens, &k.TotalTokens, &k.LastLatencyMs, &k.AvgLatencyMs,
		)
		if err != nil {
			LogError("Failed to scan key row: %v", err)
			continue
		}

		if errReason.Valid {
			k.ErrorReason = errReason.String
		}
		if lastUsed.Valid {
			k.LastUsed = lastUsed.Time
		}
		if cooldownUntil.Valid {
			k.CooldownUntil = cooldownUntil.Time
		}

		// Auto cooldown recovery
		status := k.Status
		if status == "cooldown" && !cooldownUntil.Time.IsZero() && now.After(cooldownUntil.Time) {
			status = "active"
		}

		safeKeys = append(safeKeys, APIKeySafe{
			ID:               k.ID,
			Label:            k.Label,
			KeyMasked:        maskKey(k.Key),
			Key:              k.Key,
			Status:           status,
			ErrorReason:      k.ErrorReason,
			SuccessCount:     k.SuccessCount,
			FailureCount:     k.FailureCount,
			TotalRequests:    k.TotalRequests,
			LastUsed:         k.LastUsed,
			CooldownUntil:    k.CooldownUntil,
			UpstreamURL:      k.UpstreamURL,
			SupportsOpenAI:   k.SupportsOpenAI,
			SupportsGemini:   k.SupportsGemini,
			SupportsClaude:   k.SupportsClaude,
			AvailableModels:  k.AvailableModels,
			SelectedModels:   k.SelectedModels,
			PromptTokens:     k.PromptTokens,
			CompletionTokens: k.CompletionTokens,
			TotalTokens:      k.TotalTokens,
			LastLatencyMs:    k.LastLatencyMs,
			AvgLatencyMs:     k.AvgLatencyMs,
		})
	}
	return safeKeys
}

func (s *Store) AddKey(label, key, upstreamURL string, supportsOpenAI, supportsGemini, supportsClaude int, availableModels, selectedModels string) error {
	if key == "" {
		return errors.New("api key cannot be empty")
	}
	if label == "" {
		label = "Key-" + generateID()[:4]
	}

	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		_, err := s.db.Exec(`
			INSERT INTO upstream_keys (id, label, key, status, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models)
			VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
		`, generateID(), label, key, upstreamURL, supportsOpenAI, supportsGemini, supportsClaude, availableModels, selectedModels)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				return errors.New("this api key is already in the pool")
			}
			return err
		}
		return nil
	})
}

func (s *Store) DeleteKey(id string) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		res, err := s.db.Exec("DELETE FROM upstream_keys WHERE id = ?", id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("key with id %s not found", id)
		}
		return nil
	})
}

func (s *Store) UpdateKeyStatus(id string, status string) error {
	if status != "active" && status != "disabled" {
		return errors.New("invalid status: must be active or disabled")
	}

	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		res, err := s.db.Exec(`
			UPDATE upstream_keys 
			SET status = ?, error_reason = CASE WHEN ? = 'active' THEN '' ELSE error_reason END
			WHERE id = ?
		`, status, status, id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("key with id %s not found", id)
		}
		return nil
	})
}

func (s *Store) UpdateKeyLabel(id string, label string) error {
	if label == "" {
		return errors.New("label cannot be empty")
	}

	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		res, err := s.db.Exec("UPDATE upstream_keys SET label = ? WHERE id = ?", label, id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("key with id %s not found", id)
		}
		return nil
	})
}

func (s *Store) StartCooldownCleaner(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.queueWrite(func() {
					s.mu.Lock()
					defer s.mu.Unlock()
					now := time.Now()
					_, err := s.db.Exec(`
						UPDATE upstream_keys
						SET status = 'active', error_reason = ''
						WHERE status = 'cooldown' AND cooldown_until < ?
					`, formatTimeUTC(now))
					if err != nil {
						LogError("Background cooldown cleaner failed: %v", err)
					}
					// Clean up expired admin sessions
					_, _ = s.db.Exec("DELETE FROM admin_sessions WHERE expires_at < ?", formatTimeUTC(now))
				})
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Store) GetNextKeyForModelAndType(model string, apiType string, excludeIDs []string) (APIKey, error) {
	now := time.Now()
	nowStr := formatTimeUTC(now)

	// Select active keys or cooldown keys that have expired, of appropriate API type sorted by last_used
	var query string
	var queryArgs []interface{}

	switch apiType {
	case "gemini":
		query = `
			SELECT id, label, key, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
			FROM upstream_keys
			WHERE (status = 'active' OR (status = 'cooldown' AND cooldown_until < ?)) AND supports_gemini = 1
			ORDER BY last_used ASC, id ASC
		`
		queryArgs = []interface{}{nowStr}
	case "claude":
		query = `
			SELECT id, label, key, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
			FROM upstream_keys
			WHERE (status = 'active' OR (status = 'cooldown' AND cooldown_until < ?)) AND supports_claude = 1
			ORDER BY last_used ASC, id ASC
		`
		queryArgs = []interface{}{nowStr}
	default:
		query = `
			SELECT id, label, key, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
			FROM upstream_keys
			WHERE (status = 'active' OR (status = 'cooldown' AND cooldown_until < ?)) AND supports_openai = 1
			ORDER BY last_used ASC, id ASC
		`
		queryArgs = []interface{}{nowStr}
	}

	rows, err := s.db.Query(query, queryArgs...)
	if err != nil {
		return APIKey{}, err
	}
	defer rows.Close()

	var selectedKey APIKey
	found := false

	for rows.Next() {
		var k APIKey
		var lastUsed, cooldownUntil sql.NullTime
		var errReason sql.NullString

		err := rows.Scan(
			&k.ID, &k.Label, &k.Key, &k.Status, &errReason,
			&k.SuccessCount, &k.FailureCount, &k.TotalRequests,
			&lastUsed, &cooldownUntil, &k.UpstreamURL,
			&k.SupportsOpenAI, &k.SupportsGemini, &k.SupportsClaude, &k.AvailableModels, &k.SelectedModels,
		)
		if err != nil {
			LogError("Failed scan row in rotation: %v", err)
			continue
		}

		// Skip excluded IDs
		isExcluded := false
		for _, exID := range excludeIDs {
			if exID == k.ID {
				isExcluded = true
				break
			}
		}
		if isExcluded {
			continue
		}

		if errReason.Valid {
			k.ErrorReason = errReason.String
		}
		if lastUsed.Valid {
			k.LastUsed = lastUsed.Time
		}
		if cooldownUntil.Valid {
			k.CooldownUntil = cooldownUntil.Time
		}

		// If no specific model is requested (e.g. listing models), return first matching key
		if model == "" {
			selectedKey = k
			found = true
			break
		}

		// Parse selected models and match
		var models []string
		if err := json.Unmarshal([]byte(k.SelectedModels), &models); err == nil {
			for _, m := range models {
				if strings.EqualFold(cleanModelName(m), cleanModelName(model)) {
					selectedKey = k
					found = true
					break
				}
			}
		}

		if found {
			break
		}
	}
	rows.Close() // Explicitly close rows to release database connection before Exec!

	if !found {
		return APIKey{}, ErrNoKeysAvailable
	}

	// 3. Mark last used and increment requests count (asynchronously)
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, dbErr := s.db.Exec(`
			UPDATE upstream_keys
			SET last_used = ?, total_requests = total_requests + 1
			WHERE id = ?
		`, formatTimeUTC(now), selectedKey.ID)
		if dbErr != nil {
			LogError("Failed updating last_used: %v", dbErr)
		}
	})

	selectedKey.LastUsed = now
	selectedKey.TotalRequests++

	return selectedKey, nil
}

func (s *Store) GetSettings() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, val string
		if err := rows.Scan(&key, &val); err == nil {
			settings[key] = val
		}
	}
	return settings, nil
}

func (s *Store) UpdateSettings(settings map[string]string) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()

		for k, v := range settings {
			_, err := tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v)
			if err != nil {
				return err
			}
		}

		return tx.Commit()
	})
}

func (s *Store) RecordSuccess(id string, promptTokens int64, completionTokens int64, latencyMs int64) {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()

		var err error
		if latencyMs > 0 {
			_, err = s.db.Exec(`
				UPDATE upstream_keys
				SET success_count = success_count + 1,
					status = CASE WHEN status IN ('failed', 'cooldown') THEN 'active' ELSE status END,
					error_reason = '',
					prompt_tokens = prompt_tokens + ?,
					completion_tokens = completion_tokens + ?,
					total_tokens = total_tokens + ?,
					last_latency_ms = ?,
					avg_latency_ms = CASE WHEN avg_latency_ms = 0 THEN ? ELSE (avg_latency_ms * 9 + ?) / 10 END
				WHERE id = ?
			`, promptTokens, completionTokens, promptTokens+completionTokens, latencyMs, latencyMs, latencyMs, id)
		} else {
			_, err = s.db.Exec(`
				UPDATE upstream_keys
				SET success_count = success_count + 1,
					status = CASE WHEN status IN ('failed', 'cooldown') THEN 'active' ELSE status END,
					error_reason = '',
					prompt_tokens = prompt_tokens + ?,
					completion_tokens = completion_tokens + ?,
					total_tokens = total_tokens + ?
				WHERE id = ?
			`, promptTokens, completionTokens, promptTokens+completionTokens, id)
		}
		if err != nil {
			LogError("Failed recording success for ID %s: %v", id, err)
		}
	})
}

func (s *Store) RecordFailure(id string, reason string, statusCode int) {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()

		now := time.Now()
		var status string
		var cooldownUntilStr interface{}

		switch statusCode {
		case 401, 403:
			status = "failed"
		case 429:
			status = "cooldown"
			t := now.Add(30 * time.Second)
			cooldownUntilStr = formatTimeUTC(t)
		case 500, 502, 503, 504:
			// Temporary server overloads/errors: 15-second cooldown
			status = "cooldown"
			t := now.Add(15 * time.Second)
			cooldownUntilStr = formatTimeUTC(t)
		default:
			// For network timeouts or connection-level errors (represented by status code 0 or other 5xx status codes)
			if statusCode == 0 || statusCode >= 500 {
				status = "cooldown"
				t := now.Add(15 * time.Second)
				cooldownUntilStr = formatTimeUTC(t)
			}
		}

		// Retrieve key label for log snapshotting
		var label string
		err := s.db.QueryRow("SELECT label FROM upstream_keys WHERE id = ?", id).Scan(&label)
		if err != nil {
			label = "Deleted Key (" + id + ")"
		}

		// Insert error log using parameterized query
		_, err = s.db.Exec(`
			INSERT INTO upstream_error_logs (key_id, key_label, error_message, status_code, timestamp)
			VALUES (?, ?, ?, ?, ?)
		`, id, label, reason, statusCode, formatTimeUTC(now))
		if err != nil {
			LogError("Failed to insert upstream error log: %v", err)
		}

		// Prune logs beyond the limit of 1000 entries
		_, err = s.db.Exec(`
			DELETE FROM upstream_error_logs 
			WHERE id NOT IN (
				SELECT id FROM upstream_error_logs 
				ORDER BY id DESC 
				LIMIT 1000
			)
		`)
		if err != nil {
			LogError("Failed to prune upstream error logs: %v", err)
		}

		if status != "" {
			_, err = s.db.Exec(`
				UPDATE upstream_keys
				SET failure_count = failure_count + 1,
					error_reason = ?,
					status = ?,
					cooldown_until = ?
				WHERE id = ?
			`, reason, status, cooldownUntilStr, id)
			if err != nil {
				LogError("Failed updating status for failed key ID %s: %v", id, err)
			}
		} else {
			_, err = s.db.Exec(`
				UPDATE upstream_keys
				SET failure_count = failure_count + 1,
					error_reason = ?
				WHERE id = ?
			`, reason, id)
			if err != nil {
				LogError("Failed recording failure for ID %s: %v", id, err)
			}
		}
	})
}

func (s *Store) ListErrorLogs() ([]UpstreamErrorLog, error) {
	rows, err := s.db.Query(`
		SELECT id, key_id, key_label, error_message, status_code, timestamp
		FROM upstream_error_logs
		ORDER BY id DESC
		LIMIT 100
	`)
	if err != nil {
		LogError("Failed to list error logs: %v", err)
		return nil, err
	}
	defer rows.Close()

	logs := []UpstreamErrorLog{}
	for rows.Next() {
		var log UpstreamErrorLog
		var ts time.Time
		err := rows.Scan(&log.ID, &log.KeyID, &log.KeyLabel, &log.ErrorMessage, &log.StatusCode, &ts)
		if err != nil {
			LogError("Failed to scan error log row: %v", err)
			continue
		}
		log.Timestamp = ts
		logs = append(logs, log)
	}
	return logs, nil
}

func (s *Store) ClearErrorLogs() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec("DELETE FROM upstream_error_logs")
	return err
}

func (s *Store) DeleteErrorLog(id int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec("DELETE FROM upstream_error_logs WHERE id = ?", id)
	return err
}

func (s *Store) RecordGCLIRequest() {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("UPDATE gcli_stats SET total_requests = total_requests + 1 WHERE id = 1")
		if err != nil {
			LogError("Failed recording GCLI request: %v", err)
		}
	})
}

func (s *Store) RecordGCLISuccess(promptTokens int64, completionTokens int64) {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec(`
			UPDATE gcli_stats
			SET success_count = success_count + 1,
				prompt_tokens = prompt_tokens + ?,
				completion_tokens = completion_tokens + ?,
				total_tokens = total_tokens + ?
			WHERE id = 1
		`, promptTokens, completionTokens, promptTokens+completionTokens)
		if err != nil {
			LogError("Failed recording GCLI success: %v", err)
		}
	})
}

func (s *Store) RecordGCLIFailure() {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("UPDATE gcli_stats SET failure_count = failure_count + 1 WHERE id = 1")
		if err != nil {
			LogError("Failed recording GCLI failure: %v", err)
		}
	})
}

// Client API Keys Methods
func (s *Store) ListClientKeys() []ClientKeySafe {
	rows, err := s.db.Query("SELECT id, label, key, status, total_requests, last_used, prompt_tokens, completion_tokens, total_tokens FROM client_keys")
	if err != nil {
		LogError("Failed listing client keys: %v", err)
		return nil
	}
	defer rows.Close()

	safeKeys := []ClientKeySafe{}
	for rows.Next() {
		var ck ClientKey
		var lastUsed sql.NullTime
		err := rows.Scan(&ck.ID, &ck.Label, &ck.Key, &ck.Status, &ck.TotalRequests, &lastUsed, &ck.PromptTokens, &ck.CompletionTokens, &ck.TotalTokens)
		if err != nil {
			LogError("Failed scan client key: %v", err)
			continue
		}
		if lastUsed.Valid {
			ck.LastUsed = lastUsed.Time
		}
		safeKeys = append(safeKeys, ClientKeySafe{
			ID:               ck.ID,
			Label:            ck.Label,
			KeyMasked:        maskClientKey(ck.Key),
			Key:              ck.Key,
			Status:           ck.Status,
			TotalRequests:    ck.TotalRequests,
			LastUsed:         ck.LastUsed,
			PromptTokens:     ck.PromptTokens,
			CompletionTokens: ck.CompletionTokens,
			TotalTokens:      ck.TotalTokens,
		})
	}
	return safeKeys
}

func (s *Store) RecordClientKeyTokens(keyStr string, promptTokens int64, completionTokens int64) {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec(`
			UPDATE client_keys
			SET prompt_tokens = prompt_tokens + ?,
				completion_tokens = completion_tokens + ?,
				total_tokens = total_tokens + ?
			WHERE key = ?
		`, promptTokens, completionTokens, promptTokens+completionTokens, keyStr)
		if err != nil {
			LogError("Failed updating client key tokens: %v", err)
		}
	})
}

func (s *Store) AddClientKey(label string) (string, error) {
	if label == "" {
		label = "ClientKey-" + generateID()[:4]
	}

	bytes := make([]byte, 16)
	var key string
	if _, err := rand.Read(bytes); err != nil {
		key = "dc_" + generateID()
	} else {
		key = "dc_" + hex.EncodeToString(bytes)
	}

	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		_, err := s.db.Exec(`
			INSERT INTO client_keys (id, label, key, status)
			VALUES (?, ?, ?, 'active')
		`, generateID(), label, key)
		return err
	})
	if err != nil {
		return "", err
	}

	s.clientKeysMu.Lock()
	s.clientKeysCache[key] = true
	s.clientKeysMu.Unlock()

	return key, nil
}

func (s *Store) DeleteClientKey(id string) error {
	var key string
	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		var k string
		err := s.db.QueryRow("SELECT key FROM client_keys WHERE id = ?", id).Scan(&k)
		if err != nil {
			return err
		}
		key = k

		res, err := s.db.Exec("DELETE FROM client_keys WHERE id = ?", id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("client key with id %s not found", id)
		}
		return nil
	})
	if err != nil {
		return err
	}

	s.clientKeysMu.Lock()
	delete(s.clientKeysCache, key)
	s.clientKeysMu.Unlock()

	return nil
}

func (s *Store) UpdateClientKeyStatus(id string, status string) error {
	if status != "active" && status != "disabled" {
		return errors.New("invalid status: must be active or disabled")
	}

	var key string
	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		var k string
		err := s.db.QueryRow("SELECT key FROM client_keys WHERE id = ?", id).Scan(&k)
		if err != nil {
			return err
		}
		key = k

		res, err := s.db.Exec("UPDATE client_keys SET status = ? WHERE id = ?", status, id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("client key with id %s not found", id)
		}
		return nil
	})
	if err != nil {
		return err
	}

	s.clientKeysMu.Lock()
	s.clientKeysCache[key] = (status == "active")
	s.clientKeysMu.Unlock()

	return nil
}

func (s *Store) ValidateClientKey(keyStr string) bool {
	s.clientKeysMu.RLock()
	active, exists := s.clientKeysCache[keyStr]
	s.clientKeysMu.RUnlock()

	if !exists || !active {
		return false
	}

	// Update client key usage stats asynchronously
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec(`
			UPDATE client_keys
			SET total_requests = total_requests + 1, last_used = ?
			WHERE key = ?
		`, formatTimeUTC(time.Now()), keyStr)
		if err != nil {
			LogError("Failed updating client key stats: %v", err)
		}
	})

	return true
}

func (s *Store) GetStats() map[string]interface{} {
	// Aggregated stats from SQLite
	row := s.db.QueryRow(`
		SELECT 
			COUNT(id), 
			COALESCE(SUM(CASE WHEN status = 'active' OR (status = 'cooldown' AND cooldown_until < datetime('now')) THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cooldown' AND cooldown_until >= datetime('now') THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(total_requests), 0),
			COALESCE(SUM(success_count), 0),
			COALESCE(SUM(failure_count), 0),
			COALESCE(SUM(prompt_tokens), 0),
			COALESCE(SUM(completion_tokens), 0),
			COALESCE(SUM(total_tokens), 0)
		FROM upstream_keys
	`)

	var totalKeys, activeKeys, failedKeys, cooldownKeys, disabledKeys int
	var totalRequests, successCount, failureCount int64
	var promptTokens, completionTokens, totalTokens int64

	err := row.Scan(
		&totalKeys, &activeKeys, &failedKeys, &cooldownKeys, &disabledKeys,
		&totalRequests, &successCount, &failureCount,
		&promptTokens, &completionTokens, &totalTokens,
	)
	if err != nil {
		// Ignore ErrNoRows since COUNT/SUM always returns a row
		LogError("Failed scanning stats: %v", err)
	}

	successRate := 0.0
	totalCompleted := successCount + failureCount
	if totalCompleted > 0 {
		successRate = (float64(successCount) / float64(totalCompleted)) * 100
	}

	// Count client keys
	var totalClientKeys, activeClientKeys int
	_ = s.db.QueryRow("SELECT COUNT(id), SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) FROM client_keys").
		Scan(&totalClientKeys, &activeClientKeys)

	// Get GCLI stats
	var gcliTotalRequests, gcliSuccessCount, gcliFailureCount int64
	var gcliPromptTokens, gcliCompletionTokens, gcliTotalTokens int64
	_ = s.db.QueryRow("SELECT total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens FROM gcli_stats WHERE id = 1").
		Scan(&gcliTotalRequests, &gcliSuccessCount, &gcliFailureCount, &gcliPromptTokens, &gcliCompletionTokens, &gcliTotalTokens)

	gcliSuccessRate := 0.0
	gcliTotalCompleted := gcliSuccessCount + gcliFailureCount
	if gcliTotalCompleted > 0 {
		gcliSuccessRate = (float64(gcliSuccessCount) / float64(gcliTotalCompleted)) * 100
	}

	return map[string]interface{}{
		"total_keys":             totalKeys,
		"active_keys":            activeKeys,
		"failed_keys":            failedKeys,
		"cooldown_keys":          cooldownKeys,
		"disabled_keys":          disabledKeys,
		"total_requests":         totalRequests,
		"success_count":          successCount,
		"failure_count":          failureCount,
		"success_rate":           successRate,
		"prompt_tokens":          promptTokens,
		"completion_tokens":      completionTokens,
		"total_tokens":           totalTokens,
		"total_client_keys":      totalClientKeys,
		"active_client_keys":     activeClientKeys,
		"gcli_total_requests":    gcliTotalRequests,
		"gcli_success_count":     gcliSuccessCount,
		"gcli_failure_count":     gcliFailureCount,
		"gcli_success_rate":      gcliSuccessRate,
		"gcli_prompt_tokens":     gcliPromptTokens,
		"gcli_completion_tokens": gcliCompletionTokens,
		"gcli_total_tokens":      gcliTotalTokens,
	}
}

func (s *Store) GetKeyByID(id string) (APIKey, error) {
	row := s.db.QueryRow(`
		SELECT id, label, key, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms
		FROM upstream_keys
		WHERE id = ?
	`, id)

	var k APIKey
	var lastUsed, cooldownUntil sql.NullTime
	var errReason sql.NullString

	err := row.Scan(
		&k.ID, &k.Label, &k.Key, &k.Status, &errReason,
		&k.SuccessCount, &k.FailureCount, &k.TotalRequests,
		&lastUsed, &cooldownUntil, &k.UpstreamURL,
		&k.SupportsOpenAI, &k.SupportsGemini, &k.SupportsClaude, &k.AvailableModels, &k.SelectedModels,
		&k.PromptTokens, &k.CompletionTokens, &k.TotalTokens, &k.LastLatencyMs, &k.AvgLatencyMs,
	)
	if err != nil {
		return APIKey{}, err
	}

	if errReason.Valid {
		k.ErrorReason = errReason.String
	}
	if lastUsed.Valid {
		k.LastUsed = lastUsed.Time
	}
	if cooldownUntil.Valid {
		k.CooldownUntil = cooldownUntil.Time
	}

	return k, nil
}

func (s *Store) UpdateKeyDetails(id, label, key, upstreamURL string, supportsOpenAI, supportsGemini, supportsClaude int, availableModels, selectedModels string) error {
	if key == "" {
		return errors.New("API key cannot be empty")
	}
	if label == "" {
		return errors.New("label cannot be empty")
	}

	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		res, err := s.db.Exec(`
			UPDATE upstream_keys 
			SET label = ?, key = ?, upstream_url = ?, supports_openai = ?, supports_gemini = ?, supports_claude = ?, available_models = ?, selected_models = ?
			WHERE id = ?
		`, label, key, upstreamURL, supportsOpenAI, supportsGemini, supportsClaude, availableModels, selectedModels, id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return fmt.Errorf("key with id %s not found", id)
		}
		return nil
	})
}

func (s *Store) CreateSession(token string, expiresAt time.Time) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)", token, formatTimeUTC(expiresAt))
		return err
	})
}

func (s *Store) ValidateSession(token string) (bool, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM admin_sessions WHERE token = ? AND expires_at > ?", token, formatTimeUTC(time.Now())).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) DeleteSession(token string) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("DELETE FROM admin_sessions WHERE token = ?", token)
		return err
	})
}

func (s *Store) CleanupSessions() error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("DELETE FROM admin_sessions WHERE expires_at < ?", formatTimeUTC(time.Now()))
		return err
	})
}

func (s *Store) GenerateAndCreateSession() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)
	expiresAt := time.Now().Add(24 * time.Hour)
	err := s.CreateSession(token, expiresAt)
	if err != nil {
		return "", err
	}
	return token, nil
}

// ModelExists checks if the given model exists in the selected_models list of any configured upstream key.
func (s *Store) ModelExists(model string) (bool, error) {
	if model == "" {
		return true, nil
	}

	rows, err := s.db.Query("SELECT selected_models FROM upstream_keys")
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var selectedModelsJSON string
		if err := rows.Scan(&selectedModelsJSON); err == nil {
			var models []string
			if err := json.Unmarshal([]byte(selectedModelsJSON), &models); err == nil {
				for _, m := range models {
					if strings.EqualFold(cleanModelName(m), cleanModelName(model)) {
						return true, nil
					}
				}
			}
		}
	}
	return false, nil
}

func cleanModelName(model string) string {
	m := strings.ToLower(model)
	// Remove any prefix before '/' (e.g., 'models/', 'google/')
	if idx := strings.LastIndex(m, "/"); idx != -1 {
		m = m[idx+1:]
	}
	// Remove any suffix after ':' (e.g., ':free', ':latest') if it is NOT an OpenAI fine-tuned model (starts with "ft:")
	if !strings.HasPrefix(m, "ft:") {
		if idx := strings.Index(m, ":"); idx != -1 {
			m = m[:idx]
		}
	}
	return m
}
