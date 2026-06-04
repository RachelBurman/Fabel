import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";
import { getUserId } from "@/lib/get-user-id";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const resolved = await getUserId(req.nextUrl.searchParams.get("userId")?.trim() ?? undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

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

  const { collectionId, name } = body;
  if (!collectionId || !name?.trim()) {
    return NextResponse.json({ error: "Missing collectionId or name" }, { status: 400 });
  }
  let userId: string;
  try {
    const resolved = await getUserId(typeof body.userId === "string" ? body.userId : undefined);
    userId = resolved.userId;
  } catch {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
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
