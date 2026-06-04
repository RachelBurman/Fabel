import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

const TABLE = "fable-rate-limits";

export const GUEST_HOUR_LIMIT = 10;
export const GUEST_DAY_LIMIT = 30;
export const AUTH_HOUR_LIMIT = 50;
export const AUTH_DAY_LIMIT = 200;

export interface RateLimitResult {
  allowed: boolean;
  hourRemaining: number;
  dayRemaining: number;
  resetAt: string; // ISO timestamp of next hour window reset
}

function getWindowKeys(now: Date): { hourKey: string; dayKey: string } {
  const iso = now.toISOString();
  return {
    hourKey: `hour#${iso.slice(0, 13)}`, // "hour#2026-06-04T15"
    dayKey: `day#${iso.slice(0, 10)}`,   // "day#2026-06-04"
  };
}

function getWindowTTLs(now: Date): {
  hourTtl: number;
  dayTtl: number;
  resetAt: string;
} {
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  const nextDay = new Date(now);
  nextDay.setUTCHours(0, 0, 0, 0);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return {
    hourTtl: Math.floor(nextHour.getTime() / 1000),
    dayTtl: Math.floor(nextDay.getTime() / 1000),
    resetAt: nextHour.toISOString(),
  };
}

export async function checkRateLimit(
  userId: string,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const hourLimit = isAuthenticated ? AUTH_HOUR_LIMIT : GUEST_HOUR_LIMIT;
  const dayLimit = isAuthenticated ? AUTH_DAY_LIMIT : GUEST_DAY_LIMIT;

  const now = new Date();
  const { hourKey, dayKey } = getWindowKeys(now);
  const { resetAt } = getWindowTTLs(now);

  try {
    const [hourResult, dayResult] = await Promise.all([
      dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { userId, windowKey: hourKey } })
      ),
      dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { userId, windowKey: dayKey } })
      ),
    ]);

    const hourCount = (hourResult.Item?.count as number) ?? 0;
    const dayCount = (dayResult.Item?.count as number) ?? 0;

    const allowed = hourCount < hourLimit && dayCount < dayLimit;

    return {
      allowed,
      hourRemaining: Math.max(0, hourLimit - hourCount),
      dayRemaining: Math.max(0, dayLimit - dayCount),
      resetAt,
    };
  } catch (err) {
    // Fail open — a DynamoDB blip must never block recipe generation
    console.error("[rate-limiter] DynamoDB check failed, failing open:", err);
    return {
      allowed: true,
      hourRemaining: hourLimit,
      dayRemaining: dayLimit,
      resetAt,
    };
  }
}

// Called only after confirming allowed: true.
// Increments both hour and day counters atomically in a single TransactWriteItems call.
export async function incrementRateLimit(userId: string): Promise<void> {
  const now = new Date();
  const { hourKey, dayKey } = getWindowKeys(now);
  const { hourTtl, dayTtl } = getWindowTTLs(now);

  try {
    await dynamo.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE,
              Key: { userId, windowKey: hourKey },
              UpdateExpression:
                "ADD #count :one SET #ttl = if_not_exists(#ttl, :ttlVal)",
              ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
              ExpressionAttributeValues: { ":one": 1, ":ttlVal": hourTtl },
            },
          },
          {
            Update: {
              TableName: TABLE,
              Key: { userId, windowKey: dayKey },
              UpdateExpression:
                "ADD #count :one SET #ttl = if_not_exists(#ttl, :ttlVal)",
              ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
              ExpressionAttributeValues: { ":one": 1, ":ttlVal": dayTtl },
            },
          },
        ],
      })
    );
  } catch (err) {
    // Fail open — counter miss is better than blocking a user
    console.error("[rate-limiter] DynamoDB increment failed:", err);
  }
}
