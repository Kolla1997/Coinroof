package api

import (
	"net/http"

	"github.com/Kolla1997/Tallyn/internal/db"
)

// GET /api/cash-jobs/settings?household_id=: the owner's payday and split for
// the cash card on Home (#33), or the defaults.
func cashJobSettings(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := userID(w, r)
		if !ok {
			return
		}
		s, err := store.CashJobSettingsFor(r.Context(), uid, r.URL.Query().Get("household_id"))
		if err != nil {
			memberError(w, "cash job settings", err)
			return
		}
		writeJSON(w, http.StatusOK, s)
	}
}

// PUT /api/cash-jobs/settings?household_id=
func saveCashJobSettings(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := userID(w, r)
		if !ok {
			return
		}
		var in db.CashJobSettings
		if !readJSON(w, r, &in) {
			return
		}
		if err := store.SaveCashJobSettings(r.Context(), uid, r.URL.Query().Get("household_id"), in); err != nil {
			memberError(w, "save cash job settings", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
