package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

var storeInstance *Store

type SearchResult struct {
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	URL     string `json:"url"`
}

type WikiSearchResponse struct {
	Query struct {
		Search []struct {
			Title   string `json:"title"`
			Snippet string `json:"snippet"`
			PageID  int    `json:"pageid"`
		} `json:"search"`
	} `json:"query"`
}

type TavilyResult struct {
	URL     string  `json:"url"`
	Title   string  `json:"title"`
	Content string  `json:"content"`
	Score   float64 `json:"score"`
}

type TavilyResponse struct {
	Results []TavilyResult `json:"results"`
}

func queryTavily(apiKey string, query string) ([]SearchResult, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	apiURL := "https://api.tavily.com/search"

	requestData := map[string]interface{}{
		"query":       query,
		"max_results": 5,
	}

	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Tavily HTTP %d", resp.StatusCode)
	}

	var tavilyResp TavilyResponse
	if err := json.NewDecoder(resp.Body).Decode(&tavilyResp); err != nil {
		return nil, err
	}

	results := []SearchResult{}
	for _, item := range tavilyResp.Results {
		snippet := stripHTML(item.Content)
		if snippet == "" {
			snippet = stripHTML(item.Title)
		}
		results = append(results, SearchResult{
			Title:   item.Title + " (Web)",
			Snippet: snippet,
			URL:     item.URL,
		})
	}

	return results, nil
}

var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)

func stripHTML(input string) string {
	cleaned := htmlTagRegex.ReplaceAllString(input, "")
	// Unescape common HTML entities
	cleaned = strings.ReplaceAll(cleaned, "&quot;", "\"")
	cleaned = strings.ReplaceAll(cleaned, "&amp;", "&")
	cleaned = strings.ReplaceAll(cleaned, "&lt;", "<")
	cleaned = strings.ReplaceAll(cleaned, "&gt;", ">")
	cleaned = strings.ReplaceAll(cleaned, "&#39;", "'")
	cleaned = strings.ReplaceAll(cleaned, "&nbsp;", " ")
	return strings.TrimSpace(cleaned)
}

func queryWikipedia(query string, lang string) ([]SearchResult, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	apiURL := fmt.Sprintf("https://%s.wikipedia.org/w/api.php?action=query&list=search&srsearch=%s&format=json&utf8=", lang, url.QueryEscape(query))

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "DC-AI-API-Proxy/1.0 (Contact: admin@example.com)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Wikipedia HTTP %d", resp.StatusCode)
	}

	var wikiResp WikiSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&wikiResp); err != nil {
		return nil, err
	}

	results := []SearchResult{}
	for i, item := range wikiResp.Query.Search {
		if i >= 3 { // limit to top 3
			break
		}
		snippet := stripHTML(item.Snippet)
		if snippet != "" {
			itemURL := fmt.Sprintf("https://%s.wikipedia.org/wiki/%s", lang, url.PathEscape(strings.ReplaceAll(item.Title, " ", "_")))
			results = append(results, SearchResult{
				Title:   item.Title + " (Wikipedia " + strings.ToUpper(lang) + ")",
				Snippet: snippet,
				URL:     itemURL,
			})
		}
	}

	return results, nil
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	token := authHeader
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("x-api-key")
	}
	if token == "" {
		token = r.URL.Query().Get("key")
	}

	if token != "" {
		guestKey := ""
		enableGuestKey := "1"
		if settings, err := storeInstance.GetSettings(); err == nil {
			guestKey = settings["guest_api_key"]
			if val, ok := settings["enable_guest_key"]; ok {
				enableGuestKey = val
			}
		}
		isGuest := guestKey != "" && token == guestKey && enableGuestKey != "0"
		isValid := false
		if isGuest {
			isValid = true
		} else {
			isValid = storeInstance.ValidateClientKey(token)
		}
		if !isValid {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error": {"message": "Unauthorized client API key"}}`))
			return
		}
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error": "Query parameter 'q' is required"}`))
		return
	}

	results := []SearchResult{}

	tavilyAPIKey := os.Getenv("TAVILY_API_KEY")
	if tavilyAPIKey != "" {
		tavilyResults, err := queryTavily(tavilyAPIKey, query)
		if err == nil && len(tavilyResults) > 0 {
			results = append(results, tavilyResults...)
		} else {
			if err != nil {
				LogWarn("Tavily search error: %v, falling back to Wikipedia", err)
			} else {
				LogWarn("Tavily returned empty results, falling back to Wikipedia")
			}
			wikiVi, err := queryWikipedia(query, "vi")
			if err == nil {
				results = append(results, wikiVi...)
			}

			wikiEn, err := queryWikipedia(query, "en")
			if err == nil {
				results = append(results, wikiEn...)
			}
		}
	} else {
		wikiVi, err := queryWikipedia(query, "vi")
		if err == nil {
			results = append(results, wikiVi...)
		}

		wikiEn, err := queryWikipedia(query, "en")
		if err == nil {
			results = append(results, wikiEn...)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(results)
}
