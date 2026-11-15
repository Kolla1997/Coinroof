// A job for every dollar of cash (#33, Dinesh picked C of drafts/33-cash-jobs.html): the sums behind
// the cash card on Home. Everything comes from data the viewer may already see (banks, bills, goals,
// transactions), so the sharing rules hold without new queries. All amounts are minor units in the
// household's currency; other currencies are left out (US only for now).
import { accountKind } from '../components/AccountIcon.jsx'
import { amountOf, cardDues } from './bills.js'
import { thisMonth } from './goals.js'

const DAY = 86400000
const toDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const fromDay = (ms) => new Date(ms).toISOString().slice(0, 10)
export const daysBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / DAY)
const nextMonth = (month) => {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// Checking you can see: each everyday account's available balance, else its current one.
export function cashOf(banks, cur) {
  const accounts = []
  for (const b of banks ?? [])
    for (const a of b.accounts ?? []) {
      if (a.type !== 'depository' || accountKind(a) !== 'everyday' || a.currency !== cur) continue
      const minor = a.available_balance_minor ?? a.current_balance_minor
      if (minor != null) accounts.push({ name: a.name, minor })
    }
  return { total: accounts.reduce((s, a) => s + a.minor, 0), accounts }
}

// Next payday from the last 90 days of income: the usual gap between paydays, stepped on from the
// last one until it's after today. One payday means monthly; none means the 1st of next month.
export function guessPayday(incomeDates, today) {
  const days = [...new Set(incomeDates.filter((d) => d <= today && daysBetween(d, today) <= 90))].sort()
  if (!days.length) return `${nextMonth(today.slice(0, 7))}-01`
  const gaps = days
    .slice(1)
    .map((d, i) => daysBetween(days[i], d))
    .filter((g) => g >= 5)
  const gap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 30
  let next = toDay(days.at(-1))
  while (next <= toDay(today)) next += gap * DAY
  return fromDay(next)
}

// The debt with the highest rate you can see: a card's purchase APR, a Plaid loan's rate or a loan
// you added. Null when no rate is known.
export function topDebt(banks, loans, cur) {
  let top = null
  const consider = (name, rate, balance) => {
    if (!(rate > 0) || !(balance > 0)) return
    if (!top || rate > top.rate) top = { name, rate, balance }
  }
  for (const b of banks ?? [])
    for (const a of b.accounts ?? []) {
      if (a.currency !== cur) continue
      const name = a.mask ? `${a.name} ••${a.mask}` : a.name
      if (a.card) {
        const apr = (a.card.aprs ?? []).find((x) => x.type === 'purchase_apr') ?? a.card.aprs?.[0]
        consider(name, Number(apr?.percent), a.current_balance_minor)
      } else if (a.loan) consider(name, Number(a.loan.rate_percent), a.current_balance_minor)
    }
  for (const l of loans ?? []) if (l.currency === cur) consider(l.name, Number(l.apr), l.balance_minor)
  return top
}

// Bills, card minimums and loan payments still to pay from today to the day before payday. Late
// ones from this month count too: they're still owed.
export function duesBefore(bills, banks, today, payday) {
  const months = [today.slice(0, 7)]
  while (months.at(-1) < payday.slice(0, 7)) months.push(nextMonth(months.at(-1)))
  const all = [...bills.flatMap((b) => b.dues ?? []), ...months.flatMap((m) => cardDues(banks, m))]
  const seen = new Set()
  return all.filter((d) => {
    const key = `${d.bill_id}/${d.due}`
    if (seen.has(key) || d.status === 'paid' || d.due >= payday) return false
    seen.add(key)
    return true
  })
}

// The whole waterfall. bills: the /api/bills answers for each month up to payday; daily: the last
// 90 days of /api/transactions/daily; settings: { debt_percent, goals }.
export function cashJobs({ banks, bills, loans, goals, daily, today, payday, settings, cur }) {
  const cash = cashOf(banks, cur)
  const dues = duesBefore(bills, banks, today, payday).filter((d) => (d.currency ?? cur) === cur)
  const due = dues.reduce((s, d) => s + amountOf(d), 0)
  const from = fromDay(toDay(today) - 90 * DAY)
  const spent = (daily ?? []).filter((d) => d.currency === cur && d.date > from && d.date <= today).reduce((s, d) => s + d.amount_minor, 0)
  const perDay = Math.round(spent / 90)
  const days = Math.max(0, daysBetween(today, payday))
  const buffer = perDay * days
  const free = cash.total - due - buffer

  const jobs = []
  if (free > 0) {
    let left = free
    const debt = topDebt(banks, loans, cur)
    if (debt && settings.debt_percent > 0) {
      const amt = Math.min(Math.round((free * settings.debt_percent) / 100), debt.balance)
      if (amt > 0) jobs.push({ key: 'debt', name: `Extra on ${debt.name}`, detail: `${debt.rate}%, the highest rate`, minor: amt })
      left -= amt
    }
    if (settings.goals) {
      for (const s of thisMonth(goals ?? [], today)) {
        if (s.goal.currency !== cur || s.done) continue
        const amt = Math.min(s.due - s.added, left)
        if (amt <= 0) continue
        jobs.push({ key: `goal-${s.goal.id}`, name: s.goal.name, detail: "this month's set-aside", minor: amt })
        left -= amt
      }
    }
    if (left > 0) jobs.push({ key: 'savings', name: 'Savings', detail: 'the rest', minor: left })
  }
  return { cash: cash.total, dues, due, perDay, days, buffer, free, jobs }
}
