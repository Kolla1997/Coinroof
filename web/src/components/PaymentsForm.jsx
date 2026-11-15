import { createElement, useRef, useState } from 'react'
import { Baby, Car, Check, Droplet, Flame, GraduationCap, HandCoins, House, Landmark, Plus, Receipt, Repeat, Shield, Wifi, X, Zap } from 'lucide-react'
import CountUp from './CountUp.jsx'
import { loanPayment } from './ManualLoan.jsx'
import { IconTile, Pill, MUTED, NUM, OWE, IN } from './calm/ui.jsx'
import { api } from '../lib/api.js'
import { CATEGORIES, FREQUENCIES, frequencyName, shiftMonth } from '../lib/bills.js'
import { fromMinor, toMinor } from '../lib/budgets.js'
import { formatMoney } from '../lib/money.js'

// Bills and loans the bank feed can't see, in one form (#307, #315). Chips add a payment; each one is
// edited as a sentence ("$1,850.00 a month, on day 1") and folds into a one-line row; the total is last.
// Used by the onboarding step (MonthlyCommitments) and by the Bills tab's add and edit dialog.
// Bills are saved with /api/bills (#127), loans with /api/loans (#306). Nothing is saved until Save,
// and a payment that saved is never sent twice.

export const KINDS = {
  rent: { name: 'Rent / Mortgage', icon: House, category: 'housing' },
  electric: { name: 'Electric', icon: Zap, category: 'utilities', varies: true },
  gas: { name: 'Gas', icon: Flame, category: 'utilities', varies: true },
  water: { name: 'Water', icon: Droplet, category: 'utilities', varies: true },
  internet: { name: 'Internet', icon: Wifi, category: 'utilities' },
  insurance: { name: 'Insurance', icon: Shield, category: 'insurance', rename: true },
  other: { name: 'Other', icon: Plus, category: 'other', multi: true },
  loan: { name: 'Loan', icon: Landmark, loan: true, multi: true },
}
export const ONBOARDING_CHIPS = ['rent', 'electric', 'gas', 'water', 'internet', 'loan', 'other']
export const BILLS_CHIPS = ['rent', 'electric', 'gas', 'water', 'internet', 'insurance', 'other', 'loan']
// Any loan the bank can't see (Dinesh, #315). The kind only names it: loans have no kind column.
export const LOAN_KINDS = [
  ['car', 'Car', 'Car loan'],
  ['personal', 'Personal', 'Personal loan'],
  ['education', 'Education', 'Education loan'],
  ['other', 'Other', 'Loan'],
]
const LOAN_NAMES = LOAN_KINDS.map(([, , n]) => n)
const CATEGORY_ICON = { housing: House, utilities: Zap, insurance: Shield, childcare: Baby, subscriptions: Repeat, loan: Landmark }
const PHRASE = { monthly: 'a month,', quarterly: 'every 3 months,', yearly: 'a year,', once: 'once,' }

const FIELD =
  'h-10 min-w-0 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-[14px] tabular-nums text-zinc-900 dark:text-white'
const PART = 'inline-flex items-center gap-1.5 whitespace-nowrap'
const X_BTN = `flex size-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 lg:size-8 ${MUTED} hover:bg-zinc-100 dark:hover:bg-zinc-800`
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white font-semibold whitespace-nowrap text-zinc-900 transition-[background-color,color,scale] duration-200 active:scale-[0.97] aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local
export const ord = (d) => d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th')
const isLoan = (it) => it.k === 'loan'
// A loan shows its kind once picked (Dinesh, #315): the chip itself is a bank, as Bills marks loan payments.
const LOAN_ICON = { car: Car, personal: HandCoins, education: GraduationCap, other: Landmark }
// A saved bill's icon (#319): a name that matches a chip ("Water") keeps that chip's icon, since
// Electric, Gas, Water and Internet all save as utilities; anything else goes by its category.
const BY_NAME = Object.fromEntries(
  Object.values(KINDS)
    .filter((k) => !k.multi)
    .map((k) => [k.name.toLowerCase(), k.icon]),
)
export const billIcon = (name, category) =>
  BY_NAME[
    String(name ?? '')
      .trim()
      .toLowerCase()
  ] ??
  CATEGORY_ICON[category] ??
  Receipt
const iconOf = (it) =>
  it.k === 'bill' || it.k === 'other' ? billIcon(it.name, it.category) : isLoan(it) ? (LOAN_ICON[it.loanKind] ?? Landmark) : KINDS[it.k].icon

const KindIcon = ({ it }) => createElement(iconOf(it), { className: 'size-4' })

// A loan's four figures as numbers, or null until all four are filled in properly.
function loanOf(it, cur) {
  const principal = toMinor(it.principal, cur)
  const apr = Number(String(it.apr).replace('%', ''))
  const months = Number(it.months)
  const ok =
    principal > 0 &&
    String(it.apr).trim() !== '' &&
    apr >= 0 &&
    apr <= 100 &&
    Number.isInteger(months) &&
    months > 0 &&
    months <= 600 &&
    /^\d{4}-\d{2}-\d{2}$/.test(it.first)
  return ok ? { principal, apr, months } : null
}

// What one payment costs, in minor units (0 until it's filled in).
export function monthlyOf(it, cur) {
  if (!isLoan(it)) return toMinor(it.amount, cur) ?? 0
  const l = loanOf(it, cur)
  return l ? loanPayment(l.principal, l.apr, l.months) : 0
}

// The day of the month it's due, 1–31 (0 until known).
export function dayOf(it) {
  const d = Number(isLoan(it) ? String(it.first).slice(8, 10) : it.day)
  return Number.isInteger(d) && d >= 1 && d <= 31 ? d : 0
}

const ready = (it, cur) => it.name.trim() !== '' && (isLoan(it) ? loanOf(it, cur) != null : monthlyOf(it, cur) > 0 && dayOf(it) > 0)

// A new bill's first month in onboarding ('YYYY-MM'): this month, or next month when its day has
// already passed, so a brand-new household doesn't open on a bill marked late.
export function startsOn(day, now) {
  const month = now.slice(0, 7)
  return day < Number(now.slice(8, 10)) ? shiftMonth(month, 1) : month
}

let nextId = 0
export function blank(k) {
  const kind = KINDS[k]
  return {
    id: ++nextId,
    k,
    name: k === 'other' ? '' : k === 'loan' ? 'Car loan' : kind.name,
    amount: '',
    day: '',
    freq: 'monthly',
    starts: '',
    category: kind.category ?? '',
    varies: Boolean(kind.varies),
    paused: false,
    loanKind: 'car',
    principal: '',
    apr: '',
    months: '',
    first: '',
    more: false,
    saved: false,
    failed: false,
  }
}
// An existing bill, to edit.
export function fromBill(b, cur) {
  return {
    ...blank('other'),
    k: 'bill',
    billId: b.id,
    name: b.name,
    amount: fromMinor(b.amount_minor, cur),
    day: String(b.due_day),
    freq: b.frequency,
    starts: b.starts_on,
    category: b.category ?? '',
    varies: b.varies,
    paused: b.paused,
    note: b.note ?? '', // no screen shows notes yet; editing must not wipe one
    more: true,
  }
}

// variant 'onboarding' | 'bills'. `bill` edits one existing bill. `startMonth(day)` gives a new bill's
// first month. `extra(items)` renders under the list (the month strip in onboarding).
export default function PaymentsForm({ household, variant, bill, startMonth, chips, onDone, onCancel, onDelete, extra }) {
  const cur = household.home_currency
  const money = (v) => formatMoney(v, cur)
  const bills = variant === 'bills'
  const editing = Boolean(bill)
  const [items, setItems] = useState(() => (bill ? [fromBill(bill, cur)] : []))
  const [open, setOpen] = useState(() => (bill ? items[0]?.id : null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const list = useRef(null)

  const total = items.reduce((t, it) => t + monthlyOf(it, cur), 0)
  const failed = items.filter((it) => it.failed)
  const left = items.filter((it) => !it.saved).length
  const label = (it) => it.name.trim() || 'Something else'

  const edit = (id) => {
    setOpen(id)
    setTimeout(() => list.current?.querySelector('[data-editor] input')?.focus(), 0)
  }
  const remove = (id) => {
    setError('')
    setItems((all) => all.filter((it) => it.id !== id))
    if (open === id) setOpen(null)
  }
  const toggle = (k) => {
    setError('')
    const has = items.find((it) => it.k === k)
    if (has && !KINDS[k].multi) {
      if (!has.saved) remove(has.id)
      return
    }
    const it = blank(k)
    setItems([...items, it])
    edit(it.id)
  }
  const patch = (id, change) => setItems((all) => all.map((it) => (it.id === id ? { ...it, ...change } : it)))
  const set = (id, key) => (e) => patch(id, { [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const request = (it) => {
    if (isLoan(it)) {
      const l = loanOf(it, cur)
      return [
        '/api/loans',
        'POST',
        {
          household_id: household.id,
          name: it.name.trim(),
          lender: '',
          principal_minor: l.principal,
          apr: String(l.apr),
          months: l.months,
          first_due: it.first,
          balance_minor: null,
        },
      ]
    }
    const day = dayOf(it)
    const body = {
      name: it.name.trim(),
      amount_minor: monthlyOf(it, cur),
      varies: it.varies,
      frequency: it.freq,
      due_day: day,
      starts_on: /^\d{4}-\d{2}$/.test(it.starts) ? it.starts : startMonth(day),
      category: it.category,
      paused: it.paused,
      ...(it.billId && { note: it.note ?? '' }), // an edit keeps the bill's note
    }
    return it.billId ? [`/api/bills/${it.billId}`, 'PUT', body] : ['/api/bills', 'POST', { household_id: household.id, ...body }]
  }

  const save = async () => {
    if (busy) return
    const unfinished = items.find((it) => !it.saved && !ready(it, cur))
    if (unfinished) {
      edit(unfinished.id)
      return setError(
        isLoan(unfinished)
          ? `Finish ${label(unfinished)}: the amount borrowed, interest, length and first payment. Or remove it.`
          : `Finish ${label(unfinished)}: ${unfinished.name.trim() ? '' : 'a name, '}the amount and the day it's due (1 to 31). Or remove it.`,
      )
    }
    setError('')
    if (!editing) setOpen(null)
    setBusy(true)
    const missed = []
    for (const it of items) {
      if (it.saved) continue
      const [path, method, body] = request(it)
      let ok = true
      try {
        await api(path, { method, body })
      } catch {
        ok = false
        missed.push(label(it))
      }
      patch(it.id, { saved: ok, failed: !ok })
    }
    if (!missed.length) return onDone()
    setBusy(false)
    const them = missed.length > 1 ? 'them' : 'it'
    setError(
      editing
        ? "We couldn't save it. Try again in a moment."
        : bills
          ? `We couldn't save ${missed.join(' and ')}. Try again, or close this and add ${them} later.`
          : `We couldn't save ${missed.join(' and ')}. Try again, or continue and add ${them} later in Bills.`,
    )
  }

  const saveLabel = busy ? 'Saving…' : failed.length ? 'Try again' : editing ? 'Save' : bills ? `Save ${left || ''}`.trim() : 'Save and continue'

  return (
    <>
      {!editing && (
        <div role="group" aria-label="Quick add" className="mt-4 flex flex-wrap gap-2">
          {(chips ?? (bills ? BILLS_CHIPS : ONBOARDING_CHIPS)).map((k, i) => {
            const kind = KINDS[k]
            const on = !kind.multi && items.some((it) => it.k === k)
            const I = on ? Check : kind.icon
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind.multi ? undefined : on}
                disabled={busy}
                onClick={() => toggle(k)}
                style={{ '--d': `${200 + i * 50}ms` }}
                className={`calm-rise h-10 px-3.5 text-[13px] lg:h-9 ${CHIP}`}
              >
                <I className="size-3.5" aria-hidden="true" />
                {kind.name}
              </button>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <ul
          ref={list}
          aria-label={editing ? undefined : bills ? 'New bills and loans' : 'Your monthly payments'}
          className={`m-0 list-none divide-y divide-zinc-200 p-0 dark:divide-zinc-800 ${editing ? 'mt-2' : 'mt-4'}`}
        >
          {items.map((it) =>
            open === it.id && !it.saved && !busy ? (
              <Editor
                key={it.id}
                it={it}
                cur={cur}
                money={money}
                set={set}
                patch={patch}
                bills={bills}
                editing={editing}
                onRemove={() => remove(it.id)}
                onDone={() => setOpen(null)}
              />
            ) : (
              <Line key={it.id} it={it} cur={cur} money={money} busy={busy} name={label(it)} onEdit={() => edit(it.id)} onRemove={() => remove(it.id)} />
            ),
          )}
        </ul>
      )}

      {items.length > 0 && extra?.(items)}

      {error && (
        <p className="m-0 mt-3 text-[13px] font-semibold" style={OWE} role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="border-0 bg-transparent p-0 text-[13px] font-semibold underline underline-offset-4"
            style={OWE}
          >
            Delete
          </button>
        ) : items.length ? (
          <p className="m-0">
            <span className={`block text-[22px] leading-tight ${NUM}`}>
              <CountUp value={total} format={money} />
            </span>
            <span className={`text-[13px] ${MUTED}`}>
              {bills ? `next payments · ${items.length} new` : `a month · ${items.length} payment${items.length > 1 ? 's' : ''} outside your bank feed`}
            </span>
          </p>
        ) : (
          <p className={`m-0 text-[13px] ${MUTED}`}>Nothing added yet.</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {bills ? (
            <>
              <Pill quiet onClick={onCancel} disabled={busy}>
                {failed.length ? 'Close' : 'Cancel'}
              </Pill>
              <Pill onClick={save} disabled={busy || !items.length}>
                {saveLabel}
              </Pill>
            </>
          ) : !items.length ? (
            <Pill quiet onClick={onDone}>
              Skip for now
            </Pill>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onDone}
                className={`border-0 bg-transparent px-1.5 py-2.5 text-[13px] font-semibold underline underline-offset-4 ${MUTED}`}
              >
                {failed.length ? `Continue without ${failed.length > 1 ? 'them' : 'it'}` : 'Skip for now'}
              </button>
              <Pill onClick={save} disabled={busy}>
                {saveLabel}
              </Pill>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// One payment, folded: name, when it's due, what it costs. Tap to change it.
function Line({ it, cur, money, busy, name, onEdit, onRemove }) {
  const amount = monthlyOf(it, cur)
  const day = dayOf(it)
  const when = !day ? 'No due day yet' : it.freq === 'monthly' || isLoan(it) ? `Due on the ${ord(day)}` : `${frequencyName(it.freq)}, on the ${ord(day)}`
  const sub = `${when}${isLoan(it) ? ' · loan' : it.varies ? ' · typical amount' : ''}`
  const inner = (
    <>
      <IconTile>
        <KindIcon it={it} />
      </IconTile>
      <span className="min-w-0 grow">
        <span className="block truncate font-semibold">{name}</span>
        <span className={`block text-[13px] ${MUTED}`}>{sub}</span>
      </span>
      {amount ? (
        <span className={`shrink-0 text-[15px] ${NUM}`}>{money(amount)}</span>
      ) : (
        <span className={`shrink-0 text-[13px] underline underline-offset-4 ${MUTED}`}>Add amount</span>
      )}
    </>
  )
  if (it.saved || busy) {
    return (
      <li className="mc-new flex min-h-[52px] items-center gap-2.5 py-1.5">
        {inner}
        <span className="flex w-16 shrink-0 items-center justify-end gap-1 text-[13px] font-semibold" style={it.saved ? IN : undefined} role="status">
          {it.saved ? (
            <>
              Saved <Check className="size-3.5" aria-hidden="true" />
            </>
          ) : (
            <span className={MUTED}>Saving…</span>
          )}
        </span>
      </li>
    )
  }
  return (
    <li className="mc-new flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="flex min-h-[52px] min-w-0 grow items-center gap-2.5 rounded-xl border-0 bg-transparent px-0 py-1.5 text-left text-[14px] text-inherit"
      >
        {inner}
      </button>
      {it.failed && (
        <span className="shrink-0 text-[13px] font-semibold" style={OWE}>
          Not saved
        </span>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className={X_BTN}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

// One payment, open: a sentence whose words are the labels.
function Editor({ it, cur, money, set, patch, bills, editing, onRemove, onDone }) {
  const loan = isLoan(it)
  const name = it.name.trim() || 'this payment'
  const input = (key, label, placeholder, width, extra = {}) => (
    <input
      className={`${FIELD} ${width}`}
      value={it[key]}
      onChange={set(it.id, key)}
      aria-label={label}
      placeholder={placeholder}
      autoComplete="off"
      inputMode="decimal"
      {...extra}
    />
  )
  const pay = monthlyOf(it, cur)
  const day = dayOf(it)
  const done = editing ? null : (
    <button type="submit" className="ml-auto h-9 rounded-full border-0 bg-zinc-900 px-4 text-[13px] font-semibold text-white dark:bg-white dark:text-zinc-900">
      Done
    </button>
  )
  const row = `col-span-full flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] sm:col-start-2 ${MUTED}`
  const pickKind = (k, n) => patch(it.id, { loanKind: k, name: !it.name.trim() || LOAN_NAMES.includes(it.name.trim()) ? n : it.name })
  return (
    <li data-editor className={`mc-new rounded-2xl border-0 bg-zinc-100 p-3 dark:bg-zinc-800 ${editing ? '' : 'my-2'}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onDone()
        }}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2"
      >
        <IconTile>
          <KindIcon it={it} />
        </IconTile>
        {it.k === 'other' || it.k === 'bill' || loan || KINDS[it.k]?.rename ? (
          input('name', loan ? 'Loan name' : 'Name', loan ? 'Car loan' : 'Childcare', 'w-full max-w-60 font-semibold', { inputMode: 'text', maxLength: 60 })
        ) : (
          <b className="text-[14px]">{it.name}</b>
        )}
        {editing ? (
          <span />
        ) : (
          <button type="button" onClick={onRemove} aria-label={`Remove ${it.name.trim() || 'payment'}`} className={X_BTN}>
            <X className="size-4" aria-hidden="true" />
          </button>
        )}

        {loan ? (
          <>
            <div role="group" aria-label="Kind of loan" className="col-span-full flex flex-wrap gap-1.5 sm:col-start-2">
              {LOAN_KINDS.map(([k, short, n]) => (
                <button key={k} type="button" aria-pressed={it.loanKind === k} onClick={() => pickKind(k, n)} className={`h-8 px-3 text-[12px] ${CHIP}`}>
                  {short}
                </button>
              ))}
            </div>
            <div className={row}>
              <span className={PART}>borrowed ${input('principal', 'Amount borrowed', '25000', 'w-24')}</span>
              <span className={PART}>at {input('apr', 'Interest, APR percent', '4.9', 'w-16')}%</span>
              <span className={PART}>over {input('months', 'Length in months', '60', 'w-16', { inputMode: 'numeric' })} months,</span>
              <span className={PART}>first payment {input('first', 'First payment date', '', 'w-40', { type: 'date', inputMode: undefined })}</span>
            </div>
            <div className="col-span-full flex flex-wrap items-center gap-2 sm:col-start-2">
              <p className="m-0 min-w-0 flex-1 basis-60 rounded-xl border border-dashed border-zinc-400 px-3 py-2 text-[13px] dark:border-zinc-600">
                {pay ? (
                  <>
                    Your payment: <b className="tabular-nums">{money(pay)}</b> a month{day ? `, due on the ${ord(day)}` : ''}. It shows in Debts → Other loans,
                    with its payoff date.
                  </>
                ) : (
                  'From your loan papers. Coinroof works out the payment.'
                )}
              </p>
              {done}
            </div>
          </>
        ) : (
          <>
            <div className={row}>
              <span className={PART}>
                {it.varies ? 'about ' : ''}${input('amount', `Amount for ${name}`, '0.00', 'w-24')}
              </span>
              <span className={PART}>
                {PHRASE[it.freq] ?? ''} on day {input('day', `Due day for ${name}`, '1–31', 'w-14', { inputMode: 'numeric' })}
              </span>
              {done}
            </div>
            {bills && !it.more && (
              <button
                type="button"
                onClick={() => patch(it.id, { more: true })}
                className={`col-span-full justify-self-start border-0 bg-transparent p-0 py-1 text-[13px] font-semibold underline underline-offset-4 sm:col-start-2 ${MUTED}`}
              >
                More options: how often, start month
              </button>
            )}
            {bills && it.more && (
              <div className={`${row} border-t border-dashed border-zinc-300 pt-2.5 dark:border-zinc-700`}>
                <label className={PART}>
                  How often
                  <select className={`${FIELD} w-40`} value={it.freq} onChange={set(it.id, 'freq')}>
                    {FREQUENCIES.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={PART}>
                  {it.freq === 'once' ? 'In' : 'Starting'}
                  <input className={`${FIELD} w-40`} type="month" value={it.starts} onChange={set(it.id, 'starts')} />
                </label>
                <label className={PART}>
                  Kind
                  <select className={`${FIELD} w-36`} value={it.category} onChange={set(it.id, 'category')}>
                    <option value="">Not set</option>
                    {CATEGORIES.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={PART}>
                  <input type="checkbox" className="size-4" checked={it.varies} onChange={set(it.id, 'varies')} />
                  The amount changes each time
                </label>
                {editing && (
                  <label className={PART}>
                    <input type="checkbox" className="size-4" checked={it.paused} onChange={set(it.id, 'paused')} />
                    Paused (it stops showing as due)
                  </label>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </li>
  )
}

export { today }
