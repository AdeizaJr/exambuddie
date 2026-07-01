// Scraper for myschool.ng — stores directly into PostgreSQL, no JSON intermediary.
// Usage: go run main.go
// Resume-safe: ON CONFLICT (source_id) DO NOTHING skips already-imported questions.
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/time/rate"
)

// ── Config ───────────────────────────────────────────────────────────────────

const (
	baseURL      = "https://myschool.ng"
	comboWorkers = 4  // parallel (subject × examType × year) combos
	qWorkers     = 3  // parallel question fetches per combo
	reqPerSec    = 5  // global HTTP rate limit
	reqBurst     = 8
	httpTimeout  = 20 * time.Second
	maxRetries   = 3
)

var years = func() []int {
	ys := make([]int, 0, 16)
	for y := 2010; y <= 2026; y++ {
		ys = append(ys, y)
	}
	return ys
}()

var examTypes = []string{"waec", "neco", "jamb"}

var subjects = []string{
	"mathematics",
	"english-language",
	"chemistry",
	"physics",
	"biology",
	"geography",
	"literature-in-english",
	"economics",
	"commerce",
	"accounts-principles-of-accounts",
	"government",
	"christian-religious-knowledge-crk",
	"agricultural-science",
	"islamic-religious-knowledge-irk",
	"history",
	"fine-arts",
	"music",
	"french",
	"animal-husbandry",
	"insurance",
	"civic-education",
	"further-mathematics",
	"yoruba",
	"igbo",
	"arabic",
	"home-economics",
	"hausa",
	"book-keeping",
	"data-processing",
	"catering-craft-practice",
	"computer-studies",
	"marketing",
	"physical-education",
	"office-practice",
}

// subject slug → DB code (matches import.ts mapping)
var subjectCode = map[string]string{
	"mathematics":                       "math",
	"english-language":                  "english",
	"chemistry":                         "chemistry",
	"physics":                           "physics",
	"biology":                           "biology",
	"geography":                         "geography",
	"literature-in-english":             "literature",
	"economics":                         "economics",
	"commerce":                          "commerce",
	"accounts-principles-of-accounts":   "accounts",
	"government":                        "government",
	"christian-religious-knowledge-crk": "crk",
	"agricultural-science":              "agric",
	"islamic-religious-knowledge-irk":   "irk",
	"history":                           "history",
	"fine-arts":                         "fine-arts",
	"music":                             "music",
	"french":                            "french",
	"animal-husbandry":                  "animal-husbandry",
	"insurance":                         "insurance",
	"civic-education":                   "civic-education",
	"further-mathematics":               "further-math",
	"yoruba":                            "yoruba",
	"igbo":                              "igbo",
	"arabic":                            "arabic",
	"home-economics":                    "home-economics",
	"hausa":                             "hausa",
	"book-keeping":                      "book-keeping",
	"data-processing":                   "data-processing",
	"catering-craft-practice":           "catering",
	"computer-studies":                  "computer",
	"marketing":                         "marketing",
	"physical-education":                "pe",
	"office-practice":                   "office-practice",
}

// subject slug → human-readable name for the subjects table
var subjectName = map[string]string{
	"mathematics":                       "Mathematics",
	"english-language":                  "English Language",
	"chemistry":                         "Chemistry",
	"physics":                           "Physics",
	"biology":                           "Biology",
	"geography":                         "Geography",
	"literature-in-english":             "Literature In English",
	"economics":                         "Economics",
	"commerce":                          "Commerce",
	"accounts-principles-of-accounts":   "Accounts (Principles Of Accounts)",
	"government":                        "Government",
	"christian-religious-knowledge-crk": "Christian Religious Knowledge (CRK)",
	"agricultural-science":              "Agricultural Science",
	"islamic-religious-knowledge-irk":   "Islamic Religious Knowledge (IRK)",
	"history":                           "History",
	"fine-arts":                         "Fine Arts",
	"music":                             "Music",
	"french":                            "French",
	"animal-husbandry":                  "Animal Husbandry",
	"insurance":                         "Insurance",
	"civic-education":                   "Civic Education",
	"further-mathematics":               "Further Mathematics",
	"yoruba":                            "Yoruba",
	"igbo":                              "Igbo",
	"arabic":                            "Arabic",
	"home-economics":                    "Home Economics",
	"hausa":                             "Hausa",
	"book-keeping":                      "Book Keeping",
	"data-processing":                   "Data Processing",
	"catering-craft-practice":           "Catering Craft Practice",
	"computer-studies":                  "Computer Studies",
	"marketing":                         "Marketing",
	"physical-education":                "Physical Education",
	"office-practice":                   "Office Practice",
}

// ── Types ────────────────────────────────────────────────────────────────────

type combo struct {
	subject  string
	examType string
	year     int
}

type question struct {
	sourceID      string
	examType      string
	subject       string
	year          int
	questionText  string
	optionA       string
	optionB       string
	optionC       string
	optionD       string
	optionE       string // may be empty
	correctOption string
	explanation   string // may be empty
	imageURL      string // may be empty
}

type stats struct {
	inserted int64
	skipped  int64
	failed   int64
}

// ── HTTP / rate-limiter ──────────────────────────────────────────────────────

var (
	limiter = rate.NewLimiter(rate.Limit(reqPerSec), reqBurst)
	client  = &http.Client{Timeout: httpTimeout}
)

// fetchDoc fetches a URL and returns a parsed goquery document.
// Returns (nil, nil) on 404. Retries up to maxRetries on transient errors.
func fetchDoc(ctx context.Context, url string) (*goquery.Document, error) {
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if err := limiter.Wait(ctx); err != nil {
			return nil, err // context cancelled
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			if attempt < maxRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
			}
			continue
		}

		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			return nil, nil
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
			if attempt < maxRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
			}
			continue
		}

		doc, err := goquery.NewDocumentFromReader(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		return doc, nil
	}
	return nil, lastErr
}

// fetchRaw fetches a URL and returns the raw HTML body as a string.
// Used by the theory scraper which needs the full HTML for regex/JSON parsing.
func fetchRaw(ctx context.Context, url string) (string, error) {
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if err := limiter.Wait(ctx); err != nil {
			return "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			if attempt < maxRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
			}
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			return "", nil
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
			if attempt < maxRetries {
				time.Sleep(time.Duration(attempt*2) * time.Second)
			}
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		return string(body), nil
	}
	return "", lastErr
}

// ── HTML parsing ─────────────────────────────────────────────────────────────

var (
	questionIDRe    = regexp.MustCompile(`/classroom/[^/]+/(\d+)`)
	correctAnswerRe = regexp.MustCompile(`(?i)Option\s+([A-E])`)
)

func parseMaxPage(doc *goquery.Document) int {
	max := 1
	doc.Find("ul.pagination a.page-link").Each(func(_ int, s *goquery.Selection) {
		n, err := strconv.Atoi(strings.TrimSpace(s.Text()))
		if err == nil && n > max {
			max = n
		}
	})
	return max
}

func extractIDs(doc *goquery.Document) []string {
	seen := make(map[string]bool)
	var ids []string
	doc.Find("a[href]").Each(func(_ int, s *goquery.Selection) {
		href, _ := s.Attr("href")
		if m := questionIDRe.FindStringSubmatch(href); m != nil {
			if !seen[m[1]] {
				seen[m[1]] = true
				ids = append(ids, m[1])
			}
		}
	})
	return ids
}

func parseQuestionPage(doc *goquery.Document, id, subject, examType string, year int) *question {
	// Try old layout first (legacy pages still serve this)
	if section := doc.Find("#page-content-section"); section.Length() > 0 {
		return parseOldLayout(doc, section, id, subject, examType, year)
	}
	// New Tailwind/Nuxt layout
	return parseNewLayout(doc, id, subject, examType, year)
}

func parseOldLayout(doc *goquery.Document, section *goquery.Selection, id, subject, examType string, year int) *question {
	// Question text
	descClone := section.Find(".question-desc").First().Clone()
	imageURL := ""
	descClone.Find("img").Each(func(_ int, img *goquery.Selection) {
		if imageURL != "" {
			return
		}
		if src, exists := img.Attr("src"); exists && strings.HasPrefix(src, "http") {
			imageURL = src
		}
	})
	descClone.Find("a").Remove()
	descClone.Find("img").Remove()
	descClone.Find("u,ins").Each(func(_ int, u *goquery.Selection) {
		u.ReplaceWithHtml("*" + strings.TrimSpace(u.Text()) + "*")
	})
	qText := strings.TrimSpace(descClone.Text())
	if qText == "" {
		return nil
	}

	opts := make(map[string]string, 5)
	section.Find("ul.list-unstyled li").Each(func(_ int, s *goquery.Selection) {
		letter := strings.TrimRight(strings.TrimSpace(s.Find("strong").First().Text()), ".")
		letter = strings.ToUpper(letter)
		clone := s.Clone()
		clone.Find("strong").Remove()
		text := strings.TrimSpace(clone.Text())
		if letter != "" && text != "" {
			opts[letter] = text
		}
	})
	if opts["A"] == "" || opts["B"] == "" {
		return nil
	}

	correct := ""
	if m := correctAnswerRe.FindStringSubmatch(
		strings.TrimSpace(section.Find("h5.text-success").First().Text()),
	); m != nil {
		correct = strings.ToUpper(m[1])
	}
	if correct == "" {
		return nil
	}

	expClone := section.Find("h5.text-success").Closest("div.mb-4").Clone()
	expClone.Find("h5").Remove()
	expClone.Find(".t_container").Remove()
	explanation := strings.Join(strings.Fields(expClone.Text()), " ")
	if explanation == "Explanation" || len(explanation) <= 10 {
		explanation = ""
	}

	code, ok := subjectCode[subject]
	if !ok {
		code = subject
	}
	return &question{
		sourceID: "ms_" + id, examType: strings.ToUpper(examType), subject: code, year: year,
		questionText: qText, optionA: opts["A"], optionB: opts["B"], optionC: opts["C"],
		optionD: opts["D"], optionE: opts["E"], correctOption: correct,
		explanation: explanation, imageURL: imageURL,
	}
}

// parseNewLayout handles the Nuxt/Tailwind layout introduced mid-2026.
// Question: first <h1>, Options: div.space-y-1 > div (letter=span.uppercase, text=p.font-medium),
// Correct: green-bg option div, Explanation: p.text-tx_secondary after h4.fancy-text.
func parseNewLayout(doc *goquery.Document, id, subject, examType string, year int) *question {
	// Question text — first h1 on the page
	h1 := doc.Find("h1").First()
	if h1.Length() == 0 {
		return nil
	}
	h1Clone := h1.Clone()
	imageURL := ""
	h1Clone.Find("img").Each(func(_ int, img *goquery.Selection) {
		if imageURL != "" {
			return
		}
		if src, exists := img.Attr("src"); exists && strings.HasPrefix(src, "http") {
			imageURL = src
		}
	})
	h1Clone.Find("img").Remove()
	h1Clone.Find("u,ins").Each(func(_ int, u *goquery.Selection) {
		u.ReplaceWithHtml("*" + strings.TrimSpace(u.Text()) + "*")
	})
	qText := strings.TrimSpace(h1Clone.Text())
	if qText == "" {
		return nil
	}

	// Options — each option is a child div of the first div.space-y-1 block
	opts := make(map[string]string, 5)
	correct := ""
	doc.Find("div.space-y-1").First().Children().Each(func(_ int, opt *goquery.Selection) {
		letter := strings.ToUpper(strings.TrimSpace(opt.Find("span.uppercase").First().Text()))
		text := strings.TrimSpace(opt.Find("p.font-medium").First().Text())
		if letter == "" || text == "" || len(letter) > 1 {
			return
		}
		opts[letter] = text
		// Correct option has a green background class
		cls, _ := opt.Attr("class")
		if strings.Contains(cls, "DFFFEC") {
			correct = letter
		}
	})
	if opts["A"] == "" || opts["B"] == "" {
		return nil
	}

	// Fallback: correct from explanation section "Correct Option: A"
	if correct == "" {
		doc.Find("h4.fancy-text").Each(func(_ int, h4 *goquery.Selection) {
			if correct != "" {
				return
			}
			parent := h4.Parent()
			letterSpan := parent.Find("span.uppercase.font-semibold").First()
			if l := strings.ToUpper(strings.TrimSpace(letterSpan.Text())); l != "" {
				correct = l
			}
		})
	}
	if correct == "" {
		return nil
	}

	// Explanation — p.text-tx_secondary scoped to the explanation container.
	// Skip known UI placeholder strings.
	explanation := ""
	skip := map[string]bool{"No video available": true, "Explanation": true}
	doc.Find("h4.fancy-text").First().Parent().Find("p.text-tx_secondary").Each(func(_ int, p *goquery.Selection) {
		if explanation != "" {
			return
		}
		t := strings.TrimSpace(p.Text())
		if len(t) > 10 && !skip[t] {
			explanation = t
		}
	})

	code, ok := subjectCode[subject]
	if !ok {
		code = subject
	}
	return &question{
		sourceID: "ms_" + id, examType: strings.ToUpper(examType), subject: code, year: year,
		questionText: qText, optionA: opts["A"], optionB: opts["B"], optionC: opts["C"],
		optionD: opts["D"], optionE: opts["E"], correctOption: correct,
		explanation: explanation, imageURL: imageURL,
	}
}

// ── Database ─────────────────────────────────────────────────────────────────

func ensureSubjects(ctx context.Context, pool *pgxpool.Pool) error {
	for slug, code := range subjectCode {
		name := subjectName[slug]
		if name == "" {
			name = slug
		}
		_, err := pool.Exec(ctx,
			`INSERT INTO subjects (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
			code, name,
		)
		if err != nil {
			return fmt.Errorf("seeding subject %q: %w", code, err)
		}
	}
	return nil
}

// insertQuestion returns true if a new row was inserted, false if skipped (duplicate).
func insertQuestion(ctx context.Context, pool *pgxpool.Pool, q *question) (bool, error) {
	var optE *string
	if q.optionE != "" {
		optE = &q.optionE
	}
	var expl *string
	if q.explanation != "" {
		expl = &q.explanation
	}
	var imgURL *string
	if q.imageURL != "" {
		imgURL = &q.imageURL
	}

	tag, err := pool.Exec(ctx, `
		INSERT INTO questions
			(exam_type, subject, year, question_text,
			 option_a, option_b, option_c, option_d, option_e,
			 correct_option, explanation, source_id, image_url, has_diagram)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (source_id) DO NOTHING`,
		q.examType, q.subject, q.year, q.questionText,
		q.optionA, q.optionB, q.optionC, q.optionD, optE,
		q.correctOption, expl, q.sourceID, imgURL, imgURL != nil,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ── Scraping logic ────────────────────────────────────────────────────────────

func collectIDs(ctx context.Context, subject, examType string, year int) ([]string, error) {
	url := fmt.Sprintf("%s/classroom/%s?exam_type=%s&exam_year=%d&page=1",
		baseURL, subject, examType, year)

	doc, err := fetchDoc(ctx, url)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, nil // 404 — combo doesn't exist
	}

	maxPage := parseMaxPage(doc)
	ids := extractIDs(doc)

	for page := 2; page <= maxPage; page++ {
		if ctx.Err() != nil {
			break
		}
		pageURL := fmt.Sprintf("%s/classroom/%s?exam_type=%s&exam_year=%d&page=%d",
			baseURL, subject, examType, year, page)
		d, err := fetchDoc(ctx, pageURL)
		if err != nil || d == nil {
			break
		}
		ids = append(ids, extractIDs(d)...)
	}

	// global deduplicate across pages
	seen := make(map[string]bool, len(ids))
	unique := make([]string, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			unique = append(unique, id)
		}
	}
	return unique, nil
}

func scrapeCombo(ctx context.Context, pool *pgxpool.Pool, c combo, st *stats) {
	ids, err := collectIDs(ctx, c.subject, c.examType, c.year)
	if err != nil {
		log.Printf("  ✗ list %s/%s/%d: %v", c.subject, c.examType, c.year, err)
		return
	}
	if len(ids) == 0 {
		return // no questions for this combo — not an error
	}

	log.Printf("  → %s/%s/%d: %d questions found", c.subject, c.examType, c.year, len(ids))

	idsCh := make(chan string, len(ids))
	for _, id := range ids {
		idsCh <- id
	}
	close(idsCh)

	var wg sync.WaitGroup
	for range qWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range idsCh {
				if ctx.Err() != nil {
					return
				}
				url := fmt.Sprintf("%s/classroom/%s/%s", baseURL, c.subject, id)
				doc, err := fetchDoc(ctx, url)
				if err != nil || doc == nil {
					atomic.AddInt64(&st.skipped, 1)
					continue
				}
				q := parseQuestionPage(doc, id, c.subject, c.examType, c.year)
				if q == nil {
					atomic.AddInt64(&st.skipped, 1)
					continue
				}
				inserted, err := insertQuestion(ctx, pool, q)
				if err != nil {
					log.Printf("  ✗ insert %s: %v", q.sourceID, err)
					atomic.AddInt64(&st.failed, 1)
					continue
				}
				if inserted {
					atomic.AddInt64(&st.inserted, 1)
				} else {
					atomic.AddInt64(&st.skipped, 1)
				}
			}
		}()
	}
	wg.Wait()
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	// Load .env from project root (one level up)
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}
	log.Println("Connected to database")

	if err := ensureSubjects(ctx, pool); err != nil {
		log.Fatalf("ensureSubjects: %v", err)
	}
	log.Println("Subjects seeded")

	// Build all combos upfront
	combos := make([]combo, 0, len(subjects)*len(examTypes)*len(years))
	for _, s := range subjects {
		for _, e := range examTypes {
			for _, y := range years {
				combos = append(combos, combo{s, e, y})
			}
		}
	}
	total := int64(len(combos))
	log.Printf("\nStarting: %d subjects × %d exam types × %d years = %d combos\n",
		len(subjects), len(examTypes), len(years), total)

	combosCh := make(chan combo, total)
	for _, c := range combos {
		combosCh <- c
	}
	close(combosCh)

	var st stats
	var done int64
	start := time.Now()

	var wg sync.WaitGroup
	for range comboWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for c := range combosCh {
				if ctx.Err() != nil {
					return
				}
				n := atomic.AddInt64(&done, 1)
				log.Printf("[%d/%d] %s/%s/%d", n, total, c.subject, c.examType, c.year)
				scrapeCombo(ctx, pool, c, &st)
			}
		}()
	}
	wg.Wait()

	if ctx.Err() != nil {
		log.Println("\nInterrupted — partial results below")
	}
	log.Printf("\n[MCQ] Done in %s\n  inserted : %d\n  skipped  : %d\n  failed   : %d\n",
		time.Since(start).Round(time.Second),
		atomic.LoadInt64(&st.inserted),
		atomic.LoadInt64(&st.skipped),
		atomic.LoadInt64(&st.failed),
	)

	if ctx.Err() == nil {
		RunTheoryScraper(ctx, pool)
	}
}
