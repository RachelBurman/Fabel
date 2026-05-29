import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const result = await dynamo.send(
    new QueryCommand({
      TableName: "fable-collections",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  return NextResponse.json({ collections: result.Items ?? [] });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; collectionId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, collectionId, name } = body;
  if (!userId || !collectionId || !name?.trim()) {
    return NextResponse.json({ error: "Missing userId, collectionId, or name" }, { status: 400 });
  }

  const now = new Date().toISOString();

  await dynamo.send(
    new PutCommand({
      TableName: "fable-collections",
      Item: {
        userId,
        collectionId,
        name: name.trim(),
        recipeIds: [],
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  return NextResponse.json({ collectionId });
}
