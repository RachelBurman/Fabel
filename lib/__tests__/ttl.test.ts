import { ttlFromNow, TTL_90_DAYS_SECONDS } from '../ttl'

describe('TTL_90_DAYS_SECONDS', () => {
  it('equals 90 × 24 × 60 × 60 = 7,776,000', () => {
    expect(TTL_90_DAYS_SECONDS).toBe(7_776_000)
  })
})

describe('ttlFromNow', () => {
  it('returns a value in seconds, not milliseconds', () => {
    // Unix epoch in seconds is currently ~1.7 billion; milliseconds are ~1.7 trillion
    const result = ttlFromNow()
    expect(result).toBeLessThan(1e12)
    expect(result).toBeGreaterThan(1e9)
  })

  it('is approximately 90 days in the future from now', () => {
    const beforeCall = Math.floor(Date.now() / 1000) + TTL_90_DAYS_SECONDS
    const result = ttlFromNow()
    const afterCall = Math.floor(Date.now() / 1000) + TTL_90_DAYS_SECONDS
    // Allow ±1 second for test execution time
    expect(result).toBeGreaterThanOrEqual(beforeCall - 1)
    expect(result).toBeLessThanOrEqual(afterCall + 1)
  })

  it('accepts a custom duration in seconds', () => {
    const oneHour = 3600
    const before = Math.floor(Date.now() / 1000)
    const result = ttlFromNow(oneHour)
    const after = Math.floor(Date.now() / 1000)
    expect(result - before).toBeGreaterThanOrEqual(oneHour - 1)
    expect(result - after).toBeLessThanOrEqual(oneHour + 1)
  })

  it('returns an integer (DynamoDB TTL must be a whole number)', () => {
    expect(Number.isInteger(ttlFromNow())).toBe(true)
  })
})
