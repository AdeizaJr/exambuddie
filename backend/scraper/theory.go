// theory.go — scrapes open-ended theory questions from myschool.ng
// Runs after MCQ scraping. Extracts question + worked solution from the
// __NUXT_DATA__ JSON payload embedded in each page.
// Resume-safe: ON CONFLICT (source_id) DO NOTHING.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/jackc/pgx/v5/pgxpool"
)

var theorySubjects = []string{
	"mathematics",
	"english-language",
	"physics",
	"chemistry",
	"further-mathematics",
	"biology",
	"economics",
	"geography",
	"accounts-principles-of-accounts",
	"commerce",
	"government",
	"christian-religious-knowledge-crk",
	"agricultural-science",
	"islamic-religious-knowledge-irk",
	"history",
	"literature-in-english",
	"fine-arts",
	"music",
	"french",
	"animal-husbandry",
	"insurance",
	"civic-education",
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

var theoryExamTypes = []string{"waec", "neco"}

// nuxtDataRe matches the __NUXT_DATA__ script tag content
var nuxtDataRe = regexp.MustCompile(`(?s)<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>`)

// htmlTagRe strips HTML tags
var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

// nbspRe cleans &nbsp; and excess whitespace
var nbspRe = regexp.MustCompile(`&nbsp;|&#39;|&lt;|&gt;|&amp;`)

func cleanHTML(s string) string {
	s = htmlTagRe.ReplaceAllString(s, " ")
	s = nbspRe.ReplaceAllStringFunc(s, func(e string) string {
		switch e {
		case "&nbsp;":
			return " "
		case "&#39;":
			return "'"
		case "&lt;":
			return "<"
		case "&gt;":
			return ">"
		case "&amp;":
			return "&"
		}
		return e
	})
	// collapse whitespace
	return strings.Join(strings.Fields(s), " ")
}

type theoryQuestion struct {
	sourceID       string
	examType       string
	subject        string
	year           int
	questionText   string
	workedSolution string
}

// parseTheoryPage extracts a theory question from the page HTML.
// Returns nil if the page is an MCQ (has "Correct Option" text).
func parseTheoryPage(html, id, subject, examType string, year int) *theoryQuestion {
	// MCQ pages always contain "Correct Option" — skip them
	if strings.Contains(html, "Correct Option") {
		return nil
	}

	m := nuxtDataRe.FindStringSubmatch(html)
	if m == nil {
		return nil
	}

	var data []interface{}
	if err := json.Unmarshal([]byte(m[1]), &data); err != nil {
		return nil
	}

	// Find schema object: a map with both "question" and "explanation" int keys
	qIdx, expIdx := -1, -1
	for _, item := range data {
		obj, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		qVal, hasQ := obj["question"]
		expVal, hasExp := obj["explanation"]
		if hasQ && hasExp {
			if qi, ok := toInt(qVal); ok {
				qIdx = qi
			}
			if ei, ok := toInt(expVal); ok {
				expIdx = ei
			}
			break
		}
	}

	if qIdx < 0 || qIdx >= len(data) {
		return nil
	}

	qText := ""
	if s, ok := data[qIdx].(string); ok {
		qText = cleanHTML(s)
	}
	if len(qText) < 10 {
		return nil
	}

	solution := ""
	if expIdx >= 0 && expIdx < len(data) {
		if s, ok := data[expIdx].(string); ok {
			solution = cleanHTML(s)
		}
	}

	code, ok := subjectCode[subject]
	if !ok {
		code = subject
	}

	return &theoryQuestion{
		sourceID:       "ms_theory_" + id,
		examType:       strings.ToUpper(examType),
		subject:        code,
		year:           year,
		questionText:   qText,
		workedSolution: solution,
	}
}

func toInt(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	}
	return 0, false
}

func insertTheoryQuestion(ctx context.Context, pool *pgxpool.Pool, q *theoryQuestion) (bool, error) {
	var sol *string
	if q.workedSolution != "" {
		sol = &q.workedSolution
	}
	tag, err := pool.Exec(ctx, `
		INSERT INTO theory_questions
			(source_id, exam_type, subject, year, question_text, worked_solution, is_active)
		VALUES ($1,$2,$3,$4,$5,$6, $7)
		ON CONFLICT (source_id) DO NOTHING`,
		q.sourceID, q.examType, q.subject, q.year,
		q.questionText, sol, sol != nil, // is_active=true only if solution exists
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

const theoryTailPages = 3 // scan last N pages of main listing for open-ended questions

func collectTheoryIDs(ctx context.Context, subject, examType string, year int) ([]string, error) {
	// Use main listing (no paper_type filter) — open-ended questions appear at the end
	page1URL := fmt.Sprintf("%s/classroom/%s?exam_type=%s&exam_year=%d&page=1",
		baseURL, subject, examType, year)

	doc, err := fetchDoc(ctx, page1URL)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, nil
	}

	maxPage := parseMaxPage(doc)
	if maxPage == 0 {
		maxPage = 1
	}

	// Only fetch the last theoryTailPages pages — that's where open-ended Qs live
	startPage := maxPage - theoryTailPages + 1
	if startPage < 1 {
		startPage = 1
	}

	var ids []string
	for page := startPage; page <= maxPage; page++ {
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

func scrapeTheoryCombo(ctx context.Context, pool *pgxpool.Pool, c combo, st *stats) {
	ids, err := collectTheoryIDs(ctx, c.subject, c.examType, c.year)
	if err != nil {
		log.Printf("  ✗ theory list %s/%s/%d: %v", c.subject, c.examType, c.year, err)
		return
	}
	if len(ids) == 0 {
		return
	}

	log.Printf("  → theory %s/%s/%d: %d candidates", c.subject, c.examType, c.year, len(ids))

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

				// Fetch raw HTML (need full body, not just goquery doc)
				if err := limiter.Wait(ctx); err != nil {
					return
				}
				resp, err := fetchRaw(ctx, url)
				if err != nil || resp == "" {
					atomic.AddInt64(&st.skipped, 1)
					continue
				}

				q := parseTheoryPage(resp, id, c.subject, c.examType, c.year)
				if q == nil {
					atomic.AddInt64(&st.skipped, 1)
					continue
				}

				inserted, err := insertTheoryQuestion(ctx, pool, q)
				if err != nil {
					log.Printf("  ✗ theory insert %s: %v", q.sourceID, err)
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

func RunTheoryScraper(ctx context.Context, pool *pgxpool.Pool) {
	combos := make([]combo, 0, len(theorySubjects)*len(theoryExamTypes)*len(years))
	for _, s := range theorySubjects {
		for _, e := range theoryExamTypes {
			for _, y := range years {
				combos = append(combos, combo{s, e, y})
			}
		}
	}

	total := int64(len(combos))
	log.Printf("\n[Theory] Starting: %d subjects × %d exam types × %d years = %d combos\n",
		len(theorySubjects), len(theoryExamTypes), len(years), total)

	combosCh := make(chan combo, total)
	for _, c := range combos {
		combosCh <- c
	}
	close(combosCh)

	var st stats
	var done int64

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
				log.Printf("[theory %d/%d] %s/%s/%d", n, total, c.subject, c.examType, c.year)
				scrapeTheoryCombo(ctx, pool, c, &st)
			}
		}()
	}
	wg.Wait()

	log.Printf("\n[Theory] Done\n  inserted : %d\n  skipped  : %d\n  failed   : %d\n",
		atomic.LoadInt64(&st.inserted),
		atomic.LoadInt64(&st.skipped),
		atomic.LoadInt64(&st.failed),
	)
}
