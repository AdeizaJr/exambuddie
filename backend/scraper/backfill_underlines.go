//go:build ignore

// Backfill underline markup for questions that mention "underlined" but have no *...* markers.
// Re-fetches each question page from myschool.ng and extracts <u> tags as *...*.
//
// Usage: go run backfill_underlines.go

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/time/rate"
)

const (
	ulWorkers = 4
	ulRPS     = 4
	ulBurst   = 6
	ulTimeout = 20 * time.Second
	ulRetries = 3
)

type ulRow struct {
	id       int
	sourceID string
	subject  string
}

// Same slug map as backfill_years.go
var ulSubjectSlug = map[string]string{
	"math":             "mathematics",
	"english":          "english-language",
	"chemistry":        "chemistry",
	"physics":          "physics",
	"biology":          "biology",
	"geography":        "geography",
	"literature":       "literature-in-english",
	"economics":        "economics",
	"commerce":         "commerce",
	"accounts":         "accounts-principles-of-accounts",
	"government":       "government",
	"crk":              "christian-religious-knowledge-crk",
	"agric":            "agricultural-science",
	"irk":              "islamic-religious-knowledge-irk",
	"history":          "history",
	"fine-arts":        "fine-arts",
	"music":            "music",
	"french":           "french",
	"animal-husbandry": "animal-husbandry",
	"insurance":        "insurance",
	"civic-education":  "civic-education",
	"further-math":     "further-mathematics",
	"yoruba":           "yoruba",
	"igbo":             "igbo",
	"arabic":           "arabic",
	"home-economics":   "home-economics",
	"hausa":            "hausa",
	"book-keeping":     "book-keeping",
	"data-processing":  "data-processing",
	"computer":         "computer-studies",
	"marketing":        "marketing",
	"pe":               "physical-education",
	"office-practice":  "office-practice",
}

func main() {
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `
		SELECT id, source_id, subject
		FROM questions
		WHERE (question_text ILIKE '%underlined%' OR question_text ILIKE '%underline%')
		  AND question_text NOT LIKE '%*%'
		  AND source_id IS NOT NULL
		ORDER BY subject, id`)
	if err != nil {
		log.Fatalf("query: %v", err)
	}

	var questions []ulRow
	for rows.Next() {
		var q ulRow
		if err := rows.Scan(&q.id, &q.sourceID, &q.subject); err != nil {
			log.Fatalf("scan: %v", err)
		}
		questions = append(questions, q)
	}
	rows.Close()
	log.Printf("Found %d questions to backfill\n", len(questions))

	limiter := rate.NewLimiter(rate.Limit(ulRPS), ulBurst)
	client := &http.Client{Timeout: ulTimeout}

	var updated, skipped, failed int64

	ch := make(chan ulRow, len(questions))
	for _, q := range questions {
		ch <- q
	}
	close(ch)

	var wg sync.WaitGroup
	for i := 0; i < ulWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for q := range ch {
				numID := strings.TrimPrefix(q.sourceID, "ms_")
				slug, ok := ulSubjectSlug[q.subject]
				if !ok {
					slug = q.subject
				}
				url := fmt.Sprintf("https://myschool.ng/classroom/%s/%s", slug, numID)

				newText, err := fetchQuestionText(ctx, client, limiter, url)
				if err != nil {
					log.Printf("FAIL  id=%-6d %s: %v", q.id, q.sourceID, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				if newText == "" || !strings.Contains(newText, "*") {
					log.Printf("SKIP  id=%-6d %s (no <u> found on page)", q.id, q.sourceID)
					atomic.AddInt64(&skipped, 1)
					continue
				}

				_, err = pool.Exec(ctx,
					`UPDATE questions SET question_text = $1 WHERE id = $2`,
					newText, q.id,
				)
				if err != nil {
					log.Printf("UPDATE FAIL id=%-6d: %v", q.id, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				log.Printf("OK    id=%-6d %s %s → %q", q.id, q.subject, q.sourceID, newText[:min(60, len(newText))])
				atomic.AddInt64(&updated, 1)
			}
		}()
	}
	wg.Wait()

	log.Printf("\nDone  updated=%-4d skipped=%-4d failed=%d\n", updated, skipped, failed)
}

func fetchQuestionText(ctx context.Context, client *http.Client, limiter *rate.Limiter, url string) (string, error) {
	for attempt := 1; attempt <= ulRetries; attempt++ {
		if err := limiter.Wait(ctx); err != nil {
			return "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		resp, err := client.Do(req)
		if err != nil {
			if attempt < ulRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
				continue
			}
			return "", err
		}
		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			return "", nil
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			if attempt < ulRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
				continue
			}
			return "", fmt.Errorf("HTTP %d", resp.StatusCode)
		}

		doc, err := goquery.NewDocumentFromReader(resp.Body)
		resp.Body.Close()
		if err != nil {
			return "", err
		}

		// Try old layout
		var target *goquery.Selection
		if section := doc.Find("#page-content-section"); section.Length() > 0 {
			target = section.Find(".question-desc").First()
		} else {
			// New Nuxt/Tailwind layout — question is in first <h1>
			target = doc.Find("h1").First()
		}
		if target.Length() == 0 {
			return "", nil
		}

		descClone := target.Clone()
		descClone.Find("a").Remove()
		descClone.Find("img").Remove()
		// Both <u> and <ins> represent underline on myschool.ng
		descClone.Find("u,ins").Each(func(_ int, u *goquery.Selection) {
			u.ReplaceWithHtml("*" + strings.TrimSpace(u.Text()) + "*")
		})
		return strings.TrimSpace(descClone.Text()), nil
	}
	return "", fmt.Errorf("max retries exceeded")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
