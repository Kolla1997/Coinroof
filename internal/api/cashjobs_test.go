package api

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/Kolla1997/Tallyn/internal/db"
)

// The cash card's settings (#33). Who may save them lives in the database
// (db/cashjobs_test.go); these check the routes pass things through.
type cashStore struct {
	stubStore
	saved db.CashJobSettings
	err   error
}

func (s *cashStore) CashJobSettingsFor(context.Context, string, string) (db.CashJobSettings, error) {
	return db.CashJobSettings{DebtPercent: 50, Goals: true}, s.err
}
func (s *cashStore) SaveCashJobSettings(_ context.Context, _, _ string, in db.CashJobSettings) error {
	s.saved = in
	return s.err
}

func TestCashJobRoutes(t *testing.T) {
	s := &cashStore{}
	h := NewRouter(Deps{WebDir: t.TempDir(), RequireAuth: fakeAuth, Store: s})
	if rec := send(h, "GET", "/api/cash-jobs/settings?household_id=h", ""); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"debt_percent":50`) {
		t.Fatalf("GET: %d %s", rec.Code, rec.Body)
	}
	if rec := send(h, "PUT", "/api/cash-jobs/settings?household_id=h", `{"payday":"2026-12-01","debt_percent":30,"goals":false}`); rec.Code != http.StatusNoContent ||
		s.saved.DebtPercent != 30 || s.saved.Goals || s.saved.Payday == nil || *s.saved.Payday != "2026-12-01" {
		t.Fatalf("PUT: %d %+v", rec.Code, s.saved)
	}
	s.err = db.ErrForbidden
	if rec := send(h, "GET", "/api/cash-jobs/settings?household_id=h", ""); rec.Code != http.StatusForbidden {
		t.Fatalf("not an owner: %d", rec.Code)
	}
}
