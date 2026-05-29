import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  let body: { userId?: string; name?: string; recipeIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, name, recipeIds } = body;
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { collectionId } = await params;

  const setParts: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };

  if (name !== undefined) {
    setParts.push("name = :name");
    values[":name"] = name.trim();
  }
  if (recipeIds !== undefined) {
    setParts.push("recipeIds = :recipeIds");
    values[":recipeIds"] = recipeIds;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: "fable-collections",
      Key: { userId, collectionId },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { collectionId } = await params;

  await dynamo.send(
    new DeleteCommand({
      TableName: "fable-collections",
      Key: { userId, collectionId },
    })
  );

  return NextResponse.json({ ok: true });
}
