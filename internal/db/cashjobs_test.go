package db

import (
	"context"
	"errors"
	"testing"
)

// The cash card's settings (#33): owners only, each person's own row.
func TestCashJobSettings(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	s, err := f.db.CashJobSettingsFor(ctx, alice, f.testHH)
	if err != nil || s.DebtPercent != 50 || !s.Goals || s.Payday != nil {
		t.Fatalf("defaults: %+v %v", s, err)
	}
	day := "2026-12-01"
	if err := f.db.SaveCashJobSettings(ctx, alice, f.testHH, CashJobSettings{Payday: &day, DebtPercent: 30, Goals: false}); err != nil {
		t.Fatalf("save: %v", err)
	}
	s, err = f.db.CashJobSettingsFor(ctx, alice, f.testHH)
	if err != nil || s.DebtPercent != 30 || s.Goals || s.Payday == nil || *s.Payday != day {
		t.Fatalf("saved: %+v %v", s, err)
	}
	if err := f.db.SaveCashJobSettings(ctx, alice, f.testHH, CashJobSettings{DebtPercent: 101}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("101%%: %v", err)
	}
	bad := "2026-13-01"
	if err := f.db.SaveCashJobSettings(ctx, alice, f.testHH, CashJobSettings{Payday: &bad}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad date: %v", err)
	}
	// A child in the household, and an owner of another one, can't read or save.
	if _, err := f.db.CashJobSettingsFor(ctx, carl, f.testHH); !errors.Is(err, ErrForbidden) {
		t.Fatalf("child reads: %v", err)
	}
	if err := f.db.SaveCashJobSettings(ctx, bob, f.testHH, CashJobSettings{DebtPercent: 10}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("outsider saves: %v", err)
	}
}
