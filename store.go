package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
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
	UserID           string    `json:"user_id"`
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
	UserID           string    `json:"user_id,omitempty"`
}

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"password_hash"`
	Status       string    `json:"status"` // "pending", "active", "disabled"
	CreatedAt    time.Time `json:"created_at"`
}

type ClientKeyModelStat struct {
	ClientKeyID      string `json:"client_key_id"`
	ModelName        string `json:"model_name"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	TotalTokens      int64  `json:"total_tokens"`
	TotalRequests    int64  `json:"total_requests"`
}

type UserSession struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
}

type ModelStat struct {
	ModelName        string `json:"model_name"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	TotalTokens      int64  `json:"total_tokens"`
	TotalRequests    int64  `json:"total_requests"`
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
	isMySQL         bool
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

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	username TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	status TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
	token TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS client_key_model_stats (
	client_key_id TEXT NOT NULL,
	model_name TEXT NOT NULL,
	prompt_tokens INTEGER DEFAULT 0,
	completion_tokens INTEGER DEFAULT 0,
	total_tokens INTEGER DEFAULT 0,
	total_requests INTEGER DEFAULT 0,
	PRIMARY KEY (client_key_id, model_name)
);
`

const createTablesMySQL = `
CREATE TABLE IF NOT EXISTS upstream_keys (
	id VARCHAR(255) PRIMARY KEY,
	label VARCHAR(255) NOT NULL,
	` + "`key`" + ` VARCHAR(512) UNIQUE NOT NULL,
	status VARCHAR(50) NOT NULL,
	error_reason TEXT,
	success_count BIGINT DEFAULT 0,
	failure_count BIGINT DEFAULT 0,
	total_requests BIGINT DEFAULT 0,
	last_used DATETIME,
	cooldown_until DATETIME,
	upstream_url VARCHAR(1024) DEFAULT '',
	supports_openai INT DEFAULT 1,
	supports_gemini INT DEFAULT 0,
	supports_claude INT DEFAULT 0,
	available_models TEXT,
	selected_models TEXT,
	prompt_tokens BIGINT DEFAULT 0,
	completion_tokens BIGINT DEFAULT 0,
	total_tokens BIGINT DEFAULT 0,
	last_latency_ms BIGINT DEFAULT 0,
	avg_latency_ms BIGINT DEFAULT 0,
	consecutive_failures INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_keys (
	id VARCHAR(255) PRIMARY KEY,
	label VARCHAR(255) NOT NULL,
	` + "`key`" + ` VARCHAR(512) UNIQUE NOT NULL,
	status VARCHAR(50) NOT NULL,
	total_requests BIGINT DEFAULT 0,
	last_used DATETIME,
	prompt_tokens BIGINT DEFAULT 0,
	completion_tokens BIGINT DEFAULT 0,
	total_tokens BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS upstream_error_logs (
	id INT AUTO_INCREMENT PRIMARY KEY,
	key_id VARCHAR(255) NOT NULL,
	key_label VARCHAR(255) NOT NULL,
	error_message TEXT NOT NULL,
	status_code INT,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
	token VARCHAR(255) PRIMARY KEY,
	expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS fallback_stats (
	id INT PRIMARY KEY,
	total_requests BIGINT DEFAULT 0,
	success_count BIGINT DEFAULT 0,
	failure_count BIGINT DEFAULT 0,
	prompt_tokens BIGINT DEFAULT 0,
	completion_tokens BIGINT DEFAULT 0,
	total_tokens BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
	` + "`key`" + ` VARCHAR(255) PRIMARY KEY,
	value TEXT
);

CREATE TABLE IF NOT EXISTS users (
	id VARCHAR(255) PRIMARY KEY,
	username VARCHAR(255) UNIQUE NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	status VARCHAR(50) NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
	token VARCHAR(255) PRIMARY KEY,
	user_id VARCHAR(255) NOT NULL,
	expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS client_key_model_stats (
	client_key_id VARCHAR(255) NOT NULL,
	model_name VARCHAR(255) NOT NULL,
	prompt_tokens BIGINT DEFAULT 0,
	completion_tokens BIGINT DEFAULT 0,
	total_tokens BIGINT DEFAULT 0,
	total_requests BIGINT DEFAULT 0,
	PRIMARY KEY (client_key_id, model_name)
);
`

var ErrNoKeysAvailable = errors.New("no active api keys available in the rotation pool")

func NewStore(driver, dsn string) (*Store, error) {
	isMySQL := driver == "mysql"
	dbDriver := "sqlite"
	if isMySQL {
		dbDriver = "mysql"
	}

	db, err := sql.Open(dbDriver, dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	if isMySQL {
		// Support concurrent read/write connections under MySQL
		db.SetMaxOpenConns(10)
		db.SetConnMaxLifetime(time.Hour)

		// Execute MySQL migrations statement by statement (since multi-statements is disabled by default)
		for _, stmt := range strings.Split(createTablesMySQL, ";") {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := db.Exec(stmt); err != nil {
				db.Close()
				return nil, fmt.Errorf("failed to initialize MySQL schema: %v", err)
			}
		}

		// Initialize fallback stats row if it doesn't exist
		var fallbackCount int
		err = db.QueryRow("SELECT COUNT(*) FROM fallback_stats").Scan(&fallbackCount)
		if err == nil && fallbackCount == 0 {
			_, _ = db.Exec("INSERT INTO fallback_stats (id, total_requests, success_count, failure_count) VALUES (1, 0, 0, 0)")
		}

		// Initialize default settings if missing
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('fallback_key', '')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('fallback_model', '')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('fallback_upstream_url', '')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('fallback_api_type', 'gemini')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('max_request_size_kb', '0')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('guest_api_key', '')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('guest_model', '')")
		_, _ = db.Exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('enable_guest_key', '1')")

		// Migrate client_keys for user_id
		_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN user_id VARCHAR(255) DEFAULT ''")

		// Migrate key length in upstream_keys and client_keys for MySQL
		_, _ = db.Exec("ALTER TABLE upstream_keys MODIFY COLUMN `key` VARCHAR(512) NOT NULL")
		_, _ = db.Exec("ALTER TABLE client_keys MODIFY COLUMN `key` VARCHAR(512) NOT NULL")

	} else {
		// Enable WAL mode and busy timeout for concurrent access support
		_, _ = db.Exec("PRAGMA journal_mode=WAL;")
		_, _ = db.Exec("PRAGMA busy_timeout=5000;")

		// Support concurrent read connections under WAL mode
		db.SetMaxOpenConns(10)

		// Execute SQLite migrations
		if _, err := db.Exec(createTablesSQL); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to initialize SQLite schema: %v", err)
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
		_, _ = db.Exec("ALTER TABLE upstream_keys ADD COLUMN consecutive_failures INTEGER DEFAULT 0")

		// Add missing columns to client_keys
		_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
		_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN completion_tokens INTEGER DEFAULT 0")
		_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN total_tokens INTEGER DEFAULT 0")
		_, _ = db.Exec("ALTER TABLE client_keys ADD COLUMN user_id TEXT DEFAULT ''")

		// Create fallback_stats table if it doesn't exist
		_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS fallback_stats (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				total_requests INTEGER DEFAULT 0,
				success_count INTEGER DEFAULT 0,
				failure_count INTEGER DEFAULT 0
			)
		`)
		if err == nil {
			_, _ = db.Exec("ALTER TABLE fallback_stats ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
			_, _ = db.Exec("ALTER TABLE fallback_stats ADD COLUMN completion_tokens INTEGER DEFAULT 0")
			_, _ = db.Exec("ALTER TABLE fallback_stats ADD COLUMN total_tokens INTEGER DEFAULT 0")
		}
		if err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to create fallback_stats table: %v", err)
		}

		// Initialize fallback stats row if it doesn't exist
		var fallbackCount int
		err = db.QueryRow("SELECT COUNT(*) FROM fallback_stats").Scan(&fallbackCount)
		if err == nil && fallbackCount == 0 {
			_, _ = db.Exec("INSERT INTO fallback_stats (id, total_requests, success_count, failure_count) VALUES (1, 0, 0, 0)")
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
	}

	// Migrate legacy gcli_stats data to fallback_stats if gcli_stats table exists
	var legacyGcliCount int
	err = db.QueryRow("SELECT COUNT(*) FROM gcli_stats").Scan(&legacyGcliCount)
	if err == nil {
		// gcli_stats exists! Copy data to fallback_stats
		_, _ = db.Exec("DELETE FROM fallback_stats WHERE id = 1")
		_, errCopy := db.Exec("INSERT INTO fallback_stats (id, total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens) SELECT id, total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens FROM gcli_stats")
		if errCopy == nil {
			// Successfully copied. Drop the legacy gcli_stats table.
			_, _ = db.Exec("DROP TABLE gcli_stats")
		} else {
			// If copy failed, make sure we still have id = 1 in fallback_stats
			if isMySQL {
				_, _ = db.Exec("INSERT IGNORE INTO fallback_stats (id, total_requests, success_count, failure_count) VALUES (1, 0, 0, 0)")
			} else {
				_, _ = db.Exec("INSERT OR IGNORE INTO fallback_stats (id, total_requests, success_count, failure_count) VALUES (1, 0, 0, 0)")
			}
		}
	}

	s := &Store{
		db:              db,
		isMySQL:         isMySQL,
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
	rows, err := s.db.Query("SELECT `key`, status FROM client_keys")
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
	query := `
		SELECT id, label, ` + "`key`" + `, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms
		FROM upstream_keys
	`
	if s.isMySQL {
		query += " ORDER BY label ASC"
	} else {
		query += " ORDER BY label COLLATE NOCASE ASC"
	}
	rows, err := s.db.Query(query)
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
			INSERT INTO upstream_keys (id, label, `+"`key`"+`, status, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models)
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
			SET status = ?, 
				error_reason = CASE WHEN ? = 'active' THEN '' ELSE error_reason END,
				consecutive_failures = CASE WHEN ? = 'active' THEN 0 ELSE consecutive_failures END
			WHERE id = ?
		`, status, status, status, id)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			var temp string
			err = s.db.QueryRow("SELECT id FROM upstream_keys WHERE id = ?", id).Scan(&temp)
			if err != nil {
				return fmt.Errorf("key with id %s not found", id)
			}
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
			var temp string
			err = s.db.QueryRow("SELECT id FROM upstream_keys WHERE id = ?", id).Scan(&temp)
			if err != nil {
				return fmt.Errorf("key with id %s not found", id)
			}
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
			SELECT id, label, ` + "`key`" + `, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
			FROM upstream_keys
			WHERE (status = 'active' OR (status = 'cooldown' AND cooldown_until < ?)) AND supports_gemini = 1
			ORDER BY last_used ASC, id ASC
		`
		queryArgs = []interface{}{nowStr}
	case "claude":
		query = `
			SELECT id, label, ` + "`key`" + `, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
			FROM upstream_keys
			WHERE (status = 'active' OR (status = 'cooldown' AND cooldown_until < ?)) AND supports_claude = 1
			ORDER BY last_used ASC, id ASC
		`
		queryArgs = []interface{}{nowStr}
	default:
		query = `
			SELECT id, label, ` + "`key`" + `, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models
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
	rows, err := s.db.Query("SELECT `key`, value FROM settings")
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
			var err error
			if s.isMySQL {
				_, err = tx.Exec("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?", k, v, v)
			} else {
				_, err = tx.Exec("INSERT OR REPLACE INTO settings (`key`, value) VALUES (?, ?)", k, v)
			}
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
					consecutive_failures = 0,
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
					consecutive_failures = 0,
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
		var err error

		// Retrieve key label and consecutive failures for log snapshotting and cooldown backoff
		var label string
		var consecutiveFailures int
		if id == "fallback" {
			label = "Default-Fallback"
			consecutiveFailures = 0
		} else {
			err = s.db.QueryRow("SELECT label, consecutive_failures FROM upstream_keys WHERE id = ?", id).Scan(&label, &consecutiveFailures)
			if err != nil {
				label = "Deleted Key (" + id + ")"
				consecutiveFailures = 0
			}
		}
		currentFailures := consecutiveFailures + 1

		// Determine status and cooldown
		status = ""

		// Cap currentFailures to prevent integer overflow during exponentiation
		calcFailures := currentFailures
		if calcFailures > 8 {
			calcFailures = 8
		}
		multiplier := int64(1) << (calcFailures - 1)

		isCooldownError := false
		var cooldownDuration time.Duration

		switch statusCode {
		case 401, 403:
			isCooldownError = true
			secs := 300 * multiplier // 5 minutes base
			if secs > 3600 {
				secs = 3600 // max 1 hour
			}
			cooldownDuration = time.Duration(secs) * time.Second
		case 429:
			isCooldownError = true
			secs := 30 * multiplier // 30 seconds base
			if secs > 1800 {
				secs = 1800 // max 30 minutes
			}
			cooldownDuration = time.Duration(secs) * time.Second
		default:
			if statusCode == 0 || statusCode >= 500 {
				isCooldownError = true
				secs := 15 * multiplier // 15 seconds base
				if secs > 900 {
					secs = 900 // max 15 minutes
				}
				cooldownDuration = time.Duration(secs) * time.Second
			}
		}

		if isCooldownError {
			status = "cooldown"
			t := now.Add(cooldownDuration)
			cooldownUntilStr = formatTimeUTC(t)
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
		var errPrune error
		if s.isMySQL {
			_, errPrune = s.db.Exec(`
				DELETE FROM upstream_error_logs 
				WHERE id < (
					SELECT min_id FROM (
						SELECT MIN(id) AS min_id FROM (
							SELECT id FROM upstream_error_logs 
							ORDER BY id DESC 
							LIMIT 1000
						) AS t1
					) AS t2
				)
			`)
		} else {
			_, errPrune = s.db.Exec(`
				DELETE FROM upstream_error_logs 
				WHERE id NOT IN (
					SELECT id FROM upstream_error_logs 
					ORDER BY id DESC 
					LIMIT 1000
				)
			`)
		}
		if errPrune != nil {
			LogError("Failed to prune upstream error logs: %v", errPrune)
		}

		if id != "fallback" {
			if status != "" {
				_, err = s.db.Exec(`
					UPDATE upstream_keys
					SET failure_count = failure_count + 1,
						consecutive_failures = ?,
						error_reason = ?,
						status = ?,
						cooldown_until = ?
					WHERE id = ?
				`, currentFailures, reason, status, cooldownUntilStr, id)
				if err != nil {
					LogError("Failed updating status for failed key ID %s: %v", id, err)
				}
			} else {
				_, err = s.db.Exec(`
					UPDATE upstream_keys
					SET failure_count = failure_count + 1,
						consecutive_failures = ?,
						error_reason = ?
					WHERE id = ?
				`, currentFailures, reason, id)
				if err != nil {
					LogError("Failed recording failure for ID %s: %v", id, err)
				}
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

func (s *Store) RecordFallbackRequest() {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("UPDATE fallback_stats SET total_requests = total_requests + 1 WHERE id = 1")
		if err != nil {
			LogError("Failed recording Fallback request: %v", err)
		}
	})
}

func (s *Store) RecordFallbackSuccess(promptTokens int64, completionTokens int64) {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec(`
			UPDATE fallback_stats
			SET success_count = success_count + 1,
				prompt_tokens = prompt_tokens + ?,
				completion_tokens = completion_tokens + ?,
				total_tokens = total_tokens + ?
			WHERE id = 1
		`, promptTokens, completionTokens, promptTokens+completionTokens)
		if err != nil {
			LogError("Failed recording Fallback success: %v", err)
		}
	})
}

func (s *Store) RecordFallbackFailure() {
	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("UPDATE fallback_stats SET failure_count = failure_count + 1 WHERE id = 1")
		if err != nil {
			LogError("Failed recording Fallback failure: %v", err)
		}
	})
}

// Client API Keys Methods
func (s *Store) ListClientKeys() []ClientKeySafe {
	rows, err := s.db.Query("SELECT id, label, `key`, status, total_requests, last_used, prompt_tokens, completion_tokens, total_tokens, user_id FROM client_keys WHERE user_id IS NULL OR user_id = ''")
	if err != nil {
		LogError("Failed listing client keys: %v", err)
		return nil
	}
	defer rows.Close()

	safeKeys := []ClientKeySafe{}
	for rows.Next() {
		var ck ClientKey
		var lastUsed sql.NullTime
		var userID sql.NullString
		err := rows.Scan(&ck.ID, &ck.Label, &ck.Key, &ck.Status, &ck.TotalRequests, &lastUsed, &ck.PromptTokens, &ck.CompletionTokens, &ck.TotalTokens, &userID)
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
			UserID:           userID.String,
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
			WHERE `+"`key`"+` = ?
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
			INSERT INTO client_keys (id, label, `+"`key`"+`, status)
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
		err := s.db.QueryRow("SELECT `key` FROM client_keys WHERE id = ?", id).Scan(&k)
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
		err := s.db.QueryRow("SELECT `key` FROM client_keys WHERE id = ?", id).Scan(&k)
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
			var temp string
			err = s.db.QueryRow("SELECT id FROM client_keys WHERE id = ?", id).Scan(&temp)
			if err != nil {
				return fmt.Errorf("client key with id %s not found", id)
			}
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
			WHERE `+"`key`"+` = ?
		`, formatTimeUTC(time.Now()), keyStr)
		if err != nil {
			LogError("Failed updating client key stats: %v", err)
		}
	})

	return true
}

func (s *Store) GetStats() map[string]interface{} {
	nowStr := formatTimeUTC(time.Now())
	row := s.db.QueryRow(`
		SELECT 
			COUNT(id), 
			COALESCE(SUM(CASE WHEN status = 'active' OR (status = 'cooldown' AND cooldown_until < ?) THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cooldown' AND cooldown_until >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(total_requests), 0),
			COALESCE(SUM(success_count), 0),
			COALESCE(SUM(failure_count), 0),
			COALESCE(SUM(prompt_tokens), 0),
			COALESCE(SUM(completion_tokens), 0),
			COALESCE(SUM(total_tokens), 0)
		FROM upstream_keys
	`, nowStr, nowStr)

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

	// Get Fallback stats
	var fallbackTotalRequests, fallbackSuccessCount, fallbackFailureCount int64
	var fallbackPromptTokens, fallbackCompletionTokens, fallbackTotalTokens int64
	_ = s.db.QueryRow("SELECT total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens FROM fallback_stats WHERE id = 1").
		Scan(&fallbackTotalRequests, &fallbackSuccessCount, &fallbackFailureCount, &fallbackPromptTokens, &fallbackCompletionTokens, &fallbackTotalTokens)

	fallbackSuccessRate := 0.0
	fallbackTotalCompleted := fallbackSuccessCount + fallbackFailureCount
	if fallbackTotalCompleted > 0 {
		fallbackSuccessRate = (float64(fallbackSuccessCount) / float64(fallbackTotalCompleted)) * 100
	}

	return map[string]interface{}{
		"total_keys":                 totalKeys,
		"active_keys":                activeKeys,
		"failed_keys":                failedKeys,
		"cooldown_keys":              cooldownKeys,
		"disabled_keys":              disabledKeys,
		"total_requests":             totalRequests,
		"success_count":              successCount,
		"failure_count":              failureCount,
		"success_rate":               successRate,
		"prompt_tokens":              promptTokens,
		"completion_tokens":          completionTokens,
		"total_tokens":               totalTokens,
		"total_client_keys":          totalClientKeys,
		"active_client_keys":         activeClientKeys,
		"fallback_total_requests":    fallbackTotalRequests,
		"fallback_success_count":     fallbackSuccessCount,
		"fallback_failure_count":     fallbackFailureCount,
		"fallback_success_rate":      fallbackSuccessRate,
		"fallback_prompt_tokens":     fallbackPromptTokens,
		"fallback_completion_tokens": fallbackCompletionTokens,
		"fallback_total_tokens":      fallbackTotalTokens,
		// Legacy keys for backward compatibility
		"gcli_total_requests":    fallbackTotalRequests,
		"gcli_success_count":     fallbackSuccessCount,
		"gcli_failure_count":     fallbackFailureCount,
		"gcli_success_rate":      fallbackSuccessRate,
		"gcli_prompt_tokens":     fallbackPromptTokens,
		"gcli_completion_tokens": fallbackCompletionTokens,
		"gcli_total_tokens":      fallbackTotalTokens,
	}
}

func (s *Store) GetKeyByID(id string) (APIKey, error) {
	row := s.db.QueryRow(`
		SELECT id, label, `+"`key`"+`, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms
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
			SET label = ?, `+"`key`"+` = ?, upstream_url = ?, supports_openai = ?, supports_gemini = ?, supports_claude = ?, available_models = ?, selected_models = ?,
				status = CASE WHEN status IN ('failed', 'cooldown') THEN 'active' ELSE status END,
				error_reason = CASE WHEN status IN ('failed', 'cooldown') THEN '' ELSE error_reason END,
				consecutive_failures = 0
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
			var temp string
			err = s.db.QueryRow("SELECT id FROM upstream_keys WHERE id = ?", id).Scan(&temp)
			if err != nil {
				return fmt.Errorf("key with id %s not found", id)
			}
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

// ModelExists checks if the given model exists in the selected_models list of any configured upstream key that supports the requested API type.
// It intentionally includes keys in 'cooldown' and 'failed' states (but NOT 'disabled') so that requests for
// temporarily-unavailable models are allowed into the retry loop, which will then trigger fallback correctly
// instead of returning an immediate 404.
func (s *Store) ModelExists(model string, apiType string) (bool, error) {
	if model == "" {
		return true, nil
	}

	var query string
	switch apiType {
	case "gemini":
		query = "SELECT selected_models FROM upstream_keys WHERE supports_gemini = 1 AND status != 'disabled'"
	case "claude":
		query = "SELECT selected_models FROM upstream_keys WHERE supports_claude = 1 AND status != 'disabled'"
	default:
		query = "SELECT selected_models FROM upstream_keys WHERE supports_openai = 1 AND status != 'disabled'"
	}

	rows, err := s.db.Query(query)
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
	// Remove '-free' suffix at the end
	m = strings.TrimSuffix(m, "-free")
	return m
}

type BackupData struct {
	UpstreamKeys        []APIKey             `json:"upstream_keys"`
	ClientKeys          []ClientKey          `json:"client_keys"`
	Settings            map[string]string    `json:"settings"`
	FallbackStats       []map[string]any     `json:"fallback_stats"`
	GcliStats           []map[string]any     `json:"gcli_stats,omitempty"` // for backward compatibility
	Users               []User               `json:"users,omitempty"`
	ClientKeyModelStats []ClientKeyModelStat `json:"client_key_model_stats,omitempty"`
}

func (s *Store) ExportBackup() (*BackupData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Export Upstream Keys
	rows, err := s.db.Query("SELECT id, label, `key`, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms FROM upstream_keys")
	if err != nil {
		return nil, fmt.Errorf("failed to query upstream keys: %v", err)
	}
	defer rows.Close()

	var upstreamKeys []APIKey
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
			return nil, fmt.Errorf("failed to scan upstream key: %v", err)
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
		upstreamKeys = append(upstreamKeys, k)
	}
	rows.Close()

	// 2. Export Client Keys (including user_id)
	rows2, err := s.db.Query("SELECT id, label, `key`, status, total_requests, last_used, prompt_tokens, completion_tokens, total_tokens, user_id FROM client_keys")
	if err != nil {
		return nil, fmt.Errorf("failed to query client keys: %v", err)
	}
	defer rows2.Close()

	var clientKeys []ClientKey
	for rows2.Next() {
		var ck ClientKey
		var lastUsed sql.NullTime
		var userID sql.NullString
		err := rows2.Scan(&ck.ID, &ck.Label, &ck.Key, &ck.Status, &ck.TotalRequests, &lastUsed, &ck.PromptTokens, &ck.CompletionTokens, &ck.TotalTokens, &userID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan client key: %v", err)
		}
		if lastUsed.Valid {
			ck.LastUsed = lastUsed.Time
		}
		if userID.Valid {
			ck.UserID = userID.String
		}
		clientKeys = append(clientKeys, ck)
	}
	rows2.Close()

	// 3. Export Settings
	rows3, err := s.db.Query("SELECT `key`, value FROM settings")
	if err != nil {
		return nil, fmt.Errorf("failed to query settings: %v", err)
	}
	defer rows3.Close()
	settingsData := make(map[string]string)
	for rows3.Next() {
		var keyName, val string
		if err := rows3.Scan(&keyName, &val); err == nil {
			settingsData[keyName] = val
		}
	}
	rows3.Close()

	// 4. Export Fallback Stats
	rows4, err := s.db.Query("SELECT id, total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens FROM fallback_stats")
	if err != nil {
		return nil, fmt.Errorf("failed to query fallback stats: %v", err)
	}
	defer rows4.Close()
	var fallbackStats []map[string]any
	for rows4.Next() {
		var id int
		var totalRequests, successCount, failureCount, promptTokens, completionTokens, totalTokens int64
		err := rows4.Scan(&id, &totalRequests, &successCount, &failureCount, &promptTokens, &completionTokens, &totalTokens)
		if err != nil {
			return nil, fmt.Errorf("failed to scan fallback stats: %v", err)
		}
		fallbackStats = append(fallbackStats, map[string]any{
			"id":                id,
			"total_requests":    totalRequests,
			"success_count":     successCount,
			"failure_count":     failureCount,
			"prompt_tokens":     promptTokens,
			"completion_tokens": completionTokens,
			"total_tokens":      totalTokens,
		})
	}
	rows4.Close()

	// 5. Export Users
	rows5, err := s.db.Query("SELECT id, username, password_hash, status, created_at FROM users")
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %v", err)
	}
	defer rows5.Close()
	var users []User
	for rows5.Next() {
		var u User
		var createdAt sql.NullTime
		err := rows5.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Status, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %v", err)
		}
		if createdAt.Valid {
			u.CreatedAt = createdAt.Time
		}
		users = append(users, u)
	}
	rows5.Close()

	// 6. Export Client Key Model Stats
	rows6, err := s.db.Query("SELECT client_key_id, model_name, prompt_tokens, completion_tokens, total_tokens, total_requests FROM client_key_model_stats")
	if err != nil {
		return nil, fmt.Errorf("failed to query client key model stats: %v", err)
	}
	defer rows6.Close()
	var modelStats []ClientKeyModelStat
	for rows6.Next() {
		var ms ClientKeyModelStat
		err := rows6.Scan(&ms.ClientKeyID, &ms.ModelName, &ms.PromptTokens, &ms.CompletionTokens, &ms.TotalTokens, &ms.TotalRequests)
		if err != nil {
			return nil, fmt.Errorf("failed to scan client key model stat: %v", err)
		}
		modelStats = append(modelStats, ms)
	}
	rows6.Close()

	return &BackupData{
		UpstreamKeys:        upstreamKeys,
		ClientKeys:          clientKeys,
		Settings:            settingsData,
		FallbackStats:       fallbackStats,
		Users:               users,
		ClientKeyModelStats: modelStats,
	}, nil
}

func (s *Store) ImportBackup(data *BackupData) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	// 1. Truncate existing tables
	tables := []string{"upstream_keys", "client_keys", "settings", "fallback_stats", "users", "user_sessions", "client_key_model_stats"}
	for _, tbl := range tables {
		if _, err := tx.Exec("DELETE FROM " + tbl); err != nil {
			return fmt.Errorf("failed to clear table %s: %v", tbl, err)
		}
	}

	// 2. Import Settings
	for k, v := range data.Settings {
		_, err := tx.Exec("INSERT INTO settings (`key`, value) VALUES (?, ?)", k, v)
		if err != nil {
			return fmt.Errorf("failed to import setting %s: %v", k, err)
		}
	}

	// 3. Import Upstream Keys
	for _, k := range data.UpstreamKeys {
		var lastUsed, cooldownUntil interface{}
		if !k.LastUsed.IsZero() {
			lastUsed = formatTimeUTC(k.LastUsed)
		}
		if !k.CooldownUntil.IsZero() {
			cooldownUntil = formatTimeUTC(k.CooldownUntil)
		}

		_, err := tx.Exec(`
			INSERT INTO upstream_keys (
				id, label, `+"`key`"+`, status, error_reason, success_count, failure_count, total_requests, last_used, cooldown_until, upstream_url, supports_openai, supports_gemini, supports_claude, available_models, selected_models, prompt_tokens, completion_tokens, total_tokens, last_latency_ms, avg_latency_ms
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, k.ID, k.Label, k.Key, k.Status, k.ErrorReason, k.SuccessCount, k.FailureCount, k.TotalRequests, lastUsed, cooldownUntil, k.UpstreamURL, k.SupportsOpenAI, k.SupportsGemini, k.SupportsClaude, k.AvailableModels, k.SelectedModels, k.PromptTokens, k.CompletionTokens, k.TotalTokens, k.LastLatencyMs, k.AvgLatencyMs)
		if err != nil {
			return fmt.Errorf("failed to import upstream key %s: %v", k.Label, err)
		}
	}

	// 4. Import Client Keys (including user_id)
	for _, ck := range data.ClientKeys {
		var lastUsed interface{}
		if !ck.LastUsed.IsZero() {
			lastUsed = formatTimeUTC(ck.LastUsed)
		}

		_, err := tx.Exec(`
			INSERT INTO client_keys (
				id, label, `+"`key`"+`, status, total_requests, last_used, prompt_tokens, completion_tokens, total_tokens, user_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, ck.ID, ck.Label, ck.Key, ck.Status, ck.TotalRequests, lastUsed, ck.PromptTokens, ck.CompletionTokens, ck.TotalTokens, ck.UserID)
		if err != nil {
			return fmt.Errorf("failed to import client key %s: %v", ck.Label, err)
		}
	}

	// 5. Import Fallback Stats (support legacy gcli_stats if fallback_stats is not provided)
	statsToImport := data.FallbackStats
	if len(statsToImport) == 0 && len(data.GcliStats) > 0 {
		statsToImport = data.GcliStats
	}

	for _, stat := range statsToImport {
		idVal, _ := stat["id"].(float64)
		id := int(idVal)
		if id == 0 {
			id = 1
		}
		tr, _ := stat["total_requests"].(float64)
		sc, _ := stat["success_count"].(float64)
		fc, _ := stat["failure_count"].(float64)
		pt, _ := stat["prompt_tokens"].(float64)
		ct, _ := stat["completion_tokens"].(float64)
		tt, _ := stat["total_tokens"].(float64)

		_, err := tx.Exec(`
			INSERT INTO fallback_stats (
				id, total_requests, success_count, failure_count, prompt_tokens, completion_tokens, total_tokens
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`, id, int64(tr), int64(sc), int64(fc), int64(pt), int64(ct), int64(tt))
		if err != nil {
			return fmt.Errorf("failed to import Fallback stats: %v", err)
		}
	}

	// 6. Import Users
	for _, u := range data.Users {
		var createdAt interface{}
		if !u.CreatedAt.IsZero() {
			createdAt = formatTimeUTC(u.CreatedAt)
		}
		_, err := tx.Exec(`
			INSERT INTO users (id, username, password_hash, status, created_at)
			VALUES (?, ?, ?, ?, ?)
		`, u.ID, u.Username, u.PasswordHash, u.Status, createdAt)
		if err != nil {
			return fmt.Errorf("failed to import user %s: %v", u.Username, err)
		}
	}

	// 7. Import Client Key Model Stats
	for _, ms := range data.ClientKeyModelStats {
		_, err := tx.Exec(`
			INSERT INTO client_key_model_stats (client_key_id, model_name, prompt_tokens, completion_tokens, total_tokens, total_requests)
			VALUES (?, ?, ?, ?, ?, ?)
		`, ms.ClientKeyID, ms.ModelName, ms.PromptTokens, ms.CompletionTokens, ms.TotalTokens, ms.TotalRequests)
		if err != nil {
			return fmt.Errorf("failed to import client key model stats: %v", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Reload client keys cache
	if err := s.loadClientKeysCache(); err != nil {
		return fmt.Errorf("failed to reload client keys cache after restore: %v", err)
	}

	return nil
}

func hashPassword(password string) string {
	hasher := sha256.New()
	hasher.Write([]byte(password + "dc_salt_12345!"))
	return hex.EncodeToString(hasher.Sum(nil))
}

func (s *Store) RecordClientKeyTokensWithModel(keyStr, modelName string, promptTokens, completionTokens int64) {
	s.RecordClientKeyTokens(keyStr, promptTokens, completionTokens)

	if modelName == "" {
		modelName = "unknown"
	}
	modelName = cleanModelName(modelName)

	s.queueWrite(func() {
		s.mu.Lock()
		defer s.mu.Unlock()

		var clientKeyID string
		err := s.db.QueryRow("SELECT id FROM client_keys WHERE `key` = ?", keyStr).Scan(&clientKeyID)
		if err != nil {
			return
		}

		var query string
		if s.isMySQL {
			query = `
				INSERT INTO client_key_model_stats (client_key_id, model_name, prompt_tokens, completion_tokens, total_tokens, total_requests)
				VALUES (?, ?, ?, ?, ?, 1)
				ON DUPLICATE KEY UPDATE
					prompt_tokens = prompt_tokens + VALUES(prompt_tokens),
					completion_tokens = completion_tokens + VALUES(completion_tokens),
					total_tokens = total_tokens + VALUES(total_tokens),
					total_requests = total_requests + 1
			`
		} else {
			query = `
				INSERT INTO client_key_model_stats (client_key_id, model_name, prompt_tokens, completion_tokens, total_tokens, total_requests)
				VALUES (?, ?, ?, ?, ?, 1)
				ON CONFLICT(client_key_id, model_name) DO UPDATE SET
					prompt_tokens = prompt_tokens + excluded.prompt_tokens,
					completion_tokens = completion_tokens + excluded.completion_tokens,
					total_tokens = total_tokens + excluded.total_tokens,
					total_requests = total_requests + 1
			`
		}

		_, err = s.db.Exec(query, clientKeyID, modelName, promptTokens, completionTokens, promptTokens+completionTokens)
		if err != nil {
			LogError("Failed to update client key model stats: %v", err)
		}
	})
}

func (s *Store) RegisterUser(username, password string) error {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" || password == "" {
		return errors.New("username and password cannot be empty")
	}

	passwordHash := hashPassword(password)
	userID := generateID()

	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		var count int
		err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
		if err == nil && count > 0 {
			return errors.New("username already exists")
		}

		_, err = s.db.Exec("INSERT INTO users (id, username, password_hash, status) VALUES (?, ?, ?, 'pending')", userID, username, passwordHash)
		return err
	})
}

func (s *Store) AuthenticateUser(username, password string) (*User, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	passwordHash := hashPassword(password)

	var u User
	var createdAt time.Time
	err := s.db.QueryRow("SELECT id, username, password_hash, status, created_at FROM users WHERE username = ?", username).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Status, &createdAt)
	if err != nil {
		return nil, errors.New("invalid username or password")
	}

	if u.PasswordHash != passwordHash {
		return nil, errors.New("invalid username or password")
	}

	u.CreatedAt = createdAt
	return &u, nil
}

func (s *Store) GenerateAndCreateUserSession(userID string) (string, error) {
	bytes := make([]byte, 32)
	var token string
	if _, err := rand.Read(bytes); err != nil {
		token = generateID() + generateID()
	} else {
		token = hex.EncodeToString(bytes)
	}

	expiresAt := time.Now().Add(24 * time.Hour)

	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userID, formatTimeUTC(expiresAt))
		return err
	})
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *Store) ValidateUserSession(token string) (string, error) {
	var userID string
	var expiresAt time.Time
	err := s.db.QueryRow("SELECT user_id, expires_at FROM user_sessions WHERE token = ?", token).Scan(&userID, &expiresAt)
	if err != nil {
		return "", err
	}

	if time.Now().After(expiresAt) {
		_ = s.DeleteUserSession(token)
		return "", errors.New("session expired")
	}

	var status string
	err = s.db.QueryRow("SELECT status FROM users WHERE id = ?", userID).Scan(&status)
	if err != nil || status != "active" {
		return "", errors.New("user is disabled or pending")
	}

	return userID, nil
}

func (s *Store) DeleteUserSession(token string) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		_, err := s.db.Exec("DELETE FROM user_sessions WHERE token = ?", token)
		return err
	})
}

func (s *Store) GetUserStats(userID string) (map[string]interface{}, error) {
	var totalRequests, promptTokens, completionTokens, totalTokens int64
	err := s.db.QueryRow(`
		SELECT COALESCE(SUM(total_requests), 0), COALESCE(SUM(prompt_tokens), 0),
		       COALESCE(SUM(completion_tokens), 0), COALESCE(SUM(total_tokens), 0)
		FROM client_keys
		WHERE user_id = ?
	`, userID).Scan(&totalRequests, &promptTokens, &completionTokens, &totalTokens)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT ms.model_name, SUM(ms.prompt_tokens), SUM(ms.completion_tokens),
		       SUM(ms.total_tokens), SUM(ms.total_requests)
		FROM client_key_model_stats ms
		JOIN client_keys ck ON ms.client_key_id = ck.id
		WHERE ck.user_id = ?
		GROUP BY ms.model_name
		ORDER BY SUM(ms.total_tokens) DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	modelStats := []ModelStat{}
	for rows.Next() {
		var ms ModelStat
		if err := rows.Scan(&ms.ModelName, &ms.PromptTokens, &ms.CompletionTokens, &ms.TotalTokens, &ms.TotalRequests); err == nil {
			modelStats = append(modelStats, ms)
		}
	}

	keysRows, err := s.db.Query(`
		SELECT id, label, `+"`key`"+`, status, total_requests, last_used, prompt_tokens, completion_tokens, total_tokens
		FROM client_keys
		WHERE user_id = ?
		ORDER BY label ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer keysRows.Close()

	safeKeys := []ClientKeySafe{}
	for keysRows.Next() {
		var ck ClientKey
		var lastUsed sql.NullTime
		if err := keysRows.Scan(&ck.ID, &ck.Label, &ck.Key, &ck.Status, &ck.TotalRequests, &lastUsed, &ck.PromptTokens, &ck.CompletionTokens, &ck.TotalTokens); err == nil {
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
				UserID:           userID,
			})
		}
	}

	return map[string]interface{}{
		"total_requests":    totalRequests,
		"prompt_tokens":     promptTokens,
		"completion_tokens": completionTokens,
		"total_tokens":      totalTokens,
		"model_stats":       modelStats,
		"keys":              safeKeys,
	}, nil
}

func (s *Store) AddUserClientKey(userID, label string) (string, error) {
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
			INSERT INTO client_keys (id, label, `+"`key`"+`, status, user_id)
			VALUES (?, ?, ?, 'active', ?)
		`, generateID(), label, key, userID)
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

func (s *Store) UpdateUserClientKeyStatus(userID, keyID, status string) error {
	if status != "active" && status != "disabled" {
		return errors.New("invalid status: must be active or disabled")
	}

	var keyStr string
	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		err := s.db.QueryRow("SELECT `key` FROM client_keys WHERE id = ? AND user_id = ?", keyID, userID).Scan(&keyStr)
		if err != nil {
			return errors.New("key not found or unauthorized")
		}

		_, err = s.db.Exec("UPDATE client_keys SET status = ? WHERE id = ?", status, keyID)
		return err
	})
	if err != nil {
		return err
	}

	s.clientKeysMu.Lock()
	s.clientKeysCache[keyStr] = (status == "active")
	s.clientKeysMu.Unlock()

	return nil
}

func (s *Store) DeleteUserClientKey(userID, keyID string) error {
	var keyStr string
	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		err := s.db.QueryRow("SELECT `key` FROM client_keys WHERE id = ? AND user_id = ?", keyID, userID).Scan(&keyStr)
		if err != nil {
			return errors.New("key not found or unauthorized")
		}

		_, _ = s.db.Exec("DELETE FROM client_key_model_stats WHERE client_key_id = ?", keyID)
		_, err = s.db.Exec("DELETE FROM client_keys WHERE id = ?", keyID)
		return err
	})
	if err != nil {
		return err
	}

	s.clientKeysMu.Lock()
	delete(s.clientKeysCache, keyStr)
	s.clientKeysMu.Unlock()

	return nil
}

func (s *Store) ListUsersWithStats() ([]map[string]interface{}, error) {
	rows, err := s.db.Query(`
		SELECT u.id, u.username, u.status, u.created_at,
		       COUNT(ck.id) as total_client_keys,
		       COALESCE(SUM(ck.total_requests), 0) as total_requests,
		       COALESCE(SUM(ck.total_tokens), 0) as total_tokens
		FROM users u
		LEFT JOIN client_keys ck ON u.id = ck.user_id
		GROUP BY u.id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var id, username, status string
		var createdAt time.Time
		var totalClientKeys int
		var totalRequests, totalTokens int64
		if err := rows.Scan(&id, &username, &status, &createdAt, &totalClientKeys, &totalRequests, &totalTokens); err == nil {
			users = append(users, map[string]interface{}{
				"id":                id,
				"username":          username,
				"status":            status,
				"created_at":        createdAt,
				"total_client_keys": totalClientKeys,
				"total_requests":    totalRequests,
				"total_tokens":      totalTokens,
			})
		}
	}
	return users, nil
}

func (s *Store) UpdateUserStatus(userID, status string) error {
	if status != "active" && status != "disabled" {
		return errors.New("invalid status: must be active or disabled")
	}

	err := s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		res, err := s.db.Exec("UPDATE users SET status = ? WHERE id = ?", status, userID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			var temp string
			err = s.db.QueryRow("SELECT id FROM users WHERE id = ?", userID).Scan(&temp)
			if err != nil {
				return errors.New("user not found")
			}
		}

		if status == "disabled" {
			rowsKeys, errKeys := s.db.Query("SELECT `key` FROM client_keys WHERE user_id = ?", userID)
			if errKeys == nil {
				defer rowsKeys.Close()
				s.clientKeysMu.Lock()
				for rowsKeys.Next() {
					var keyStr string
					if err := rowsKeys.Scan(&keyStr); err == nil {
						s.clientKeysCache[keyStr] = false
					}
				}
				s.clientKeysMu.Unlock()
			}
			_, _ = s.db.Exec("UPDATE client_keys SET status = 'disabled' WHERE user_id = ?", userID)
		} else if status == "active" {
			rowsKeys, errKeys := s.db.Query("SELECT `key` FROM client_keys WHERE user_id = ?", userID)
			if errKeys == nil {
				defer rowsKeys.Close()
				s.clientKeysMu.Lock()
				for rowsKeys.Next() {
					var keyStr string
					if err := rowsKeys.Scan(&keyStr); err == nil {
						s.clientKeysCache[keyStr] = true
					}
				}
				s.clientKeysMu.Unlock()
			}
			_, _ = s.db.Exec("UPDATE client_keys SET status = 'active' WHERE user_id = ?", userID)
		}
		return nil
	})
	return err
}

func (s *Store) DeleteUser(userID string) error {
	return s.runSyncWrite(func() error {
		s.mu.Lock()
		defer s.mu.Unlock()

		rows, err := s.db.Query("SELECT `key` FROM client_keys WHERE user_id = ?", userID)
		if err == nil {
			defer rows.Close()
			s.clientKeysMu.Lock()
			for rows.Next() {
				var keyStr string
				if err := rows.Scan(&keyStr); err == nil {
					delete(s.clientKeysCache, keyStr)
				}
			}
			s.clientKeysMu.Unlock()
		}

		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()

		_, _ = tx.Exec("DELETE FROM client_key_model_stats WHERE client_key_id IN (SELECT id FROM client_keys WHERE user_id = ?)", userID)
		_, _ = tx.Exec("DELETE FROM client_keys WHERE user_id = ?", userID)
		_, _ = tx.Exec("DELETE FROM user_sessions WHERE user_id = ?", userID)
		_, _ = tx.Exec("DELETE FROM users WHERE id = ?", userID)

		return tx.Commit()
	})
}
