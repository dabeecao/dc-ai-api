package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

var storeInstance *Store

type SearchResult struct {
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	URL     string `json:"url"`
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
	apiURL := fmt.Sprintf("https://%s.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=%s&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&format=json&redirects=1", lang, url.QueryEscape(query))

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

	var wikiResp struct {
		Query struct {
			Pages map[string]struct {
				PageID  int    `json:"pageid"`
				Title   string `json:"title"`
				Index   int    `json:"index"`
				Extract string `json:"extract"`
			} `json:"pages"`
		} `json:"query"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&wikiResp); err != nil {
		return nil, err
	}

	type pageItem struct {
		title   string
		index   int
		extract string
	}

	pages := []pageItem{}
	for _, p := range wikiResp.Query.Pages {
		pages = append(pages, pageItem{
			title:   p.Title,
			index:   p.Index,
			extract: p.Extract,
		})
	}

	sort.Slice(pages, func(i, j int) bool {
		return pages[i].index < pages[j].index
	})

	results := []SearchResult{}
	for _, page := range pages {
		snippet := stripHTML(page.extract)
		if snippet == "" {
			snippet = stripHTML(page.title)
		}
		cleanedExt := strings.ReplaceAll(snippet, "\n", " ")
		runes := []rune(cleanedExt)
		if len(runes) > 1000 {
			snippet = string(runes[:1000]) + "..."
		} else {
			snippet = cleanedExt
		}

		itemURL := fmt.Sprintf("https://%s.wikipedia.org/wiki/%s", lang, url.PathEscape(strings.ReplaceAll(page.title, " ", "_")))
		results = append(results, SearchResult{
			Title:   page.title + " (Wikipedia " + strings.ToUpper(lang) + ")",
			Snippet: snippet,
			URL:     itemURL,
		})
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

	var tavilyResults []SearchResult
	var wikiViResults []SearchResult
	var wikiEnResults []SearchResult
	var wg sync.WaitGroup

	tavilyAPIKey := os.Getenv("TAVILY_API_KEY")

	// Query Tavily if configured
	if tavilyAPIKey != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := queryTavily(tavilyAPIKey, query)
			if err == nil {
				tavilyResults = res
			} else {
				LogWarn("Tavily search error: %v", err)
			}
		}()
	}

	// Always query Wikipedia (vi) concurrently
	wg.Add(1)
	go func() {
		defer wg.Done()
		res, err := queryWikipedia(query, "vi")
		if err == nil {
			wikiViResults = res
		} else {
			LogWarn("Wikipedia (vi) search error: %v", err)
		}
	}()

	// Always query Wikipedia (en) concurrently
	wg.Add(1)
	go func() {
		defer wg.Done()
		res, err := queryWikipedia(query, "en")
		if err == nil {
			wikiEnResults = res
		} else {
			LogWarn("Wikipedia (en) search error: %v", err)
		}
	}()

	wg.Wait()

	// Merge results: Tavily first, then supplementary Wikipedia (vi) and (en)
	if len(tavilyResults) > 0 {
		results = append(results, tavilyResults...)

		// Add up to 3 Wikipedia results as supplementary grounding details
		added := 0
		maxExtraWiki := 3
		for _, r := range wikiViResults {
			if added >= maxExtraWiki {
				break
			}
			results = append(results, r)
			added++
		}
		for _, r := range wikiEnResults {
			if added >= maxExtraWiki {
				break
			}
			results = append(results, r)
			added++
		}
	} else {
		// If Tavily is not configured or returned no results, use all Wikipedia results
		results = append(results, wikiViResults...)
		results = append(results, wikiEnResults...)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(results)
}
