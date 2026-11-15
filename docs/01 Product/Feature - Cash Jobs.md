---
type: spec
status: active
owner: Dinesh
updated: 2026-11-15
issue: 33
tags: [spec, home, goals, debts, bills]
---

# Feature — A job for every dollar of cash

## Problem
Coinroof shows what a family has, owes and has to pay, but not what that means for the cash sitting in checking today. People still work out in their head how much is already spoken for and what they can put toward a goal or a debt.

## Goal and success metric
Open Home and see, in one card, how much of today's cash is already spoken for and a plain way to split the rest. Success: owners open the card's detail at least once a month; nobody reads it as advice (no support questions asking "should I").

## User stories
- As a parent, I want to know how much of our checking is free once this month's bills are covered, so I don't move money we need.
- As an owner with a car loan and a trip goal, I want a simple split of the spare cash, so I can choose quickly.
- As a partner, I want the split to count only money I'm allowed to see.

## Scope
**In** (agreed with Dinesh 2026-11-15, [#33](https://github.com/Kolla1997/Tallyn/issues/33)):
- **Cash:** the available balance of checking accounts (Plaid `available`, else `current`) the viewer may see, following the sharing rules ([[Feature - Sharing]]). Owners only, as with Bills.
- **The waterfall, in order. Each step shows its sum:**
  1. **Due before next payday:** unpaid bills ([[Feature - Bills]]), card minimums and loan payments due from today to the day before next payday.
  2. **Everyday buffer:** average daily spending over the last 90 days × days until payday.
  3. **The rest, split by an editable rule:** extra toward the highest-rate debt, then goals' unmet monthly set-asides ([[Feature - Goals]]), then savings. The default rule is a fixed share for each job; people can change the shares or turn a job off.
- **Next payday:** guessed from the last 3 months of income transactions (as the income plan finds income, #133), shown with "change" to set it by hand.
- **When there's nothing spare:** say so plainly ("Bills and the buffer use all of it, $120 short"), never red alarm copy.
- **Copy:** "a common way to split it", never "you should". Coinroof never moves money.
- **Where:** a card on Home; tapping it opens the full waterfall.

**Out (later):**
- Moving money, or linking a split to a real transfer.
- Investments and retirement as jobs.
- Cash in other currencies (US only; see the milestone "Multi-currency (after Coinroof is built)").
- Kids' and teens' own view.

## Design
Dinesh picked **C · Mix** of `drafts/33-cash-jobs.html` (2026-11-15):
- **From B, the tally tape:** checking available now, − due before payday (names listed), − everyday until payday ($X a day for N days), = **Free to give a job**.
- **From A, one bar:** the free amount's jobs as one coloured bar with a legend: extra on the highest-rate debt (Clay), each goal's set-aside, savings (grey).
- **Header:** "Payday Dec 1 (guessed) · change". **Change the split** opens a solid dialog: next payday (empty = guess), the debt share (0 turns it off), goals on or off. Savings takes the rest.
- **Nothing spare:** the tape ends in "Short before payday" and the card says how short, with no jobs.
- **Loading:** the tape's lines rise one after another (`calm-row`), Free counts up from $0 (`CountUp`), then the bar sweeps in part by part (`calm-sweep`). Reduced motion: the finished card.
- Sits on Home in the right-hand column above Family, owners only (`web/src/components/CashJobs.jsx`).

## Tech notes
- **The sums are worked out in the app** (`web/src/lib/cashJobs.js`) from endpoints that already apply the sharing rules: `/api/banks`, `/api/bills` (each month up to payday), `/api/loans`, `/api/goals`, `/api/transactions?category=INCOME` and Home's daily spending. No new query can show more than the viewer may already see. (The draft spec planned one server endpoint; reusing these was simpler and keeps one rule for visibility.)
- **Cash:** everyday depository accounts (not savings, money market, CD or HSA) in the household currency, available balance else current.
- **Dues:** unpaid bills, card minimums and Plaid loan payments due before payday (late ones this month too), each counted once.
- **Buffer:** the last 90 days of spending ÷ 90 × days to payday.
- **Payday guess:** the median gap between income days in the last 90 days, stepped on from the last one; one payday means 30 days; none means the 1st of next month.
- **Split:** the debt share of what's free, capped at that debt's balance; then each goal's unmet set-aside this month (`thisMonth` in `lib/goals.js`); savings takes the rest. The parts always add up to Free.
- **Settings:** `cash_job_settings` (migration 0033): payday, debt_percent, goals per household and owner, with RLS (your own row; owners only). `GET`/`PUT /api/cash-jobs/settings`. Included in the data export (#54).
- Tests: [[Test Plan]] rows under Money.

## Rollout
Shows for owners once built. Migration 0033 must be applied before the card can load its settings; without it the card stays hidden.

## Open questions
> [!todo] Do joint accounts count fully, or only your share? Assume fully, as balances do today.
