import Heading from '../components/Heading.jsx'
import PaymentsForm, { dayOf, monthlyOf, ord, startsOn, today } from '../components/PaymentsForm.jsx'
import { MUTED } from '../components/calm/ui.jsx'
import { formatMoney } from '../lib/money.js'

export { dayOf, monthlyOf, startsOn }

// Monthly commitments (#307), Dinesh's pick A4 of drafts/307-monthly-commitments-2.html: a skippable
// step straight after Create household, once, for the owner who created it. The form is shared with the
// Bills tab (components/PaymentsForm.jsx, #315); here it adds a strip of 31 notches showing when in the
// month the money leaves. A bill whose day has passed starts next month.
export default function MonthlyCommitments({ household, onDone }) {
  const cur = household.home_currency
  const money = (v) => formatMoney(v, cur)
  return (
    <section
      aria-labelledby="commitments-title"
      className="calm-card calm-glass w-full max-w-[600px] rounded-[22px] p-4 text-left text-[14px] text-zinc-900 sm:p-6 dark:text-white"
    >
      <Heading
        id="commitments-title"
        title="Monthly payments"
        className="m-0 text-balance font-[family-name:var(--font-heading)] text-[20px] leading-tight font-bold"
      >
        What do you pay every month that isn&apos;t in your bank feed?
      </Heading>
      <p className={`m-0 mt-1.5 text-[13px] ${MUTED}`}>
        Rent, utilities, a loan. Add what you know now. Only household owners see these, and you can change them later in Bills.
      </p>
      <PaymentsForm
        household={household}
        variant="onboarding"
        startMonth={(day) => startsOn(day, today())}
        onDone={onDone}
        extra={(items) => <Month items={items} cur={cur} money={money} />}
      />
    </section>
  )
}

// Your month: 31 notches, a tall one on each due day, and what lands when.
function Month({ items, cur, money }) {
  const days = new Map()
  let firstWeek = 0
  for (const it of items) {
    const d = dayOf(it)
    const amount = monthlyOf(it, cur)
    if (!d || !amount) continue
    days.set(d, [...(days.get(d) ?? []), it.name.trim() || 'Something else'])
    if (d <= 7) firstWeek += amount
  }
  const due = [...days.keys()].sort((a, b) => a - b)
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3.5 dark:border-zinc-800">
      {due.length ? (
        <>
          <div role="img" aria-label={`Due days across the month: ${due.map(ord).join(', ')}`} className="flex h-[26px] items-end gap-0.5">
            {Array.from({ length: 31 }, (_, i) =>
              days.has(i + 1) ? (
                <i key={`on${i}`} className="calm-pop h-full flex-1 origin-bottom rounded-[2px] bg-zinc-900 dark:bg-white" />
              ) : (
                <i key={i} className="h-2 flex-1 rounded-[2px] bg-zinc-200 dark:bg-zinc-700" />
              ),
            )}
          </div>
          <div className={`mt-1 flex justify-between text-[12px] tabular-nums ${MUTED}`}>
            <span>1st</span>
            <span>31st</span>
          </div>
          <p className={`m-0 mt-1.5 text-[13px] ${MUTED}`}>
            {due.map((d, i) => (
              <span key={d}>
                {i > 0 && ' · '}
                <b className="text-zinc-900 tabular-nums dark:text-white">{ord(d)}</b> {days.get(d).join(', ')}
              </span>
            ))}
            {firstWeek > 0 && (
              <>
                . <b className="text-zinc-900 tabular-nums dark:text-white">{money(firstWeek)}</b> of it is due in the first week.
              </>
            )}
          </p>
        </>
      ) : (
        <p className={`m-0 text-[13px] ${MUTED}`}>Add a due day and it shows here, across the month.</p>
      )}
    </div>
  )
}
