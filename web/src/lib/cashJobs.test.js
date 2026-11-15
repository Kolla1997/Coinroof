import { describe, expect, it } from 'vitest'
import { cashJobs, cashOf, duesBefore, guessPayday, topDebt } from './cashJobs.js'

// A job for every dollar (#33). All names and amounts are made up.
const acct = (extra) => ({ id: extra.name, name: 'x', mask: null, currency: 'USD', current_balance_minor: null, available_balance_minor: null, ...extra })
const BANKS = [
  {
    accounts: [
      acct({ name: 'Checking', type: 'depository', subtype: 'checking', current_balance_minor: 260000, available_balance_minor: 250000 }),
      acct({ name: 'Joint', type: 'depository', subtype: 'checking', current_balance_minor: 50000 }),
      acct({ name: 'Rainy day', type: 'depository', subtype: 'savings', current_balance_minor: 900000 }),
      acct({ name: 'Euro', type: 'depository', subtype: 'checking', currency: 'EUR', current_balance_minor: 70000 }),
      acct({
        name: 'Card',
        type: 'credit',
        current_balance_minor: 120000,
        card: { aprs: [{ type: 'purchase_apr', percent: '24.9' }], minimum_payment_minor: 3500, next_payment_due_date: '2026-11-25' },
      }),
      acct({
        name: 'Car',
        type: 'loan',
        subtype: 'auto',
        current_balance_minor: 900000,
        loan: { rate_percent: '6.1', next_payment_due_date: '2026-12-10', next_payment_minor: 30000 },
      }),
    ],
  },
]
const bills = (dues) => [{ bills: [], dues }]
const due = (id, date, minor, status = 'due') => ({ bill_id: id, due: date, status, expected_minor: minor, paid_minor: status === 'paid' ? minor : null })

describe('cashJobs', () => {
  it('counts only everyday checking in the home currency, available first', () => {
    expect(cashOf(BANKS, 'USD').total).toBe(300000)
  })

  it('guesses payday from the usual gap between paychecks', () => {
    expect(guessPayday(['2026-10-01', '2026-10-15', '2026-10-29', '2026-11-12'], '2026-11-15')).toBe('2026-11-26')
    expect(guessPayday(['2026-11-01'], '2026-11-15')).toBe('2026-12-01')
    expect(guessPayday([], '2026-11-15')).toBe('2026-12-01')
    expect(guessPayday(['2026-01-01'], '2026-11-15')).toBe('2026-12-01') // older than 90 days
  })

  it('takes unpaid dues before payday, cards and loans included, once each', () => {
    const list = duesBefore(
      bills([due('rent', '2026-11-01', 100000, 'paid'), due('water', '2026-11-20', 5000), due('net', '2026-12-03', 7000)]),
      BANKS,
      '2026-11-15',
      '2026-12-01',
    )
    expect(list.map((d) => d.bill_id)).toEqual(['water', 'card-Card'])
  })

  it('picks the highest-rate debt, loans added by hand too', () => {
    expect(topDebt(BANKS, [{ name: 'Personal loan', apr: '29.0', balance_minor: 400000, currency: 'USD' }], 'USD').name).toBe('Personal loan')
    expect(topDebt(BANKS, [], 'USD')).toMatchObject({ name: 'Card', rate: 24.9 })
  })

  it('adds up: cash − dues − buffer = free, then debt share, goals, savings', () => {
    const goals = [
      {
        id: 'g',
        name: 'Trip',
        currency: 'USD',
        target_minor: 100000,
        saved_minor: 20000,
        by_month: '2027-01-01',
        history: [{ month: '2026-10-01', saved_minor: 20000 }],
      },
    ]
    const daily = [{ date: '2026-11-10', currency: 'USD', amount_minor: 450000 }] // $4,500 over 90 days = $50 a day
    const r = cashJobs({
      banks: BANKS,
      bills: bills([due('water', '2026-11-20', 5000)]),
      loans: [],
      goals,
      daily,
      today: '2026-11-15',
      payday: '2026-12-01',
      settings: { debt_percent: 50, goals: true },
      cur: 'USD',
    })
    expect(r).toMatchObject({ cash: 300000, due: 8500, perDay: 5000, days: 16, buffer: 80000, free: 211500 })
    expect(r.jobs.map((j) => [j.key, j.minor])).toEqual([
      ['debt', 105750],
      ['goal-g', 40000], // $800 left over 2 months
      ['savings', 65750],
    ])
    expect(r.jobs.reduce((s, j) => s + j.minor, 0)).toBe(r.free)
  })

  it('caps the debt share at what is owed, and leaves jobs out when turned off', () => {
    const r = cashJobs({
      banks: BANKS,
      bills: bills([]),
      loans: [],
      goals: [],
      daily: [],
      today: '2026-11-15',
      payday: '2026-11-20',
      settings: { debt_percent: 100, goals: false },
      cur: 'USD',
    })
    expect(r.jobs.map((j) => [j.key, j.minor])).toEqual([
      ['debt', 120000],
      ['savings', 180000], // the card's minimum is due after this payday
    ])
    const off = cashJobs({
      banks: BANKS,
      bills: bills([]),
      loans: [],
      goals: [],
      daily: [],
      today: '2026-11-15',
      payday: '2026-11-20',
      settings: { debt_percent: 0, goals: false },
      cur: 'USD',
    })
    expect(off.jobs.map((j) => j.key)).toEqual(['savings'])
  })

  it('shows a shortfall with no jobs when dues and the buffer use it all', () => {
    const r = cashJobs({
      banks: BANKS,
      bills: bills([due('rent', '2026-11-28', 400000)]),
      loans: [],
      goals: [],
      daily: [],
      today: '2026-11-15',
      payday: '2026-12-01',
      settings: { debt_percent: 50, goals: true },
      cur: 'USD',
    })
    expect(r.free).toBe(300000 - 403500)
    expect(r.jobs).toEqual([])
  })
})
