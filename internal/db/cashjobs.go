package db

import (
	"context"
	"errors"
	"regexp"

	"github.com/jackc/pgx/v5"
)

// CashJobSettings is one owner's choices for the cash card on Home (#33). The
// sums themselves are worked out in the app from data the viewer may see.
type CashJobSettings struct {
	Payday      *string `json:"payday"` // YYYY-MM-DD set by hand; nil means guess it from income
	DebtPercent int     `json:"debt_percent"`
	Goals       bool    `json:"goals"`
}

var dateRE = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`)

// CashJobSettingsFor reads userID's settings, or the defaults. ErrForbidden
// unless they're an owner of the household.
func (d *DB) CashJobSettingsFor(ctx context.Context, userID, householdID string) (CashJobSettings, error) {
	s := CashJobSettings{DebtPercent: 50, Goals: true}
	if !uuidRE.MatchString(householdID) {
		return s, ErrInvalid
	}
	err := d.AsUser(ctx, userID, func(tx pgx.Tx) error {
		if err := mustOwn(ctx, tx, householdID); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `
			select payday::text, debt_percent, goals from public.cash_job_settings
			where household_id = $1 and user_id = $2`, householdID, userID).Scan(&s.Payday, &s.DebtPercent, &s.Goals)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	})
	return s, mapErr(err)
}

// SaveCashJobSettings saves userID's settings. ErrInvalid for a bad date or
// share; ErrForbidden unless they're an owner.
func (d *DB) SaveCashJobSettings(ctx context.Context, userID, householdID string, s CashJobSettings) error {
	if !uuidRE.MatchString(householdID) || s.DebtPercent < 0 || s.DebtPercent > 100 || (s.Payday != nil && !dateRE.MatchString(*s.Payday)) {
		return ErrInvalid
	}
	return mapErr(d.AsUser(ctx, userID, func(tx pgx.Tx) error {
		if err := mustOwn(ctx, tx, householdID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			insert into public.cash_job_settings (household_id, user_id, payday, debt_percent, goals)
			values ($1, $2, $3::date, $4, $5)
			on conflict (household_id, user_id) do update set
			  payday = excluded.payday, debt_percent = excluded.debt_percent, goals = excluded.goals`,
			householdID, userID, s.Payday, s.DebtPercent, s.Goals)
		return err
	}))
}

func mustOwn(ctx context.Context, tx pgx.Tx, householdID string) error {
	var owner bool
	if err := tx.QueryRow(ctx, `select public.has_household_role($1, array['owner'])`, householdID).Scan(&owner); err != nil {
		return err
	}
	if !owner {
		return ErrForbidden
	}
	return nil
}
