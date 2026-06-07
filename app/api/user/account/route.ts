import { NextResponse } from 'next/server'
import { requireAuth, AuthRequiredError } from '@/lib/get-user-id'
import { dynamo } from '@/lib/dynamo'
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function DELETE() {
  let userId: string
  try {
    const resolved = await requireAuth()
    userId = resolved.userId
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 })
  }

  const errors: string[] = []

  // 1. fable-users — single item, delete by PK
  try {
    await dynamo.send(new DeleteCommand({
      TableName: 'fable-users',
      Key: { userId },
    }))
  } catch (e) {
    errors.push('fable-users')
    console.error('[account-delete] fable-users:', e)
  }

  // 2. fable-saved-recipes — query all for userId, delete each
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-saved-recipes',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ProjectionExpression: 'userId, recipeId',
    }))
    await Promise.allSettled((result.Items ?? []).map(item =>
      dynamo.send(new DeleteCommand({
        TableName: 'fable-saved-recipes',
        Key: { userId: item.userId, recipeId: item.recipeId },
      }))
    ))
  } catch (e) {
    errors.push('fable-saved-recipes')
    console.error('[account-delete] fable-saved-recipes:', e)
  }

  // 3. fable-collections — query all for userId, delete each
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-collections',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ProjectionExpression: 'userId, collectionId',
    }))
    await Promise.allSettled((result.Items ?? []).map(item =>
      dynamo.send(new DeleteCommand({
        TableName: 'fable-collections',
        Key: { userId: item.userId, collectionId: item.collectionId },
      }))
    ))
  } catch (e) {
    errors.push('fable-collections')
    console.error('[account-delete] fable-collections:', e)
  }

  // 4. fable-feedback — query all for userId, delete each
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-feedback',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ProjectionExpression: 'userId, recipeId',
    }))
    await Promise.allSettled((result.Items ?? []).map(item =>
      dynamo.send(new DeleteCommand({
        TableName: 'fable-feedback',
        Key: { userId: item.userId, recipeId: item.recipeId },
      }))
    ))
  } catch (e) {
    errors.push('fable-feedback')
    console.error('[account-delete] fable-feedback:', e)
  }

  // 5. fable-rate-limits — query all for userId, delete each
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: 'fable-rate-limits',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ProjectionExpression: 'userId, windowKey',
    }))
    await Promise.allSettled((result.Items ?? []).map(item =>
      dynamo.send(new DeleteCommand({
        TableName: 'fable-rate-limits',
        Key: { userId: item.userId, windowKey: item.windowKey },
      }))
    ))
  } catch (e) {
    errors.push('fable-rate-limits')
    console.error('[account-delete] fable-rate-limits:', e)
  }

  // fable-recipe-shares: no userId stored — already anonymous, nothing to do
  // fable-ingredient-insights: aggregate data only, no personal identifiers — do not touch

  // 6. Neon Postgres — delete Better Auth records (session and account before user)
  try {
    await pool.query('DELETE FROM session WHERE "userId" = $1', [userId])
    await pool.query('DELETE FROM account WHERE "userId" = $1', [userId])
    await pool.query(
      'DELETE FROM verification WHERE identifier = (SELECT email FROM "user" WHERE id = $1)',
      [userId]
    )
    await pool.query('DELETE FROM "user" WHERE id = $1', [userId])
  } catch (e) {
    errors.push('postgres-user')
    console.error('[account-delete] postgres:', e)
  }

  return NextResponse.json({ success: true, errors })
}
