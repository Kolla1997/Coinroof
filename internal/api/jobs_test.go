package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Background jobs for the outside timer (#334).
const testJobsKey = "test-only-jobs-key-0123456789abcdef"

func jobsRouter(t *testing.T, run map[string]func(context.Context)) http.Handler {
	return NewRouter(Deps{WebDir: t.TempDir(), RequireAuth: fakeAuth, Store: &fakeStore{}, Jobs: Jobs{Secret: testJobsKey, Run: run}})
}

func postJob(h http.Handler, name, key string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/jobs/"+name, strings.NewReader(""))
	if key != "" {
		req.Header.Set(JobsKeyHeader, key)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestJobsNeedTheKey(t *testing.T) {
	var ran atomic.Int32
	h := jobsRouter(t, map[string]func(context.Context){"sync": func(context.Context) { ran.Add(1) }})
	for _, key := range []string{"", "wrong", testJobsKey + "x"} {
		if rec := postJob(h, "sync", key); rec.Code != http.StatusNotFound {
			t.Errorf("key %q: %d, want 404", key, rec.Code)
		}
	}
	if rec := postJob(h, "nope", testJobsKey); rec.Code != http.StatusNotFound {
		t.Errorf("unknown job: %d, want 404", rec.Code)
	}
	if ran.Load() != 0 {
		t.Fatal("a job ran without the key")
	}
	if rec := postJob(h, "sync", testJobsKey); rec.Code != http.StatusNoContent || ran.Load() != 1 {
		t.Fatalf("with the key: %d, ran %d", rec.Code, ran.Load())
	}
}

func TestJobsRunOneAtATime(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	h := jobsRouter(t, map[string]func(context.Context){
		"sync":  func(context.Context) { close(started); <-release },
		"email": func(context.Context) {},
	})
	done := make(chan int)
	go func() { done <- postJob(h, "sync", testJobsKey).Code }()
	<-started
	if rec := postJob(h, "sync", testJobsKey); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "already_running") {
		t.Errorf("second sync: %d %s", rec.Code, rec.Body)
	}
	// Other jobs aren't held up.
	if rec := postJob(h, "email", testJobsKey); rec.Code != http.StatusNoContent {
		t.Errorf("email while sync runs: %d", rec.Code)
	}
	close(release)
	select {
	case code := <-done:
		if code != http.StatusNoContent {
			t.Errorf("first sync: %d", code)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("first sync never finished")
	}
}

func TestNoJobsWithoutASecret(t *testing.T) {
	var ran atomic.Int32
	h := NewRouter(Deps{WebDir: t.TempDir(), RequireAuth: fakeAuth, Store: &fakeStore{}, Jobs: Jobs{Run: map[string]func(context.Context){"sync": func(context.Context) { ran.Add(1) }}}})
	if rec := postJob(h, "sync", ""); rec.Code == http.StatusNoContent || ran.Load() != 0 {
		t.Fatalf("job ran with no secret configured: %d", rec.Code)
	}
}
