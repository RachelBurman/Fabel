/** 90 days expressed as seconds — the TTL for unsaved history entries. */
export const TTL_90_DAYS_SECONDS = 90 * 24 * 60 * 60 // 7,776,000

/**
 * Returns a Unix epoch timestamp in *seconds* (not milliseconds) for use as
 * a DynamoDB TTL attribute.  DynamoDB requires seconds; passing milliseconds
 * would set an expiry ~46,000 years in the future and silently do nothing.
 */
export function ttlFromNow(seconds: number = TTL_90_DAYS_SECONDS): number {
  return Math.floor(Date.now() / 1000) + seconds
}
