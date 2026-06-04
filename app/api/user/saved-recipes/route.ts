import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getUserId } from "@/lib/get-user-id";
import { ttlFromNow } from "@/lib/ttl";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const resolved = await getUserId(req.nextUrl.searchParams.get("userId")?.trim() ?? undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const result = await dynamo.send(new QueryCommand({
    TableName: "fable-saved-recipes",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }));

  // Filter out history entries (isSaved === false) so they don't appear in the
  // saved screen.  Old records without an isSaved field are treated as saved.
  const items = (result.Items ?? []).filter((item) => item.isSaved !== false);

  return NextResponse.json({ recipes: items });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; recipe?: Record<string, unknown> };
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipe } = body;
  if (!recipe) {
    return NextResponse.json({ error: "Missing recipe" }, { status: 400 });
  }
  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Use the recipe's existing id as the sort key so we can delete by it later
  const recipeId = String(recipe.id ?? crypto.randomUUID());

  // Explicitly saved recipes (isSaved: true) never expire.
  // History entries (isSaved: false / absent) get a 90-day TTL so they are
  // automatically purged from DynamoDB if the user never saves them.
  // When a history entry is later saved, the PUT overwrites the same recipeId
  // with isSaved: true and no ttl, clearing the expiry.
  const item: Record<string, unknown> = {
    userId,
    recipeId,
    ...recipe,
    savedAt: new Date().toISOString(),
  };

  if (recipe.isSaved !== true) {
    item.ttl = ttlFromNow();
  }

  await dynamo.send(new PutCommand({
    TableName: "fable-saved-recipes",
    Item: item,
  }));

  return NextResponse.json({ recipeId });
}
