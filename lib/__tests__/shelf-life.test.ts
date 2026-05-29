import { getEffectiveUseByDate, addDays } from '../shelf-life'

const today = new Date().toISOString().split('T')[0]

describe('getEffectiveUseByDate', () => {
  describe('use-by mode', () => {
    it('returns the useByDate as-is', () => {
      expect(
        getEffectiveUseByDate({ name: 'chicken', dateType: 'use-by', useByDate: '2026-06-01' })
      ).toBe('2026-06-01')
    })

    it('ignores any boughtDate when dateType is use-by', () => {
      expect(
        getEffectiveUseByDate({
          name: 'chicken',
          dateType: 'use-by',
          useByDate: '2026-06-01',
          boughtDate: '2026-05-01',
        })
      ).toBe('2026-06-01')
    })
  })

  describe('bought mode', () => {
    it('calculates expiry using the ingredient shelf life (spinach = 5 days)', () => {
      expect(
        getEffectiveUseByDate({ name: 'spinach', dateType: 'bought', boughtDate: today })
      ).toBe(addDays(today, 5))
    })

    it('calculates expiry for chicken (2 days shelf life)', () => {
      expect(
        getEffectiveUseByDate({ name: 'chicken', dateType: 'bought', boughtDate: today })
      ).toBe(addDays(today, 2))
    })

    it('defaults to 7 days shelf life for unknown ingredients', () => {
      expect(
        getEffectiveUseByDate({
          name: 'zzz_unknown_ingredient',
          dateType: 'bought',
          boughtDate: today,
        })
      ).toBe(addDays(today, 7))
    })
  })

  describe('no date set', () => {
    it('returns undefined when no dateType or dates are provided', () => {
      expect(getEffectiveUseByDate({ name: 'chicken' })).toBeUndefined()
    })

    it('returns undefined when dateType is use-by but useByDate is missing', () => {
      expect(getEffectiveUseByDate({ name: 'chicken', dateType: 'use-by' })).toBeUndefined()
    })

    it('returns undefined when dateType is bought but boughtDate is missing', () => {
      expect(getEffectiveUseByDate({ name: 'chicken', dateType: 'bought' })).toBeUndefined()
    })
  })
})

describe('addDays', () => {
  it('adds the correct number of days', () => {
    expect(addDays('2026-01-01', 5)).toBe('2026-01-06')
    expect(addDays('2026-01-29', 3)).toBe('2026-02-01')
  })
})
