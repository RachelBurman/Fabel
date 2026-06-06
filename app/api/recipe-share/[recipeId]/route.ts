import { NextRequest, NextResponse } from 'next/server'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo } from '@/lib/dynamo'
import { type GeneratedRecipe } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await params

  const result = await dynamo.send(new GetCommand({
    TableName: 'fable-recipe-shares',
    Key: { recipeId },
  }))

  if (!result.Item) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  return NextResponse.json({
    recipe: result.Item.fullRecipe as GeneratedRecipe,
    title: result.Item.title as string,
    description: result.Item.description as string,
  })
}
