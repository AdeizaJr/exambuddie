//go:build ignore

// Backfill image_url for questions that reference "structure/figure/graph/diagram above/below"
// but have no image_url stored. Re-fetches each page and extracts the <img src>.
// Questions where no image is found on the page are deactivated (is_active = FALSE).
//
// Usage: go run backfill_images.go

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
	imgWorkers = 4
	imgRPS     = 4
	imgBurst   = 6
	imgTimeout = 20 * time.Second
	imgRetries = 3
)

type imgRow struct {
	id       int
	sourceID string
	subject  string
}

var imgSubjectSlug = map[string]string{
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
		WHERE is_active = TRUE
		  AND image_url IS NULL
		  AND source_id IS NOT NULL
		  AND (
		    question_text ILIKE '%structure above%'
		    OR question_text ILIKE '%figure above%'
		    OR question_text ILIKE '%diagram above%'
		    OR question_text ILIKE '%graph above%'
		    OR question_text ILIKE '%graphs below%'
		    OR question_text ILIKE '%table above%'
		    OR question_text ILIKE '%chart above%'
		    OR question_text ILIKE '%diagram below%'
		    OR question_text ILIKE '%figure below%'
		    OR question_text ILIKE '%structure below%'
		  )
		ORDER BY subject, id`)
	if err != nil {
		log.Fatalf("query: %v", err)
	}

	var questions []imgRow
	for rows.Next() {
		var q imgRow
		if err := rows.Scan(&q.id, &q.sourceID, &q.subject); err != nil {
			log.Fatalf("scan: %v", err)
		}
		questions = append(questions, q)
	}
	rows.Close()
	log.Printf("Found %d questions to backfill\n", len(questions))

	limiter := rate.NewLimiter(rate.Limit(imgRPS), imgBurst)
	client := &http.Client{Timeout: imgTimeout}

	var updated, deactivated, failed int64

	ch := make(chan imgRow, len(questions))
	for _, q := range questions {
		ch <- q
	}
	close(ch)

	var wg sync.WaitGroup
	for i := 0; i < imgWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for q := range ch {
				numID := strings.TrimPrefix(q.sourceID, "ms_")
				slug, ok := imgSubjectSlug[q.subject]
				if !ok {
					slug = q.subject
				}
				url := fmt.Sprintf("https://myschool.ng/classroom/%s/%s", slug, numID)

				imgURL, err := fetchImageURL(ctx, client, limiter, url)
				if err != nil {
					log.Printf("FAIL  id=%-6d %s: %v", q.id, q.sourceID, err)
					atomic.AddInt64(&failed, 1)
					continue
				}

				if imgURL == "" {
					// No image on page — question is unanswerable, deactivate
					_, err = pool.Exec(ctx,
						`UPDATE questions SET is_active = FALSE WHERE id = $1`,
						q.id,
					)
					if err != nil {
						log.Printf("DEACTIVATE FAIL id=%-6d: %v", q.id, err)
						atomic.AddInt64(&failed, 1)
					} else {
						log.Printf("DEACT id=%-6d %s (no image on source page)", q.id, q.sourceID)
						atomic.AddInt64(&deactivated, 1)
					}
					continue
				}

				_, err = pool.Exec(ctx,
					`UPDATE questions SET image_url = $1, has_diagram = TRUE WHERE id = $2`,
					imgURL, q.id,
				)
				if err != nil {
					log.Printf("UPDATE FAIL id=%-6d: %v", q.id, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				log.Printf("OK    id=%-6d %s → %s", q.id, q.sourceID, imgURL)
				atomic.AddInt64(&updated, 1)
			}
		}()
	}
	wg.Wait()

	log.Printf("\nDone  updated=%-4d deactivated=%-4d failed=%d\n", updated, deactivated, failed)
}

func fetchImageURL(ctx context.Context, client *http.Client, limiter *rate.Limiter, url string) (string, error) {
	for attempt := 1; attempt <= imgRetries; attempt++ {
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
			if attempt < imgRetries {
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
			if attempt < imgRetries {
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

		// Search both old (.question-desc) and new (h1) containers
		imgURL := ""
		containers := "#page-content-section .question-desc img, h1 img"
		doc.Find(containers).Each(func(_ int, img *goquery.Selection) {
			if imgURL != "" {
				return
			}
			if src, exists := img.Attr("src"); exists && strings.HasPrefix(src, "http") {
				imgURL = src
			}
		})
		return imgURL, nil
	}
	return "", fmt.Errorf("max retries exceeded")
}
