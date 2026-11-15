import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callsTo, routeApi } from '../test/fakeApi.js'
import CashJobs from './CashJobs.jsx'

// The cash card on Home (#33). All names and amounts are made up.
const api = vi.fn()
vi.mock('../lib/api.js', () => ({ api: (...a) => api(...a) }))

const household = { id: 'hh-1', name: 'Test home', role: 'owner', home_currency: 'USD' }
const banks = [
  {
    accounts: [
      {
        id: 'c',
        name: 'Checking',
        mask: '0001',
        type: 'depository',
        subtype: 'checking',
        currency: 'USD',
        current_balance_minor: 300000,
        available_balance_minor: 300000,
      },
    ],
  },
]
const daily = [{ date: '2026-11-10', currency: 'USD', amount_minor: 450000 }] // $50 a day

function answers({ settings = { payday: null, debt_percent: 50, goals: true }, forbidden = false } = {}) {
  routeApi(api, [
    ['/api/cash-jobs/settings', (p, o) => (forbidden ? new Error('403') : o?.method === 'PUT' ? null : settings)],
    ['/api/transactions', { transactions: [{ date: '2026-11-01', amount_minor: -400000 }] }], // monthly pay: next Dec 1
    ['/api/loans', { loans: [{ name: 'Car loan', apr: '7.5', balance_minor: 800000, currency: 'USD' }] }],
    ['/api/goals', { goals: [] }],
    ['/api/bills', { bills: [{ id: 'w', name: 'Water' }], dues: [{ bill_id: 'w', due: '2026-11-20', status: 'due', expected_minor: 5000, paid_minor: null }] }],
  ])
}
const open = async () => act(async () => render(<CashJobs household={household} banks={banks} daily={daily} />))

describe('CashJobs', () => {
  beforeEach(() => {
    api.mockReset()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('adds up the tape and splits what is free', async () => {
    answers()
    await open()
    const card = within(screen.getByRole('region', { name: "Today's cash" }))
    expect(card.getByText('Payday Dec 1 (guessed) · change')).toBeInTheDocument()
    expect(card.getByText('Water')).toBeInTheDocument()
    expect(card.getByText('$50.00 a day for 16 days')).toBeInTheDocument()
    expect(card.getByText('Free to give a job')).toBeInTheDocument()
    // $3,000 − $50 − $800 = $2,150: half on the car loan, the rest to savings
    expect(card.getByRole('img', { name: 'Extra on Car loan $1,075.00, Savings $1,075.00' })).toBeInTheDocument()
  })

  it('saves payday and the split', async () => {
    answers()
    await open()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Change the split' })))
    const dialog = within(screen.getByRole('dialog', { name: 'Payday and the split' }))
    fireEvent.change(dialog.getByLabelText('Next payday'), { target: { value: '2026-11-28' } })
    fireEvent.change(dialog.getByLabelText(/highest-rate debt/), { target: { value: '20' } })
    await act(async () => fireEvent.click(dialog.getByRole('button', { name: 'Save' })))
    const [[, put]] = callsTo(api, '/api/cash-jobs/settings', 'PUT')
    expect(put.body).toEqual({ payday: '2026-11-28', debt_percent: 20, goals: true })
  })

  it('stays hidden for anyone who is not an owner', async () => {
    answers({ forbidden: true })
    const { container } = await open()
    expect(container).toBeEmptyDOMElement()
  })
})
