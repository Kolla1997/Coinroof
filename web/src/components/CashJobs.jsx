import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { cashJobs, guessPayday } from '../lib/cashJobs.js'
import { formatMoney } from '../lib/money.js'
import { useModal } from '../lib/modal.js'
import CountUp from './CountUp.jsx'
import { Panel, Pill, MUTED, NUM } from './calm/ui.jsx'

// A job for every dollar of cash (#33, Dinesh picked C · Mix of drafts/33-cash-jobs.html): a tally
// tape adds up today's checking, takes off what's due before payday and an everyday buffer, and
// lands on what's free (from B); the free amount's jobs show as one bar with a legend (from A).
// Owners only, like Bills: anyone else gets nothing back and the card stays hidden.
// Loading: the tape's lines rise one after another (calm-row), Free counts up from $0, then the bar
// sweeps in part by part (calm-sweep). Reduced motion: the finished card.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (date) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8))}`
const JOB_TINT = ['var(--color-redesign-accent)', 'var(--color-redesign-in)', 'var(--color-redesign-grey-3)']
const tint = (job, k) => (job.key === 'debt' ? JOB_TINT[0] : job.key === 'savings' ? JOB_TINT[2] : k % 2 ? 'var(--color-redesign-ink)' : JOB_TINT[1])
const FIELD = 'h-10 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-[14px] tabular-nums'
const DIALOG =
  'm-auto max-h-[90svh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white dark:bg-zinc-900 p-5 text-zinc-900 dark:text-white shadow-2xl backdrop:bg-black/40'

const monthsTo = (today, payday) => {
  const out = [today.slice(0, 7)]
  while (out.at(-1) < payday.slice(0, 7)) {
    const [y, m] = out.at(-1).split('-').map(Number)
    out.push(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
  }
  return out
}

export default function CashJobs({ household, banks, daily }) {
  const cur = household.home_currency
  const today = new Date().toLocaleDateString('en-CA')
  const [data, setData] = useState(null) // null while loading or hidden
  const [editing, setEditing] = useState(false)
  const hh = encodeURIComponent(household.id)

  const load = useCallback(async () => {
    try {
      const [settings, income, loans, goals] = await Promise.all([
        api(`/api/cash-jobs/settings?household_id=${hh}`),
        api(`/api/transactions?household_id=${hh}&category=INCOME&limit=100`),
        api(`/api/loans?household_id=${hh}&today=${today}`).catch(() => ({ loans: [] })),
        api(`/api/goals?household_id=${hh}&today=${today}`).catch(() => ({ goals: [] })),
      ])
      const guessed = guessPayday(
        (income.transactions ?? []).filter((t) => t.amount_minor < 0).map((t) => t.date.slice(0, 10)),
        today,
      )
      const payday = settings.payday && settings.payday > today ? settings.payday : guessed
      const bills = await Promise.all(monthsTo(today, payday).map((m) => api(`/api/bills?household_id=${hh}&month=${m}&today=${today}`)))
      setData({ settings, payday, guessed: payday === guessed, bills, loans: loans.loans ?? [], goals: goals.goals ?? [] })
    } catch {
      setData(false) // not an owner, or something failed: no card rather than a wrong one
    }
  }, [hh, today])

  useEffect(() => {
    load()
  }, [load])

  const sums = useMemo(
    () =>
      data &&
      banks &&
      cashJobs({ banks, bills: data.bills, loans: data.loans, goals: data.goals, daily, today, payday: data.payday, settings: data.settings, cur }),
    [data, banks, daily, today, cur],
  )
  if (!data || !sums || sums.cash <= 0) return null
  const money = (m) => formatMoney(m, cur)
  const jobTotal = sums.jobs.reduce((s, j) => s + j.minor, 0)
  const dueNames = sums.dues.map((d) => d.name ?? data.bills.flatMap((b) => b.bills).find((b) => b.id === d.bill_id)?.name).filter(Boolean)

  return (
    <Panel
      id="cash-jobs-h"
      title="Today's cash"
      glass
      meta={
        <button type="button" onClick={() => setEditing(true)} className={`underline underline-offset-4 ${MUTED}`}>
          Payday {short(data.payday)}
          {data.guessed ? ' (guessed)' : ''} · change
        </button>
      }
    >
      <div className="rounded-xl bg-white px-3.5 py-3 text-[13px] tabular-nums dark:bg-zinc-900">
        <Line op="" label="Checking, available now" value={money(sums.cash)} />
        <Line op="−" label={`Due before ${short(data.payday)}`} detail={dueNames.length ? listOf(dueNames) : 'Nothing due'} value={money(sums.due)} />
        <Line
          op="−"
          label="Everyday until payday"
          detail={`${money(sums.perDay)} a day for ${sums.days} ${sums.days === 1 ? 'day' : 'days'}`}
          value={money(sums.buffer)}
        />
        <div className="calm-row mt-1 grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-2 border-t-2 border-zinc-900 pt-2 dark:border-white">
          <span className={`text-center font-semibold ${MUTED}`}>=</span>
          <b className="text-[14px]">{sums.free > 0 ? 'Free to give a job' : 'Short before payday'}</b>
          <b className={`text-[20px] ${NUM}`}>
            <CountUp value={sums.free} start={0} format={money} />
          </b>
        </div>
      </div>

      {sums.free > 0 ? (
        <div className="mt-4">
          <p className={`m-0 mb-1.5 text-[13px] font-semibold ${MUTED}`}>Jobs for the {money(sums.free)}</p>
          <div
            className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-[var(--color-redesign-track)]"
            role="img"
            aria-label={sums.jobs.map((j) => `${j.name} ${money(j.minor)}`).join(', ')}
          >
            {sums.jobs.map((j, k) => (
              <i
                key={j.key}
                className="calm-sweep block h-full"
                style={{ width: `${(j.minor / jobTotal) * 100}%`, background: tint(j, k), '--d': `${900 + k * 90}ms` }}
              />
            ))}
          </div>
          <ul className="m-0 mt-2.5 grid list-none gap-1.5 p-0 text-[13px]">
            {sums.jobs.map((j, k) => (
              <li key={j.key} className="calm-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <i className="size-2.5 shrink-0 rounded-[3px]" style={{ background: tint(j, k) }} aria-hidden="true" />
                  <span className="truncate">
                    {j.name} <span className={MUTED}>· {j.detail}</span>
                  </span>
                </span>
                <b className={`text-[13px] ${NUM}`}>{money(j.minor)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={`m-0 mt-3 text-[13px] ${MUTED}`}>
          Bills and everyday spending use all of it before payday, {money(-sums.free)} short. Nothing to give a job this time.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[12px] ${MUTED}`}>A common way to split it. Coinroof can&apos;t move money.</span>
        <Pill quiet onClick={() => setEditing(true)}>
          Change the split
        </Pill>
      </div>

      {editing && (
        <SplitDialog
          household={household}
          settings={data.settings}
          payday={data.payday}
          today={today}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      )}
    </Panel>
  )
}

function Line({ op, label, detail, value }) {
  return (
    <div className="calm-row grid grid-cols-[18px_minmax(0,1fr)_auto] items-baseline gap-2 py-1">
      <span className={`text-center font-semibold ${MUTED}`}>{op}</span>
      <span className="min-w-0">
        {label}
        {detail && <span className={`block text-[12px] ${MUTED}`}>{detail}</span>}
      </span>
      <b className={`text-[14px] ${NUM}`}>{value}</b>
    </div>
  )
}

const listOf = (names) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`)

// Payday and the split, owners' own. Solid, like every dialog.
function SplitDialog({ household, settings, payday, today, onClose, onSaved }) {
  const ref = useRef(null)
  useModal(ref)
  const [day, setDay] = useState(settings.payday ?? '')
  const [pct, setPct] = useState(String(settings.debt_percent))
  const [goals, setGoals] = useState(settings.goals)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    const n = Number(pct)
    if (!Number.isInteger(n) || n < 0 || n > 100) return setError('Pick a share from 0 to 100.')
    if (day && day <= today) return setError('Pick a payday after today, or leave it empty to let Coinroof guess.')
    setBusy(true)
    try {
      await api(`/api/cash-jobs/settings?household_id=${encodeURIComponent(household.id)}`, {
        method: 'PUT',
        body: { payday: day || null, debt_percent: n, goals },
      })
      onSaved()
    } catch {
      setError("We couldn't save it. Try again in a moment.")
      setBusy(false)
    }
  }
  return (
    <dialog ref={ref} className={DIALOG} aria-labelledby="split-title" onCancel={(e) => (busy ? e.preventDefault() : onClose())}>
      <form onSubmit={save} className="grid gap-3 text-[14px]">
        <h2 id="split-title" className="m-0 mb-1 font-[family-name:var(--font-heading)] text-[18px] font-semibold">
          Payday and the split
        </h2>
        <div className="grid gap-1">
          <label htmlFor="split-payday" className="font-semibold">
            Next payday
          </label>
          <input
            id="split-payday"
            type="date"
            className={FIELD}
            value={day}
            min={today}
            aria-describedby="split-payday-hint"
            onChange={(e) => setDay(e.target.value)}
          />
          <span id="split-payday-hint" className={`text-[12px] ${MUTED}`}>
            Leave it empty and Coinroof guesses from your pay ({short(payday)} now).
          </span>
        </div>
        <div className="grid gap-1">
          <label htmlFor="split-debt" className="font-semibold">
            Share of what&apos;s free toward the highest-rate debt (%)
          </label>
          <input
            id="split-debt"
            className={FIELD}
            inputMode="numeric"
            value={pct}
            aria-describedby="split-debt-hint"
            onChange={(e) => setPct(e.target.value)}
          />
          <span id="split-debt-hint" className={`text-[12px] ${MUTED}`}>
            0 leaves debt out.
          </span>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={goals} onChange={(e) => setGoals(e.target.checked)} />
          Then this month&apos;s goal set-asides
        </label>
        <p className={`m-0 text-[13px] ${MUTED}`}>Savings takes the rest.</p>
        {error && (
          <p className="error m-0" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Pill quiet onClick={onClose} disabled={busy}>
            Cancel
          </Pill>
          <Pill type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Pill>
        </div>
      </form>
    </dialog>
  )
}
