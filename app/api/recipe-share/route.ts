import { NextRequest, NextResponse } from 'next/server'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo } from '@/lib/dynamo'
import { ttlFromNow } from '@/lib/ttl'
import { type GeneratedRecipe } from '@/lib/types'

export async function POST(req: NextRequest) {
  let body: { recipeId?: string; recipe?: GeneratedRecipe }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { recipeId, recipe } = body
  if (!recipeId || !recipe) {
    return NextResponse.json({ error: 'Missing recipeId or recipe' }, { status: 400 })
  }

  await dynamo.send(new PutCommand({
    TableName: 'fable-recipe-shares',
    Item: {
      recipeId,
      fullRecipe: recipe,
      title: recipe.title,
      description: recipe.description,
      ttl: ttlFromNow(),
      createdAt: new Date().toISOString(),
    },
  }))

  return NextResponse.json({ recipeId })
}
