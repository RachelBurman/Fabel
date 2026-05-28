import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "@/lib/dynamo";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { recipeId } = await params;

  await dynamo.send(new DeleteCommand({
    TableName: "fable-saved-recipes",
    Key: { userId, recipeId },
  }));

  return NextResponse.json({ ok: true });
}
