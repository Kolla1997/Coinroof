package api

import (
	"context"
	"crypto/subtle"
	"net/http"
	"sync"
	"time"
)

// Jobs are the server's background work, run on request from an outside
// timer (#334): Cloud Scheduler calls POST /jobs/{name} with the shared key,
// because Cloud Run's free setup only runs the server while it's answering.
// Without a Secret the routes don't exist at all.
type Jobs struct {
	Secret string                               // JOBS_SECRET, sent as X-Coinroof-Jobs-Key
	Run    map[string]func(ctx context.Context) // e.g. "sync", "email", "daily"
}

// JobsKeyHeader carries the shared key.
const JobsKeyHeader = "X-Coinroof-Jobs-Key"

// jobRunTime is how long a job may keep its request open: a full bank sync
// can take longer than the server's normal write timeout.
const jobRunTime = 30 * time.Minute

func jobsHandler(j Jobs) http.Handler {
	running := map[string]*sync.Mutex{}
	for name := range j.Run {
		running[name] = &sync.Mutex{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get(JobsKeyHeader)
		run := j.Run[r.PathValue("name")]
		// A wrong key and an unknown job look the same: not found.
		if subtle.ConstantTimeCompare([]byte(got), []byte(j.Secret)) != 1 || run == nil {
			http.NotFound(w, r)
			return
		}
		lock := running[r.PathValue("name")]
		if !lock.TryLock() {
			writeJSON(w, http.StatusConflict, map[string]string{"status": "already_running"})
			return
		}
		defer lock.Unlock()
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(jobRunTime))
		run(r.Context())
		w.WriteHeader(http.StatusNoContent)
	})
}
