import { beforeEach, describe, expect, it } from 'vitest'
import { moveOldKeys } from './storage-move.js'

// The rename (#324): old `tallyn.*` keys move to `coinroof.*` once, so nothing people chose is lost.
describe('moveOldKeys', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('moves old keys in both stores and removes them', () => {
    localStorage.setItem('tallyn.theme', 'dark')
    localStorage.setItem('tallyn.household', 'hh-1')
    sessionStorage.setItem('tallyn.just2FA', '1')
    localStorage.setItem('other.key', 'kept')
    moveOldKeys()
    expect(localStorage.getItem('coinroof.theme')).toBe('dark')
    expect(localStorage.getItem('coinroof.household')).toBe('hh-1')
    expect(sessionStorage.getItem('coinroof.just2FA')).toBe('1')
    expect(localStorage.getItem('tallyn.theme')).toBeNull()
    expect(sessionStorage.getItem('tallyn.just2FA')).toBeNull()
    expect(localStorage.getItem('other.key')).toBe('kept')
  })

  it('keeps a value already saved under the new name', () => {
    localStorage.setItem('tallyn.theme', 'dark')
    localStorage.setItem('coinroof.theme', 'light')
    moveOldKeys()
    expect(localStorage.getItem('coinroof.theme')).toBe('light')
    expect(localStorage.getItem('tallyn.theme')).toBeNull()
  })

  it('does nothing when storage is blocked', () => {
    const blocked = {
      get length() {
        throw new Error('blocked')
      },
    }
    expect(() => moveOldKeys([blocked])).not.toThrow()
  })
})
