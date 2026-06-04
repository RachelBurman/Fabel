import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo } from '@/lib/dynamo'

type AnyRecord = Record<string, unknown>

function mergeKitchenIngredients(authItems: AnyRecord[], guestItems: AnyRecord[]): AnyRecord[] {
  const authMap = new Map(authItems.map(i => [i.name as string, i]))
  for (const item of guestItems) {
    if (!authMap.has(item.name as string)) {
      authMap.set(item.name as string, item)
    }
    // auth record wins on conflict — don't overwrite existing auth entries
  }
  return Array.from(authMap.values())
}

export async function migrateGuestToAuth(
  guestId: string,
  authUserId: string
): Promise<{ merged: boolean; itemsMerged: number }> {
  let itemsMerged = 0

  // ── 1. fable-users ───────────────────────────────────────────────────────
  try {
    const [guestRes, authRes] = await Promise.all([
      dynamo.send(new GetCommand({ TableName: 'fable-users', Key: { userId: guestId } })),
      dynamo.send(new GetCommand({ TableName: 'fable-users', Key: { userId: authUserId } })),
    ])

    const guest = guestRes.Item as AnyRecord | undefined
    const existing = authRes.Item as AnyRecord | undefined

    if (!guest) return { merged: false, itemsMerged: 0 }

    if (!existing) {
      await dynamo.send(new PutCommand({
        TableName: 'fable-users',
        Item: { ...guest, userId: authUserId },
      }))
    } else {
      await dynamo.send(new PutCommand({
        TableName: 'fable-users',
        Item: {
          ...existing,
          userId: authUserId,
          allergens: [...new Set([...(existing.allergens as string[] ?? []), ...(guest.allergens as string[] ?? [])])],
          customAllergens: [...new Set([...(existing.customAllergens as string[] ?? []), ...(guest.customAllergens as string[] ?? [])])],
          safeIngredients: [...new Set([...(existing.safeIngredients as string[] ?? []), ...(guest.safeIngredients as string[] ?? [])])],
          activePresets: [...new Set([...(existing.activePresets as string[] ?? []), ...(guest.activePresets as string[] ?? [])])],
          ingredients: mergeKitchenIngredients(
            existing.ingredients as AnyRecord[] ?? [],
            guest.ingredients as AnyRecord[] ?? [],
          ),
          preferenceSignals: [
            ...(existing.preferenceSignals as AnyRecord[] ?? []),
            ...(guest.preferenceSignals as AnyRecord[] ?? []),
          ],
          discoverSettings: existing.discoverSettings ?? guest.discoverSettings,
          visibleTabs: existing.visibleTabs ?? guest.visibleTabs,
          tasteProfile: existing.tasteProfile ?? guest.tasteProfile ?? null,
          onboardingComplete: (existing.onboardingComplete === true) || (guest.onboardingComplete === true),
        },
      }))
    }
    itemsMerged++
  } catch (err) {
    console.error('[guest-migration] fable-users merge failed:', err)
  }

  // ── 2. fable-feedback ────────────────────────────────────────────────────
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-feedback',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': guestId },
    }))
    for (const item of result.Items ?? []) {
      try {
        await dynamo.send(new PutCommand({
          TableName: 'fable-feedback',
          Item: { ...(item as AnyRecord), userId: authUserId },
        }))
        itemsMerged++
      } catch (err) {
        console.error('[guest-migration] feedback item failed:', err)
      }
    }
  } catch (err) {
    console.error('[guest-migration] fable-feedback query failed:', err)
  }

  // ── 3. fable-saved-recipes ───────────────────────────────────────────────
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-saved-recipes',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': guestId },
    }))
    for (const item of result.Items ?? []) {
      try {
        await dynamo.send(new PutCommand({
          TableName: 'fable-saved-recipes',
          Item: { ...(item as AnyRecord), userId: authUserId },
        }))
        itemsMerged++
      } catch (err) {
        console.error('[guest-migration] saved-recipes item failed:', err)
      }
    }
  } catch (err) {
    console.error('[guest-migration] fable-saved-recipes query failed:', err)
  }

  // ── 4. fable-collections ─────────────────────────────────────────────────
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-collections',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': guestId },
    }))
    for (const item of result.Items ?? []) {
      try {
        await dynamo.send(new PutCommand({
          TableName: 'fable-collections',
          Item: { ...(item as AnyRecord), userId: authUserId },
        }))
        itemsMerged++
      } catch (err) {
        console.error('[guest-migration] collections item failed:', err)
      }
    }
  } catch (err) {
    console.error('[guest-migration] fable-collections query failed:', err)
  }

  return { merged: true, itemsMerged }
}
