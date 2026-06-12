//go:build ignore

// Backfill correct years for JAMB language questions that were all tagged 2010.
// The scraper stored the discovery-loop year, not the page's actual year.
// This script fetches each question page, reads the year from the badge, and updates the DB.
//
// Usage: go run backfill_years.go

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
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
	bfWorkers = 5
	bfRPS     = 5
	bfBurst   = 8
	bfTimeout = 20 * time.Second
	bfRetries = 3
)

var (
	bfYearRe     = regexp.MustCompile(`\b(20\d{2})\b`)
	bfExamYearRe = regexp.MustCompile(`exam_year=(\d{4})`)
)

type bfRow struct {
	id       int
	sourceID string
	subject  string
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
		WHERE exam_type = 'JAMB'
		  AND subject IN ('igbo', 'hausa', 'arabic', 'yoruba')
		  AND year = 2010
		ORDER BY id`)
	if err != nil {
		log.Fatalf("query: %v", err)
	}

	var questions []bfRow
	for rows.Next() {
		var q bfRow
		if err := rows.Scan(&q.id, &q.sourceID, &q.subject); err != nil {
			log.Fatalf("scan: %v", err)
		}
		questions = append(questions, q)
	}
	rows.Close()

	log.Printf("Found %d questions to backfill\n", len(questions))

	limiter := rate.NewLimiter(rate.Limit(bfRPS), bfBurst)
	client := &http.Client{Timeout: bfTimeout}

	var updated, skipped, failed int64

	ch := make(chan bfRow, len(questions))
	for _, q := range questions {
		ch <- q
	}
	close(ch)

	var wg sync.WaitGroup
	for i := 0; i < bfWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for q := range ch {
				numID := strings.TrimPrefix(q.sourceID, "ms_")
				url := fmt.Sprintf("https://myschool.ng/classroom/%s/%s", q.subject, numID)

				year, err := fetchPageYear(ctx, client, limiter, url)
				if err != nil {
					log.Printf("FAIL  id=%-6d %s: %v", q.id, q.sourceID, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				if year == 0 || year == 2010 {
					// year=0 → badge not found; year=2010 → already correct
					atomic.AddInt64(&skipped, 1)
					continue
				}

				_, err = pool.Exec(ctx,
					`UPDATE questions SET year = $1 WHERE id = $2`,
					year, q.id,
				)
				if err != nil {
					log.Printf("UPDATE FAIL id=%-6d: %v", q.id, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				log.Printf("OK    id=%-6d %s %s → %d", q.id, q.subject, q.sourceID, year)
				atomic.AddInt64(&updated, 1)
			}
		}()
	}
	wg.Wait()

	log.Printf("\nDone  updated=%-4d skipped=%-4d failed=%d\n", updated, skipped, failed)
}

func fetchPageYear(ctx context.Context, client *http.Client, limiter *rate.Limiter, url string) (int, error) {
	for attempt := 1; attempt <= bfRetries; attempt++ {
		if err := limiter.Wait(ctx); err != nil {
			return 0, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return 0, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		resp, err := client.Do(req)
		if err != nil {
			if attempt < bfRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
				continue
			}
			return 0, err
		}

		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			return 0, nil
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			if attempt < bfRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
				continue
			}
			return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
		}

		doc, err := goquery.NewDocumentFromReader(resp.Body)
		resp.Body.Close()
		if err != nil {
			return 0, err
		}

		// Primary: badge <div class="... badge bg-success ...">JAMB 2020</div>
		year := 0
		doc.Find(".badge.bg-success").Each(func(_ int, s *goquery.Selection) {
			if year != 0 {
				return
			}
			if m := bfYearRe.FindString(strings.TrimSpace(s.Text())); m != "" {
				if y, err := strconv.Atoi(m); err == nil {
					year = y
				}
			}
		})

		// Fallback: breadcrumb link href containing exam_year=
		if year == 0 {
			doc.Find(".breadcrumb a[href]").Each(func(_ int, s *goquery.Selection) {
				if year != 0 {
					return
				}
				href, _ := s.Attr("href")
				if m := bfExamYearRe.FindStringSubmatch(href); m != nil {
					if y, err := strconv.Atoi(m[1]); err == nil {
						year = y
					}
				}
			})
		}

		return year, nil
	}
	return 0, fmt.Errorf("max retries exceeded")
}
