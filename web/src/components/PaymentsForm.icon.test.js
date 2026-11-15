import { describe, expect, it } from 'vitest'
import { Droplet, Flame, Receipt, Shield, Wifi, Zap } from 'lucide-react'
import { billIcon } from './PaymentsForm.jsx'

// A saved bill keeps its chip's icon (#319): utilities all share one category.
describe('billIcon', () => {
  it('matches a chip by name before the category', () => {
    expect(billIcon('Water', 'utilities')).toBe(Droplet)
    expect(billIcon(' gas ', 'utilities')).toBe(Flame)
    expect(billIcon('Internet', 'utilities')).toBe(Wifi)
    expect(billIcon('Electric', 'utilities')).toBe(Zap)
  })
  it('falls back to the category, then a receipt', () => {
    expect(billIcon('Car insurance', 'insurance')).toBe(Shield)
    expect(billIcon('Sewer', 'utilities')).toBe(Zap)
    expect(billIcon('Piano lessons', '')).toBe(Receipt)
  })
})
